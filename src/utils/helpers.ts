import { AxiosError } from "axios";
import bcrypt from "bcrypt";
import _ from "lodash";

import admin from "../../firebaseConfig";

// Converts boolean in query string to boolean value
export const queryBool = (str: string): boolean =>
  !!str && str.toString().trim().toLowerCase() === "true";

export async function awaitTimeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function validateUserId(idToken) {
  return admin.auth().verifyIdToken(idToken);
}

export async function getHashFromPlainTextKey(
  plainTextKey: string,
  saltRounds: number
): Promise<string> {
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(plainTextKey, salt);
}

export const getErrorMessage = (e: AxiosError) =>
  _.get(e, "response.data", e.message);

export const wrapWords = (words: string) =>
  words.split(" ").join("-").split("/").join("-");
