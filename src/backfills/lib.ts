import mongoose from "mongoose";
import { config } from "src/utils/config";

const awaitTimeout = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const executeJob = async (
  backfillFxn: () => Promise<any>,
  mongoUri: string // make sure you know whether this mongo uri points to staging or production
) => {
  if (config.environment.isTest) {
    return;
  }
  try {
    console.log("Starting Backfill. Please Wait. 🚣🏼‍♀️");
    await mongoose.connect(mongoUri);
    await backfillFxn();
    console.log("Backfill Was Successful 🦾");
  } catch (e) {
    console.error("Backfill Failed 😥");
    console.error(e);
  }
  await awaitTimeout(3000);
  process.exit();
};
