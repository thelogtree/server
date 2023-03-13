import sendgrid from "@sendgrid/mail";
import { config } from "./config";

sendgrid.setApiKey(config.sendgrid.apiKey);

type Content = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export const SendgridUtil = {
  sendEmail: async (content: Content) =>
    sendgrid.send({ ...content, from: config.sendgrid.fromEmail }),
};
