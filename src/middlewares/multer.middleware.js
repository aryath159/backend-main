import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const TEMP_DIR = "./public/temp";

// the folder is empty in git, so make sure it exists
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TEMP_DIR);
  },
  filename: function (req, file, cb) {
    // unique name so two users uploading "video.mp4" never overwrite each other
    const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB (Cloudinary free plan limit)
});
