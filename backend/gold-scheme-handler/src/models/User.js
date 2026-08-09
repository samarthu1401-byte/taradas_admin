const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
    },

    uidToCognito: {
      type: String,
      default: null,
      index: true,
    },

    customerId: {
      type: String,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    dob: {
      type: String,
    },

    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },

    address: {
      type: String,
    },

    city: {
      type: String,
    },

    pincode: {
      type: String,
    },

    aadharcardNo: {
      type: String,
    },

    pancardNo: {
      type: String,
    },

    avatarUrl: {
      type: String,
      default: null,
    },

    createdOn: {
      type: Date,
      default: Date.now,
    },

    active: {
      type: Boolean,
      default: true,
    },

    expiredOn: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", UserSchema);
