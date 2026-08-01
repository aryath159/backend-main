import { asyncHandler } from "../utils/asyncHandler.js";

// parameter to async handler is a function
const registerUser = asyncHandler( async (req , res) =>{
    res.status(200).json({
        message:"cahi ou aco",
    })
} ) ;

export { registerUser }