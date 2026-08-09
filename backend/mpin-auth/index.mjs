import crypto from "crypto";
import mongoose from "mongoose";

let connected = false;
async function connect() {
  if (!connected) {
    await mongoose.connect(process.env.MONGODB_URI);
    connected = true;
  }
}

async function verify(value, encoded) {
  if (!encoded) return false;
  const [salt, expected] = encoded.split(".");
  if (!salt || !expected) return false;
  const derived = await new Promise((resolve, reject) => crypto.scrypt(value, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
  const expectedBuffer = Buffer.from(expected, "base64url");
  return expectedBuffer.length === derived.length && crypto.timingSafeEqual(expectedBuffer, derived);
}

async function security(username, deviceId) {
  await connect();
  return mongoose.connection.collection("customer_security").findOne({ deviceId, $or: [{ customerId: new RegExp(`^${String(username).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }, { customerIdLower: String(username).toLowerCase() }] });
}

export const defineAuthChallenge = async (event) => {
  const session = event.request.session || [];
  const last = session[session.length - 1];
  event.response.issueTokens = Boolean(last?.challengeResult);
  event.response.failAuthentication = !last?.challengeResult && session.length >= 5;
  event.response.challengeName = event.response.issueTokens || event.response.failAuthentication ? undefined : "CUSTOM_CHALLENGE";
  return event;
};

export const createAuthChallenge = async (event) => {
  event.response.publicChallengeParameters = { prompt: "MPIN" };
  event.response.privateChallengeParameters = { expected: "mpin" };
  event.response.challengeMetadata = "MPIN";
  return event;
};

export const verifyAuthChallengeResponse = async (event) => {
  try {
    const [deviceId, secret, proof] = String(event.request.challengeAnswer || "").split("|");
    const record = await security(event.userName, deviceId);
    const biometric = proof === "BIOMETRIC";
    if (!record || (!biometric && !/^[0-9]{6}$/.test(proof))) {
      event.response.answerCorrect = false;
      return event;
    }
    const now = new Date();
    if (record.lockedUntil && record.lockedUntil > now) {
      event.response.answerCorrect = false;
      return event;
    }
    const valid = biometric
      ? record.biometricEnabled === true && await verify(secret, record.biometricSecretHash)
      : await verify(secret, record.deviceSecretHash) && await verify(proof, record.mpinHash);
    const collection = mongoose.connection.collection("customer_security");
    if (valid) {
      await collection.updateOne({ _id: record._id }, { $set: { failedAttempts: 0, lockedUntil: null, lastUsedAt: now } });
      event.response.answerCorrect = true;
    } else {
      const attempts = (record.failedAttempts || 0) + 1;
      await collection.updateOne({ _id: record._id }, { $set: { failedAttempts: attempts, lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null } });
      event.response.answerCorrect = false;
    }
  } catch {
    event.response.answerCorrect = false;
  }
  return event;
};
