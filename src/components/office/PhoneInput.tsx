import { Input } from "@/components/ui/input";
import { forwardRef } from "react";

interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: string) => void;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, onValueChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, "");

      // Limitar a 11 dígitos (DDD + 9 dígitos)
      if (val.length > 11) {
        val = val.slice(0, 11);
      }

      // Formatar: (XX) XXXXX-XXXX
      let formatted = "";
      if (val.length > 0) {
        formatted = "(";
        if (val.length >= 2) {
          formatted += val.slice(0, 2) + ") ";
          if (val.length > 2) {
            formatted += val.slice(2, 7);
            if (val.length > 7) {
              formatted += "-" + val.slice(7);
            }
          }
        } else {
          formatted += val;
        }
      }

      e.target.value = formatted;
      onChange?.(e);
      onValueChange?.(formatted);
    };

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        placeholder="(61) 99999-9999"
        value={value}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";
