// wraper function 


const asyncHandler = (requestHandler) => {

    return  (req , res , next) => {
        Promise.resolve( requestHandler( req , res , next ))
        .catch( (err) => next(err))
    }

}


export { asyncHandler }











// second method 

// const temp = () => { () =>{} } this and this ->       () => () => {} are equal only curly brace are removed


// accepts a function as a parameter and returns a sync function

// const asyncHandler = (fn) => async (req , res , next) => {
//     try {
//             await fn(req , res , next)
//     } catch (error) {
        
//         res.status(error.code || 500).json({
//             success:false,
//             message: err.message
//         })
//     }
// }