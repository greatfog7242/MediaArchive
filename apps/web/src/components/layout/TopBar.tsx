"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { UserMenu } from "@/components/layout/UserMenu";

export function TopBar() {
  const { isAdmin } = useRole();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 sm:px-6">
        <Link
          href="/search"
          className="text-lg font-semibold tracking-tight hover:opacity-80"
        >
          Media Archive
        </Link>

        <div className="ml-auto flex items-center gap-4">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </Link>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
