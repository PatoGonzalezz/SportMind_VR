/** Headers de autenticación para rutas de API Gateway protegidas con Cognito JWT. */
export function getAuthHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  const token = localStorage.getItem("sportmind_token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}
