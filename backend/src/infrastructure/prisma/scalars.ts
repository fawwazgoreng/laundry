import type { Numeric, Varchar } from "@prisma/orm-postgres/target/codec-types";

export function varchar<N extends number>(value: string): Varchar<N> {
    return value as Varchar<N>;
}

export function numeric<P extends number, S extends number>(value: number | string): Numeric<P, S> {
    return String(value) as Numeric<P, S>;
}

export function instant(value: Date): Temporal.Instant {
    return Temporal.Instant.fromEpochMilliseconds(value.getTime());
}

export function fromInstant(value: Temporal.Instant): Date {
    return new Date(value.epochMilliseconds);
}
