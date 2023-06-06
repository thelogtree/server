import {
  comparisonTypeEnum,
  FunnelDocument,
  LogDocument,
  notificationTypeEnum,
  RuleDocument,
} from "logtree-types";
import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const FunnelSchema = new Schema(
  {
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
    folderPathsInOrder: { type: Array, default: [] },
    forwardToChannelPath: { type: String, required: true },
  },
  { timestamps: true }
);

FunnelSchema.index({ organizationId: 1 });
interface FunnelModel extends Model<FunnelDocument> {}

export const Funnel = model<RuleDocument, FunnelModel>(
  DatabaseModelNames.Funnel,
  FunnelSchema
);
