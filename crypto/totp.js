import { kmac256 } from '@noble/hashes/sha3-addons';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';

const PERIOD_SECONDS = 30;
const CUSTOMIZATION = utf8ToBytes('CVSU-ATTENDANCE-V1');

/** Strictly UTC, integer-second time counter (RFC 6238-style). */
export function getUtcTimeCounter(periodSeconds = PERIOD_SECONDS) {
  return Math.floor(Date.now() / 1000 / periodSeconds);
}

function timeCounterToBytes(timeCounter) {
  const buf = new Uint8Array(8);
  let tc = BigInt(timeCounter);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(tc & 0xffn);
    tc >>= 8n;
  }
  return buf;
}

/**
 * Dynamic truncation per RFC 4226 §5.3, applied to a KMAC256 digest.
 * Returns a zero-padded 8-digit decimal code (32-bit code space).
 */
function dynamicTruncate(digestBytes) {
  const offset = digestBytes[digestBytes.length - 1] & 0x0f;
  const binCode =
    ((digestBytes[offset] & 0x7f) << 24) |
    ((digestBytes[offset + 1] & 0xff) << 16) |
    ((digestBytes[offset + 2] & 0xff) << 8) |
    (digestBytes[offset + 3] & 0xff);
  return (binCode % 100000000).toString().padStart(8, '0');
}

/**
 * Generates a rotating code for a given PSK and (optionally explicit) time counter.
 * @param {Uint8Array} pskBytes 32-byte (256-bit) pre-shared key
 * @param {number} [timeCounter] defaults to the current UTC window
 * @returns {string} 8-digit decimal code
 */
export function generateCode(pskBytes, timeCounter = getUtcTimeCounter()) {
  try {
    const message = timeCounterToBytes(timeCounter);
    const digest = kmac256(pskBytes, message, { personalization: CUSTOMIZATION, dkLen: 32 });
    return dynamicTruncate(digest);
  } catch (err) {
    throw new Error(`KMAC256 code generation failed: ${err.message}`);
  }
}

/**
 * Verifies a presented code against a PSK, tolerating ±1 window of clock drift.
 * @returns {boolean}
 */
export function verifyCode(pskBytes, presentedCode) {
  try {
    const current = getUtcTimeCounter();
    for (const offset of [0, -1, 1]) {
      if (generateCode(pskBytes, current + offset) === presentedCode) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('Code verification error:', err.message);
    return false;
  }
}

/** Builds the compact broadcast payload (QR text / NFC APDU response), kept <50 bytes. */
export function buildBroadcastPayload(studentId, pskBytes) {
  const code = generateCode(pskBytes);
  return JSON.stringify({ s: studentId, c: code }); // typically ~30-45 bytes
}

export function parseBroadcastPayload(raw) {
  const obj = JSON.parse(raw);
  if (!obj.s || !obj.c) throw new Error('Malformed broadcast payload');
  return { studentId: obj.s, code: obj.c };
}