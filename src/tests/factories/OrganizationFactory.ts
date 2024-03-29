import faker from "faker";
import merge from "lodash/merge";
import { Organization } from "src/models/Organization";
import { getHashFromPlainTextKey } from "src/utils/helpers";
import _ from "lodash";
import { OrganizationDocument } from "logtree-types";
import { config } from "src/utils/config";
import { UsageService } from "src/services/ApiService/lib/UsageService";
import { TRIAL_LOG_LIMIT } from "src/services/OrganizationService";

const getDefaultFields = async () => {
  const { cycleStarts, cycleEnds } = UsageService.getPeriodDates();
  return {
    name: faker.datatype.uuid(),
    slug: faker.datatype.uuid(),
    keys: {
      publishableApiKey: faker.datatype.uuid(),
      encryptedSecretKey: null,
    },
    cycleStarts,
    cycleEnds,
    numLogsSentInPeriod: 0,
    logLimitForPeriod: TRIAL_LOG_LIMIT,
  };
};

export const OrganizationFactory = {
  create: async (overrideFields?: Object) => {
    const docFields: any = merge(await getDefaultFields(), overrideFields);
    const plaintextSecretKey = faker.datatype.uuid();
    const organization: OrganizationDocument = new Organization(
      docFields
    ) as any;
    const encryptedSecretKey = await getHashFromPlainTextKey(
      plaintextSecretKey,
      config.encryption.saltRounds
    );
    organization.keys.encryptedSecretKey = encryptedSecretKey;
    await (organization as any).save();
    return _.merge(organization, {
      plaintextSecretKey,
    }) as OrganizationDocument; // append the plaintext secret key to make unit tests easier
  },
};
