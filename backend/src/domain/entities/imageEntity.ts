import path from "node:path";
import fs from "node:fs";
import { AppError } from "../../helper/errorHandling/appError";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp"];
const MAX_SIZE = 2 * 1024 * 1024;

export default class imageEntity {
    public readonly dir: string;

    constructor(dir: string = "products") {
        this.dir = dir;
        const target = this.targetDir();
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }
    }

    async save(file: File): Promise<string> {
        if (!file || typeof file.arrayBuffer !== "function") {
            throw AppError.badRequest("File tidak valid");
        }
        const type = file.type;
        const ext = path.extname(file.name).replace(".", "").toLowerCase();
        if (!ALLOWED_TYPES.includes(type) || !ALLOWED_EXT.includes(ext)) {
            throw AppError.validation({ file: "Format tidak didukung. Gunakan JPG, PNG, atau WEBP" }, "Format file tidak didukung");
        }
        if (file.size > MAX_SIZE) {
            throw AppError.validation({ file: "Maksimal 2MB" }, "Ukuran file melebihi 2MB");
        }
        const extSafe = ext === "jpeg" ? "jpg" : ext;
        const filename = `${crypto.randomUUID()}.${extSafe}`;
        const target = this.targetDir();
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.promises.writeFile(path.join(target, filename), buffer);
        return `/uploads/${this.dir}/${filename}`;
    }

    async remove(url: string): Promise<void> {
        const filepath = path.join(process.cwd(), "public", url);
        if (fs.existsSync(filepath)) {
            await fs.promises.unlink(filepath);
        }
    }

    private targetDir(): string {
        return path.join(process.cwd(), "public", "uploads", this.dir);
    }
}