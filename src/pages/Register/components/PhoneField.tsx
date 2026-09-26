import { type CountryCode } from "libphonenumber-js/max";

import { useState } from "react";

import { sanitizePhoneDigits } from "../../../../shared/registration/schema";

import { DropdownChevron } from "./DropdownChevron";

import { FieldError, RequiredMark } from "./FormFields";

import {

  countryCodeSelectClass,

  fieldClass,

  labelClass,

  legendClass,

} from "./formFieldStyles";

import {
  countryDisplayName,
  formatPhoneCountryOption,
  phoneCountries,
} from "./phoneCountryOptions";



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

  const [countrySelectOpen, setCountrySelectOpen] = useState(false);

  const digits = sanitizePhoneDigits(value);



  function handlePhoneChange(nextValue: string) {

    onChange(sanitizePhoneDigits(nextValue), selectedCountry);

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

        <div className="relative shrink-0">

          <select

            id={`${id}-country`}

            className={`${countryCodeSelectClass(error)} w-[5.25rem] tabular-nums`}

            value={selectedCountry}

            onFocus={() => setCountrySelectOpen(true)}

            onBlur={() => setCountrySelectOpen(false)}

            onChange={(event) => onChange(digits, event.target.value as CountryCode)}

          >

            {phoneCountries.map((option) => (

              <option

                key={option}

                value={option}

                title={countryDisplayName(option)}

              >

                {formatPhoneCountryOption(option)}

              </option>

            ))}

          </select>

          <DropdownChevron active={countrySelectOpen} className="right-1.5" size={12} />

        </div>

        <input

          id={id}

          type="tel"

          inputMode="numeric"

          pattern="[0-9]*"

          required

          autoComplete={autoComplete}

          aria-invalid={!!error}

          aria-describedby={error ? errorId : undefined}

          className={fieldClass(error)}

          value={digits}

          onChange={(event) => handlePhoneChange(event.target.value)}

        />

      </div>

      <FieldError id={errorId} message={error} />

    </div>

  );

}


