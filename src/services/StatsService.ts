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
    const averageOfOtherChunks = _.round(
      sumOfOtherChunks / (logs.length - 1),
      2
    );
    const diff = _.round(mostRecentChunk - averageOfOtherChunks, 2);
    return _.round(100.0 * (diff / averageOfOtherChunks), 2);
  },
};
