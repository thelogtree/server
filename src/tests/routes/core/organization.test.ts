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
    await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: null,
    });
    const folderTop2 = await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: null,
    });
    await FolderFactory.create(); // decoy
    await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: folderTop2._id,
    });
    const subfolder2 = await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: folderTop2._id,
    });
    const deeperSubfolder2 = await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: subfolder2._id,
    });
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
    expect(folders.length).toBe(2);
    expect(folders[0].children.length).toBe(0);
    expect(folders[1].children.length).toBe(2);
    expect(folders[1].children[0].children.length).toBe(0);
    expect(folders[1].children[1].children.length).toBe(1);
    expect(folders[1].children[1].children[0]._id.toString()).toBe(
      deeperSubfolder2._id.toString()
    );
    expect(folders[1].children[1].children[0].children.length).toBe(0);
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
    const { logs } = res.body;
    expect(logs.length).toBe(2);
    expect(Object.keys(logs[0]).length).toBe(3);
    expect(logs[0]._id.toString()).toBe(log2._id.toString());
    expect(logs[1]._id.toString()).toBe(log1._id.toString());
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
      { folderId: folder.id, start: 1 },
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
    const { logs } = res.body;
    expect(logs.length).toBe(1);
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
