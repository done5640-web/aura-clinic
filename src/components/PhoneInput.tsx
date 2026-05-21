import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { getPhoneCountry, PHONE_COUNTRIES } from "@/lib/phoneCountry";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

function splitPhone(raw: string): { prefix: string; local: string } {
  if (!raw) return { prefix: "", local: "" };
  const country = getPhoneCountry(raw);
  if (!country) return { prefix: "", local: raw };
  const normalized = raw.startsWith("+") ? raw : "+" + raw;
  return { prefix: country.prefix, local: normalized.slice(country.prefix.length) };
}

export default function PhoneInput({ value, onChange, className, placeholder }: PhoneInputProps) {
  const [prefix, setPrefix] = useState(() => splitPhone(value).prefix);
  const [fullNumber, setFullNumber] = useState(() => value || "");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync when value changes externally
  useEffect(() => {
    const { prefix: p } = splitPhone(value);
    setPrefix(p);
    setFullNumber(value || "");
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedCountry = PHONE_COUNTRIES.find(c => c.prefix === prefix);

  const filtered = search.trim()
    ? PHONE_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.prefix.includes(search)
      )
    : PHONE_COUNTRIES;

  const selectCountry = (c: typeof PHONE_COUNTRIES[0]) => {
    const { local } = splitPhone(fullNumber);
    const newFull = c.prefix + local;
    setPrefix(c.prefix);
    setFullNumber(newFull);
    setOpen(false);
    setSearch("");
    onChange(newFull);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFullNumber(val);
    const country = getPhoneCountry(val);
    if (country) setPrefix(country.prefix);
    else if (!val) setPrefix("");
    onChange(val);
  };

  return (
    <div className={cn("flex gap-1 relative", className)} ref={dropdownRef}>
      {/* Flag / country-code trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 h-9 px-2.5 rounded-md border border-input bg-background text-sm hover:bg-muted transition-colors shrink-0 min-w-[72px]"
      >
        <span className="text-base leading-none">
          {selectedCountry ? selectedCountry.flag : "🌐"}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          {selectedCountry ? selectedCountry.prefix : "+?"}
        </span>
        <svg className="w-3 h-3 text-muted-foreground ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-10 z-50 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Kërko vendin..."
              className="h-7 text-sm"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Asnjë rezultat</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.prefix}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
                    c.prefix === prefix && "bg-muted"
                  )}
                >
                  <span className="text-base shrink-0">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground font-mono shrink-0">{c.prefix}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Full number input — shows prefix + number so it's copyable */}
      <Input
        type="tel"
        value={fullNumber}
        onChange={handleNumberChange}
        placeholder={placeholder ?? "+355 123 456 789"}
        className="flex-1"
      />
    </div>
  );
}
