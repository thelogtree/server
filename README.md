# Server

## Setup

1. clone the repo
2. `cd server && yarn`
3. Get a `.env` file from another engineer and place it into the root of the repo.
4. Setup redis in docker locally (ask an engineer how)
5. `npm run dev` starts the server in debug mode
6. `npm run test` runs all tests using jest

## Running Backfills

1. Write your script and copy the overall setup from `src/backfills/08_14_2022_example.ts`.
2. Test your backfill on individual documents (if we have staging setup, use staging for this step. If we don't, use prod carefully in this step.) before having it change all documents in prod. If we have a staging database setup, change the mongo uri for the backfill and connect to that staging database and do a full test run. Once confident it will work, you can run on prod.
3. To actually run a backfill, go to your terminal inside the /server folder root and run this command: `npx ts-node src/backfills/YOUR_FILE_NAME.ts`

## Best Practices

- Route -> Validator (middleware) -> Controller (middleware) -> Service (called by controller)
- When throwing an error, do `throw new ApiError` (or use/create another error class from `src/utils/errors.ts`) instead of `throw new Error`. This is necessary so that `TestHelper.expectError` works properly.
- Don't call multiple endpoints in a single unit test. If you need to create a user for example to use for your test, use the `UserFactory` or create another factory equivalent.
