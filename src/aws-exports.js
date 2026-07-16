// aws-exports.js

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_AWS_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_AWS_USER_POOL_CLIENT_ID,
      region: import.meta.env.VITE_AWS_REGION,
      loginWith: {
        username: true,
      },
    },
  },
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_AWS_APPSYNC_ENDPOINT,
      region: import.meta.env.VITE_AWS_REGION,
      defaultAuthMode: "userPool",
    },
  },
};
export default awsConfig;
