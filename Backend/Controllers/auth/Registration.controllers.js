
    import registrationModel from "../../Models/Auth/Registration.models.js";
    import bcrypt from 'bcrypt';
    import jwt from 'jsonwebtoken';
    import dotenv from 'dotenv';
    dotenv.config();

    const registerUser = async (req , res) =>{
        const {userName , email , mobile , password} = req.body;
        try{
            const userExist = await registrationModel.findOne({email});
            if(userExist){
                return res.status(400).json({
                    message:"User already exists"
                })
            }
            const hashPassword = await bcrypt.hash(password , 10);
            const newUser = new registrationModel({
                userName, 
                email, 
                mobile, 
                password:hashPassword
            });
            const resp = await newUser.save();
            res.status(201).json({
                message:"User registered successfully",
                user:resp

            })
            console.log(resp);
            

        }catch(error){ 
            res.status(500).json({ 
                message:"Internal server error in reg controller", 
                error:error.message
            })
            console.log("Server error in registration");
        }
    }


    const loginUser = async (req , res ) =>{
        const {email , password} = req.body;
        try{
            const existingUser = await registrationModel.findOne({email});
            if(!existingUser){
                return res.status(404).json({
                    message:"User not found"
                })
            }
            const validatePassword = await bcrypt.compare(password , existingUser.password);
            if(!validatePassword) {
                return res.status(400).json({
                    message:"Invalid credentials"
                })
            }
            const token =  jwt.sign({
                id:existingUser._id,
                email:existingUser.email
            },process.env.JWT_SECRET, 
            {expiresIn:"1h"});
            res.status(200).json({
                message:"Login successful",
                token:token
            })
        

        }catch(error){
            res.status(500).json({
                message:"Internal server error"
            })
            console.log("Server side error", error);
            
        }
    }

    export {registerUser , loginUser};