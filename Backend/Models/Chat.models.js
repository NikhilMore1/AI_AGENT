import mongoose, { mongo } from "mongoose";
const ChatSchema = new mongoose.Schema({
    chatId:{
        type:Number,
        required:true
    },
    title:{
        type:String,
        required:true
    },
    messages:{
        type:Array,
        required:true
    }
},{timestamps:true});

const ChatModel = mongoose.model("Chat",ChatSchema);

export default ChatModel;