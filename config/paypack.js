const axios = require('axios');

const PAYPACK_BASE = 'https://api.paypack.rw/api';
const CLIENT_ID = process.env.PAYPACK_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPACK_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = 0;

const getToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const { data } = await axios.post(`${PAYPACK_BASE}/auth/agents/authorize`, {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  cachedToken = data.access;
  tokenExpiry = Date.now() + (data.refresh_ttl || 3600) * 1000 - 60000;
  return cachedToken;
};

// Cash In — request payment from customer phone
const cashIn = async ({ amount, phone, ref }) => {
  const token = await getToken();
  const { data } = await axios.post(`${PAYPACK_BASE}/transactions/cashin`, {
    amount,
    number: phone,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return data;
};

// Check transaction status
const getTransaction = async (ref) => {
  const token = await getToken();
  const { data } = await axios.get(`${PAYPACK_BASE}/transactions/find/${ref}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
};

module.exports = { cashIn, getTransaction };
