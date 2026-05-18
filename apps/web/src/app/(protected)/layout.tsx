import { auth } from "@/server/auth";
import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import { AppShell } from "@/components/layout/AppShell";

// All protected pages require auth - skip static pre-rendering at build time.
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <AuthSessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </AuthSessionProvider>
  );
}
