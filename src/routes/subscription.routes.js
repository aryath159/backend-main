import { Router } from "express";
import { getSubscribedChannels, getUserChannelSubscribers, toggleSubscription } from "../controllers/subscription.controller.js"

import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router() ;

// toggleSubscription uses req.user, so every route here needs a login
router.use(verifyJWT) ;

router.route("/c/:channelId").get(getUserChannelSubscribers).post(toggleSubscription) ;
router.route("/u/:subscriberId").get(getSubscribedChannels) ;

export default router ;
