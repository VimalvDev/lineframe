import { useState, useEffect } from 'react';
import type { Dpi } from '@/store/useGridStore';
import { type MeasurementUnit, mmToUnit, unitToMm } from '@/lib/units';

interface UnitInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  valueMm: number;
  unit: MeasurementUnit;
  dpi: Dpi;
  onChangeMm: (valMm: number) => void;
}

export default function UnitInput({
  valueMm,
  unit,
  dpi,
  onChangeMm,
  className,
  ...props
}: UnitInputProps) {
  // Convert canonical mm to local string representation based on the unit
  const formatLocal = (mm: number) => {
    const val = mmToUnit(mm, unit, dpi);
    // Use 0 decimals for px, 2 for physical units, or let the browser step naturally.
    // We store the exact string so typing '1.' doesn't snap to '1' immediately.
    if (unit === 'px') return Math.round(val).toString();
    // Only round to 2 decimals if it has many, otherwise keep it clean.
    return (Math.round(val * 100) / 100).toString();
  };

  const [localStr, setLocalStr] = useState<string>(formatLocal(valueMm));

  // Sync external changes (e.g. from preset switching) if it diverges from what the user typed
  useEffect(() => {
    const expected = formatLocal(valueMm);
    // To prevent the cursor jumping while typing "2.0", we only update if the canonical values diverge significantly.
    const currentNum = parseFloat(localStr);
    const expectedNum = parseFloat(expected);
    if (isNaN(currentNum) || Math.abs(currentNum - expectedNum) > 0.001) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalStr(expected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueMm, unit, dpi]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value;
    setLocalStr(str);
    
    const num = parseFloat(str);
    if (!isNaN(num)) {
      const newMm = unitToMm(num, unit, dpi);
      onChangeMm(newMm);
    }
  };

  const handleBlur = () => {
    // Reformat on blur to clean up e.g. "2." to "2"
    const num = parseFloat(localStr);
    if (!isNaN(num)) {
      setLocalStr(formatLocal(unitToMm(num, unit, dpi)));
    }
  };

  return (
    <input
      type="number"
      value={localStr}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      step={unit === 'px' ? 1 : 0.01}
      {...props}
    />
  );
}
