import { Router } from "express";
import { changeCurrentPassword, coverImageUpdate, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser,
         RefreshAccessToken, registerUser, 
         UpdateAccountDetails,
         userAvatarUpdate} from "../controllers/user.controller.js";

import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router() ;

router.route("/register").post( 
    
    upload.fields([
        {
            name: "avatar" ,
            maxCount:1
        },
        {
            name: "coverImage",
            maxCount:1
        }
    ]) ,

    registerUser) ; // tested ok



router.route("/login" ).post(loginUser) // tested ok 

//secured routes 
router.route("/logout").post( verifyJWT , logoutUser) // tested ok

router.route("/refresh-token").post(RefreshAccessToken) // tested ok

router.route("/change-password").post(verifyJWT , changeCurrentPassword) // tested ok

router.route("/current-user").get(verifyJWT , getCurrentUser) // tested ok

router.route("/update-account").patch(verifyJWT , UpdateAccountDetails) // tested ok

router.route("/avatar").patch(verifyJWT , upload.single("avatar") , userAvatarUpdate) // tested ok

router.route("/cover-image").patch(verifyJWT , upload.single("coverImage") , coverImageUpdate) // tested ok

router.route("/c/:username").get(verifyJWT , getUserChannelProfile) // tested ok

router.route("/history").get(verifyJWT , getWatchHistory) // tested ok


export default router ;