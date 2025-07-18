import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "./ApiError";
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

function extractPublicIdFromUrl(url) {
  try {
    const parts = url.split("/");
    const uploadIndex = parts.findIndex(part => part === "upload");
    if (uploadIndex === -1) throw new Error("Invalid Cloudinary URL");

    const publicIdWithExt = parts.slice(uploadIndex + 2).join("/");

    const lastDotIndex = publicIdWithExt.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return publicIdWithExt;
    }

    return publicIdWithExt.substring(0, lastDotIndex);
  } catch (error) {
    console.error("Error extracting public_id:", error);
    return null;
  }
}

const deleteFromCloud = async(url, resourceType= "image") => {
    const publicId = extractPublicIdFromUrl(url)
    try {
        const result = await cloudinary.uploader.destroy(publicId,{
            resource_type: resourceType
        })

        return result
    } catch (error) {
        throw new ApiError(500, "Couldn't delete file")
    }
}

export {deleteFromCloud}