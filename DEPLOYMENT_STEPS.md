# 🚀 Deployment Steps - Follow These Now!

## Step 1: Set Up MongoDB Atlas (5 minutes)

1. **Go to MongoDB Atlas**: https://www.mongodb.com/cloud/atlas/register
2. **Sign up** (free account)
3. **Create a Free Cluster**:
   - Click "Build a Database"
   - Choose "M0 FREE" (Free tier)
   - Select a cloud provider and region (closest to you)
   - Click "Create"
   - Wait 3-5 minutes for cluster to be created

4. **Create Database User**:
   - Go to "Database Access" (left sidebar)
   - Click "Add New Database User"
   - Authentication Method: "Password"
   - Username: `chatadmin` (or your choice)
   - Password: Click "Autogenerate Secure Password" → **SAVE THIS PASSWORD!**
   - Database User Privileges: "Read and write to any database"
   - Click "Add User"

5. **Configure Network Access**:
   - Go to "Network Access" (left sidebar)
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"
   - ⚠️ **For testing only** - in production, restrict to specific IPs

6. **Get Connection String**:
   - Go to "Database" → Click "Connect" on your cluster
   - Choose "Connect your application"
   - Driver: "Node.js"
   - Version: "5.5 or later"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `chatdb` (or your choice)
   - Example: `mongodb+srv://chatadmin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/chatdb?retryWrites=true&w=majority`

---

## Step 2: Deploy to Render (5 minutes)

1. **Go to Render**: https://render.com
2. **Sign up** with your GitHub account
3. **Create New Web Service**:
   - Click "New +" button (top right)
   - Select "Web Service"
   - Click "Connect" next to your GitHub account (if not connected)
   - Select the repository that contains your `chat-backend` folder

4. **Configure Service**:
   - **Name**: `hr-chat-backend` (or any name you like)
   - **Root Directory**: `chat-backend` ⚠️ **IMPORTANT!**
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

5. **Add Environment Variables**:
   Click "Environment" tab and add these one by one:
   
   ```
   NODE_ENV=production
   ```
   
   ```
   PORT=10000
   ```
   
   ```
   MONGODB_URI=mongodb+srv://chatadmin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/chatdb?retryWrites=true&w=majority
   ```
   (Replace with your actual MongoDB connection string)
   
   ```
   CORS_ORIGIN=*
   ```
   
   ```
   SEND_NOTIFICATIONS_TO_ONLINE_USERS=true
   ```

6. **Deploy**:
   - Click "Create Web Service"
   - Wait 5-10 minutes for first deployment
   - Watch the logs to see if it builds successfully

7. **Get Your URL**:
   - Once deployed, you'll see a URL like: `https://hr-chat-backend.onrender.com`
   - Copy this URL!

---

## Step 3: Test Your Backend

1. **Test Health Endpoint**:
   Open in browser or run:
   ```bash
   curl https://your-service-name.onrender.com/health
   ```
   
   Should return:
   ```json
   {
     "success": true,
     "message": "Chat API is running",
     "timestamp": "..."
   }
   ```

2. **Check Logs**:
   - In Render dashboard, go to "Logs" tab
   - Look for "MongoDB Connected" message
   - If you see errors, check the logs

---

## Step 4: Update Flutter App

1. **Open**: `lib/constants/strings_constant.dart`

2. **Update URLs**:
   ```dart
   // Replace these lines:
   static const String chatBaseUrl = 'https://your-service-name.onrender.com/api/chat';
   static const String chatSocketUrl = 'wss://your-service-name.onrender.com';
   ```
   
   ⚠️ **Important**: Use `wss://` (secure WebSocket) not `ws://`

3. **Rebuild App**:
   ```bash
   flutter clean
   flutter pub get
   flutter run
   ```

---

## Step 5: Test Everything

1. **Login** to your Flutter app
2. **Try sending a message**
3. **Check if messages are received**
4. **Test socket connection**

---

## ⚠️ Important Notes

### Render Free Tier Limitations:
- **Sleeps after 15 minutes** of inactivity
- **First request after sleep** takes ~30 seconds (cold start)
- **750 hours/month** free (enough for testing)

### Keep Service Awake (Optional):
Use https://cron-job.org to ping your service every 10 minutes:
- URL: `https://your-service-name.onrender.com/health`
- Schedule: Every 10 minutes

### MongoDB Atlas Free Tier:
- **512MB storage** (enough for testing)
- **Shared cluster** (may have performance limits)

---

## 🆘 Troubleshooting

**Service won't start?**
- Check logs in Render dashboard
- Verify MongoDB connection string is correct
- Ensure all environment variables are set

**Socket.io not connecting?**
- Use `wss://` not `ws://` in Flutter app
- Check CORS_ORIGIN is set to `*` (for testing)

**MongoDB connection error?**
- Verify Network Access allows all IPs (0.0.0.0/0)
- Check username/password in connection string
- Ensure cluster is fully created

**"Root Directory" error?**
- Make sure Root Directory is set to `chat-backend` (not just `/`)

---

## ✅ Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Database user created
- [ ] Network access configured (0.0.0.0/0)
- [ ] Connection string copied
- [ ] Render account created
- [ ] Web service created
- [ ] Root Directory set to `chat-backend`
- [ ] All environment variables added
- [ ] Service deployed successfully
- [ ] Health endpoint works
- [ ] Flutter app URLs updated
- [ ] App tested and working

---

## 🎉 You're Done!

Your backend should now be live and accessible from anywhere!

**Next Steps** (Optional):
- Set up cron job to keep service awake
- Monitor logs for any issues
- Consider upgrading to paid tier for production


