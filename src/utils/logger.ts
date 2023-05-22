import { config } from "./config";
import { Logtree } from "logtree-node";

export const MyLogtree = new Logtree(
  config.logtree.publishableApiKey,
  config.logtree.plaintextSecretKey
);
