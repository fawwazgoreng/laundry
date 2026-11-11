import { describe, expect, it } from "bun:test"
import { estimateDeliveryTime } from "../../src/lib/deliveryEstimate"

function localDate(value: string): Date {
  const [date, time] = value.split("T")
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

function format(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`
}

describe("estimateDeliveryTime", () => {
  it("adds the service duration plus a 6 hour buffer", () => {
    const result = estimateDeliveryTime(localDate("2026-11-11T12:00"), 6)
    expect(format(result)).toBe("2026-11-12 00:00")
  })

  it("adds the buffer for product-only orders", () => {
    const result = estimateDeliveryTime(localDate("2026-11-11T09:00"), 0)
    expect(format(result)).toBe("2026-11-11 15:00")
  })

  it("moves estimates after 18:00 to 07:00 the next day", () => {
    const result = estimateDeliveryTime(localDate("2026-11-11T10:00"), 6)
    expect(format(result)).toBe("2026-11-12 07:00")
  })

  it("keeps an estimate exactly at 18:00", () => {
    const result = estimateDeliveryTime(localDate("2026-11-11T12:00"), 0)
    expect(format(result)).toBe("2026-11-11 18:00")
  })

  it("keeps early-morning estimates", () => {
    const result = estimateDeliveryTime(localDate("2026-11-11T20:00"), 0)
    expect(format(result)).toBe("2026-11-12 02:00")
  })
})
