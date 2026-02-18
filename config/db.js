const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.log('⚠️  Make sure you have:');
    console.log('   1. Whitelisted your IP in MongoDB Atlas (Network Access > Add IP > Allow Access from Anywhere)');
    console.log('   2. Correct username/password in .env file');
    console.log('   3. Stable internet connection');
    console.log('🔄 Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
