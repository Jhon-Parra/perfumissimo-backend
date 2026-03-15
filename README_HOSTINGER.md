# Despliegue en Hostinger (Backend)

Este documento explica como desplegar el backend en Hostinger usando hPanel > Node.js.

## 1) Crear app Node.js
- Subdominio: `backend.perfumissimocol.com`
- Ruta: `/home/u498956148/domains/perfumissimocol.com/public_html/backend`

## 2) Conectar el repositorio
- Repo: `perfumissimo-backend`
- Branch: `main`

## 3) Comandos
- Build: `npm install`
- Start: `npm run start`

## 4) Variables de entorno (minimas)
- `NODE_ENV=production`
- `FRONTEND_URL=https://perfumissimocol.com`
- `DATABASE_URL=...`
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `JWT_SECRET=...`

Si usas email:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`

Si usas pagos Wompi:
- `WOMPI_ENV`, `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`

## 5) Migraciones
Ejecutar una vez desde el panel (o por consola si tienes acceso):
```
npx ts-node src/scripts/run-migrations.ts
```

## 6) Verificacion
- `https://backend.perfumissimocol.com/api/settings`
