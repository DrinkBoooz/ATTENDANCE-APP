import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import '../global.css'; // NativeWind entry

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="attendance.db">
      <StatusBar style="light" backgroundColor="#0B5E2E" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0B5E2E' },
          headerTintColor: '#FFC72C',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#FBF8EF' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="session/[sectionId]" options={{ title: 'Active Session', headerBackVisible: false }} />
        <Stack.Screen name="roster/index" options={{ title: 'Roster Import & Export' }} />
        <Stack.Screen name="provisioning/index" options={{ title: 'Day-One Provisioning' }} />
      </Stack>
    </SQLiteProvider>
  );
}