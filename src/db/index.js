import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async ()=>{
    try {
        const connectionInstanse = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log("/n MongoDB connected !!, Host: ", connectionInstanse.connection.host)
    } catch (error) {
        console.error("Failed connecting to Database: ",error)
        process.exit(1)
    }
}

export default connectDB