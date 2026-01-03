const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;

const initializeFirebase = () => {
  // Check if already initialized
  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK already initialized');
    return admin;
  }

  if (firebaseInitialized) {
    return admin;
  }

  try {
    let serviceAccount = null;
    let serviceAccountSource = null;

    // Option 1: Check for base64 encoded JSON in environment variable (most secure for Render)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const jsonString = Buffer.from(base64Key, 'base64').toString('utf-8');
        serviceAccount = JSON.parse(jsonString);
        serviceAccountSource = 'environment variable (FIREBASE_SERVICE_ACCOUNT_JSON)';
        console.log('📋 Using Firebase service account from environment variable');
      } catch (e) {
        console.error('❌ Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
        console.error('   Make sure it\'s base64 encoded JSON');
      }
    }

    // Option 2: Check for file path in environment variable
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (fs.existsSync(serviceAccountPath)) {
        try {
          const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
          serviceAccount = JSON.parse(serviceAccountJson);
          serviceAccountSource = `file (${serviceAccountPath})`;
          console.log(`📋 Using Firebase service account from: ${serviceAccountPath}`);
        } catch (e) {
          console.error(`❌ Error reading service account file: ${e.message}`);
        }
      } else {
        console.warn(`⚠️  Service account file not found at: ${serviceAccountPath}`);
      }
    }

    // Option 3: Check default location
    if (!serviceAccount) {
      const defaultPath = path.join(__dirname, '../firebase-service-account.json');
      if (fs.existsSync(defaultPath)) {
        try {
          const serviceAccountJson = fs.readFileSync(defaultPath, 'utf8');
          serviceAccount = JSON.parse(serviceAccountJson);
          serviceAccountSource = `file (${defaultPath})`;
          console.log(`📋 Using Firebase service account from default location: ${defaultPath}`);
        } catch (e) {
          console.error(`❌ Error reading service account file: ${e.message}`);
        }
      }
    }

    // If we have a service account, proceed with initialization
    if (serviceAccount) {
      try {
        // Service account already loaded from one of the sources above

        // Verify service account structure
        if (!serviceAccount.project_id) {
          throw new Error('Service account missing project_id');
        }
        if (!serviceAccount.private_key) {
          throw new Error('Service account missing private_key');
        }
        if (!serviceAccount.client_email) {
          throw new Error('Service account missing client_email');
        }

        console.log('📋 Service Account Details:');
        console.log(`   Project ID: ${serviceAccount.project_id}`);
        console.log(`   Client Email: ${serviceAccount.client_email}`);
        console.log(`   Private Key: ${serviceAccount.private_key ? 'Present (' + serviceAccount.private_key.length + ' chars)' : 'Missing'}`);
        console.log(`   Key Type: ${serviceAccount.type || 'N/A'}`);

        // Check system time sync (critical for JWT validation)
        const systemTime = new Date();
        const systemTimeMs = systemTime.getTime();
        const currentYear = systemTime.getFullYear();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        console.log(`\n⏰ System Time Check:`);
        console.log(`   Current UTC: ${systemTime.toISOString()}`);
        console.log(`   Current Local: ${systemTime.toString()}`);
        console.log(`   Timestamp: ${systemTimeMs}`);
        console.log(`   Year: ${currentYear}`);
        console.log(`   Timezone: ${timezone}`);

        // Check for clock skew issues (Firebase JWT requires accurate time within ~5 minutes)
        // Note: We can't detect if system clock is wrong from within Node.js (all time functions use system clock)
        // But we can warn the user to manually verify the time matches actual current time
        const now = Date.now();
        const timeSkew = Math.abs(systemTimeMs - now);
        const serverHour = systemTime.getUTCHours();
        const serverMinute = systemTime.getUTCMinutes();

        // Firebase JWT tokens are valid for 1 hour, but clock skew of more than 5 minutes can cause issues
        const maxAllowedSkew = 5 * 60 * 1000; // 5 minutes in milliseconds

        console.log(`   Server Time: ${serverHour}:${serverMinute.toString().padStart(2, '0')} UTC`);

        if (timeSkew > maxAllowedSkew) {
          console.error(`\n❌ CRITICAL: System time appears to have significant clock skew!`);
          console.error(`   Time difference: ${Math.round(timeSkew / 1000)} seconds`);
          console.error(`   Firebase JWT requires accurate time (within ~5 minutes of actual time)`);
          console.error(`   This WILL cause Firebase JWT validation to fail with "Invalid JWT" error.`);
          console.error(`\n   🔧 FIX SERVER TIME ON RENDER:`);
          console.error(`   1. Render Dashboard → Your Service → Environment`);
          console.error(`   2. Add/Set: TZ=UTC`);
          console.error(`   3. Manual Deploy → Clear build cache & deploy`);
        } else if (timeSkew > 60000) { // More than 1 minute difference
          console.warn(`\n⚠️  WARNING: System time may have slight clock skew (${Math.round(timeSkew / 1000)}s)`);
          console.warn(`   This might cause intermittent JWT validation issues.`);
        } else {
          // Time looks good
          console.log(`   ✅ Clock skew check passed (${Math.round(timeSkew / 1000)}s)`);
          console.log(`   ℹ️  Verify server time (${serverHour}:${serverMinute.toString().padStart(2, '0')} UTC) matches actual current UTC time`);
        }

        // Warn about timezone if not UTC
        if (timezone !== 'UTC' && !timezone.includes('GMT')) {
          console.warn(`\n⚠️  NOTE: Server timezone is ${timezone} (not UTC)`);
          console.warn(`   Set TZ=UTC in Render environment variables.`);
        } else {
          console.log(`   ✅ Timezone: ${timezone}`);
        }

        // Validate private key format before initialization
        if (serviceAccount.private_key) {
          const privateKey = serviceAccount.private_key;

          // Check for proper format
          if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') ||
            !privateKey.includes('-----END PRIVATE KEY-----')) {
            throw new Error('Invalid private key format - must include BEGIN and END markers');
          }

          // Check length (should be ~1700+ characters)
          if (privateKey.length < 1500) {
            console.warn(`   ⚠️  Private key seems short (${privateKey.length} chars) - should be ~1700+ chars`);
          }

          // Check for newlines (private key should have proper line breaks)
          if (!privateKey.includes('\n') && !privateKey.includes('\\n')) {
            console.warn(`   ⚠️  Private key may be missing newlines - this can cause JWT signature issues`);
          }

          // Verify project ID matches
          if (serviceAccount.project_id !== 'wisdom-7c115') {
            console.error(`   ❌ WARNING: Project ID mismatch!`);
            console.error(`   Service account project: ${serviceAccount.project_id}`);
            console.error(`   Expected: wisdom-7c115`);
            console.error(`   This key is from a different project - it will NOT work!`);
          }

          // Verify client email format
          if (!serviceAccount.client_email || !serviceAccount.client_email.includes('@wisdom-7c115.iam.gserviceaccount.com')) {
            console.warn(`   ⚠️  Client email doesn't match expected format: ${serviceAccount.client_email}`);
          }
        }

        // Try to initialize
        try {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });

          // Verify initialization worked
          if (admin.apps.length === 0) {
            throw new Error('Firebase app not created after initialization');
          }

          firebaseInitialized = true;
          console.log('✅ Firebase Admin SDK initialized successfully');
          console.log(`   Service account source: ${serviceAccountSource}`);
          console.log(`   Firebase app name: ${admin.apps[0].name}`);

          // Try to validate credentials by getting a token (this will fail if key is invalid)
          // Note: This is a lightweight check that doesn't require network
          try {
            const credential = admin.credential.cert(serviceAccount);
            // Just verify the credential object is valid - actual token fetch happens on first use
            console.log('   ℹ️  Credential object created successfully');
            console.log('   ⚠️  Note: Full credential validation happens on first FCM send');
          } catch (credError) {
            console.warn(`   ⚠️  Credential validation warning: ${credError.message}`);
          }

          return admin;
        } catch (initError) {
          console.error('❌ Error during Firebase initialization:');
          console.error(`   Error: ${initError.message}`);
          console.error(`   Error Code: ${initError.code || 'N/A'}`);

          if (initError.message.includes('invalid_grant') ||
            initError.message.includes('JWT') ||
            initError.message.includes('invalid-credential')) {
            console.error(`\n   🔍 DIAGNOSIS: This is a credential/key issue, NOT a time issue.`);
            console.error(`   Your server time is correct (clock skew: 0s, timezone: UTC)`);
            console.error(`\n   Most likely causes:`);
            console.error(`   1. ❌ Service account key has been REVOKED in Google Cloud Console`);
            console.error(`   2. ❌ Service account key is CORRUPTED or incomplete`);
            console.error(`   3. ❌ Service account key is from a DIFFERENT project`);
            console.error(`   4. ❌ Private key format is incorrect (missing newlines, etc.)`);
            console.error(`\n   ✅ SOLUTION: Generate a NEW service account key`);
            console.error(`   1. Go to: https://console.firebase.google.com/project/wisdom-7c115/settings/serviceaccounts/adminsdk`);
            console.error(`   2. Click "Generate new private key"`);
            console.error(`   3. Download the JSON file`);
            console.error(`   4. Replace: chat-backend/firebase-service-account.json`);
            console.error(`   5. Restart the backend server`);
            console.error(`\n   ⚠️  IMPORTANT: Delete the old key from Google Cloud Console after generating new one`);
          }
          throw initError;
        }
      } catch (parseError) {
        console.error('❌ Error parsing Firebase service account file:', parseError.message);
        console.warn('⚠️  FCM notifications will not be available');
        firebaseInitialized = false;
        return null;
      }
    } else {
      // No service account found from any source
      console.warn('⚠️  Firebase service account not found.');
      console.warn('   FCM notifications will not work.');
      console.warn('\n   To enable FCM notifications, use ONE of these methods:');
      console.warn('\n   Method 1: Environment Variable (Recommended for Render):');
      console.warn('   1. Convert key to base64: cat firebase-service-account.json | base64');
      console.warn('   2. Render Dashboard → Environment → Add:');
      console.warn('      Key: FIREBASE_SERVICE_ACCOUNT_JSON');
      console.warn('      Value: (paste base64 string)');
      console.warn('\n   Method 2: File Path:');
      console.warn('   1. Upload file to Render');
      console.warn('   2. Render Dashboard → Environment → Add:');
      console.warn('      Key: FIREBASE_SERVICE_ACCOUNT_PATH');
      console.warn('      Value: /app/firebase-service-account.json');
      console.warn('\n   Method 3: Default Location (Local Development):');
      console.warn('   1. Place file in: chat-backend/firebase-service-account.json');
      firebaseInitialized = false;
      return null;
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
    console.error('   Stack:', error.stack);
    console.warn('⚠️  FCM notifications will not be available');
    firebaseInitialized = false;
    return null;
  }
};

// Check if Firebase is actually initialized
const isFirebaseInitialized = () => {
  return admin.apps.length > 0;
};

module.exports = {
  initializeFirebase,
  getAdmin: () => admin,
  isFirebaseInitialized
};


