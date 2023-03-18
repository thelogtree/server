import { NextFunction, Response } from "express";
import { User } from "src/models/User";

import { DEFAULT_FIREBASE_ID_FAKE } from "../tests/TestHelper";
import { validateUserId } from "./helpers";

// attaches the logged in user to all requests, accessible as req.user
export const attachUserDocument = async (
  req: any,
  _res: Response,
  next: NextFunction
) => {
  try {
    delete req.user;
    const authHeaderArr = req.headers.authorization
      ? req.headers.authorization.split(" ")
      : [];
    if (authHeaderArr.length === 2) {
      let firebaseId =
        process.env.NODE_ENV === "test"
          ? authHeaderArr[1]
          : (await validateUserId(authHeaderArr[1])).uid;
      if (firebaseId && firebaseId !== DEFAULT_FIREBASE_ID_FAKE) {
        const userDoc = await User.findOne({ firebaseId }).lean().exec();
        if (userDoc) {
          req.user = userDoc;
          req.token = authHeaderArr[1];
        }
      }
    }
  } catch {}
  next();
};
