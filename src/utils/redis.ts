import { createClient } from "redis";
import { config } from "./config";

export const MyRedis = createClient({ url: config.redis.url });

export const RedisUtil = {
  setValue: async (key: string, value: any) => {
    if (!config.environment.isProd) {
      return;
    }
    await MyRedis.set(key, value);
  },
  getValue: async (key: string) => {
    if (!config.environment.isProd) {
      return;
    }
    return MyRedis.get(key);
  },
};
