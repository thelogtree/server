import {
  FolderType,
  PositionType,
  SizeType,
  WidgetDocument,
  widgetType,
} from "logtree-types";
import { Dashboard } from "src/models/Dashboard";
import { Folder } from "src/models/Folder";
import { Log } from "src/models/Log";
import { Widget } from "src/models/Widget";
import { ApiError } from "src/utils/errors";
import _ from "lodash";
import moment from "moment";
import { StatsService } from "./StatsService";
import { LeanDocument } from "mongoose";
import { LogService } from "./ApiService/lib/LogService";

type LoadedWidget = {
  widget: LeanDocument<WidgetDocument>;
  data: any;
};

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
  updateWidget: async (
    organizationId: string,
    widgetId: string,
    position: PositionType,
    size: SizeType,
    title: string
  ) => {
    const widgetBelongsToOrg = await Widget.exists({
      _id: widgetId,
      organizationId,
    });
    if (!widgetBelongsToOrg) {
      throw new ApiError("No widget with this ID exists in your organization.");
    }

    return await Widget.findByIdAndUpdate(
      widgetId,
      {
        position,
        size,
        title,
      },
      { new: true }
    );
  },
  getWidgets: async (organizationId: string, dashboardId: string) =>
    await Widget.find({ organizationId, dashboardId }).lean().exec(),
  loadWidget: async (
    organizationId: string,
    widgetId: string
  ): Promise<any> => {
    const widget = await Widget.findOne({
      organizationId,
      _id: widgetId,
    })
      .lean()
      .exec();
    if (!widget) {
      throw new ApiError("No widget with this ID exists in this organization.");
    }

    // load the widget content here
    switch (widget.type) {
      case widgetType.Histograms:
        return await WidgetLoader.loadGraph(widget);
      case widgetType.Logs:
        return await WidgetLoader.loadLogs(widget);
    }
  },
};

const _loadFoldersGroupedByFullPath = async (widget: WidgetDocument) => {
  const folders = await Folder.find(
    {
      organizationId: widget.organizationId,
      fullPath: {
        $in: widget.folderPaths.map((folderPath) => folderPath.fullPath),
      },
    },
    { _id: 1, fullPath: 1 }
  )
    .lean()
    .exec();
  const foldersGroupedByFullPath = _.keyBy(folders, "fullPath");

  return foldersGroupedByFullPath;
};

const WidgetLoader = {
  loadGraph: async (widget: WidgetDocument) => {
    const ceilingDate = new Date();
    const floorDate = moment(ceilingDate).subtract(1, "day").toDate();
    const numBoxes = 24;

    const foldersGroupedByFullPath = await _loadFoldersGroupedByFullPath(
      widget
    );

    const graphs = await Promise.all(
      widget.folderPaths.map(async (folderPath: FolderType) => {
        const folder = foldersGroupedByFullPath[folderPath.fullPath];
        if (!folder) {
          return {
            graphData: [],
            numLogsTotal: 0,
            ...folderPath,
          };
        }
        const allLogsInTimeframe = await Log.find(
          {
            folderId: folder._id,
            createdAt: { $gte: floorDate, $lt: ceilingDate },
          },
          { createdAt: 1 }
        )
          .sort({ createdAt: 1 })
          .lean()
          .exec();

        const graphData = StatsService.generateDataGrouping(
          allLogsInTimeframe,
          floorDate,
          ceilingDate,
          numBoxes
        );

        const numLogsTotal = allLogsInTimeframe.length;

        return {
          graphData,
          numLogsTotal,
          ...folderPath,
        };
      })
    );

    const graphsHydrated = graphs.map((graphObj) => {
      let suffix = graphObj.numLogsTotal === 1 ? "event" : "events";
      if (graphObj.overrideEventName) {
        suffix = graphObj.overrideEventName;
      }

      return {
        ...graphObj,
        suffix,
      };
    });

    return graphsHydrated;
  },
  loadLogs: async (widget: WidgetDocument) => {
    const foldersGroupedByFullPath = await _loadFoldersGroupedByFullPath(
      widget
    );

    const firstFolderPath = widget.folderPaths[0]?.fullPath;
    const folder = foldersGroupedByFullPath[firstFolderPath];
    if (!firstFolderPath || !folder) {
      return [];
    }

    const logs = await LogService.getLogs(folder._id.toString());
    return logs;
  },
};
