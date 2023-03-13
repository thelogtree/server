import { jest } from "@jest/globals";
import faker from "faker";

export const FirebaseMock = {
  // lower level functions
  createUser: async (body: any) =>
    jest.fn(
      () => new Promise((resolve) => resolve({ uid: faker.datatype.uuid() }))
    )(),
  updateUser: async (body: any) =>
    jest.fn(
      () => new Promise((resolve) => resolve({ uid: faker.datatype.uuid() }))
    )(),
  deleteUser: async (body: any) =>
    jest.fn(
      () => new Promise((resolve) => resolve({ uid: faker.datatype.uuid() }))
    )(),
  verifyIdToken: async (idToken: any) =>
    jest.fn(
      () => new Promise((resolve) => resolve({ uid: faker.datatype.uuid() }))
    )(),
  createCustomToken: async (uid: string) =>
    jest.fn(() => new Promise((resolve) => resolve(faker.datatype.uuid())))(),
  generateEmailVerificationLink: async (email: string) =>
    jest.fn(() => new Promise((resolve) => resolve(faker.datatype.uuid())))(),

  // higher level functions
  auth: () => ({
    createUser: FirebaseMock.createUser,
    updateUser: FirebaseMock.updateUser,
    deleteUser: FirebaseMock.deleteUser,
    verifyIdToken: FirebaseMock.verifyIdToken,
    createCustomToken: FirebaseMock.createCustomToken,
    generateEmailVerificationLink: FirebaseMock.generateEmailVerificationLink,
  }),
};
