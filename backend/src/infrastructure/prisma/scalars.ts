export function varchar<N extends number = number>(value: string): string {
    return value;
}

export function numeric<P extends number = number, S extends number = number>(value: number | string): string {
    return String(value);
}

export function flag(value: boolean): number {
    return value ? 1 : 0;
}

export function isFlag(value: number): boolean {
    return value !== 0;
}

export function jsonText(value: Record<string, unknown> | null): string | null {
    return value === null ? null : JSON.stringify(value);
}

export function fromJsonText(value: string | null): Record<string, unknown> | null {
    if (value === null) return null;
    try {
        const parsed: unknown = JSON.parse(value);
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}
