import { TestHelper } from "../TestHelper";
import { UserFactory } from "../factories/UserFactory";

const routeUrl = "/organization";

// describe("FailsAuthIfNotTeamMember", () => {
//   it("correctly fails auth if the user is not a team member of this card issuer", async () => {
//     const user = await BusinessUserFactory.create();
//     const res = await TestHelper.sendRequest(
//       routeUrl + "/team",
//       "GET",
//       {},
//       {},
//       user.firebaseId
//     );
//     TestHelper.expectError(res, "Need a registered user to make this request");
//   });
//   it("correctly fails auth if there is no user making a request", async () => {
//     const res = await TestHelper.sendRequest(routeUrl + "/team", "GET", {}, {});
//     TestHelper.expectError(res, "Need a registered user to make this request");
//   });
// });

// describe("FailsAuthIfIncorrectApiCredentials", () => {
//   it("correctly fails auth if the api key is incorrect", async () => {
//     const cardIssuer = await CardIssuerFactory.create();
//     const res = await TestHelper.sendRequest(
//       routeUrl + "/cardholder",
//       "POST",
//       {},
//       {},
//       undefined,
//       cardIssuer.plaintextSecretKey,
//       cardIssuer.publishableApiKey + "a"
//     );
//     TestHelper.expectError(res, AUTH_API_CREDS_ERROR_MSG);
//   });
//   it("correctly fails auth if the secret key is incorrect", async () => {
//     const cardIssuer = await CardIssuerFactory.create();
//     const res = await TestHelper.sendRequest(
//       routeUrl + "/cardholder",
//       "POST",
//       {},
//       {},
//       undefined,
//       cardIssuer.plaintextSecretKey + "a",
//       cardIssuer.publishableApiKey
//     );
//     TestHelper.expectError(res, AUTH_API_CREDS_ERROR_MSG);
//   });
// });

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
