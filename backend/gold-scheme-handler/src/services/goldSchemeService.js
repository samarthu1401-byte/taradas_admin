const GoldScheme = require("../models/GoldScheme");
const CustomerGoldScheme = require("../models/CustomerGoldScheme");
const Installment = require("../models/Installment");
const GoldRate = require("../models/GoldRate");
const { generateInstallments } = require("../utils/scheduleUtils");
const razorpay = require("../config/razorpay");
const PaymentTransaction = require("../models/PaymentTransaction");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const S3_BUCKET = "taradasscheme123";
const S3_REGION = "ap-south-1";
const s3Client = new S3Client({ region: S3_REGION });

function indiaDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function assertNoInstallmentPaidToday(customerSchemeId, session = null) {
  // Allow customers to pay installments at any time or multiple installments per day
  return;
}

async function createScheme(input) {
  return GoldScheme.create(input);
}

async function updateScheme(input) {
  const { id, ...changes } = input;
  const scheme = await GoldScheme.findByIdAndUpdate(id, changes, { new: true, runValidators: true });
  if (!scheme) throw new Error("Scheme not found");
  return scheme;
}

async function deactivateScheme(id) {
  const scheme = await GoldScheme.findByIdAndUpdate(id, { is_active: false }, { new: true });
  if (!scheme) throw new Error("Scheme not found");
  return scheme;
}

async function enrollScheme(input) {
  const schemeDefinition = await GoldScheme.findOne({ _id: input.scheme_id, is_active: true });
  if (!schemeDefinition) throw new Error("Scheme is not available");
  const goldCarat = input.gold_carat || schemeDefinition.gold_carat || "24K";
  const now = new Date();
  let maturityDate = new Date(now);

  if (schemeDefinition.scheme_type === "MONTHLY") {
    maturityDate.setMonth(maturityDate.getMonth() + schemeDefinition.total_installments);
  }

  if (schemeDefinition.scheme_type === "WEEKLY") {
    maturityDate.setDate(maturityDate.getDate() + schemeDefinition.total_installments * 7);
  }

  if (schemeDefinition.scheme_type === "DAILY") {
    maturityDate.setDate(maturityDate.getDate() + schemeDefinition.total_installments);
  }

  const customerScheme = await CustomerGoldScheme.create({
    customer_id: input.customer_id,
    scheme_id: input.scheme_id,
    scheme_type: schemeDefinition.scheme_type,
    gold_carat: goldCarat,
    installment_amount: schemeDefinition.installment_amount,
    total_installments: schemeDefinition.total_installments,
    enrolled_date: now,
    maturity_date: maturityDate,
  });

  const schedules = generateInstallments(
    schemeDefinition.scheme_type,
    schemeDefinition.total_installments,
    now,
  );

  const docs = schedules.map((x) => ({
    customer_scheme_id: customerScheme._id,
    installment_number: x.installment_number,
    due_date: x.due_date,
    status: "PENDING",
  }));

  await Installment.insertMany(docs);

  return customerScheme;
}

function checkBonusEligibility(scheme) {
  const required = scheme.installment_amount * scheme.total_installments;
  return scheme.total_paid_amount >= required;
}

async function processMaturedSchemes() {
  const today = new Date();

  const schemes = await CustomerGoldScheme.find({
    status: "ACTIVE",
  });

  let processed = 0;

  for (const scheme of schemes) {
    if (today >= scheme.maturity_date) {
      const eligible = checkBonusEligibility(scheme);

      scheme.bonus_eligible = eligible;
      scheme.status = "MATURED";

      await scheme.save();
      processed++;
    }
  }

  return `${processed} schemes matured`;
}

async function redeemScheme(customerSchemeId, customerUserId) {
  const scheme = await CustomerGoldScheme.findOne({ _id: customerSchemeId, customer_id: customerUserId });

  if (!scheme) {
    throw new Error("Scheme not found or access denied");
  }

  if (!["MATURED", "REDEMPTION_PENDING"].includes(scheme.status)) {
    throw new Error("Scheme not matured yet");
  }

  let bonusAmount = 0;

  if (scheme.bonus_eligible) {
    bonusAmount = 1000;
  }

  const totalValue = scheme.total_paid_amount + bonusAmount;

  if (scheme.status !== "REDEMPTION_PENDING") {
    scheme.status = "REDEMPTION_PENDING";
    await scheme.save();
  }

  await assertNoInstallmentPaidToday(customerSchemeId);

  const now = new Date().toISOString();
  await CustomerGoldScheme.db.collection("withdrawalrequests").updateOne(
    { id: `SCHEME-${String(scheme._id)}` },
    {
      $set: { customerId: scheme.customer_id, asset: scheme.gold_carat.toLowerCase(), amount: scheme.total_gold_grams, type: "Scheme redemption", status: "Pending", updatedAt: now, schemeId: String(scheme._id) },
      $setOnInsert: { id: `SCHEME-${String(scheme._id)}`, createdAt: now },
    },
    { upsert: true },
  );

  return {
    customer_paid: scheme.total_paid_amount,
    bonus_amount: bonusAmount,
    total_value: totalValue,
    total_gold_grams: scheme.total_gold_grams,
  };
}

async function createGoldPayment(input, identity) {
  const scheme = await CustomerGoldScheme.findById(input.customerSchemeId);

  if (!scheme) {
    throw new Error("Scheme not found");
  }

  const User = require("../models/User");
  const customerId = identity?.username || identity?.claims?.["cognito:username"] || identity?.claims?.username;
  const customer = customerId && await User.findOne({ customerId: new RegExp(`^${String(customerId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), active: { $ne: false } });
  if (!customer || scheme.customer_id !== customer.userId) throw new Error("Unauthorized");

  if (scheme.status !== "ACTIVE") {
    throw new Error("Scheme inactive");
  }

  const requestedCount = Number(input.installmentsCount || (input.amount / scheme.installment_amount));
  if (!Number.isInteger(requestedCount) || requestedCount < 1) throw new Error("Invalid installment selection");
  if (input.amount !== scheme.installment_amount * requestedCount) throw new Error("Payment amount does not match the selected installments");

  const pendingInstallments = await Installment.find({ customer_scheme_id: String(scheme._id), status: "PENDING" }).sort({ installment_number: 1 });
  if (!pendingInstallments.length) {
    throw new Error("No pending installments available for this plan");
  }
  if (requestedCount > pendingInstallments.length) {
    throw new Error(`Only ${pendingInstallments.length} installment${pendingInstallments.length === 1 ? " is" : "s are"} remaining`);
  }

  const selectedInstallments = pendingInstallments.slice(0, requestedCount);
  const installmentIds = selectedInstallments.map((installment) => String(installment._id));
  const nextInstallment = selectedInstallments[0];
  const installmentId = installmentIds[0];
  const existingTransaction = await PaymentTransaction.findOne({ installment_id: installmentId });
  if (existingTransaction && existingTransaction.payment_status !== "SUCCESS") {
    if (existingTransaction.amount !== input.amount || Number(existingTransaction.installments_covered || 1) !== requestedCount) {
      throw new Error("An existing checkout is active for the oldest due installment. Complete or retry it first.");
    }
    return {
      orderId: existingTransaction.razorpay_order_id,
      amount: existingTransaction.amount,
      currency: "INR",
      installmentsCovered: Number(existingTransaction.installments_covered || 1),
      key: process.env.RAZORPAY_KEY_ID,
    };
  }

  const order = await razorpay.orders.create({
    amount: input.amount * 100, // paise
    currency: "INR",
    receipt: `gold_${Date.now()}`,
  });

  try {
    await PaymentTransaction.create({
      customer_scheme_id: scheme._id,
      customer_id: scheme.customer_id,
      installment_id: installmentId,
      installment_ids: installmentIds,
      installment_number: nextInstallment.installment_number,
      razorpay_order_id: order.id,
      amount: input.amount,
      payment_status: "CREATED",
      installments_covered: requestedCount,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const winner = await PaymentTransaction.findOne({ installment_id: installmentId });
    if (!winner) throw error;
    return {
      orderId: winner.razorpay_order_id,
      amount: winner.amount,
      currency: "INR",
      installmentsCovered: Number(winner.installments_covered || 1),
      key: process.env.RAZORPAY_KEY_ID,
    };
  }

  return {
    orderId: order.id,
    amount: input.amount,
    currency: "INR",
    installmentsCovered: requestedCount,
    key: process.env.RAZORPAY_KEY_ID,
  };
}

async function updateWithdrawalStatus(id, status) {
  if (!["Approved", "Rejected"].includes(status)) throw new Error("Invalid withdrawal status");
  const collection = CustomerGoldScheme.db.collection("withdrawalrequests");
  const request = await collection.findOne({ id });
  if (!request) throw new Error("Withdrawal request not found");
  if (request.status !== "Pending") return request;

  const schemeStatus = status === "Approved" ? "REDEEMED" : "MATURED";
  const scheme = await CustomerGoldScheme.findOneAndUpdate(
    { _id: request.schemeId, customer_id: request.customerId, status: "REDEMPTION_PENDING" },
    { $set: { status: schemeStatus } },
    { new: true },
  );
  if (!scheme) throw new Error("Scheme redemption state is invalid");

  await collection.updateOne(
    { id, status: "Pending" },
    { $set: { status, updatedAt: new Date().toISOString() } },
  );
  return collection.findOne({ id });
}

async function collectCashInstallment(customerSchemeId, paymentDate = null) {
  const scheme = await CustomerGoldScheme.findById(customerSchemeId);
  if (!scheme) throw new Error("Scheme not found");
  if (scheme.status !== "ACTIVE") throw new Error("Scheme is not active");

  const now = paymentDate ? new Date(paymentDate) : new Date();

  if (!paymentDate) {
    await assertNoInstallmentPaidToday(scheme._id);
  }

  const installment = await Installment.findOne({ customer_scheme_id: customerSchemeId, status: "PENDING" }).sort({ installment_number: 1 });
  if (!installment) throw new Error("No pending installment available");
  if (!paymentDate && indiaDateKey(installment.due_date) > indiaDateKey()) throw new Error(`Next installment is due on ${indiaDateKey(installment.due_date)}`);

  const onlineAttempt = await PaymentTransaction.findOne({
    installment_id: String(installment._id),
    razorpay_order_id: { $not: /^CASH-/ },
  });
  if (onlineAttempt) throw new Error("An online payment is already active for this installment");

  let goldRate = await GoldRate.findOne({ date: indiaDateKey(now) });
  if (!goldRate) {
    goldRate = await GoldRate.findOne().sort({ date: -1 });
  }
  let rate = goldRate?.gold24K || 7200;

  const grams = scheme.installment_amount / rate;
  const session = await CustomerGoldScheme.db.startSession();
  let paidInstallment;
  try {
    await session.withTransaction(async () => {
      if (!paymentDate) {
        await assertNoInstallmentPaidToday(scheme._id, session);
      }
      const attemptInTransaction = await PaymentTransaction.findOne({
        installment_id: String(installment._id),
      }).session(session);
      if (attemptInTransaction) throw new Error("A payment is already active for this installment");

      paidInstallment = await Installment.findOneAndUpdate(
        { _id: installment._id, status: "PENDING" },
        { $set: { status: "PAID", amount_paid: scheme.installment_amount, gold_rate: rate, grams_allocated: grams, paid_date: now } },
        { new: true, session },
      );
      if (!paidInstallment) throw new Error("Installment was settled concurrently");

      const updatedScheme = await CustomerGoldScheme.findOneAndUpdate(
        { _id: scheme._id, status: "ACTIVE", installments_paid: { $lt: scheme.total_installments } },
        { $inc: { installments_paid: 1, total_paid_amount: scheme.installment_amount, total_gold_grams: grams } },
        { new: true, session },
      );
      if (!updatedScheme) throw new Error("Scheme cannot accept another installment");

      // Check for 12th installment completion bonus (₹1,000 converted to 24K gold grams)
      if (updatedScheme.installments_paid >= 12 && !updatedScheme.bonus_applied) {
        const bonusGrams = Number((1000 / rate).toFixed(4));
        updatedScheme.total_gold_grams = Number((updatedScheme.total_gold_grams + bonusGrams).toFixed(4));
        updatedScheme.bonus_gold_grams = Number(((updatedScheme.bonus_gold_grams || 0) + bonusGrams).toFixed(4));
        updatedScheme.bonus_applied = true;
        await updatedScheme.save({ session });

        await PaymentTransaction.create([{
          customer_scheme_id: updatedScheme._id,
          customer_id: updatedScheme.customer_id,
          installment_number: 12,
          razorpay_order_id: `BONUS-1000-${now.getTime()}`,
          amount: 1000,
          payment_status: "SUCCESS",
          gold_rate: rate,
          grams_allocated: bonusGrams,
          description: `₹1,000 Completion Bonus: ${bonusGrams}g 24K Gold Credited to Wallet`,
          createdAt: now.toISOString(),
        }], { session });
      }

      const [cashTransaction] = await PaymentTransaction.create([{
        customer_scheme_id: scheme._id,
        customer_id: scheme.customer_id,
        installment_id: String(installment._id),
        installment_number: installment.installment_number,
        razorpay_order_id: `CASH-${now.getTime()}-${installment.installment_number}`,
        amount: scheme.installment_amount,
        payment_status: "SUCCESS",
        installments_covered: 1,
        gold_rate: rate,
        grams_allocated: grams,
        createdAt: now.toISOString(),
      }], { session });
      paidInstallment.payment_transaction_id = cashTransaction._id;
      await paidInstallment.save({ session });
    });
    return paidInstallment;
  } finally {
    await session.endSession();
  }
}

async function refreshGoldRates() {
  const today = indiaDateKey();
  const existing = await GoldRate.findOne({ date: today });
  if (existing) return existing;

  const [goldResponse, fxResponse] = await Promise.all([
    fetch("https://api.gold-api.com/price/XAU"),
    fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR"),
  ]);
  if (!goldResponse.ok || !fxResponse.ok) throw new Error("Unable to retrieve the daily market rate");
  const gold = await goldResponse.json();
  const fx = await fxResponse.json();
  const usdPerOunce = Number(gold.price);
  const usdInr = Number(fx.rates?.INR);
  if (!usdPerOunce || !usdInr) throw new Error("Invalid market-rate response");
  const raw24K = (usdPerOunce * usdInr) / 31.1034768;
  const INDIAN_DUTY_MULTIPLIER = 1.14591; // Includes Customs Duty, AIDC, GST 3%, and local bank premium
  const gold24K = Number((raw24K * INDIAN_DUTY_MULTIPLIER).toFixed(2));
  const gold22K = Number((gold24K * 22 / 24).toFixed(2));
  const gold18K = Number((gold24K * 18 / 24).toFixed(2));

  return GoldRate.findOneAndUpdate(
    { date: today },
    { date: today, gold24K, gold22K, gold18K, currency: "INR", unit: "gram", authority: "Auto Market Rate (Duty Adjusted)", sourceTimestamp: new Date().toISOString() },
    { upsert: true, new: true },
  );
}

async function setGoldRate(input) {
  const date = input.date || indiaDateKey();
  const gold24K = Number(input.gold24K);
  const gold22K = Number(input.gold22K || (gold24K * 22 / 24).toFixed(2));
  const gold18K = Number(input.gold18K || (gold24K * 18 / 24).toFixed(2));

  return GoldRate.findOneAndUpdate(
    { date },
    {
      date,
      gold24K,
      gold22K,
      gold18K,
      currency: "INR",
      unit: "gram",
      authority: "Admin Showroom Rate",
      sourceTimestamp: new Date().toISOString(),
    },
    { upsert: true, new: true },
  );
}

async function updateMyCustomer(input, identity) {
  const User = require("../models/User");
  const customerId = identity?.username || identity?.claims?.["cognito:username"] || identity?.claims?.username;
  if (!customerId) throw new Error("Unauthorized");
  const allowed = ["name", "address", "city", "pincode", "avatarUrl"];
  const changes = Object.fromEntries(Object.entries(input || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined));
  const customer = await User.findOneAndUpdate(
    { customerId: new RegExp(`^${String(customerId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), active: { $ne: false } },
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!customer) throw new Error("Customer account not found");
  return customer;
}
async function getAvatarUploadUrl(customerId) {
  const targetId = customerId || "default";
  const key = `avatars/${targetId}.jpg`;
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  // Pre-signed URL valid for 10 minutes
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });
  return uploadUrl;
}

module.exports = {
  createScheme,
  updateScheme,
  deactivateScheme,
  enrollScheme,
  checkBonusEligibility,
  processMaturedSchemes,
  redeemScheme,
  createGoldPayment,
  collectCashInstallment,
  refreshGoldRates,
  setGoldRate,
  updateMyCustomer,
  updateWithdrawalStatus,
  getAvatarUploadUrl,
};
