import { Folder } from "src/models/Folder";
import { Log } from "src/models/Log";
import { OrganizationFactory } from "src/tests/factories/OrganizationFactory";

import { TestHelper } from "../../TestHelper";
import { FolderFactory } from "src/tests/factories/FolderFactory";
import { LogFactory } from "src/tests/factories/LogFactory";
import { MAX_NUM_CHARS_ALLOWED_IN_LOG } from "src/services/ApiService/lib/LogService";
import { PricingService } from "src/services/ApiService/lib/PricingService";
import { Organization } from "src/models/Organization";

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
  it("correctly creates a log with a referenceId", async () => {
    const logContent = "test 123";
    const folderName = "transactions";
    const referenceId = "abc";
    const organization = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl,
      "POST",
      {
        content: logContent,
        folderPath: `/${folderName}`,
        referenceId,
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
    expect(logCreatedInsideFolder?.referenceId).toBe(referenceId);

    const allLogsInOrg = await Log.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allLogsInOrg).toBe(1);
  });
  it("correctly creates a log under multiple folders", async () => {
    const logContent = "test 123";
    const folder1Name = "transactions";
    const folder2Name = "suspicious";
    const folder3Name = "likely-fraud";
    const organization = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl,
      "POST",
      {
        content: logContent,
        folderPath: `/${folder1Name}/${folder2Name}/${folder3Name}`,
      },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const folder1 = await Folder.findOne({
      name: folder1Name,
      parentFolderId: null,
      organizationId: organization._id,
    });
    expect(folder1).toBeTruthy();
    expect(folder1!.fullPath).toBe(`/${folder1Name}`);
    const folder2 = await Folder.findOne({
      name: folder2Name,
      parentFolderId: folder1!._id,
      organizationId: organization._id,
    });
    expect(folder2).toBeTruthy();
    expect(folder2!.fullPath).toBe(`/${folder1Name}/${folder2Name}`);
    const folder3 = await Folder.findOne({
      name: folder3Name,
      parentFolderId: folder2!._id,
      organizationId: organization._id,
    });
    expect(folder3).toBeTruthy();
    expect(folder3!.fullPath).toBe(
      `/${folder1Name}/${folder2Name}/${folder3Name}`
    );

    const allFoldersInOrgNum = await Folder.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allFoldersInOrgNum).toBe(3);

    const logCreatedInsideFolder = await Log.findOne({
      content: logContent,
      folderId: folder3!._id,
      organizationId: organization._id,
    });
    expect(logCreatedInsideFolder).toBeTruthy();

    const allLogsInOrg = await Log.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allLogsInOrg).toBe(1);
  });
  it("correctly creates a log under a folder that already exists", async () => {
    const logContent = "test 123";
    const organization = await OrganizationFactory.create();
    const existingFolder = await FolderFactory.create({
      name: "transactions",
      parentFolderId: null,
      organizationId: organization._id,
    });
    await LogFactory.create({
      content: "abc",
      folderId: existingFolder._id,
      organizationId: organization._id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl,
      "POST",
      {
        content: logContent,
        folderPath: `/${existingFolder.name}`,
      },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const folder = await Folder.findOne({
      name: existingFolder.name,
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
    expect(allLogsInOrg).toBe(2);
  });
  it("fails because we're trying to open up a subfolder inside a folder that already has at least 1 log", async () => {
    const logContent = "test 123";
    const organization = await OrganizationFactory.create();
    const existingFolder = await FolderFactory.create({
      name: "transactions",
      parentFolderId: null,
      organizationId: organization._id,
    });
    const existingLog = await LogFactory.create({
      content: "abc",
      folderId: existingFolder._id,
      organizationId: organization._id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl,
      "POST",
      {
        content: logContent,
        folderPath: `/${existingFolder.name}/fraud`,
      },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectError(
      res,
      "You cannot create subfolders inside of a folder that already has at least 1 log."
    );

    const folder = await Folder.findOne({
      name: existingFolder.name,
      parentFolderId: null,
      organizationId: organization._id,
    });
    expect(folder).toBeTruthy();

    const allFoldersInOrgNum = await Folder.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allFoldersInOrgNum).toBe(1);

    const existingLogInsideFolder = await Log.findById(existingLog._id);
    expect(existingLogInsideFolder).toBeTruthy();

    const allLogsInOrg = await Log.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allLogsInOrg).toBe(1);
  });
  it("fails because the folder path doesn't pass validation (has spaces)", async () => {
    const logContent = "test 123";
    const folderPath = "/transactions/maybe fraud";
    const organization = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl,
      "POST",
      {
        content: logContent,
        folderPath,
      },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectError(res, "Your folderPath cannot include any spaces.");

    const allFoldersInOrgNum = await Folder.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allFoldersInOrgNum).toBe(0);

    const allLogsInOrg = await Log.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allLogsInOrg).toBe(0);
  });
  it("fails because the folder path doesn't pass validation (doesn't start with a slash)", async () => {
    const logContent = "test 123";
    const folderPath = "transactions/maybe-fraud";
    const organization = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl,
      "POST",
      {
        content: logContent,
        folderPath,
      },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectError(res, "Your folderPath must begin with a /");

    const allFoldersInOrgNum = await Folder.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allFoldersInOrgNum).toBe(0);

    const allLogsInOrg = await Log.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allLogsInOrg).toBe(0);
  });
  it("fails because the folder path doesn't pass validation (is only a slash)", async () => {
    const logContent = "test 123";
    const folderPath = "/";
    const organization = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl,
      "POST",
      {
        content: logContent,
        folderPath,
      },
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectError(
      res,
      "Please provide a valid folderPath string (e.g. /transactions)."
    );

    const allFoldersInOrgNum = await Folder.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allFoldersInOrgNum).toBe(0);

    const allLogsInOrg = await Log.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allLogsInOrg).toBe(0);
  });
  it("cuts off log content because it's too long", async () => {
    const logContent =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
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
      content: logContent.substring(0, MAX_NUM_CHARS_ALLOWED_IN_LOG) + "...",
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

describe("PricingService.chargeForLog", () => {
  it("correctly charges the organization from their credit", async () => {
    const org = await OrganizationFactory.create({
      currentCredits: 20,
      currentCharges: 0,
    });
    await PricingService.chargeForLog(org);
    const updatedOrg = await Organization.findById(org._id);
    expect(updatedOrg?.currentCredits).toBe(19.999);
    expect(updatedOrg?.currentCharges).toBe(0);
  });
  it("correctly charges an organization that doesn't have credit", async () => {
    const org = await OrganizationFactory.create({
      currentCredits: 0,
      currentCharges: 0,
    });
    await PricingService.chargeForLog(org);
    const updatedOrg = await Organization.findById(org._id);
    expect(updatedOrg?.currentCredits).toBe(0);
    expect(updatedOrg?.currentCharges).toBe(0.001);
  });
});

describe("GetLogs", () => {
  it("correctly gets the recent logs for an organization", async () => {
    const organization = await OrganizationFactory.create();
    const folder1 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const folder2 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      folderId: folder1._id,
      organizationId: organization._id,
    });
    const log2 = await LogFactory.create({
      folderId: folder1._id,
      organizationId: organization._id,
    });
    const log3 = await LogFactory.create({
      folderId: folder2._id,
      organizationId: organization._id,
    });
    await LogFactory.create(); // decoy
    const res = await TestHelper.sendRequest(
      routeUrl,
      "GET",
      {},
      {},
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const logs = res.body;
    expect(logs.length).toBe(3);
    expect(logs[0]._id.toString()).toBe(log3.id);
    expect(logs[0].id).toBe(log3.id);
    expect(logs[1]._id.toString()).toBe(log2.id);
    expect(logs[2]._id.toString()).toBe(log1.id);
  });
  it("correctly gets the recent logs in a specific folder for an organization", async () => {
    const organization = await OrganizationFactory.create();
    const folder1 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const folder2 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      folderId: folder1._id,
      organizationId: organization._id,
    });
    const log2 = await LogFactory.create({
      folderId: folder1._id,
      organizationId: organization._id,
    });
    await LogFactory.create({
      folderId: folder2._id,
      organizationId: organization._id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl,
      "GET",
      {},
      { folderPath: folder1.fullPath },
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const logs = res.body;
    expect(logs.length).toBe(2);
    expect(logs[0]._id.toString()).toBe(log2.id);
    expect(logs[1]._id.toString()).toBe(log1.id);
  });
  it("correctly gets the recent logs in a specific folder with a specific reference ID for an organization", async () => {
    const organization = await OrganizationFactory.create();
    const folder1 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const folder2 = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      folderId: folder1._id,
      referenceId: "b",
      organizationId: organization._id,
    });
    await LogFactory.create({
      folderId: folder1._id,
      referenceId: "c",
      organizationId: organization._id,
    });
    await LogFactory.create({ folderId: folder2._id, referenceId: "a" });
    const res = await TestHelper.sendRequest(
      routeUrl,
      "GET",
      {},
      { folderPath: folder1.fullPath, referenceId: "b" },
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectSuccess(res);

    const logs = res.body;
    expect(logs.length).toBe(1);
    expect(logs[0]._id.toString()).toBe(log1.id);
  });
  it("fails because the folder was not found in the organization", async () => {
    const organization = await OrganizationFactory.create();
    const folder1 = await FolderFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl,
      "GET",
      {},
      { folderPath: folder1.fullPath, referenceId: "b" },
      ...TestHelper.extractApiKeys(organization)
    );
    TestHelper.expectError(res, "No folder with this folderPath was found.");
  });
});
