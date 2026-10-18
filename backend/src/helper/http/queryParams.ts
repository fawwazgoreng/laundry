import { AppError } from "../errorHandling/appError";

const DEFAULT_PER_PAGE_MAX = 100;

export function parseIntegerParam(
    value: string | undefined,
    field: string,
    options: { fallback?: number; min?: number } = {},
): number {
    const { fallback, min = 1 } = options;
    if (value === undefined || value === "") {
        if (fallback !== undefined) return fallback;
        throw AppError.validation({ [field]: "Parameter wajib diisi" }, `Parameter ${field} tidak valid`);
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min) {
        throw AppError.validation(
            { [field]: `Harus berupa bilangan bulat minimal ${min}` },
            `Parameter ${field} tidak valid`,
        );
    }
    return parsed;
}

export function parsePage(value: string | undefined, fallback = 1): number {
    return parseIntegerParam(value, "page", { fallback, min: 1 });
}

export function parsePerPage(value: string | undefined, fallback: number, max = DEFAULT_PER_PAGE_MAX): number {
    const parsed = parseIntegerParam(value, "perPage", { fallback, min: 1 });
    return Math.min(parsed, max);
}

export function parseIdParam(value: string | undefined, field = "id"): number {
    return parseIntegerParam(value, field, { min: 1 });
}
