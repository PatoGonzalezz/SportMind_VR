export const prerender = false;
import type { APIRoute } from "astro";

const USUARIOS_API_URL = import.meta.env.AWS_USUARIOS_API_URL || `${import.meta.env.AWS_API_URL?.replace(/\/$/, "")}/usuarios`;

export const GET: APIRoute = async ({ request }) => {
  try {
    if (!import.meta.env.AWS_API_URL && !import.meta.env.AWS_USUARIOS_API_URL) {
      return new Response(JSON.stringify({ success: false, error: "AWS_API_URL no está configurada." }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    const authorization = request.headers.get("Authorization");
    const response = await fetch(USUARIOS_API_URL, {
      headers: authorization ? { Authorization: authorization } : {},
    });
    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

const unsupportedEspecialistasMethod: APIRoute = async () => new Response(
  JSON.stringify({ success: false, error: "La API nueva no muestra una ruta POST/DELETE /usuarios. Usa la ruta de creación dedicada o configura la ruta de eliminación." }),
  { status: 501, headers: { "Content-Type": "application/json" } },
);

export const POST = unsupportedEspecialistasMethod;
export const DELETE = unsupportedEspecialistasMethod;
