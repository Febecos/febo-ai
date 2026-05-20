import webpush, { type PushSubscription } from "web-push";
import { config } from "./config";
import { getSql, isDbConfigured } from "./db";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export function isPushConfigured() {
  return Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return config.VAPID_PUBLIC_KEY ?? null;
}

function configureWebPush() {
  if (!isPushConfigured()) {
    return false;
  }

  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY!, config.VAPID_PRIVATE_KEY!);
  return true;
}

export async function ensurePushSubscriptionsTable() {
  if (!isDbConfigured()) {
    return;
  }

  const sql = getSql();

  await sql`
    create table if not exists push_subscriptions (
      endpoint text primary key,
      user_id uuid references app_users(id) on delete set null,
      subscription jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id)
  `;
}

export async function savePushSubscription(input: {
  userId: string;
  subscription: PushSubscription;
}) {
  if (!input.subscription.endpoint) {
    throw new Error("Suscripcion push invalida.");
  }

  await ensurePushSubscriptionsTable();

  const sql = getSql();
  await sql`
    insert into push_subscriptions (endpoint, user_id, subscription)
    values (${input.subscription.endpoint}, ${input.userId}::uuid, ${JSON.stringify(input.subscription)}::jsonb)
    on conflict (endpoint) do update
    set user_id = excluded.user_id,
        subscription = excluded.subscription,
        updated_at = now()
  `;
}

export async function sendPushNotificationToAll(payload: PushPayload) {
  if (!configureWebPush() || !isDbConfigured()) {
    return;
  }

  await ensurePushSubscriptionsTable();

  const sql = getSql();
  const subscriptions = (await sql`
    select endpoint, subscription
    from push_subscriptions
  `) as Array<{ endpoint: string; subscription: PushSubscription }>;

  await Promise.all(
    subscriptions.map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;

        if (statusCode === 404 || statusCode === 410) {
          await sql`delete from push_subscriptions where endpoint = ${endpoint}`;
        } else {
          console.error("No pudimos enviar push notification.", error);
        }
      }
    })
  );
}
