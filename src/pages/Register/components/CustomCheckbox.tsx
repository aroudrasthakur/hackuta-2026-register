import type { InputHTMLAttributes } from "react";

type CustomCheckboxProps = {
  label: string | React.ReactNode;
  id: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function CustomCheckbox({ label, id, className = "", ...props }: CustomCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 text-(--ink) cursor-pointer group ${className}`}
    >
      <div className="relative flex items-center justify-center flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          id={id}
          className="peer absolute opacity-0 w-5 h-5 cursor-pointer"
          {...props}
        />
        <div className="w-5 h-5 rounded border-2 border-(--sand) bg-white transition-all peer-checked:bg-(--ocean) peer-checked:border-(--ocean) peer-focus-visible:ring-2 peer-focus-visible:ring-(--ocean)/30 peer-focus-visible:ring-offset-2 flex items-center justify-center">
          <svg
            className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
            viewBox="0 0 12 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 5l3.5 3.5L11 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <span className="text-sm leading-relaxed group-hover:text-(--ocean) transition-colors">
        {label}
      </span>
    </label>
  );
}

type CustomRadioProps = {
  label: string;
  id: string;
  name: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function CustomRadio({ label, id, name, className = "", ...props }: CustomRadioProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 text-(--ink) cursor-pointer group ${className}`}
    >
      <div className="relative flex items-center justify-center flex-shrink-0">
        <input
          type="radio"
          id={id}
          name={name}
          className="peer absolute opacity-0 w-5 h-5 cursor-pointer"
          {...props}
        />
        <div className="w-5 h-5 rounded-full border-2 border-(--sand) bg-white transition-all peer-checked:border-(--ocean) peer-focus-visible:ring-2 peer-focus-visible:ring-(--ocean)/30 peer-focus-visible:ring-offset-2 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-(--ocean) opacity-0 peer-checked:opacity-100 transition-opacity scale-0 peer-checked:scale-100" />
        </div>
      </div>
      <span className="text-sm font-medium group-hover:text-(--ocean) transition-colors">
        {label}
      </span>
    </label>
  );
}
