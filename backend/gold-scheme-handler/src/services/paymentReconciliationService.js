const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const PaymentTransaction = require("../models/PaymentTransaction");

const WEBHOOK_URL = process.env.PAYMENT_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

async function deliverCapturedPayment(payment) {
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) throw new Error("Payment reconciliation is not configured");
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: payment } } });
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-signature": signature },
    body,
  });
  if (!response.ok) throw new Error(`Webhook reconciliation failed with ${response.status}`);
}

async function reconcileCreatedTransactions(filter = {}, limit = 10) {
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) return { checked: 0, settled: 0, failed: 0 };
  const cutoff = new Date(Date.now() - 5_000);
  const transactions = await PaymentTransaction.find({
    ...filter,
    payment_status: "CREATED",
    razorpay_order_id: { $exists: true, $ne: "" },
    createdAt: { $lte: cutoff },
  }).sort({ createdAt: 1 }).limit(limit);
  let settled = 0;
  let failed = 0;

  for (const transaction of transactions) {
    try {
      const payments = await razorpay.orders.fetchPayments(transaction.razorpay_order_id);
      const captured = payments?.items?.find((payment) => payment.captured || payment.status === "captured");
      if (captured) {
        await deliverCapturedPayment(captured);
        settled += 1;
      } else if (Date.now() - new Date(transaction.createdAt).getTime() > 30 * 60 * 1000) {
        await PaymentTransaction.updateOne(
          { _id: transaction._id, payment_status: "CREATED" },
          { $set: { payment_status: "ABANDONED" } },
        );
      } else {
        await PaymentTransaction.updateOne(
          { _id: transaction._id, payment_status: "CREATED" },
          { $set: { reconciliation_checked_at: new Date() }, $unset: { reconciliation_error: "" } },
        );
      }
    } catch (error) {
      failed += 1;
      await PaymentTransaction.updateOne(
        { _id: transaction._id, payment_status: "CREATED" },
        { $set: { reconciliation_error: error.message, reconciliation_checked_at: new Date() } },
      ).catch(() => undefined);
      console.error("Payment reconciliation failed", transaction.razorpay_order_id, error.message);
    }
  }
  return { checked: transactions.length, settled, failed };
}

module.exports = { reconcileCreatedTransactions };
