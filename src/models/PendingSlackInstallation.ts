import { PendingSlackInstallationDocument } from "logtree-types";
import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const PendingSlackInstallationSchema = new Schema(
  {
    folderId: {
      type: ObjectId,
      ref: DatabaseModelNames.Folder,
      required: true,
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
    options: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

PendingSlackInstallationSchema.index({ folderId: 1, isComplete: 1 });

interface PendingSlackInstallationModel
  extends Model<PendingSlackInstallationDocument> {}

export const PendingSlackInstallation = model<
  PendingSlackInstallationDocument,
  PendingSlackInstallationModel
>(DatabaseModelNames.PendingSlackInstallation, PendingSlackInstallationSchema);
