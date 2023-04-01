import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";
import { FolderPreferenceDocument } from "logtree-types";

const FolderPreferenceSchema = new Schema(
  {
    fullPath: { type: String, required: true, trim: true },
    isMuted: { type: Boolean, default: false },
    userId: {
      type: ObjectId,
      ref: DatabaseModelNames.User,
      required: true,
    },
  },
  { timestamps: true }
);

FolderPreferenceSchema.index({ userId: 1 });

interface FolderPreferenceModel extends Model<FolderPreferenceDocument> {}

export const FolderPreference = model<
  FolderPreferenceDocument,
  FolderPreferenceModel
>(DatabaseModelNames.FolderPreference, FolderPreferenceSchema);
