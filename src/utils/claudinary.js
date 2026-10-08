import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// configured lazily so the .env values are always loaded by now
// (both the correct CLOUDINARY_* and the old CLAUDINARY_* spelling work)
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name:
      process.env.CLOUDINARY_CLOUD_NAME || process.env.CLAUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY || process.env.CLAUDINARY_API_KEY,
    api_secret:
      process.env.CLOUDINARY_API_SECRET || process.env.CLAUDINARY_API_SECRET,
  });
};

const removeLocalFile = (localFilePath) => {
  try {
    if (localFilePath && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  } catch (error) {
    console.error("Could not remove temp file:", error);
  }
};

// delete every file multer saved for this request (used when validation fails)
const removeUploadedFiles = (req) => {
  const files = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  else if (req.files) Object.values(req.files).forEach((f) => files.push(...f));

  files.forEach((file) => removeLocalFile(file.path));
};

const uploadFileOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) {
      return null;
    }

    configureCloudinary();

    const resp = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    removeLocalFile(localFilePath);

    // always hand back the https url
    return { ...resp, url: resp.secure_url || resp.url };
  } catch (error) {
    // remove the temp file even when the upload fails
    removeLocalFile(localFilePath);
    console.error("Cloudinary upload failed:", error);
    return null;
  }
};

const deleteOnCloudinary = async (public_id, resource_type = "image") => {
  try {
    if (!public_id) return null;

    configureCloudinary();

    return await cloudinary.uploader.destroy(public_id, {
      resource_type: `${resource_type}`,
    });
  } catch (error) {
    console.log("delete on cloudinary failed, ", error);
    return null;
  }
};

export { uploadFileOnCloudinary, deleteOnCloudinary, removeUploadedFiles };
