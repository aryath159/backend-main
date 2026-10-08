import { Router } from "express";
import { createTweet, deleteTweet, getUserTweets, updateTweet } from "../controllers/tweet.controller.js"

import { verifyJWT , verifyJWTOptional } from "../middlewares/auth.middleware.js";

const router = Router() ;

// anybody can read tweets
router.route("/user/:userId").get(verifyJWTOptional , getUserTweets);

// writing needs a login
router.route("/").post(verifyJWT , createTweet) ;
router.route("/:tweetId").patch(verifyJWT , updateTweet).delete(verifyJWT , deleteTweet) ;

export default router ;
