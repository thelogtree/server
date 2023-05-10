import { integrationTypeEnum, OAuthRequestDocument } from "logtree-types";
import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const OAuthRequestSchema = new Schema(
  {
    source: { type: String, enum: integrationTypeEnum, required: true },
    isComplete: { type: Boolean, default: false },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
  },
  { timestamps: true }
);

interface OAuthRequestModel extends Model<OAuthRequestDocument> {}

export const OAuthRequest = model<OAuthRequestDocument, OAuthRequestModel>(
  DatabaseModelNames.OAuthRequest,
  OAuthRequestSchema
);
