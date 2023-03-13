import { UserDocument } from "logtree-types";
import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const UserSchema = new Schema(
  {
    email: { type: String, required: true },
    firebaseId: { type: String, required: true },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });
UserSchema.index({ firebaseId: 1 }, { unique: true });

interface UserModel extends Model<UserDocument> {}

export const User = model<UserDocument, UserModel>(
  DatabaseModelNames.User,
  UserSchema
);
