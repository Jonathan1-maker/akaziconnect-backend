const Payment = require('../models/Payment');
const Worker = require('../models/Worker');
const crypto = require('crypto');
const { notify } = require('../config/notify');

const TOTAL_FEE = 500;
const ADMIN_SHARE = 400;
const WORKER_SHARE = 100;
const ADMIN_MTN = '0795222883';
const ADMIN_AIRTEL = '0738979382';
const REGISTRATION_FEE = 2000;

const MTN_USSD = `*182*1*1*${ADMIN_MTN}*${TOTAL_FEE}#`;
const AIRTEL_USSD = `*182*1*2*${ADMIN_AIRTEL}*${TOTAL_FEE}#`;

// check access
const checkAccess = async (req, res) => {
  const { workerId } = req.params;
  const { guestPhone } = req.query;

  const query = { worker: workerId, status: 'completed', workerPaid: true };
  if (req.user) query.payer = req.user._id;
  else if (guestPhone) query.guestPhone = guestPhone;
  else return res.json({ hasAccess: false });

  const payment = await Payment.findOne(query);
  res.json({ hasAccess: !!payment });
};

// initiate payment — creates a pending payment and returns USSD codes
const initiatePayment = async (req, res) => {
  const { workerId, guestPhone, provider } = req.body;
  if (!workerId) return res.status(400).json({ message: 'Worker ID required' });
  if (!req.user && !guestPhone) return res.status(400).json({ message: 'Phone number required' });

  const worker = await Worker.findById(workerId);
  if (!worker || !worker.isApproved) return res.status(404).json({ message: 'Worker not found' });

  // check if already paid
  const existingQuery = { worker: workerId, status: 'completed', workerPaid: true };
  if (req.user) existingQuery.payer = req.user._id;
  else existingQuery.guestPhone = guestPhone;
  const existing = await Payment.findOne(existingQuery);
  if (existing) return res.status(400).json({ message: 'Already unlocked', hasAccess: true });

  // remove old pending
  const pendingQuery = { worker: workerId, status: 'pending' };
  if (req.user) pendingQuery.payer = req.user._id;
  else pendingQuery.guestPhone = guestPhone;
  await Payment.deleteOne(pendingQuery);

  const reference = `AKZ-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

  const paymentData = {
    worker: workerId,
    amount: TOTAL_FEE,
    adminShare: ADMIN_SHARE,
    workerShare: WORKER_SHARE,
    method: provider === 'airtel' ? 'airtel' : 'momo',
    reference,
    status: 'pending',
  };

  if (req.user) paymentData.payer = req.user._id;
  else paymentData.guestPhone = guestPhone;

  const payment = await Payment.create(paymentData);

  res.status(201).json({
    paymentId: payment._id,
    reference,
    amount: TOTAL_FEE,
    currency: 'RWF',
    mtnUssd: MTN_USSD,
    airtelUssd: AIRTEL_USSD,
    adminMtn: ADMIN_MTN,
    adminAirtel: ADMIN_AIRTEL,
    status: 'pending',
  });
};

// user confirms they paid — sets status to awaiting_admin
const confirmPayment = async (req, res) => {
  const { paymentId } = req.params;
  const { guestPhone, provider } = req.body;

  const query = { _id: paymentId };
  if (req.user) query.payer = req.user._id;
  else if (guestPhone) query.guestPhone = guestPhone;
  else return res.status(400).json({ message: 'Phone number required' });

  const payment = await Payment.findOne(query);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (payment.status === 'completed') return res.json({ message: 'Already confirmed', hasAccess: true });

  payment.status = 'awaiting_admin';
  if (provider) payment.method = provider === 'airtel' ? 'airtel' : 'momo';
  await payment.save();

  // notify admins
  const User = require('../models/User');
  const admins = await User.find({ role: 'admin' }).select('_id');
  const worker = await Worker.findById(payment.worker).select('name');
  await Promise.all(admins.map((a) => notify(
    a._id, 'payment_submitted',
    '💳 Payment Submitted',
    `Someone paid to unlock ${worker?.name || 'a worker'} contact. Ref: ${payment.reference}. Please verify and approve.`,
    { paymentId: payment._id }
  )));

  res.json({ message: 'Payment submitted. Contact will be unlocked after admin approval.' });
};

// check payment status
const getPaymentStatus = async (req, res) => {
  const { paymentId } = req.params;
  const { guestPhone } = req.query;

  const query = { _id: paymentId };
  if (req.user) query.payer = req.user._id;
  else if (guestPhone) query.guestPhone = guestPhone;
  else return res.status(400).json({ message: 'Phone required' });

  const payment = await Payment.findOne(query).select('status workerPaid');
  if (!payment) return res.status(404).json({ message: 'Not found' });

  res.json({ confirmed: payment.status === 'completed' && payment.workerPaid });
};

// admin approves payment — unlocks contact
const approvePayment = async (req, res) => {
  const payment = await Payment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (payment.status === 'completed') return res.status(400).json({ message: 'Already approved' });

  payment.status = 'completed';
  payment.workerPaid = true;
  await payment.save();

  // notify payer via socket
  const { getIO } = require('../config/socket');
  const io = getIO();
  if (io) io.emit(`payment_confirmed_${payment._id}`, { hasAccess: true });

  // notify worker
  const worker = await Worker.findById(payment.worker).select('user name');
  if (worker?.user) {
    await notify(worker.user, 'contact_unlocked', '🔓 Contact Unlocked',
      `Someone unlocked your contact. You earned ${payment.workerShare} RWF.`,
      { paymentId: payment._id }
    );
  }

  res.json({ message: 'Payment approved. Contact unlocked.' });
};

const approveWorkerPayout = async (req, res) => {
  const payment = await Payment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (payment.workerPaid) return res.status(400).json({ message: 'Already paid out' });

  payment.workerPaid = true;
  await payment.save();

  const worker = await Worker.findById(payment.worker).select('user phone name');
  if (worker?.user) {
    await notify(worker.user, 'payout_approved', '💰 Payout Sent!',
      `${payment.workerShare} RWF has been sent to your phone ${worker.phone}.`,
      { paymentId: payment._id }
    );
  }

  res.json({ message: 'Payout marked as sent.', payment });
};

const getWorkerEarnings = async (req, res) => {
  const worker = await Worker.findOne({ user: req.user._id });
  if (!worker) return res.status(404).json({ message: 'Worker profile not found' });

  const payments = await Payment.find({ worker: worker._id, status: 'completed' })
    .populate('payer', 'name phone')
    .sort({ createdAt: -1 });

  const totalUnlocks = payments.length;
  const totalEarnings = payments.filter((p) => p.workerPaid).reduce((s, p) => s + p.workerShare, 0);
  const pendingEarnings = payments.filter((p) => !p.workerPaid).reduce((s, p) => s + p.workerShare, 0);

  const enriched = payments.map((p) => ({
    ...p.toObject(),
    customerPhone: p.payer?.phone || p.guestPhone || 'Unknown',
    customerName: p.payer?.name || 'Guest',
  }));

  res.json({ payments: enriched, totalUnlocks, totalEarnings, pendingEarnings });
};

const getAllPayments = async (req, res) => {
  const payments = await Payment.find()
    .populate('payer', 'name phone')
    .populate({ path: 'worker', select: 'name', populate: { path: 'user', select: 'name phone' } })
    .sort({ createdAt: -1 });

  const enriched = payments.map((p) => ({
    ...p.toObject(),
    customerPhone: p.payer?.phone || p.guestPhone || 'Unknown',
    customerName: p.payer?.name || 'Guest',
  }));

  const totalRevenue = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + p.adminShare, 0);
  const pendingApprovals = payments.filter((p) => p.status === 'awaiting_admin').length;

  res.json({ payments: enriched, totalRevenue, pendingApprovals });
};

const initiateRegistrationFee = async (req, res) => {
  const worker = await Worker.findOne({ user: req.user._id });
  if (!worker) return res.status(404).json({ message: 'Worker profile not found' });
  if (worker.registrationFeePaid) return res.status(400).json({ message: 'Registration fee already paid' });

  const reference = `REG-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  worker.registrationFeeReference = reference;
  await worker.save();

  res.json({
    reference,
    amount: REGISTRATION_FEE,
    currency: 'RWF',
    mtnUssd: `*182*1*1*${ADMIN_MTN}*${REGISTRATION_FEE}#`,
    airtelUssd: `*182*1*2*${ADMIN_AIRTEL}*${REGISTRATION_FEE}#`,
    adminMtn: ADMIN_MTN,
    adminAirtel: ADMIN_AIRTEL,
  });
};

const confirmRegistrationFee = async (req, res) => {
  const worker = await Worker.findOne({ user: req.user._id });
  if (!worker) return res.status(404).json({ message: 'Worker profile not found' });
  if (worker.registrationFeePaid) return res.status(400).json({ message: 'Already paid' });

  worker.registrationFeePaid = true;
  await worker.save();

  const User = require('../models/User');
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all(admins.map((a) => notify(
    a._id, 'registration_fee_submitted',
    '💳 Worker Registration Fee Submitted',
    `${worker.name} submitted a ${REGISTRATION_FEE} RWF registration fee. Ref: ${worker.registrationFeeReference}. Please verify and approve.`,
    { workerId: worker._id }
  )));

  res.json({ message: 'Payment submitted. Your profile will be reviewed and activated shortly.' });
};

module.exports = {
  checkAccess, initiatePayment, confirmPayment, getPaymentStatus,
  approvePayment, approveWorkerPayout, getWorkerEarnings, getAllPayments,
  initiateRegistrationFee, confirmRegistrationFee,
};
