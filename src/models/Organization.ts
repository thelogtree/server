import { OrganizationDocument } from "logtree-types";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const KeysSchema = new Schema(
  {
    publishableApiKey: { type: String, required: true },
    encryptedSecretKey: { type: String, default: null },
  },
  { timestamps: false, _id: false }
);

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    keys: { type: KeysSchema, required: true },
    logLimitForPeriod: { type: Number, default: 0 },
    numLogsSentInPeriod: { type: Number, default: 0 },
    cycleStarts: { type: Date, required: true },
    cycleEnds: { type: Date, required: true },
    isSuspended: { type: Boolean, default: false },
    logRetentionInDays: { type: Number, default: 30 },
  },
  { timestamps: true }
);

OrganizationSchema.index({ name: 1 }, { unique: true });
OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ "keys.publishableApiKey": 1 }, { unique: true });

interface OrganizationModel extends Model<OrganizationDocument> {}

export const Organization = model<OrganizationDocument, OrganizationModel>(
  DatabaseModelNames.Organization,
  OrganizationSchema
);
