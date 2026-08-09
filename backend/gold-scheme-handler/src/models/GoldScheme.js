const mongoose = require("mongoose");

const GoldSchemeSchema = new mongoose.Schema(
  {
    scheme_name: {
      type: String,
      required: true,
    },

    scheme_type: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY"],
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    key_features: [
      {
        type: String,
      },
    ],

    installment_amount: {
      type: Number,
      required: true,
    },

    total_installments: {
      type: Number,
      required: true,
    },

    duration_months: {
      type: Number,
      required: true,
    },

    gold_carat: {
      type: String,
      enum: ["18K", "22K", "24K"],
      default: "24K",
    },

    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("GoldScheme", GoldSchemeSchema);