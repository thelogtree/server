import { AxiosError } from "axios";
import bcrypt from "bcrypt";
import _ from "lodash";

import admin from "../../firebaseConfig";
import { OrganizationDocument } from "logtree-types";
import { DateTime } from "luxon";

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

export const partitionArray = (arr: any[], sliceSize: number) => {
  const slicedArray: any[] = [];
  for (let i = 0; i < arr.length; i += sliceSize) {
    slicedArray.push(arr.slice(i, i + sliceSize));
  }
  return slicedArray;
};

export const getFloorLogRetentionDateForOrganization = (
  organization: OrganizationDocument
) => {
  const floorDate = DateTime.now()
    .minus({
      days: organization.logRetentionInDays,
    })
    .toJSDate();

  return floorDate;
};

// example: 50000 -> 50,000
export const numberToNumberWithCommas = (val: number): string =>
  Math.trunc(val)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export const accessValueInMap = (object: any, key: string) => {
  try {
    return object[key] || object.get(key);
  } catch {
    return undefined;
  }
};

export const getFloorAndCeilingDatesForDataBox = (
  dataFloorDate: Date,
  dataCeilingDate: Date,
  numBoxes: number,
  indexOfBox: number
) => {
  const boxDuration = Math.ceil(
    (dataCeilingDate.getTime() - dataFloorDate.getTime()) / numBoxes
  );
  const floorDate = new Date(
    dataFloorDate.getTime() + boxDuration * indexOfBox
  );
  const ceilingDate = new Date(floorDate.getTime() + boxDuration);

  return { floorDate, ceilingDate };
};
