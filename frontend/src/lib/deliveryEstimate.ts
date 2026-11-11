export const DELIVERY_BUFFER_HOURS = 6
export const NIGHT_CUTOFF_HOUR = 18
export const MORNING_HOUR = 7

export function estimateDeliveryTime(start: Date, serviceHours: number): Date {
  const durationHours = Number.isFinite(serviceHours) && serviceHours > 0 ? serviceHours : 0
  const estimate = new Date(start.getTime() + (durationHours + DELIVERY_BUFFER_HOURS) * 60 * 60 * 1000)
  const minutesOfDay = estimate.getHours() * 60 + estimate.getMinutes()
  if (minutesOfDay > NIGHT_CUTOFF_HOUR * 60) {
    estimate.setDate(estimate.getDate() + 1)
    estimate.setHours(MORNING_HOUR, 0, 0, 0)
  }
  return estimate
}
