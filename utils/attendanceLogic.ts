
import { differenceInMinutes, format, isBefore, isAfter } from 'date-fns';

export function calculateDelay(checkInTime: Date, scheduledStartTime: string, gracePeriod: number = 0): number {
  const [hours, minutes] = scheduledStartTime.split(':').map(Number);
  const scheduled = new Date(checkInTime);
  scheduled.setHours(hours, minutes, 0, 0);

  if (isAfter(checkInTime, scheduled)) {
    const totalDelay = differenceInMinutes(checkInTime, scheduled);
    // خصم وقت السماحية من إجمالي التأخير
    const actualDelay = totalDelay - gracePeriod;
    return actualDelay > 0 ? actualDelay : 0;
  }
  return 0;
}

export function calculateEarlyDeparture(checkOutTime: Date, scheduledEndTime: string, gracePeriod: number = 0): number {
  const [hours, minutes] = scheduledEndTime.split(':').map(Number);
  const scheduled = new Date(checkOutTime);
  scheduled.setHours(hours, minutes, 0, 0);

  if (isBefore(checkOutTime, scheduled)) {
    const totalEarly = differenceInMinutes(scheduled, checkOutTime);
    // خصم وقت السماحية من إجمالي الخروج المبكر
    const actualEarly = totalEarly - gracePeriod;
    return actualEarly > 0 ? actualEarly : 0;
  }
  return 0;
}

export function calculateWorkingHours(checkIn: Date, checkOut: Date): number {
  const minutes = differenceInMinutes(checkOut, checkIn);
  const hours = minutes / 60;
  return Math.max(0, Number(hours.toFixed(2)));
}

export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

/**
 * حساب المسافة بين نقطتين جغرافيتين بالأمتار
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // نصف قطر الأرض بالأمتار
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // المسافة بالأمتار
}
