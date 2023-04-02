import moment from "moment";
import { ObjectId } from "mongodb";
import { LogService } from "./ApiService/lib/LogService";
import _ from "lodash";

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

export const StatsService = {
  getLogFrequenciesByInterval: async (
    folderId: string,
    interval: timeInterval,
    stepsBack: number
  ) => {
    const stepsBackArr = Array(stepsBack).fill(null);
    const startingCeilingDate = new Date(); // we use this so there aren't time inconsistencies and race conditions with new logs coming in

    const logFrequencyArr = await Promise.all(
      stepsBackArr.map(async (_, index) => {
        const floorDate = moment(startingCeilingDate)
          .subtract(interval * (index + 1), "minutes")
          .toDate();
        const ceilingDate = moment(startingCeilingDate)
          .subtract(interval * index, "minutes")
          .toDate();
        return LogService.getNumLogsInFolder(ceilingDate, floorDate, folderId);
      })
    );
    return logFrequencyArr;
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
    const now = new Date();
    const fullDayAgo = moment(now).subtract(1, "day").toDate();
    const numLogsInFolderInLast24Hours = await LogService.getNumLogsInFolder(
      now,
      fullDayAgo,
      folderId
    );
    if (numLogsInFolderInLast24Hours > 50) {
      // good amount of logs recently so make the comparison in hours instead of days
      const percentageChange =
        await StatsService.getPercentChangeInFrequencyOfMostRecentLogs(
          folderId,
          timeInterval.Hour,
          48
        );
      if (!percentageChange) {
        return { percentageChange: 0, timeInterval: "hour" };
      }
      return {
        percentageChange,
        timeInterval: "hour",
      };
    }

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
};
