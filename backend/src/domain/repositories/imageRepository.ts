import { deleteImage, saveImage, updateImage } from "../types/imageType"

export interface imageRepository {
    save (req: saveImage) : Promise<string>
    delete (req: deleteImage ) : Promise<boolean>
    update (req: updateImage) : Promise<string>
}