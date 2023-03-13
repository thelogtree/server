import Joi from "joi";
import { ObjectId } from "mongodb";

export const wholeNumber = (value: any, _helpers: Joi.CustomHelpers<any>) => {
  if (!Number.isInteger(value)) {
    throw new Error("it must be whole number");
  }
  return value;
};

export const objectId = (value: any, _helpers: Joi.CustomHelpers<any>) => {
  if (!ObjectId.isValid(value)) {
    throw new Error("it must be valid ObjectId");
  }
  return value;
};
