# MongoDB Connection Test

## Connection String Configured ✅

```
mongodb+srv://wisdom:chat@chat.ixyfzgw.mongodb.net/hr_chat?retryWrites=true&w=majority
```

## To Test Connection

1. **Install dependencies** (if not done):
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm run dev
   ```

3. **Expected output**:
   ```
   MongoDB Connected: chat-shard-00-00.ixyfzgw.mongodb.net
   🚀 Chat Server running on port 3000
   📡 Socket.io server ready
   ```

## If Connection Fails

### Common Issues:

1. **Network Access**
   - Go to MongoDB Atlas → Network Access
   - Add your IP address or `0.0.0.0/0` (for development)
   - Wait 1-2 minutes for changes to propagate

2. **Authentication Error**
   - Verify username: `wisdom`
   - Verify password: `chat`
   - Check if user has proper permissions

3. **Connection Timeout**
   - Check internet connection
   - Verify firewall settings
   - Try from different network

## Database Name

The database name is set to: **`hr_chat`**

Collections will be created automatically:
- `users`
- `chatrooms`
- `messages`

## Security Note

⚠️ **Important**: The `.env` file contains credentials. Make sure:
- It's in `.gitignore` (already done)
- Never commit it to version control
- Use environment variables in production
- Rotate credentials regularly

## Next Steps After Connection

1. Test user sync endpoint
2. Create a test chat room
3. Send a test message
4. Verify Socket.io connection


