import { generateClient } from 'aws-amplify/api';

const getClient = () => generateClient();

const CUSTOMER_FIELDS = `userId customerId name email phoneNumber address city pincode aadharcardNo pancardNo createdOn active expiredOn`;

export const customerService = {
  async listCustomers() {
    const response = await getClient().graphql({
      query: `query ListCustomers { listCustomers { ${CUSTOMER_FIELDS} } }`,
      authMode: 'userPool',
    });
    return response.data?.listCustomers || [];
  },

  async updateCustomer(input) {
    const response = await getClient().graphql({
      query: `mutation UpdateCustomer($input: UpdateCustomerInput!) { updateCustomer(input: $input) { ${CUSTOMER_FIELDS} } }`,
      variables: { input },
      authMode: 'userPool',
    });
    return response.data?.updateCustomer;
  },

  async removeCustomer(userId) {
    const response = await getClient().graphql({
      query: `mutation DeleteCustomer($userId: ID!) { deleteCustomer(userId: $userId) }`,
      variables: { userId },
      authMode: 'userPool',
    });
    return response.data?.deleteCustomer;
  },
};
