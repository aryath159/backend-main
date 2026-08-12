import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError}  from '../utils/ApiError.js'
import { User } from '../models/user.models.js'
import {uploadFileOnCloudinary} from '../utils/claudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"



const generateAcessToken_and_refreshtoken = async(userid) =>{
    try {
        const user = await User.findById(userid);
        const accessToken = user.generateAccessToken() ;
        const refreshtoken = user.generateRefreshToken() ;

        user.refreshToken = refreshtoken ;
        await user.save({ validateBeforeSave: false})

        return {accessToken , refreshtoken }

    } catch (error) {
        throw new ApiError(500 , "something went wrong")
    }
}

// parameter to async handler is a function

const registerUser = asyncHandler( async (req , res) =>{
    

    // get user details from frontend 
    // validation - not empty
    // check if user already exits - username or email
    // check for images , avatar
    // upload them to cloudinary - avatar
    // create user object - ceate db entry
    // remove password and refreshToken feild 
    // check for user creation
    // return res 
    
    const {fullname , email , password , username} = req.body ;

    console.log("fullname : " , fullname) ;
    console.log("email : " , email) ;

    if(
        [fullname , email , password , username].some(  (filds) => filds?.trim() === "" )
    ){
        throw new ApiError(400 , "all filds are required")
    }


    const existedUser = await User.findOne({
        $or : [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409 , "user alread exits with username or email")
    }

    const avatarlocalpath = req.files?.avatar?.[0]?.path ;
    //const coverImagepath = req.files?.coverImage[0]?.path ;
    let coverImagepath = "";

    if(req.files &&  Array.isArray(req.files.coverImage) && 
        req.files.coverImage.length > 0){
            coverImagepath =  req.files.coverImage[0].path ;
        }

    if(!avatarlocalpath){
        throw new ApiError(400 , "avatar file is required") ;
    }

    const avatar = await uploadFileOnCloudinary(avatarlocalpath) ;
    const coverImage = await uploadFileOnCloudinary(coverImagepath) ;

    if(!avatar)
    {
        throw new ApiError(400 , "avatar file is required") ;
    }

    // create user
    const user = await User.create({
        fullname, 
        avatar :avatar.url ,
        coverImage : coverImage?.url || "" ,
        email ,
        password,
        username : username.toLowerCase()

    })

    // check if user is created 
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!createdUser){
        throw new ApiError(500 , "something went wrong while registering user");

    }

    console.log("all done ....")
    return res.status(201).json(
        new ApiResponse(200 , createdUser , "user registered successfully")
    )



} ) ;

const loginUser = asyncHandler( async (req ,res) => {
    
    
    // req->data = body
    // username email password
    // find user
    // password check 
    // access and refresh token 
    //send cookie

    console.log(req.body)
    const {email , username , password } = req.body 
    console.log(email); 

    if(!username && !email){
        throw new ApiError(400 ,"username or email required")
    }


    const user = await User.findOne({
        $or : [{username} , {email}]
    })

    if(!user){
        throw new ApiError(404 , "user does not exits")
    }

    const ispasswordvalid = await user.ispasswordCorrect(password)

    if(!ispasswordvalid){
        throw new ApiError(401 , "invalid user credentials")
    }


    const  {accessToken , refreshtoken } = await generateAcessToken_and_refreshtoken(user._id) ;

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly : true ,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken" , accessToken)
    .cookie("refreshToken" , refreshtoken)
    .json(
        new ApiResponse(
            200 ,
            {
                user : loggedInUser ,
                accessToken ,
                refreshToken : refreshtoken
            },
            "user logged in successfully"
        )
    )

})

const logoutUser = asyncHandler(async (req, res ) =>{
    await User.findByIdAndUpdate(
        req.user._id , {
            $set : {
                refreshToken : "undefined"
            }
        },
        {
            new :true 
        }
    )

    const options = {
        httpOnly : true ,
        secure: true
    }

    console.log("we reached here")
    return res
    .status(200)
    .clearCookie("accessToken" , options)
    .clearCookie("refreshToken" , options)
    .json(new ApiResponse(200, {} , "user logged out successfully"))
})

const RefreshAccessToken = asyncHandler(async (req , res) =>{
    const incomingRefreshToken = req.cookies.refreshToken ||  req.body.refreshToken ;

    if(!incomingRefreshToken){
        throw new ApiError(401 , "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken ,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id) ;
    
        if(!user){
            throw new ApiError(401 , "invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "refresh token is expired or used")
        }
    
        const options = {
            httpOnly : true ,
            secure : true
        }
    
        const { accessToken , newrefreshtoken } = await generateAcessToken_and_refreshtoken(user._id);
    
        return res
        .status(200)
        .cookie("accessToken" , accessToken , options)
        .cookie("refreshToken" , newrefreshtoken , options)
        .json(
             new ApiResponse(
                200 ,
                {
                    accessToken , refreshToken : newrefreshtoken 
                },
                "access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401 , error?.message || "invalid refreshToken");
    }
})


const changeCurrentPassword = asyncHandler( async(req , res) =>{

    const {oldPassword ,  newPassword } = req.body 

    const user = await User.findById(re.user?._id)

    const is_pass_correct = user.ispasswordCorrect(oldPassword) ;

    if(!is_pass_correct){
        throw new ApiError(400, "invalid old password")
    }

    user.password = newPassword

    await user.save({validateBeforeSave : false})


    return res
    .status(200)
    .json(new ApiResponse(200 , {} , "password changed successfully"))

})

const getCurrentUser = asyncHandler( async(req , res) =>{
    return res.status(200)
              .json(new ApiResponse(200 , req.user , "current user fetched successfully"))
})

const UpdateAccountDetails = asyncHandler( async(req , res )=>{
    const {fullname , email } = req.body
    if(!fullname && !email){
        throw new ApiError(400 , "All feilds are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id , 
        {
            $set : {
                fullname ,
                email : email

            }
        },
        {
            new : true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user , "Account details updated successfully"))
})

const userAvatarUpdate = asyncHandler(async (req, res)=>{
    const avatarLocalPath = req.file?.path 

    if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar file is missing")
    }

    const avatar = await uploadFileOnCloudinary(avatarLocalPath) ;

    if(!avatar){
        throw new  ApiError(400 , "error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id ,
        {
            $set:{
                avatar : avatar.url 
            }
        },
        {
            new : true 
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "avatar image updated successfully"))
})


const coverImageUpdate = asyncHandler(async (req, res)=>{
    const coverLocalPath = req.file?.path 

    if(!coverLocalPath){
        throw new ApiError(400 , "cover image file is missing")
    }

    const coverImage = await uploadFileOnCloudinary(avatarLocalPath) ;

    if(!coverImage){
        throw new  ApiError(400 , "error while uploading  avatar on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id ,
        {
            $set:{
                coverImage : coverImage.url 
            }
        },
        {
            new : true 
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200 , user , "civer image updated successfully"))
})

const getUserChannelProfle = asyncHandler( async (req, res) =>{

    const {username} = req.params ;

    if(!username){
        throw new ApiError(400 , "username is missing ") ;
    }

    const channel = await User.aggregate([
       {
            $match :{
                username: username?.toLowerCase() 
            }
       },
       {
            $lookup:{
                from : "subscriptions",
                localField:"_id" ,
                foreignField:"channel",
                as:"subscribers"
            }
       },
       {
            $lookup:{
                from : "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as:"subscribedTo"
            }
       },
       {
            $addFields:{
                subscribersCount :{
                    $size: "subscribers"
                } ,
                channelSubscribedTocount : {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond:{
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then : true ,
                        else : false
                    }
                }
            }
       },
       {
            $project:{
                fullname : 1 ,
                username : 1 ,
                subscribersCount : 1 ,
                channelSubscribedTocount: 1 ,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email :1 
            }
       }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exits ")
    }


    return res
    .status(200)
    .json(
        new ApiResponse(200 , channel[0] , "User channel fetched successfully")
    )
})


export { registerUser , loginUser , logoutUser , RefreshAccessToken , changeCurrentPassword ,
        getCurrentUser , UpdateAccountDetails , userAvatarUpdate , coverImageUpdate ,
         getUserChannelProfle
}