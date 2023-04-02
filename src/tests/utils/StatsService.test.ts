import moment from "moment";
import { FolderFactory } from "../factories/FolderFactory";
import { LogFactory } from "../factories/LogFactory";
import { StatsService, timeInterval } from "src/services/StatsService";

describe("GetLogFrequenciesByInterval", () => {
  it("correctly gets the log frequencies by an interval of an hour", async () => {
    const folder = await FolderFactory.create();
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(5, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(42, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(56, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(65, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(88, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(1298, "minutes").toDate(),
    });
    await LogFactory.create({
      createdAt: moment().subtract(30, "minutes").toDate(),
    });
    const frequencyArr = await StatsService.getLogFrequenciesByInterval(
      folder._id.toString(),
      timeInterval.Hour,
      3
    );
    expect(frequencyArr.length).toBe(3);
    expect(frequencyArr[0]).toBe(3);
    expect(frequencyArr[1]).toBe(2);
    expect(frequencyArr[2]).toBe(0);
  });
});
