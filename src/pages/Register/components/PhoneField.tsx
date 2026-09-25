import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";
import { formatUsPhone } from "../../../../shared/registration/schema";
import { FIELD_LIMITS } from "../../../../shared/registration/constants";
import { FieldError, RequiredMark } from "./FormFields";
import { fieldClass, labelClass, legendClass } from "./formFieldStyles";

const countries = getCountries();
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

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
  const selectedCountry = country || "US";

  function blurNumber() {
    const digits = value.replace(/\D/g, "");
    if (!value.trim().startsWith("+") && selectedCountry === "US" && digits.length === 10) {
      onChange(formatUsPhone(value), selectedCountry);
      return;
    }
    if (value.trim().startsWith("+")) {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed?.country) onChange(value, parsed.country);
    }
  }

  const errorId = `${id}-error`;
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
          className={`${fieldClass(error)} w-32 shrink-0 px-2 sm:w-40`}
          value={selectedCountry}
          onChange={(event) => onChange(value, event.target.value as CountryCode)}
        >
          {countries.map((option) => (
            <option key={option} value={option}>
              +{getCountryCallingCode(option)} {countryNames.of(option)}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          required
          maxLength={FIELD_LIMITS.phone}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={fieldClass(error)}
          value={value}
          onChange={(event) => onChange(event.target.value, selectedCountry)}
          onBlur={blurNumber}
        />
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
}
