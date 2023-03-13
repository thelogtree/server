import {
  clearDatabase,
  connectMongoose,
  disconnectMongoose,
} from "./testConnection";

beforeAll(connectMongoose);
beforeEach(clearDatabase);
afterAll(disconnectMongoose);
