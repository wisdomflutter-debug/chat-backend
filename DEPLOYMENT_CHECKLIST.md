# Deployment Checklist

## Pre-Deployment

- [ ] MongoDB Atlas cluster created and configured
- [ ] Database user created with read/write permissions
- [ ] Network access configured (0.0.0.0/0 for testing)
- [ ] Connection string copied and tested
- [ ] Firebase service account key ready (if using notifications)
- [ ] Code committed to GitHub

## Deployment Steps

### Render (Recommended)

- [ ] Sign up at https://render.com
- [ ] Connect GitHub account
- [ ] Create new Web Service
- [ ] Set Root Directory: `chat-backend`
- [ ] Set Build Command: `npm install`
- [ ] Set Start Command: `npm start`
- [ ] Add environment variables:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=10000`
  - [ ] `MONGODB_URI=your_connection_string`
  - [ ] `CORS_ORIGIN=*`
  - [ ] `SEND_NOTIFICATIONS_TO_ONLINE_USERS=true`
  - [ ] (Optional) Upload `firebase-service-account.json`
- [ ] Deploy service
- [ ] Wait for deployment to complete
- [ ] Test health endpoint: `https://your-service.onrender.com/health`
- [ ] Copy service URL

### Railway (Alternative)

- [ ] Sign up at https://railway.app
- [ ] Create new project from GitHub
- [ ] Set Root Directory: `chat-backend`
- [ ] Add environment variables (same as Render)
- [ ] Deploy
- [ ] Test and copy URL

## Post-Deployment

- [ ] Update Flutter app `strings_constant.dart`:
  - [ ] `chatBaseUrl` = `https://your-service.onrender.com/api/chat`
  - [ ] `chatSocketUrl` = `wss://your-service.onrender.com`
- [ ] Test connection from Flutter app
- [ ] Test sending messages
- [ ] Test receiving messages
- [ ] Test socket connection
- [ ] (Optional) Set up cron job to keep service awake

## Testing

- [ ] Health check endpoint works
- [ ] Can connect to MongoDB
- [ ] Socket.io connection works
- [ ] Messages can be sent
- [ ] Messages can be received
- [ ] User sync works
- [ ] Room creation works
- [ ] (If enabled) FCM notifications work

## Monitoring

- [ ] Check Render/Railway logs for errors
- [ ] Monitor MongoDB Atlas for connection issues
- [ ] Test after service wakes from sleep (Render free tier)
- [ ] Monitor service uptime

