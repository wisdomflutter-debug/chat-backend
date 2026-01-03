const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  participants: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        // Direct chats must have exactly 2 participants, groups can have any number >= 2
        if (this.type === 'direct') {
          return v.length === 2;
        }
        return v.length >= 2;
      },
      message: 'Direct chat must have exactly 2 participants, group chat must have at least 2 participants'
    }
  },
  name: {
    type: String,
    // Required for group chats, optional for direct chats
    required: function() {
      return this.type === 'group';
    }
  },
  description: {
    type: String
  },
  // DEPRECATED: hrEmpId and lineWorkerEmpId are kept for backward compatibility
  // but should not be used. Use participants array instead.
  hrEmpId: {
    type: String,
    index: true,
    sparse: true
  },
  lineWorkerEmpId: {
    type: String,
    index: true,
    sparse: true
  },
  createdBy: {
    type: String,
    required: true
  },
  lastMessage: {
    text: {
      type: String
    },
    sentBy: {
      type: String
    },
    sentAt: {
      type: Date
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  },
  unreadCount: {
    // Per-user unread counts - key is empId, value is count
    type: Map,
    of: Number,
    default: {}
  },
  archivedBy: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Indexes
chatRoomSchema.index({ createdAt: -1 });
chatRoomSchema.index({ type: 1 });
chatRoomSchema.index({ participants: 1 }); // Index participants array for faster queries
// Compound index for finding rooms between two specific users (for direct chats)
chatRoomSchema.index({ 'participants.0': 1, 'participants.1': 1 }, { sparse: true });

// Update last message
chatRoomSchema.methods.updateLastMessage = function(message) {
  this.lastMessage = {
    text: message.text,
    sentBy: message.senderId,
    sentAt: message.createdAt,
    messageId: message._id
  };
  return this.save();
};

// Increment unread count for a user
chatRoomSchema.methods.incrementUnread = function(empId) {
  const empIdStr = String(empId);
  if (!this.unreadCount) {
    this.unreadCount = new Map();
  }
  const currentCount = this.unreadCount.get(empIdStr) || 0;
  this.unreadCount.set(empIdStr, currentCount + 1);
  return this.save();
};

// Reset unread count for a user
chatRoomSchema.methods.resetUnread = function(empId) {
  const empIdStr = String(empId);
  if (!this.unreadCount) {
    this.unreadCount = new Map();
  }
  this.unreadCount.set(empIdStr, 0);
  return this.save();
};

// Get unread count for a user
chatRoomSchema.methods.getUnreadCount = function(empId) {
  const empIdStr = String(empId);
  if (!this.unreadCount) {
    return 0;
  }
  return this.unreadCount.get(empIdStr) || 0;
};

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = ChatRoom;


