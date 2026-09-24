import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.VITE_CONVEX_URL;
const authToken = process.env.CONVEX_AUTH_TOKEN;

if (!convexUrl || !authToken) {
  throw new Error(
    "Set VITE_CONVEX_URL and CONVEX_AUTH_TOKEN before running deployment verification.",
  );
}

const client = new ConvexHttpClient(convexUrl);
client.setAuth(authToken);

const routing = await client.query("applicant:getApplicantRoutingState", {});
if (!routing?.authenticated) {
  throw new Error("Authenticated routing check failed.");
}

const eventConfig = await client.query("eventConfig:getPublicEventConfig", {});
if (!eventConfig?.name) {
  throw new Error("Public event config was not returned.");
}

console.log(`Convex deployment verified for hackuta-2026 (${eventConfig.name}).`);
