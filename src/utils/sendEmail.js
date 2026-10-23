import nodemailer from "nodemailer" ;

const sendEmail = async (options) => {

    // create the transporter 

    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port : process.env.EMAIL_PORT ,
        auth: {
            user : process.env.EMAIL_USERNAME ,
            pass : process.env.EMAIL_PASSWORD 
        }
    });

    const mailoptions = {
        from : "aryanpise12@gmail.com" ,
        to : options.email ,
        subject : options.subject,
        email : options.message
    };

    // actually send the email
    await transporter.sendMail(mailoptions) ;

};

export default sendEmail ;