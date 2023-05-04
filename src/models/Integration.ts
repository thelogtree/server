import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";
import {
  IntegrationDocument,
  integrationTypeEnum,
  keyTypeEnum,
} from "logtree-types";

const KeySchema = new Schema(
  {
    type: { type: String, enum: keyTypeEnum, required: true },
    encryptedValue: { type: String, required: true },
  },
  { timestamps: false, _id: false }
);

const IntegrationSchema = new Schema(
  {
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
    type: {
      type: String,
      enum: integrationTypeEnum,
      required: true,
    },
    keys: [KeySchema],
  },
  { timestamps: true }
);

IntegrationSchema.index({ organizationId: 1 });

interface IntegrationModel extends Model<IntegrationDocument> {}

export const Integration = model<IntegrationDocument, IntegrationModel>(
  DatabaseModelNames.Integration,
  IntegrationSchema
);
