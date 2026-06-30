import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getDb } from '../database/schema';
import { startSession } from '../teacher/sessionManager';
import { useSessionStore } from '../store/sessionStore';

type SectionRow = {
  id: number;
  section_name: string;
  subject_code: string;
  course: string;
};

export default function DashboardScreen() {
  const router = useRouter();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);
  const beginSession = useSessionStore((s) => s.beginSession);

  const loadTodaySections = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<SectionRow>(`
        SELECT sec.id, sec.section_name, sub.subject_code, sub.course
        FROM sections sec
        JOIN subjects sub ON sub.id = sec.subject_id
        ORDER BY sub.subject_code, sec.section_name;
      `);
      setSections(rows);
    } catch (err) {
      console.warn('Failed to load sections:', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTodaySections();
    }, [loadTodaySections])
  );

  const handleStartSession = async (section: SectionRow) => {
    try {
      setStartingId(section.id);
      const today = new Date().toISOString().slice(0, 10);
      const sessionId = await startSession(section.id, today);
      beginSession({
        id: sessionId,
        sectionId: section.id,
        sectionName: `${section.subject_code} — ${section.section_name}`,
        startedAt: Date.now(),
      });
      router.push(`/session/${section.id}`);
    } catch (err) {
      console.warn('Failed to start session:', (err as Error).message);
    } finally {
      setStartingId(null);
    }
  };

  return (
    <View className="flex-1 bg-csu-cream px-4 pt-4">
      <Text className="text-2xl font-extrabold text-csu-green-dark mb-1">Today's Sections</Text>
      <Text className="text-sm text-slate-500 mb-4">{new Date().toDateString()}</Text>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0B5E2E" />
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-slate-500 text-center mb-4">
            No sections found. Import a roster CSV to get started.
          </Text>
          <Pressable
            onPress={() => router.push('/roster')}
            className="bg-csu-green px-6 py-3 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-bold text-base">Go to Roster Import</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <Text className="text-lg font-bold text-slate-800">{item.subject_code}</Text>
              <Text className="text-sm text-slate-500 mb-3">{item.course} • {item.section_name}</Text>
              <Pressable
                disabled={startingId === item.id}
                onPress={() => handleStartSession(item)}
                className="bg-csu-gold rounded-xl py-3 items-center active:opacity-80 disabled:opacity-50"
              >
                {startingId === item.id ? (
                  <ActivityIndicator color="#0B5E2E" />
                ) : (
                  <Text className="text-csu-green-dark font-extrabold text-base">Start Session</Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}