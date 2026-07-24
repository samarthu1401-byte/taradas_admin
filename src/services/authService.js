import { generateClient } from 'aws-amplify/api';
import { confirmSignIn, getCurrentUser, signIn } from 'aws-amplify/auth';

const signUpUserMutation = `
  mutation SignUpUser(
    $name: String!, $email: AWSEmail!,
    $phoneNumber: AWSPhone!, $address: String!, $city: String!,
    $pincode: String!, $aadharcardNo: String!, $pancardNo: String!,
    $userId: String
  ) {
    signUpUser(
      name: $name, email: $email,
      phoneNumber: $phoneNumber, address: $address, city: $city,
      pincode: $pincode, aadharcardNo: $aadharcardNo, pancardNo: $pancardNo,
      userId: $userId
    ) {
      userId customerId name email initialPassword phoneNumber address city
      pincode aadharcardNo pancardNo createdOn active expiredOn
    }
  }
`;

export const authService = {
  async saveProfileToVault(profileData) {
    const response = await generateClient().graphql({
      query: signUpUserMutation,
      variables: { ...profileData, userId: profileData.userId ?? null },
      authMode: 'userPool',
    });
    return response.data.signUpUser;
  },

  async signInUser(username, password) {
    return signIn({
      username,
      password,
      options: { authFlowType: 'USER_PASSWORD_AUTH' },
    });
  },

  async confirmNewPassword(newPassword) {
    return confirmSignIn({
      challengeResponse: newPassword,
      options: {
        userAttributes: {
          phone_number: '+910000000000',
          preferred_username: 'admin',
          email: 'admin@example.com',
        },
      },
    });
  },

  async getCurrentUser() {
    try {
      return await getCurrentUser();
    } catch {
      return null;
    }
  },
};
