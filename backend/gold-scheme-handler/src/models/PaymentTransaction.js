const mongoose = require("mongoose");

const PaymentTransactionSchema = new mongoose.Schema(
  {
    customer_scheme_id: {
      type: String,
      required: true,
    },

    customer_id: String,

    installment_id: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    installment_number: Number,

    installment_ids: [{ type: String }],

    razorpay_order_id: String,
    razorpay_payment_id: String,
    razorpay_signature: String,

    amount: {
      type: Number,
      required: true,
    },

    payment_status: {
      type: String,
      enum: ["CREATED", "SUCCESS", "FAILED", "ABANDONED"],
      default: "CREATED",
    },

    installments_covered: {
      type: Number,
      default: 0,
    },

    gold_rate: Number,
    grams_allocated: Number,

    webhook_payload: Object,
    reconciliation_error: String,
    reconciliation_checked_at: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "PaymentTransaction",
  PaymentTransactionSchema
);
