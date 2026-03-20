import { useState, useEffect, useRef } from "react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PhoneInput } from "./PhoneInput";
import { useSearchContactsByPhone } from "@/hooks/office/useSearchContactsByPhone";
import { Loader2, User } from "lucide-react";

interface Contact {
  id: string;
  nome: string;
  telefone_norm: string;
  cidade_id: string | null;
  cidade: {
    id: string;
    nome: string;
  } | null;
  last_leader_id: string | null;
  last_leader: {
    id: string;
    nome_completo: string;
  } | null;
}

interface ContactPhoneAutocompleteProps {
  value: string;
  onPhoneChange: (phone: string) => void;
  onContactSelect: (contact: Contact | null) => void;
  disabled?: boolean;
  required?: boolean;
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7);
    return `(${ddd}) ${part1}-${part2}`;
  }
  return phone;
}

export function ContactPhoneAutocomplete({
  value,
  onPhoneChange,
  onContactSelect,
  disabled = false,
  required = false,
}: ContactPhoneAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: contacts = [], isLoading } = useSearchContactsByPhone(inputValue);

  // Sync input value with external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Open popover when we have results
  useEffect(() => {
    if (contacts.length > 0 && inputValue.replace(/\D/g, "").length >= 3) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [contacts, inputValue]);

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onPhoneChange(newValue);
    onContactSelect(null); // Clear selection when typing
  };

  const handleSelect = (contact: Contact) => {
    const formattedPhone = formatPhoneDisplay(contact.telefone_norm);
    setInputValue(formattedPhone);
    onPhoneChange(formattedPhone);
    onContactSelect(contact);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div>
            <PhoneInput
              id="whatsapp"
              value={inputValue}
              onValueChange={handleInputChange}
              required={required}
              disabled={disabled}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)]"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : contacts.length === 0 ? (
                <CommandEmpty>Nenhum contato encontrado</CommandEmpty>
              ) : (
                <CommandGroup>
                  {contacts.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={contact.id}
                      onSelect={() => handleSelect(contact)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium">{contact.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatPhoneDisplay(contact.telefone_norm)}
                            {contact.cidade && ` • ${contact.cidade.nome}`}
                          </span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
