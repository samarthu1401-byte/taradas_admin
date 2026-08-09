const mongoose = require("mongoose");

const GoldRateSchema = new mongoose.Schema(
    {
        date: {
            type: String,
            required: true,
            unique: true
        },

        gold24K: {
            type: Number,
            required: true
        },

        gold22K: {
            type: Number,
            required: true
        },

        gold18K: {
            type: Number,
            required: true
        },

        authority: {
            type: String,
            required: true
        },

        currency: {
            type: String,
            required: true
        },

        unit: {
            type: String,
            required: true
        },

        sourceTimestamp: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true,
        collection: "gold_prices"
    }
);

module.exports = mongoose.model("GoldRate", GoldRateSchema);