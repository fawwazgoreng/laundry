import { env } from "../../config/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

type LogMeta = Record<string, unknown>;

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
    }
}

export const logger = Logger.create();