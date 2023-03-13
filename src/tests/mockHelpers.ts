export const fakePromise = jest.fn(() => Promise.resolve({} as any));
export const fakeRejectedPromise = jest.fn(() =>
  Promise.reject("some error message")
);