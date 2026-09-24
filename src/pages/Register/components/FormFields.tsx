import {
  memo,
  useCallback,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import { fieldClass, labelClass, legendClass } from "./formFieldStyles";
import { useDropdownDismiss } from "./useDropdownDismiss";

const OPTION_ROW_HEIGHT = 40;
const LISTBOX_VISIBLE_ROWS = 6;
const LISTBOX_OVERSCAN_ROWS = 2;

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
  helperText?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextField({
  id,
  label,
  required,
  error,
  helperText,
  className,
  ...inputProps
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const descriptionIds = [helperText ? helperId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

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
        aria-describedby={descriptionIds || undefined}
        className={className ?? fieldClass(error)}
        {...inputProps}
      />
      {helperText ? (
        <p id={helperId} className="text-xs font-normal text-(--ocean)">
          {helperText}
        </p>
      ) : null}
      <FieldError id={errorId} message={error} />
    </label>
  );
}

type SelectFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string | undefined;
  helperText?: string;
  placeholder?: string;
  value: string;
  options: readonly string[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

export const SelectField = memo(function SelectField({
  id,
  label,
  required,
  error,
  helperText,
  placeholder = "Select one",
  value,
  options,
  disabled,
  onChange,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [firstVisibleOption, setFirstVisibleOption] = useState(0);
  const selectRef = useRef<HTMLSelectElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const labelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const descriptionIds = [helperText ? helperId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; disabled?: boolean; children?: ReactNode }>(child)) {
      return [];
    }

    return [{
      value: child.props.value ?? "",
      label: child.props.children,
      disabled: child.props.disabled,
    }];
  });
  const value = typeof selectProps.value === "string" ? selectProps.value : "";
  const selectedOptionIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options.find((option) => option.value === value);
  const lastVisibleOption = Math.min(
    options.length,
    firstVisibleOption + LISTBOX_VISIBLE_ROWS + LISTBOX_OVERSCAN_ROWS * 2,
  );
  const visibleOptions = options.slice(firstVisibleOption, lastVisibleOption);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const selectOption = (nextValue: string) => {
    const nativeSelect = selectRef.current;
    if (!nativeSelect) return;

    nativeSelect.value = nextValue;
    nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    setOpen(false);
  };

  const openList = () => {
    setFirstVisibleOption(
      Math.max(0, selectedOptionIndex - LISTBOX_OVERSCAN_ROWS),
    );
    setOpen(true);
  };

  useEffect(() => {
    if (open) {
      listboxRef.current?.scrollTo({
        top: Math.max(0, selectedOptionIndex * OPTION_ROW_HEIGHT),
      });
    }
  }, [open, selectedOptionIndex]);

  const selectedIndex = value ? options.indexOf(value) : -1;
  const activeOptionIndex =
    options.length === 0 ? 0 : Math.min(activeIndex, options.length - 1);

  const openList = useCallback(() => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const selectOption = useCallback(
    (option: string) => {
      onChange(option);
      closeList();
    },
    [closeList, onChange],
  );

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openList();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && open && options[activeOptionIndex]) {
      event.preventDefault();
      selectOption(options[activeOptionIndex]!);
    }
  };

  const displayValue = value || placeholder;

  return (
    <div className={labelClass}>
      <span id={labelId} className={legendClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      <div ref={containerRef} className="relative w-full">
        <select
          ref={selectRef}
          id={id}
          required={required}
          aria-invalid={!!error}
          aria-describedby={descriptionIds || undefined}
          className="sr-only"
          tabIndex={-1}
          {...selectProps}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {children}
        </select>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-labelledby={labelId}
          aria-describedby={descriptionIds || undefined}
          disabled={selectProps.disabled}
          className={`${className ?? fieldClass(error)} flex items-center justify-between bg-(--light) pr-3 text-left ${selectedOption ? "font-bold text-(--ocean)" : ""}`}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openList();
            }
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <span>{selectedOption?.label ?? placeholder}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {open ? (
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border-2 border-(--sand) bg-(--light) py-1 shadow-lg"
            onScroll={(event) => {
              const nextFirstVisibleOption = Math.max(
                0,
                Math.floor(event.currentTarget.scrollTop / OPTION_ROW_HEIGHT) -
                  LISTBOX_OVERSCAN_ROWS,
              );
              setFirstVisibleOption((current) =>
                current === nextFirstVisibleOption ? current : nextFirstVisibleOption,
              );
            }}
          >
            {firstVisibleOption > 0 ? (
              <li aria-hidden="true" style={{ height: firstVisibleOption * OPTION_ROW_HEIGHT }} />
            ) : null}
            {visibleOptions.map((option) => (
              <li key={option.value} role="option" aria-selected={option.value === value}>
                <button
                  type="button"
                  disabled={option.disabled}
                  className={`flex h-10 w-full items-center px-3 text-left text-sm text-(--ink) transition-colors hover:bg-(--clay) hover:text-(--ocean) disabled:cursor-not-allowed disabled:opacity-60 ${
                    option.value === value ? "bg-white font-bold text-(--ocean)" : ""
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option.value)}
                >
                  {option.label}
                </button>
              </li>
            ))}
            {lastVisibleOption < options.length ? (
              <li
                aria-hidden="true"
                style={{ height: (options.length - lastVisibleOption) * OPTION_ROW_HEIGHT }}
              />
            ) : null}
          </ul>
        ) : null}
      </div>
      {helperText ? (
        <p id={helperId} className="text-xs font-normal text-(--ocean)">
          {helperText}
        </p>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
});
