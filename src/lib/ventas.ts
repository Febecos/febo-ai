import { config } from "./config";

/**
 * Dispara el Purchase atribuido a Meta vía el endpoint de DEV ROI/FB
 * (`POST {selector}/api/registrar-venta`). El selector saca fbp/fbc del lead
 * (match whatsapp→email→lead_id) y arma el evento con event_id estable
 * (`venta-${codigo||whatsapp}`), que deduplica en Meta.
 *
 * Reparto acordado (27/06): FEBO AI = dueño del cierre por WhatsApp (comprobante);
 * FEBO REV = cierre manual sin comprobante. Acá disparamos SOLO el primero, una
 * vez por comprobante (idempotencia aguas arriba: `febo-ai:comprobante:<messageId>`).
 *
 * Best-effort: si falla, el flujo del comprobante (confirmación + email + bus) sigue igual.
 */
export async function registrarVentaPurchase(input: {
  whatsapp: string;
  monto: number | null;
  codigoPresupuesto?: string | null;
}): Promise<void> {
  const secret = config.INTERNAL_SERVICE_SECRET;
  if (!secret) {
    return; // sin secret el endpoint responde 401 — evitamos la llamada inútil
  }
  // Sin monto válido la atribución no sirve (Meta necesita value) → no disparamos.
  if (!input.whatsapp || !input.monto || !Number.isFinite(input.monto) || input.monto <= 0) {
    return;
  }

  const dryRun = (config.REGISTRAR_VENTA_DRY_RUN ?? "").toLowerCase() === "true";

  try {
    await fetch(`${config.FEBECOS_SELECTOR_API_BASE_URL}/registrar-venta`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`
      },
      body: JSON.stringify({
        whatsapp: input.whatsapp,
        monto: input.monto,
        ...(input.codigoPresupuesto ? { codigo_presupuesto: input.codigoPresupuesto } : {}),
        ...(dryRun ? { dry_run: true } : {})
      }),
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    // best-effort: nunca rompe el cierre del comprobante.
  }
}
