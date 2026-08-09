const GoldScheme = require("../models/GoldScheme");
const CustomerGoldScheme = require("../models/CustomerGoldScheme");
const Installment = require("../models/Installment");
const GoldRate = require("../models/GoldRate");
const Transaction = require("../models/PaymentTransaction");
const User = require("../models/User");
const { processMaturedSchemes, refreshGoldRates, getAvatarUploadUrl } = require("../services/goldSchemeService");
const { reconcileCreatedTransactions } = require("../services/paymentReconciliationService");



async function currentCustomer(identity) {
  const claims = identity?.claims || {};
  const customerId = identity?.username || claims["cognito:username"] || claims.username;
  const cognitoSub = claims.sub;
  if (!customerId && !cognitoSub) throw new Error("Unauthorized");

  const filterConditions = [];
  if (customerId) {
    filterConditions.push({ customerId: new RegExp(`^${String(customerId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    filterConditions.push({ userId: customerId });
  }
  if (cognitoSub) {
    filterConditions.push({ uidToCognito: cognitoSub });
  }

  const customer = await User.findOne({ active: { $ne: false }, $or: filterConditions });
  if (!customer) throw new Error("Customer account not found");
  return customer;
}

function isAdmin(identity) {
  const rawGroups = identity?.claims?.["cognito:groups"] || [];
  const groups = Array.isArray(rawGroups) ? rawGroups : String(rawGroups).replaceAll("[", "").replaceAll("]", "").replaceAll('"', "").split(",");
  return groups.map((group) => group.trim()).includes("admins");
}

async function ownedScheme(customerId, customerSchemeId) {
  const scheme = await CustomerGoldScheme.findOne({ _id: customerSchemeId, customer_id: customerId });
  if (!scheme) throw new Error("Scheme not found");
  return scheme;
}

module.exports = async function queryResolver(field, args, identity) {
  switch (field) {
    case "getAvatarUploadUrl": {
      const customer = await currentCustomer(identity);
      const targetId = customer.customerId || customer.userId || identity?.username;
      return await getAvatarUploadUrl(targetId);
    }

    case "getSchemes":
      return await GoldScheme.find({ is_active: true });
    
    case "getCustomerSchemes": {
      await processMaturedSchemes();
      if (isAdmin(identity)) {
        return await CustomerGoldScheme.find({ customer_id: args.customerId });
      }
      const customer = await currentCustomer(identity);
      return await CustomerGoldScheme.find({ customer_id: customer.userId });
    }

    case "getInstallments": {
      const customer = await currentCustomer(identity);
      await ownedScheme(customer.userId, args.customerSchemeId);
      return await Installment.find({ customer_scheme_id: args.customerSchemeId });
    }

    case "getGoldRate":
      await refreshGoldRates();
      return await GoldRate.find().sort({ date: -1 }).limit(7);

    case "getTop10Transactions": {
      const customer = await currentCustomer(identity);
      await reconcileCreatedTransactions({ customer_id: customer.userId }, 5);
      return await Transaction.find({ customer_id: customer.userId })
        .sort({ createdAt: -1 })
        .limit(10);
    }

    case "getAllTransactions": {
      if (isAdmin(identity)) {
        await reconcileCreatedTransactions({ customer_id: args.customerId }, 10);
        return await Transaction.find({ customer_id: args.customerId }).sort({ createdAt: -1 });
      }
      const customer = await currentCustomer(identity);
      await reconcileCreatedTransactions({ customer_id: customer.userId }, 10);
      return await Transaction.find({ customer_id: customer.userId }).sort({ createdAt: -1 });
    }

    case "getSchemeTransactions": {
      const customer = await currentCustomer(identity);
      await ownedScheme(customer.userId, args.customerSchemeId);
      await reconcileCreatedTransactions({ customer_scheme_id: args.customerSchemeId }, 5);
      return await Transaction.find({ customer_scheme_id: args.customerSchemeId }).sort({ createdAt: -1 });
    }

    case "listPaymentExceptions": {
      if (!isAdmin(identity)) throw new Error("Unauthorized");
      await reconcileCreatedTransactions({}, 20);
      return await Transaction.find({
        $or: [
          { payment_status: "FAILED" },
          { payment_status: "CREATED", reconciliation_error: { $exists: true, $ne: "" } },
        ],
      }).sort({ createdAt: -1 }).limit(200);
    }

    case "listWithdrawals": {
      if (!isAdmin(identity)) throw new Error("Unauthorized");
      const filter = args.status ? { status: args.status } : {};
      return await CustomerGoldScheme.db.collection("withdrawalrequests").find(filter).sort({ createdAt: -1 }).toArray();
    }

    default:
      throw new Error("Unknown query");
  }
};
