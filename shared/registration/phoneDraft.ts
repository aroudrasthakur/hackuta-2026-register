/** Convert the ten-digit domestic format used by drafts before international entry. */
function normalizeLegacyPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return /^[\d\s().-]+$/.test(value) && digits.length === 10
    ? `+1${digits}`
    : value;
}

export function normalizePhoneDraftFields<
  T extends { phone: string; emergencyContactPhone: string },
>(form: T): T {
  return {
    ...form,
    phone: normalizeLegacyPhone(form.phone),
    emergencyContactPhone: normalizeLegacyPhone(form.emergencyContactPhone),
  };
}
