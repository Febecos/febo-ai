import { getCurrentUser } from "@/lib/auth";
import { getAdminUsers, getDashboardStats, getUsers, listConversations } from "@/lib/crm";
import { isDbConfigured } from "@/lib/db";
import { InboxApp } from "./ui/inbox-app";

export default async function Home() {
  const user = await getCurrentUser();
  const dbConfigured = isDbConfigured();
  const [users, conversations, stats, adminUsers] = user
    ? await Promise.all([
        getUsers(),
        listConversations(),
        getDashboardStats(),
        user.role === "admin" ? getAdminUsers() : Promise.resolve([])
      ])
    : [[], [], { conversations: 0, contacts: 0, handoffs: 0, hot: 0 }, []];

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
