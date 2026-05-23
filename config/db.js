import mongoose from 'mongoose';

// Disable query buffering globally for serverless environments (prevents standard 10s timeout hangs)
mongoose.set('bufferCommands', false);

// Extensive real-time loggers for database state transitions
mongoose.connection.on('connecting', () => {
  console.log('🔌 MongoDB: Connecting to cluster...');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB: Successfully connected!');
});

mongoose.connection.on('disconnecting', () => {
  console.log('🔌 MongoDB: Disconnecting...');
});

mongoose.connection.on('disconnected', () => {
  console.log('❌ MongoDB: Disconnected from cluster.');
});

mongoose.connection.on('error', (err) => {
  console.error('💥 MongoDB Connection Error occurred:', err.message);
});

const connectDB = async () => {
  try {
    const rawUri = process.env.MONGODB_URI;
    if (!rawUri) {
      throw new Error('MONGODB_URI environment variable is missing.');
    }
    
    // Mask credentials for secure logging
    const maskedUri = rawUri.replace(/:([^@]+)@/, ':***@');
    console.log(`🚀 Database Manager: Initiating connection to ${maskedUri}`);
    
    const conn = await mongoose.connect(rawUri, {
      serverSelectionTimeoutMS: 8000,
    });
    
    console.log(`🎉 Database Manager: Connection established with host: ${conn.connection.host}`);
  } catch (error) {
    console.error(`💥 Database Manager Connection Failure: ${error.message}`);
    console.warn('⚠️ WARNING: Failed to connect to MongoDB. Server will continue running, but database operations will fail.');
  }
};

export default connectDB;
