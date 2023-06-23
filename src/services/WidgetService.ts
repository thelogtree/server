import {
  FolderType,
  PositionType,
  SizeType,
  WidgetDocument,
  widgetTimeframe,
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
import { IFramelyUtil } from "src/utils/iframely";

export const WidgetService = {
  createWidget: async (
    organizationId: string,
    dashboardId: string,
    title: string,
    type: widgetType,
    folderPaths: FolderType[],
    position: PositionType,
    size: SizeType,
    query?: string,
    timeframe?: widgetTimeframe,
    url?: string
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
      timeframe,
      url,
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
    position?: PositionType,
    size?: SizeType,
    title?: string
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
      case widgetType.PieChartByContent:
        return await WidgetLoader.loadPieChartByContent(widget);
      case widgetType.HealthMonitor:
        return await WidgetLoader.loadGraph(widget);
      case widgetType.HistogramComparison:
        return await WidgetLoader.loadGraph(widget);
      case widgetType.EmbeddedLink:
        return await IFramelyUtil.getSiteInfo(widget.url!);
      default:
        return {};
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
    let floorDate = moment(ceilingDate).subtract(1, "day").toDate();
    let numBoxes = 24;
    if (widget.timeframe === widgetTimeframe.ThirtyDays) {
      floorDate = moment(ceilingDate).subtract(30, "days").toDate();
      numBoxes = 30;
    }

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

    let logs: any[] = [];
    if (widget.query) {
      logs = await LogService.searchForLogs(
        widget.organizationId.toString(),
        widget.query,
        folder._id.toString()
      );
    } else {
      logs = await LogService.getLogs(folder._id.toString());
    }

    return logs;
  },
  loadPieChartByContent: async (widget: WidgetDocument) => {
    const ceilingDate = new Date();
    let floorDate = moment(ceilingDate).subtract(1, "day").toDate();
    let numBoxes = 24;
    if (widget.timeframe === widgetTimeframe.ThirtyDays) {
      floorDate = moment(ceilingDate).subtract(30, "days").toDate();
      numBoxes = 30;
    }

    const foldersGroupedByFullPath = await _loadFoldersGroupedByFullPath(
      widget
    );
    const firstFolderPathObj = widget.folderPaths[0];
    const firstFolderPath = firstFolderPathObj.fullPath;
    const folder = foldersGroupedByFullPath[firstFolderPath];

    if (!folder) {
      return [];
    }

    const allLogsInTimeframe = await Log.find(
      {
        folderId: folder._id,
        createdAt: { $gte: floorDate, $lt: ceilingDate },
      },
      { content: 1 }
    )
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    const groupedLogsByContent = _.groupBy(allLogsInTimeframe, "content");

    const graphData = Object.keys(groupedLogsByContent)
      .map((content) => ({
        name: content,
        value: groupedLogsByContent[content].length,
      }))
      .sort((a, b) => (a.value > b.value ? -1 : 1));

    // consolidate the less frequent content into one "Other" category
    const OTHER_CUTOFF = 10;
    const otherData = {
      name: "Other",
      value: _.sumBy(graphData.slice(OTHER_CUTOFF), "value"),
    };
    const cleanedGraphData = graphData
      .slice(0, OTHER_CUTOFF)
      .concat([otherData]);

    let suffix = allLogsInTimeframe.length === 1 ? "event" : "events";
    if (firstFolderPathObj.overrideEventName) {
      suffix = firstFolderPathObj.overrideEventName;
    }

    return {
      graphData: cleanedGraphData,
      numLogsTotal: allLogsInTimeframe.length,
      ...firstFolderPathObj,
      suffix,
    };
  },
};
