import moment from "moment";
import { ObjectId } from "mongodb";
import { LogService } from "./ApiService/lib/LogService";
import _ from "lodash";
import { Log } from "src/models/Log";

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
    const oldestLogArr = await Log.find({ folderId })
      .sort({ createdAt: 1 })
      .limit(1);
    if (!oldestLogArr.length) {
      return [];
    }
    const oldestLogDate = oldestLogArr[0].createdAt;

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
    const now = new Date();
    const fullDayAgo = moment(now).subtract(1, "day").toDate();
    const twoDaysAgo = moment(now).subtract(2, "days").toDate();
    const numLogsInFolderInLast24Hours = await LogService.getNumLogsInFolder(
      now,
      fullDayAgo,
      folderId
    );
    const numLogsInFolderInLast24To48Hours =
      await LogService.getNumLogsInFolder(fullDayAgo, twoDaysAgo, folderId);
    const difference =
      numLogsInFolderInLast24To48Hours - numLogsInFolderInLast24Hours;

    // don't show hourly changes for now //

    // if (difference > 100 && numLogsInFolderInLast24To48Hours < 50) {
    //   // good amount of logs recently so make the comparison in hours instead of days
    //   const percentageChange =
    //     await StatsService.getPercentChangeInFrequencyOfMostRecentLogs(
    //       folderId,
    //       timeInterval.Hour,
    //       48
    //     );
    //   if (!percentageChange) {
    //     return { percentageChange: 0, timeInterval: "hour" };
    //   }
    //   return {
    //     percentageChange,
    //     timeInterval: "hour",
    //   };
    // }

    let hasOldEnoughData = false;
    const oldestLogArr = await Log.find({ folderId })
      .sort({ createdAt: 1 })
      .limit(1);
    if (
      oldestLogArr.length &&
      moment().diff(oldestLogArr[0].createdAt, "days") >= 2
    ) {
      hasOldEnoughData = true;
    }

    const percentageChange = hasOldEnoughData
      ? _.round(
          await StatsService.getPercentChangeInFrequencyOfMostRecentLogs(
            folderId,
            timeInterval.Day,
            Math.min(30, moment().diff(oldestLogArr[0].createdAt, "days")) // helps with accurate calculations
          ),
          0
        )
      : 0;
    if (!percentageChange) {
      return { percentageChange: 0, timeInterval: "day" };
    }
    return {
      percentageChange,
      timeInterval: "day",
    };
  },
};
