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
};
