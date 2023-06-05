import moment from "moment-timezone";
import { LogService } from "./ApiService/lib/LogService";
import _ from "lodash";
import { Log } from "src/models/Log";
import { Folder } from "src/models/Folder";
import { FolderDocument } from "logtree-types";
import { LastCheckedFolder } from "src/models/LastCheckedFolder";
import { getFloorAndCeilingDatesForHistogramBox } from "src/utils/helpers";

// we represent these in total minutes
export enum timeIntervalEnum {
  Hour = 60,
  Day = 1440,
  Week = 10080,
}

type RelevantStat = {
  percentageChange: number;
  timeInterval: "hour" | "day";
};

type Insight = {
  folder: FolderDocument;
  stat: RelevantStat;
  numLogsToday: number;
};

type HistogramBox = {
  count: number;
  floorDate: Date;
  ceilingDate: Date;
};

export const StatsService = {
  timeIntervalToMoment: (interval: timeIntervalEnum) => {
    switch (interval) {
      case timeIntervalEnum.Day:
        return "days";
      case timeIntervalEnum.Hour:
        return "hours";
      case timeIntervalEnum.Week:
        return "weeks";
      default:
        return "days";
    }
  },
  getLogFrequenciesByInterval: async (
    folderId: string,
    interval: timeIntervalEnum | number,
    stepsBack: number,
    ignoreTimeCleaner?: boolean
  ) => {
    const startingCeilingDate = new Date(); // we use this so there aren't time inconsistencies and race conditions with new logs coming in
    const oldestLogArr = await Log.find({ folderId })
      .sort({ createdAt: 1 })
      .limit(1);
    if (!oldestLogArr.length) {
      return [];
    }
    const oldestLogDate = oldestLogArr[0].createdAt;

    if (!ignoreTimeCleaner) {
      stepsBack = Math.min(
        moment().diff(
          oldestLogDate,
          StatsService.timeIntervalToMoment(interval)
        ),
        stepsBack
      );
    }

    const stepsBackArr = Array(stepsBack).fill(null);

    const logFrequencyArr = await Promise.all(
      stepsBackArr.map(async (_, index) => {
        const floorDate = moment(startingCeilingDate)
          .subtract(interval * (index + 1), "minutes")
          .toDate();
        const ceilingDate = moment(startingCeilingDate)
          .subtract(interval * index, "minutes")
          .toDate();
        if (moment(ceilingDate).isBefore(moment(oldestLogDate))) {
          return -1;
        }
        return LogService.getNumLogsInFolder(ceilingDate, floorDate, folderId);
      })
    );

    // filter out the values that went beyond the existence of the first log
    return logFrequencyArr.filter((val) => val !== -1);
  },
  getPercentChangeInFrequencyOfMostRecentLogs: async (
    folderId: string,
    interval: timeIntervalEnum,
    stepsBack: number
  ) => {
    const logs = await StatsService.getLogFrequenciesByInterval(
      folderId,
      interval,
      stepsBack
    );

    if (logs.length <= 1) {
      return 0;
    }

    const mostRecentChunk = logs[0];
    const sumOfOtherChunks = _.sum(logs.slice(1));
    if (!sumOfOtherChunks) {
      return 0; // just so we can avoid dividing by 0
    }
    const averageOfOtherChunks = _.round(
      sumOfOtherChunks / (logs.length - 1),
      2
    );
    const diff = _.round(mostRecentChunk - averageOfOtherChunks, 2);
    return _.round(100.0 * (diff / averageOfOtherChunks), 2);
  },
  getRelevantStat: async (folderId: string): Promise<RelevantStat> => {
    const percentageChange = _.round(
      await StatsService.getPercentChangeInFrequencyOfMostRecentLogs(
        folderId,
        timeIntervalEnum.Day,
        30
      ),
      0
    );

    if (!percentageChange) {
      return { percentageChange: 0, timeInterval: "day" };
    }

    return {
      percentageChange,
      timeInterval: "day",
    };
  },
  getInsights: async (
    organizationId: string,
    userId: string,
    timezone: string
  ): Promise<{
    insightsOfMostCheckedFolders: Insight[];
    insightsOfNotMostCheckedFolders: Insight[];
  }> => {
    const allFolders = (await Folder.find({
      organizationId,
      dateOfMostRecentLog: { $exists: true },
    })
      .lean()
      .exec()) as FolderDocument[];

    const insights: Insight[] = await Promise.all(
      allFolders.map(async (folder) => {
        const stat = await StatsService.getRelevantStat(folder._id.toString());
        const numLogsToday = await StatsService.getNumLogsInTimePeriod(
          folder._id.toString() as string,
          moment
            .tz(timezone as string)
            .startOf("day")
            .toDate(),
          moment
            .tz(timezone as string)
            .endOf("day")
            .toDate()
        );

        return {
          folder,
          stat,
          numLogsToday,
        };
      })
    );

    const filteredInsights = insights.filter(
      (insight) => insight.stat.percentageChange
    );

    let fullPathFolders = filteredInsights.map(
      (insight) => insight.folder.fullPath
    );
    const mostCheckedFolderPaths =
      await StatsService.getMostCheckedFolderPathsForUser(
        userId,
        fullPathFolders,
        5,
        moment().subtract(2, "months").toDate()
      );

    const insightsOfMostCheckedFolders = filteredInsights.filter((insight) =>
      mostCheckedFolderPaths.includes(insight.folder.fullPath)
    );
    const insightsOfNotMostCheckedFolders = filteredInsights
      .filter(
        (insight) => !mostCheckedFolderPaths.includes(insight.folder.fullPath)
      )
      .sort((a, b) =>
        Math.abs(a.stat.percentageChange) <= Math.abs(b.stat.percentageChange)
          ? 1
          : -1
      );

    return { insightsOfMostCheckedFolders, insightsOfNotMostCheckedFolders };
  },
  getMostCheckedFolderPathsForUser: async (
    userId: string,
    fullPaths: string[],
    topX: number,
    floorDate?: Date
  ): Promise<string[]> => {
    const checkedFolders = await LastCheckedFolder.find(
      {
        userId,
        fullPath: { $in: fullPaths },
        ...(floorDate && { createdAt: { $gte: floorDate } }),
      },
      { fullPath: 1, _id: 0 }
    )
      .lean()
      .exec();
    const groupedCheckedFolders = _.groupBy(checkedFolders, "fullPath");

    let results: { count: number; fullPath: string }[] = [];
    Object.keys(groupedCheckedFolders).forEach((fullPath) => {
      const count = groupedCheckedFolders[fullPath].length;
      results.push({ fullPath, count });
    });

    const sortedTopX = results
      .sort((a, b) => (a.count <= b.count ? 1 : -1))
      .slice(0, topX);
    return sortedTopX.map((val) => val.fullPath);
  },
  getNumLogsInTimePeriod: (
    folderId: string,
    floorDate: Date,
    ceilingDate: Date
  ) =>
    Log.countDocuments({
      folderId,
      createdAt: { $gte: floorDate, $lt: ceilingDate },
    }),
  getSumsOrderedArray: async (
    floorDate: Date,
    ceilingDate: Date,
    folderId: string,
    isByReferenceId: boolean
  ) => {
    const allLogsInFolder = await Log.find(
      {
        folderId,
        createdAt: { $gte: floorDate, $lt: ceilingDate },
      },
      {
        content: 1,
        createdAt: 1,
        _id: 0,
        ...(isByReferenceId && { referenceId: 1 }),
      }
    )
      .lean()
      .exec();

    const groupedLogs = _.groupBy(
      allLogsInFolder,
      isByReferenceId ? "referenceId" : "content"
    );

    // put their sums in a map
    let sumArr: any[] = [];
    Object.values(groupedLogs).forEach((logArr) => {
      const contentKey = isByReferenceId
        ? logArr[0].referenceId
        : logArr[0].content;
      sumArr.push({ contentKey, count: logArr.length });
    });

    // order the sums in descending order
    let sumsOrderedArr = _.sortBy(sumArr, "count").reverse();

    return { sumsOrderedArr, groupedLogs };
  },
  getHistogramsForFolder: async (
    folderId: string,
    isByReferenceId: boolean = false
  ): Promise<{
    histograms: any[];
    moreHistogramsAreNotShown: boolean;
  }> => {
    let numHistogramBoxes = 24;
    const ceilingDate = new Date(); // to avoid race conditions
    let floorDate = moment().subtract(1, "day").toDate();

    // first try the 24-hour timeframe
    let sumsOrderedArrObj = await StatsService.getSumsOrderedArray(
      floorDate,
      ceilingDate,
      folderId,
      isByReferenceId
    );
    let sumsOrderedArr = sumsOrderedArrObj.sumsOrderedArr;
    let groupedLogs = sumsOrderedArrObj.groupedLogs;

    // if the 24-hour timeframe yields no good results, try a 30 day timeframe
    if (sumsOrderedArr.length <= 1) {
      numHistogramBoxes = 30;
      floorDate = moment().subtract(30, "days").toDate();
      sumsOrderedArrObj = await StatsService.getSumsOrderedArray(
        floorDate,
        ceilingDate,
        folderId,
        isByReferenceId
      );
      sumsOrderedArr = sumsOrderedArrObj.sumsOrderedArr;
      groupedLogs = sumsOrderedArrObj.groupedLogs;
    }

    if (sumsOrderedArr.length <= 1 || sumsOrderedArr[1].count <= 2) {
      // don't return histograms for this type of data since it is likely not meant to be shown as a histogram (i.e. all the logs are unique)
      return {
        histograms: [],
        moreHistogramsAreNotShown: false,
      };
    }

    const MAX_HISTOGRAMS_RETURNED = 20;

    const histograms = sumsOrderedArr
      .slice(0, MAX_HISTOGRAMS_RETURNED)
      .map((obj) => {
        const { contentKey } = obj;
        const logsWithThisContentKey = groupedLogs[contentKey];
        let histogramData: HistogramBox[] = [];
        for (let i = 0; i < numHistogramBoxes; i++) {
          const {
            floorDate: intervalFloorDate,
            ceilingDate: intervalCeilingDate,
          } = getFloorAndCeilingDatesForHistogramBox(
            floorDate,
            ceilingDate,
            numHistogramBoxes,
            i
          );
          const numLogsInTimeframe = _.sumBy(logsWithThisContentKey, (log) =>
            moment(log.createdAt).isSameOrAfter(moment(intervalFloorDate)) &&
            moment(log.createdAt).isBefore(moment(intervalCeilingDate))
              ? 1
              : 0
          );
          histogramData.push({
            count: numLogsInTimeframe,
            floorDate: intervalFloorDate,
            ceilingDate: intervalCeilingDate,
          });
        }
        return {
          contentKey,
          histogramData,
        };
      });

    return {
      histograms,
      moreHistogramsAreNotShown:
        sumsOrderedArr.length > MAX_HISTOGRAMS_RETURNED,
    };
  },
};
