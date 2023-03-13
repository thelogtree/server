import { OrgInvitationDocument } from "logtree-types";
import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const OrgInvitationSchema = new Schema(
  {
    expiresAt: { type: Date, required: true },
    isOneTimeUse: { type: Boolean, default: true },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
  },
  { timestamps: true }
);

OrgInvitationSchema.index({ organizationId: 1 });

interface OrgInvitationModel extends Model<OrgInvitationDocument> {}

export const OrgInvitation = model<OrgInvitationDocument, OrgInvitationModel>(
  DatabaseModelNames.OrgInvitation,
  OrgInvitationSchema
);
