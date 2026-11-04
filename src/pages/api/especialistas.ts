export const prerender = false;
import type { APIRoute } from "astro";

// URL pública de tu Function URL en AWS Lambda
const LAMBDA_URL = "https://kaf3x332azz2t3zjovme454nwy0npglv.lambda-url.us-east-1.on.aws/";

export const GET: APIRoute = async () => {
  try {
    const response = await fetch(LAMBDA_URL);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Opcional: Puedes redirigir el POST también a tu Lambda de login/actualización existente
    return new Response(JSON.stringify({ success: true, message: "¡Actualizado con éxito!" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};