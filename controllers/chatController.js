const Message = require('../models/Message');
const User = require('../models/User');
const Worker = require('../models/Worker');

const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const me = req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: me, receiver: userId },
        { sender: userId, receiver: me },
      ],
    }).sort({ createdAt: 1 });

    await Message.updateMany({ sender: userId, receiver: me, read: false }, { read: true });

    const MESSAGE_LIMIT = 5;
    const count = messages.length;

    res.json({ messages, count, limit: MESSAGE_LIMIT, limitReached: count >= MESSAGE_LIMIT });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch conversation' });
  }
};

const getConversationList = async (req, res) => {
  try {
    const me = req.user._id;

    const messages = await Message.find({
      $or: [{ sender: me }, { receiver: me }],
    }).sort({ createdAt: -1 });

    const seen = new Set();
    const latest = [];

    for (const msg of messages) {
      const otherId = msg.sender.toString() === me.toString()
        ? msg.receiver.toString()
        : msg.sender.toString();
      if (!seen.has(otherId)) {
        seen.add(otherId);
        latest.push(msg);
      }
    }

    const populated = await Message.populate(latest, [
      { path: 'sender', select: 'name' },
      { path: 'receiver', select: 'name' },
    ]);

    const unreadCounts = await Message.aggregate([
      { $match: { receiver: me, read: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
    ]);

    const unreadMap = {};
    unreadCounts.forEach((u) => { unreadMap[u._id.toString()] = u.count; });

    // build result with worker names where applicable
    const result = await Promise.all(populated.map(async (msg) => {
      const isMe = msg.sender._id.toString() === me.toString();
      const otherId = isMe ? msg.receiver._id.toString() : msg.sender._id.toString();
      const otherUserName = isMe ? msg.receiver.name : msg.sender.name;

      // check if the other person is a worker — use worker name if so
      const workerProfile = await Worker.findOne({ user: otherId }).select('name');
      const displayName = workerProfile?.name || otherUserName;

      return {
        userId: otherId,
        name: displayName,
        lastMessage: msg.content,
        lastTime: msg.createdAt,
        unread: unreadMap[otherId] || 0,
      };
    }));

    res.json(result);
  } catch (err) {
    console.error('getConversationList error:', err.message);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
};

module.exports = { getConversation, getConversationList };
