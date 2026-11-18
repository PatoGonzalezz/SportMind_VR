# Borrador de Pull Request

## Título

Integrar SportMind con la nueva infraestructura AWS de desarrollo

## Descripción

### Resumen

- Reemplaza las consultas directas al bucket y URLs antiguas de Lambda por rutas de API Gateway configurables.
- Reenvía el JWT de Cognito a las operaciones protegidas de sesiones, auditoría y administración.
- Añade la vinculación persistente de sesiones VR a especialistas mediante el código de seis dígitos.
- Renueva las sesiones Cognito antes de que expire el ID token y muestra un aviso cuando el refresh token ya no sea válido.
- Ordena y clasifica usuarios por rol Cognito, pone administradores arriba y bloquea la edición del registro administrador.
- Documenta la arquitectura, el estado del despliegue y la Lambda de login propuesta.

### Validación

- `npm run build` — correcto (Astro server output; aviso existente de bundle cliente grande).
- `node --check infra/lambda-login/index.mjs` — correcto.
- `git diff --check` — correcto.
- No se realizaron pruebas de extremo a extremo contra AWS.

### Requiere despliegue/configuración AWS

- Desplegar `infra/lambda-login/index.mjs` en la Lambda `sportmind-dev-login` y configurar `CLIENT_ID`; definir `CLIENT_SECRET` solo si el App Client tiene secreto.
- Confirmar los flujos Cognito de password y refresh.
- Desplegar/confirmar la Lambda de ingesta Unity con validación del JSON acordado.
- `POST /usuarios` y `DELETE /usuarios` siguen sin ruta backend en la lista AWS entregada; el proxy responde `501` para no informar falsamente un guardado.

## Commits propuestos para este PR

1. `refactor(aws): route sessions and audit through authenticated API Gateway`
2. `feat(sessions): persist VR assignments through API Gateway`
3. `fix(users): derive roles from Cognito and guard admin records`
4. `feat(auth): refresh Cognito sessions and prevent stale responses`
5. `docs: document AWS migration and deployment status`

