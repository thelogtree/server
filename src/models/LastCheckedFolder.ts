import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";
import { LastCheckedFolderDocument } from "logtree-types";

const LastCheckedFolderSchema = new Schema(
  {
    fullPath: { type: String, default: "", trim: true }, // empty if favorites channel
    userId: {
      type: ObjectId,
      ref: DatabaseModelNames.User,
      required: true,
    },
  },
  { timestamps: true }
);

LastCheckedFolderSchema.index({ userId: 1 });

interface LastCheckedFolderModel extends Model<LastCheckedFolderDocument> {}

export const LastCheckedFolder = model<
  LastCheckedFolderDocument,
  LastCheckedFolderModel
>(DatabaseModelNames.LastCheckedFolder, LastCheckedFolderSchema);
