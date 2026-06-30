const APP_VARIANT = process.env.APP_VARIANT || 'teacher';
const IS_STUDENT = APP_VARIANT === 'student';

const TEACHER_CONFIG = {
  name: 'AttendanceSuite — Teacher',
  slug: 'attendance-suite-teacher',
  android: { package: 'edu.cvsu.attendance.teacher' },
  ios: { bundleIdentifier: 'edu.cvsu.attendance.teacher' },
};

const STUDENT_CONFIG = {
  name: 'AttendanceSuite — Student',
  slug: 'attendance-suite-student',
  android: { package: 'edu.cvsu.attendance.student' },
  ios: { bundleIdentifier: 'edu.cvsu.attendance.student' },
};

const variantConfig = IS_STUDENT ? STUDENT_CONFIG : TEACHER_CONFIG;

const TEACHER_PLUGINS = [
  [
    'expo-camera',
    { cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera to scan attendance codes.' },
  ],
  'expo-sqlite',
  [
    'react-native-nfc-manager',
    {
      nfcPermission: 'Allow $(PRODUCT_NAME) to use NFC to read attendance broadcasts.',
      selectIdentifiers: [],
      systemCodes: [],
    },
  ],
];

const STUDENT_PLUGINS = [
  [
    'expo-camera',
    { cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera to scan the one-time setup code.' },
  ],
  [
    'expo-brightness',
    { permission: 'Allow $(PRODUCT_NAME) to adjust screen brightness for QR visibility.' },
  ],
  'expo-secure-store',
  './withHce.js',
];

const TEACHER_ANDROID_PERMISSIONS = ['android.permission.CAMERA', 'android.permission.NFC'];
const STUDENT_ANDROID_PERMISSIONS = ['android.permission.CAMERA', 'android.permission.WRITE_SETTINGS'];

module.exports = ({ config }) => ({
  ...config,
  name: variantConfig.name,
  slug: variantConfig.slug,
  orientation: 'portrait',
  platforms: ['android', 'ios'],
  extra: {
    ...(config.extra || {}),
    appVariant: APP_VARIANT,
  },
  android: {
    ...variantConfig.android,
    permissions: IS_STUDENT ? STUDENT_ANDROID_PERMISSIONS : TEACHER_ANDROID_PERMISSIONS,
  },
  ios: {
    ...variantConfig.ios,
    infoPlist: IS_STUDENT
      ? {
          NSCameraUsageDescription: 'Camera access is required to scan the one-time setup code.',
        }
      : {
          NSCameraUsageDescription: 'Camera access is required to scan student QR codes.',
          NFCReaderUsageDescription: 'NFC access is required for the teacher app to read student broadcast tags.',
        },
  },
  plugins: IS_STUDENT ? STUDENT_PLUGINS : TEACHER_PLUGINS,
});
