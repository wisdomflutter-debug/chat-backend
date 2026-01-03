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
        console.log(`\n⏰ System Time Check:`);
        console.log(`   Current time: ${systemTime.toISOString()}`);
        console.log(`   Local time: ${systemTime.toString()}`);
        console.log(`   Timestamp: ${systemTimeMs}`);
        
        // Warn if time seems suspiciously off (more than 1 hour difference from expected)
        // Note: This is a rough check - actual validation happens when JWT is created
        const expectedTimeRange = {
          min: new Date('2025-01-01').getTime(),
          max: new Date('2027-01-01').getTime()
        };
        if (systemTimeMs < expectedTimeRange.min || systemTimeMs > expectedTimeRange.max) {
          console.warn(`\n⚠️  WARNING: System time appears to be significantly off!`);
          console.warn(`   This will cause Firebase JWT validation to fail.`);
          console.warn(`   Please sync your system time:`);
          console.warn(`   macOS: System Preferences → Date & Time → Set automatically`);
          console.warn(`   Or run: sudo sntp -sS time.apple.com`);
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


