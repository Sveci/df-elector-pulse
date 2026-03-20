import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface MaskedDateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

const MaskedDateInput = React.forwardRef<HTMLInputElement, MaskedDateInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const formatDateInput = (input: string): string => {
      // Remove tudo que não é número
      const numbers = input.replace(/\D/g, "");

      // Aplica máscara DD/MM/AAAA
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
      return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDateInput(e.target.value);
      onChange(formatted);
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder="DD/MM/AAAA"
        maxLength={10}
        className={cn(className)}
        {...props}
      />
    );
  }
);

MaskedDateInput.displayName = "MaskedDateInput";

/**
 * Converte data no formato DD/MM/AAAA para YYYY-MM-DD (formato do banco)
 */
export function parseDateBR(dateBR: string): string | null {
  if (!dateBR || dateBR.length !== 10) return null;

  const [day, month, year] = dateBR.split("/");
  if (!day || !month || !year) return null;

  return `${year}-${month}-${day}`;
}

/**
 * Converte data no formato YYYY-MM-DD para DD/MM/AAAA
 */
export function formatDateBR(dateISO: string): string {
  if (!dateISO || dateISO.length < 10) return "";

  const [year, month, day] = dateISO.slice(0, 10).split("-");
  if (!day || !month || !year) return "";

  return `${day}/${month}/${year}`;
}

/**
 * Valida se a data no formato DD/MM/AAAA é válida
 */
export function isValidDateBR(dateBR: string): boolean {
  if (!dateBR || dateBR.length !== 10) return false;

  const [dayStr, monthStr, yearStr] = dateBR.split("/");
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;

  // Verifica se a data é válida criando um Date e comparando
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Verifica se a data não é futura
 */
export function isNotFutureDate(dateBR: string): boolean {
  if (!isValidDateBR(dateBR)) return false;

  const [dayStr, monthStr, yearStr] = dateBR.split("/");
  const date = new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10)
  );

  return date <= new Date();
}

export { MaskedDateInput };
