import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";
import {
  FolderPreferenceDocument,
  FunnelCompletionDocument,
} from "logtree-types";

const FunnelCompletionSchema = new Schema(
  {
    referenceId: { type: String, required: true },
    funnelId: {
      type: ObjectId,
      ref: DatabaseModelNames.Funnel,
      required: true,
    },
  },
  { timestamps: true }
);

FunnelCompletionSchema.index({ funnelId: 1, referenceId: 1 });

interface FunnelCompletionModel extends Model<FunnelCompletionDocument> {}

export const FunnelCompletion = model<
  FolderPreferenceDocument,
  FunnelCompletionModel
>(DatabaseModelNames.FunnelCompletion, FunnelCompletionSchema);
