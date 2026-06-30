import { useState, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const PSK_KEY = 'attendance_psk_hex';
const STUDENT_ID_KEY = 'attendance_student_id';
const STUDENT_NAME_KEY = 'attendance_student_name';

type SetupPayload = { studentId: string; name: string; psk: string };

function isValidSetupPayload(obj: unknown): obj is SetupPayload {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.studentId === 'string' &&
    candidate.studentId.length > 0 &&
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    typeof candidate.psk === 'string' &&
    /^[0-9a-fA-F]{64}$/.test(candidate.psk)
  );
}

export default function StudentSetupScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasHandledRef = useRef(false);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (hasHandledRef.current || processing) return;
    hasHandledRef.current = true;
    setProcessing(true);
    setErrorMsg(null);

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        throw new Error('Scanned code is not valid setup data.');
      }

      if (!isValidSetupPayload(parsed)) {
        throw new Error('Scanned code is missing required setup fields.');
      }

      await SecureStore.setItemAsync(PSK_KEY, parsed.psk);
      await SecureStore.setItemAsync(STUDENT_ID_KEY, parsed.studentId);
      await SecureStore.setItemAsync(STUDENT_NAME_KEY, parsed.name);

      router.replace('/student');
    } catch (err) {
      setErrorMsg((err as Error).message);
      hasHandledRef.current = false;
    } finally {
      setProcessing(false);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-csu-cream">
        <ActivityIndicator size="large" color="#0B5E2E" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-csu-cream px-6">
        <Text className="text-lg font-bold text-slate-800 text-center mb-3">Camera Access Needed</Text>
        <Text className="text-sm text-slate-500 text-center mb-5">
          We need your camera to scan the one-time setup code from your instructor.
        </Text>
        <Pressable onPress={requestPermission} className="bg-csu-green rounded-xl px-6 py-3 active:opacity-80">
          <Text className="text-white font-bold text-base">Grant Camera Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <View className="h-[70%] relative">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View className="absolute top-3 left-3 right-3 bg-csu-green-dark/90 rounded-xl px-3 py-2">
          <Text className="text-csu-gold font-bold text-center">Scan Your Setup Code</Text>
        </View>
      </View>

      <View className="flex-1 bg-csu-cream items-center justify-center px-6">
        {processing ? (
          <ActivityIndicator size="large" color="#0B5E2E" />
        ) : errorMsg ? (
          <View className="items-center">
            <Text className="text-status-absent font-bold text-center mb-1">Setup Failed</Text>
            <Text className="text-sm text-slate-500 text-center">{errorMsg}</Text>
            <Text className="text-xs text-slate-400 mt-3 text-center">Point your camera at the QR code shown on your instructor's device.</Text>
          </View>
        ) : (
          <Text className="text-sm text-slate-500 text-center px-4">
            Ask your instructor to open the Provisioning screen on the Teacher App, select your name, and show you the QR code.
          </Text>
        )}
      </View>
    </View>
  );
}
