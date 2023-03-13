export class TwilioMock {}

export const twilioVerifyMock = {
  verifications: {
    create: (_input: any) => Promise.resolve(),
  },
  verificationChecks: {
    create: (_input: any) => Promise.resolve({ status: "approved" }),
  },
  services: (_twilioServiceSid: string) => ({
    verifications: twilioVerifyMock.verifications,
    verificationChecks: twilioVerifyMock.verificationChecks,
  }),
};

(TwilioMock as any).Twilio = class Twilio {
  verify: any;
  constructor(_twilioSid, _twilioAuthToken) {
    this.verify = twilioVerifyMock;
  }
};
