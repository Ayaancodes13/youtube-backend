import { asyncHandler } from "../utils/AsyncHandler.js";
import {ApiError} from '../utils/ApiError.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from '../utils/cloudinary.js'


const registerUser = asyncHandler(async(req,res)=>{
    const {fullname,email,username,password} = req.body
    
    if([fullname,email,username,password].some((field)=>field?.trim()== ""))
    {
        throw new ApiError(400,"All fields are required")
    }
    

    const existingUser =  await User.findOne({
        $or: [{username},{email}]
    })

    if(existingUser){
        throw new ApiError(409, "User with this email or Username already exists")
    }


    const avatarLocalPath = req.files?.avatar[0]?.path
    let coverimageLocalPath;

    if(req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length > 0){
        coverimageLocalPath = req.files.coverimage[0]?.path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    
    const coverimage = await uploadOnCloudinary(coverimageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }


    const user = await User.create({
        fullname,
        email,
        password,
        coverimage: coverimage?.url || "",
        avatar: avatar.url,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshtoken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while creating the User")
    }
    

    return res.status(201).json(
        new ApiResponse (200,createdUser,"User registered succesfully")
    )
}
)


export {registerUser}