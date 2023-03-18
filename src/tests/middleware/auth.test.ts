import { ErrorMessages } from "src/utils/errors";

import { OrganizationFactory } from "../factories/OrganizationFactory";
import { UserFactory } from "../factories/UserFactory";
import { TestHelper } from "../TestHelper";

const routeUrl = "/only-test-routes";

describe("FailsAuthIfNotAuthenticatedUser", () => {
  it("fails auth if not an authenticated user", async () => {
    const res = await TestHelper.sendRequest(
      routeUrl + "/required-user",
      "GET",
      {},
      {}
    );
    TestHelper.expectError(res, ErrorMessages.NoPermission);
  });
  it("passes auth as an authenticated user making the request", async () => {
    const user = await UserFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + "/required-user",
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
  });
});

describe("FailsAuthIfNotAdmin", () => {
  it("fails auth if not an admin user", async () => {
    const user = await UserFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + "/required-admin",
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, ErrorMessages.NoPermission);
  });
  it("fails auth if not an admin user", async () => {
    const res = await TestHelper.sendRequest(
      routeUrl + "/required-admin",
      "GET",
      {},
      {}
    );
    TestHelper.expectError(res, ErrorMessages.NoPermission);
  });
  it("passes auth as an admin user", async () => {
    const user = await UserFactory.create({ isAdmin: true });
    const res = await TestHelper.sendRequest(
      routeUrl + "/required-admin",
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
  });
});

describe("FailsAuthIfNotOrganizationMember", () => {
  it("fails auth if not an organization member", async () => {
    const org = await OrganizationFactory.create();
    const user = await UserFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${org._id.toString()}/required-org-member`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectError(res, ErrorMessages.NoPermission);
  });
  it("fails auth if not an organization member", async () => {
    const org = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + `/${org._id.toString()}/required-org-member`,
      "GET",
      {},
      {}
    );
    TestHelper.expectError(res, ErrorMessages.NoPermission);
  });
  it("passes auth as an organization member", async () => {
    const org = await OrganizationFactory.create();
    const user = await UserFactory.create({
      organizationId: org._id,
    });
    const res = await TestHelper.sendRequest(
      routeUrl + `/${org._id.toString()}/required-org-member`,
      "GET",
      {},
      {},
      user.firebaseId
    );
    TestHelper.expectSuccess(res);
  });
});

describe("FailsAuthIfIncorrectApiCredentials", () => {
  it("fails auth if the api key is incorrect", async () => {
    const org = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + "/required-api-key",
      "GET",
      {},
      {},
      undefined,
      org["plaintextSecretKey"],
      org.keys.publishableApiKey + "a"
    );
    TestHelper.expectError(res, ErrorMessages.ApiCredentialsIncorrect);
  });
  it("fails auth if the secret key is incorrect", async () => {
    const org = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + "/required-api-key",
      "GET",
      {},
      {},
      undefined,
      org["plaintextSecretKey"] + "a",
      org.keys.publishableApiKey
    );
    TestHelper.expectError(res, ErrorMessages.ApiCredentialsIncorrect);
  });
  it("passes auth with the correct api key and secret key", async () => {
    const org = await OrganizationFactory.create();
    const res = await TestHelper.sendRequest(
      routeUrl + "/required-api-key",
      "GET",
      {},
      {},
      ...TestHelper.extractApiKeys(org)
    );
    TestHelper.expectSuccess(res);
  });
});
