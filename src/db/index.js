import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";



mongoose.connection.on("error" , (err)=>{
  console.log("MongoDb error" , err)
})

mongoose.connection.on("disconnected" , ()=>{
  console.warn("mongodb disconnected") ;
})

mongoose.connection.on("reconnected" , () => {
  console.log("MongoDB reconnected") ;
})

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
    throw error ;
  }
};

export default connectDB;
