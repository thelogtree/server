import {
  RouteMonitorDocument,
  RouteMonitorSnapshotDocument,
} from "logtree-types";
import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";

const RouteMonitorSnapshotSchema = new Schema(
  {
    numCalls: { type: Number, default: 0 },
    numErrors: { type: Number, default: 0 },
    routeMonitorId: {
      type: ObjectId,
      ref: DatabaseModelNames.RouteMonitor,
      required: true,
    },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
  },
  { timestamps: true }
);

RouteMonitorSnapshotSchema.index({ routeMonitorId: 1 });

interface RouteMonitorSnapshotModel
  extends Model<RouteMonitorSnapshotDocument> {}

export const RouteMonitorSnapshot = model<
  RouteMonitorSnapshotDocument,
  RouteMonitorSnapshotModel
>(DatabaseModelNames.RouteMonitorSnapshot, RouteMonitorSnapshotSchema);
