import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { fieldClass, labelClass, legendClass } from "./formFieldStyles";

export function RequiredMark() {
  return (
    <>
      {" "}
      <span aria-hidden="true">*</span>
    </>
  );
}

export function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string | undefined;
}) {
  if (!message) return null;

  return (
    <p id={id} className="text-xs font-medium text-red-600">
      {message}
    </p>
  );
}

type TextFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string | undefined;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextField({
  id,
  label,
  required,
  error,
  className,
  ...inputProps
}: TextFieldProps) {
  const errorId = `${id}-error`;

  return (
    <label className={labelClass} htmlFor={id}>
      <span className={legendClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      <input
        id={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={className ?? fieldClass(error)}
        {...inputProps}
      />
      <FieldError id={errorId} message={error} />
    </label>
  );
}

type SelectFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string | undefined;
  placeholder?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({
  id,
  label,
  required,
  error,
  placeholder = "Select one",
  children,
  className,
  ...selectProps
}: SelectFieldProps) {
  const errorId = `${id}-error`;

  return (
    <label className={labelClass} htmlFor={id}>
      <span className={legendClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      <div className="relative w-full">
        <select
          id={id}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`${className ?? fieldClass(error)} appearance-none pr-10 cursor-pointer`}
          {...selectProps}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {children}
        </select>
        <div
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <FieldError id={errorId} message={error} />
    </label>
  );
}
