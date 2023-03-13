import mongoose from "mongoose";

declare let global: any;

export async function connectMongoose() {
  jest.setTimeout(40000);
  return mongoose.connect(
    global.__MONGO_URI__ /*, {
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
    useUnifiedTopology: true,
    autoIndex: true,
  }*/
  );
}

export async function clearDatabase() {
  return mongoose.connection.db.dropDatabase();
}

export async function disconnectMongoose() {
  return mongoose.disconnect();
}
