import { appendFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../../config/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

type LogMeta = Record<string, unknown>;

// Direktori penyimpanan log & jumlah hari file log dipertahankan
const LOG_DIR = env.LOG_DIR;
const RETENTION_DAYS = env.LOG_RETENTION_DAYS;

// Antrean penulisan log agar tulis file berurutan dan tidak saling menimpa
let fileQueue: Promise<void> = Promise.resolve();

// Inisialisasi direktori log (sekali saja) sekaligus bersihkan file lama
let prepared: Promise<void> | null = null;
function prepare(): Promise<void> {
    prepared ??= (async () => {
        await mkdir(LOG_DIR, { recursive: true });
        await pruneOldLogs();
    })();
    return prepared;
}

// Nama file log per-tanggal, misal: logs/app-2026-09-14.log
function currentLogFile(): string {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return join(LOG_DIR, `app-${stamp}.log`);
}

// Hapus file log harian yang sudah melewati masa retensi (default 30 hari)
async function pruneOldLogs(): Promise<void> {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let entries;
    try {
        entries = await readdir(LOG_DIR, { withFileTypes: true });
    } catch {
        return;
    }
    await Promise.all(
        entries
            .filter((e) => e.isFile() && /^app-\d{4}-\d{2}-\d{2}\.log$/.test(e.name))
            .map(async (e) => {
                const filePath = join(LOG_DIR, e.name);
                try {
                    const info = await stat(filePath);
                    if (info.mtimeMs < cutoff) await rm(filePath);
                } catch {
                    // abaikan jika file sudah tidak ada
                }
            }),
    );
}

// Tulis satu baris JSON ke file log harian; kegagalan tidak menggagalkan request
function writeToFile(line: string): void {
    fileQueue = fileQueue
        .then(() => prepare())
        .then(async () => {
            await appendFile(currentLogFile(), `${line}\n`, "utf8");
        })
        .catch((err: unknown) => {
            console.error("[file-log] write failed:", err instanceof Error ? err.message : String(err));
        });
}

export class Logger {
    private constructor(
        private readonly level: LogLevel,
        private readonly bindings: LogMeta = {},
    ) {}

    static create(level: LogLevel = env.LOG_LEVEL): Logger {
        return new Logger(level);
    }

    child(bindings: LogMeta): Logger {
        return new Logger(this.level, { ...this.bindings, ...bindings });
    }

    debug(message: string, meta?: LogMeta): void {
        this.write("debug", message, meta);
    }

    info(message: string, meta?: LogMeta): void {
        this.write("info", message, meta);
    }

    warn(message: string, meta?: LogMeta): void {
        this.write("warn", message, meta);
    }

    error(message: string, meta?: LogMeta): void {
        this.write("error", message, meta);
    }

    private write(level: LogLevel, message: string, meta?: LogMeta): void {
        if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;

        const entry = {
            timestamp: new Date().toISOString(),
            level,
            ...this.bindings,
            message,
            ...(meta ?? {}),
        };
        const line = JSON.stringify(entry);

        if (level === "error") console.error(line);
        else if (level === "warn") console.warn(line);
        else console.log(line);

        writeToFile(line);
    }
}

export const logger = Logger.create();