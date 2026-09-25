/** Agreement booleans with independently managed server-side timestamps. */
export const AGREEMENT_TIMESTAMP_PAIRS = [
  { agreed: "mlhCodeOfConductAgreed", at: "mlhCodeOfConductAgreedAt" },
  { agreed: "mlhDataSharingConsent", at: "mlhDataSharingConsentAt" },
  { agreed: "mlhCommunicationsConsent", at: "mlhCommunicationsConsentAt" },
  { agreed: "sponsorSharingConsent", at: "sponsorSharingConsentAt" },
  { agreed: "foodAllergyWaiverAgreed", at: "foodAllergyWaiverAgreedAt" },
] as const;

/** Legacy timestamp columns renamed to the `*At` convention. */
export const LEGACY_SPONSOR_SHARING_CONSENT_SUBMITTED_AT =
  "sponsorSharingConsentSubmittedAt" as const;
export const LEGACY_FOOD_ALLERGY_WAIVER_SUBMITTED_AT =
  "foodAllergyWaiverSubmittedAt" as const;

export type AgreementBooleanField =
  (typeof AGREEMENT_TIMESTAMP_PAIRS)[number]["agreed"];
export type AgreementTimestampField =
  (typeof AGREEMENT_TIMESTAMP_PAIRS)[number]["at"];

/** @deprecated Use AGREEMENT_TIMESTAMP_PAIRS */
export const MLH_CONSENT_AGREEMENTS = AGREEMENT_TIMESTAMP_PAIRS.filter(
  (pair) =>
    pair.agreed === "mlhCodeOfConductAgreed" ||
    pair.agreed === "mlhDataSharingConsent" ||
    pair.agreed === "mlhCommunicationsConsent",
);

export type MlhConsentAgreementField = Extract<
  AgreementBooleanField,
  "mlhCodeOfConductAgreed" | "mlhDataSharingConsent" | "mlhCommunicationsConsent"
>;
export type MlhConsentTimestampField = Extract<
  AgreementTimestampField,
  | "mlhCodeOfConductAgreedAt"
  | "mlhDataSharingConsentAt"
  | "mlhCommunicationsConsentAt"
>;

export const AGREEMENT_TIMESTAMP_FIELD_KEYS: readonly AgreementTimestampField[] =
  AGREEMENT_TIMESTAMP_PAIRS.map((pair) => pair.at);

/** Legacy agreement timestamp columns kept until DB migration completes. */
export const LEGACY_AGREEMENT_TIMESTAMP_FIELD_KEYS = [
  LEGACY_SPONSOR_SHARING_CONSENT_SUBMITTED_AT,
  LEGACY_FOOD_ALLERGY_WAIVER_SUBMITTED_AT,
] as const;

export type LegacyAgreementTimestampField =
  (typeof LEGACY_AGREEMENT_TIMESTAMP_FIELD_KEYS)[number];

export type ServerManagedAgreementTimestampField =
  | AgreementTimestampField
  | LegacyAgreementTimestampField;

/** Current and legacy server-managed agreement timestamp keys. */
export const SERVER_MANAGED_AGREEMENT_TIMESTAMP_KEYS: readonly ServerManagedAgreementTimestampField[] =
  [...AGREEMENT_TIMESTAMP_FIELD_KEYS, ...LEGACY_AGREEMENT_TIMESTAMP_FIELD_KEYS];

/** @deprecated Use AGREEMENT_TIMESTAMP_FIELD_KEYS */
export const MLH_CONSENT_TIMESTAMP_FIELD_KEYS = AGREEMENT_TIMESTAMP_FIELD_KEYS.filter(
  (key): key is MlhConsentTimestampField =>
    key === "mlhCodeOfConductAgreedAt" ||
    key === "mlhDataSharingConsentAt" ||
    key === "mlhCommunicationsConsentAt",
);

/** Remove server-managed agreement timestamps from client payloads. */
export function stripAgreementTimestamps<T extends Record<string, unknown>>(
  payload: T,
): Omit<T, ServerManagedAgreementTimestampField> {
  const next = { ...payload };
  for (const at of SERVER_MANAGED_AGREEMENT_TIMESTAMP_KEYS) {
    delete next[at];
  }
  return next;
}

/** @deprecated Use stripAgreementTimestamps */
export const stripMlhConsentTimestamps = stripAgreementTimestamps;

/**
 * Compute timestamp column updates from stored vs incoming agreement booleans.
 * Only agreement fields present on `incoming` are considered (draft autosave patches).
 */
export function computeAgreementTimestampUpdates(
  stored: Record<string, unknown>,
  incoming: Record<string, unknown>,
  now: number,
): Partial<Record<AgreementTimestampField, number | undefined>> {
  const updates: Partial<Record<AgreementTimestampField, number | undefined>> =
    {};

  for (const { agreed, at } of AGREEMENT_TIMESTAMP_PAIRS) {
    if (!(agreed in incoming)) continue;

    const wasChecked = stored[agreed] === true;
    const nowChecked = incoming[agreed] === true;

    if (!wasChecked && nowChecked) {
      updates[at] = now;
      continue;
    }

    if (wasChecked && !nowChecked) {
      updates[at] = undefined;
      continue;
    }

    if (!wasChecked && !nowChecked && stored[at] !== undefined) {
      updates[at] = undefined;
    }
    // checked → checked: omit so the stored timestamp is preserved
  }

  return updates;
}

/** @deprecated Use computeAgreementTimestampUpdates */
export const computeMlhConsentTimestampUpdates = computeAgreementTimestampUpdates;

/** Apply agreement timestamp transitions onto a merged application record. */
export function applyAgreementTimestampUpdates(
  target: Record<string, unknown>,
  stored: Record<string, unknown>,
  incoming: Record<string, unknown>,
  now: number,
): void {
  const updates = computeAgreementTimestampUpdates(stored, incoming, now);
  for (const [key, value] of Object.entries(updates) as [
    AgreementTimestampField,
    number | undefined,
  ][]) {
    if (value === undefined) {
      delete target[key];
    } else {
      target[key] = value;
    }
  }
}

/** @deprecated Use applyAgreementTimestampUpdates */
export const applyMlhConsentTimestampUpdates = applyAgreementTimestampUpdates;
