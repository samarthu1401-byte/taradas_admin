import crypto from "crypto";
import { connectDB } from "./db.js";
import User from "./user.model.js";
import { encryptData } from "./encryption.js";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.REGION,
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const ADMIN_FIELDS = new Set(["listCustomers", "updateCustomer", "deleteCustomer", "signUpUser"]);

const requireAdmin = (event) => {
  const groups = event.identity?.claims?.["cognito:groups"] || [];
  const normalized = Array.isArray(groups) ? groups : String(groups).replaceAll("[", "").replaceAll("]", "").replaceAll('"', "").split(",");
  if (!normalized.map((group) => group.trim()).includes("admins")) throw new Error("Unauthorized");
};

const toGraphQLUser = (user) => ({
  userId: user.userId,
  customerId: user.customerId,
  name: user.name,
  email: user.email,
  dob: user.dob ? new Date(user.dob).toISOString().split("T")[0] : null,
  phoneNumber: user.phoneNumber,
  address: user.address,
  city: user.city,
  pincode: user.pincode,
  aadharcardNo: "ENCRYPTED",
  pancardNo: "ENCRYPTED",
  avatarUrl: user.avatarUrl || null,
  createdOn: user.createdOn,
  active: user.active,
  expiredOn: user.expiredOn,
});

const hashSecret = async (value) => {
  const salt = crypto.randomBytes(16).toString("base64url");
  const digest = await new Promise((resolve, reject) => crypto.scrypt(value, salt, 64, (error, derived) => error ? reject(error) : resolve(derived)));
  return `${salt}.${Buffer.from(digest).toString("base64url")}`;
};

const securityCollection = () => User.db.collection("customer_security");

const requireCustomer = async (event) => {
  const claims = event.identity?.claims || {};
  const customerId = event.identity?.username || claims["cognito:username"] || claims.username;
  const cognitoSub = claims.sub;
  if (!customerId && !cognitoSub) throw new Error("Unauthorized");
  const customer = await User.findOne({ active: true, $or: [{ customerId }, { uidToCognito: cognitoSub }] }).lean();
  if (!customer) throw new Error("Customer account not found");
  return customer;
};
const generateReferralCode = (name) => {
  const prefix = name
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .substring(0, 3)
    .padEnd(3, "X");

  const random = crypto.randomBytes(3)
    .toString("base64")
    .replace(/[^A-Za-z0-9]/g, "")
    .substring(0, 4)
    .toUpperCase();

  return `${prefix}${random}`;
};
export const handler = async (event) => {
  const args = event.arguments;

  try {
    await connectDB();

    if (ADMIN_FIELDS.has(event.info?.fieldName)) requireAdmin(event);

    if (event.info?.fieldName === "getMyCustomer") {
      return toGraphQLUser(await requireCustomer(event));
    }

    if (event.info?.fieldName === "setupMyMpin") {
      const customer = await requireCustomer(event);
      const { deviceId, deviceSecret, mpin, deviceName, platform, appVersion } = args;
      if (!/^[0-9]{6}$/.test(mpin) || deviceId.length < 16 || deviceSecret.length < 32) throw new Error("Invalid MPIN setup request");
      await securityCollection().createIndex({ customerId: 1, deviceId: 1 }, { unique: true });
      const deviceUpdates = { customerId: customer.customerId, customerIdLower: customer.customerId.toLowerCase(), mpinHash: await hashSecret(mpin), deviceId, deviceSecretHash: await hashSecret(deviceSecret), failedAttempts: 0, lockedUntil: null, updatedAt: new Date() };
      if (deviceName) deviceUpdates.deviceName = String(deviceName).slice(0, 80);
      if (platform) deviceUpdates.platform = String(platform).slice(0, 40);
      if (appVersion) deviceUpdates.appVersion = String(appVersion).slice(0, 30);
      await securityCollection().updateOne(
        { customerId: customer.customerId, deviceId },
        { $set: deviceUpdates, $setOnInsert: { createdAt: new Date(), deviceName: "Trusted device", platform: "Unknown" } },
        { upsert: true },
      );
      return { success: true, verified: true, message: "MPIN enabled" };
    }

    if (event.info?.fieldName === "setupMyBiometric") {
      const customer = await requireCustomer(event);
      const { deviceId, biometricSecret, enabled } = args;
      const record = await securityCollection().findOne({ customerId: customer.customerId, deviceId });
      if (!record) throw new Error("MPIN device is not registered");
      if (enabled) {
        if (typeof biometricSecret !== "string" || biometricSecret.length < 32) throw new Error("Invalid biometric setup request");
        await securityCollection().updateOne(
          { _id: record._id },
          { $set: { biometricSecretHash: await hashSecret(biometricSecret), biometricEnabled: true, updatedAt: new Date() } },
        );
      } else {
        await securityCollection().updateOne(
          { _id: record._id },
          { $set: { biometricEnabled: false, updatedAt: new Date() }, $unset: { biometricSecretHash: "" } },
        );
      }
      return { success: true, verified: true, message: enabled ? "Biometric unlock enabled" : "Biometric unlock disabled" };
    }

    if (event.info?.fieldName === "getMyDevices") {
      const customer = await requireCustomer(event);
      const metadata = {};
      if (args.deviceName) metadata.deviceName = String(args.deviceName).slice(0, 80);
      if (args.platform) metadata.platform = String(args.platform).slice(0, 40);
      if (args.appVersion) metadata.appVersion = String(args.appVersion).slice(0, 30);
      if (Object.keys(metadata).length) await securityCollection().updateOne({ customerId: customer.customerId, deviceId: args.currentDeviceId }, { $set: { ...metadata, updatedAt: new Date() } });
      const records = await securityCollection().find({ customerId: customer.customerId }).sort({ lastUsedAt: -1, updatedAt: -1 }).toArray();
      return records.map((record) => ({
        deviceId: record.deviceId,
        deviceName: record.deviceName || (record.deviceId === args.currentDeviceId ? "This device" : "Trusted device"),
        platform: record.platform || "Unknown",
        appVersion: record.appVersion || null,
        current: record.deviceId === args.currentDeviceId,
        biometricEnabled: Boolean(record.biometricEnabled),
        failedAttempts: Number(record.failedAttempts || 0),
        lockedUntil: record.lockedUntil || null,
        createdAt: record.createdAt || null,
        lastActiveAt: record.lastUsedAt || record.updatedAt || record.createdAt || null,
      }));
    }

    if (event.info?.fieldName === "revokeMyDevice") {
      const customer = await requireCustomer(event);
      if (args.deviceId === args.currentDeviceId) throw new Error("The current device cannot revoke itself");
      const current = await securityCollection().findOne({ customerId: customer.customerId, deviceId: args.currentDeviceId });
      if (!current) throw new Error("Current secure device is not registered");
      const result = await securityCollection().deleteOne({ customerId: customer.customerId, deviceId: args.deviceId });
      if (!result.deletedCount) throw new Error("Device not found or already revoked");
      return { success: true, verified: true, message: "Device access revoked" };
    }

    if (event.info?.fieldName === "listCustomers") {
      const users = await User.find({}).sort({ createdOn: -1 }).lean();
      return users.map(toGraphQLUser);
    }

    if (event.info?.fieldName === "updateCustomer") {
      const { userId, ...changes } = args.input;
      delete changes.aadharcardNo;
      delete changes.pancardNo;
      const existingUser = await User.findOne({ userId });
      if (!existingUser) throw new Error("Customer not found");
      const cognitoAttributes = [
        changes.name && { Name: "name", Value: changes.name },
        changes.email && { Name: "email", Value: changes.email },
        changes.phoneNumber && { Name: "phone_number", Value: changes.phoneNumber },
      ].filter(Boolean);
      if (cognitoAttributes.length) {
        await cognitoClient.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: USER_POOL_ID,
          Username: existingUser.customerId,
          UserAttributes: cognitoAttributes,
        }));
      }
      const user = await User.findOneAndUpdate({ userId }, changes, { new: true });
      return toGraphQLUser(user);
    }

    if (event.info?.fieldName === "deleteCustomer") {
      const user = await User.findOne({ userId: args.userId });
      if (!user) throw new Error("Customer not found");
      try {
        await cognitoClient.send(new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: user.customerId,
        }));
      } catch (error) {
        if (error.name !== "UserNotFoundException") throw error;
      }
      const database = User.db;
      const enrolledSchemes = await database.collection("customergoldschemes").find({ customer_id: user.userId }).project({ _id: 1 }).toArray();
      const schemeIds = enrolledSchemes.map((scheme) => String(scheme._id));
      await Promise.all([
        database.collection("installments").deleteMany({ customer_scheme_id: { $in: schemeIds } }),
        database.collection("paymenttransactions").deleteMany({ customer_id: user.userId }),
        database.collection("customergoldschemes").deleteMany({ customer_id: user.userId }),
        database.collection("customer_security").deleteMany({ customerId: user.customerId }),
      ]);
      await User.deleteOne({ userId: user.userId });
      return true;
    }

    const existingUser = await User.findOne({
      $or: [{ email: args.email }, { phoneNumber: args.phoneNumber }],
    });

    if (existingUser) {
      throw new Error(
        "An account with this Email or Phone Number already exists.",
      );
    }

    const uuid = crypto.randomUUID();
    const userId = `usr_${uuid.replace(/-/g, "").substring(0, 16)}`;

    const encryptedAadhaar = encryptData(args.aadharcardNo);
    const encryptedPan = encryptData(args.pancardNo);

    // Generate Customer ID
    const customerId = args.userId || `CUS${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Generate Password
    // const firstFourLetters = args.name.replace(/\s+/g, "").substring(0, 4);

    // const birthYear = new Date(args.dob).getFullYear();

    const generatedPassword = `Tara@${crypto.randomInt(1000, 10000)}${crypto.randomBytes(6).toString("base64url")}!`;
    
    // Create user in Cognito. A failed request can be safely retried with the
    // same generated customer ID instead of leaving an orphaned Cognito user.
    let cognitoUser;
    try {
      const createUserResponse = await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: customerId, // Customer ID as Cognito username
        MessageAction: "SUPPRESS",
        UserAttributes: [
          {
            Name: "email",
            Value: args.email,
          },
          {
            Name: "email_verified",
            Value: "true",
          },
          {
            Name: "phone_number",
            Value: args.phoneNumber,
          },
          {
            Name: "phone_number_verified",
            Value: "true",
          },
          {
            Name: "name",
            Value: args.name,
          },
          {
            Name: "preferred_username",
            Value: customerId,
          },
        ],
      }),
      );
      cognitoUser = createUserResponse.User;
    } catch (error) {
      if (error.name !== "UsernameExistsException") throw error;
      const existingCognitoUser = await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: customerId,
      }));
      const existingEmail = existingCognitoUser.UserAttributes?.find((attribute) => attribute.Name === "email")?.Value;
      const existingPhone = existingCognitoUser.UserAttributes?.find((attribute) => attribute.Name === "phone_number")?.Value;
      if (existingEmail !== args.email || existingPhone !== args.phoneNumber) {
        throw new Error("Customer ID is already in use. Please register again.", { cause: error });
      }
      cognitoUser = { Attributes: existingCognitoUser.UserAttributes };
    }
    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: customerId,
        Password: generatedPassword,
        Permanent: false,
      }),
    );

    const cognitoSub = cognitoUser.Attributes?.find(
      (attr) => attr.Name === "sub",
    )?.Value;

    let referralCode;

while (true) {
    referralCode = generateReferralCode(args.name);

    const exists = await User.exists({ referralCode });

    if (!exists) break;
}
    const newUser = new User({
      userId,
      customerId,
      uidToCognito: cognitoSub,
      referral_code: referralCode,
      name: args.name,
      email: args.email,
      dob: args.dob ? new Date(args.dob) : undefined,
      phoneNumber: args.phoneNumber,
      address: args.address,
      city: args.city,
      pincode: args.pincode,
      aadharcardNo: encryptedAadhaar,
      pancardNo: encryptedPan,
      active: true,
      expiredOn: null,
    });

    await newUser.save();

    return { ...toGraphQLUser(newUser), initialPassword: generatedPassword };
  } catch (error) {
    console.error("Error:", error);

    if (error.code === 11000 || error.message === "An account with this Email or Phone Number already exists.") {
      throw new Error(
        "An account with this Email or Phone Number already exists.",
        { cause: error },
      );
    }

    throw new Error("Failed to process and save user data.", { cause: error });
  }
};
