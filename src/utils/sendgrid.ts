import sendgrid from "@sendgrid/mail";
import { config } from "./config";
import { OrganizationDocument, orgPermissionLevel } from "logtree-types";
import { User } from "src/models/User";

sendgrid.setApiKey(config.sendgrid.apiKey);

type Content = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export const SendgridUtil = {
  sendEmail: async (content: Content) =>
    sendgrid.send({
      ...content,
      from: {
        email: config.sendgrid.fromEmail,
        name: "Logtree",
      },
    }),
  getEmailAddressesOfAllAdminsInOrganization: async (
    organizationId: string
  ) => {
    const users = await User.find(
      {
        organizationId: organizationId,
        orgPermissionLevel: orgPermissionLevel.Admin,
      },
      { email: 1 }
    )
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return users.map((u) => u.email);
  },
};
