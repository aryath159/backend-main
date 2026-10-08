// dotenv must be the first import so env vars exist before any other module reads them
import "dotenv/config";

import connectDB from "./db/index.js";
import { app } from "./app.js";

const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server is running at port ${PORT}`);
    });

    // handle server level errors
    server.on("error", (err) => {
      console.log("Server error: ", err);
    });
  })
  .catch((err) => {
    console.log("MONGO DB connection failed: ", err);
  });
