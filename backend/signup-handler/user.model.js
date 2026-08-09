import mongoose from "mongoose";

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

    name: {
      type: String,
      required: true,
    },
    customerId: {
      type: String,
      required: true,
    },
    referral_code: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

   
    wallet_points: {
      type: Number,
      default: 0,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
    dob: {
      type: Date,
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
  },
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
