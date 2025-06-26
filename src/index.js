import dotenv from "dotenv"
import connectDB from "./db/index.js"
import { app } from "./app.js"
import { error } from "console"

dotenv.config({
    path:"./env"
})

connectDB()
.then(
    ()=>{
        app.listen(process.env.PORT || 3000)
        console.log("Server is running at Port: ", process.env.PORT)
    }
)
.catch(
    (error)=>{
        console.error("MongoDB connection error: ",error)
    }
)

