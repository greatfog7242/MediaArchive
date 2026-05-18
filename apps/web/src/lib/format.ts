export const DATE_ONLY_UTC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const DATE_TIME_UTC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export const NUMBER_EN_US_FORMATTER = new Intl.NumberFormat("en-US");

export function formatDateOnlyUTC(value: string | number | Date | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return DATE_ONLY_UTC_FORMATTER.format(parsed);
}

export function formatDateTimeUTC(value: string | number | Date | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return DATE_TIME_UTC_FORMATTER.format(parsed);
}

export function formatNumberEnUS(value: number): string {
  return NUMBER_EN_US_FORMATTER.format(value);
}
