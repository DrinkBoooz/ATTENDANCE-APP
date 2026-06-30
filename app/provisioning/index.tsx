import { useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { randomBytes, bytesToHex } from '@noble/hashes/utils';
import { getDb } from '../../database/schema';

type StudentRow = { id: string; full_name: string; provisioned: number };

export default function ProvisioningScreen() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StudentRow | null>(null);
  const [setupPayload, setSetupPayload] = useState<string | null>(null);

  const loadStudents = async () => {
    const db = await getDb();
    // provisioned flag here is illustrative: any non-null psk counts as provisioned
    // (psk is always generated at import time in Part 1, so this surfaces re-provisioning)
    const rows = await db.getAllAsync<StudentRow>(`
      SELECT id, full_name, 1 as provisioned FROM students ORDER BY full_name;
    `);
    setStudents(rows);
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filtered = students.filter(
    (s: StudentRow) => s.full_name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search)
  );

  const handleSelect = async (student: StudentRow) => {
    setSelected(student);
    setSetupPayload(null);
  };

  const handleGenerateSetupCode = async () => {
    if (!selected) return;
    try {
      const db = await getDb();
      // Regenerating rotates the PSK — invalidates the student's previous setup.
      const newPsk = randomBytes(32);
      await db.runAsync(`UPDATE students SET psk = ? WHERE id = ?;`, [newPsk, selected.id]);

      // Static one-time setup payload: the Student App reads this once to seed its local PSK store.
      const setupObj = { studentId: selected.id, name: selected.full_name, psk: bytesToHex(newPsk) };
      setSetupPayload(JSON.stringify(setupObj));
    } catch (err) {
      Alert.alert('Provisioning Failed', (err as Error).message);
    }
  };

  return (
    <View className="flex-1 bg-csu-cream px-4 pt-4">
      <Text className="text-2xl font-extrabold text-csu-green-dark mb-1">Day-One Provisioning</Text>
      <Text className="text-sm text-slate-500 mb-4">Tap a student, generate their key, scan with the Student App.</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or student number"
        placeholderTextColor="#94a3b8"
        className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 text-base text-slate-800"
      />

      <View className="flex-1 flex-row gap-4">
        <FlatList
          className="flex-1"
          data={filtered}
          keyExtractor={(item: StudentRow) => item.id}
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }: { item: StudentRow }) => (
            <Pressable
              onPress={() => handleSelect(item)}
              className={`rounded-xl px-4 py-3 border ${
                selected?.id === item.id ? 'bg-csu-green border-csu-green' : 'bg-white border-slate-100'
              }`}
            >
              <Text className={`font-bold ${selected?.id === item.id ? 'text-white' : 'text-slate-800'}`}>
                {item.full_name}
              </Text>
              <Text className={`text-xs ${selected?.id === item.id ? 'text-csu-gold' : 'text-slate-500'}`}>
                {item.id}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {selected && (
        <View className="bg-white rounded-2xl p-5 border border-slate-100 mt-4 items-center">
          <Text className="text-lg font-bold text-slate-800 mb-1">{selected.full_name}</Text>
          <Text className="text-xs text-slate-500 mb-4">{selected.id}</Text>

          {setupPayload ? (
            <View className="items-center">
              <View className="bg-white p-3 rounded-xl border-2 border-csu-gold">
                <QRCode value={setupPayload} size={200} />
              </View>
              <Text className="text-xs text-slate-400 mt-3 text-center px-4">
                One-time setup code. Have the student open their app and scan this to provision their device.
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={handleGenerateSetupCode}
              className="bg-csu-gold rounded-xl px-6 py-3 active:opacity-80"
            >
              <Text className="text-csu-green-dark font-extrabold text-base">Generate Setup QR</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}