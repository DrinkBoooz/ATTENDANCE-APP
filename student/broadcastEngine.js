import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Brightness from 'expo-brightness';
import { buildBroadcastPayload, getUtcTimeCounter } from '../crypto/totp';

const PERIOD_SECONDS = 30;

/**
 * Drives a 30-second-synchronized QR payload, and — on Android only —
 * registers an HCE service mirroring the same payload over NFC.
 */
export function useDualBroadcast(studentId, pskBytes) {
  const [payload, setPayload] = useState(() => buildBroadcastPayload(studentId, pskBytes));
  const hceServiceRef = useRef(null);

  // QR loop, ticking on the exact UTC 30s boundary (not just setInterval drift).
  useEffect(() => {
    let timeoutId;

    const tick = () => {
      const next = buildBroadcastPayload(studentId, pskBytes);
      setPayload(next);

      if (Platform.OS === 'android' && hceServiceRef.current) {
        updateHceContent(hceServiceRef.current, next).catch((err) =>
          console.warn('HCE payload update failed:', err.message)
        );
      }

      const msIntoWindow = Date.now() % (PERIOD_SECONDS * 1000);
      const msUntilNextWindow = PERIOD_SECONDS * 1000 - msIntoWindow;
      timeoutId = setTimeout(tick, msUntilNextWindow);
    };

    tick();
    return () => clearTimeout(timeoutId);
  }, [studentId, pskBytes]);

  // Boost screen brightness for reliable QR scanning.
  useEffect(() => {
    let previousBrightness;
    (async () => {
      try {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status === 'granted') {
          previousBrightness = await Brightness.getBrightnessAsync();
          await Brightness.setBrightnessAsync(1.0);
        }
      } catch (err) {
        console.warn('Brightness adjustment failed:', err.message);
      }
    })();
    return () => {
      if (previousBrightness !== undefined) {
        Brightness.setBrightnessAsync(previousBrightness).catch(() => {});
      }
    };
  }, []);

  // Android-only HCE registration — never imported/executed on iOS.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let cancelled = false;
    (async () => {
      try {
        const hce = require('react-native-hce'); // conditional require keeps iOS bundle clean
        const initialPayload = buildBroadcastPayload(studentId, pskBytes);
        const service = await registerHceService(hce, initialPayload);
        if (!cancelled) {
          hceServiceRef.current = service;
        }
      } catch (err) {
        console.warn('HCE registration failed (continuing QR-only):', err.message);
      }
    })();

    return () => {
      cancelled = true;
      if (hceServiceRef.current) {
        try {
          hceServiceRef.current.unmount?.();
        } catch (err) {
          console.warn('HCE teardown error:', err.message);
        }
      }
    };
  }, [studentId, pskBytes]);

  return { payload, timeCounter: getUtcTimeCounter() };
}

async function registerHceService(hce, payloadText) {
  const { HCESession, NFCTagType4NDEFContentType, NFCTagType4 } = hce;
  const content = new NFCTagType4(NFCTagType4NDEFContentType.Text, payloadText);
  const session = await HCESession.getInstance();
  await session.setApplication(content);
  await session.setEnabled(true);
  return {
    unmount: async () => {
      try {
        await session.setEnabled(false);
      } catch (err) {
        console.warn('HCE disable error:', err.message);
      }
    },
  };
}

async function updateHceContent(service, payloadText) {
  try {
    const hce = require('react-native-hce');
    const { HCESession, NFCTagType4NDEFContentType, NFCTagType4 } = hce;
    const session = await HCESession.getInstance();
    const content = new NFCTagType4(NFCTagType4NDEFContentType.Text, payloadText);
    await session.setApplication(content);
  } catch (err) {
    console.warn('HCE content refresh failed:', err.message);
  }
}