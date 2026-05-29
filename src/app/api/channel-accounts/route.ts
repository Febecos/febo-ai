import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { disableChannelAccount, listChannelAccounts, upsertChannelAccount } from "@/lib/crm";

const channels = ["whatsapp", "instagram", "facebook", "tiktok"] as const;

const upsertSchema = z.object({
  action: z.literal("upsert"),
  id: z.string().uuid().optional().nullable(),
  slug: z.string().trim().max(80).optional().nullable(),
  name: z.string().trim().min(2).max(100),
  channel: z.enum(channels),
  externalAccountId: z.string().trim().max(120).optional().nullable(),
  phoneNumber: z.string().trim().max(40).optional().nullable(),
  accessToken: z.string().trim().max(600).optional().nullable(),
  keepAccessToken: z.boolean().optional(),
  autoReplyEnabled: z.boolean(),
  active: z.boolean()
});

const disableSchema = z.object({
  action: z.literal("disable"),
  id: z.string().uuid()
});

const requestSchema = z.discriminatedUnion("action", [upsertSchema, disableSchema]);

export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  return NextResponse.json({
    accounts: await listChannelAccounts()
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Cuenta invalida." }, { status: 400 });
  }

  if (parsed.data.action === "disable") {
    await disableChannelAccount(parsed.data.id);
  }

  if (parsed.data.action === "upsert") {
    await upsertChannelAccount({
      id: parsed.data.id,
      slug: parsed.data.slug,
      name: parsed.data.name,
      channel: parsed.data.channel,
      externalAccountId: parsed.data.externalAccountId,
      phoneNumber: parsed.data.phoneNumber,
      accessToken: parsed.data.accessToken,
      keepAccessToken: parsed.data.keepAccessToken,
      autoReplyEnabled: parsed.data.autoReplyEnabled,
      active: parsed.data.active
    });
  }

  return NextResponse.json({
    ok: true,
    accounts: await listChannelAccounts()
  });
}
