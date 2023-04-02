import { OrganizationFactory } from "src/tests/factories/OrganizationFactory";
import { TestHelper } from "../../TestHelper";
import { UserFactory } from "../../factories/UserFactory";
import bcrypt from "bcrypt";
import { config } from "src/utils/config";
import { OrgInvitation } from "src/models/OrgInvitation";
import { Organization } from "src/models/Organization";
import { FolderFactory } from "src/tests/factories/FolderFactory";
import { LogFactory } from "src/tests/factories/LogFactory";
import { OrgInvitationFactory } from "src/tests/factories/OrgInvitationFactory";
import faker from "faker";
import { DateTime } from "luxon";
import moment from "moment";
import { Log } from "src/models/Log";
import { Folder } from "src/models/Folder";
import { orgPermissionLevel } from "logtree-types";
import { User } from "src/models/User";
import { FirebaseMock } from "src/tests/mocks/FirebaseMock";
import { FavoriteFolder } from "src/models/FavoriteFolder";
import { FavoriteFolderFactory } from "src/tests/factories/FavoriteFolderFactory";
import { LastCheckedFolderFactory } from "src/tests/factories/LastCheckedFolderFactory";
import { FolderService } from "src/services/ApiService/lib/FolderService";
import { LastCheckedFolder } from "src/models/LastCheckedFolder";
import { FolderPreferenceFactory } from "src/tests/factories/FolderPreferenceFactory";
import { FolderPreference } from "src/models/FolderPreference";

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
    expect(folders[1].children[1].children[0].hasUnreadLogs).toBeTruthy();
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
    expect(Object.keys(logs[0]).length).toBe(3);
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
    expect(Object.keys(logs[0]).length).toBe(4);
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
    expect(Object.keys(logs[0]).length).toBe(3);
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
    expect(Object.keys(logs[0]).length).toBe(4);
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
      createdAt: moment().subtract(2, "minutes"),
    });
    await LogFactory.create({
      folderId: folder._id,
      createdAt: moment().subtract(2, "days"),
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/folder-stats`,
      "GET",
      {},
      { folderId: folder.id },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { percentageChange, phrasing } = res.body;
    expect(phrasing).toBeTruthy();
    expect(percentageChange).toBeGreaterThan(0);
  });
  it("fails to get a folder's stats from a different organization", async () => {
    const organization = await OrganizationFactory.create();
    const user = await UserFactory.create({ organizationId: organization._id });
    const folder = await FolderFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${organization.id}/folder-stats`,
      "GET",
      {},
      { folderId: folder.id },
      user.firebaseId
    );
    TestHelper.expectError(
      res,
      "Cannot get the folder stats of a folder in a different organization."
    );
  });
});
