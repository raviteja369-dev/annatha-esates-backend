import mongoose from 'mongoose';
import { syncLayoutIndexes } from '../utils/syncLayoutIndexes.js';
import { migratePlotActiveFromPublishedLayouts } from '../utils/publishedLayoutPlots.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await syncLayoutIndexes();
    await migratePlotActiveFromPublishedLayouts();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
