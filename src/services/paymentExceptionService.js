import { generateClient } from 'aws-amplify/api';

const query = `query ListPaymentExceptions {
  listPaymentExceptions {
    _id customer_id customer_scheme_id amount payment_status
    razorpay_order_id razorpay_payment_id installments_covered createdAt updatedAt
  }
}`;

export const paymentExceptionService = {
  async list() {
    const client = generateClient();
    const response = await client.graphql({ query, authMode: 'userPool' });
    return response.data?.listPaymentExceptions || [];
  },
};
