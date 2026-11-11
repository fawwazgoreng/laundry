import { AppError } from "../helper/errorHandling/appError";

export type Coor = {
    latitude: number;
    longitude: number;
};

const EARTH_RADIUS_KM = 6371;
export const FEE_PER_KM = 2000;

export function calculateDistance(outletAddress: Coor, userAddress: Coor): number {
    const dLat = (userAddress.latitude - outletAddress.latitude) * (Math.PI / 180);
    const dLon = (userAddress.longitude - outletAddress.longitude) * (Math.PI / 180);

    const lat1 = outletAddress.latitude * (Math.PI / 180);
    const lat2 = userAddress.latitude * (Math.PI / 180);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/** Jarak disimpan pada kolom NUMERIC(6,2), jadi bulatkan sebelum dipakai. */
export function roundDistanceKm(distanceKm: number): number {
    return Math.round(distanceKm * 100) / 100;
}

export type OutletDistance<T extends Coor> = {
    outlet: T;
    distanceKm: number;
};

/** Pilih outlet dengan jarak terjauh dari titik pengguna. */
export function selectFarthestOutlet<T extends Coor>(
    userAddress: Coor,
    outlets: readonly T[],
): OutletDistance<T> | null {
    let farthest: OutletDistance<T> | null = null;
    for (const outlet of outlets) {
        const distanceKm = calculateDistance(outlet, userAddress);
        if (!Number.isFinite(distanceKm)) continue;
        if (!farthest || distanceKm > farthest.distanceKm) {
            farthest = { outlet, distanceKm };
        }
    }
    return farthest;
}

export function assertWithinCoverage(distanceKm: number, maxCoverageKm: number): void {
    if (distanceKm > maxCoverageKm) {
        throw new AppError(
            422,
            "VALIDATION_ERROR",
            `Jarak alamat terlalu jauh (${distanceKm.toFixed(2)} km, melebihi ${maxCoverageKm} km)`,
        );
    }
}
