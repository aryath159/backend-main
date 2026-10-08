import mongoose , { isValidObjectId } from "mongoose";
import { Like } from "../models/like.models.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req , res) => {
    const { videoId } = req.params ;

    // the old check was missing the "!", so every valid id was rejected
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400 , "invalid videoId");
    }

    const likedAlready = await Like.findOne({
        video : videoId ,
        likedBy : req.user?._id
    })

    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready._id);

        return res
        .status(200)
        .json(new ApiResponse(200 , { isLiked : false } , "like removed"));
    }

    await Like.create({
        video : videoId ,
        likedBy : req.user?._id
    })

    return res
    .status(200)
    .json(new ApiResponse(200 , { isLiked : true } , "video liked")) ;
})

const toggleCommentLike = asyncHandler(async (req , res) => {
    const { commentId } = req.params

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400 , "invalid commentId") ;
    }

    const likedAlready = await Like.findOne({
        comment : commentId ,
        likedBy : req.user?._id ,
    });

    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready._id);
        return res.status(200)
        .json(new ApiResponse(200 , { isLiked : false } , "like removed"));
    }

    await Like.create({
        comment : commentId ,
        likedBy : req.user?._id
    })

    return res.status(200)
        .json(new ApiResponse(200 , { isLiked : true } , "comment liked"));
})

const toggleTweetLike = asyncHandler(async (req , res) => {

    const { tweetId } = req.params

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400 , "invalid tweetId")
    }

    const likedAlready = await Like.findOne({
        tweet : tweetId ,
        likedBy : req.user?._id
    })

    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready._id);

        return res.status(200)
        .json(new ApiResponse(200 , { tweetId , isLiked : false } , "like removed"));
    }

    await Like.create({
        tweet : tweetId ,
        likedBy : req.user?._id ,
    });

    return res
        .status(200)
        .json(new ApiResponse(200 , { tweetId , isLiked : true } , "tweet liked"));
})

// returns the liked videos as a flat list of videos (newest like first)
const getLikedVideos = asyncHandler(async (req , res) => {
    const likedVideos = await Like.aggregate([
        {
            $match : {
                likedBy : new mongoose.Types.ObjectId(req.user?._id) ,
                video : { $exists : true , $ne : null }
            },
        },
        {
            $sort : {
                createdAt : -1
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "video",
                foreignField : "_id",
                as : "likedVideo",
                pipeline : [
                    {
                        $match : { isPublished : true }
                    },
                    {
                        $lookup : {
                            from : "users",
                            localField : "owner",
                            foreignField : "_id",
                            as : "owner",
                            pipeline : [
                                {
                                    $project : {
                                        username : 1 ,
                                        fullname : 1 ,
                                        avatar : 1
                                    }
                                }
                            ]
                        },
                    },
                    {
                        $addFields : {
                            owner : { $first : "$owner" }
                        }
                    }
                ],
            },
        },
        {
            $unwind : "$likedVideo",
        },
        {
            $replaceRoot : { newRoot : "$likedVideo" }
        },
        {
            $project : {
                videoFile : 0
            }
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200 ,
                likedVideos ,
                "liked videos fetched successfully"
            )
        );
});

export { toggleVideoLike , toggleCommentLike , toggleTweetLike , getLikedVideos }
