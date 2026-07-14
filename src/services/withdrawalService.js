import { generateClient } from 'aws-amplify/api';

const client = generateClient();

export const withdrawalService = {
  async list(status) {
    const response = await client.graphql({ query: `query ListWithdrawals($status: String) { listWithdrawals(status: $status) { id customerId asset amount type status createdAt updatedAt } }`, variables: { status }, authMode: 'userPool' });
    return response.data.listWithdrawals || [];
  },
  async updateStatus(input) {
    const response = await client.graphql({ query: `mutation UpdateWithdrawalStatus($input: UpdateWithdrawalInput!) { updateWithdrawalStatus(input: $input) { id customerId asset amount type status createdAt updatedAt } }`, variables: { input }, authMode: 'userPool' });
    return response.data.updateWithdrawalStatus;
  },
};
