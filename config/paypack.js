const axios = require('axios');

const BASE = 'https://sandbox.momodeveloper.mtn.com/collection';
const SUBSCRIPTION_KEY = process.env.MTN_SUBSCRIPTION_KEY;
const API_USER = process.env.MTN_API_USER;
const API_KEY = process.env.MTN_API_KEY;
const MTN_ENV = process.env.MTN_ENV || 'sandbox';

let cachedToken = null;
let tokenExpiry = 0;

const getToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const credentials = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const { data } = await axios.post(`${BASE}/token/`, null, {
    headers: {
      Authorization: `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
    },
  });
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000;
  return cachedToken;
};

// Cash In — request payment from customer phone
const cashIn = async ({ amount, phone, ref }) => {
  const token = await getToken();
  const { v4: uuidv4 } = require('uuid');
  const referenceId = uuidv4();

  // normalize phone: remove leading 0 and add 250
  const normalized = phone.replace(/^0/, '250');

  await axios.post(`${BASE}/v1_0/requesttopay`, {
    amount: String(amount),
    currency: MTN_ENV === 'sandbox' ? 'EUR' : 'RWF',
    externalId: ref,
    payer: { partyIdType: 'MSISDN', partyId: normalized },
    payerMessage: 'AkaziConnect - Unlock worker contact',
    payeeNote: ref,
  }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Reference-Id': referenceId,
      'X-Target-Environment': MTN_ENV,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      'Content-Type': 'application/json',
    },
  });

  return { ref: referenceId };
};

// Check transaction status
const getTransaction = async (ref) => {
  const token = await getToken();
  const { data } = await axios.get(`${BASE}/v1_0/requesttopay/${ref}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Target-Environment': MTN_ENV,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
    },
  });
  return data;
};

// Cash Out — not available in Collections API, placeholder for compatibility
const cashOut = async ({ amount, phone }) => {
  return null;
};

module.exports = { cashIn, cashOut, getTransaction };
