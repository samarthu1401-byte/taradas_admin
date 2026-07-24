import { generateClient } from 'aws-amplify/api';
import { schemeService } from './schemeService';

const paymentQuery = `query GetCustomerPayments($customerId: String!) {
  getAllTransactions(customerId: $customerId) {
    _id customer_scheme_id amount payment_status razorpay_order_id
    razorpay_payment_id installments_covered createdAt updatedAt
  }
}`;

const nextDueDate = (scheme) => {
  const due = new Date(scheme.enrolled_date);
  const paid = scheme.installments_paid || 0;
  if (scheme.scheme_type === 'DAILY') due.setDate(due.getDate() + paid);
  if (scheme.scheme_type === 'WEEKLY') due.setDate(due.getDate() + paid * 7);
  if (scheme.scheme_type === 'MONTHLY') due.setMonth(due.getMonth() + paid);
  due.setHours(0, 0, 0, 0);
  return due;
};

const displayStatus = (scheme) => {
  if (scheme.status !== 'ACTIVE') return scheme.status || 'Inactive';
  if ((scheme.installments_paid || 0) >= scheme.total_installments) return 'Completed';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return nextDueDate(scheme) < today ? 'Missed Payment' : 'Active';
};

export const customerPortfolioService = {
  async load(customer, schemeDefinitions = []) {
    const client = generateClient();
    const [schemesResult, paymentsResult] = await Promise.allSettled([
      schemeService.getCustomerSchemes(customer.userId),
      client.graphql({ query: paymentQuery, variables: { customerId: customer.userId }, authMode: 'userPool' }),
    ]);

    const customerSchemes = schemesResult.status === 'fulfilled' ? schemesResult.value : [];
    const definitions = new Map(schemeDefinitions.map(item => [item._id, item]));
    const schemeMap = new Map(customerSchemes.map(item => [item._id, item]));
    const activeSchemes = customerSchemes.map((scheme) => ({
      id: scheme._id,
      _id: scheme._id,
      name: definitions.get(scheme.scheme_id)?.scheme_name || 'Gold Savings Scheme',
      schemeId: scheme.scheme_id,
      schemeType: scheme.scheme_type,
      goldCarat: scheme.gold_carat,
      installmentAmount: scheme.installment_amount,
      installmentsPaid: scheme.installments_paid || 0,
      totalInstallments: scheme.total_installments,
      totalPaid: scheme.total_paid_amount || 0,
      totalGoldGrams: scheme.total_gold_grams || 0,
      startDate: scheme.enrolled_date,
      maturityDate: scheme.maturity_date,
      nextDueDate: nextDueDate(scheme).toISOString(),
      status: displayStatus(scheme),
    }));

    const paymentItems = paymentsResult.status === 'fulfilled'
      ? paymentsResult.value.data?.getAllTransactions || []
      : [];
    const paymentTransactions = paymentItems.map(item => {
        const scheme = schemeMap.get(item.customer_scheme_id);
        const isAbandoned = item.payment_status === 'CREATED'
          && Date.now() - new Date(item.createdAt).getTime() > 30 * 60 * 1000;
        const status = isAbandoned ? 'ABANDONED' : item.payment_status;
        return {
          id: item._id,
          date: item.createdAt,
          amount: item.amount,
          type: status === 'SUCCESS' ? 'credit' : status === 'FAILED' ? 'debit' : 'pending',
          assetAdded: 'inr',
          desc: `${definitions.get(scheme?.scheme_id)?.scheme_name || 'Gold installment'} - ${status}`,
          status,
          orderId: item.razorpay_order_id,
        };
      });
    const transactions = paymentTransactions
      .sort((left, right) => new Date(right.date) - new Date(left.date));

    return {
      inrBalance: 0,
      gold24kBalance: activeSchemes.reduce((sum, scheme) => sum + scheme.totalGoldGrams, 0),
      silverBalance: 0,
      totalInvested: activeSchemes.reduce((sum, scheme) => sum + scheme.totalPaid, 0),
      transactions,
      activeSchemes,
    };
  },
};
