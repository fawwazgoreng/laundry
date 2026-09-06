import path from "path";
import fs from "fs";

export default class imageEntity {
    public readonly baseDir = "";
    public readonly dir: string;
    constructor(dir: string = "product") {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
        this.dir = dir;
    }
    private generateUrl(file: File) {
        return path.join(
            this.baseDir,
            Math.random().toString(15).substring(2, 7) + file.name,
        );
    }
    
}