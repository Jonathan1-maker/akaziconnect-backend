const Payment = require('../models/Payment');
const Worker = require('../models/Worker');
const crypto = require('crypto');
const { notify } = require('../config/notify');
const { cashIn, getTransaction } = require('../config/paypack');

const TOTAL_FEE = 500;
const ADMIN_SHARE = 400;
const WORKER_SHARE = 100;
const ADMIN_MOMO = '0795222883';
const REGISTRATION_FEE = 2000;

// check access by guest phone or logged-in user
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

// initiate payment — works for guests (phone only) and logged-in users
const initiatePayment = async (req, res) => {
  const { workerId, guestPhone, momoPhone } = req.body;
  if (!workerId) return res.status(400).json({ message: 'Worker ID required' });
  if (!req.user && !guestPhone) return res.status(400).json({ message: 'Phone number required' });

  const worker = await Worker.findById(workerId);
  if (!worker || !worker.isApproved) return res.status(404).json({ message: 'Worker not found' });

  // check if already paid
  const existingQuery = { worker: workerId, status: 'completed' };
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
    method: 'momo',
    reference,
    status: 'pending',
  };

  if (req.user) paymentData.payer = req.user._id;
  else paymentData.guestPhone = guestPhone;

  const payment = await Payment.create(paymentData);

  // Try PayPack MoMo push payment
  const payPhone = momoPhone || guestPhone || null;
  let momoResult = null;
  let momoError = null;

  if (payPhone && process.env.PAYPACK_CLIENT_ID) {
    try {
      momoResult = await cashIn({ amount: TOTAL_FEE, phone: payPhone, ref: reference });
      // save paypack transaction ref
      payment.paypackRef = momoResult?.ref || momoResult?.transaction_id || null;
      await payment.save();
    } catch (err) {
      momoError = err.response?.data?.message || err.message;
    }
  }

  const ussdCode = `*182*1*1*${ADMIN_MOMO}*${TOTAL_FEE}#`;

  res.status(201).json({
    paymentId: payment._id,
    reference,
    amount: TOTAL_FEE,
    adminShare: ADMIN_SHARE,
    workerShare: WORKER_SHARE,
    currency: 'RWF',
    ussdCode,
    adminMomo: ADMIN_MOMO,
    status: 'pending',
    momoRequested: !!momoResult,
    momoError,
    message: momoResult
      ? `A payment request of ${TOTAL_FEE} RWF has been sent to ${payPhone}. Check your phone and approve.`
      : `Please pay ${TOTAL_FEE} RWF via MoMo using the USSD code below.`,
  });
};

// confirm payment — guest uses reference, logged-in uses paymentId
const confirmPayment = async (req, res) => {
  const { paymentId } = req.params;
  const { guestPhone } = req.body;

  const query = { _id: paymentId };
  if (req.user) query.payer = req.user._id;
  else if (guestPhone) query.guestPhone = guestPhone;
  else return res.status(400).json({ message: 'Phone number required' });

  const payment = await Payment.findOne(query);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (payment.status === 'completed') return res.json({ message: 'Already confirmed', hasAccess: true });

  payment.status = 'completed';
  await payment.save();

  res.json({ message: 'Payment submitted. Contact will be unlocked after admin review.', hasAccess: false });
};

const approveWorkerPayout = async (req, res) => {
  const payment = await Payment.findById(req.params.paymentId);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (payment.status !== 'completed') return res.status(400).json({ message: 'Payment not completed yet' });

  payment.workerPaid = true;
  await payment.save();

  // notify worker their payout was approved
  await notify(
    payment.worker?.user || (await Worker.findById(payment.worker).select('user'))?.user,
    'payout_approved',
    '💰 Payout Approved!',
    `Admin has approved your payout of ${payment.workerShare} RWF. Check your earnings.`,
    { paymentId: payment._id }
  );

  res.json({ message: `Worker payout of ${payment.workerShare} RWF approved`, payment });
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

  // attach display phone (registered or guest)
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
  const pendingPayouts = payments.filter((p) => p.status === 'completed' && !p.workerPaid).length;

  res.json({ payments: enriched, totalRevenue, pendingPayouts });
};

// worker initiates 2000 RWF registration fee payment
const initiateRegistrationFee = async (req, res) => {
  const worker = await Worker.findOne({ user: req.user._id });
  if (!worker) return res.status(404).json({ message: 'Worker profile not found' });
  if (worker.registrationFeePaid) return res.status(400).json({ message: 'Registration fee already paid' });

  const reference = `REG-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const ussdCode = `*182*1*1*${ADMIN_MOMO}*${REGISTRATION_FEE}#`;

  // save reference on worker for admin to verify
  worker.registrationFeeReference = reference;
  await worker.save();

  res.json({
    reference,
    amount: REGISTRATION_FEE,
    currency: 'RWF',
    ussdCode,
    adminMomo: ADMIN_MOMO,
  });
};

// worker confirms they have paid — admin will verify and approve
const confirmRegistrationFee = async (req, res) => {
  const worker = await Worker.findOne({ user: req.user._id });
  if (!worker) return res.status(404).json({ message: 'Worker profile not found' });
  if (worker.registrationFeePaid) return res.status(400).json({ message: 'Already paid' });

  // mark as paid pending admin approval — admin approves worker after verifying MoMo
  worker.registrationFeePaid = true;
  await worker.save();

  // notify admin (super admin user)
  const User = require('../models/User');
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all(admins.map((a) => notify(
    a._id, 'registration_fee_submitted',
    '💳 Worker Registration Fee Submitted',
    `${worker.name} submitted a 2000 RWF registration fee. Ref: ${worker.registrationFeeReference}. Please verify and approve.`,
    { workerId: worker._id }
  )));

  res.json({ message: 'Payment submitted. Your profile will be reviewed and activated shortly.' });
};

module.exports = { checkAccess, initiatePayment, confirmPayment, approveWorkerPayout, getWorkerEarnings, getAllPayments, initiateRegistrationFee, confirmRegistrationFee };
