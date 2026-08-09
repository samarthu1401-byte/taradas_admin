const mongoose = require("mongoose");

const InstallmentSchema = new mongoose.Schema(
    {
        customer_scheme_id: String,

        installment_number: Number,

        due_date: Date,

        status: {
            type: String,
            enum: ["PENDING", "PAID", "MISSED"],
            default: "PENDING"
        },

        amount_paid: Number,
        gold_rate: Number,
        grams_allocated: Number,

        paid_date: Date
    },
    { timestamps: true }
);

module.exports = mongoose.model("Installment", InstallmentSchema);