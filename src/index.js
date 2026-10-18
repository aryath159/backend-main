// dotenv must be the first import so env vars exist before any other module reads them
import "dotenv/config";

import connectDB from "./db/index.js";
import { app } from "./app.js";

const PORT = process.env.PORT || 8000;

// write saftey net here
// the app may be in broken state , so log and exit 

process.on("unhandledRejection" , (reason) =>{
    console.error("unhandled Rejection", reason) ;
    process.exit(1) ;
})


process.on("uncaughtException" , (err)=>{
    console.log("unhandled exception" , err) ;
    process.exit(1) ;
})

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server is running at port ${PORT}`);
    });

    // handle server level errors
    server.on("error", (err) => {
      console.log("Server error: ", err);
      process.exit(1) ;
    });
  })
  .catch((err) => {
    console.log("MONGO DB connection failed: ", err);
    process.exit(1) ;
  });
