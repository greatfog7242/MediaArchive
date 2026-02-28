import { redirect } from "next/navigation";

// Root redirects to the protected search page.
// Unauthenticated users will be redirected to /login by middleware.
export default function RootPage() {
  redirect("/search");
}
