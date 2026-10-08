import { Like } from "../models/like.models.js";
import mongoose , { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.models.js"
import { Video } from "../models/video.models.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// get all comments for a video
const getVideoComments = asyncHandler(async (req , res) => {
    const { videoId } = req.params

    const { page = 1 , limit = 10 } = req.query ;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400 , "Invalid videoId")
    }

    const video = await Video.findById(videoId) ;

    if (!video) {
        throw new ApiError(404 , "video not found") ;
    }

    // guests have no req.user -> null never matches a like
    const viewerId = req.user?._id ?? null ;

    const commentsAggregate = Comment.aggregate([
        {
            $match : {
                video : new mongoose.Types.ObjectId(videoId)
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
                        $project : {
                            username : 1 ,
                            fullname : 1 ,
                            avatar : 1
                        }
                    }
                ]
            }
        },
        {
            $lookup : {
                from : "likes",
                localField : "_id",
                foreignField : "comment",
                as : "likes"
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
                        if : { $in : [ viewerId , "$likes.likedBy" ] },
                        then : true,
                        else : false
                    }
                }
            }
        },
        {
            $sort : {
                createdAt : -1
            }
        },
        {
            $project : {
                content : 1 ,
                createdAt : 1 ,
                likesCount : 1 ,
                owner : 1 ,
                isLiked : 1
            }
        }
    ]);

    const options = {
        page : Math.max(parseInt(page , 10) || 1 , 1),
        limit : Math.min(Math.max(parseInt(limit , 10) || 10 , 1) , 50)
    };

    const comments = await Comment.aggregatePaginate(
        commentsAggregate , options
    );

    return res
    .status(200)
    .json(new ApiResponse(200 , comments , "comments fetched successfully"))
}) ;


// add comment to a video
const addComment = asyncHandler(async (req , res) => {
    const { videoId } = req.params ;
    const { content } = req.body ;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400 , "Invalid videoId")
    }

    if (typeof content !== "string" || !content.trim()) {
        throw new ApiError(400 , "content is required") ;
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404 , "video not found")
    }

    const comment = await Comment.create({
        content : content.trim() ,
        video : videoId ,
        owner : req.user?._id
    });

    if (!comment) {
        throw new ApiError(500 , "Failed to add comment please try again")
    }

    // send it back in the same shape getVideoComments uses, so the UI can show it right away
    const newComment = {
        _id : comment._id ,
        content : comment.content ,
        createdAt : comment.createdAt ,
        likesCount : 0 ,
        isLiked : false ,
        owner : {
            _id : req.user._id ,
            username : req.user.username ,
            fullname : req.user.fullname ,
            avatar : req.user.avatar
        }
    }

    return res
    .status(201)
    .json(new ApiResponse(201 , newComment , "Comment added successfully"))
}) ;


// update a comment
const updateComment = asyncHandler(async (req , res) => {

    const { commentId } = req.params ;
    const { content } = req.body ;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400 , "Invalid commentId")
    }

    if (typeof content !== "string" || !content.trim()) {
        throw new ApiError(400 , "content is required")
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404 , "comment not found") ;
    }

    if (comment.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403 , "only the comment owner can edit their comment")
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        comment._id ,
        {
            $set : {
                content : content.trim()
            }
        },
        { new : true }
    );

    if (!updatedComment) {
        throw new ApiError(500 , "Failed to edit comment please try again")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200 , updatedComment , "Comment edited successfully")
    );
});


// delete a comment
const deleteComment = asyncHandler( async (req , res) => {
    const { commentId } = req.params ;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400 , "Invalid commentId")
    }

    const comment = await Comment.findById(commentId) ;

    if (!comment) {
        throw new ApiError(404 , "comment not found");
    }

    if (comment.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403 , "only the comment owner can delete their comment")
    }

    await Comment.findByIdAndDelete(commentId) ;

    // remove ALL likes on this comment (not only the owner's)
    await Like.deleteMany({
        comment : commentId
    })

    return res
    .status(200)
    .json(new ApiResponse(200 , { commentId } , "comment deleted successfully"))
});

export { getVideoComments , addComment , updateComment , deleteComment } ;
