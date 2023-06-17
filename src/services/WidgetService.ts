import { FolderType, PositionType, SizeType, widgetType } from "logtree-types";
import { Dashboard } from "src/models/Dashboard";
import { Widget } from "src/models/Widget";
import { ApiError } from "src/utils/errors";

export const WidgetService = {
  createWidget: async (
    organizationId: string,
    dashboardId: string,
    title: string,
    type: widgetType,
    folderPaths: FolderType[],
    position: PositionType,
    size: SizeType,
    query?: string
  ) => {
    const dashboardBelongsToOrg = await Dashboard.exists({
      organizationId,
      _id: dashboardId,
    });
    if (!dashboardBelongsToOrg) {
      throw new ApiError(
        "You can only create a widget for your own organization."
      );
    }
    return await Widget.create({
      organizationId,
      dashboardId,
      title,
      type,
      folderPaths,
      position,
      size,
      query,
    });
  },
  deleteWidget: async (organizationId: string, widgetId: string) => {
    const widgetExistsUnderOrg = await Widget.exists({
      _id: widgetId,
      organizationId,
    });
    if (!widgetExistsUnderOrg) {
      throw new ApiError("No widget with this ID exists in your organization.");
    }

    await Widget.deleteOne({ _id: widgetId });
  },
};
