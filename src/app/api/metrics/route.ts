import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardGranularity, DashboardStats, getDashboardStats, getRoleMenuAccess } from "@/lib/crm";
import { getSql, isDbConfigured } from "@/lib/db";
import * as XLSX from "xlsx";

const allowedGroups = new Set<DashboardGranularity>(["day", "week", "month"]);

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Admin siempre; un rol no-admin solo si la matriz le concede 'metrics'.
  if (user.role !== "admin") {
    const access = await getRoleMenuAccess();
    if (access[user.role]?.metrics !== true) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  }

  const search = request.nextUrl.searchParams;
  const groupBy = search.get("groupBy") as DashboardGranularity | null;
  const safeGroupBy = groupBy && allowedGroups.has(groupBy) ? groupBy : "day";
  const stats = await getDashboardStats({
    startDate: search.get("startDate"),
    endDate: search.get("endDate"),
    groupBy: safeGroupBy,
    assignedTo: search.get("assignedTo")
  });

  if (search.get("format") === "xlsx") {
    const range = {
      startDate: search.get("startDate"),
      endDate: search.get("endDate"),
      groupBy: safeGroupBy
    };
    const workbook = buildMetricsWorkbook(stats, range);
    const details = await getMetricsExportDetails(range.startDate, range.endDate, search.get("assignedTo"));
    appendSheet(workbook, "Contactos detalle", details.contacts);
    appendSheet(workbook, "Conversaciones detalle", details.conversations);
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const body = new Uint8Array(buffer);
    const filename = `febo-metricas-${search.get("startDate") ?? "inicio"}-${search.get("endDate") ?? "hoy"}.xlsx`;

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  }

  return NextResponse.json({ stats });
}

function buildMetricsWorkbook(
  stats: DashboardStats,
  range: { startDate: string | null; endDate: string | null; groupBy: DashboardGranularity }
) {
  const workbook = XLSX.utils.book_new();

  appendSheet(workbook, "Resumen", [
    { metrica: "Fecha inicio", valor: range.startDate ?? "" },
    { metrica: "Fecha fin", valor: range.endDate ?? "" },
    { metrica: "Agrupacion", valor: range.groupBy },
    { metrica: "Conversaciones", valor: stats.conversations },
    { metrica: "Contactos", valor: stats.contacts },
    { metrica: "Prospectos", valor: stats.prospects },
    { metrica: "Clientes", valor: stats.clients },
    { metrica: "Conversion %", valor: stats.conversion_rate },
    { metrica: "Escaladas", valor: stats.handoffs },
    { metrica: "Calientes", valor: stats.hot },
    { metrica: "No leidas", valor: stats.unread },
    { metrica: "Mensajes periodo", valor: stats.messages_total },
    { metrica: "Entrantes periodo", valor: stats.inbound_7d },
    { metrica: "Salientes periodo", valor: stats.outbound_7d },
    { metrica: "IA periodo", valor: stats.ai_7d },
    { metrica: "Humanos periodo", valor: stats.manual_7d },
    { metrica: "Respuesta promedio minutos", valor: stats.avg_first_response_minutes ?? "" },
    { metrica: "Plantillas enviadas", valor: stats.templates_sent_7d },
    { metrica: "Plantillas pendientes", valor: stats.templates_pending },
    { metrica: "Plantillas fallidas", valor: stats.templates_failed_7d },
    { metrica: "Seguimientos pendientes", valor: stats.followups_pending },
    { metrica: "Notas internas", valor: stats.internal_notes_7d },
    { metrica: "Media periodo", valor: stats.media_7d }
  ]);
  appendSheet(workbook, "Diario", stats.daily);
  appendSheet(workbook, "Adquisicion", stats.acquisition_daily);
  appendSheet(workbook, "Fuentes", stats.by_source);
  appendSheet(workbook, "Vendedores", stats.by_seller);
  appendSheet(workbook, "Etiquetas", stats.by_consultype);
  appendSheet(workbook, "Sentimiento", stats.by_sentiment);
  appendSheet(workbook, "Estados", stats.by_status);
  appendSheet(workbook, "Canales", stats.by_channel);
  appendSheet(workbook, "Plataformas", stats.by_platform);
  appendSheet(workbook, "Conversion", [stats.conversion]);

  return workbook;
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: Array<Record<string, unknown>>) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ sin_datos: "" }]);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function getMetricsDateRange(startDate: string | null, endDate: string | null) {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 29);
  const start = startDate ? new Date(`${startDate}T00:00:00-03:00`) : defaultStart;
  const end = endDate ? new Date(`${endDate}T00:00:00-03:00`) : now;
  const safeStart = Number.isNaN(start.getTime()) ? defaultStart : start;
  const safeEnd = Number.isNaN(end.getTime()) ? now : end;

  if (safeStart > safeEnd) {
    return { start: safeEnd, end: safeStart };
  }

  return { start: safeStart, end: safeEnd };
}

async function getMetricsExportDetails(startDate: string | null, endDate: string | null, assignedTo: string | null) {
  if (!isDbConfigured()) {
    return { contacts: [], conversations: [] };
  }

  const sql = getSql();
  const range = getMetricsDateRange(startDate, endDate);
  const assignedToFilter = assignedTo && assignedTo !== "all" ? assignedTo : null;
  const contacts = (await sql`
    with params as (
      select
        ${range.start.toISOString()}::timestamptz as start_at,
        (${range.end.toISOString()}::timestamptz + interval '1 day') as end_at,
        ${assignedToFilter}::uuid as assigned_to_filter
    )
    select
      ct.created_at::text as fecha_alta,
      ct.last_seen_at::text as ultimo_contacto,
      ct.phone as telefono,
      ct.display_name as nombre,
      ct.platform as plataforma,
      ct.source as origen,
      ct.imported_from as importado_desde,
      ct.consultype as etiqueta,
      ct.sentiment as sentimiento,
      ct.contact_type as tipo_contacto,
      coalesce(u.full_name, '') as vendedor,
      c.status as estado_conversacion,
      c.last_message_at::text as ultimo_mensaje
    from contacts ct
    left join app_users u on u.id = ct.assigned_to
    left join lateral (
      select status, last_message_at
      from conversations
      where contact_id = ct.id
      order by last_message_at desc nulls last
      limit 1
    ) c on true
    cross join params p
    where ct.created_at >= p.start_at and ct.created_at < p.end_at
      and (p.assigned_to_filter is null or ct.assigned_to = p.assigned_to_filter)
    order by ct.created_at desc
    limit 5000
  `) as Array<Record<string, unknown>>;

  const conversations = (await sql`
    with params as (
      select
        ${range.start.toISOString()}::timestamptz as start_at,
        (${range.end.toISOString()}::timestamptz + interval '1 day') as end_at,
        ${assignedToFilter}::uuid as assigned_to_filter
    )
    select
      c.last_message_at::text as ultimo_mensaje,
      ct.phone as telefono,
      ct.display_name as nombre,
      coalesce(nullif(c.channel, ''), ct.platform) as canal,
      c.status as estado,
      case when c.ai_enabled then 'si' else 'no' end as ia_activa,
      case when c.unread then 'si' else 'no' end as no_leida,
      ct.consultype as etiqueta,
      ct.sentiment as sentimiento,
      coalesce(u.full_name, '') as vendedor,
      count(m.id)::int as mensajes_total,
      count(m.id) filter (where m.direction = 'inbound')::int as mensajes_entrantes,
      count(m.id) filter (where m.direction = 'outbound')::int as mensajes_salientes,
      count(m.id) filter (where m.direction = 'outbound' and m.metadata->>'source' = 'febo_ai')::int as respuestas_ia,
      count(m.id) filter (where m.direction = 'outbound' and coalesce(m.metadata->>'source', '') <> 'febo_ai' and m.created_by is not null)::int as respuestas_humanas
    from conversations c
    join contacts ct on ct.id = c.contact_id
    left join app_users u on u.id = c.assigned_to
    left join messages m on m.conversation_id = c.id
    cross join params p
    where c.last_message_at >= p.start_at and c.last_message_at < p.end_at
      and c.status not in ('blocked', 'deleted')
      and (p.assigned_to_filter is null or c.assigned_to = p.assigned_to_filter)
    group by c.id, c.last_message_at, ct.phone, ct.display_name, canal, c.status, c.ai_enabled, c.unread, ct.consultype, ct.sentiment, u.full_name
    order by c.last_message_at desc
    limit 5000
  `) as Array<Record<string, unknown>>;

  return { contacts, conversations };
}
