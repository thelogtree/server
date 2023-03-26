import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";
import { FolderDocument } from "logtree-types";

const FolderSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
    parentFolderId: {
      type: ObjectId,
      ref: DatabaseModelNames.Folder,
      default: null,
    },
    fullPath: { type: String, required: true },
  },
  { timestamps: true }
);

FolderSchema.index({ organizationId: 1 });
FolderSchema.index({ parentFolder: 1 });
FolderSchema.index({ organizationId: 1, name: 1 }, { unique: true });

interface FolderModel extends Model<FolderDocument> {}

export const Folder = model<FolderDocument, FolderModel>(
  DatabaseModelNames.Folder,
  FolderSchema
);
