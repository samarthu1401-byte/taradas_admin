import { generateClient } from 'aws-amplify/api';

const getClient = () => generateClient();

export const withdrawalService = {
  async list(status) {
    const response = await getClient().graphql({ query: `query ListWithdrawals($status: String) { listWithdrawals(status: $status) { id customerId asset amount type status createdAt updatedAt } }`, variables: { status }, authMode: 'userPool' });
    return response.data.listWithdrawals || [];
  },
  async updateStatus(input) {
    const response = await getClient().graphql({ query: `mutation UpdateWithdrawalStatus($input: UpdateWithdrawalInput!) { updateWithdrawalStatus(input: $input) { id customerId asset amount type status createdAt updatedAt } }`, variables: { input }, authMode: 'userPool' });
    return response.data.updateWithdrawalStatus;
  },
};
