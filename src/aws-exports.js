// aws-exports.js

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: "ap-south-1_BCnpX8nNg",
      userPoolClientId: "5qu71b86bnd7kn395vd6kbvp6j",
      region: "ap-south-1",
      loginWith: {
        username: true,
      },
    },
  },
  API: {
    GraphQL: {
      endpoint:
        "https://32ipf5csjjfprksuqqqdmgt2rq.appsync-api.ap-south-1.amazonaws.com/graphql",
      region: "ap-south-1",
      defaultAuthMode: "userPool",
    },
  },
};
export default awsConfig;
