import { OrganizationDocument } from "logtree-types";
import { Organization } from "src/models/Organization";
import { config } from "src/utils/config";
import { ApiError } from "src/utils/errors";
import { getHashFromPlainTextKey } from "src/utils/helpers";
import { uuid } from "uuidv4";

export const OrganizationService = {
  createOrganization: async (name: string): Promise<OrganizationDocument> => {
    const isExistingOrg = await Organization.exists({ name });
    if (isExistingOrg) {
      throw new ApiError("An organization with this name already exists.");
    }

    const publishableApiKey = uuid();
    return Organization.create({
      name,
      keys: {
        publishableApiKey,
      },
    });
  },
  generateSecretKey: async (organization: OrganizationDocument) => {
    const plaintextSecretKey = uuid();
    const encryptedSecretKey = getHashFromPlainTextKey(
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
};
