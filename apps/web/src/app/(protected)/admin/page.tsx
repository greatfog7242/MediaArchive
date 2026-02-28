import { listUsers, getSystemStats } from "@/server/services/user.service";
import { AdminDashboardClient } from "./AdminDashboardClient";

export default async function AdminPage() {
  const [users, stats] = await Promise.all([listUsers(), getSystemStats()]);

  // Serialize dates for client component
  const serializedUsers = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return <AdminDashboardClient users={serializedUsers} stats={stats} />;
}
