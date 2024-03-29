import {
  comparisonTypeEnum,
  LogDocument,
  notificationTypeEnum,
  RuleDocument,
} from "logtree-types";
import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const RuleSchema = new Schema(
  {
    userId: {
      type: ObjectId,
      ref: DatabaseModelNames.User,
      required: true,
    },
    folderId: {
      type: ObjectId,
      ref: DatabaseModelNames.Folder,
      required: true,
    },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
    comparisonType: { type: String, enum: comparisonTypeEnum, required: true },
    comparisonValue: { type: Number, required: true },
    lookbackTimeInMins: { type: Number, required: true }, // the intervals to look back at and compare
    numberOfTimesTriggered: { type: Number, default: 0 },
    lastTriggeredAt: { type: Date },
    notificationType: {
      type: String,
      enum: notificationTypeEnum,
      required: true,
    },
  },
  { timestamps: true }
);

RuleSchema.index({ userId: 1, folderId: 1 });
interface RuleModel extends Model<RuleDocument> {}

export const Rule = model<RuleDocument, RuleModel>(
  DatabaseModelNames.Rule,
  RuleSchema
);
