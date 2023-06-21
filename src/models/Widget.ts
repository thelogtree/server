import { ObjectId } from "mongodb";
import { Model, model, Schema } from "mongoose";
import { DatabaseModelNames } from "src/utils/databaseModelNames";
import { WidgetDocument, widgetTimeframe, widgetType } from "logtree-types";

const FolderPathSchema = new Schema(
  {
    fullPath: { type: String, required: true, trim: true },
    overrideEventName: { type: String, default: null, trim: true },
  },
  { timestamps: false, _id: false }
);

const PositionSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { timestamps: false, _id: false }
);

const SizeSchema = new Schema(
  {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { timestamps: false, _id: false }
);

const WidgetSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    organizationId: {
      type: ObjectId,
      ref: DatabaseModelNames.Organization,
      required: true,
    },
    dashboardId: {
      type: ObjectId,
      ref: DatabaseModelNames.Dashboard,
      required: true,
    },
    type: { type: String, enum: widgetType, required: true },
    folderPaths: { type: [FolderPathSchema], required: true },
    query: { type: String, trim: true },
    position: { type: PositionSchema, required: true },
    size: { type: SizeSchema, required: true },
    timeframe: { type: String, enum: widgetTimeframe, required: false },
  },
  { timestamps: true }
);

WidgetSchema.index({ dashboardId: 1 });

interface WidgetModel extends Model<WidgetDocument> {}

export const Widget = model<WidgetDocument, WidgetModel>(
  DatabaseModelNames.Widget,
  WidgetSchema
);
