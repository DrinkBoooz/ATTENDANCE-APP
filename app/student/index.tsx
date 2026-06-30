import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, Animated } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import { hexToBytes } from '@noble/hashes/utils';
import { useDualBroadcast } from '../../student/broadcastEngine';

const PSK_KEY = 'attendance_psk_hex';
const STUDENT_ID_KEY = 'attendance_student_id';
const STUDENT_NAME_KEY = 'attendance_student_name';
const PERIOD_SECONDS = 30;

type Profile = { studentId: string; name: string; pskBytes: Uint8Array };

export default function StudentBroadcastScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    setLoadError(null);
    try {
      const [pskHex, studentId, name] = await Promise.all([
        SecureStore.getItemAsync(PSK_KEY),
        SecureStore.getItemAsync(STUDENT_ID_KEY),
        SecureStore.getItemAsync(STUDENT_NAME_KEY),
      ]);

      if (!pskHex || !studentId || !name) {
        router.replace('/student/setup');
        return;
      }

      setProfile({ studentId, name, pskBytes: hexToBytes(pskHex) });
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoadingProfile(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const { payload, timeCounter } = useDualBroadcast(
    profile?.studentId ?? '',
    profile?.pskBytes ?? new Uint8Array(32)
  );

  useEffect(() => {
    if (!profile) return;
    const msIntoWindow = Date.now() % (PERIOD_SECONDS * 1000);
    const msRemaining = PERIOD_SECONDS * 1000 - msIntoWindow;
    const fractionRemaining = msRemaining / (PERIOD_SECONDS * 1000);

    progressAnim.setValue(fractionRemaining);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: msRemaining,
      useNativeDriver: false,
    }).start();
  }, [timeCounter, profile]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (loadingProfile) {
    return (
      <View className="flex-1 items-center justify-center bg-csu-cream">
        <ActivityIndicator size="large" color="#0B5E2E" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center bg-csu-cream px-6">
        <Text className="text-status-absent font-bold text-center mb-2">Could Not Load Profile</Text>
        <Text className="text-sm text-slate-500 text-center">{loadError}</Text>
      </View>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <View className="flex-1 bg-csu-cream items-center justify-center px-6">
      <Text className="text-2xl font-extrabold text-csu-green-dark mb-1">{profile.name}</Text>
      <Text className="text-sm text-slate-500 mb-8">{profile.studentId}</Text>

      <View className="bg-white p-5 rounded-3xl border-4 border-csu-green shadow-sm">
        <QRCode value={payload} size={240} />
      </View>

      <Text className="text-xs text-slate-400 mt-6 text-center px-6">
        Hold this code steady for your instructor to scan. It refreshes automatically every 30 seconds.
      </Text>

      <View className="w-full max-w-xs h-3 bg-slate-200 rounded-full overflow-hidden mt-6">
        <Animated.View
          style={{ width: progressWidth }}
          className="h-full bg-csu-gold rounded-full"
        />
      </View>
    </View>
  );
}
