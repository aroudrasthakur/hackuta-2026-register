import { useQuery } from "convex/react";
import { DEFAULT_HACKATHON_NAME } from "../../shared/hackathon/eventDefaults";
import { getPublicEventConfigRef } from "../convex/api";
import { getConvexClient } from "../convex/client";
import { useMockAuth } from "./useMockAuth";

/** Live hackathon display name from the server eventConfig table. */
export function useHackathonName() {
  const mockAuth = useMockAuth();
  const client = getConvexClient();
  const config = useQuery(
    getPublicEventConfigRef,
    client && !mockAuth.enabled ? {} : "skip",
  );
  return config?.name ?? DEFAULT_HACKATHON_NAME;
}
