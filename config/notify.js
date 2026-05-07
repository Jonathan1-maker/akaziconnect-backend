const Notification = require('../models/Notification');
const { getIO, getOnlineUsers } = require('./socket');

const notify = async (userId, type, title, body, meta = {}) => {
  if (!userId) return;
  const notification = await Notification.create({ user: userId, type, title, body, meta });

  const io = getIO();
  const onlineUsers = getOnlineUsers();
  const socketId = onlineUsers.get(String(userId));
  if (io && socketId) {
    io.to(socketId).emit('notification', {
      _id: notification._id,
      type,
      title,
      body,
      meta,
      read: false,
      createdAt: notification.createdAt,
    });
  }
};

module.exports = { notify };
