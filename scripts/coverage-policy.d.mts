export declare const MINIMUM: number;
export declare const METRICS: readonly ["statements", "branches", "functions", "lines"];
export declare const COVERAGE_INCLUDE: string[];
export declare const COVERAGE_EXCLUDE_REASONS: Record<string, string>;
export declare const COVERAGE_EXCLUDE: string[];
export declare const COVERAGE_AREAS: Record<string, string>;
export declare const VITEST_THRESHOLDS: Record<
  string,
  number | Record<"statements" | "branches" | "functions" | "lines", number>
>;
