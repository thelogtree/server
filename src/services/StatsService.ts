import moment from "moment";
import { ObjectId } from "mongodb";
import { LogService } from "./ApiService/lib/LogService";
import _ from "lodash";
import { Log } from "src/models/Log";
import { Folder } from "src/models/Folder";
import { FolderDocument } from "logtree-types";

// we represent these in total minutes
export enum timeInterval {
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
};

export const StatsService = {
  timeIntervalToMoment: (interval: timeInterval) => {
    switch (interval) {
      case timeInterval.Day:
        return "days";
      case timeInterval.Hour:
        return "hours";
      case timeInterval.Week:
        return "weeks";
      default:
        return "days";
    }
  },
  getLogFrequenciesByInterval: async (
    folderId: string,
    interval: timeInterval,
    stepsBack: number
  ) => {
    const startingCeilingDate = new Date(); // we use this so there aren't time inconsistencies and race conditions with new logs coming in
    const oldestLogArr = await Log.find({ folderId })
      .sort({ createdAt: 1 })
      .limit(1);
    if (!oldestLogArr.length) {
      return [];
    }
    const oldestLogDate = oldestLogArr[0].createdAt;

    stepsBack = Math.min(
      moment().diff(oldestLogDate, StatsService.timeIntervalToMoment(interval)),
      stepsBack
    );
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
    interval: timeInterval,
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
        timeInterval.Day,
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
  getInsights: async (organizationId: string): Promise<Insight[]> => {
    const allFolders = await Folder.find({
      organizationId,
      dateOfMostRecentLog: { $exists: true },
    })
      .lean()
      .exec();

    const insights: Insight[] = await Promise.all(
      allFolders.map(async (folder) => {
        const stat = await StatsService.getRelevantStat(folder._id.toString());
        return {
          folder,
          stat,
        };
      })
    );

    return insights
      .filter((insight) => insight.stat.percentageChange)
      .sort((a, b) =>
        Math.abs(a.stat.percentageChange) <= Math.abs(b.stat.percentageChange)
          ? 1
          : -1
      );
  },
};
