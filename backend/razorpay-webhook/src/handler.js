const { connectDatabase } = require("./config/database");
const { PaymentTransaction } = require("./models");
const { settleTransaction } = require("./services/paymentSettlementService");
const { jsonResponse, verifyWebhookSignature } = require("./utils/http");

exports.handler = async (event) => {
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";
  const signature = verifyWebhookSignature(rawBody, event.headers);
  if (signature.missingSecret) return jsonResponse(503, { error: "Webhook secret not configured" });
  if (!signature.valid) return jsonResponse(401, { error: "Invalid signature" });

  try {
    const payload = JSON.parse(rawBody);
    const payment = payload.payload?.payment?.entity;
    const orderId = payment?.order_id;
    if (!orderId) return jsonResponse(200, { ignored: true });

    await connectDatabase();
    const transaction = await PaymentTransaction.findOne({ razorpay_order_id: orderId });
    if (!transaction) return jsonResponse(200, { ignored: true });

    if (payload.event === "payment.failed") {
      if (transaction.payment_status !== "SUCCESS") {
        await PaymentTransaction.updateOne(
          { _id: transaction._id },
          { $set: { payment_status: "FAILED", webhook_payload: payload, razorpay_payment_id: payment.id } },
        );
      }
      return jsonResponse(200, { received: true });
    }

    if (["payment.captured", "order.paid"].includes(payload.event)
      && transaction.payment_status !== "SUCCESS") {
      await settleTransaction(transaction, payload);
    }
    return jsonResponse(200, { received: true });
  } catch (error) {
    console.error("Razorpay webhook failure", error);
    return jsonResponse(500, { error: "Webhook processing failed" });
  }
};
