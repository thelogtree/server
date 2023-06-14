import { createClient } from "redis";
import { config } from "./config";

export const MyRedis = config.environment.isProd
  ? createClient({ url: config.redis.url })
  : createClient({ socket: { port: 6379, host: "127.0.0.1" } });

export const RedisUtil = {
  setValue: async (key: string, value: any) => {
    if (!config.redis.isCacheEnabled) {
      return;
    }
    await MyRedis.set(key, value);
  },
  getValue: async (key: string) => {
    if (!config.redis.isCacheEnabled) {
      return;
    }
    return MyRedis.get(key);
  },
};
