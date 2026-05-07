const twilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const sendSMS = async (to, body) => {
  if (!twilio || !process.env.TWILIO_PHONE_NUMBER || !to) return;
  // normalize Rwanda numbers: 07XXXXXXXX → +2507XXXXXXXX
  const normalized = to.startsWith('+') ? to : `+250${to.replace(/^0/, '')}`;
  try {
    await twilio.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to: normalized, body });
  } catch (err) {
    console.error('[SMS]', err.message);
  }
};

module.exports = { sendSMS };
