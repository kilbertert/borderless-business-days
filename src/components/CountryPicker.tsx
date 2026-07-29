"use client";

import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CountryData } from "@/lib/types";

type Props = {
  countries: CountryData[];
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
  maxSelected?: number;
};

export function CountryPicker({ countries, selectedCodes, onChange, maxSelected = 8 }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const countryMap = useMemo(
    () => new Map(countries.map((country) => [country.code, country])),
    [countries],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return countries;
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(normalized) ||
        country.code.toLowerCase().includes(normalized),
    );
  }, [countries, query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const toggle = (code: string) => {
    if (selectedCodes.includes(code)) {
      if (selectedCodes.length === 1) return;
      onChange(selectedCodes.filter((item) => item !== code));
      return;
    }
    if (selectedCodes.length < maxSelected) onChange([...selectedCodes, code]);
  };

  return (
    <div className="country-field" ref={containerRef}>
      <div className="country-chips" aria-label="Selected countries">
        {selectedCodes.map((code) => {
          const country = countryMap.get(code);
          if (!country) return null;
          return (
            <span className="country-chip" key={code}>
              <span className="country-code">{code}</span>
              <span>{country.name}</span>
              <button
                type="button"
                title={`Remove ${country.name}`}
                aria-label={`Remove ${country.name}`}
                onClick={() => toggle(code)}
                disabled={selectedCodes.length === 1}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          );
        })}
      </div>
      <button
        className="select-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selectedCodes.length}/{maxSelected} markets selected</span>
        <ChevronsUpDown size={17} aria-hidden="true" />
      </button>
      {open ? (
        <div className="country-menu">
          <label className="country-search">
            <Search size={16} aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search country or code"
            />
          </label>
          <div className="country-options" role="listbox" aria-multiselectable="true">
            {filtered.map((country) => {
              const selected = selectedCodes.includes(country.code);
              const disabled = !selected && selectedCodes.length >= maxSelected;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  className={selected ? "country-option selected" : "country-option"}
                  key={country.code}
                  onClick={() => toggle(country.code)}
                >
                  <span className="country-code">{country.code}</span>
                  <span>{country.name}</span>
                  {selected ? <Check size={16} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
