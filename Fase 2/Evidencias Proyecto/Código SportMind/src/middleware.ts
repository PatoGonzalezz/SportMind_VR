import { defineMiddleware } from "astro:middleware";

/**
 * Las páginas y respuestas de API contienen estado de sesión y deben volver a
 * consultarse al servidor en cada navegación. Los assets estáticos no pasan
 * por este middleware y mantienen su caché normal.
 */
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
});
