import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import { AppShell } from "@/components/layout/AppShell";

// All protected pages require auth — skip static pre-rendering at build time.
export const dynamic = "force-dynamic";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSessionProvider>
      <AppShell>{children}</AppShell>
    </AuthSessionProvider>
  );
}
