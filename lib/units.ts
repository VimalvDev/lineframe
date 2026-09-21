import type { Dpi } from '@/store/useGridStore';

export type MeasurementUnit = 'mm' | 'cm' | 'in' | 'px';

export function mmToUnit(mm: number, unit: MeasurementUnit, dpi: Dpi = 300): number {
  if (unit === 'mm') return mm;
  if (unit === 'cm') return mm / 10;
  if (unit === 'in') return mm / 25.4;
  if (unit === 'px') return (mm / 25.4) * dpi;
  return mm;
}

export function unitToMm(value: number, unit: MeasurementUnit, dpi: Dpi = 300): number {
  if (unit === 'mm') return value;
  if (unit === 'cm') return value * 10;
  if (unit === 'in') return value * 25.4;
  if (unit === 'px') return (value / dpi) * 25.4;
  return value;
}

export function formatUnit(mm: number, unit: MeasurementUnit, dpi: Dpi = 300): string {
  const value = mmToUnit(mm, unit, dpi);
  if (unit === 'px') return Math.round(value).toString();
  return value.toFixed(2);
}
