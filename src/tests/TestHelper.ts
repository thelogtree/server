import _ from "lodash";
import supertest from "supertest";

import { app } from "..";

type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";
const routeUrl = "/api";
export const DEFAULT_FIREBASE_ID_FAKE = "test-firebaseId";

class TestHelper {
  app: any;
  constructor() {
    this.app = app;
  }
  async sendRequest(
    endpoint: string,
    method: HTTPMethod,
    body?: Object,
    queryParams: Object = {},
    userFirebaseId: string = DEFAULT_FIREBASE_ID_FAKE,
    secretKey?: string,
    apiKey?: string
  ) {
    let res: any;
    //@ts-ignore
    let supertestServer = supertest(this.app);
    switch (method) {
      case "GET":
        res = await supertestServer
          .get(routeUrl + endpoint)
          .set({
            authorization: secretKey || `Bearer ${userFirebaseId}`,
            ...(apiKey && { "x-logtree-key": apiKey }),
          })
          .query(queryParams);
        break;
      case "POST":
        res = await supertestServer
          .post(routeUrl + endpoint)
          .set({
            authorization: secretKey || `Bearer ${userFirebaseId}`,
            ...(apiKey && { "x-logtree-key": apiKey }),
          })
          .send(body);
        break;
      case "PUT":
        res = await supertestServer
          .put(routeUrl + endpoint)
          .set({
            authorization: secretKey || `Bearer ${userFirebaseId}`,
            ...(apiKey && { "x-logtree-key": apiKey }),
          })
          .send(body);
        break;
      case "DELETE":
        res = await supertestServer.delete(routeUrl + endpoint).set({
          authorization: secretKey || `Bearer ${userFirebaseId}`,
          ...(apiKey && { "x-logtree-key": apiKey }),
        });
        break;
    }
    if (typeof res.body.success === "undefined") {
      res.body.success = true;
    }
    return res;
  }

  expectSuccess(res: any) {
    expect(_.get(res, "body.errorMessage")).toBeUndefined();
    expect(_.get(res, "body.success", false)).toBe(true);
  }

  expectError(res: any, message?: string, code?: number) {
    expect(_.get(res, "body.success")).not.toBe(true);
    if (message) {
      expect(res.body.errorMessage).toBe(message);
    }
    if (code) {
      expect(res.body.errorCode).toBe(code);
    }
  }

  extractApiKeys(organizationFromFactory) {
    return [
      undefined,
      organizationFromFactory["plaintextSecretKey"],
      organizationFromFactory.keys.publishableApiKey,
    ];
  }
}

const testHelperInstance = new TestHelper();
export { testHelperInstance as TestHelper };
