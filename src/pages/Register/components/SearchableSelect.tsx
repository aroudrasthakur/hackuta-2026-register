import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { FieldError, RequiredMark } from "./FormFields";
import { fieldClass, labelClass, legendClass } from "./formFieldStyles";

const MAX_RESULTS = 50;

type SearchableSelectProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string | undefined;
  placeholder?: string;
  value: string;
  options: readonly string[];
  /** Shown when the query is empty (e.g. regional schools before search). */
  featuredOptions?: readonly string[];
  /** Appended to featured/search results without copying the full options list. */
  extraOptions?: readonly string[];
  onChange: (value: string) => void;
};

export function SearchableSelect({
  id,
  label,
  required,
  error,
  placeholder = "Search and select one",
  value,
  options,
  featuredOptions,
  extraOptions,
  onChange,
}: SearchableSelectProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputValue = open ? query : value;

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matchingExtras = (extraOptions ?? []).filter((option) =>
      normalized ? option.toLowerCase().includes(normalized) : true,
    );

    if (!normalized) {
      if (featuredOptions?.length) {
        return [...featuredOptions, ...matchingExtras];
      }
      return [...options.slice(0, MAX_RESULTS), ...matchingExtras];
    }

    return [
      ...options
        .filter((option) => option.toLowerCase().includes(normalized))
        .slice(0, MAX_RESULTS),
      ...matchingExtras,
    ];
  }, [extraOptions, featuredOptions, options, query]);

  const activeOptionIndex =
    filteredOptions.length === 0
      ? 0
      : Math.min(activeIndex, filteredOptions.length - 1);

  const openList = () => {
    setQuery(value);
    setActiveIndex(0);
    setOpen(true);
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const errorId = `${id}-error`;

  const selectOption = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      openList();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && open && filteredOptions[activeOptionIndex]) {
      event.preventDefault();
      selectOption(filteredOptions[activeOptionIndex]!);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className={labelClass} htmlFor={id}>
        <span className={legendClass}>
          {label}
          {required ? <RequiredMark /> : null}
        </span>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={fieldClass(error)}
          placeholder={placeholder}
          value={inputValue}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
            if (!event.target.value.trim()) {
              onChange("");
            }
          }}
          onFocus={openList}
          onBlur={() => {
            const normalized = query.trim().toLowerCase();
            if (!normalized) return;
            const exact = [...options, ...(extraOptions ?? [])].find(
              (option) => option.toLowerCase() === normalized,
            );
            if (exact) selectOption(exact);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <FieldError id={errorId} message={error} />
      </label>

      {open && filteredOptions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border-2 border-(--sand) bg-white py-1 shadow-lg"
        >
          {filteredOptions.map((option, index) => (
            <li key={option} role="option" aria-selected={option === value}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-(--clay) ${
                  index === activeOptionIndex || option === value
                    ? "bg-(--clay) font-medium text-(--ink)"
                    : "text-(--ink)"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
