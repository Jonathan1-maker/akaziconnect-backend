require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const Message = require('./models/Message');
const { setIO } = require('./config/socket');

connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    methods: ['GET', 'POST'],
  },
});

app.use(cors({
  origin: [
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/workers', require('./routes/workers'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));

// online users map: userId -> socketId
const onlineUsers = new Map();
setIO(io, onlineUsers);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  onlineUsers.set(userId, socket.id);
  io.emit('online_users', Array.from(onlineUsers.keys()));

  socket.on('send_message', async ({ receiverId, content }) => {
    if (!receiverId || !content?.trim()) return;

    const MESSAGE_LIMIT = 5;

    // count messages in this conversation
    const count = await Message.countDocuments({
      $or: [
        { sender: userId, receiver: receiverId },
        { sender: receiverId, receiver: userId },
      ],
    });

    if (count >= MESSAGE_LIMIT) {
      socket.emit('message_limit_reached', {
        message: `Free plan allows only ${MESSAGE_LIMIT} messages per conversation.`,
      });
      return;
    }

    const message = await Message.create({
      sender: userId,
      receiver: receiverId,
      content: content.trim(),
    });

    const payload = {
      _id: message._id,
      sender: userId,
      receiver: receiverId,
      content: message.content,
      createdAt: message.createdAt,
      read: false,
    };

    socket.emit('receive_message', payload);

    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('receive_message', payload);
    } else {
      // receiver is offline — save a notification so they see it when they come back
      const { notify } = require('./config/notify');
      const User = require('./models/User');
      const sender = await User.findById(userId).select('name');
      const Worker = require('./models/Worker');
      const workerProfile = await Worker.findOne({ user: userId }).select('name');
      const senderName = workerProfile?.name || sender?.name || 'Someone';
      await notify(
        receiverId, 'new_message',
        '💬 New Message',
        `${senderName} sent you a message.`,
        { senderId: userId }
      );
    }

    // notify both sides if they just hit the limit
    if (count + 1 >= MESSAGE_LIMIT) {
      const limitPayload = { message: `You have reached the ${MESSAGE_LIMIT} message limit for this conversation.` };
      socket.emit('message_limit_reached', limitPayload);
      if (receiverSocket) io.to(receiverSocket).emit('message_limit_reached', limitPayload);
    }
  });

  socket.on('typing', ({ receiverId, isTyping }) => {
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('typing', { senderId: userId, isTyping });
    }
  });

  socket.on('mark_read', async ({ senderId }) => {
    await Message.updateMany({ sender: senderId, receiver: userId, read: false }, { read: true });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.emit('online_users', Array.from(onlineUsers.keys()));
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
