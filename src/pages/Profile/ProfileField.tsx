import type { ReactNode } from "react";
import { profileFieldLabel, profileFieldValue } from "./profileStyles";

export function ProfileField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className={profileFieldLabel}>{label}</dt>
      <dd className={profileFieldValue}>{value}</dd>
    </div>
  );
}
