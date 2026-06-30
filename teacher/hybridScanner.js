import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import { getDb } from '../database/schema';
import { verifyCode, parseBroadcastPayload } from '../crypto/totp';

const DEBOUNCE_MS = 5000;
const recentScans = new Map(); // studentId -> last-accepted timestamp (ms)

function isDebounced(studentId) {
  const last = recentScans.get(studentId);
  const now = Date.now();
  if (last && now - last < DEBOUNCE_MS) return true;
  recentScans.set(studentId, now);
  return false;
}

async function resolveStudentPsk(studentId) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT psk FROM students WHERE id = ?;`, [studentId]);
  return row ? row.psk : null;
}

/**
 * Verifies a scanned payload's TOTP code, debounces duplicate reads, and
 * writes a Present/Late attendance log for the active session.
 */
export async function processScan(rawPayload, sessionId, lateThresholdSeconds = 900) {
  try {
    const { studentId, code } = parseBroadcastPayload(rawPayload);

    if (isDebounced(studentId)) {
      return { studentId, accepted: false, reason: 'debounced' };
    }

    const psk = await resolveStudentPsk(studentId);
    if (!psk) {
      return { studentId, accepted: false, reason: 'unknown_student' };
    }

    const valid = verifyCode(new Uint8Array(psk), code);
    if (!valid) {
      return { studentId, accepted: false, reason: 'invalid_code' };
    }

    const db = await getDb();
    const session = await db.getFirstAsync(
      `SELECT started_at FROM class_sessions WHERE id = ? AND status = 'Active';`,
      [sessionId]
    );
    if (!session) {
      return { studentId, accepted: false, reason: 'no_active_session' };
    }

    const now = Math.floor(Date.now() / 1000);
    const status = now - session.started_at > lateThresholdSeconds ? 'Late' : 'Present';

    await db.runAsync(
      `INSERT INTO attendance_logs (student_id, session_id, timestamp, status)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(student_id, session_id) DO UPDATE SET status = excluded.status, timestamp = excluded.timestamp;`,
      [studentId, sessionId, now, status]
    );

    return { studentId, accepted: true, status };
  } catch (err) {
    console.warn('Scan processing error:', err.message);
    return { accepted: false, reason: 'error', error: err.message };
  }
}

/** Handler for CameraView's onBarcodeScanned prop. */
export function makeQrScanHandler(sessionId, onResult) {
  return async ({ data }) => {
    const result = await processScan(data, sessionId);
    onResult?.(result);
  };
}

/** Starts a background NFC reader-mode loop; runs concurrently with the camera. */
export async function startNfcListener(sessionId, onResult) {
  try {
    await NfcManager.start();
    let active = true;

    const loop = async () => {
      while (active) {
        try {
          await NfcManager.requestTechnology(NfcTech.Ndef, {
            alertMessage: 'Hold student device near reader',
          });
          const tag = await NfcManager.getTag();
          const ndefRecord = tag?.ndefMessage?.[0];
          if (ndefRecord) {
            const raw = decodeNdefPayload(ndefRecord.payload);
            const result = await processScan(raw, sessionId);
            onResult?.(result);
          }
        } catch (err) {
          // Timeout / no tag — expected during idle polling, loop continues.
        } finally {
          await NfcManager.cancelTechnologyRequest().catch(() => {});
        }
      }
    };

    loop();
    return () => {
      active = false;
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  } catch (err) {
    console.warn('NFC listener failed to start:', err.message);
    return () => {};
  }
}

function decodeNdefPayload(payloadBytes) {
  // Strip the NDEF text-record status byte + language code prefix.
  const langCodeLen = payloadBytes[0] & 0x3f;
  const textBytes = payloadBytes.slice(1 + langCodeLen);
  return String.fromCharCode(...textBytes);
}