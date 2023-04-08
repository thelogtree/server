import moment from "moment";
import { FolderFactory } from "../factories/FolderFactory";
import { LogFactory } from "../factories/LogFactory";
import { StatsService, timeInterval } from "src/services/StatsService";
import { LastCheckedFolderFactory } from "../factories/LastCheckedFolderFactory";
import { UserFactory } from "../factories/UserFactory";

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

describe("GetPercentChangeInFrequencyOfMostRecentLogs", () => {
  it("correctly gets the percentage change in log frequencies by an interval of an hour", async () => {
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
      createdAt: moment().subtract(89, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(95, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(1298, "minutes").toDate(),
    });
    await LogFactory.create({
      createdAt: moment().subtract(30, "minutes").toDate(),
    });
    const change =
      await StatsService.getPercentChangeInFrequencyOfMostRecentLogs(
        folder._id.toString(),
        timeInterval.Hour,
        3
      );
    expect(change).toBe(50);
  });
  it("correctly gets the percentage change in log frequencies by an interval of an hour", async () => {
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
      createdAt: moment().subtract(89, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(95, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(95, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(95, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(95, "minutes").toDate(),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(1298, "minutes").toDate(),
    });
    await LogFactory.create({
      createdAt: moment().subtract(30, "minutes").toDate(),
    });
    const change =
      await StatsService.getPercentChangeInFrequencyOfMostRecentLogs(
        folder._id.toString(),
        timeInterval.Hour,
        3
      );
    expect(change).toBe(-14.29);
  });
});

describe("GetMostCheckedFolderPathsForUser", () => {
  it("correctly gets the most checked folder paths for user", async () => {
    const user = await UserFactory.create();
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: "/f1",
    });
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: "/f1",
    });
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: "/f2",
    });
    await LastCheckedFolderFactory.create({
      fullPath: "/f2",
    });
    await LastCheckedFolderFactory.create({
      fullPath: "/f2",
    });
    await LastCheckedFolderFactory.create({
      fullPath: "/f2",
    });
    await LastCheckedFolderFactory.create({
      fullPath: "/f2",
    });
    await LastCheckedFolderFactory.create({
      fullPath: "/f2",
    });
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: "/f3",
    });
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: "/f3",
    });
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: "/f3",
    });

    const mostCheckedFolderPaths =
      await StatsService.getMostCheckedFolderPathsForUser(
        user._id.toString(),
        ["/f1", "/f2", "/f3"],
        2
      );

    expect(mostCheckedFolderPaths.length).toBe(2);
    expect(mostCheckedFolderPaths[0]).toBe("/f3");
    expect(mostCheckedFolderPaths[1]).toBe("/f1");
  });
});
