# Febo AI

Inbox interno y agente virtual de WhatsApp para FEBECOS.

## Stack

- Next.js en Vercel.
- Neon Postgres como base central.
- OpenAI Responses API para Febo AI.
- Meta WhatsApp Cloud API para recibir y enviar mensajes.

## MVP actual

- Login interno por email + codigo temporal.
- Usuarios seed:
  - Guillermo Sandler (`guille.aol@gmail.com`) administrador/vendedor.
  - Rodrigo Fernandez (`fernandezn.rodrigo@gmail.com`) vendedor.
- Inbox multiusuario basico.
- Asignacion de conversaciones.
- Estados comerciales.
- Toggle `IA activa / pausada`.
- Importador de prospectos desde `Hariaz/prospectos_2026-05-18.xlsx`.
- Webhook `GET/POST /api/whatsapp/webhook`.
- Consola lateral para probar respuestas del agente.
- PWA instalable desde el celular.

## Variables

Copiar `.env.example` a `.env.local` y completar:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.1
DATABASE_URL=
AUTH_SECRET=
INTERNAL_LOGIN_CODE=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
```

Para Vercel/Neon conviene usar la connection string pooled de Neon en `DATABASE_URL`.

## Neon

Aplicar schema:

```bash
npm run db:schema
```

Importar prospectos de Hariaz:

```bash
npm run import:hariaz
```

El importador normaliza telefonos, sentimientos y etiquetas mezcladas como `sin perforación`, `sin-perforacion`, `proyecto futuro` y `proyecto-futuro`.

## Desarrollo

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Verificacion

```bash
npm run typecheck
npm run build
```
