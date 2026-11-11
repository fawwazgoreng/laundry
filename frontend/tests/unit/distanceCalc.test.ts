import { describe, expect, it } from "bun:test"
import { calculateDistance } from "../../src/lib/distanceCalc"

describe("calculateDistance", () => {
  it("returns 0 for the same coordinate", () => {
    const point = { latitude: -6.2, longitude: 106.8 }
    expect(calculateDistance(point, point)).toBe(0)
  })

  it("is close to 111.2 km for one degree of latitude", () => {
    const distance = calculateDistance(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    )
    expect(distance).toBeGreaterThan(111)
    expect(distance).toBeLessThan(111.3)
  })
})
