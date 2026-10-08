import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT , verifyJWTOptional } from "../middlewares/auth.middleware.js";

import {deleteVideo, getAllVideos, getVideobyId, publishAVideo, togglePublishStatus, updateVideo } from "../controllers/video.controller.js"

const router = Router() ;

router.route("/").get(getAllVideos).post( verifyJWT , upload.fields([
    {
        name : "videoFile",
        maxCount:1
    },
    {
        name:"thumbnail",
        maxCount:1
    }
]), publishAVideo) ;

// guests can watch a video, a logged in viewer also gets isLiked / isSubscribed / history
router.route("/v/:videoId").get(verifyJWTOptional , getVideobyId )
.delete(verifyJWT , deleteVideo)
.patch(verifyJWT , upload.single("thumbnail"), updateVideo) ;

router.route("/toggle/publish/:videoId").patch(verifyJWT , togglePublishStatus) ;

export default router ;
