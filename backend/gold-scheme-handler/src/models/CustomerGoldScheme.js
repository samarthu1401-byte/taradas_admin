const mongoose = require("mongoose");

const CustomerGoldSchemeSchema = new mongoose.Schema(
    {
        customer_id: String,
        scheme_id: String,

        scheme_type: String,
         // NEW
         gold_carat: {
            type: String,
            enum: ["18K", "22K", "24K"],
            required: true
        },

        installment_amount: Number,
        total_installments: Number,
    
        total_paid_amount: {
            type: Number,
            default: 0
        },

        total_gold_grams: {
            type: Number,
            default: 0
        },

        installments_paid: {
            type: Number,
            default: 0
        },

        bonus_eligible: {
            type: Boolean,
            default: false
        },

        status: {
            type: String,
            default: "ACTIVE"
        },

        enrolled_date: Date,
        maturity_date: Date
    },
    { timestamps: true }
);

module.exports = mongoose.model(
    "CustomerGoldScheme",
    CustomerGoldSchemeSchema
);