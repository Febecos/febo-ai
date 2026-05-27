import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardGranularity, getDashboardStats } from "@/lib/crm";

const allowedGroups = new Set<DashboardGranularity>(["day", "week", "month"]);

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const search = request.nextUrl.searchParams;
  const groupBy = search.get("groupBy") as DashboardGranularity | null;

  return NextResponse.json({
    stats: await getDashboardStats({
      startDate: search.get("startDate"),
      endDate: search.get("endDate"),
      groupBy: groupBy && allowedGroups.has(groupBy) ? groupBy : "day"
    })
  });
}
