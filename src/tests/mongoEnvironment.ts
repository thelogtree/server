const { MongoMemoryServer } = require("mongodb-memory-server");
const NodeEnvironment = require("jest-environment-node");

class MongoEnvironment extends NodeEnvironment {
  constructor(config) {
    super(config);
    this.dbName = `db-${(Math.random() * 1000000000000).toFixed()}`;
  }

  async setup() {
    await super.setup();
    if (typeof this.global.TextEncoder === "undefined") {
      const { TextEncoder } = require("util");
      this.global.TextEncoder = TextEncoder;
    }
    if (typeof this.global.TextDecoder === "undefined") {
      const { TextDecoder } = require("util");
      this.global.TextDecoder = TextDecoder;
    }

    this.mongod = await MongoMemoryServer.create({
      instance: {
        dbName: this.dbName,
      },
      binary: {
        version: "4.4.1",
      },
    });

    this.global.__MONGO_URI__ = this.mongod.getUri();
    this.global.__MONGO_DB_NAME__ = this.mongod.instanceInfo.dbName;

    // this is used to have different names for documents created while testing
    this.global.__COUNTERS__ = {
      user: 0,
    };
  }

  async teardown() {
    await super.teardown();
    await this.mongod.stop();
  }

  runScript(script) {
    return super.runScript(script);
  }
}

module.exports = MongoEnvironment;
