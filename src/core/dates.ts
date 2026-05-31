export function parseTimestamp(value?: string): Date | undefined {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function addMilliseconds(date: Date, value: number): Date {
  return new Date(date.getTime() + value)
}

export function toIsoString(date: Date): string {
  return date.toISOString()
}
