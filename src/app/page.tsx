import { getCurrentUser } from "@/lib/auth";
import { getAdminUsers, getEmptyDashboardStats, getRoleMenuAccess, getUsers, listConversations } from "@/lib/crm";
import { isDbConfigured } from "@/lib/db";
import { InboxApp } from "./ui/inbox-app";

export default async function Home() {
  const user = await getCurrentUser();
  const dbConfigured = isDbConfigured();
  const [users, conversations, stats, adminUsers, roleMenuAccess] = user
    ? await Promise.all([
        getUsers(),
        listConversations(),
        Promise.resolve(getEmptyDashboardStats()),
        user.role === "admin" ? getAdminUsers() : Promise.resolve([]),
        getRoleMenuAccess()
      ])
    : [[], [], getEmptyDashboardStats(), [], {}];

  return (
    <InboxApp
      conversations={conversations}
      currentUser={user}
      dbConfigured={dbConfigured}
      stats={stats}
      users={users}
      adminUsers={adminUsers}
      roleMenuAccess={roleMenuAccess}
    />
  );
}
