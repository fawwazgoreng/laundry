import { AppError } from "../helper/errorHandling/appError";

export type Coor = {
    latitude: number;
    longitude: number;
};

const EARTH_RADIUS_KM = 6371;
const FEE_PER_KM = 2000;

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

export function calculateFee(outletAddress: Coor, userAddress: Coor, maksKm: number): number {
    const distance = calculateDistance(outletAddress, userAddress);

    if (distance > maksKm) {
        throw new AppError(422,"VALIDATION_ERROR", `Jarak alamat terlalu jauh (melebihi ${maksKm} km)`)
    }

    return Math.round(distance * FEE_PER_KM);
}
