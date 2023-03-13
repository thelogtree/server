import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config";

const skipMiddleware = (_req: Request, _res: Response, next: NextFunction) =>
  next();

export const rateLimiterP3 = config.environment.isTest
  ? skipMiddleware
  : rateLimit({
      windowMs: 1000, // 1 second
      max: 10, // Limit each IP to 10 requests per 1 second
      message: "You have exceeded the rate limit.",
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    });
