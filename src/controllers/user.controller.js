import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
    uploadFileOnCloudinary ,
    removeUploadedFiles
} from "../utils/claudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const isProduction = process.env.NODE_ENV === "production";

// secure cookies only work on https, so only switch them on in production.
// in production the frontend is usually on another domain -> sameSite "none"
const cookieOptions = {
    httpOnly : true ,
    secure : isProduction ,
    sameSite : isProduction ? "none" : "lax"
};

// keep the refresh cookie alive after the browser is closed
const refreshCookieOptions = {
    ...cookieOptions ,
    maxAge : 10 * 24 * 60 * 60 * 1000
};

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken() ;
        const refreshToken = user.generateRefreshToken() ;

        user.refreshToken = refreshToken ;
        await user.save({ validateBeforeSave: false })

        return { accessToken , refreshToken }

    } catch (error) {
        throw new ApiError(500 , "something went wrong while generating tokens")
    }
}

const isBlank = (value) => typeof value !== "string" || value.trim() === "" ;

const registerUser = asyncHandler( async (req , res) => {

    // get user details from frontend
    // validation - not empty
    // check if user already exits - username or email
    // check for images , avatar
    // upload them to cloudinary - avatar
    // create user object - create db entry
    // remove password and refreshToken field
    // check for user creation
    // return res

    try {
        const { fullname , email , password , username } = req.body ;

        if ([fullname , email , password , username].some(isBlank)) {
            throw new ApiError(400 , "all fields are required")
        }

        if (password.length < 6) {
            throw new ApiError(400 , "password must be at least 6 characters")
        }

        const normalizedUsername = username.trim().toLowerCase() ;
        const normalizedEmail = email.trim().toLowerCase() ;

        const existedUser = await User.findOne({
            $or : [{ username : normalizedUsername }, { email : normalizedEmail }]
        })

        if (existedUser) {
            throw new ApiError(409 , "user already exists with this username or email")
        }

        const avatarLocalPath = req.files?.avatar?.[0]?.path ;
        const coverImageLocalPath = req.files?.coverImage?.[0]?.path ;

        if (!avatarLocalPath) {
            throw new ApiError(400 , "avatar file is required") ;
        }

        const avatar = await uploadFileOnCloudinary(avatarLocalPath) ;
        const coverImage = await uploadFileOnCloudinary(coverImageLocalPath) ;

        if (!avatar) {
            throw new ApiError(400 , "avatar upload failed, please try again") ;
        }

        const user = await User.create({
            fullname : fullname.trim() ,
            avatar : avatar.url ,
            coverImage : coverImage?.url || "" ,
            email : normalizedEmail ,
            password ,
            username : normalizedUsername
        })

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );

        if (!createdUser) {
            throw new ApiError(500 , "something went wrong while registering user");
        }

        return res.status(201).json(
            new ApiResponse(201 , createdUser , "user registered successfully")
        )
    } catch (error) {
        // validation failed before the upload: don't leave files in public/temp
        removeUploadedFiles(req) ;
        throw error ;
    }
})

const loginUser = asyncHandler( async (req , res) => {

    // req.body -> data
    // username or email + password
    // find user
    // password check
    // access and refresh token
    // send cookie

    const { email , username , password } = req.body ;

    const identifiers = [] ;
    if (typeof username === "string" && username.trim()) {
        identifiers.push({ username : username.trim().toLowerCase() }) ;
    }
    if (typeof email === "string" && email.trim()) {
        identifiers.push({ email : email.trim().toLowerCase() }) ;
    }

    // an undefined value inside $or would match every user, so build it only from real values
    if (identifiers.length === 0) {
        throw new ApiError(400 , "username or email required")
    }

    if (isBlank(password)) {
        throw new ApiError(400 , "password is required")
    }

    const user = await User.findOne({ $or : identifiers })

    if (!user) {
        throw new ApiError(404 , "user does not exist")
    }

    const isPasswordValid = await user.ispasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401 , "invalid user credentials")
    }

    const { accessToken , refreshToken } = await generateAccessAndRefreshTokens(user._id) ;

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    return res
    .status(200)
    .cookie("accessToken" , accessToken , cookieOptions)
    .cookie("refreshToken" , refreshToken , refreshCookieOptions)
    .json(
        new ApiResponse(
            200 ,
            {
                user : loggedInUser ,
                accessToken ,
                refreshToken
            },
            "user logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id , {
            $unset : {
                refreshToken : 1
            }
        },
        {
            new : true
        }
    )

    return res
    .status(200)
    .clearCookie("accessToken" , cookieOptions)
    .clearCookie("refreshToken" , cookieOptions)
    .json(new ApiResponse(200, { username : req.user.username } , "user logged out successfully"))
})

const RefreshAccessToken = asyncHandler(async (req , res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken ;

    if (!incomingRefreshToken) {
        throw new ApiError(401 , "unauthorized request")
    }

    let decodedToken ;
    try {
        decodedToken = jwt.verify(
            incomingRefreshToken ,
            process.env.REFRESH_TOKEN_SECRET
        )
    } catch (error) {
        throw new ApiError(401 , error?.message || "invalid refresh token");
    }

    const user = await User.findById(decodedToken?._id) ;

    if (!user) {
        throw new ApiError(401 , "invalid refresh token")
    }

    if (incomingRefreshToken !== user?.refreshToken) {
        throw new ApiError(401 , "refresh token is expired or used")
    }

    const { accessToken , refreshToken } = await generateAccessAndRefreshTokens(user._id);

    return res
    .status(200)
    .cookie("accessToken" , accessToken , cookieOptions)
    .cookie("refreshToken" , refreshToken , refreshCookieOptions)
    .json(
        new ApiResponse(
            200 ,
            { accessToken , refreshToken },
            "access token refreshed successfully"
        )
    )
})

const changeCurrentPassword = asyncHandler( async (req , res) => {

    const { oldPassword , newPassword } = req.body

    if (isBlank(oldPassword) || isBlank(newPassword)) {
        throw new ApiError(400 , "old and new password are required")
    }

    if (newPassword.length < 6) {
        throw new ApiError(400 , "new password must be at least 6 characters")
    }

    const user = await User.findById(req.user?._id)

    // this is async: without await the check was always "true"
    const isPasswordCorrect = await user.ispasswordCorrect(oldPassword) ;

    if (!isPasswordCorrect) {
        throw new ApiError(400 , "invalid old password")
    }

    user.password = newPassword

    await user.save({ validateBeforeSave : false })

    return res
    .status(200)
    .json(new ApiResponse(200 , {} , "password changed successfully"))
})

const getCurrentUser = asyncHandler( async (req , res) => {
    return res.status(200)
              .json(new ApiResponse(200 , req.user , "current user fetched successfully"))
})

const UpdateAccountDetails = asyncHandler( async (req , res) => {
    const { fullname , email } = req.body

    const fieldsToUpdate = {}
    if (!isBlank(fullname)) fieldsToUpdate.fullname = fullname.trim()
    if (!isBlank(email)) fieldsToUpdate.email = email.trim().toLowerCase()

    if (Object.keys(fieldsToUpdate).length === 0) {
        throw new ApiError(400 , "fullname or email is required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id ,
        { $set : fieldsToUpdate },
        { new : true }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "Account details updated successfully"))
})

const userAvatarUpdate = asyncHandler(async (req , res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400 , "Avatar file is missing")
    }

    const avatar = await uploadFileOnCloudinary(avatarLocalPath) ;

    if (!avatar) {
        throw new ApiError(400 , "error while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id ,
        {
            $set : {
                avatar : avatar.url
            }
        },
        {
            new : true
        }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "avatar image updated successfully"))
})

const coverImageUpdate = asyncHandler(async (req , res) => {
    const coverLocalPath = req.file?.path

    if (!coverLocalPath) {
        throw new ApiError(400 , "cover image file is missing")
    }

    const coverImage = await uploadFileOnCloudinary(coverLocalPath) ;

    if (!coverImage) {
        throw new ApiError(400 , "error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id ,
        {
            $set : {
                coverImage : coverImage.url
            }
        },
        {
            new : true
        }
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "cover image updated successfully"))
})

const getUserChannelProfile = asyncHandler( async (req , res) => {

    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiError(400 , "username is missing") ;
    }

    // guests have no req.user -> null never matches a subscriber
    const viewerId = req.user?._id ?? null ;

    const channel = await User.aggregate([
        {
            $match : {
                username : username.trim().toLowerCase()
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "_id" ,
                foreignField : "channel",
                as : "subscribers"
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "_id",
                foreignField : "subscriber",
                as : "subscribedTo"
            }
        },
        {
            $addFields : {
                subscribersCount : {
                    $size : "$subscribers"
                } ,
                channelSubscribedTocount : {
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    $cond : {
                        if : { $in : [ viewerId , "$subscribers.subscriber" ] },
                        then : true ,
                        else : false
                    }
                }
            }
        },
        {
            $project : {
                fullname : 1 ,
                username : 1 ,
                subscribersCount : 1 ,
                channelSubscribedTocount : 1 ,
                isSubscribed : 1 ,
                avatar : 1 ,
                coverImage : 1 ,
                email : 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404 , "channel does not exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200 , channel[0] , "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async (req , res) => {

    const user = await User.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "watchHistory",
                foreignField : "_id",
                as : "watchHistory",
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
                                        fullname : 1,
                                        username : 1,
                                        avatar : 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields : {
                            owner : {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    // $lookup does not keep the order of the array: most recently watched first
    const order = (req.user.watchHistory || []).map(String).reverse() ;
    const videos = user[0]?.watchHistory || [] ;
    videos.sort(
        (a , b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id))
    )

    return res
    .status(200)
    .json(
        new ApiResponse(
            200 ,
            videos ,
            "watch history fetched successfully"
        )
    )
})

export { registerUser , loginUser , logoutUser , RefreshAccessToken , changeCurrentPassword ,
        getCurrentUser , UpdateAccountDetails , userAvatarUpdate , coverImageUpdate ,
        getUserChannelProfile , getWatchHistory
}
