const mongoose = require("mongoose");

const PaymentTransaction = mongoose.models.PaymentTransaction || mongoose.model("PaymentTransaction", new mongoose.Schema({
  customer_scheme_id: String,
  customer_id: String,
  installment_id: { type: String, unique: true, sparse: true, index: true },
  installment_number: Number,
  installment_ids: [{ type: String }],
  razorpay_order_id: String,
  razorpay_payment_id: String,
  razorpay_signature: String,
  amount: Number,
  payment_status: String,
  installments_covered: Number,
  gold_rate: Number,
  grams_allocated: Number,
  webhook_payload: Object,
}, { timestamps: true }));

const CustomerGoldScheme = mongoose.models.CustomerGoldScheme || mongoose.model("CustomerGoldScheme", new mongoose.Schema({}, { strict: false, collection: "customergoldschemes" }));
const Installment = mongoose.models.Installment || mongoose.model("Installment", new mongoose.Schema({}, { strict: false, collection: "installments" }));
const GoldRate = mongoose.models.GoldRate || mongoose.model("GoldRate", new mongoose.Schema({}, { strict: false, collection: "gold_prices" }));
const User = mongoose.models.User || mongoose.model("User", new mongoose.Schema({}, { strict: false, collection: "users" }));
const ReferralUsage = mongoose.models.ReferralUsage || mongoose.model("ReferralUsage", new mongoose.Schema({}, { strict: false, collection: "referralusages" }));

module.exports = { PaymentTransaction, CustomerGoldScheme, Installment, GoldRate, User, ReferralUsage };
