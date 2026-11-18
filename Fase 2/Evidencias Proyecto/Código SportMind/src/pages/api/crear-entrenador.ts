export const prerender = false;

import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { nombre, email, rol, telefono, password } = body;

    if (!nombre || !email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos obligatorios en el formulario." }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return new Response(
        JSON.stringify({ success: false, error: "La sesión no contiene un token de autenticación. Cierra sesión e inicia nuevamente." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiBaseUrl = import.meta.env.AWS_API_URL?.replace(/\/$/, "");
    const cognitoApiUrl = import.meta.env.COGNITO_API_URL || (apiBaseUrl
      ? `${apiBaseUrl}/sportMind-crear-entrenador-cognito`
      : undefined);

    if (!cognitoApiUrl) {
      throw new Error("Define COGNITO_API_URL o AWS_API_URL en el entorno.");
    }

    const apiResponse = await fetch(cognitoApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({ nombre, email, rol, telefono, password }),
    });

    const textResult = await apiResponse.text();

    let resultado;
    try {
      resultado = JSON.parse(textResult);
    } catch {
      resultado = {
        success: false,
        error: textResult || `AWS respondió HTTP ${apiResponse.status} sin un cuerpo JSON válido.`,
      };
    }

    return new Response(
      JSON.stringify(resultado),
      { status: apiResponse.status, headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "No se pudo conectar con el servicio de creación." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};
