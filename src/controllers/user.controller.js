import { asyncHandler } from "../utils/AsyncHandler.js";
import {ApiError} from '../utils/ApiError.js'
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import jwt from 'jsonwebtoken'
import { deleteFromCloud } from "../utils/deleteFromCloud.js";

const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshtoken = refreshToken
         await user.save({ validateBeforeSave: false })
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
    }
}


const registerUser = asyncHandler(async(req,res)=>{
    const {fullname,email,username,password} = req.body
    
    if([fullname,email,username,password].some((field)=>field?.trim()== ""))
    {
        throw new ApiError(400, "All fields are required")
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

const loginUser = asyncHandler(async (req,res)=>{

    const {username,email,password} = req.body
    if(!username || !email){
        throw new ApiError(400, "Username or Email is required")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404, "User doesn't exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
    throw new ApiError(401,"Invalid user credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken:1
            }
        },{
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }
    
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{},"User logged out")
    )
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedRefreshToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedRefreshToken._id)

        if(!user){
            throw new ApiError(401, "Invalid Refresh token")
        }

        if(incomingRefreshToken !== user?.refreshtoken){
            throw new ApiError(401, "Refresh token is expired or is used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user?._id)

        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(200,{accessToken,refreshToken: newRefreshToken}, "Access Token refreshed")
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body
    const user = User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401, "Incorrect old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new ApiResponse(200,{}, "Password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(
        new ApiResponse(200, req.user, "User fetched successfully")
    )
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullname,email,username} = req.body

    if(!fullname || !username){
        throw new ApiError(400, "All fields are required")
    }
    
    const user = await User.findByIdAndUpdate(req.user?._id,{
        $set: {
            fullname:fullname,
            username:username
        }
    },{
        new: true
    }).select(" -password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user, "Account details updated successfully")
    )
})

const updateAvatarImage = asyncHandler(async(req,res)=>{

    const oldAvatar = await User.findById(req.user?._id).select("avatar")

    const avatarImagePath = req.file?.path

    if(!avatarImagePath){
        throw new ApiError(400, "Avatar image file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarImagePath)

    if(!avatar.url){
        throw new ApiError(500, "Error while uploading Avatar image file")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,{
        $set:{
            avatar: avatar.url
        }
    },{
        new: true
    }).select(" -password")
    if(oldAvatar){
        await deleteFromCloud(oldAvatar)
    }
    
    return res
    .status(200)
    .json(
        new ApiResponse(200,user, "Avatar image updated successfully")
    )
})

const updateCoverImage = asyncHandler(async(req,res)=>{

    const oldCoverImage = await User.findById(req.user?._id).select("coverimage")
    
    const coverImagePath = req.file?.path

    if(!coverImagePath){
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImagePath)

    if(!coverImage.url){
        throw new ApiError(500, "Error while uploading Cover image file")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,{
        $set:{
            coverimage: coverImage.url
        }
    },{
        new: true
    }).select(" -password")

    if(oldCoverImage){
        await deleteFromCloud(oldCoverImage)
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,user, "Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params

    if(!username.trim()){
        throw new ApiError(400, "Username is required")
    }

    const channel = User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            },
           
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                subscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribedTo: {
                    $cond: {
                        if: {$in: [req.user?._id, "subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }

            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverimage:1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribedTo: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel doesn't exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getUserWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Type.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchhistory",
                foreignField: "_id",
                as: 'watchHistory',
                pipeline: [
                    {
                        
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        $project: {
                                            fullname: 1,
                                            avatar: 1,
                                            username: 1
                                        }
                                    }
                                ]
                            }
                        
                    },
                    {

                       $addFields: {
                        owner: { $first: "$owner" }
                       }
        }
                ],
                
            },

        },
        
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchhistory, "Watch history fetched successfully")
    )
})

export {registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatarImage,
    updateCoverImage,
    getUserChannelProfile,
    getUserWatchHistory,
}