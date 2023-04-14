import moment from "moment";
import { ObjectId } from "mongodb";
import { LogService } from "./ApiService/lib/LogService";
import _ from "lodash";
import { Log } from "src/models/Log";
import { Folder } from "src/models/Folder";
import { FolderDocument } from "logtree-types";
import { LastCheckedFolder } from "src/models/LastCheckedFolder";

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
    const allFolders = await Folder.find({
      organizationId,
      dateOfMostRecentLog: { $exists: true },
    })
      .lean()
      .exec();

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
};
