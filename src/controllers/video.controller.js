import mongoose , {isValidObjectId} from "mongoose"
import {Video} from "../models/video.models.js"
import {User} from "../models/user.models.js"
import {Comment} from "../models/comment.models.js"
import {Like} from "../models/like.models.js"
import {Playlist} from "../models/playlist.models.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import {
    uploadFileOnCloudinary ,
    deleteOnCloudinary ,
    removeUploadedFiles
} from "../utils/claudinary.js"

const SORTABLE_FIELDS = ["createdAt" , "views" , "duration" , "title"] ;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g , "\\$&") ;

const getAllVideos = asyncHandler( async (req , res) => {

    const { page = 1 , limit = 10 , query , sortBy , sortType , userId } = req.query

    const pipeline = [] ;

    // Option 1 (needs MongoDB Atlas): full text search using a search index called "search-videos"
    // Option 2 (default, works on any MongoDB): case-insensitive match on title / description
    if (typeof query === "string" && query.trim()) {
        if (process.env.USE_ATLAS_SEARCH === "true") {
            pipeline.push({
                $search : {
                    index : "search-videos",
                    text : {
                        query : query.trim() ,
                        path : ["title" , "description"]
                    }
                }
            });
        } else {
            const regex = new RegExp(escapeRegex(query.trim()) , "i") ;
            pipeline.push({
                $match : {
                    $or : [{ title : regex } , { description : regex }]
                }
            });
        }
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400 , "Invalid userId");
        }

        pipeline.push({
            $match : {
                owner : new mongoose.Types.ObjectId(userId)
            }
        });
    }

    // only published videos
    pipeline.push({ $match : { isPublished : true } });

    // sortBy can be views , createdAt , duration - sortType is "asc" or "desc"
    if (sortBy && SORTABLE_FIELDS.includes(sortBy)) {
        pipeline.push({
            $sort : {
                [sortBy] : sortType === "asc" ? 1 : -1
            }
        })
    } else {
        pipeline.push({ $sort : { createdAt : -1 } }) ;
    }

    pipeline.push(
        {
            $lookup : {
                from : "users",
                localField : "owner",
                foreignField : "_id",
                as : "owner",
                pipeline : [
                    {
                        $project : {
                            username : 1,
                            fullname : 1,
                            avatar : 1
                        }
                    }
                ]
            }
        },
        {
            $unwind : "$owner"
        }
    )

    const videoAggregate = Video.aggregate(pipeline) ;

    const options = {
        page : Math.max(parseInt(page , 10) || 1 , 1),
        limit : Math.min(Math.max(parseInt(limit , 10) || 10 , 1) , 50)
    };

    const videos = await Video.aggregatePaginate(videoAggregate , options);

    return res.status(200)
    .json(new ApiResponse(200 , videos , "videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req , res) => {

    try {
        const { title , description } = req.body

        // get video , upload to cloudinary , create video
        if ([title , description].some((field) => typeof field !== "string" || field.trim() === "")) {
            throw new ApiError(400 , "title and description are required");
        }

        const videoFileLocalPath = req.files?.videoFile?.[0]?.path ;
        const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path ;

        if (!videoFileLocalPath) {
            throw new ApiError(400 , "video file is required") ;
        }

        if (!thumbnailLocalPath) {
            throw new ApiError(400 , "thumbnail is required") ;
        }

        const videoFile = await uploadFileOnCloudinary(videoFileLocalPath);
        const thumbnail = await uploadFileOnCloudinary(thumbnailLocalPath) ;

        if (!videoFile) {
            throw new ApiError(400 , "video upload failed, please try again") ;
        }

        if (!thumbnail) {
            // don't leave the video orphaned on cloudinary
            await deleteOnCloudinary(videoFile.public_id , "video") ;
            throw new ApiError(400 , "thumbnail upload failed, please try again")
        }

        const video = await Video.create({
            title : title.trim() ,
            description : description.trim() ,
            duration : Math.round(videoFile.duration || 0) ,
            videoFile : {
                url : videoFile.url ,
                public_id : videoFile.public_id
            },
            thumbnail : {
                url : thumbnail.url ,
                public_id : thumbnail.public_id
            },
            owner : req.user?._id ,
            isPublished : true
        })

        return res
        .status(201)
        .json(new ApiResponse(201 , video , "video uploaded successfully"))
    } catch (error) {
        removeUploadedFiles(req) ;
        throw error ;
    }
}) ;

const getVideobyId = asyncHandler( async (req , res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400 , "Invalid videoId") ;
    }

    // guests have no req.user -> null never matches a like / subscriber
    const viewerId = req.user?._id ?? null ;

    const video = await Video.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(videoId)
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
            $lookup : {
                from : "users",
                localField : "owner",
                foreignField : "_id",
                as : "owner",
                pipeline : [
                    {
                        $lookup : {
                            from : "subscriptions",
                            localField : "_id",
                            foreignField : "channel",
                            as : "subscribers"
                        }
                    },
                    {
                        $addFields : {
                            subscribersCount : {
                                $size : "$subscribers"
                            },
                            isSubscribed : {
                                $cond : {
                                    if : {
                                        $in : [
                                            viewerId ,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then : true ,
                                    else : false
                                }
                            }
                        }
                    },
                    {
                        $project : {
                            username : 1 ,
                            fullname : 1 ,
                            avatar : 1 ,
                            subscribersCount : 1 ,
                            isSubscribed : 1
                        }
                    }
                ]
            }
        },
        {
            $addFields : {
                likesCount : {
                    $size : "$likes"
                },
                owner : {
                    $first : "$owner"
                },
                isLiked : {
                    $cond : {
                        if : { $in : [ viewerId , "$likes.likedBy" ] } ,
                        then : true ,
                        else : false
                    }
                }
            }
        },
        {
            $project : {
                "videoFile.url" : 1 ,
                "thumbnail.url" : 1 ,
                title : 1 ,
                description : 1 ,
                views : 1 ,
                createdAt : 1 ,
                duration : 1 ,
                isPublished : 1 ,
                owner : 1 ,
                likesCount : 1 ,
                isLiked : 1
            }
        }
    ]);

    // aggregate always returns an array, so check its length
    if (!video?.length) {
        throw new ApiError(404 , "video not found");
    }

    const videoData = video[0] ;

    // unpublished videos can only be opened by their owner
    const isOwner = viewerId && String(videoData.owner?._id) === String(viewerId) ;
    if (!videoData.isPublished && !isOwner) {
        throw new ApiError(404 , "video not found");
    }

    // increment the view count
    await Video.findByIdAndUpdate(videoId , { $inc : { views : 1 } });
    videoData.views += 1 ;

    // add to the watch history of the logged in user (most recent last)
    if (req.user) {
        await User.updateOne({ _id : req.user._id } , { $pull : { watchHistory : videoId } });
        await User.updateOne({ _id : req.user._id } , { $push : { watchHistory : videoId } });
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200 , videoData , "video details fetched successfully")
    );
});


// update video details like title description thumbnail (all optional)
const updateVideo = asyncHandler(async (req , res) => {
    const { videoId } = req.params

    const { title , description } = req.body ;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400 , "invalid videoId");
    }

    const thumbnailLocalPath = req.file?.path ;

    if (!(title || description || thumbnailLocalPath)) {
        throw new ApiError(400 , "provide a title, description or thumbnail to update")
    }

    const video = await Video.findById(videoId) ;

    if (!video) {
        removeUploadedFiles(req) ;
        throw new ApiError(404 , "no video found") ;
    }

    if (video.owner.toString() !== req.user?._id.toString()) {
        removeUploadedFiles(req) ;
        throw new ApiError(
            403 , "you can't edit this video as you are not the owner"
        );
    }

    const fieldsToUpdate = {} ;
    if (title?.trim()) fieldsToUpdate.title = title.trim() ;
    if (description?.trim()) fieldsToUpdate.description = description.trim() ;

    const oldThumbnailId = video.thumbnail?.public_id ;

    if (thumbnailLocalPath) {
        const thumbnail = await uploadFileOnCloudinary(thumbnailLocalPath) ;

        if (!thumbnail) {
            throw new ApiError(400 , "thumbnail upload failed, please try again")
        }

        fieldsToUpdate.thumbnail = {
            public_id : thumbnail.public_id ,
            url : thumbnail.url
        }
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId ,
        { $set : fieldsToUpdate },
        { new : true }
    );

    if (!updatedVideo) {
        throw new ApiError(500 , "failed to update video, please try again")
    }

    // new thumbnail saved -> the old one is no longer needed
    if (thumbnailLocalPath) {
        await deleteOnCloudinary(oldThumbnailId) ;
    }

    return res
    .status(200)
    .json(new ApiResponse(200 , updatedVideo , "video updated successfully"))
}) ;


const deleteVideo = asyncHandler(async (req , res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400 , "invalid videoId")
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404 , "no video found") ;
    }

    if (video.owner?.toString() !== req.user?._id?.toString()) {
        throw new ApiError(403 , "you can't delete this video, you are not the owner")
    }

    await Video.findByIdAndDelete(video._id);

    await deleteOnCloudinary(video.thumbnail?.public_id) ;
    await deleteOnCloudinary(video.videoFile?.public_id , "video"); // specify "video" while deleting a video

    // clean up everything that pointed to this video
    const comments = await Comment.find({ video : videoId }).select("_id") ;
    await Like.deleteMany({
        $or : [
            { video : videoId } ,
            { comment : { $in : comments.map((c) => c._id) } }
        ]
    })
    await Comment.deleteMany({ video : videoId })
    await Playlist.updateMany({ videos : videoId } , { $pull : { videos : videoId } })
    await User.updateMany({ watchHistory : videoId } , { $pull : { watchHistory : videoId } })

    return res
    .status(200)
    .json(new ApiResponse(200 , {} , "video deleted successfully"));
})

// toggle publish status of a video
const togglePublishStatus = asyncHandler(async (req , res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400 , "invalid videoId")
    }

    const video = await Video.findById(videoId) ;

    if (!video) {
        throw new ApiError(404 , "video not found")
    }

    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403 , "you can't toggle publish status as you are not the owner")
    }

    const toggledVideo = await Video.findByIdAndUpdate(
        videoId ,
        {
            $set : {
                isPublished : !video.isPublished
            }
        },
        { new : true }
    ) ;

    if (!toggledVideo) {
        throw new ApiError(500 , "failed to toggle video publish status")
    }

    return res
    .status(200)
    .json(new ApiResponse(200 , { isPublished : toggledVideo.isPublished } , "video publish toggled successfully"))
})

export {
    getAllVideos ,
    publishAVideo ,
    getVideobyId ,
    updateVideo ,
    deleteVideo ,
    togglePublishStatus
}
