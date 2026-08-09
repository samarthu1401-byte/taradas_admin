const connectDB = require("./src/config/db");
const mutationResolver = require("./src/resolvers/mutation");
const queryResolver = require("./src/resolvers/query");


exports.handler = async (event) => {
    try {
        await connectDB();

        const field = event.info.fieldName;
        const args = event.arguments;

        if (event.info.parentTypeName === "Mutation") {
            return await mutationResolver(field, args, event.identity);
        }

        if (event.info.parentTypeName === "Query") {
            return await queryResolver(field, args, event.identity);
        }

        throw new Error("Resolver not found");
    } catch (error) {
        console.error(error);
        throw error;
    }
};
