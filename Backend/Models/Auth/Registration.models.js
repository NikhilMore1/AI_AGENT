import mongoose from "mongoose";
const regSchema = new mongoose.Schema({
    userName:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true
    },
    mobile:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    }
},{timestamps:true});

const registrationModel = mongoose.model("Agent_Registration" ,regSchema);
export default registrationModel;