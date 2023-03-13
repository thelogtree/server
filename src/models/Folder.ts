import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";
import { FolderDocument } from "logtree-types";

const FolderSchema = new Schema(
  {
    name: { type: String, required: true },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
    parentFolder: {
      type: ObjectId,
      ref: DatabaseModelNames.Folder,
      default: null,
    },
  },
  { timestamps: true }
);

FolderSchema.index({ organizationId: 1 });
FolderSchema.index({ parentFolder: 1 });

interface FolderModel extends Model<FolderDocument> {}

export const Folder = model<FolderDocument, FolderModel>(
  DatabaseModelNames.Folder,
  FolderSchema
);
