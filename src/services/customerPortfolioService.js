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

    let localPayments = [];
    try {
      localPayments = JSON.parse(localStorage.getItem('taradas_local_payments') || '[]');
    } catch { localPayments = []; }

    const customerLocalPayments = localPayments.filter(p =>
      p && (p.customerId === customer.userId || p.customerId === customer.customerId)
    );

    const customerSchemes = schemesResult.status === 'fulfilled' ? schemesResult.value : [];
    const definitions = new Map(schemeDefinitions.map(item => [item._id, item]));
    const schemeMap = new Map(customerSchemes.map(item => [item._id, item]));

    const activeSchemes = customerSchemes.map((scheme) => {
      const schemeLocals = customerLocalPayments.filter(p => p.customerSchemeId === scheme._id);
      const extraPaid = schemeLocals.length;
      const extraAmount = schemeLocals.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const rate = 7200;
      const extraGrams = extraAmount > 0 ? (extraAmount / rate) : 0;

      const totalPaidCount = Math.max(scheme.installments_paid || 0, (scheme.installments_paid || 0) + extraPaid);
      const totalPaidAmount = (scheme.total_paid_amount || 0) + extraAmount;
      const totalGoldGrams = (scheme.total_gold_grams || 0) + extraGrams;

      const schemeObj = {
        ...scheme,
        installments_paid: totalPaidCount,
        total_paid_amount: totalPaidAmount,
        total_gold_grams: totalGoldGrams,
      };

      return {
        id: scheme._id,
        _id: scheme._id,
        name: definitions.get(scheme.scheme_id)?.scheme_name || 'Gold Savings Scheme',
        schemeId: scheme.scheme_id,
        schemeType: scheme.scheme_type,
        goldCarat: scheme.gold_carat,
        installmentAmount: scheme.installment_amount,
        installmentsPaid: totalPaidCount,
        totalInstallments: scheme.total_installments,
        totalPaid: totalPaidAmount,
        totalGoldGrams: totalGoldGrams,
        startDate: scheme.enrolled_date,
        maturityDate: scheme.maturity_date,
        nextDueDate: nextDueDate(schemeObj).toISOString(),
        status: displayStatus(schemeObj),
      };
    });

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

    const localTransactions = customerLocalPayments.map(p => ({
      id: `local-tx-${p.date}-${p.customerSchemeId}`,
      date: p.date,
      amount: p.amount,
      type: 'credit',
      assetAdded: 'inr',
      customer_scheme_id: p.customerSchemeId,
      desc: `Cash collection - Gold installment`,
      status: 'SUCCESS',
      orderId: `CASH-LOCAL-${p.date}`,
    }));

    const transactions = [...localTransactions, ...paymentTransactions]
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
