import bcrypt from "bcrypt";
import faker from "faker";
import {
  comparisonTypeEnum,
  IntegrationDocument,
  integrationTypeEnum,
  keyTypeEnum,
  notificationTypeEnum,
  OrganizationDocument,
  orgPermissionLevel,
  simplifiedLogTagEnum,
} from "logtree-types";
import { DateTime } from "luxon";
import moment from "moment-timezone";
import { FavoriteFolder } from "src/models/FavoriteFolder";
import { Folder } from "src/models/Folder";
import { FolderPreference } from "src/models/FolderPreference";
import { Integration } from "src/models/Integration";
import { LastCheckedFolder } from "src/models/LastCheckedFolder";
import { Log } from "src/models/Log";
import { Organization } from "src/models/Organization";
import { OrgInvitation } from "src/models/OrgInvitation";
import { Rule } from "src/models/Rule";
import { User } from "src/models/User";
import { FolderService } from "src/services/ApiService/lib/FolderService";
import { FavoriteFolderFactory } from "src/tests/factories/FavoriteFolderFactory";
import { FolderFactory } from "src/tests/factories/FolderFactory";
import { FolderPreferenceFactory } from "src/tests/factories/FolderPreferenceFactory";
import { IntegrationFactory } from "src/tests/factories/IntegrationFactory";
import { LastCheckedFolderFactory } from "src/tests/factories/LastCheckedFolderFactory";
import { LogFactory } from "src/tests/factories/LogFactory";
import { OrganizationFactory } from "src/tests/factories/OrganizationFactory";
import { OrgInvitationFactory } from "src/tests/factories/OrgInvitationFactory";
import { RuleFactory } from "src/tests/factories/RuleFactory";
import { fakePromise } from "src/tests/mockHelpers";
import { FirebaseMock } from "src/tests/mocks/FirebaseMock";
import { config } from "src/utils/config";
import { TwilioUtil } from "src/utils/twilio";

import { UserFactory } from "../../factories/UserFactory";
import { TestHelper } from "../../TestHelper";
import { SecureIntegrationService } from "src/services/integrations/SecureIntegrationService";
import { integrationsAvailableToConnectTo } from "src/services/integrations/lib";
import { OAuthRequestFactory } from "src/tests/factories/OAuthRequestFactory";
import axios from "axios";
import { OAuthRequest } from "src/models/OAuthRequest";
import { IntercomService } from "src/services/integrations/components/IntercomService";
import { QuestionAnswerService } from "src/services/ApiService/lib/QuestionAnswerService";

const routeUrl = "/organization";

describe("GetMe", () => {
  it("correctly gets me (the user making the request)", async () => {
    const user = await UserFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + "/me",
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const returnedUser = res.body;
    expect(returnedUser._id.toString()).toBe(user._id.toString());
  });
});

describe("GetInvitationInfo", () => {
  it("correctly gets the invitation info", async () => {
    const organization = await OrganizationFactory.create();
    const invite = await OrgInvitationFactory.create({
      organizationId: organization._id,
    });
    await UserFactory.create({ organizationId: organization._id });
    await UserFactory.create({ organizationId: organization._id });
    await UserFactory.create();

    const res = await TestHelper.sendRequest(
      routeUrl + "/invitation",
      "GET",
      {},
      { invitationId: invite._id.toString(), orgSlug: organization.slug }
    );
    TestHelper.expectSuccess(res);
    const { organizationName, numMembers, organizationId } = res.body;
    expect(organizationId.toString()).toBe(organization._id.toString());
    expect(organizationName).toBe(organization.name);
    expect(numMembers).toBe(2);
  });
  it("fails to get the invitation info for an invitation that doesn't exist", async () => {
    const organization = await OrganizationFactory.create();
    const invite = await OrgInvitationFactory.create();

    const res = await TestHelper.sendRequest(
      routeUrl + "/invitation",
      "GET",
      {},
      { invitationId: invite._id.toString(), orgSlug: organization.slug }
    );
    TestHelper.expectError(
      res,
      "The invitation and organization do not match."
    );
  });
});

describe("GetOrganization", () => {
  it("correctly gets the organization of the user making the request (given organization id)", async () => {
    const user = await UserFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId}`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const organization = res.body;
    expect(organization._id.toString()).toBe(user.organizationId.toString());
    expect(organization.slug).toBeTruthy();
  });
});

describe("GenerateSecretKey", () => {
  it("correctly generates a new secret key", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/secret-key`,
      "POST",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { plaintextSecretKey } = res.body;
    expect(plaintextSecretKey).toBeTruthy();

    const updatedOrganization = await Organization.findById(organization._id);

    const matchesEncryptedVersion = await bcrypt.compare(
      plaintextSecretKey,
      updatedOrganization!.keys.encryptedSecretKey!
    );
    expect(matchesEncryptedVersion).toBeTruthy();
  });
});

describe("GenerateInviteLink", () => {
  it("correctly generates an invite link to the organization", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/invite-link`,
      "POST",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { url } = res.body;

    const invite = await OrgInvitation.findOne({
      organizationId: organization._id,
    });
    const allOrgInvitesNum = await OrgInvitation.find({
      organizationId: organization._id,
    }).countDocuments();
    expect(allOrgInvitesNum).toBe(1);

    expect(url).toBe(
      `${config.baseUrl}/invite/${organization.slug}/${invite?._id.toString()}`
    );
  });
});

describe("GetFolders", () => {
  it("correctly gets the folder array representation for an organization", async () => {
    const organization = await OrganizationFactory.create();
    const folderTop1 = await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: null,
      name: "folder-top-1",
      fullPath: "/folder-top-1",
    });
    const folderTop2 = await FolderFactory.create({
      // should have unread logs
      organizationId: organization._id,
      parentFolderId: null,
      name: "folder-top-2",
      fullPath: "/folder-top-2",
      dateOfMostRecentLog: new Date(),
    });
    await FolderFactory.create(); // decoy
    await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: folderTop2._id,
    });
    const subfolder2 = await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: folderTop2._id,
      dateOfMostRecentLog: moment().subtract(3, "minutes"),
    });
    const deeperSubfolder2 = await FolderFactory.create({
      // should have unread logs
      organizationId: organization._id,
      parentFolderId: subfolder2._id,
      dateOfMostRecentLog: new Date(),
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    await FolderPreferenceFactory.create({
      userId: user._id,
      fullPath: deeperSubfolder2.fullPath,
      isMuted: true,
    });
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: folderTop1.fullPath,
    });
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: folderTop2.fullPath,
      createdAt: moment().subtract(2, "days"),
    });
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: subfolder2.fullPath,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/folders`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { folders } = res.body;
    expect(folders.length).toBe(2);
    expect(folders[0].children.length).toBe(0);
    expect(folders[1].children.length).toBe(2);
    expect(folders[1].children[0].children.length).toBe(0);
    expect(folders[1].children[1].children.length).toBe(1);
    expect(folders[1].children[1].hasUnreadLogs).toBeFalsy();
    expect(folders[1].children[1].children[0]._id.toString()).toBe(
      deeperSubfolder2._id.toString()
    );
    expect(folders[1].children[1].children[0].isMuted).toBeTruthy();
    expect(folders[1].children[1].children[0].hasUnreadLogs).toBeFalsy();
    expect(folders[1].children[1].children[0].children.length).toBe(0);
    expect(folders[0].name).toBe("folder-top-1");
    expect(folders[1].name).toBe("folder-top-2");
    expect(folders[0].fullPath).toBe("/folder-top-1");
    expect(folders[0].hasUnreadLogs).toBeFalsy();
    expect(folders[0].isMuted).toBeFalsy();
    expect(folders[1].fullPath).toBe("/folder-top-2");
    expect(folders[1].hasUnreadLogs).toBeTruthy();
    expect(folders[1].isMuted).toBeFalsy();
  });
  it("correctly gets the folder array representation for an organization (empty array)", async () => {
    const organization = await OrganizationFactory.create();
    await FolderFactory.create(); // decoy
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/folders`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { folders } = res.body;
    expect(folders.length).toBe(0);
  });
});

describe("GetLogs", () => {
  it("correctly gets the logs for a specific folder", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
    });
    const folderDecoy = await FolderFactory.create({
      organizationId: organization._id,
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folderDecoy._id,
    });
    await LogFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/logs`,
      "GET",
      {},
      { folderId: folder.id },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs, numLogsInTotal } = res.body;
    expect(logs.length).toBe(2);
    expect(numLogsInTotal).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(3);
    expect(logs[0]._id.toString()).toBe(log2._id.toString());
    expect(logs[1]._id.toString()).toBe(log1._id.toString());
  });
  it("correctly gets the logs for a specific folder with logsNoOlderThanDate set", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      createdAt: moment().subtract(53, "minutes"),
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
    });
    const folderDecoy = await FolderFactory.create({
      organizationId: organization._id,
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      createdAt: moment().subtract(65, "minutes").toDate(),
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folderDecoy._id,
    });
    await LogFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/logs`,
      "GET",
      {},
      {
        folderId: folder.id,
        logsNoOlderThanDate: moment().subtract(1, "hour").toDate(),
      },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs, numLogsInTotal } = res.body;
    expect(logs.length).toBe(2);
    expect(numLogsInTotal).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(3);
    expect(logs[0]._id.toString()).toBe(log2._id.toString());
    expect(logs[1]._id.toString()).toBe(log1._id.toString());
  });
  it("correctly gets the logs for favorited folders for a user", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
      name: "testing-stuff",
      fullPath: "/testing-stuff",
    });
    const subFolder = await FolderFactory.create({
      organizationId: organization._id,
      name: "testing-stuff-2",
      fullPath: "/testing-stuff/testing-stuff-2",
      parentFolderId: folder._id,
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
    });
    const folderDecoy = await FolderFactory.create({
      organizationId: organization._id,
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folderDecoy._id,
    });
    const log3 = await LogFactory.create({
      organizationId: organization._id,
      folderId: subFolder._id,
    });
    await LogFactory.create();
    const anotherFolder = await FolderFactory.create({
      organizationId: organization._id,
      name: "hey-there",
      fullPath: "/hey-there",
    });
    const log4 = await LogFactory.create({
      organizationId: organization._id,
      folderId: anotherFolder._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    await FavoriteFolderFactory.create({
      fullPath: "/testing-stuff",
      userId: user._id,
    });
    await FavoriteFolderFactory.create({
      fullPath: "/hey-there",
      userId: user._id,
    });
    await FavoriteFolderFactory.create({
      fullPath: "/random-decoy/stuff",
      userId: user._id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/logs`,
      "GET",
      {},
      { isFavorites: true },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs, numLogsInTotal } = res.body;
    expect(logs.length).toBe(4);
    expect(numLogsInTotal).toBe(4);
    expect(Object.keys(logs[0]).length).toBe(4);
    expect(logs[0]._id.toString()).toBe(log4._id.toString());
    expect(logs[1]._id.toString()).toBe(log3._id.toString());
    expect(logs[2]._id.toString()).toBe(log2._id.toString());
    expect(logs[3]._id.toString()).toBe(log1._id.toString());
  });
  it("correctly gets the logs with a start pagination", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      createdAt: moment().add(1, "hour"),
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
    });
    const folderDecoy = await FolderFactory.create({
      organizationId: organization._id,
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folderDecoy._id,
    });
    await LogFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/logs`,
      "GET",
      {},
      { folderId: folder.id, start: 1, logsNoNewerThanDate: new Date() },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs, numLogsInTotal } = res.body;
    expect(logs.length).toBe(1);
    expect(numLogsInTotal).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(3);
    expect(logs[0]._id.toString()).toBe(log1._id.toString());
  });
  it("fails because no folderId was provided and we aren't looking at favorites channel either", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/logs`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Must provide either a folderId or isFavorites"
    );
  });
});

describe("SearchForLogs", () => {
  it("correctly searches for logs and returns results", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "test",
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "hello blahtestm yo.",
    });
    const folderDecoy = await FolderFactory.create({
      organizationId: organization._id,
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folderDecoy._id,
      content: "test hi",
    });
    await LogFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/search`,
      "POST",
      { folderId: folder.id, query: "test" },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs } = res.body;
    expect(logs.length).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(4);
    expect(logs[0]._id.toString()).toBe(log2._id.toString());
    expect(logs[1]._id.toString()).toBe(log1._id.toString());
  });
  it("correctly searches for logs with specific referenceId and returns results", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "test",
      referenceId: "a",
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "hello blahtestm yo.",
      referenceId: "a",
    });
    const folderDecoy = await FolderFactory.create({
      organizationId: organization._id,
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folderDecoy._id,
      content: "test hi",
      referenceId: "a",
    });
    await LogFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/search`,
      "POST",
      { folderId: folder.id, query: "id:a" },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs } = res.body;
    expect(logs.length).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(5);
    expect(logs[0]._id.toString()).toBe(log2._id.toString());
    expect(logs[1]._id.toString()).toBe(log1._id.toString());
  });
  it("correctly searches for logs with specific referenceId and no other filters", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "test",
      referenceId: "aa",
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      content: "hello blahtestm yo.",
      referenceId: "aa",
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "hello blahtestm yo.",
      referenceId: "ab",
    });
    await LogFactory.create({
      content: "test hi",
      referenceId: "aa",
    });
    await LogFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/search`,
      "POST",
      { query: "id:aa" },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs } = res.body;
    expect(logs.length).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(5);
    expect(logs[0]._id.toString()).toBe(log2._id.toString());
    expect(logs[1]._id.toString()).toBe(log1._id.toString());
  });
  it("correctly searches for logs with specific query and no other filters", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "test",
      referenceId: "a",
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      content: "hello blahtestm yo.",
      referenceId: "a",
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "hello blahtesmt yo.",
      referenceId: "b",
    });
    await LogFactory.create({
      content: "test hi",
      referenceId: "a",
    });
    await LogFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/search`,
      "POST",
      { query: "test" },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs } = res.body;
    expect(logs.length).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(5);
    expect(logs[0]._id.toString()).toBe(log2._id.toString());
    expect(logs[1]._id.toString()).toBe(log1._id.toString());
  });
  it("correctly searches for logs in the user's favorited folders", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
      name: "testing-once-again",
      fullPath: "/testing-once-again",
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "test",
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "hello blahtestm yo.",
    });
    const folderDecoy = await FolderFactory.create({
      organizationId: organization._id,
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folderDecoy._id,
      content: "test hi",
    });
    await LogFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    await FavoriteFolderFactory.create({
      fullPath: folder.fullPath,
      userId: user._id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/search`,
      "POST",
      { isFavorites: true, query: "test" },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs } = res.body;
    expect(logs.length).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(4);
    expect(logs[0]._id.toString()).toBe(log2._id.toString());
    expect(logs[1]._id.toString()).toBe(log1._id.toString());
  });
  it("correctly searches for logs with a specific referenceId in the user's favorited folders", async () => {
    const organization = await OrganizationFactory.create();
    const folder = await FolderFactory.create({
      organizationId: organization._id,
      name: "testing-once-again",
      fullPath: "/testing-once-again",
    });
    const log1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "test",
      referenceId: "a",
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      folderId: folder._id,
      content: "hello blahtestm yo.",
      referenceId: "a",
    });
    const folderDecoy = await FolderFactory.create({
      organizationId: organization._id,
    });
    await LogFactory.create({
      organizationId: organization._id,
      folderId: folderDecoy._id,
      content: "test hi",
      referenceId: "a",
    });
    await LogFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    await FavoriteFolderFactory.create({
      fullPath: folder.fullPath,
      userId: user._id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/search`,
      "POST",
      { isFavorites: true, query: "id:a" },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs } = res.body;
    expect(logs.length).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(5);
    expect(logs[0]._id.toString()).toBe(log2._id.toString());
    expect(logs[1]._id.toString()).toBe(log1._id.toString());
  });
});

describe("CreateUser", () => {
  it("correctly creates a new user from an invitation", async () => {
    const organization = await OrganizationFactory.create();
    const orgInvitation = await OrgInvitationFactory.create({
      organizationId: organization._id,
      isOneTimeUse: true,
    });
    const email = faker.datatype.uuid();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user`,
      "POST",
      { invitationId: orgInvitation._id, email, password: "password" },
      {}
    );
    TestHelper.expectSuccess(res);
    const user = res.body;
    expect(user.email).toBe(email);
    expect(user.firebaseId).toBeTruthy();
    expect(user.organizationId.toString()).toBe(organization.id);
    expect(user.invitationId.toString()).toBe(orgInvitation.id);
    expect(user.isAdmin).toBeFalsy();
  });
  it("correctly creates a new user from an invitation that can be used multiple times", async () => {
    const organization = await OrganizationFactory.create();
    const orgInvitation = await OrgInvitationFactory.create({
      organizationId: organization._id,
      isOneTimeUse: false,
    });
    await UserFactory.create({
      organizationId: organization._id,
      invitationId: orgInvitation._id,
    });
    const email = faker.datatype.uuid();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user`,
      "POST",
      { invitationId: orgInvitation._id, email, password: "password" },
      {}
    );
    TestHelper.expectSuccess(res);
    const user = res.body;
    expect(user.email).toBe(email);
    expect(user.firebaseId).toBeTruthy();
    expect(user.organizationId.toString()).toBe(organization.id);
    expect(user.invitationId.toString()).toBe(orgInvitation.id);
    expect(user.isAdmin).toBeFalsy();
  });
  it("fails to create a new user from an invitation that has expired", async () => {
    const organization = await OrganizationFactory.create();
    const orgInvitation = await OrgInvitationFactory.create({
      organizationId: organization._id,
      expiresAt: DateTime.now().minus({ minutes: 2 }),
    });
    const email = faker.datatype.uuid();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user`,
      "POST",
      { invitationId: orgInvitation._id, email, password: "password" },
      {}
    );
    TestHelper.expectError(
      res,
      "This invite has expired. Please ask a team member for a new invite link."
    );
  });
  it("fails to create a new user from an invitation that doesn't exist", async () => {
    const organization = await OrganizationFactory.create();
    const orgInvitation = await OrgInvitationFactory.create();
    const email = faker.datatype.uuid();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user`,
      "POST",
      { invitationId: orgInvitation._id, email, password: "password" },
      {}
    );
    TestHelper.expectError(
      res,
      "This invite has expired. Please ask a team member for a new invite link."
    );
  });
  it("fails to create a new user from a one-time invitation that has already been used", async () => {
    const organization = await OrganizationFactory.create();
    const orgInvitation = await OrgInvitationFactory.create({
      organizationId: organization._id,
      isOneTimeUse: true,
    });
    await UserFactory.create({
      organizationId: organization._id,
      invitationId: orgInvitation._id,
    });
    const email = faker.datatype.uuid();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user`,
      "POST",
      { invitationId: orgInvitation._id, email, password: "password" },
      {}
    );
    TestHelper.expectError(
      res,
      "This invite has already been used. Please ask a team member for a new invite link."
    );
  });
  it("fails to create a new user because there is already a user with this email", async () => {
    const organization = await OrganizationFactory.create();
    const orgInvitation = await OrgInvitationFactory.create({
      organizationId: organization._id,
    });
    const email = faker.datatype.uuid();
    await UserFactory.create({ email });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user`,
      "POST",
      { invitationId: orgInvitation._id, email, password: "password" },
      {}
    );
    TestHelper.expectError(
      res,
      "You already have an account under this email. Please contact support."
    );
  });
});

describe("DeleteFolderAndEverythingInside", () => {
  it("correctly deletes the folder and anything inside", async () => {
    const organization = await OrganizationFactory.create();
    const randomFolder1 = await FolderFactory.create(); // decoy
    const randomFolder2 = await FolderFactory.create({
      organizationId: organization._id,
    }); // decoy
    const ruleToKeep = await RuleFactory.create({
      folderId: randomFolder2._id,
    });
    const topFolder = await FolderFactory.create({
      organizationId: organization._id,
      name: "top",
      fullPath: "/top",
      parentFolderId: null,
    });
    const middleFolder = await FolderFactory.create({
      organizationId: organization._id,
      name: "middle",
      fullPath: "/top/middle",
      parentFolderId: topFolder._id,
    });
    const ruleToDelete = await RuleFactory.create({
      folderId: middleFolder._id,
    });
    const bottomFolder = await FolderFactory.create({
      organizationId: organization._id,
      name: "bottom",
      fullPath: "/top/middle/bottom",
      parentFolderId: middleFolder._id,
    });
    const logToKeep1 = await LogFactory.create(); // decoy
    const logToKeep2 = await LogFactory.create({
      organizationId: organization._id,
      folderId: randomFolder2._id,
    });
    const logToDelete1 = await LogFactory.create({
      organizationId: organization._id,
      folderId: bottomFolder._id,
    });
    const logToDelete2 = await LogFactory.create({
      organizationId: organization._id,
      folderId: bottomFolder._id,
    });
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/delete-folder`,
      "POST",
      { folderId: middleFolder._id },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const _logToKeep1 = await Log.findById(logToKeep1._id);
    expect(_logToKeep1).toBeTruthy();
    const _logToKeep2 = await Log.findById(logToKeep2._id);
    expect(_logToKeep2).toBeTruthy();
    const _logToDelete1 = await Log.findById(logToDelete1._id);
    expect(_logToDelete1).toBeNull();
    const _logToDelete2 = await Log.findById(logToDelete2._id);
    expect(_logToDelete2).toBeNull();

    const _randomFolder1 = await Folder.findById(randomFolder1._id);
    expect(_randomFolder1).toBeTruthy();
    const _randomFolder2 = await Folder.findById(randomFolder2._id);
    expect(_randomFolder2).toBeTruthy();
    const _topFolder = await Folder.findById(topFolder._id);
    expect(_topFolder).toBeTruthy();
    const _middleFolder = await Folder.findById(middleFolder._id);
    expect(_middleFolder).toBeNull();
    const _bottomFolder = await Folder.findById(bottomFolder._id);
    expect(_bottomFolder).toBeNull();

    const _ruleToKeep = await Rule.findById(ruleToKeep._id);
    expect(_ruleToKeep).toBeTruthy();
    const _ruleToDelete = await Rule.findById(ruleToDelete._id);
    expect(_ruleToDelete).toBeNull();
  });
  it("fails to delete the folder because it belongs to a different organization", async () => {
    const organization = await OrganizationFactory.create();
    const randomFolder = await FolderFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/delete-folder`,
      "POST",
      { folderId: randomFolder._id },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "You cannot delete this folder.");
    const folderStillExists = await Folder.exists({
      _id: randomFolder._id,
    }).exec();
    expect(folderStillExists).toBeTruthy();
  });
});

describe("GetOrganizationMembers", () => {
  it("correctly gets the users in an organization", async () => {
    const organization = await OrganizationFactory.create();
    await UserFactory.create(); // decoy
    const user1 = await UserFactory.create({
      organizationId: organization._id,
      phoneNumber: "abcd",
    });
    const user2 = await UserFactory.create({
      organizationId: organization._id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/team`,
      "GET",
      {},
      {},
      user1.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { users } = res.body;
    expect(users.length).toBe(2);
    expect(users[0]._id.toString()).toBe(user1.id);
    expect(users[0].email).toBeTruthy();
    expect(users[0].orgPermissionLevel).toBeTruthy();
    expect(users[0].phoneNumber).toBeUndefined();
    expect(users[1]._id.toString()).toBe(user2.id);
  });
});

describe("UpdateUserPermissions", () => {
  it("correctly updates a user from member to admin", async () => {
    const organization = await OrganizationFactory.create();
    const user1 = await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Admin,
    });
    const user2 = await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Member,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user-permissions`,
      "PUT",
      {
        userIdToUpdate: user2._id.toString(),
        newPermission: orgPermissionLevel.Admin,
      },
      {},
      user1.firebaseId
    );
    TestHelper.expectSuccess(res);

    const updatedUser = await User.findById(user2._id);
    expect(updatedUser?.orgPermissionLevel).toBe(orgPermissionLevel.Admin);
  });
  it("correctly updates a user from admin to member", async () => {
    const organization = await OrganizationFactory.create();
    const user1 = await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Admin,
    });
    const user2 = await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Admin,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user-permissions`,
      "PUT",
      {
        userIdToUpdate: user2._id.toString(),
        newPermission: orgPermissionLevel.Member,
      },
      {},
      user1.firebaseId
    );
    TestHelper.expectSuccess(res);

    const updatedUser = await User.findById(user2._id);
    expect(updatedUser?.orgPermissionLevel).toBe(orgPermissionLevel.Member);
    const userThatMadeRequest = await User.findById(user1._id);
    expect(userThatMadeRequest?.orgPermissionLevel).toBe(
      orgPermissionLevel.Admin
    );
  });
  it("correctly removes a user", async () => {
    const firebaseSpy = jest.spyOn(FirebaseMock, "deleteUser");
    const organization = await OrganizationFactory.create();
    const user1 = await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Admin,
    });
    const user2 = await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Member,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user-permissions`,
      "PUT",
      {
        userIdToUpdate: user2._id.toString(),
        isRemoved: true,
      },
      {},
      user1.firebaseId
    );
    TestHelper.expectSuccess(res);

    const removedUser = await User.findById(user2._id);
    expect(removedUser).toBeNull();
    expect(firebaseSpy).toBeCalledTimes(1);
    expect(firebaseSpy.mock.calls[0][0]).toBe(user2.firebaseId);
  });
  it("fails to update the user making the request", async () => {
    const organization = await OrganizationFactory.create();
    const user1 = await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Admin,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user-permissions`,
      "PUT",
      {
        userIdToUpdate: user1._id.toString(),
        isRemoved: true,
      },
      {},
      user1.firebaseId
    );
    TestHelper.expectError(res, "You cannot update your own permissions.");
  });
  it("fails to update a user from a different organization", async () => {
    const organization = await OrganizationFactory.create();
    const user1 = await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Admin,
    });
    const user2 = await UserFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/user-permissions`,
      "PUT",
      {
        userIdToUpdate: user2._id.toString(),
        isRemoved: true,
      },
      {},
      user1.firebaseId
    );
    TestHelper.expectError(
      res,
      "You cannot update the permissions of a user outside your organization."
    );
  });
});

describe("FavoriteFolder", () => {
  beforeEach(async () => {
    await FavoriteFolder.deleteMany();
  });
  it("correctly favorites a folder path for a user", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const fullPath = "/test/a";
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/favorite-folder`,
      "POST",
      {
        fullPath,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const favoritedFolder = await FavoriteFolder.findOne({
      userId: user._id,
      fullPath,
    })
      .lean()
      .exec();
    expect(favoritedFolder).toBeTruthy();
  });
  it("correctly unfavorites a folder path for a user", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const fullPath = "/test/a";
    await FavoriteFolderFactory.create({
      userId: user._id,
      fullPath,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/favorite-folder`,
      "POST",
      {
        fullPath,
        isRemoved: true,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const unfavoritedFolder = await FavoriteFolder.findOne({
      userId: user._id,
      fullPath,
    });
    expect(unfavoritedFolder).toBeNull();
  });
  it("fails to favorite a folder that is already favorited", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const fullPath = "/test/a";
    await FavoriteFolderFactory.create({ userId: user._id, fullPath });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/favorite-folder`,
      "POST",
      {
        fullPath,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Cannot favorite a folder that is already favorited."
    );

    const favoritedFolderCount = await FavoriteFolder.countDocuments({
      userId: user._id,
      fullPath,
    })
      .lean()
      .exec();
    expect(favoritedFolderCount).toBe(1);
  });
  it("fails to unfavorite a folder that is not currently favorited", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const fullPath = "/test/a";
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/favorite-folder`,
      "POST",
      {
        fullPath,
        isRemoved: true,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Cannot unfavorite a folder that is not currently favorited."
    );

    const favoritedFolderCount = await FavoriteFolder.countDocuments({
      userId: user._id,
      fullPath,
    })
      .lean()
      .exec();
    expect(favoritedFolderCount).toBe(0);
  });
  it("fails to favorite an invalid folder path", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const fullPath = "test/a";
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/favorite-folder`,
      "POST",
      {
        fullPath,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "Your folderPath must begin with a /");

    const favoritedFolderCount = await FavoriteFolder.countDocuments({
      userId: user._id,
      fullPath,
    })
      .lean()
      .exec();
    expect(favoritedFolderCount).toBe(0);
  });
});

describe("GetFavoriteFolder", () => {
  it("correctly gets the favorite folder paths of a user", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const fav1 = await FavoriteFolderFactory.create({
      fullPath: "/hi",
      userId: user._id,
    });
    const fav2 = await FavoriteFolderFactory.create({
      fullPath: "/hello",
      userId: user._id,
    });
    await FavoriteFolderFactory.create({ fullPath: "/yo" }); // decoy
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/favorite-folders`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { folderPaths } = res.body;
    expect(folderPaths.length).toBe(2);
    expect(folderPaths[0]).toBe(fav1.fullPath);
    expect(folderPaths[1]).toBe(fav2.fullPath);
  });
});

describe("FolderService.recordUserCheckingFolder", () => {
  it("correctly records a user checking a folder", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    await FolderService.recordUserCheckingFolder(
      user!._id.toString(),
      folder!._id.toString()
    );

    const lastCheckedFolderObj = await LastCheckedFolder.findOne({
      userId: user!._id,
      fullPath: folder.fullPath,
    });
    expect(lastCheckedFolderObj).toBeTruthy();
  });
  it("correctly records a user checking the favorites folder", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    await FolderService.recordUserCheckingFolder(
      user!._id.toString(),
      undefined,
      true
    );

    const lastCheckedFolderObj = await LastCheckedFolder.findOne({
      userId: user!._id,
      fullPath: "",
    });
    expect(lastCheckedFolderObj).toBeTruthy();
  });
});

describe("SetFolderPreference", () => {
  it("correctly updates a folder preference", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const preference = await FolderPreferenceFactory.create({
      userId: user._id,
      fullPath: "test123",
      isMuted: false,
    });
    expect(preference.isMuted).toBe(false);

    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/folder-preference`,
      "POST",
      {
        fullPath: preference.fullPath,
        isMuted: true,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const updatedPreference = await FolderPreference.findById(
      preference._id
    ).lean();
    expect(updatedPreference.isMuted).toBe(true);

    const numPreferencesForThisUser = await FolderPreference.countDocuments({
      userId: user._id,
    });
    expect(numPreferencesForThisUser).toBe(1);
  });
  it("correctly creates a new folder preference", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const fullPath = "testing4";
    await FolderPreferenceFactory.create({ userId: user._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization._id.toString()}/folder-preference`,
      "POST",
      {
        fullPath,
        isMuted: true,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const preference = await FolderPreference.findOne({
      userId: user._id,
      fullPath,
      isMuted: true,
    }).lean();
    expect(preference).toBeTruthy();

    const numPreferencesForThisUser = await FolderPreference.countDocuments({
      userId: user._id,
    });
    expect(numPreferencesForThisUser).toBe(2);
  });
});

describe("GetFolderStats", () => {
  it("correctly gets a folder's stats", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().startOf("day").add(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "days"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(3, "days"),
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/folder-stats`,
      "GET",
      {},
      { folderId: folder.id, timezone: moment.tz.guess() },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { percentageChange, timeInterval, logFrequencies, numLogsToday } =
      res.body;
    expect(timeInterval).toBe("day");
    expect(percentageChange).toBeGreaterThan(0);
    expect(logFrequencies.length).toBe(3);
    expect(numLogsToday).toBe(1);
  });
  it("fails to get a folder's stats from a different organization", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/folder-stats`,
      "GET",
      {},
      { folderId: folder.id, timezone: moment.tz.guess() },
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Cannot get the folder stats of a folder in a different organization."
    );
  });
});

describe("UpdateFolder", () => {
  it("successfully updates a folder's description", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const description = "test description 123";
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/folder`,
      "PUT",
      {
        folderId: folder._id,
        description,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { folder: updatedFolder } = res.body;
    expect(updatedFolder.description).toBe(description);
  });
  it("fails to update a folder's description because the folder could not be found", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create();
    const description = "test description 123";
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/folder`,
      "PUT",
      {
        folderId: folder._id,
        description,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "Cannot update a folder that doesn't exist.");
  });
});

describe("GetInsights", () => {
  it("correctly gets an organization's insights", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder1 = await FolderFactory.create({
      organizationId: organization._id,
      dateOfMostRecentLog: new Date(),
    });
    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(2, "days"),
    });
    await LogFactory.create({
      folderId: folder1._id,
      createdAt: moment().subtract(3, "days"),
    });
    const folder2 = await FolderFactory.create({
      organizationId: organization._id,
      dateOfMostRecentLog: new Date(),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(2, "days"),
    });
    await LogFactory.create({
      folderId: folder2._id,
      createdAt: moment().subtract(3, "days"),
    });
    const folder3 = await FolderFactory.create({
      organizationId: organization._id,
      dateOfMostRecentLog: new Date(),
    });
    await LogFactory.create({
      folderId: folder3._id,
      createdAt: moment().subtract(2, "minutes"),
    });
    await FolderFactory.create({
      organizationId: organization._id,
      dateOfMostRecentLog: new Date(),
    });
    await LastCheckedFolderFactory.create({
      userId: user._id,
      fullPath: folder1.fullPath,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/insights`,
      "GET",
      {},
      { timezone: moment.tz.guess() },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { insightsOfNotMostCheckedFolders, insightsOfMostCheckedFolders } =
      res.body;
    expect(insightsOfNotMostCheckedFolders.length).toBe(1);
    expect(insightsOfNotMostCheckedFolders[0].folder._id.toString()).toBe(
      folder2.id
    );
    expect(insightsOfNotMostCheckedFolders[0].numLogsToday).toBe(4);
    expect(insightsOfMostCheckedFolders.length).toBe(1);
    expect(insightsOfMostCheckedFolders[0].folder._id.toString()).toBe(
      folder1.id
    );
    expect(insightsOfMostCheckedFolders[0].numLogsToday).toBe(1);
  });
});

describe("CreateRule", () => {
  it("correctly creates a rule", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const comparisonType = comparisonTypeEnum.CrossesBelow;
    const comparisonValue = 6;
    const lookbackTimeInMins = 40;
    const notificationType = notificationTypeEnum.Email;
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/rule`,
      "POST",
      {
        folderId: folder.id,
        comparisonType,
        comparisonValue,
        lookbackTimeInMins,
        notificationType,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { rule } = res.body;
    expect(rule.folderId.toString()).toBe(folder.id);
    expect(rule.comparisonType).toBe(comparisonType);
    expect(rule.comparisonValue).toBe(comparisonValue);
    expect(rule.lookbackTimeInMins).toBe(lookbackTimeInMins);
    expect(rule.notificationType).toBe(notificationType);
  });
  it("fails to create a rule because the folderId is for a different organization", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create();
    const comparisonType = comparisonTypeEnum.CrossesBelow;
    const comparisonValue = 6;
    const lookbackTimeInMins = 20;
    const notificationType = notificationTypeEnum.Email;
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/rule`,
      "POST",
      {
        folderId: folder.id,
        comparisonType,
        comparisonValue,
        lookbackTimeInMins,
        notificationType,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "No folder with this ID exists in this organization."
    );
  });
});

describe("DeleteRule", () => {
  it("correctly deletes a rule", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const rule = await RuleFactory.create({
      userId: user.id,
      folderId: folder.id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/delete-rule`,
      "POST",
      {
        ruleId: rule._id,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const deletedRule = await Rule.findById(rule._id);
    expect(deletedRule).toBeNull();
  });
  it("fails to delete a rule because the rule doesn't belong to this user", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const otherUser = await UserFactory.create({
      organizationId: organization._id,
    });
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const rule = await RuleFactory.create({
      userId: otherUser.id,
      folderId: folder.id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/delete-rule`,
      "POST",
      {
        ruleId: rule._id,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "Cannot delete a rule that does not exist.");
  });
});

describe("GetRulesForUser", () => {
  it("correctly gets the rules for a user", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create({
      organizationId: organization._id,
    });
    const rule1 = await RuleFactory.create({
      userId: user.id,
      folderId: folder.id,
    });
    const rule2 = await RuleFactory.create({
      userId: user.id,
    });
    await RuleFactory.create({
      folderId: folder.id,
    });
    await RuleFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/rules`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { rules } = res.body;
    expect(rules.length).toBe(2);
    expect(rules[0]._id.toString()).toBe(rule2.id);
    expect(rules[1]._id.toString()).toBe(rule1.id);
  });
});

describe("SendPhoneCode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("correctly sends a phone code to a user", async () => {
    const twilioSpy = jest
      .spyOn(TwilioUtil, "sendVerificationCode")
      .mockImplementation(fakePromise);
    const user = await UserFactory.create();
    const phoneNumber = faker.datatype.uuid();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/user/phone/send-code`,
      "POST",
      { phoneNumber },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    expect(twilioSpy).toBeCalledTimes(1);
    expect(twilioSpy.mock.calls[0][0]).toBe(phoneNumber);
  });
});

describe("VerifyPhoneCode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("correctly approves a phone code for a user", async () => {
    const twilioSpy = jest
      .spyOn(TwilioUtil, "_getVerificationCodeResult")
      .mockImplementation(() => Promise.resolve(true));
    const user = await UserFactory.create();
    const phoneNumber = faker.datatype.uuid();
    const code = faker.datatype.uuid();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/user/phone/verify-code`,
      "POST",
      { phoneNumber, code },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    expect(twilioSpy).toBeCalledTimes(1);
    expect(twilioSpy.mock.calls[0][0]).toBe(phoneNumber);
    expect(twilioSpy.mock.calls[0][1]).toBe(code);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.phoneNumber).toBe(phoneNumber);
  });
  it("correctly rejects a phone code for a user", async () => {
    const twilioSpy = jest
      .spyOn(TwilioUtil, "_getVerificationCodeResult")
      .mockImplementation(() => Promise.resolve(false));
    const user = await UserFactory.create();
    const phoneNumber = faker.datatype.uuid();
    const code = faker.datatype.uuid();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/user/phone/verify-code`,
      "POST",
      { phoneNumber, code },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "The code you entered was incorrect.");

    expect(twilioSpy).toBeCalledTimes(1);
    expect(twilioSpy.mock.calls[0][0]).toBe(phoneNumber);
    expect(twilioSpy.mock.calls[0][1]).toBe(code);

    const updatedUser = await User.findById(user._id);
    expect(updatedUser?.phoneNumber).toBeUndefined();
  });
});

describe("DeleteLog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("correctly deletes a log", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const log1 = await LogFactory.create({ organizationId: organization._id });
    const log2 = await LogFactory.create({ organizationId: organization._id });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/delete-log`,
      "POST",
      { logId: log1._id },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const log1Exists = await Log.exists({ _id: log1._id });
    expect(log1Exists).toBeFalsy();

    const log2Exists = await Log.exists({ _id: log2._id });
    expect(log2Exists).toBeTruthy();
  });
  it("fails to delete a log from a different organization", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const log1 = await LogFactory.create();
    const log2 = await LogFactory.create({ organizationId: organization._id });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/delete-log`,
      "POST",
      { logId: log1._id },
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Cannot delete a log from a different organization."
    );

    const log1Exists = await Log.exists({ _id: log1._id });
    expect(log1Exists).toBeTruthy();

    const log2Exists = await Log.exists({ _id: log2._id });
    expect(log2Exists).toBeTruthy();
  });
});

describe("AddOrUpdateIntegration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("correctly adds an integration", async () => {
    const projectConnectionsSpy = jest
      .spyOn(SecureIntegrationService, "finishConnection")
      .mockImplementation(() => Promise.resolve(true));
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration`,
      "POST",
      {
        keys: [
          {
            plaintextValue: "abc",
            type: keyTypeEnum.ApiKey,
          },
        ],
        type: integrationTypeEnum.Sentry,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { integration } = res.body;
    expect(integration).toBeTruthy();
    expect(integration.organizationId.toString()).toBe(
      organization._id.toString()
    );
    expect(projectConnectionsSpy).toBeCalledTimes(1);
  });
  it("correctly updates an integration's keys", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const oldIntegration = await IntegrationFactory.create({
      organizationId: organization._id,
      type: integrationTypeEnum.Sentry,
      keys: [],
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration`,
      "POST",
      {
        keys: [
          {
            plaintextValue: "abc",
            type: keyTypeEnum.ApiKey,
          },
        ],
        type: integrationTypeEnum.Sentry,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { integration } = res.body;
    expect(integration).toBeTruthy();
    expect(integration.organizationId.toString()).toBe(
      organization._id.toString()
    );
    expect(integration.keys.length).toBe(1);
    expect(integration._id.toString()).toBe(oldIntegration._id.toString());
  });
  it("fails to create or update an integration because the keys are incorrectly formatted.", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration`,
      "POST",
      {
        keys: [
          {
            someKey: "abc",
            type: keyTypeEnum.ApiKey,
          },
        ],
        type: integrationTypeEnum.Sentry,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Either no keys were provided, or the keys you provided were sent in an invalid format."
    );
  });
  it("fails to create or update an integration because no keys were provided.", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration`,
      "POST",
      {
        keys: [],
        type: integrationTypeEnum.Sentry,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Either no keys were provided, or the keys you provided were sent in an invalid format."
    );
  });
});

describe("GetIntegrations", () => {
  it("correctly gets the integrations for an organization", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const integration1 = await IntegrationFactory.create({
      organizationId: organization._id,
    });
    await IntegrationFactory.create();
    const integration2 = await IntegrationFactory.create({
      organizationId: organization._id,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integrations`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { integrations } = res.body;
    expect(integrations.length).toBe(2);
    expect(integrations[0]._id.toString()).toBe(integration2.id);
    expect(integrations[1]._id.toString()).toBe(integration1.id);
  });
});

describe("DeleteIntegration", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it("correctly deletes an integration", async () => {
    const integrationOAuthDeleteSpy = jest
      .spyOn(SecureIntegrationService, "removeAnyOAuthConnectionIfApplicable")
      .mockImplementation(fakePromise);
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const integration = await IntegrationFactory.create({
      organizationId: organization._id,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/delete-integration`,
      "POST",
      {
        integrationId: integration._id,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const integrationStillExists = await Integration.exists({
      _id: integration._id,
    });
    expect(integrationStillExists).toBeFalsy();
    expect(integrationOAuthDeleteSpy).toBeCalledTimes(1);
    expect(integrationOAuthDeleteSpy.mock.calls[0][0]._id.toString()).toBe(
      integration.id
    );
  });
  it("correctly deletes an integration with an oauth connection (intercom example)", async () => {
    const integrationOAuthDeleteSpy = jest
      .spyOn(SecureIntegrationService, "removeAnyOAuthConnectionIfApplicable")
      .mockImplementation(fakePromise);
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const integration = await IntegrationFactory.create({
      organizationId: organization._id,
      type: integrationTypeEnum.Intercom,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/delete-integration`,
      "POST",
      {
        integrationId: integration._id,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const integrationStillExists = await Integration.exists({
      _id: integration._id,
    });
    expect(integrationStillExists).toBeFalsy();
    expect(integrationOAuthDeleteSpy).toBeCalledTimes(1);
    expect(integrationOAuthDeleteSpy.mock.calls[0][0]._id.toString()).toBe(
      integration.id
    );
  });
  it("fails to delete an integration because the oauth disconnect failed (intercom example)", async () => {
    const integrationOAuthDeleteSpy = jest
      .spyOn(SecureIntegrationService, "removeAnyOAuthConnectionIfApplicable")
      .mockImplementation(() => Promise.reject({ message: "yolo" }));
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const integration = await IntegrationFactory.create({
      organizationId: organization._id,
      type: integrationTypeEnum.Intercom,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/delete-integration`,
      "POST",
      {
        integrationId: integration._id,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "yolo");

    const integrationStillExists = await Integration.exists({
      _id: integration._id,
    });
    expect(integrationStillExists).toBeTruthy();
    expect(integrationOAuthDeleteSpy).toBeCalledTimes(1);
    expect(integrationOAuthDeleteSpy.mock.calls[0][0]._id.toString()).toBe(
      integration.id
    );
  });
  it("fails to delete an integration from a different organization", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const integration = await IntegrationFactory.create();

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/delete-integration`,
      "POST",
      {
        integrationId: integration._id,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "Could not find that integration.");

    const integrationStillExists = await Integration.exists({
      _id: integration._id,
    });
    expect(integrationStillExists).toBeTruthy();
  });
});

describe("UpdateIntegration", () => {
  it("correctly updates an integration", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const oldIntegration = await IntegrationFactory.create({
      organizationId: organization._id,
      additionalProperties: {},
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration`,
      "PUT",
      {
        integrationId: oldIntegration._id,
        additionalProperties: { test: "hi", test2: "yo" },
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { integration } = res.body;
    expect(integration._id.toString()).toBe(oldIntegration.id);
    expect(integration.additionalProperties).toEqual({
      test: "hi",
      test2: "yo",
    });
  });
  it("fails to update an integration from a different organization", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const oldIntegration = await IntegrationFactory.create({
      additionalProperties: {},
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration`,
      "PUT",
      {
        integrationId: oldIntegration._id,
        additionalProperties: { test: "hi", test2: "yo" },
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "Could not find an integration to update.");

    const integration = await Integration.findById(oldIntegration._id)
      .lean()
      .exec();
    expect(integration._id.toString()).toBe(oldIntegration.id);
    expect(integration.additionalProperties).toEqual({});
  });
});

describe("GetConnectableIntegrations", () => {
  it("correctly gets the connectable integrations for an organization (at least one exists)", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    await IntegrationFactory.create(); // decoy

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/connectable-integrations`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { integrations } = res.body;
    expect(integrations.length).toBeGreaterThan(0);
    expect(integrations.length).toBe(integrationsAvailableToConnectTo.length);
  });
  it("correctly gets the connectable integrations for an organization (none left)", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    for (const type of integrationsAvailableToConnectTo) {
      await IntegrationFactory.create({
        type,
        organizationId: organization._id.toString(),
      });
    }

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/connectable-integrations`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { integrations } = res.body;
    expect(integrations.length).toBe(0);
  });
});

describe("GetSupportLogs", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });
  it("correctly gets the support logs", async () => {
    const query = "ggg";

    const integrationLogsSpy = jest
      .spyOn(SecureIntegrationService, "getLogsFromIntegrations")
      .mockImplementation(() =>
        Promise.resolve([
          {
            _id: "b",
            content: "aaa",
            createdAt: moment().subtract(7, "days").toDate(),
            tag: simplifiedLogTagEnum.Error,
          },
          {
            _id: "a",
            content: "aaa",
            createdAt: moment().subtract(3, "days").toDate(),
            tag: simplifiedLogTagEnum.Error,
          },
        ])
      );

    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const log1 = await LogFactory.create({
      organizationId: organization._id,
      referenceId: query,
      createdAt: moment().subtract(5, "days").toDate(),
    });
    const log2 = await LogFactory.create({
      organizationId: organization._id,
      referenceId: query,
      createdAt: moment().subtract(1, "minute").toDate(),
    });

    // below logs are decoys
    await LogFactory.create({
      organizationId: organization._id,
      referenceId: query + "g",
      createdAt: moment().subtract(4, "days").toDate(),
    });
    await LogFactory.create({
      referenceId: query,
      createdAt: moment().subtract(2, "days").toDate(),
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/support-logs`,
      "GET",
      {},
      {
        query,
      },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { logs } = res.body;
    expect(logs.length).toBe(4);

    expect(integrationLogsSpy).toBeCalledTimes(1);
    expect(integrationLogsSpy.mock.calls[0][0]._id.toString()).toBe(
      organization._id.toString()
    );
    expect(integrationLogsSpy.mock.calls[0][1]).toBe(query);

    expect(logs[0]._id.toString()).toBe(log2.id);
    expect(logs[0].tag).toBeUndefined();
    expect(logs[1]._id.toString()).toBe("a");
    expect(logs[1].tag).toBe(simplifiedLogTagEnum.Error);
    expect(logs[2]._id.toString()).toBe(log1.id);
    expect(logs[2].tag).toBeUndefined();
    expect(logs[3]._id.toString()).toBe("b");
    expect(logs[3].tag).toBe(simplifiedLogTagEnum.Error);
  });
});

describe("ExchangeIntegrationOAuthToken", () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    await OAuthRequest.deleteMany();
  });
  it("correctly exchanges an oauth token and connects (intercom mocked)", async () => {
    const plaintextToken = faker.datatype.uuid();
    const code = faker.datatype.uuid();
    const setupFxnSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectSetupFunctionToRun")
      .mockImplementation(() => undefined);
    const axiosSpy = jest.spyOn(axios, "post").mockImplementation(() =>
      Promise.resolve({
        data: {
          token: plaintextToken,
        },
      })
    );
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const oauthRequest = await OAuthRequestFactory.create({
      organizationId: organization._id,
      isComplete: false,
      source: integrationTypeEnum.Intercom,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration-oauth-finish`,
      "POST",
      {
        sessionId: oauthRequest._id.toString(),
        code,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    expect(axiosSpy).toBeCalledTimes(1);
    expect(axiosSpy.mock.calls[0][1].code).toBe(code);

    expect(setupFxnSpy).toBeCalledTimes(1);
    expect(setupFxnSpy.mock.calls[0][0].type).toBe(
      integrationTypeEnum.Intercom
    );

    const updatedOAuthRequest = await OAuthRequest.findById(oauthRequest._id);
    expect(updatedOAuthRequest!.isComplete).toBe(true);

    const createdIntegrations = await Integration.find({
      organizationId: organization._id,
    });
    expect(createdIntegrations.length).toBe(1);
    expect(createdIntegrations[0].type).toBe(integrationTypeEnum.Intercom);

    const decryptedKeys =
      SecureIntegrationService.getDecryptedKeysForIntegration(
        createdIntegrations[0]
      );
    expect(decryptedKeys.length).toBe(1);
    expect(decryptedKeys[0].type).toBe(keyTypeEnum.AuthToken);
    expect(decryptedKeys[0].plaintextValue).toBe(plaintextToken);
  });
  it("fails to exchange an oauth token since the session ID isn't valid for this organization", async () => {
    const plaintextToken = faker.datatype.uuid();
    const code = faker.datatype.uuid();
    const axiosSpy = jest.spyOn(axios, "post").mockImplementation(() =>
      Promise.resolve({
        data: {
          token: plaintextToken,
        },
      })
    );
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const oauthRequest = await OAuthRequestFactory.create({
      isComplete: false,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration-oauth-finish`,
      "POST",
      {
        sessionId: oauthRequest._id.toString(),
        code,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Could not find a pending OAuth request with this session ID."
    );

    expect(axiosSpy).toBeCalledTimes(0);

    const updatedOAuthRequest = await OAuthRequest.findById(oauthRequest._id);
    expect(updatedOAuthRequest!.isComplete).toBe(false);

    const createdIntegrations = await Integration.find({
      organizationId: organization._id,
    });
    expect(createdIntegrations.length).toBe(0);
  });
  it("fails to exchange an oauth token since the session ID doesn't exist", async () => {
    const plaintextToken = faker.datatype.uuid();
    const code = faker.datatype.uuid();
    const axiosSpy = jest.spyOn(axios, "post").mockImplementation(() =>
      Promise.resolve({
        data: {
          token: plaintextToken,
        },
      })
    );
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const oauthRequest = await OAuthRequestFactory.create({
      organizationId: organization._id,
      isComplete: false,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration-oauth-finish`,
      "POST",
      {
        sessionId: organization._id.toString(),
        code,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Could not find a pending OAuth request with this session ID."
    );

    expect(axiosSpy).toBeCalledTimes(0);

    const updatedOAuthRequest = await OAuthRequest.findById(oauthRequest._id);
    expect(updatedOAuthRequest!.isComplete).toBe(false);

    const createdIntegrations = await Integration.find({
      organizationId: organization._id,
    });
    expect(createdIntegrations.length).toBe(0);
  });
  it("fails to exchange an oauth token since the integration failed (intercom mocked)", async () => {
    const code = faker.datatype.uuid();
    const axiosSpy = jest
      .spyOn(axios, "post")
      .mockImplementation(() =>
        Promise.reject({ message: "something wrong!" })
      );
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const oauthRequest = await OAuthRequestFactory.create({
      organizationId: organization._id,
      isComplete: false,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration-oauth-finish`,
      "POST",
      {
        sessionId: oauthRequest._id.toString(),
        code,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "something wrong!");

    expect(axiosSpy).toBeCalledTimes(1);
    expect(axiosSpy.mock.calls[0][1].code).toBe(code);

    const updatedOAuthRequest = await OAuthRequest.findById(oauthRequest._id);
    expect(updatedOAuthRequest!.isComplete).toBe(false);

    const createdIntegrations = await Integration.find({
      organizationId: organization._id,
    });
    expect(createdIntegrations.length).toBe(0);
  });
});

describe("GetIntegrationOAuthLink", () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    await OAuthRequest.deleteMany();
  });
  it("correctly gets an integration's oauth link (intercom example)", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration-oauth-link`,
      "GET",
      {},
      { integrationType: integrationTypeEnum.Intercom },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { url } = res.body;
    expect(url).toBeTruthy();

    const oauthRequest = await OAuthRequest.findOne({
      organizationId: organization._id,
      source: integrationTypeEnum.Intercom,
      isComplete: false,
    });
    expect(oauthRequest).toBeTruthy();
    expect(url.includes(`state=${oauthRequest?._id.toString()}`)).toBe(true);
  });
  it("fails to get an oauth link for an integration that doesn't have oauth", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration-oauth-link`,
      "GET",
      {},
      { integrationType: integrationTypeEnum.Sentry },
      user.firebaseId
    );
    TestHelper.expectError(res, "OAuth is not an option for this integration.");

    const oauthRequest = await OAuthRequest.findOne({
      organizationId: organization._id,
      source: integrationTypeEnum.Sentry,
    });
    expect(oauthRequest).toBeNull();
  });
});

describe("GetIntegrationLogs", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });
  it("correctly gets the integration logs without a query", async () => {
    const query = "";

    const integrationLogsSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectLogsFunctionToRun")
      .mockImplementation(
        () =>
          (
            org: OrganizationDocument,
            integration: IntegrationDocument,
            query?: string
          ) =>
            Promise.resolve([])
      );

    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    await LogFactory.create({
      organizationId: organization._id,
      referenceId: query,
      createdAt: moment().subtract(5, "days").toDate(),
    });

    const integration = await IntegrationFactory.create({
      organizationId: organization._id,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration-logs`,
      "GET",
      {},
      {
        integrationId: integration._id.toString(),
        query,
      },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { logs } = res.body;
    expect(logs.length).toBe(0);

    expect(integrationLogsSpy).toBeCalledTimes(1);
    expect(integrationLogsSpy.mock.calls[0][0]._id.toString()).toBe(
      integration.id
    );
  });
  it("correctly gets the integration logs with a query", async () => {
    const query = "test";

    const integrationLogsSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectLogsFunctionToRun")
      .mockImplementation(
        () =>
          (
            org: OrganizationDocument,
            integration: IntegrationDocument,
            query?: string
          ) =>
            Promise.resolve([
              {
                _id: "bca",
                content: "aaa",
                createdAt: moment().subtract(7, "days").toDate(),
                tag: simplifiedLogTagEnum.Error,
              },
            ])
      );

    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    await LogFactory.create({
      organizationId: organization._id,
      referenceId: query,
      createdAt: moment().subtract(5, "days").toDate(),
    });

    const integration = await IntegrationFactory.create({
      organizationId: organization._id,
    });

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration-logs`,
      "GET",
      {},
      {
        integrationId: integration._id.toString(),
        query,
      },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { logs } = res.body;
    expect(logs.length).toBe(1);
    expect(logs[0]._id.toString()).toBe("bca");

    expect(integrationLogsSpy).toBeCalledTimes(1);
    expect(integrationLogsSpy.mock.calls[0][0]._id.toString()).toBe(
      integration.id
    );
  });
  it("fails to get the integration logs for an integration not in the organization", async () => {
    const query = "test";

    const integrationLogsSpy = jest.spyOn(
      SecureIntegrationService,
      "getCorrectLogsFunctionToRun"
    );

    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    await LogFactory.create({
      organizationId: organization._id,
      referenceId: query,
      createdAt: moment().subtract(5, "days").toDate(),
    });

    const integration = await IntegrationFactory.create();

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/integration-logs`,
      "GET",
      {},
      {
        integrationId: integration._id.toString(),
        query,
      },
      user.firebaseId
    );
    TestHelper.expectError(res, "Could not find an integration with this ID.");

    expect(integrationLogsSpy).toBeCalledTimes(0);
  });
});

describe("AskQuestion", () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it("correctly asks a question about some data and gets a response", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const innerFxn = jest.fn(
      (
        _organization: OrganizationDocument,
        integration: IntegrationDocument,
        _query?: string
      ) =>
        Promise.resolve([
          {
            _id: "abc",
            content: "def",
            createdAt: integration["createdAt"],
            tag: simplifiedLogTagEnum.Error,
          },
        ])
    );
    const getLogsFunctionToRunSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectLogsFunctionToRun")
      .mockImplementation(() => innerFxn);

    const responseToReturn = "hello there sir!!!";
    const getCompletionResponseSpy = jest
      .spyOn(QuestionAnswerService, "getCompletionResponse")
      .mockImplementation(() => Promise.resolve(responseToReturn));

    const integration = await IntegrationFactory.create({
      organizationId: organization._id,
    });

    const question = "how many dogs are in the US?";

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/question`,
      "POST",
      {
        question,
        integrationId: integration._id,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);

    const { response } = res.body;
    expect(response).toBe(responseToReturn);

    expect(getLogsFunctionToRunSpy).toBeCalledTimes(1);
    expect(getCompletionResponseSpy).toBeCalledTimes(1);
    expect(
      getCompletionResponseSpy.mock.calls[0][0].includes(question)
    ).toBeTruthy();
  });
  it("fails to ask a question that is too long", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const innerFxn = jest.fn(
      (
        _organization: OrganizationDocument,
        integration: IntegrationDocument,
        _query?: string
      ) =>
        Promise.resolve([
          {
            _id: "abc",
            content: "def",
            createdAt: integration["createdAt"],
            tag: simplifiedLogTagEnum.Error,
          },
        ])
    );
    const getLogsFunctionToRunSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectLogsFunctionToRun")
      .mockImplementation(() => innerFxn);

    const responseToReturn = "hello there sir!!!";
    const getCompletionResponseSpy = jest
      .spyOn(QuestionAnswerService, "getCompletionResponse")
      .mockImplementation(() => Promise.resolve(responseToReturn));

    const integration = await IntegrationFactory.create({
      organizationId: organization._id,
    });

    const question =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/question`,
      "POST",
      {
        question,
        integrationId: integration._id,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Your question is too long. Please make sure it is no longer than 750 characters."
    );

    expect(getLogsFunctionToRunSpy).toBeCalledTimes(0);
    expect(getCompletionResponseSpy).toBeCalledTimes(0);
  });
  it("fails to ask a question about an integration from a different organization", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });

    const innerFxn = jest.fn(
      (
        _organization: OrganizationDocument,
        integration: IntegrationDocument,
        _query?: string
      ) =>
        Promise.resolve([
          {
            _id: "abc",
            content: "def",
            createdAt: integration["createdAt"],
            tag: simplifiedLogTagEnum.Error,
          },
        ])
    );
    const getLogsFunctionToRunSpy = jest
      .spyOn(SecureIntegrationService, "getCorrectLogsFunctionToRun")
      .mockImplementation(() => innerFxn);

    const responseToReturn = "hello there sir!!!";
    const getCompletionResponseSpy = jest
      .spyOn(QuestionAnswerService, "getCompletionResponse")
      .mockImplementation(() => Promise.resolve(responseToReturn));

    const integration = await IntegrationFactory.create();

    const question =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const res = await TestHelper.sendRequest(
      routeUrl + `/${user.organizationId.toString()}/question`,
      "POST",
      {
        question,
        integrationId: integration._id,
      },
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, "This integration could not be found.");

    expect(getLogsFunctionToRunSpy).toBeCalledTimes(0);
    expect(getCompletionResponseSpy).toBeCalledTimes(0);
  });
});
