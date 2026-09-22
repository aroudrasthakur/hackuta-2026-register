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

const hackathon = await client.query("queries:getHackathonBySlug", {
  slug: "hackuta-2026",
});
if (!hackathon) {
  throw new Error("The deployed hackuta-2026 hackathon record was not found.");
}

const routing = await client.query("applicant:getApplicantRoutingState", {});
if (!routing?.authenticated) {
  throw new Error("Authenticated routing check failed.");
}

console.log(`Convex deployment verified for ${hackathon.slug}.`);
