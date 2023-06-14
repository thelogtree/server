import { RouteMonitorDocument } from 'logtree-types';
import { ObjectId } from 'mongodb';
import { Model, model, Schema } from 'mongoose';
import { DatabaseModelNames } from 'src/utils/databaseModelNames';

const RouteMonitorSchema = new Schema(
  {
    path: { type: String, required: true },
    numCalls: { type: Number, default: 1 },
    errorCodes: { type: Map },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
  },
  { timestamps: true }
);

RouteMonitorSchema.index({ organizationId: 1 });

interface RouteMonitorModel extends Model<RouteMonitorDocument> {}

export const RouteMonitor = model<RouteMonitorDocument, RouteMonitorModel>(
  DatabaseModelNames.RouteMonitor,
  RouteMonitorSchema
);
