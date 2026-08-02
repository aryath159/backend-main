import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError}  from '../utils/ApiError.js'
import {User, User} from '../models/user.models.js'
import {uploadFileOnClaudinary} from '../utils/claudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js";

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


    const existedUser = User.findOne({
        $or : [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409 , "user alread exits with username or email")
    }

    const avatarlocalpath = req.files?.avatar[0]?.path ;
    const coverImagepath = req.files?.coverImage[0]?.path ;

    if(!avatarlocalpath){
        throw new ApiError(400 , "avatar file is required") ;
    }

    const avatar = await uploadFileOnClaudinary(avatarlocalpath) ;
    const coverImage = await uploadFileOnClaudinary(coverImagepath) ;

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

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "user registered successfully")
    )




} ) ;

export { registerUser }