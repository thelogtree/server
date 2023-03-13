import mongoose from "mongoose";

import { config } from "./config";

export async function startMongo() {
  mongoose
    .connect(config.mongoUri)
    .then(() => {
      console.log("🍃 Connected to MongoDB");
      console.log(
        `🏄🏼‍♂️ You can now send requests to ${config.localServerUrl}/{{route_path}}`
      );
    })
    .catch((e) => {
      console.log("Error connecting to mongo: " + e);
      process.exit(1);
    });
}
