import { orgPermissionLevel } from "logtree-types";
import { OrganizationFactory } from "../factories/OrganizationFactory";
import { UserFactory } from "../factories/UserFactory";
import { SendgridUtil } from "src/utils/sendgrid";

describe("GetEmailAddressesOfAllAdminsInOrganization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("correctly gets the email addresses of all the admins in an organization", async () => {
    const organization = await OrganizationFactory.create();
    await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Admin,
      email: "a",
    });
    await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Admin,
      email: "b",
    });
    await UserFactory.create({
      organizationId: organization._id,
      orgPermissionLevel: orgPermissionLevel.Member,
      email: "c",
    });
    await UserFactory.create({
      orgPermissionLevel: orgPermissionLevel.Admin,
      email: "d",
    });

    const emails =
      await SendgridUtil.getEmailAddressesOfAllAdminsInOrganization(
        organization._id.toString()
      );

    expect(emails).toEqual(expect.arrayContaining(["b", "a"]));
  });
});
