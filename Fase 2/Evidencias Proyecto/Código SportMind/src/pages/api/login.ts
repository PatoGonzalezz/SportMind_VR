export const prerender = false;
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const LOGIN_API_URL = import.meta.env.AWS_LOGIN_API_URL || `${import.meta.env.AWS_API_URL?.replace(/\/$/, "")}/login`;

    if (!import.meta.env.AWS_API_URL && !import.meta.env.AWS_LOGIN_API_URL) {
      throw new Error("AWS_API_URL no está configurada.");
    }

    const apiResponse = await fetch(LOGIN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const responseBody = await apiResponse.text();

    let responseContentType = apiResponse.headers.get("Content-Type") || "application/json";
    let responseBodyToReturn = responseBody;
    try {
      responseBodyToReturn = JSON.stringify(JSON.parse(responseBody));
    } catch {
      responseContentType = "text/plain; charset=utf-8";
    }

    return new Response(responseBodyToReturn, {
      status: apiResponse.status,
      headers: {
        "Content-Type": responseContentType,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Error interno en el servidor." }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  }
};
