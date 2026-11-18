export const prerender = false;
import type { APIRoute } from "astro";

const API_BASE_URL = import.meta.env.AWS_API_URL?.replace(/\/$/, "");
const ASSIGN_SESSION_URL =
  import.meta.env.AWS_VR_METRICAS_ASSIGN_URL ||
  (API_BASE_URL ? `${API_BASE_URL}/vr-metricas/assign` : undefined);

export const POST: APIRoute = async ({ request }) => {
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return new Response(JSON.stringify({ success: false, error: "Debes iniciar sesión para vincular una sesión." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!ASSIGN_SESSION_URL) {
    return new Response(JSON.stringify({ success: false, error: "La URL de asignación de sesiones no está configurada." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const sessionId = String(body?.session_id || "").trim();
    if (!/^\d{6}$/.test(sessionId)) {
      return new Response(JSON.stringify({ success: false, error: "El código debe contener exactamente seis dígitos." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(ASSIGN_SESSION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({ action: "assign_specialist", session_id: sessionId }),
    });
    const responseText = await upstream.text();
    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { success: false, error: responseText || `La API respondió HTTP ${upstream.status}.` };
    }

    return new Response(JSON.stringify(payload), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message || "No se pudo conectar con la API de sesiones." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};
