import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const dbCOnnect = async () =>{
    try{
        const resp = await mongoose.connect(process.env.MONGO_URI);
        console.log(`Database connected to ${resp.connection.host}`);
    }catch(error){
        console.log(`Error : ${error.message}`);
    }
}

export default dbCOnnect;