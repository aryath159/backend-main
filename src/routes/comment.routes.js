import { Router } from "express";
import { addComment, deleteComment, getVideoComments, updateComment } from "../controllers/comment.controller.js"

import { verifyJWT , verifyJWTOptional } from "../middlewares/auth.middleware.js";


const router = Router() ;

// guests can read comments (isLiked is only filled for a logged in viewer)
router.route("/:videoId").get(verifyJWTOptional , getVideoComments)

// everything else needs a login
router.route("/:videoId").post(verifyJWT , addComment) ;
router.route("/c/:commentId").delete(verifyJWT , deleteComment).patch(verifyJWT , updateComment) ;

export default router ;
