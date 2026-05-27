import { getCurrentUser } from "@/lib/auth";
import { getAdminUsers, getDashboardStats, getEmptyDashboardStats, getUsers, listConversations } from "@/lib/crm";
import { isDbConfigured } from "@/lib/db";
import { InboxApp } from "./ui/inbox-app";

export default async function Home() {
  const user = await getCurrentUser();
  const dbConfigured = isDbConfigured();
  const [users, conversations, stats, adminUsers] = user
    ? await Promise.all([
        getUsers(),
        listConversations(),
        getSafeDashboardStats(),
        user.role === "admin" ? getAdminUsers() : Promise.resolve([])
      ])
    : [[], [], getEmptyDashboardStats(), []];

  return (
    <InboxApp
      conversations={conversations}
      currentUser={user}
      dbConfigured={dbConfigured}
      stats={stats}
      users={users}
      adminUsers={adminUsers}
    />
  );
}

async function getSafeDashboardStats() {
  try {
    return await getDashboardStats();
  } catch (error) {
    console.error("No pudimos cargar metricas iniciales.", error);
    return getEmptyDashboardStats();
  }
}
