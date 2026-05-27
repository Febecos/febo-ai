import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DashboardGranularity, DashboardStats, getDashboardStats } from "@/lib/crm";
import * as XLSX from "xlsx";

const allowedGroups = new Set<DashboardGranularity>(["day", "week", "month"]);

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const search = request.nextUrl.searchParams;
  const groupBy = search.get("groupBy") as DashboardGranularity | null;
  const safeGroupBy = groupBy && allowedGroups.has(groupBy) ? groupBy : "day";
  const stats = await getDashboardStats({
    startDate: search.get("startDate"),
    endDate: search.get("endDate"),
    groupBy: safeGroupBy
  });

  if (search.get("format") === "xlsx") {
    const workbook = buildMetricsWorkbook(stats, {
      startDate: search.get("startDate"),
      endDate: search.get("endDate"),
      groupBy: safeGroupBy
    });
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
