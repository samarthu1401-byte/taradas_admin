const { CustomerGoldScheme, GoldRate, Installment, PaymentTransaction, ReferralUsage, User } = require("../models");

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

async function ensureGoldRate(date) {
  const existing = await GoldRate.findOne({ date }).lean();
  if (existing) return existing;

  const [goldResponse, fxResponse] = await Promise.all([
    fetch("https://api.gold-api.com/price/XAU"),
    fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR"),
  ]);
  if (!goldResponse.ok || !fxResponse.ok) throw new Error("Unable to retrieve the settlement gold rate");
  const gold = await goldResponse.json();
  const fx = await fxResponse.json();
  const usdPerOunce = Number(gold.price);
  const usdInr = Number(fx.rates?.INR);
  if (!usdPerOunce || !usdInr) throw new Error("Invalid settlement-rate response");
  const raw24K = (usdPerOunce * usdInr) / 31.1034768;
  const INDIAN_DUTY_MULTIPLIER = 1.14591;
  const gold24K = Number((raw24K * INDIAN_DUTY_MULTIPLIER).toFixed(2));
  const gold22K = Number((gold24K * 22 / 24).toFixed(2));
  const gold18K = Number((gold24K * 18 / 24).toFixed(2));

  return GoldRate.findOneAndUpdate(
    { date },
    { date, gold24K, gold22K, gold18K, currency: "INR", unit: "gram", authority: "Auto Market Rate (Duty Adjusted)", sourceTimestamp: new Date().toISOString() },
    { upsert: true, new: true },
  ).lean();
}

async function awardFirstPaymentReferral(customerUserId, paymentTransactionId, session) {
  const successfulPayments = await PaymentTransaction.countDocuments({
    customer_id: customerUserId,
    payment_status: "SUCCESS",
  }).session(session);
  if (successfulPayments !== 1) return;

  const usage = await ReferralUsage.findOneAndUpdate(
    { referred_user_id: customerUserId, status: "PENDING" },
    { $set: { status: "AWARDED", payment_transaction_id: String(paymentTransactionId), awarded_at: new Date() } },
    { new: true, session },
  );
  if (!usage) return;

  await User.updateOne(
    { userId: usage.referrer_user_id, active: { $ne: false } },
    { $inc: { wallet_points: usage.points_awarded || 500 } },
    { session },
  );
}

async function settleTransaction(transaction, payload) {
  const payment = payload.payload?.payment?.entity;
  if (!payment?.id || payment.order_id !== transaction.razorpay_order_id) throw new Error("Payment does not match the stored order");
  if (Number(payment.amount) !== Math.round(Number(transaction.amount) * 100)) throw new Error("Captured amount does not match the installment");

  const today = indiaDateKey();
  const rateDocument = await ensureGoldRate(today);
  const session = await CustomerGoldScheme.db.startSession();

  try {
    await session.withTransaction(async () => {
      const currentTransaction = await PaymentTransaction.findById(transaction._id).session(session);
      if (!currentTransaction || currentTransaction.payment_status === "SUCCESS") return;

      const scheme = await CustomerGoldScheme.findOne({ _id: currentTransaction.customer_scheme_id, status: "ACTIVE" }).session(session);
      if (!scheme) throw new Error("Active scheme not found");
      const installmentIds = currentTransaction.installment_ids?.length
        ? currentTransaction.installment_ids
        : [currentTransaction.installment_id].filter(Boolean);
      const installmentCount = Number(currentTransaction.installments_covered || installmentIds.length || 1);
      if (currentTransaction.amount !== scheme.installment_amount * installmentCount) throw new Error("Payment amount does not match the selected installments");

      let installments = await Installment.find({
        _id: { $in: installmentIds },
        customer_scheme_id: String(scheme._id),
        status: "PENDING",
      }).sort({ installment_number: 1 }).session(session);
      if (installments.length !== installmentCount) {
        const originallySelected = await Installment.find({
          _id: { $in: installmentIds },
          customer_scheme_id: String(scheme._id),
        }).sort({ installment_number: 1 }).session(session);
        const alreadyAppliedToThisTransaction = originallySelected.length === installmentCount
          && originallySelected.every((installment) => installment.status === "PAID"
            && String(installment.payment_transaction_id || "") === String(currentTransaction._id));

        if (alreadyAppliedToThisTransaction) {
          currentTransaction.razorpay_payment_id = payment.id;
          currentTransaction.payment_status = "SUCCESS";
          currentTransaction.webhook_payload = payload;
          await currentTransaction.save({ session });
          return;
        }

        if (!installmentIds.length) {
          const legacyPaidInstallments = await Installment.find({
            customer_scheme_id: String(scheme._id),
            status: "PAID",
            $or: [
              { payment_transaction_id: { $exists: false } },
              { payment_transaction_id: null },
              { payment_transaction_id: "" },
            ],
          }).sort({ installment_number: 1 }).limit(installmentCount).session(session);
          if (legacyPaidInstallments.length === installmentCount
            && currentTransaction.amount === scheme.installment_amount * installmentCount) {
            const legacyIds = legacyPaidInstallments.map((installment) => String(installment._id));
            await Installment.updateMany(
              { _id: { $in: legacyIds } },
              { $set: { payment_transaction_id: currentTransaction._id } },
              { session },
            );
            currentTransaction.installment_id = legacyIds[0];
            currentTransaction.installment_ids = legacyIds;
            currentTransaction.installment_number = legacyPaidInstallments[0].installment_number;
            currentTransaction.installments_covered = installmentCount;
            currentTransaction.gold_rate = legacyPaidInstallments[0].gold_rate;
            currentTransaction.grams_allocated = legacyPaidInstallments.reduce(
              (total, installment) => total + Number(installment.grams_allocated || 0),
              0,
            );
            currentTransaction.razorpay_payment_id = payment.id;
            currentTransaction.payment_status = "SUCCESS";
            currentTransaction.webhook_payload = payload;
            await currentTransaction.save({ session });
            return;
          }
        }

        installments = await Installment.find({
          customer_scheme_id: String(scheme._id),
          status: "PENDING",
        }).sort({ installment_number: 1 }).limit(installmentCount).session(session);
        if (installments.length !== installmentCount) {
          throw new Error("Captured payment requires manual allocation or refund because no pending installment is available");
        }
      }

      const settledInstallmentIds = installments.map((installment) => String(installment._id));

      const caratKey = scheme.gold_carat === "18K" ? "gold18K" : scheme.gold_carat === "22K" ? "gold22K" : "gold24K";
      const rate = rateDocument[caratKey] || rateDocument.gold24K || rateDocument.gold22K || rateDocument.gold18K;
      if (!rate) throw new Error("Gold rate unavailable");
      const gramsPerInstallment = scheme.installment_amount / rate;
      const grams = currentTransaction.amount / rate;
      const paidAt = new Date();
      const installmentUpdate = await Installment.updateMany(
        { _id: { $in: settledInstallmentIds }, status: "PENDING" },
        { $set: { status: "PAID", amount_paid: scheme.installment_amount, gold_rate: rate, grams_allocated: gramsPerInstallment, paid_date: paidAt, payment_transaction_id: currentTransaction._id } },
        { session },
      );
      if (installmentUpdate.modifiedCount !== installmentCount) throw new Error("An installment was settled concurrently");

      const updatedScheme = await CustomerGoldScheme.findOneAndUpdate(
        { _id: scheme._id, status: "ACTIVE", installments_paid: { $lte: scheme.total_installments - installmentCount } },
        { $inc: { installments_paid: installmentCount, total_paid_amount: currentTransaction.amount, total_gold_grams: grams } },
        { new: true, session },
      );
      if (!updatedScheme) throw new Error("Scheme cannot accept another installment");

      // Check for scheme completion bonus (credited upon completing total installments)
      if (updatedScheme.installments_paid >= updatedScheme.total_installments && !updatedScheme.bonus_applied) {
        const bonusGrams = Number((1000 / rate).toFixed(4));
        updatedScheme.total_gold_grams = Number((updatedScheme.total_gold_grams + bonusGrams).toFixed(4));
        updatedScheme.bonus_gold_grams = Number(((updatedScheme.bonus_gold_grams || 0) + bonusGrams).toFixed(4));
        updatedScheme.bonus_applied = true;
        await updatedScheme.save({ session });

        await PaymentTransaction.create([{
          customer_scheme_id: updatedScheme._id,
          customer_id: updatedScheme.customer_id,
          installment_number: 12,
          razorpay_order_id: `BONUS-1000-${Date.now()}`,
          amount: 1000,
          payment_status: "SUCCESS",
          gold_rate: rate,
          grams_allocated: bonusGrams,
          description: `₹1,000 Completion Bonus: ${bonusGrams}g ${updatedScheme.gold_carat || "24K"} Gold Credited to Wallet`,
          createdAt: new Date().toISOString(),
        }], { session });
      }

      currentTransaction.installment_id = String(installments[0]._id);
      currentTransaction.installment_ids = settledInstallmentIds;
      currentTransaction.installment_number = installments[0].installment_number;
      currentTransaction.installments_covered = installmentCount;
      currentTransaction.gold_rate = rate;
      currentTransaction.grams_allocated = grams;
      currentTransaction.razorpay_payment_id = payment.id;
      currentTransaction.payment_status = "SUCCESS";
      currentTransaction.webhook_payload = payload;
      await currentTransaction.save({ session });
      await awardFirstPaymentReferral(scheme.customer_id, currentTransaction._id, session);
    });
  } finally {
    await session.endSession();
  }
}

module.exports = { settleTransaction };
