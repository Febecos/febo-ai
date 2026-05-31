# WhatsApp QR bridge

FEBO mantiene WhatsApp Cloud API como canal oficial principal. Para cuentas que deban conectarse por QR, FEBO espera un servicio externo persistente que mantenga la sesion de WhatsApp Web y hable con FEBO por HTTP.

## Cuenta en FEBO

Crear una cuenta en Configuracion > Cuentas conectadas:

- Canal: `WhatsApp`
- Proveedor WhatsApp: `QR bridge`
- Slug: por ejemplo `whatsapp-revendedores-qr`
- URL QR bridge: URL publica del servicio persistente
- Token bridge salida: secreto que FEBO usa para llamar al bridge
- Token webhook entrada: secreto que el bridge usa para llamar a FEBO
- IA apagada por defecto para revendedores

## Entrantes bridge -> FEBO

```http
POST /api/whatsapp-qr/webhook
Authorization: Bearer <token webhook entrada>
Content-Type: application/json
```

```json
{
  "accountSlug": "whatsapp-revendedores-qr",
  "messages": [
    {
      "id": "qr-message-id",
      "from": "5491123456789",
      "text": "Hola",
      "contactName": "Cliente"
    }
  ]
}
```

## Salientes FEBO -> bridge

Cuando una conversacion pertenece a una cuenta `QR bridge`, FEBO llama:

```http
POST <URL QR bridge>/send-message
Authorization: Bearer <token bridge salida>
Content-Type: application/json
```

```json
{
  "to": "5491123456789",
  "text": "Respuesta del vendedor",
  "conversationId": "uuid"
}
```

Respuesta esperada:

```json
{
  "id": "qr-message-id"
}
```

## Alcance v1

- Soporta texto entrante y texto saliente manual.
- No soporta aun media/audio/documentos por QR.
- No usa Vercel para la sesion QR; el bridge debe correr en un proceso persistente.
- WhatsApp QR/Web no es el camino oficial de Meta para integraciones empresariales. Conviene usarlo solo para cuentas secundarias o pruebas controladas.
