import { Twilio } from "twilio";

import { User } from "../models/User";
import { config } from "./config";
import { ApiError } from "./errors";

export const MyTwilio = new Twilio(config.twilio.sid, config.twilio.authToken);

export const TwilioUtil = {
  sendVerificationCode: async (phoneNumber: string) =>
    MyTwilio.verify
      .services(config.twilio.serviceSid)
      .verifications.create({ to: phoneNumber, channel: "sms" }),
  _getVerificationCodeResult: async (phoneNumber: string, code: string) => {
    let isApproved = false;
    try {
      const result = await MyTwilio.verify
        .services(config.twilio.serviceSid)
        .verificationChecks.create({ to: phoneNumber, code });
      const { status } = result;
      isApproved = status === "approved";
    } catch (e: any) {}

    return isApproved;
  },
  submitVerificationCode: async (
    userId: string,
    phoneNumber: string,
    code: string
  ) => {
    const isApproved = await TwilioUtil._getVerificationCodeResult(
      phoneNumber,
      code
    );

    if (!isApproved) {
      throw new ApiError("The code you entered was incorrect.");
    }

    await User.updateOne({ _id: userId }, { phoneNumber });
  },
  sendMessage: async (toPhoneNumber: string, message: string) =>
    MyTwilio.messages.create({
      to: toPhoneNumber,
      body: message,
      from: config.twilio.fromPhoneNumber,
    }),
};
