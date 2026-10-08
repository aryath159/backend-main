import mongoose from "mongoose";
import { Video } from "../models/video.models.js";
import { Subscription } from "../models/subscription.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


// get the channel stats like total video views , total subscribers
// total videos , total likes etc
const getChannelStats = asyncHandler(async (req , res) => {
    const userId = new mongoose.Types.ObjectId(req.user?._id) ;

    const totalSubscribers = await Subscription.countDocuments({
        channel : userId
    });

    const video = await Video.aggregate([
        {
            $match : {
                owner : userId
            }
        },
        {
            $lookup : {
                from : "likes",
                localField : "_id",
                foreignField : "video",
                as : "likes"
            }
        },
        {
            $project : {
                totalLikes : {
                    $size : "$likes"
                },
                totalViews : "$views"
            }
        },
        {
            $group : {
                _id : null ,
                totalLikes : {
                    $sum : "$totalLikes"
                },
                totalViews : {
                    $sum : "$totalViews"
                },
                totalVideos : {
                    $sum : 1
                }
            }
        }
    ]);

    const channelStats = {
        totalSubscribers ,
        totalLikes : video[0]?.totalLikes || 0 ,
        totalViews : video[0]?.totalViews || 0 ,
        totalVideos : video[0]?.totalVideos || 0
    };

    return res
    .status(200)
    .json(
        new ApiResponse(200 , channelStats , "channel stats fetched successfully")
    ) ;
}) ;

// every video of the logged in channel (published or not)
const getChannelVideos = asyncHandler(async (req , res) => {

    const userId = new mongoose.Types.ObjectId(req.user?._id) ;

    const videos = await Video.aggregate([
        {
            $match : {
                owner : userId
            }
        },
        {
            $sort : {
                createdAt : -1
            }
        },
        {
            $lookup : {
                from : "likes",
                localField : "_id",
                foreignField : "video",
                as : "likes"
            }
        },
        {
            $addFields : {
                likesCount : {
                    $size : "$likes"
                }
            }
        },
        {
            $project : {
                _id : 1 ,
                "thumbnail.url" : 1 ,
                title : 1 ,
                description : 1 ,
                duration : 1 ,
                views : 1 ,
                createdAt : 1 ,
                isPublished : 1 ,
                likesCount : 1
            }
        }
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200 , videos , "channel videos fetched successfully"))
}) ;

export { getChannelStats , getChannelVideos }
