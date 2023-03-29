import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";
import { FavoriteFolderDocument } from "logtree-types";

const FavoriteFolderSchema = new Schema(
  {
    fullPath: { type: String, required: true, trim: true },
    userId: {
      type: ObjectId,
      ref: DatabaseModelNames.User,
      required: true,
    },
  },
  { timestamps: true }
);

FavoriteFolderSchema.index({ userId: 1 });

interface FavoriteFolderModel extends Model<FavoriteFolderDocument> {}

export const Folder = model<FavoriteFolderDocument, FavoriteFolderModel>(
  DatabaseModelNames.FavoriteFolder,
  FavoriteFolderSchema
);
