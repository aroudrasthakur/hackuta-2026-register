export const inputClass =
  "w-full min-w-0 rounded-lg border-2 border-(--sand) bg-white px-4 py-3 text-(--ink) outline-none transition-colors focus:border-(--ocean) focus:ring-2 focus:ring-(--ocean)/20 disabled:cursor-not-allowed disabled:opacity-60";

const inputErrorClass = "border-red-400 focus:border-red-500 focus:ring-red-100";

export const labelClass =
  "flex w-full min-w-0 flex-col gap-1.5 text-sm font-medium text-(--ink)";
export const legendClass = "font-semibold text-(--ink)";

export const fieldsetLegendClass = `${legendClass} mb-5 block w-full`;

export const checkboxFieldsetClass = "flex flex-col gap-6 text-sm";

export const checkboxGridClass = "grid grid-cols-1 gap-4 sm:grid-cols-2";

export const inlineRadioGroupClass = "flex flex-wrap gap-6";

export function fieldClass(error?: string) {
  return error ? `${inputClass} ${inputErrorClass}` : inputClass;
}

export function fieldsetErrorClass(hasError: boolean) {
  return hasError ? "rounded-lg border-2 border-red-400 bg-red-50 p-4" : "";
}
