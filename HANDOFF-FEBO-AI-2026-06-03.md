# FEBO AI handoff - 2026-06-03

## Proyecto

- Workspace local: `D:\Dropbox\FEBECOS - FULL CLAUDE\FEBO AI`
- App Vercel: `pozeroagro/febo-ai`
- Produccion: `https://febo-ai.vercel.app`
- Deployment estable mas reciente: `https://febo-orbrro497-pozeroagro.vercel.app`
- Deployment id estable: `dpl_7KZ7weYK1ZmD892KTFozAaPNupZC`
- Branch local: `main`
- Ultimo commit guardado: `80cd33c Add configurable notification sounds`

## Estado git actual

Cambios versionados guardados en commit. Quedan sin versionar, ya presentes en el workspace y no tocados para este trabajo:

- `.codex-remote-attachments/`
- `.tmp/`
- `.vercel/`
- `finanzas-administracion/`

## Contexto funcional reciente

En esta sesion se venia trabajando sobre FEBO AI, especialmente:

- Automatizaciones de plantillas WhatsApp por estado del contacto.
- Agrupacion de reglas por estado para que cada estado tenga varias reglas internas.
- UI de plantillas mas compacta.
- Inbox con controles tipo FEBO REV: `Todos / Mis chats`, `No leidos`, filtros, etiquetas, header fijo.
- Panel de etiquetas mas compacto con buscador y etiquetas tomadas tambien desde conversaciones.
- Mensajes salientes propios y notas internas en naranja.
- Mensaje amigable para error WhatsApp `User's number is part of an experiment`.
- Ultimo pedido implementado: configuracion de sonido de notificaciones.

## Cambio principal implementado: sonidos configurables

Se agrego configuracion de sonido para notificaciones del inbox:

- Configuracion global para todos los usuarios.
- Volumen global.
- Sonidos disponibles:
  - `Campanita` (`chime`)
  - `Ping corto` (`ping`)
  - `Suave` (`soft`)
  - `Alerta` (`alert`)
  - `Silencio` (`none`)
- Boton `Probar` para escuchar el sonido configurado.
- Configuracion puntual por usuario:
  - `Global`: usa la configuracion global.
  - `Propio`: sonido y volumen especifico para ese usuario.
- Se aplica a:
  - Nuevo mensaje inbound detectado en conversaciones.
  - Nuevas tareas/followups vencidas asignadas.

Ubicacion UI:

- `Configuracion > Sonido de notificaciones`

## Importante: fix aplicado por error de login

Problema detectado despues del primer deploy:

- En produccion el login devolvia 500.
- Error visible en UI: `column "settings" does not exist`
- Causa: el primer enfoque intento leer `app_users.settings`, pero esa columna no existe en la base de produccion.
- El schema local tenia `settings` en `channel_accounts`, no en `app_users`.

Solucion final:

- Se elimino la dependencia de `app_users.settings`.
- Los overrides de sonido por usuario se guardan en `app_settings`, clave `notification_sound_users`, como mapa `userId -> setting`.
- La configuracion global se guarda en `app_settings`, clave `notification_sound`.
- Esto evita migrar `app_users` y restaura login.

Nota:

- Se llego a desplegar una ruta temporal de mantenimiento para crear `app_users.settings`, pero fue eliminada antes del deployment estable final.
- El deployment estable `dpl_7KZ7weYK1ZmD892KTFozAaPNupZC` ya no incluye esa ruta temporal.

## Archivos modificados en el commit final

Commit `80cd33c Add configurable notification sounds` incluye:

- `neon/schema.sql`
  - Agrega seeds de app settings:
    - `notification_sound`
    - `notification_sound_users`
- `src/app/api/settings/route.ts`
  - Permite guardar `notification_sound`.
  - Permite guardar `notification_sound_users`.
  - Valida nombres de sonido y volumen `0..1`.
- `src/app/globals.css`
  - Estilos compactos para la seccion de sonidos.
  - Layout responsive para lista de usuarios y sliders.
- `src/app/ui/inbox-app.tsx`
  - Tipos y helpers de sonido.
  - UI de configuracion global y por usuario.
  - Generador Web Audio con patrones configurables.
  - Resolucion efectiva del sonido del usuario actual.
  - Uso del sonido configurado en notificaciones de conversaciones y followups.

Nota: `src/lib/crm.ts` y `src/app/api/users/route.ts` fueron tocados durante la correccion, pero el commit final ya no guarda dependencia de `app_users.settings`.

## Como se guarda la configuracion

Clave global:

```json
{
  "key": "notification_sound",
  "value": {
    "sound": "chime",
    "volume": 0.55
  }
}
```

Mapa por usuario:

```json
{
  "key": "notification_sound_users",
  "value": {
    "USER_UUID": {
      "mode": "custom",
      "sound": "soft",
      "volume": 0.4
    },
    "OTHER_USER_UUID": {
      "mode": "default"
    }
  }
}
```

Si no existe ninguna clave en DB:

- Global fallback: `{ "sound": "chime", "volume": 0.55 }`
- Usuarios fallback: todos usan global.

## Verificacion realizada

Local:

- `npm.cmd run build` OK despues del fix final.

Vercel:

- Deploy estable OK: `dpl_7KZ7weYK1ZmD892KTFozAaPNupZC`
- Produccion aliasada a: `https://febo-ai.vercel.app`
- `vercel ls febo-ai --scope pozeroagro` muestra el deployment como `Ready`.
- Logs posteriores al fix no mostraron nuevos 500 de login en la ventana revisada.

Limitacion de verificacion:

- Desde la terminal local, despues del deploy, `curl`/`Invoke-RestMethod` tuvieron fallos intermitentes de conexion HTTPS contra Vercel (`Could not connect to server` / `No es posible conectar con el servidor remoto`).
- Antes de ese problema de red local, el alias respondia 200.
- La verificacion mas confiable en ese momento fue Vercel CLI/logs/build.

## Advertencia importante de entorno local

El script:

```powershell
node scripts/apply_neon_schema.mjs
```

fallo localmente con:

```text
password authentication failed for user 'neondb_owner'
```

Esto indica que el `DATABASE_URL` local en `.env.local` puede estar desactualizado o con password viejo. El usuario ya habia rotado el password de Neon/Vercel. Produccion parece tener una URL valida, porque los endpoints autenticados venian respondiendo 200.

Antes de correr migraciones locales, revisar/actualizar `.env.local`.

## Comandos utiles

Build:

```powershell
npm.cmd run build
```

Deploy produccion:

```powershell
npm.cmd exec -- vercel deploy --prod
```

Ver deploys:

```powershell
npm.cmd exec -- vercel ls febo-ai --scope pozeroagro
```

Logs:

```powershell
npm.cmd exec -- vercel logs https://febo-ai.vercel.app --scope pozeroagro --since 20m
```

Schema Neon, solo si `DATABASE_URL` local esta correcto:

```powershell
node scripts/apply_neon_schema.mjs
```

## Pendientes/recomendaciones para el proximo dev

1. Probar login manual en navegador con `guille.aol@gmail.com` y codigo interno.
2. Ir a `Configuracion > Sonido de notificaciones`.
3. Guardar sonido global una vez para crear `notification_sound` si no existe.
4. Configurar un usuario con `Propio`, guardar y probar.
5. Confirmar que al entrar un mensaje inbound nuevo suene segun configuracion.
6. Confirmar que una tarea/followup vencida nueva use el mismo sonido.
7. Si se quiere persistir configuraciones futuras por usuario, decidir si conviene crear formalmente `app_users.settings`; para este fix se evito por compatibilidad inmediata.
8. Actualizar `.env.local` con el `DATABASE_URL` correcto antes de aplicar schema desde local.

## Resumen tecnico corto

La implementacion final evita migracion riesgosa en produccion y usa `app_settings`:

- `notification_sound`: default global.
- `notification_sound_users`: overrides por usuario.

El audio se genera con Web Audio API, no con archivos de sonido. Esto evita cargar assets nuevos y permite volumen/patrones por codigo.

