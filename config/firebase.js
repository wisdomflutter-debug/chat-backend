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
    // Check if service account file exists
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
      ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : path.join(__dirname, '../firebase-service-account.json');

    // Try to initialize with service account file
    if (fs.existsSync(serviceAccountPath)) {
      try {
        // Read and parse the JSON file
        const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        
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
        // Get a reference time from a reliable source (using Date.now() which should be accurate)
        const now = Date.now();
        const timeSkew = Math.abs(systemTimeMs - now);
        
        // Firebase JWT tokens are valid for 1 hour, but clock skew of more than 5 minutes can cause issues
        const maxAllowedSkew = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        if (timeSkew > maxAllowedSkew) {
          console.error(`\n❌ CRITICAL: System time appears to have significant clock skew!`);
          console.error(`   Time difference: ${Math.round(timeSkew / 1000)} seconds`);
          console.error(`   Firebase JWT requires accurate time (within ~5 minutes of actual time)`);
          console.error(`   This WILL cause Firebase JWT validation to fail with "Invalid JWT" error.`);
          console.error(`\n   🔧 FIX SERVER TIME:`);
          console.error(`   On Render/Cloud Hosting:`);
          console.error(`   1. Ensure NTP (Network Time Protocol) is enabled`);
          console.error(`   2. Set timezone to UTC (recommended for servers)`);
          console.error(`   3. Restart the server after fixing time`);
          console.error(`\n   ⚠️  Firebase will NOT work until server time is synchronized!`);
        } else if (timeSkew > 60000) { // More than 1 minute difference
          console.warn(`\n⚠️  WARNING: System time may have slight clock skew (${Math.round(timeSkew / 1000)}s)`);
          console.warn(`   This might cause intermittent JWT validation issues.`);
          console.warn(`   Consider ensuring NTP sync is enabled.`);
        }
        
        // Warn about timezone if not UTC (UTC is recommended for servers)
        if (timezone !== 'UTC' && !timezone.includes('GMT')) {
          console.warn(`\n⚠️  NOTE: Server timezone is ${timezone} (not UTC)`);
          console.warn(`   UTC is recommended for servers to avoid timezone-related issues.`);
          console.warn(`   Firebase JWT uses UTC internally, so timezone shouldn't cause issues, but UTC is best practice.`);
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
          console.log(`   Service account file: ${serviceAccountPath}`);
          console.log(`   Firebase app name: ${admin.apps[0].name}`);
          
          // Note: Credential validation happens on first use (when sending message)
          // The warning about projectId is normal - Firebase Admin SDK doesn't always expose it
          console.log('   ℹ️  Credential will be validated on first FCM send attempt');
          
          return admin;
        } catch (initError) {
          console.error('❌ Error during Firebase initialization:');
          console.error(`   Error: ${initError.message}`);
          if (initError.message.includes('invalid_grant') || initError.message.includes('JWT')) {
            console.error(`\n   This error usually means:`);
            console.error(`   1. Service account key has been revoked`);
            console.error(`   2. Service account key is from wrong project`);
            console.error(`   3. Server time is significantly off (current: ${new Date().toISOString()})`);
            console.error(`\n   Action: Generate a NEW service account key from Firebase Console`);
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
      // For development, you can use environment variables
      // Or initialize without credentials (not recommended for production)
      console.warn('⚠️  Firebase service account file not found.');
      console.warn(`   Expected location: ${serviceAccountPath}`);
      console.warn('   FCM notifications will not work.');
      console.warn('   To enable FCM notifications:');
      console.warn('   1. Download service account JSON from Firebase Console');
      console.warn('   2. Place it in chat-backend/ as firebase-service-account.json');
      console.warn('   3. Or set FIREBASE_SERVICE_ACCOUNT_PATH in .env');
      firebaseInitialized = false; // Don't mark as initialized if file is missing
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


