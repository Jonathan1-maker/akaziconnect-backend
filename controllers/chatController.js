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
    const me = req.user._id.toString();

    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
    }).sort({ createdAt: -1 });

    const seen = new Set();
    const latest = [];

    for (const msg of messages) {
      const otherId = msg.sender.toString() === me
        ? msg.receiver.toString()
        : msg.sender.toString();
      if (!seen.has(otherId)) {
        seen.add(otherId);
        latest.push({ msg, otherId });
      }
    }

    const unreadCounts = await Message.aggregate([
      { $match: { receiver: req.user._id, read: false } },
      { $group: { _id: '$sender', count: { $sum: 1 } } },
    ]);

    const unreadMap = {};
    unreadCounts.forEach((u) => { unreadMap[u._id.toString()] = u.count; });

    const result = await Promise.all(latest.map(async ({ msg, otherId }) => {
      const otherUser = await require('../models/User').findById(otherId).select('name');
      const workerProfile = await Worker.findOne({ user: otherId }).select('name');
      const displayName = workerProfile?.name || otherUser?.name || 'Unknown';

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
