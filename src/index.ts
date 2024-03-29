require("dotenv").config();

import * as Sentry from "@sentry/node";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";

import routes from "./routes";
import { config } from "./utils/config";
import { exceptionHandler } from "./utils/exceptionHandler";
import { startMongo } from "./utils/mongoConfig";
import { attachUserDocument } from "./utils/attachUserDocumentToRoute";
import { rateLimiterP3 } from "./utils/rateLimiters";
import { MyRedis } from "./utils/redis";

const SERVER_MSG = `This is the Logtree server.`;

export const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(rateLimiterP3);
app.use(attachUserDocument);
app.get("/", (_, res) => res.send(SERVER_MSG));
app.use("/api", routes);
app.use(exceptionHandler); // must be last middleware func

const setupServer = async () => {
  await startMongo();

  if (config.environment.isProd) {
    Sentry.init({
      dsn: config.sentryDsn,
      tracesSampleRate: 1.0,
      maxValueLength: 800,
    });
  }

  if (config.redis.isCacheEnabled) {
    MyRedis.on("error", (err) => console.log("Redis Client Error", err));
    await MyRedis.connect();
  }

  const server = app.listen(config.environment.port, () => {
    console.log(`💪 Server is running on port: ${config.environment.port}`);
  });

  server.keepAliveTimeout = 120 * 1000;
  server.headersTimeout = 120 * 1000;
};

if (!config.environment.isTest) {
  setupServer();
}
