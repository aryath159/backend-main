import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLAUDINARY_CLOUD_NAME,
  api_key: process.env.CLAUDINARY_API_KEY,
  api_secret: process.env.CLAUDINARY_API_SECRET,
});

const uploadFileOnCloudinary = async (localfilepath) => {
  try {
    if (!localfilepath) {
      return null;
    }

    //uploding file on claudinary
    const resp = await cloudinary.uploader.upload(localfilepath, {
      resource_type: "auto",
    });

    console.log("file uploaded on cloudinary successfully : ", resp.url);
    fs.unlinkSync(localfilepath);   
    return resp ;

  } catch (error) {
        // Clean up local file synchronously if upload operation fails
       if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    console.error("Cloudinary upload failed:", error);
    return null;
    
  }
};

export { uploadFileOnCloudinary } ;
