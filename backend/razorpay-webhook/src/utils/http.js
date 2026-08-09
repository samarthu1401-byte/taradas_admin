const crypto = require("crypto");

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const getHeader = (headers, name) => Object.entries(headers || {})
  .find(([key]) => key.toLowerCase() === name)?.[1];

function verifyWebhookSignature(rawBody, headers) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  if (!secret) return { valid: false, missingSecret: true };
  const signature = getHeader(headers, "x-razorpay-signature");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const receivedBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  return {
    valid: receivedBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(receivedBuffer, expectedBuffer),
    missingSecret: false,
  };
}

module.exports = { jsonResponse, verifyWebhookSignature };
