import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";
import { DashboardDocument, FolderDocument } from "logtree-types";

const DashboardSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
  },
  { timestamps: true }
);

DashboardSchema.index({ organizationId: 1 });

interface DashboardModel extends Model<DashboardDocument> {}

export const Dashboard = model<DashboardDocument, DashboardModel>(
  DatabaseModelNames.Dashboard,
  DashboardSchema
);
