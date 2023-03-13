import faker from "faker";
import merge from "lodash/merge";
import { Organization } from "src/models/Organization";
import { getHashFromPlainTextKey } from "src/utils/helpers";
import _ from "lodash";
import { OrganizationDocument } from "logtree-types";

const getDefaultFields = async () => ({
  name: faker.name.lastName(),
  keys: {
    publishableApiKey: faker.datatype.uuid(),
    encryptedSecretKey: null,
    saltRounds: 10,
  },
});

export const OrganizationFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    const plaintextSecretKey = faker.datatype.uuid();
    const organization: OrganizationDocument = new Organization(
      docFields
    ) as any;
    const encryptedSecretKey = await getHashFromPlainTextKey(
      plaintextSecretKey,
      organization.keys.saltRounds
    );
    organization.keys.encryptedSecretKey = encryptedSecretKey;
    await (organization as any).save();
    return _.merge(organization, {
      plaintextSecretKey,
    }) as OrganizationDocument; // append the plaintext secret key to make unit tests easier
  },
};
