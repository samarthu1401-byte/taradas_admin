import { generateClient } from 'aws-amplify/api';

const client = generateClient();

export const schemeService = {
  async listSchemes() {
    const response = await client.graphql({
      query: `query ListSchemes { getSchemes { _id scheme_name scheme_type installment_amount total_installments duration_months description } }`,
      authMode: 'userPool',
    });
    return response.data?.getSchemes || [];
  },

  async getCustomerSchemes(customerId) {
    const response = await client.graphql({
      query: `query GetCustomerSchemes($customerId: String!) { getCustomerSchemes(customerId: $customerId) { _id customer_id scheme_id scheme_type gold_carat installment_amount total_installments installments_paid total_paid_amount total_gold_grams enrolled_date maturity_date status } }`,
      variables: { customerId },
      authMode: 'userPool',
    });
    return response.data?.getCustomerSchemes || [];
  },
};
