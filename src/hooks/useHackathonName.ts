import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { isRegistrationClosed } from "../../shared/hackathon/schedule";
import { DEFAULT_HACKATHON_NAME } from "../../shared/hackathon/eventDefaults";
import { getPublicEventConfigRef } from "../convex/api";
import { getConvexClient } from "../convex/client";
import { useMockAuth } from "./useMockAuth";

/** Live hackathon display name from the server eventConfig table. */
export function useHackathonConfig() {
  const mockAuth = useMockAuth();
  const client = getConvexClient();
  const config = useQuery(
    getPublicEventConfigRef,
    client && !mockAuth.enabled ? {} : "skip",
  );
  return {
    name: config?.name ?? DEFAULT_HACKATHON_NAME,
    registrationClosesAt: config?.registrationClosesAt ?? null,
    isLoading: Boolean(client && !mockAuth.enabled && config === undefined),
  };
}

export function useHackathonName() {
  return useHackathonConfig().name;
}

export function useRegistrationClosed(closesAt: number | null) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (closesAt === null) return;
    const remaining = closesAt - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(
      () => setTick((value) => value + 1),
      Math.min(remaining, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [closesAt, tick]);
  return isRegistrationClosed(closesAt);
}
