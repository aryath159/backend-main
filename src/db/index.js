import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      process.env.MONGODB_URI,
      { dbName: DB_NAME }
    );

    console.log(
      `\nMongoDB connected !! DB host: ${connectionInstance.connection.host}`
    );

    console.log("connectionInsatance object : ") ;
    console.log(connectionInstance.connection)
  } catch (error) {
    console.log("MONGODB connection error: ", error);
    // process.exit(1);
  }
};

export default connectDB;
