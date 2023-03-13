import { executeJob } from "./lib";

// -- write a description here on what the backfill does -- //
const executeBackfillBody = async () => {
  // -- write your code here -- //
};

// see ReadMe on how to execute your backfill through the terminal.
// remember to remove your mongo connection string below before committing the change so it is not viewable on the github repo!!!!
// also be aware about whether this connection string points to staging or production.
executeJob(executeBackfillBody, "your_mongo_connection_string");
