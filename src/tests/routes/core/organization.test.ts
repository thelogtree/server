import { OrganizationFactory } from "src/tests/factories/OrganizationFactory";
import { TestHelper } from "../../TestHelper";
import { UserFactory } from "../../factories/UserFactory";
import bcrypt from "bcrypt";
import { config } from "src/utils/config";
import { OrgInvitation } from "src/models/OrgInvitation";
import { Organization } from "src/models/Organization";
import { FolderFactory } from "src/tests/factories/FolderFactory";

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
      `${config.baseUrl}/${organization.slug}/invite/${invite?._id.toString()}`
    );
  });
});

describe("GetFolders", () => {
  it("correctly gets the folder array representation for an organization", async () => {
    const organization = await OrganizationFactory.create();
    const folderTop1 = await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: null,
    });
    const folderTop2 = await FolderFactory.create({
      organizationId: organization._id,
      parentFolderId: null,
    });
    await FolderFactory.create(); // decoy
    const subfolder1 = await FolderFactory.create({
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
