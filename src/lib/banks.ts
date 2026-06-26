import { config } from "./config";

export type BankAccount = {
  titulo: string;
  titular: string | null;
  cuit: string | null;
  banco: string | null;
  cbu: string | null;
  alias: string | null;
  moneda: string | null;
};

/**
 * Lee las cuentas bancarias ACTIVAS desde el admin de febecos.com.
 * Fuente única: /api/config-banco (las mismas que se cargan/editan en el panel
 * "Cuentas bancarias"). El GET devuelve solo las cuentas activas.
 *
 * SEGURIDAD (SECURITY-AUDIT.md, config-banco GET público): mandamos el header
 * de identidad de servicio. Hoy el endpoint es público e inocuo, pero deja la
 * puerta lista para que Admin lo gatee con auth sin romper a FEBO AI (único
 * consumidor del GET). Si no hay secret cargado, la llamada sigue igual que antes.
 */
export async function fetchActiveBankAccounts(): Promise<BankAccount[]> {
  try {
    const headers: Record<string, string> = {};
    if (config.INTERNAL_SERVICE_SECRET) {
      headers.Authorization = `Bearer ${config.INTERNAL_SERVICE_SECRET}`;
    }
    const res = await fetch("https://febecos.com/api/config-banco", {
      headers,
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      console.error("[banks] config-banco respondió", res.status);
      return [];
    }

    const data = (await res.json()) as { ok?: boolean; cuentas?: BankAccount[] };
    return Array.isArray(data.cuentas) ? data.cuentas : [];
  } catch (error) {
    console.error("[banks] No pudimos leer las cuentas del admin.", error);
    return [];
  }
}

function normalizeAlias(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Matchea una cuenta por CBU/CVU (solo dígitos) o, en su defecto, por alias.
 * Devuelve null si ninguna coincide.
 */
export function matchBankAccount(
  accounts: BankAccount[],
  detected: { cbu?: string | null; alias?: string | null }
): BankAccount | null {
  const cbu = (detected.cbu ?? "").replace(/\D/g, "");
  if (cbu) {
    const byCbu = accounts.find((account) => (account.cbu ?? "").replace(/\D/g, "") === cbu);
    if (byCbu) return byCbu;
  }

  const alias = normalizeAlias(detected.alias);
  if (alias) {
    const byAlias = accounts.find((account) => normalizeAlias(account.alias) === alias);
    if (byAlias) return byAlias;
  }

  return null;
}
