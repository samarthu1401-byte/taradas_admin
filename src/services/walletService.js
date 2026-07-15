import { generateClient } from 'aws-amplify/api';

const getClient = () => generateClient();

export const walletService = {
  async getWallet(customerId) {
    const response = await getClient().graphql({ query: `query GetWallet($customerId: ID!) { getWallet(customerId: $customerId) { customerId inrBalance gold24kBalance silverBalance updatedAt } }`, variables: { customerId }, authMode: 'userPool' });
    return response.data.getWallet;
  },
  async listTransactions(customerId) {
    const response = await getClient().graphql({ query: `query ListTransactions($customerId: ID!) { listTransactions(customerId: $customerId) { id customerId asset amount type description createdAt } }`, variables: { customerId }, authMode: 'userPool' });
    return response.data.listTransactions || [];
  },
  async creditWallet(input) {
    const response = await getClient().graphql({ query: `mutation CreditWallet($input: WalletEntryInput!) { creditWallet(input: $input) { customerId inrBalance gold24kBalance silverBalance updatedAt } }`, variables: { input }, authMode: 'userPool' });
    return response.data.creditWallet;
  },
};
