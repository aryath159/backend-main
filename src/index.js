import dotenv from "dotenv"

import mongoose from "mongoose" ;
import {DB_NAME} from './constants.js';



//  one approach - write code in another file 
import connectDB from "./db/index.js";


dotenv.config({
    path: './.env'
})


connectDB() ;


/*

another approach

import express from "express" ;

const app = express() ;

( async ()=>{

    try{

        await mongoose.connect(`${process.env.MONGODB_URI}\${DB_NAME}`) ;

        app.on("error" , (error)=>{
            console.log("error: " , error) ;
            throw error ;
        })

        app.listen(process.env.PORT , ()=>{
                console.log(`app is listening on this port ${process.env.PORT}`) ;
        })
    } catch(error) {
        console.log("ERROR : " , error) ;
        throw error ;
    }

})()
*/