const admin = require('firebase-admin');
const User = require('../models/User');
const { isFirebaseInitialized } = require('../config/firebase');

// Send notification to user
const sendNotification = async (empId, notification) => {
  try {
    console.log(`\n🔔 ============================================`);
    console.log(`🔔 FCM NOTIFICATION DEBUG START`);
    console.log(`🔔 ============================================`);
    console.log(`Target empId: ${empId}`);
    console.log(`Notification title: ${notification.notification?.title || 'N/A'}`);
    console.log(`Notification body: ${notification.notification?.body || 'N/A'}`);
    console.log(`Notification data:`, JSON.stringify(notification.data || {}, null, 2));
    
    // Check if Firebase is initialized
    const isInitialized = isFirebaseInitialized();
    const appsCount = admin.apps.length;
    console.log(`Firebase initialized: ${isInitialized}`);
    console.log(`Firebase apps count: ${appsCount}`);
    
    if (!isInitialized && appsCount === 0) {
      console.error('⚠️  Firebase Admin SDK not initialized. Skipping notification.');
      console.error('   Please add firebase-service-account.json to enable FCM notifications.');
      console.log(`🔔 ============================================\n`);
      return { success: false, message: 'Firebase not initialized' };
    }
    
    // Check for time sync issues (graceful degradation)
    // If Firebase is initialized but credentials are invalid due to time sync,
    // we'll catch it in the try-catch below and return gracefully

    // Log Firebase app details
    if (admin.apps.length > 0) {
      const app = admin.apps[0];
      console.log(`Firebase app name: ${app.name}`);
      console.log(`Firebase app options:`, JSON.stringify({
        projectId: app.options?.projectId,
        credential: app.options?.credential ? 'Present' : 'Missing'
      }, null, 2));
    }

    const user = await User.findOne({ 
      $or: [
        { empId: String(empId) },
        { loginId: String(empId) }
      ]
    });
    
    if (!user) {
      console.error(`❌ User not found for empId: ${empId}`);
      console.log(`🔔 ============================================\n`);
      return { success: false, message: 'User not found' };
    }
    
    console.log(`User found: ${user.name || 'Unknown'} (empId: ${user.empId}, loginId: ${user.loginId})`);
    console.log(`FCM tokens count: ${user.fcmTokens ? user.fcmTokens.length : 0}`);
    
    if (!user.fcmTokens || user.fcmTokens.length === 0) {
      console.error(`⚠️  No FCM token found for user ${empId}`);
      console.log(`🔔 ============================================\n`);
      return { success: false, message: 'No FCM token found' };
    }

    const results = [];
    const failedTokens = [];

    // Send to all devices
    for (let i = 0; i < user.fcmTokens.length; i++) {
      const token = user.fcmTokens[i];
      console.log(`\n📱 Attempting to send to token ${i + 1}/${user.fcmTokens.length}`);
      console.log(`   Token preview: ${token.substring(0, 30)}...${token.substring(token.length - 10)}`);
      
      try {
        const message = {
          ...notification,
          token
        };

        console.log(`   Sending message payload:`, JSON.stringify({
          notification: message.notification,
          data: message.data,
          android: message.android ? 'Present' : 'Missing',
          apns: message.apns ? 'Present' : 'Missing',
          token: `${token.substring(0, 20)}...`
        }, null, 2));

        // Verify Firebase app before sending
        if (admin.apps.length === 0) {
          throw new Error('Firebase Admin SDK not initialized - no apps found');
        }
        
        const app = admin.apps[0];
        console.log(`   Using Firebase app: ${app.name}`);
        console.log(`   App project ID: ${app.options?.projectId || 'N/A'}`);
        
        // Try to send
        console.log(`   Calling admin.messaging().send()...`);
        console.log(`   Current time: ${new Date().toISOString()}`);
        console.log(`   Server time check: ${Date.now()}`);
        
        const startTime = Date.now();
        try {
          const response = await admin.messaging().send(message);
          const duration = Date.now() - startTime;
          console.log(`   ✅ Success! Message ID: ${response} (took ${duration}ms)`);
          results.push({ token, success: true, messageId: response });
        } catch (sendError) {
          // Re-throw to be caught by outer catch
          throw sendError;
        }
      } catch (error) {
        console.error(`   ❌ Error details:`);
        console.error(`      Code: ${error.code || 'N/A'}`);
        console.error(`      Code Prefix: ${error.codePrefix || 'N/A'}`);
        console.error(`      Message: ${error.message}`);
        if (error.errorInfo) {
          console.error(`      Error Info:`, JSON.stringify(error.errorInfo, null, 2));
        }
        if (error.stack) {
          console.error(`      Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
        // Handle credential errors specifically - stop trying if credentials are invalid
        if (error.code === 'app/invalid-credential' || error.codePrefix === 'app' || 
            (error.message && error.message.includes('invalid_grant')) ||
            (error.message && error.message.includes('Invalid JWT'))) {
          console.error(`\n❌ ============================================`);
          console.error(`❌ FIREBASE CREDENTIAL ERROR DETECTED`);
          console.error(`❌ ============================================`);
          console.error(`Error Code: ${error.code || 'N/A'}`);
          console.error(`Error Code Prefix: ${error.codePrefix || 'N/A'}`);
          console.error(`Full Error: ${error.message}`);
          
          // Get service account info for debugging
          try {
            const fs = require('fs');
            const path = require('path');
            const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
            if (fs.existsSync(serviceAccountPath)) {
              const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
              console.error(`\nService Account Info:`);
              console.error(`   Project ID: ${serviceAccount.project_id}`);
              console.error(`   Client Email: ${serviceAccount.client_email}`);
              console.error(`   Private Key Length: ${serviceAccount.private_key ? serviceAccount.private_key.length : 0} chars`);
              console.error(`   Key starts with: ${serviceAccount.private_key ? serviceAccount.private_key.substring(0, 30) : 'N/A'}`);
            }
          } catch (e) {
            console.error(`   Could not read service account file: ${e.message}`);
          }
          
          const systemTime = new Date();
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const expectedTime = Date.now();
          const timeSkew = Math.abs(systemTime.getTime() - expectedTime);
          const timeSkewMinutes = Math.round(timeSkew / 60000);
          const maxAllowedSkew = 5 * 60 * 1000; // 5 minutes
          
          const serverHour = systemTime.getUTCHours();
          const serverMinute = systemTime.getUTCMinutes();
          const expectedHour = new Date(expectedTime).getUTCHours();
          const expectedMinute = new Date(expectedTime).getUTCMinutes();
          
          console.error(`\nServer Time Check:`);
          console.error(`   Server UTC: ${systemTime.toISOString()}`);
          console.error(`   Server Time: ${serverHour}:${serverMinute.toString().padStart(2, '0')} UTC`);
          console.error(`   Expected UTC: ${new Date(expectedTime).toISOString()}`);
          console.error(`   Expected Time: ${expectedHour}:${expectedMinute.toString().padStart(2, '0')} UTC`);
          console.error(`   Clock Skew: ${Math.round(timeSkew / 1000)} seconds (${timeSkewMinutes} minutes)`);
          console.error(`   Year: ${systemTime.getFullYear()}`);
          console.error(`   Timezone: ${timezone}`);
          
          // Check if clock skew is the main issue
          if (timeSkew > maxAllowedSkew) {
            console.error(`\n❌ CRITICAL ISSUE DETECTED: Server time is off by ${timeSkewMinutes} minutes!`);
            console.error(`   Server shows: ${serverHour}:${serverMinute.toString().padStart(2, '0')} UTC`);
            console.error(`   Expected: ${expectedHour}:${expectedMinute.toString().padStart(2, '0')} UTC`);
            console.error(`   This is DEFINITELY causing the "Invalid JWT Signature" error.`);
            console.error(`   Firebase JWT tokens require accurate system time (within ~5 minutes).`);
            console.error(`\n   🔧 IMMEDIATE FIX REQUIRED ON RENDER:`);
            console.error(`   1. Render Dashboard → Your Service → Environment`);
            console.error(`   2. Add/Set: TZ=UTC`);
            console.error(`   3. Manual Deploy → Clear cache & deploy`);
            console.error(`   4. If time still wrong, contact Render support about NTP sync`);
            console.error(`\n   After fixing time, restart the backend server.`);
            console.error(`   The service account key is likely fine - the time sync issue is the problem.`);
          } else if (Math.abs(serverHour - expectedHour) > 0 || Math.abs(serverMinute - expectedMinute) > 5) {
            console.error(`\n⚠️  WARNING: Server time may be incorrect!`);
            console.error(`   Server shows: ${serverHour}:${serverMinute.toString().padStart(2, '0')} UTC`);
            console.error(`   Expected: ${expectedHour}:${expectedMinute.toString().padStart(2, '0')} UTC`);
            console.error(`   If actual current time doesn't match server time, Firebase JWT will fail.`);
            console.error(`\n   🔧 FIX: Set TZ=UTC in Render and redeploy.`);
          } else {
            console.error(`\nDiagnosis:`);
            console.error(`   Since Firebase Console testing works, your FCM tokens are valid.`);
            console.error(`   The issue is likely with the backend service account key or clock synchronization.`);
            console.error(`   "Invalid JWT Signature" usually means:`);
            console.error(`   1. Server time has clock skew (check above - should be < 5 minutes)`);
            console.error(`   2. Service account key was revoked in Google Cloud Console`);
            console.error(`   3. Service account key is corrupted or incomplete`);
            console.error(`   4. Private key format is wrong (should start with "-----BEGIN PRIVATE KEY-----")`);
            console.error(`   5. Timezone mismatch (server should use UTC)`);
            
            console.error(`\nSolution:`);
            console.error(`   1. FIRST: Ensure server time is synced (clock skew < 5 minutes)`);
            console.error(`   2. Set server timezone to UTC if not already`);
            console.error(`   3. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=wisdom-7c115`);
            console.error(`   4. Find: firebase-adminsdk-fbsvc@wisdom-7c115.iam.gserviceaccount.com`);
            console.error(`   5. Click on it → "Keys" tab`);
            console.error(`   6. Check if the key exists and is active`);
            console.error(`   7. If revoked/missing: Generate new key from Firebase Console`);
            console.error(`   8. Replace chat-backend/firebase-service-account.json`);
            console.error(`   9. Restart backend server`);
          }
          console.error(`❌ ============================================\n`);
          // Don't try other tokens if credential is invalid
          return { 
            success: false, 
            error: 'Invalid Firebase credentials. Please regenerate service account key.',
            credentialError: true,
            message: 'Firebase credentials are invalid. Please regenerate the service account key from Firebase Console.'
          };
        }
        
        console.error(`   ⚠️  Token error (will try next token if available)`);
        failedTokens.push(token);
        
        // If token is invalid, remove it
        if (error.code === 'messaging/invalid-registration-token' || 
            error.code === 'messaging/registration-token-not-registered') {
          console.log(`   Removing invalid token from database`);
          await user.removeFCMToken(token);
        }
      }
    }

    console.log(`\n📊 FCM Notification Summary:`);
    console.log(`   Total tokens: ${user.fcmTokens.length}`);
    console.log(`   Successful: ${results.length}`);
    console.log(`   Failed: ${failedTokens.length}`);
    console.log(`🔔 ============================================\n`);

    return {
      success: results.length > 0,
      sent: results.length,
      failed: failedTokens.length,
      results
    };
  } catch (error) {
    console.error(`\n❌ ============================================`);
    console.error(`❌ FCM NOTIFICATION ERROR (Top Level)`);
    console.error(`❌ ============================================`);
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error(`❌ ============================================\n`);
    return { success: false, error: error.message };
  }
};

// Send message notification
const sendMessageNotification = async (message, room) => {
  try {
    const recipientEmpId = message.senderId === room.hrEmpId 
      ? room.lineWorkerEmpId 
      : room.hrEmpId;

    const recipient = await User.findOne({ empId: recipientEmpId });
    const sender = await User.findOne({ empId: message.senderId });

    if (!recipient || !sender) {
      return { success: false, message: 'User not found' };
    }

    // Only send notification if recipient is offline
    if (recipient.isOnline) {
      return { success: false, message: 'User is online, notification not needed' };
    }

    // Truncate message text for notification
    const notificationText = message.text.length > 100 
      ? message.text.substring(0, 100) + '...' 
      : message.text;

    const notification = {
      notification: {
        title: sender.name,
        body: notificationText
      },
      data: {
        type: 'new_message',
        roomId: room._id.toString(),
        senderId: message.senderId,
        messageId: message._id.toString(),
        senderName: sender.name
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'chat_messages'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: room.unreadCount.hr + room.unreadCount.lineWorker
          }
        }
      }
    };

    return await sendNotification(recipientEmpId, notification);
  } catch (error) {
    console.error('Error in sendMessageNotification:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendNotification,
  sendMessageNotification
};


