import { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { importRosterFromCsv } from '../../database/rosterImport';
import { wipeLibrary, getDb } from '../../database/schema';

export default function RosterHubScreen() {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [wiping, setWiping] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleImport = async () => {
    try {
      setImporting(true);
      setImportResult(null);
      const result = await importRosterFromCsv();
      setImportResult(result);
      if (result.imported > 0) {
        Alert.alert('Import Complete', `${result.imported} rows imported, ${result.skipped} skipped.`);
      }
    } catch (err) {
      Alert.alert('Import Failed', (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleWipe = () => {
    Alert.alert(
      'Wipe Cached Library?',
      'This permanently deletes all subjects, sections, students, sessions, and attendance logs on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setWiping(true);
              await wipeLibrary();
              setImportResult(null);
              Alert.alert('Done', 'Local library has been reset for a new semester.');
            } catch (err) {
              Alert.alert('Wipe Failed', (err as Error).message);
            } finally {
              setWiping(false);
            }
          },
        },
      ]
    );
  };

  const handleExportHistory = async () => {
    try {
      setExporting(true);
      const db = await getDb();
      const rows = await db.getAllAsync<{
        full_name: string;
        student_id: string;
        section_name: string;
        session_date: string;
        status: string;
      }>(`
        SELECT s.full_name, al.student_id, sec.section_name, cs.session_date, al.status
        FROM attendance_logs al
        JOIN students s ON s.id = al.student_id
        JOIN class_sessions cs ON cs.id = al.session_id
        JOIN sections sec ON sec.id = cs.section_id
        ORDER BY cs.session_date DESC, sec.section_name, s.full_name;
      `);

      const header = 'Student Name,Student Number,Section,Date,Status\n';
      const csvBody = rows
        .map((r) => `"${r.full_name}","${r.student_id}","${r.section_name}","${r.session_date}","${r.status}"`)
        .join('\n');
      const csvContent = header + csvBody;

      const fileUri = `${FileSystem.cacheDirectory}attendance_export_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Attendance History' });
      } else {
        Alert.alert('Exported', `File saved to: ${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Export Failed', (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-csu-cream px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
      <Text className="text-2xl font-extrabold text-csu-green-dark mb-1">Roster Import & Export</Text>
      <Text className="text-sm text-slate-500 mb-6">Manage your local class roster cache</Text>

      {/* Import card */}
      <View className="bg-white rounded-2xl p-5 border border-slate-100 mb-4">
        <Text className="text-lg font-bold text-slate-800 mb-1">Upload CSV Roster</Text>
        <Text className="text-sm text-slate-500 mb-4">
          Columns: Course, Subject Code, Schedule Code, Section, Student Name, Student Number
        </Text>
        <Pressable
          disabled={importing}
          onPress={handleImport}
          className="bg-csu-green rounded-xl py-3 items-center active:opacity-80 disabled:opacity-50"
        >
          {importing ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Upload CSV</Text>}
        </Pressable>
        {importResult && (
          <Text className="text-sm text-slate-500 mt-3">
            Last import: {importResult.imported} imported, {importResult.skipped} skipped.
          </Text>
        )}
      </View>

      {/* Export card */}
      <View className="bg-white rounded-2xl p-5 border border-slate-100 mb-4">
        <Text className="text-lg font-bold text-slate-800 mb-1">Export Attendance History</Text>
        <Text className="text-sm text-slate-500 mb-4">Generates a .csv of every recorded attendance log on this device.</Text>
        <Pressable
          disabled={exporting}
          onPress={handleExportHistory}
          className="bg-csu-gold rounded-xl py-3 items-center active:opacity-80 disabled:opacity-50"
        >
          {exporting ? <ActivityIndicator color="#0B5E2E" /> : <Text className="text-csu-green-dark font-extrabold text-base">Export .CSV</Text>}
        </Pressable>
      </View>

      {/* Danger zone */}
      <View className="bg-white rounded-2xl p-5 border-2 border-status-absent/30 mt-2">
        <Text className="text-lg font-bold text-status-absent mb-1">Danger Zone</Text>
        <Text className="text-sm text-slate-500 mb-4">
          Wiping the library deletes all local data. Use this only at the start of a new semester.
        </Text>
        <Pressable
          disabled={wiping}
          onPress={handleWipe}
          className="bg-status-absent rounded-xl py-3 items-center active:opacity-80 disabled:opacity-50"
        >
          {wiping ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-extrabold text-base">Wipe Cached Library</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}