import { LogDocument } from "logtree-types";
import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const LogSchema = new Schema(
  {
    content: { type: String, required: true },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
    folderId: {
      type: ObjectId,
      ref: DatabaseModelNames.Folder,
      required: true,
    },
    referenceId: { type: String },
  },
  { timestamps: true }
);

LogSchema.index({ referenceId: 1, folderId: 1, organizationId: 1 });
LogSchema.index({ folderId: 1, createdAt: 1 });
LogSchema.index({ organizationId: 1 });
LogSchema.index({ folderId: 1, organizationId: 1 });

interface LogModel extends Model<LogDocument> {}

export const Log = model<LogDocument, LogModel>(
  DatabaseModelNames.Log,
  LogSchema
);
