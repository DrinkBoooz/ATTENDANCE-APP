import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, Animated } from 'react-native';
import { CameraView } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { makeQrScanHandler, startNfcListener } from '../../teacher/hybridScanner';
import { endSession } from '../../teacher/sessionManager';
import { getDb } from '../../database/schema';
import { useSessionStore } from '../../store/sessionStore';

type ScanOutcome = {
  studentId: string;
  accepted: boolean;
  status?: 'Present' | 'Late' | 'Excused';
  reason?: string;
};

export default function ScannerScreen() {
  const { sectionId } = useLocalSearchParams<{ sectionId: string }>();
  const router = useRouter();
  const activeSession = useSessionStore((s) => s.activeSession);
  const scanFeed = useSessionStore((s) => s.scanFeed);
  const pushScanResult = useSessionStore((s) => s.pushScanResult);
  const endSessionLocal = useSessionStore((s) => s.endSessionLocal);

  const [hudName, setHudName] = useState<string | null>(null);
  const [hudStatus, setHudStatus] = useState<'success' | 'error' | null>(null);
  const [ending, setEnding] = useState(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const stopNfcRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!activeSession) return;
    stopNfcRef.current = null;
    startNfcListener(activeSession.id, handleScanResult).then((stop) => {
      stopNfcRef.current = stop;
    });
    return () => stopNfcRef.current?.();
  }, [activeSession?.id]);

  const flashHud = (success: boolean) => {
    setHudStatus(success ? 'success' : 'error');
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, { toValue: 0, duration: 900, useNativeDriver: true }).start(() => {
      setHudStatus(null);
      setHudName(null);
    });
  };

  const resolveStudentName = async (studentId: string) => {
    const db = await getDb();
    const row = await db.getFirstAsync<{ full_name: string }>(
      `SELECT full_name FROM students WHERE id = ?;`,
      [studentId]
    );
    return row?.full_name ?? studentId;
  };

  const handleScanResult = async (result: ScanOutcome) => {
    const name = await resolveStudentName(result.studentId);
    pushScanResult({
      studentId: result.studentId,
      name,
      status: result.accepted ? result.status : `Rejected (${result.reason})`,
      timestamp: Date.now(),
      accepted: result.accepted,
    });
    setHudName(name);
    flashHud(result.accepted);
  };

  const qrHandler = activeSession ? makeQrScanHandler(activeSession.id, handleScanResult) : null;

  const markExcused = async (studentId: string) => {
    if (!activeSession) return;
    try {
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO attendance_logs (student_id, session_id, timestamp, status)
         VALUES (?, ?, ?, 'Excused')
         ON CONFLICT(student_id, session_id) DO UPDATE SET status='Excused', timestamp=excluded.timestamp;`,
        [studentId, activeSession.id, Math.floor(Date.now() / 1000)]
      );
      const name = await resolveStudentName(studentId);
      pushScanResult({ studentId, name, status: 'Excused', timestamp: Date.now(), accepted: true });
    } catch (err) {
      Alert.alert('Error', `Could not mark excused: ${(err as Error).message}`);
    }
  };

  const handleEndSession = () => {
    if (!activeSession) return;
    Alert.alert(
      'End Session?',
      'Unmarked students will be recorded as Absent. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              setEnding(true);
              stopNfcRef.current?.();
              await endSession(activeSession.id);
              endSessionLocal();
              router.replace('/');
            } catch (err) {
              Alert.alert('Error', `Auto-absent sweep failed: ${(err as Error).message}`);
            } finally {
              setEnding(false);
            }
          },
        },
      ]
    );
  };

  if (!activeSession) {
    return (
      <View className="flex-1 items-center justify-center bg-csu-cream px-6">
        <Text className="text-slate-500 text-center mb-4">No active session found.</Text>
        <Pressable onPress={() => router.replace('/')} className="bg-csu-green px-6 py-3 rounded-xl">
          <Text className="text-white font-bold">Back to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Camera fills the upper 60% */}
      <View className="h-[60%] relative">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={qrHandler ?? undefined}
        />
        <Animated.View
          pointerEvents="none"
          className={`absolute inset-0 border-8 ${
            hudStatus === 'success' ? 'border-status-present' : hudStatus === 'error' ? 'border-status-absent' : 'border-transparent'
          }`}
          style={{ opacity: flashOpacity }}
        />
        {hudName && (
          <View className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-xl px-4 py-3">
            <Text className="text-white text-lg font-bold">{hudName}</Text>
            <Text className={`text-sm font-semibold ${hudStatus === 'success' ? 'text-status-present' : 'text-status-absent'}`}>
              {hudStatus === 'success' ? 'Scan Accepted' : 'Scan Rejected'}
            </Text>
          </View>
        )}
        <View className="absolute top-3 left-3 right-3 bg-csu-green-dark/90 rounded-xl px-3 py-2">
          <Text className="text-csu-gold font-bold">{activeSession.sectionName}</Text>
        </View>
      </View>

      {/* Live feed + controls fill the lower 40% */}
      <View className="flex-1 bg-csu-cream px-4 pt-3">
        <Text className="text-slate-700 font-bold mb-2">Live Scan Feed ({scanFeed.length})</Text>
        <View className="flex-1">
          {scanFeed.slice(0, 6).map((entry, idx) => (
            <View key={`${entry.studentId}-${entry.timestamp}-${idx}`} className="flex-row justify-between items-center py-1.5 border-b border-slate-200">
              <Text className="text-slate-800 font-medium">{entry.name}</Text>
              <Text
                className={`text-sm font-bold ${
                  entry.status === 'Present' ? 'text-status-present'
                  : entry.status === 'Late' ? 'text-status-late'
                  : entry.status === 'Excused' ? 'text-status-excused'
                  : 'text-status-absent'
                }`}
              >
                {entry.status}
              </Text>
            </View>
          ))}
        </View>

        <View className="flex-row gap-3 pb-4 pt-2">
          <Pressable
            onPress={() => hudName && markExcused(scanFeed[0]?.studentId)}
            className="flex-1 bg-status-excused/10 border border-status-excused rounded-xl py-3 items-center active:opacity-70"
          >
            <Text className="text-status-excused font-bold">Mark Excused</Text>
          </Pressable>
          <Pressable
            disabled={ending}
            onPress={handleEndSession}
            className="flex-1 bg-status-absent rounded-xl py-3 items-center active:opacity-80 disabled:opacity-50"
          >
            <Text className="text-white font-extrabold">{ending ? 'Ending…' : 'End Session'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}