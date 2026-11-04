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

    const cognitoApiUrl = import.meta.env.COGNITO_API_URL;

    if (!cognitoApiUrl) {
      console.error("CRítico: COGNITO_API_URL no está definida en .env");
      throw new Error("La variable de entorno COGNITO_API_URL no está configurada en el archivo .env");
    }

    console.log("Enviando petición a API Gateway:", cognitoApiUrl);

    // Llamada a la API Gateway / Lambda
    const apiResponse = await fetch(cognitoApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, rol, telefono, password }),
    });

    const textResult = await apiResponse.text();
    console.log("Respuesta cruda de AWS:", textResult);

    let resultado;
    try {
      resultado = JSON.parse(textResult);
    } catch (e) {
      throw new Error(`AWS devolvió una respuesta no válida (HTML o texto plano): ${textResult.substring(0, 100)}`);
    }

    if (!apiResponse.ok || resultado.success === false) {
      throw new Error(resultado.error || "Error al procesar la creación del usuario en AWS.");
    }

    return new Response(
      JSON.stringify({ success: true, message: "¡Entrenador creado con éxito!" }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    // ESTE ES EL LOG QUE VERÁS EN TU TERMINAL DE ASTRO
    console.error("DETALLE DEL ERROR EN /api/crear-entrenador:", error.message || error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Error interno al registrar el usuario." }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};