# CONTEXTO FEBO AI

Fecha de armado: 18 de mayo de 2026

## Contexto compartido con Claude/Codex

Documento vivo en Google Drive:

`https://docs.google.com/document/d/1nEbTOZlYDkrNH35POK_yuAt5nBcipIMt4yv7XTOsTLM/edit`

Titulo:

`FEBECOS_CONTEXTO_ACTIVO.md`

Seccion operativa para este proyecto:

`Notas de Codex / FEBO.AI`

Uso acordado:

- Claude y Codex leen ese documento al iniciar una sesion de Febecos.
- Codex deja avances de FEBO.AI en repo/GitHub y, cuando sea posible, tambien en la seccion compartida del Doc.
- Si el conector de Google Drive no permite escritura directa, Codex debe dejar el bloque de actualizacion listo para pegar.
- No guardar secretos, tokens ni claves completas en Drive, Markdown ni GitHub.

### Notas de Codex / FEBO.AI

- 2026-05-19: FEBO.AI ya tiene guardarrail deterministico para `cobertura_insuficiente=true` del selector. Si el motor indica que el catalogo no cubre bien el caudal pedido, la IA no cotiza libremente: responde mensaje controlado, marca `consultype=caliente`, `escalar=true`, crea ticket y deriva a asesor humano. Ver `src/lib/agent.ts`.
- 2026-05-19: Se agregaron botones interactivos de WhatsApp para decisiones comerciales post-cotizacion: `Ver cuotas` y `Hablar asesor`. Si el cliente toca `Hablar asesor`, la IA se pausa y se crea handoff. Si toca `Ver cuotas`, entra como mensaje del cliente para continuar el flujo. Ver `src/lib/whatsapp.ts` y `src/app/api/whatsapp/webhook/route.ts`.

## Objetivo

Febo AI es la plataforma propia de FEBECOS para reemplazar lo minimo necesario de Hariaz en la atencion de WhatsApp, sin seguir pagando una suite grande que hoy no se rentabiliza.

La idea no es copiar Hariaz completo desde el dia uno. La idea es crear una base propia, chica, conectada con FEBECOS, que atienda pocas consultas reales mientras las campanas se redireccionan al selector y se filtra mejor al prospecto.

## Proyecto y carpeta

Carpeta principal:

`D:\Dropbox\FEBECOS - FULL CLAUDE\FEBO AI`

Prompt migrado:

`D:\Dropbox\FEBECOS - FULL CLAUDE\FEBO AI\prompt-febo-ai-v1-EN-DESARROLLO.md`

Este prompt viene del ultimo prompt operativo de Solaris v4.4 y fue renombrado como:

`Prompt Febo.ai - Version 1 - EN DESARROLLO`

## Contexto FEBECOS

FEBECOS vende bombas solares en Argentina.

Repos principales:

- `github.com/Febecos/febecos-selector`
- `github.com/Febecos/simulador-roi`
- `github.com/Febecos/revendedores`

Bases:

- Supabase: leads, revendedores y seguimiento.
- Neon: catalogo de bombas.
- Resend: emails automaticos.
- Neolo SMTP: solo funciona desde `febecos-selector`, no usar para automaticos nuevos.

Reglas importantes:

- Insertar leads siempre en tabla `leads`, nunca `leads_resumen`.
- En Next.js App Router, endpoints siempre en `app/api/nombre/route.ts`.
- Para archivos largos, hacer cambios quirurgicos, no reescrituras completas.
- Antes de modificar proyectos vivos, bajar produccion con `curl` o pedir el archivo.

## Diagnostico sobre Hariaz

Hariaz junto informacion valiosa, pero la plataforma completa quedo sobredimensionada para el uso actual.

Datos vistos en capturas:

- Conversaciones: 3346.
- Escaladas: 831, 24.8%.
- Primeros contactos: 3017.
- Desde anuncios: 2656.
- Sin anuncio: 361.
- Pago: 88%.
- Prospectos: 3346.
- Clientes: 8.
- Conversion: 0.2%.
- Tiempo medio a conversion: 5.77 dias.
- Seguimientos IA: 2572.
- Reactivadas: 827, 32.1%.

Conclusion:

El problema principal no parece ser solo la atencion, sino la calidad de entrada, la segmentacion y el filtrado comercial. Por eso tiene sentido redireccionar campanas al selector y usar Febo AI para atender menos volumen, pero mejor calificado.

## MVP propuesto

El MVP de Febo AI deberia cubrir solo lo necesario para reemplazar el uso practico de Hariaz:

1. WhatsApp Cloud API conectado.
2. Webhook para recibir mensajes.
3. Envio de respuestas por WhatsApp.
4. Inbox simple de conversaciones.
5. Boton `IA activa / pausa`.
6. Escalado a humano.
7. Etiquetas basicas:
   - `saludo`
   - `informacion`
   - `comprador`
   - `caliente`
   - `sin perforacion`
   - `proyecto futuro`
   - `tecnico/revendedor`
   - `otro`
8. Agente Febo AI usando el prompt v1.
9. Conexion con Supabase `leads`.
10. Conexion con selector FEBECOS.
11. Seguimiento simple dia 1, dia 7 y dia 30.
12. Metricas minimas:
   - conversaciones
   - respondidas por IA
   - escaladas
   - leads calificados
   - conversiones
   - origen/campana si existe

## Lo que queda fuera del MVP

No copiar todavia:

- Multioperador completo.
- Facturas.
- Comprobantes.
- CRM visual grande.
- Campanas masivas tipo ULIS.
- Biblioteca de archivos e imagenes.
- Auditoria detallada.
- Panel de metricas avanzado.

Eso se puede construir despues, si el flujo comercial demuestra que vale la pena.

## Costo minimo estimado

Para bajo volumen inicial:

- Vercel: USD 0 en Hobby o USD 20/mes en Pro.
- Supabase: USD 0 si entra en free tier o si se usa proyecto existente.
- OpenAI: probablemente USD 1 a USD 5/mes al inicio con bajo volumen.
- WhatsApp/Meta: variable por mensajes entregados y categoria.

Estimacion practica de arranque:

`USD 0 a USD 25/mes + consumo real de WhatsApp + OpenAI`

## Decision estrategica

Febo AI debe nacer como plataforma propia de FEBECOS, no como clon de Hariaz.

La ventaja del momento actual es que hay poco volumen. Eso permite probar barato, corregir el prompt, ajustar etiquetas y mejorar el flujo antes de volver a inyectar mas trafico pago.

## Decision tecnica actualizada

Se decidio centralizar el MVP en Vercel + Neon:

- Vercel: app Next.js, API routes, webhook de WhatsApp, PWA.
- Neon: contactos, conversaciones, mensajes, usuarios, asignaciones, handoffs y eventos.
- Supabase deja de ser dependencia del MVP de Febo AI.

Usuarios iniciales:

- Guillermo Sandler (`guille.aol@gmail.com`) - administrador/vendedor.
- Rodrigo Fernandez (`fernandezn.rodrigo@gmail.com`) - vendedor.

Datos Hariaz disponibles:

- Carpeta: `Hariaz/`
- Excel: `Hariaz/prospectos_2026-05-18.xlsx`
- Hojas: `Contactos`, `Filtros`
- Contactos detectados: 3182 filas, 3178 prospectos, 4 clientes.
- El archivo no trae historial completo de conversaciones; alcanza para sembrar contactos, etiquetas y conversaciones abiertas iniciales.

## Proximo paso recomendado

En el nuevo chat dentro del proyecto FEBO AI:

1. Leer este archivo.
2. Leer `prompt-febo-ai-v1-EN-DESARROLLO.md`.
3. Revisar el scaffold tecnico ya creado en la carpeta.
4. Definir el primer entregable:
   - conectar WhatsApp Cloud API, o
   - armar inbox basico, o
   - adaptar el agente para leer el prompt v1 desde archivo.
