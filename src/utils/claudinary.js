import { v2 as claudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLAUDINARY_CLOUD_NAME,
  api_key: process.env.CLAUDINARY_API_KEY,
  api_secret: process.env.CLAUDINARY_API_SECRET,
});

const uploadFileOnClaudinary = async (localfilepath) => {
  try {
    if (!localfilepath) {
      return null;
    }

    //uploding file on claudinary
    const resp = await claudinary.uploader.upload(localfilepath, {
      resource_type: "auto",
    });

    console.log("file uploaded on cloudinary successfully : ", resp.url);
    return resp ;

  } catch (error) {
    fs.unlinkSync(localfilepath);   // removes the locally saved temporary file as 
    // the upload operation got failed 
    return null ;
  }
};

export { uploadFileOnClaudinary } ;
