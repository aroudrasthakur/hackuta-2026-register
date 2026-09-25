/** Legacy column before MLH-specific rename. */
export const LEGACY_CODE_OF_CONDUCT_FIELD = "codeOfConductAgreed" as const;

/** Intermediate column name (capital M) before camelCase normalization. */
export const INTERIM_MLH_CODE_OF_CONDUCT_FIELD = "MLHcodeOfConductAgreed" as const;

export const MLH_CODE_OF_CONDUCT_FIELD = "mlhCodeOfConductAgreed" as const;

/** Read MLH Code of Conduct agreement from current or legacy stored columns. */
export function resolveMlhCodeOfConductAgreed(
  application: Record<string, unknown>,
): boolean {
  const current = application[MLH_CODE_OF_CONDUCT_FIELD];
  if (typeof current === "boolean") {
    return current;
  }

  const interim = application[INTERIM_MLH_CODE_OF_CONDUCT_FIELD];
  if (typeof interim === "boolean") {
    return interim;
  }

  const legacy = application[LEGACY_CODE_OF_CONDUCT_FIELD];
  if (typeof legacy === "boolean") {
    return legacy;
  }

  return false;
}

type DraftPatchWithLegacyCodeOfConduct = {
  mlhCodeOfConductAgreed?: boolean;
  MLHcodeOfConductAgreed?: boolean;
  codeOfConductAgreed?: boolean;
};

/** Normalize draft patches that still send legacy column names. */
export function normalizeDraftCodeOfConductPatch<
  T extends DraftPatchWithLegacyCodeOfConduct,
>(
  patch: T,
): Omit<T, "codeOfConductAgreed" | "MLHcodeOfConductAgreed"> & {
  mlhCodeOfConductAgreed: boolean;
} {
  const { codeOfConductAgreed, MLHcodeOfConductAgreed, ...rest } = patch;
  return {
    ...rest,
    mlhCodeOfConductAgreed:
      rest.mlhCodeOfConductAgreed ??
      MLHcodeOfConductAgreed ??
      codeOfConductAgreed ??
      false,
  };
}
