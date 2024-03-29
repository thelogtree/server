import { jest } from "@jest/globals";
import { FirebaseMock } from "./mocks/FirebaseMock";
import { TwilioMock } from "./mocks/TwilioMock";

jest.mock("axios");
jest.mock("@sendgrid/mail");
jest.mock("logtree-node");
jest.mock("openai");
jest.mock("twilio", () => TwilioMock);
jest.mock("firebase-admin", () => FirebaseMock);
