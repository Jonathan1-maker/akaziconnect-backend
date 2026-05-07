// shared socket instance — set once in server.js, used by controllers
let _io = null;
let _onlineUsers = new Map();

const setIO = (io, onlineUsers) => { _io = io; _onlineUsers = onlineUsers; };
const getIO = () => _io;
const getOnlineUsers = () => _onlineUsers;

module.exports = { setIO, getIO, getOnlineUsers };
