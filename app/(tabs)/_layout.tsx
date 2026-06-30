import { Tabs } from 'expo-router';
import { Home, UploadCloud, QrCode } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0B5E2E',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="roster"
        options={{ title: 'Roster', tabBarIcon: ({ color, size }) => <UploadCloud color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="provisioning"
        options={{ title: 'Provision', tabBarIcon: ({ color, size }) => <QrCode color={color} size={size} /> }}
      />
    </Tabs>
  );
}