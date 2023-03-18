import { OrganizationDocument } from "logtree-types";
import { DateTime } from "luxon";
import { OrgInvitation } from "src/models/OrgInvitation";
import { Organization } from "src/models/Organization";
import { config } from "src/utils/config";
import { ApiError } from "src/utils/errors";
import { getHashFromPlainTextKey, wrapWords } from "src/utils/helpers";
import { uuid } from "uuidv4";

export const OrganizationService = {
  createOrganization: async (name: string): Promise<OrganizationDocument> => {
    const isExistingOrg = await Organization.exists({ name });
    if (isExistingOrg) {
      throw new ApiError("An organization with this name already exists.");
    }

    const publishableApiKey = uuid();
    const slug = wrapWords(name);
    return Organization.create({
      name,
      slug,
      keys: {
        publishableApiKey,
      },
    });
  },
  generateSecretKey: async (organization: OrganizationDocument) => {
    const plaintextSecretKey = uuid();
    const encryptedSecretKey = await getHashFromPlainTextKey(
      plaintextSecretKey,
      config.encryption.saltRounds
    );
    await Organization.updateOne(
      { _id: organization._id },
      {
        "keys.encryptedSecretKey": encryptedSecretKey,
      }
    ).exec();
    return plaintextSecretKey;
  },
  generateInviteLink: async (organization: OrganizationDocument) => {
    // expires in 24 hours or when it gets used
    const invite = await OrgInvitation.create({
      organizationId: organization._id,
      expiresAt: DateTime.now().plus({ days: 1 }),
      isOneTimeUse: true,
    });

    return `${config.baseUrl}/${
      organization.slug
    }/invite/${invite._id.toString()}`;
  },
};
