import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Plot from '../models/Plot.js';

dotenv.config();

async function resetPlotsAvailable() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const result = await Plot.updateMany(
    {},
    { $set: { status: 'available' }, $unset: { customer: '' } }
  );

  console.log(`Reset ${result.modifiedCount} plots to available (customer cleared).`);
  await mongoose.disconnect();
}

resetPlotsAvailable().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
