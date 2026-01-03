const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true,
    index: true
  },
  senderId: {
    type: String,
    required: true,
    index: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderRole: {
    type: String,
    required: true,
    enum: ['hr', 'line_worker']
  },
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  fileUrl: {
    type: String
  },
  fileName: {
    type: String
  },
  fileSize: {
    type: Number
  },
  readBy: [{
    empId: {
      type: String,
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  deliveredTo: {
    type: [String],
    default: []
  },
  deletedAt: {
    type: Date
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });

// Mark as read
messageSchema.methods.markAsRead = function(empId) {
  const existingRead = this.readBy.find(r => r.empId === empId);
  if (!existingRead) {
    this.readBy.push({
      empId,
      readAt: new Date()
    });
    return this.save();
  }
  return Promise.resolve(this);
};

// Mark as delivered
messageSchema.methods.markAsDelivered = function(empId) {
  if (!this.deliveredTo.includes(empId)) {
    this.deliveredTo.push(empId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Soft delete
messageSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;


