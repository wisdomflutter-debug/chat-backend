# Quick Setup Guide

## Step 1: Install Dependencies

```bash
cd chat-backend
npm install
```

## Step 2: Configure Environment

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your configuration:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string_here
JWT_SECRET=your_secure_jwt_secret_here
CORS_ORIGIN=http://localhost:3000,https://app.thewisdom.ai
```

## Step 3: MongoDB Setup

### Option A: Local MongoDB
```env
MONGODB_URI=mongodb://localhost:27017/hr_chat
```

### Option B: MongoDB Atlas (Cloud)
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hr_chat?retryWrites=true&w=majority
```

## Step 4: Firebase Setup (Optional - for FCM notifications)

1. Go to Firebase Console
2. Download service account JSON
3. Place it in `chat-backend/` directory as `firebase-service-account.json`
4. Or update `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`

**Note:** Server will work without Firebase, but FCM notifications won't be available.

## Step 5: Start the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

## Step 6: Verify Installation

1. Check health endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Chat API is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## API Base URL

- **REST API**: `http://localhost:3000/api/chat`
- **Socket.io**: `ws://localhost:3000` (or `wss://` for production)

## Next Steps

1. ✅ Backend is ready
2. ⏳ Share MongoDB connection string when ready
3. ⏳ Test API endpoints
4. ⏳ Integrate with Flutter app

## Testing Endpoints

### 1. Sync User (No auth required for now)
```bash
curl -X POST http://localhost:3000/api/chat/auth/sync-user \
  -H "Content-Type: application/json" \
  -d '{
    "empId": "APV-60",
    "name": "John Doe",
    "role": "hr",
    "rankType": "hr",
    "resortId": 1
  }'
```

### 2. Get Line Workers (Requires auth token)
```bash
curl -X GET "http://localhost:3000/api/chat/users/line-workers?resortId=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Troubleshooting

### MongoDB Connection Error
- Check if MongoDB is running
- Verify connection string in `.env`
- Check network/firewall settings

### Firebase Not Working
- Server will still run without Firebase
- FCM notifications just won't be sent
- Check console for warnings

### Port Already in Use
- Change `PORT` in `.env`
- Or kill the process using port 3000

## File Structure

```
chat-backend/
├── config/          # Database, Firebase configs
├── controllers/     # Request handlers
├── middleware/      # Auth, error handling
├── models/          # MongoDB schemas
├── routes/          # API routes
├── services/        # Socket.io, FCM services
├── server.js        # Main entry point
└── package.json     # Dependencies
```

## Ready for Production?

1. Set `NODE_ENV=production`
2. Use secure `JWT_SECRET`
3. Configure proper `CORS_ORIGIN`
4. Use MongoDB Atlas or secure local DB
5. Set up SSL/HTTPS
6. Configure proper logging
7. Set up monitoring


