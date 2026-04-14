import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from "date-fns";

export const toDate = (value: string): Date => {
  const parsed = parseISO(value);
  return isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date());
};

export const toISODate = (value: Date): string => format(startOfDay(value), "yyyy-MM-dd");

export const calcDuration = (startDate: string, endDate: string): number => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  return Math.max(1, differenceInCalendarDays(end, start) + 1);
};

export const normalizeDates = (startDate: string, endDate: string): { startDate: string; endDate: string } => {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (end < start) {
    return { startDate: toISODate(start), endDate: toISODate(start) };
  }
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

export const endDateFromDuration = (startDate: string, duration: number): string => {
  const start = toDate(startDate);
  const safeDuration = Math.max(1, duration);
  return toISODate(addDays(start, safeDuration - 1));
};
