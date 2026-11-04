export const prerender = false;
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const LOGIN_API_URL = "https://6d9jfdv0qh.execute-api.us-east-1.amazonaws.com/prod/login";

    const apiResponse = await fetch(LOGIN_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await apiResponse.json();

    return new Response(JSON.stringify(data), {
      status: apiResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Error interno en el servidor." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};