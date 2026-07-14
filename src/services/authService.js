import { generateClient } from 'aws-amplify/api';
import { confirmSignUp, signIn, signUp, getCurrentUser, confirmSignIn } from 'aws-amplify/auth';

// Private memory space for the password
let pendingPassword = "";

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
      userId
      customerId
      name
      email
      initialPassword
      phoneNumber
      address
      city
      pincode
      aadharcardNo
      pancardNo
      createdOn
      active
      expiredOn
    }
  }
`;

export const authService = {
  // 1. Set the password during the register call
  registerWithCognito: async (username, password) => {
    pendingPassword = password; // Save for later verification
    return await signUp({
      username,
      password,
      options: {
        userAttributes: { email: username },
        autoSignIn: true, // 👈 add this
      },
    });
  },

  // 2. Fetch the password during the verify call
  verifyAndSignIn: async (username, otp) => {
    try {
      const confirmResult = await confirmSignUp({
        username,
        confirmationCode: otp,
      });


      if (!confirmResult.isSignUpComplete) {
        throw new Error("Sign up confirmation failed");
      }

      // Skip autoSignIn — go straight to manual signIn
      const password = pendingPassword;
      if (!password) {
        throw new Error(
          "Session expired. Please go back and re-enter your password.",
        );
      }


      // Small delay to let Cognito settle after confirmation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const signInOutput = await signIn({
        username,
        password,
        options: {
          authFlowType: "USER_PASSWORD_AUTH",
        },
      });


      if (signInOutput.isSignedIn) {
        pendingPassword = "";
        return signInOutput;
      } else {
        throw new Error(
          `Challenge required: ${signInOutput.nextStep.signInStep}`,
        );
      }
    } catch (err) {
      throw err;
    }
  },

  saveProfileToVault: async (profileData) => {
    try {
      const client = generateClient();
      const response = await client.graphql({
        query: signUpUserMutation,
        variables: {
          ...profileData,
          userId: profileData.userId ?? null,
        },
        authMode: "userPool",
      });
      return response.data.signUpUser;
    } catch (err) {
      throw err;
    }
  },

  signInUser: async (username, password) => {
    const signInOutput = await signIn({
      username,
      password,
      options: { authFlowType: "USER_PASSWORD_AUTH" },
    });
    return signInOutput;
  },

  confirmNewPassword: async (newPassword) => {
    return await confirmSignIn({ 
      challengeResponse: newPassword,
      options: {
        userAttributes: {
          phone_number: '+910000000000', // Added default to satisfy Cognito requirements
          preferred_username: 'admin', // Added to satisfy preferred_username requirement
          email: 'admin@example.com' // Added to satisfy email requirement
        }
      }
    });
  },

  signInWithOTP: async (username) => {
    return await signIn({
      username,
      options: { authFlowType: "CUSTOM_WITHOUT_SRP" },
    });
  },

  confirmSignInOTP: async (otp) => {
    return await confirmSignIn({ challengeResponse: otp });
  },

  manageMPIN: async (action, mpin) => {
    try {
      const { userId } = await getCurrentUser();
      const client = generateClient();
      
      const response = await client.graphql({
        query: `mutation ManageMPIN($action: String!, $userId: ID!, $mpin: String!) {
          manage_mpin(action: $action, userId: $userId, mpin: $mpin) {
            success
            message
          }
        }`,
        variables: { action, userId, mpin },
        authMode: "userPool",
      });

      return response.data.manage_mpin;
    } catch (err) {
      console.error("MPIN Service Error:", err);
      throw err;
    }
  },
  
  getCurrentUser: async () => {
    try {
      return await getCurrentUser();
    } catch {
      return null;
    }
  }
};
