import {Playlist} from "../models/playlist.models.js"
import {Video} from "../models/video.models.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"

import mongoose ,{isValidObjectId} from "mongoose"

const createPlaylist = asyncHandler(async (req , res) => {
    const { name , description } = req.body

    if (typeof name !== "string" || !name.trim() || typeof description !== "string" || !description.trim()) {
        throw new ApiError(400 , "name and description both are needed")
    }

    const playlist = await Playlist.create({
        name : name.trim() ,
        description : description.trim() ,
        owner : req.user?._id ,
    })

    if (!playlist) {
        throw new ApiError(500 , "failed to create playlist")
    }

    return res
        .status(201)
        .json(new ApiResponse(201 , playlist , "playlist created successfully"));
})


const updatePlaylist = asyncHandler(async (req , res) => {

    const { name , description } = req.body

    const { playlistId } = req.params;

    if (typeof name !== "string" || !name.trim() || typeof description !== "string" || !description.trim()) {
        throw new ApiError(400 , "name and description both are required");
    }

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400 , "Invalid playlistId");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404 , "Playlist not found");
    }

    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403 , "only the owner can edit the playlist");
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlist._id ,
        {
            $set : {
                name : name.trim() ,
                description : description.trim() ,
            },
        },
        { new : true }
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200 ,
                updatedPlaylist ,
                "playlist updated successfully"
            )
        );
});

const deletePlaylist = asyncHandler(async (req , res) => {

    const { playlistId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400 , "Invalid playlistId");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404 , "Playlist not found");
    }

    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403 , "only the owner can delete the playlist");
    }

    await Playlist.findByIdAndDelete(playlist._id);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200 ,
                {} ,
                "playlist deleted successfully"
            )
        );
});

const addVideoToPlaylist = asyncHandler(async (req , res) => {

    const { playlistId , videoId } = req.params;

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400 , "Invalid playlistId or videoId");
    }

    const playlist = await Playlist.findById(playlistId);
    const video = await Video.findById(videoId);

    if (!playlist) {
        throw new ApiError(404 , "Playlist not found");
    }
    if (!video) {
        throw new ApiError(404 , "video not found");
    }

    // only the PLAYLIST owner matters: you can save anybody's video in your own playlist
    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403 , "only the owner can add videos to their playlist");
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlist._id ,
        {
            $addToSet : {
                videos : videoId ,
            },
        },
        { new : true }
    );

    if (!updatedPlaylist) {
        throw new ApiError(
            400 ,
            "failed to add video to playlist please try again"
        );
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200 ,
                updatedPlaylist ,
                "Added video to playlist successfully"
            )
        );
});

const removeVideoFromPlaylist = asyncHandler(async (req , res) => {
    const { playlistId , videoId } = req.params;

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400 , "Invalid playlistId or videoId");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404 , "Playlist not found");
    }

    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            403 ,
            "only the owner can remove videos from their playlist"
        );
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId ,
        {
            $pull : {
                videos : videoId ,
            },
        },
        { new : true }
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200 ,
                updatedPlaylist ,
                "Removed video from playlist successfully"
            )
        );
});

const getPlaylistById = asyncHandler(async (req , res) => {
    const { playlistId } = req.params

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400 , "Invalid playlistId");
    }

    const playlist = await Playlist.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "videos",
                foreignField : "_id",
                as : "videos",
                pipeline : [
                    {
                        // an empty playlist must still be returned, so filter inside the lookup
                        $match : { isPublished : true }
                    },
                    {
                        $project : {
                            "thumbnail.url" : 1 ,
                            title : 1 ,
                            description : 1 ,
                            duration : 1 ,
                            createdAt : 1 ,
                            views : 1 ,
                            owner : 1
                        }
                    }
                ]
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
            $addFields : {
                totalVideos : {
                    $size : "$videos"
                },
                totalViews : {
                    $sum : "$videos.views"
                },
                owner : {
                    $first : "$owner"
                }
            }
        }
    ]);

    if (!playlist?.length) {
        throw new ApiError(404 , "Playlist not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200 , playlist[0] , "playlist fetched successfully"));
})

const getUserPlaylists = asyncHandler(async (req , res) => {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400 , "Invalid userId");
    }

    const playlists = await Playlist.aggregate([
        {
            $match : {
                owner : new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "videos",
                foreignField : "_id",
                as : "videos"
            }
        },
        {
            $addFields : {
                totalVideos : {
                    $size : "$videos"
                },
                totalViews : {
                    $sum : "$videos.views"
                }
            }
        },
        {
            $project : {
                _id : 1 ,
                name : 1 ,
                description : 1 ,
                totalVideos : 1 ,
                totalViews : 1 ,
                updatedAt : 1
            }
        }
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200 , playlists , "User playlists fetched successfully"));
});

export { createPlaylist , updatePlaylist , deletePlaylist ,
    addVideoToPlaylist , removeVideoFromPlaylist , getPlaylistById ,
    getUserPlaylists
}
