import { Folder } from "src/models/Folder";
import { Log } from "src/models/Log";
import { OrganizationFactory } from "src/tests/factories/OrganizationFactory";

import { TestHelper } from "../../TestHelper";

const routeUrl = "/v1/logs";

describe("CreateLog", () => {
  beforeEach(async () => {
    await Log.deleteMany();
    await Folder.deleteMany();
  });
  it("correctly creates a log under one folder", async () => {
    const logContent = "test 123";
    const folderName = "transactions";
    const organization = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl,
      "POST",
      {
        content: logContent,
        folderPath: `/${folderName}`,
      },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const folder = await Folder.findOne({
      name: folderName,
      parentFolderId: null,
      organizationId: organization._id,
    });
    expect(folder).toBeTruthy();

    const allFoldersInOrgNum = await Folder.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allFoldersInOrgNum).toBe(1);

    const logCreatedInsideFolder = await Log.findOne({
      content: logContent,
      folderId: folder!._id,
      organizationId: organization._id,
    });
    expect(logCreatedInsideFolder).toBeTruthy();

    const allLogsInOrg = await Log.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allLogsInOrg).toBe(1);
  });
});
