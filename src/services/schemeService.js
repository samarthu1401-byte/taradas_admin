import { generateClient } from 'aws-amplify/api';

const getClient = () => generateClient();

export const schemeService = {
  async listSchemes() {
    const response = await getClient().graphql({
      query: `query ListSchemes { getSchemes { _id scheme_name scheme_type installment_amount total_installments duration_months description } }`,
      authMode: 'userPool',
    });
    return response.data?.getSchemes || [];
  },

  async getCustomerSchemes(customerId) {
    const response = await getClient().graphql({
      query: `query GetCustomerSchemes($customerId: String!) { getCustomerSchemes(customerId: $customerId) { _id customer_id scheme_id scheme_type gold_carat installment_amount total_installments installments_paid total_paid_amount total_gold_grams enrolled_date maturity_date status } }`,
      variables: { customerId },
      authMode: 'userPool',
    });
    return response.data?.getCustomerSchemes || [];
  },
  async collectCashInstallment(customerSchemeId) {
    const response = await getClient().graphql({
      query: `mutation CollectCashInstallment($customerSchemeId: String!) { collectCashInstallment(customerSchemeId: $customerSchemeId) { _id installment_number status amount_paid gold_rate grams_allocated } }`,
      variables: { customerSchemeId }, authMode: 'userPool'
    });
    return response.data.collectCashInstallment;
  },
};
