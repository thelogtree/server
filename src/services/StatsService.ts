import moment from "moment-timezone";
import { LogService } from "./ApiService/lib/LogService";
import _ from "lodash";
import { Log } from "src/models/Log";
import { Folder } from "src/models/Folder";
import { FolderDocument, LogDocument } from "logtree-types";
import { LastCheckedFolder } from "src/models/LastCheckedFolder";
import { getFloorAndCeilingDatesForHistogramBox } from "src/utils/helpers";
import { MyRedis, RedisUtil } from "src/utils/redis";
import { MyLogtree } from "src/utils/logger";
import { LeanDocument } from "mongoose";

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
    const res = logFrequencyArr.filter((val) => val !== -1);
    return res;
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
  getAllLogsInFolderForVisualizations: async (
    floorDate: Date,
    ceilingDate: Date,
    folderId: string
  ) => {
    let logsResult: LogDocument[] = [];
    const lastCeilingDateRecorded = await RedisUtil.getValue(
      `folderId:${folderId}:logs:ceilingDate`
    );
    let newFloorDate = floorDate;
    if (lastCeilingDateRecorded) {
      const cachedLogsStr = await RedisUtil.getValue(
        `folderId:${folderId}:logs:response`
      );
      if (cachedLogsStr) {
        logsResult = JSON.parse(cachedLogsStr);
      }
      if (logsResult.length) {
        const lastCeilingDateRecordedConverted = new Date(
          lastCeilingDateRecorded
        );
        newFloorDate = new Date(
          Math.max(
            lastCeilingDateRecordedConverted.getTime(),
            floorDate.getTime()
          ) * 1000
        );
        logsResult = logsResult.filter(
          (log) => new Date(log.createdAt) >= floorDate
        );
      }
    }

    const nonCachedLogsInFolder = await Log.find(
      {
        folderId,
        createdAt: { $gte: newFloorDate, $lt: ceilingDate },
      },
      {
        content: 1,
        createdAt: 1,
        referenceId: 1,
        _id: 0,
      }
    )
      .lean()
      .exec();

    MyLogtree.sendDebugLog("non-cached logs: " + nonCachedLogsInFolder.length);

    logsResult = logsResult
      .concat(nonCachedLogsInFolder)
      .sort((a: LeanDocument<LogDocument>, b: LeanDocument<LogDocument>) => {
        return a.createdAt > b.createdAt ? 1 : -1;
      });

    if (moment(ceilingDate).diff(floorDate, "days") > 1) {
      RedisUtil.setValue(
        `folderId:${folderId}:logs:response`,
        JSON.stringify(logsResult)
      );
      RedisUtil.setValue(
        `folderId:${folderId}:logs:ceilingDate`,
        ceilingDate.toString()
      );
    }

    return logsResult;
  },
  getSumsOrderedArray: async (
    floorDate: Date,
    ceilingDate: Date,
    folderId: string,
    isByReferenceId: boolean
  ) => {
    // sorted in ascending order of createdAt date of the log
    const allLogsInFolder =
      await StatsService.getAllLogsInFolderForVisualizations(
        floorDate,
        ceilingDate,
        folderId
      );

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

      let numReferenceIdsAffected = 1;
      if (!isByReferenceId) {
        numReferenceIdsAffected = _.uniqBy(logArr, "referenceId").length;
      }

      if (contentKey) {
        sumArr.push({
          contentKey,
          count: logArr.length,
          numReferenceIdsAffected,
        });
      }
    });

    // order the sums in descending order
    let sumsOrderedArr = _.sortBy(sumArr, "count").reverse();

    return { sumsOrderedArr, groupedLogs };
  },
  getHistogramsForFolder: async (
    folderId: string,
    isByReferenceId: boolean = false,
    lastXDays: number = 1
  ): Promise<{
    histograms: any[];
    moreHistogramsAreNotShown: boolean;
  }> => {
    let numHistogramBoxes = lastXDays === 1 ? 24 : lastXDays;
    const ceilingDate = new Date(); // to avoid race conditions
    let floorDate = moment().subtract(lastXDays, "days").toDate();

    // sorted in ascending order of createdAt date of the log
    let sumsOrderedArrObj = await StatsService.getSumsOrderedArray(
      floorDate,
      ceilingDate,
      folderId,
      isByReferenceId
    );

    let sumsOrderedArr = sumsOrderedArrObj.sumsOrderedArr;
    let groupedLogs = sumsOrderedArrObj.groupedLogs;

    if (!sumsOrderedArr.length || sumsOrderedArr[0].count <= 1) {
      // don't return histograms for this type of data since it is likely not meant to be shown as a histogram (i.e. all the logs are unique)
      return {
        histograms: [],
        moreHistogramsAreNotShown: false,
      };
    }

    const MAX_HISTOGRAMS_RETURNED = 12;
    const histograms = sumsOrderedArr
      .slice(0, MAX_HISTOGRAMS_RETURNED)
      .map((obj) => {
        // this part is super slow, fix!!!

        const { contentKey, numReferenceIdsAffected } = obj;
        let logsWithThisContentKey = groupedLogs[contentKey];
        let histogramData: HistogramBox[] = [];
        let movingStartIndex = 0;
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

          let count = 0;
          for (
            let j = movingStartIndex;
            j < logsWithThisContentKey.length;
            j++
          ) {
            const tempLog = logsWithThisContentKey[j];
            const cleanedDateOfLog = new Date(tempLog.createdAt);
            if (
              cleanedDateOfLog >= intervalFloorDate &&
              cleanedDateOfLog < intervalCeilingDate
            ) {
              count++;
            } else {
              movingStartIndex = j;
              break;
            }
          }

          histogramData.push({
            count,
            floorDate: intervalFloorDate,
            ceilingDate: intervalCeilingDate,
          });
        }
        return {
          contentKey,
          histogramData,
          numReferenceIdsAffected,
        };
      });
    return {
      histograms,
      moreHistogramsAreNotShown:
        sumsOrderedArr.length > MAX_HISTOGRAMS_RETURNED,
    };
  },
};
