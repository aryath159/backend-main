import { Router } from "express";
import {addComment, deleteComment, getVideoComments, updateComment} from "../controllers/comment.controller.js"

import { verifyJWT } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/multer.middleware";


const router = Router() ;

router.use(verifyJWT , upload.none()) ; // apply verify jwt to all

router.route("/:videoId").get(getVideoComments).post(addComment) ;
router.route("/c/:commentId").delete(deleteComment).patch(updateComment) ;

export default router ;