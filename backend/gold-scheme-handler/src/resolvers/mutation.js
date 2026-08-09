const {
    createScheme,
    updateScheme,
    deactivateScheme,
    enrollScheme,
    redeemScheme,
    createGoldPayment
    ,collectCashInstallment,
    updateMyCustomer,
    updateWithdrawalStatus,
    setGoldRate
} = require("../services/goldSchemeService");

const User = require("../models/User");

function requireAdmin(identity) {
    const rawGroups = identity?.claims?.["cognito:groups"] || [];
    const groups = Array.isArray(rawGroups) ? rawGroups : String(rawGroups).replaceAll("[", "").replaceAll("]", "").replaceAll('"', "").split(",");
    if (!groups.map((group) => group.trim()).includes("admins")) throw new Error("Unauthorized");
}

async function currentCustomer(identity) {
    const customerId = identity?.username || identity?.claims?.["cognito:username"] || identity?.claims?.username;
    if (!customerId) throw new Error("Unauthorized");
    const customer = await User.findOne({ customerId: new RegExp(`^${String(customerId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), active: { $ne: false } });
    if (!customer) throw new Error("Customer account not found");
    return customer;
}

module.exports = async function mutationResolver(field, args, identity) {
    switch (field) {
        case "createScheme":
            requireAdmin(identity);
            return await createScheme(args.input);

        case "updateScheme":
            requireAdmin(identity);
            return await updateScheme(args.input);

        case "deactivateScheme":
            requireAdmin(identity);
            return await deactivateScheme(args.id);

        case "enrollScheme": {
            const customer = await currentCustomer(identity);
            return await enrollScheme({ ...args.input, customer_id: customer.userId });
        }

        case "redeemScheme":
            {
                const customer = await currentCustomer(identity);
                return await redeemScheme(args.customerSchemeId, customer.userId);
            }

       case "createGoldPayment":
            return await createGoldPayment(args.input, identity);

       case "collectCashInstallment":
            requireAdmin(identity);
            return await collectCashInstallment(args.customerSchemeId, args.paymentDate);

       case "updateMyCustomer":
            return await updateMyCustomer(args.input, identity);

       case "updateWithdrawalStatus":
            requireAdmin(identity);
            return await updateWithdrawalStatus(args.input.id, args.input.status);

       case "setGoldRate":
            requireAdmin(identity);
            return await setGoldRate(args.input);
            
        default:
            throw new Error("Unknown mutation");
    }
};
