import { useEffect, useRef, useState } from "react";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";
import { FieldError, RequiredMark } from "./FormFields";
import { fieldClass, labelClass, legendClass } from "./formFieldStyles";

const countries = getCountries();
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryForNumber(phone: NonNullable<ReturnType<typeof parsePhoneNumberFromString>>) {
  return phone.country ?? countries.find(
    (candidate) => getCountryCallingCode(candidate) === phone.countryCallingCode,
  );
}

function fromStored(value: string, selectedCountry: CountryCode | "") {
  const parsed = parsePhoneNumberFromString(value);
  if (parsed) {
    const country = selectedCountry || countryForNumber(parsed);
    if (country) return {
      country,
      national: value.slice(parsed.countryCallingCode.length + 1).trim(),
    };
  }
  return { country: selectedCountry || ("US" as CountryCode), national: value };
}

export function PhoneField({
  id,
  label,
  value,
  country,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  country: CountryCode | "";
  onChange: (value: string, country: CountryCode) => void;
  error?: string | undefined;
  autoComplete?: string;
}) {
  const [entry, setEntry] = useState(() => fromStored(value, country));
  const lastEmitted = useRef<{ value: string; country: CountryCode } | null>(null);

  useEffect(() => {
    if (value !== lastEmitted.current?.value || country !== lastEmitted.current?.country) {
      setEntry(fromStored(value, country));
    }
  }, [value, country]);

  function emit(country: CountryCode, national: string) {
    const next = national.trim()
      ? `+${getCountryCallingCode(country)}${national.replace(/\D/g, "")}`
      : "";
    lastEmitted.current = { value: next, country };
    onChange(next, country);
  }

  function changeNumber(raw: string) {
    raw = raw.replace(/[^\d\s().+-]/g, "");
    if (raw.trim().startsWith("+")) {
      const parsed = parsePhoneNumberFromString(raw);
      const country = parsed && countryForNumber(parsed);
      if (country) {
        const national = raw.trim().slice(parsed.countryCallingCode.length + 1).trim();
        setEntry({ country, national });
        emit(country, national);
        return;
      }
    }
    setEntry({ ...entry, national: raw });
    emit(entry.country, raw);
  }

  const errorId = `${id}-error`;
  const displayError = error === "Enter a valid phone number."
    ? `Enter a valid phone number for ${countryNames.of(entry.country)} (+${getCountryCallingCode(entry.country)}).`
    : error;
  return (
    <div className={labelClass}>
      <label className={legendClass} htmlFor={id}>
        {label}<RequiredMark />
      </label>
      <div className="flex min-w-0 gap-2">
        <label className="sr-only" htmlFor={`${id}-country`}>
          {id === "phone" ? "Applicant calling code" : "Emergency contact calling code"}
        </label>
        <select
          id={`${id}-country`}
          className={`${fieldClass(displayError)} w-32 shrink-0 px-2 sm:w-40`}
          value={entry.country}
          onChange={(event) => {
            const country = event.target.value as CountryCode;
            setEntry({ ...entry, country });
            emit(country, entry.national);
          }}
        >
          {countries.map((country) => (
            <option key={country} value={country}>
              +{getCountryCallingCode(country)} {countryNames.of(country)}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          required
          autoComplete={autoComplete}
          aria-invalid={!!displayError}
          aria-describedby={displayError ? errorId : undefined}
          className={fieldClass(displayError)}
          value={entry.national}
          onChange={(event) => changeNumber(event.target.value)}
        />
      </div>
      <FieldError id={errorId} message={displayError} />
    </div>
  );
}
