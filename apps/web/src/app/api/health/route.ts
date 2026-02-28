// Health check endpoint used by Docker Compose healthcheck
// Accessible without authentication — returns 200 when the app is running
export function GET() {
  return Response.json({ ok: true, service: "mediaarchive-app" });
}
