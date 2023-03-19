import { OrganizationDocument } from "logtree-types";
import { DateTime } from "luxon";
import { ObjectId } from "mongodb";
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
  generateSecretKey: async (organizationId: ObjectId) => {
    const plaintextSecretKey = uuid();
    const encryptedSecretKey = await getHashFromPlainTextKey(
      plaintextSecretKey,
      config.encryption.saltRounds
    );
    await Organization.updateOne(
      { _id: organizationId },
      {
        "keys.encryptedSecretKey": encryptedSecretKey,
      }
    ).exec();
    return plaintextSecretKey;
  },
  generateInviteLink: async (
    organizationId: ObjectId,
    organizationSlug: string
  ) => {
    // expires in 24 hours or when it gets used
    const invite = await OrgInvitation.create({
      organizationId: organizationId,
      expiresAt: DateTime.now().plus({ days: 1 }),
      isOneTimeUse: true,
    });

    return `${
      config.baseUrl
    }/${organizationSlug}/invite/${invite._id.toString()}`;
  },
};
