const mongoose = require("mongoose");

async function connectDatabase() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }
}

module.exports = { connectDatabase };
