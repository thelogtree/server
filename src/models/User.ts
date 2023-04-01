import { orgPermissionLevel, UserDocument } from "logtree-types";
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
    invitationId: {
      type: ObjectId,
      ref: DatabaseModelNames.OrgInvitation,
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    orgPermissionLevel: {
      type: String,
      enum: orgPermissionLevel,
      default: orgPermissionLevel.Member,
    },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ firebaseId: 1 }, { unique: true });
UserSchema.index({ organizationId: 1, invitationId: 1 });
UserSchema.index({ invitationId: 1 }, { unique: true });

interface UserModel extends Model<UserDocument> {}

export const User = model<UserDocument, UserModel>(
  DatabaseModelNames.User,
  UserSchema
);
