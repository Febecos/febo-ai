import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runFebecosAgent } from "@/lib/agent";
import { getCurrentUser } from "@/lib/auth";
import { getPumpUrlSlug } from "@/lib/crm";
import { extractSlugFromReferralText, fetchCatalogBySlug, formatCatalogContext } from "@/lib/selector";

const schema = z.object({
  phone: z.string().min(6),
  message: z.string().min(1)
});

const PUBLI_SEGUNDO_MENSAJE_FALLBACK = "¿Es esto lo que estás buscando, o podemos ayudarte con alguna otra consulta?";

function extractReferralFromMessage(message: string): { headline?: string; body?: string } | null {
  const match = message.match(/\[Vino de un anuncio de Meta[^\]]*titulo:\s*"([^"]*)"[^\]]*texto:\s*"([^"]*)"/i);
  if (match) return { headline: match[1], body: match[2] };
  const matchTitle = message.match(/\[Vino de un anuncio de Meta[^\]]*titulo:\s*"([^"]*)"/i);
  if (matchTitle) return { headline: matchTitle[1] };
  return null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Telefono o mensaje invalido." }, { status: 400 });
  }

  let catalogContext: string | null = null;
  const referral = extractReferralFromMessage(parsed.data.message);
  if (referral) {
    const slug =
      extractSlugFromReferralText(referral.headline, referral.body) ??
      extractSlugFromReferralText(parsed.data.message);
    if (slug) {
      try {
        const product = await fetchCatalogBySlug(slug);
        if (product) {
          const realSlug = await getPumpUrlSlug(product.sugerencia.codigo) ?? slug;
          catalogContext = formatCatalogContext(product, realSlug);
        }
      } catch {
        // catalog enrichment is best-effort
      }
    }
  }

  try {
    let result = await runFebecosAgent({ ...parsed.data, catalogContext });

    // Mismo post-processing que el webhook: separador --- y fallback segundo mensaje publi
    const sepIdx = result.respuesta.search(/\n[ \t]*---[ \t]*(\n|$)/);
    if (sepIdx >= 0 && !result.segundoMensaje) {
      result = { ...result, respuesta: result.respuesta.slice(0, sepIdx).trim(), segundoMensaje: PUBLI_SEGUNDO_MENSAJE_FALLBACK };
    }
    if (referral && !result.segundoMensaje) {
      result = { ...result, segundoMensaje: PUBLI_SEGUNDO_MENSAJE_FALLBACK };
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
