import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import '../global.css'; // NativeWind entry

const APP_VARIANT: string = Constants.expoConfig?.extra?.appVariant ?? 'teacher';
const IS_STUDENT = APP_VARIANT === 'student';

function TeacherStack() {
  return (
    <SQLiteProvider databaseName="attendance.db">
      <Stack
        initialRouteName="index"
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

function StudentStack() {
  return (
    <Stack
      initialRouteName="student/index"
      screenOptions={{
        headerStyle: { backgroundColor: '#0B5E2E' },
        headerTintColor: '#FFC72C',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#FBF8EF' },
      }}
    >
      <Stack.Screen name="student/index" options={{ title: 'My Attendance Code', headerBackVisible: false }} />
      <Stack.Screen name="student/setup" options={{ title: 'Device Setup' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#0B5E2E" />
      {IS_STUDENT ? <StudentStack /> : <TeacherStack />}
    </>
  );
}