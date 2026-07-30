import dotenv from "dotenv"

import mongoose from "mongoose" ;
import {DB_NAME} from './constants.js';

import express from 'express'

//  one approach - write code in another file 
import connectDB from "./db/index.js";

const app = express() ;

dotenv.config({
    path: './.env'
})


connectDB() 
.then(()=>{

    
    const server = app.listen(process.env.PORT || 8000 , ()=>{
        console.log(`server is running at port ${process.env.PORT}`) ;
    })

    // handle server level error
    server.on("error" , (err)=>{
        console.log("error : " , err) ;
        
    })

})
.catch((err)=>{
    console.log("MONGO DB connection failed : " ,  err) ;
})


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