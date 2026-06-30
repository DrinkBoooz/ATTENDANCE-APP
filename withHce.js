const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SERVICE_NAME = '.HceService';
const APDU_XML_NAME = 'apduservice.xml';

// --- Step 1: Write res/xml/apduservice.xml ---
function withHceApduXml(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/res/xml'
      );
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      const apduXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<host-apdu-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/app_name"
    android:requireDeviceUnlock="false">
    <aid-group android:description="@string/app_name" android:category="other">
        <aid-filter android:name="F0394148148100" />
    </aid-group>
</host-apdu-service>`;

      fs.writeFileSync(path.join(xmlDir, APDU_XML_NAME), apduXmlContent, 'utf-8');
      return cfg;
    },
  ]);
}

// --- Step 2: Inject <service> + <uses-permission> into AndroidManifest.xml ---
function withHceManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    // Ensure NFC permission exists
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }
    const hasNfcPerm = manifest.manifest['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.NFC'
    );
    if (!hasNfcPerm) {
      manifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.NFC' },
      });
    }

    if (!manifest.manifest['uses-feature']) {
      manifest.manifest['uses-feature'] = [];
    }
    manifest.manifest['uses-feature'].push({
      $: { 'android:name': 'android.hardware.nfc.hce', 'android:required': 'false' },
    });

    if (!mainApplication.service) {
      mainApplication.service = [];
    }
    const alreadyInjected = mainApplication.service.some(
      (s) => s.$['android:name'] === SERVICE_NAME
    );
    if (!alreadyInjected) {
      mainApplication.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:exported': 'true',
          'android:permission': 'android.permission.BIND_NFC_SERVICE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.nfc.cardemulation.action.HOST_APDU_SERVICE' },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.nfc.cardemulation.host_apdu_service',
              'android:resource': '@xml/apduservice',
            },
          },
        ],
      });
    }

    return cfg;
  });
}

module.exports = function withHce(config) {
  config = withHceApduXml(config);
  config = withHceManifest(config);
  return config;
};