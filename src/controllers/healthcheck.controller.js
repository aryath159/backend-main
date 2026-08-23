import { asyncHandler } from "../utils/asyncHandler";
import {ApiResponse} from "../utils/ApiResponse.js";
import {ApiError} from "../utils/apiError.js";

import {Tweet} from "../models/tweet.models.js" ;
import {User} from "../models/user.models.js";

import mongoose , {isValidObjectId} from "mongoose";

const healthcheck = asyncHandler(async(req, res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200 , {message: "Everything is ok "} , "ok")) ;
});

export {healthcheck} ;