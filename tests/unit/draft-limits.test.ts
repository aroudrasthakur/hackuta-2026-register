import { describe, expect, it } from "vitest";
import {
  FIELD_LIMITS,
  MAX_GRADUATION_YEAR,
  MIN_GRADUATION_YEAR,
} from "../../shared/registration/constants";
import {
  DRAFT_ARRAY_TOO_LONG_MESSAGE,
  DRAFT_FIELD_TOO_LONG_MESSAGE,
  DRAFT_NUMBER_OUT_OF_RANGE_MESSAGE,
  validateDraftPatchLimits,
} from "../../shared/registration/draftLimits";

describe("validateDraftPatchLimits", () => {
  it("rejects oversized essay fields", () => {
    expect(() =>
      validateDraftPatchLimits({
        builtOrWantToBuild: "x".repeat(FIELD_LIMITS.builtOrWantToBuild + 1),
      }),
    ).toThrow(DRAFT_FIELD_TOO_LONG_MESSAGE);
  });

  it("rejects oversized multi-select arrays", () => {
    expect(() =>
      validateDraftPatchLimits({
        raceEthnicity: Array.from({ length: 10_000 }, (_, index) => `option-${index}`),
      }),
    ).toThrow(DRAFT_ARRAY_TOO_LONG_MESSAGE);
  });

  it("rejects out-of-range numeric draft fields", () => {
    expect(() => validateDraftPatchLimits({ age: 12 })).toThrow(DRAFT_NUMBER_OUT_OF_RANGE_MESSAGE);
    expect(() => validateDraftPatchLimits({ hackathonsAttended: 999 })).toThrow(
      DRAFT_NUMBER_OUT_OF_RANGE_MESSAGE,
    );
    expect(() => validateDraftPatchLimits({ graduationYear: MIN_GRADUATION_YEAR - 1 })).toThrow(
      DRAFT_NUMBER_OUT_OF_RANGE_MESSAGE,
    );
    expect(() => validateDraftPatchLimits({ graduationYear: MAX_GRADUATION_YEAR + 1 })).toThrow(
      DRAFT_NUMBER_OUT_OF_RANGE_MESSAGE,
    );
  });

  it("rejects NaN numeric draft fields", () => {
    expect(() => validateDraftPatchLimits({ age: Number.NaN })).toThrow(
      DRAFT_NUMBER_OUT_OF_RANGE_MESSAGE,
    );
  });

  it("accepts values within limits", () => {
    expect(() =>
      validateDraftPatchLimits({
        firstName: "Ada",
        raceEthnicity: ["White"],
      }),
    ).not.toThrow();
  });
});
