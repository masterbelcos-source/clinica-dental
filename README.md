# Clínica Dental Almendra — sitio web con agenda de citas

Sitio de una página, en español, con calendario de citas y envío de correo mediante **Resend**.
Cuando un paciente agenda, salen dos correos: el aviso al consultorio y un acuse de recibo al paciente.

```
clinica-dental/
├─ index.html        ← la web completa (HTML + CSS + JS en un solo archivo)
├─ api/agendar.js    ← el backend: valida, arma los correos y llama a Resend
├─ server.js         ← servidor Node para probar en tu compu o en un VPS
├─ package.json
└─ .env.example      ← copia como .env y llena los valores (solo para pruebas locales)
```

> ⚠️ **Los datos de la clínica son de ejemplo** (nombre, dirección, teléfono, cédula, precios,
> estadísticas). Reemplázalos antes de publicar; abajo está la lista.

---

## Publicar en internet

Sigue la **Guía de publicación** que acompaña a este proyecto (Resend → Vercel → dominio).
Resumen de los tres pasos:

1. **Resend** — crea la cuenta y una API key (`re_...`).
2. **Vercel** — sube el proyecto y carga las variables de entorno. Ya funciona en `tu-sitio.vercel.app`.
3. **Dominio** — cómpralo en Vercel, apunta el proyecto y verifica ese dominio en Resend
   para poder escribirle también al paciente.

### Por qué hace falta un backend

La clave de Resend **no puede vivir en el HTML**: cualquiera vería el código fuente y podría enviar
correos en tu nombre. Por eso la web manda los datos a `/api/agendar`, y ese archivo —que corre en el
servidor de Vercel— es quien habla con Resend usando la clave secreta.

### Variables de entorno

| Variable | Qué es |
|---|---|
| `RESEND_API_KEY` | La clave `re_...` de Resend |
| `MAIL_FROM` | Remitente. `Clínica Almendra <onboarding@resend.dev>` para probar; con dominio propio verificado, `Clínica Almendra <citas@tudominio.com>` |
| `MAIL_TO` | **Correo del dentista** donde llegan las citas. Acepta varios separados por coma |
| `CLINICA_NOMBRE`, `CLINICA_TEL`, `CLINICA_DIR` | Aparecen al pie de los correos |

### Probar en tu computadora

```bash
cp .env.example .env     # y llena los valores
npm start                # → http://localhost:3000
```

`server.js` sirve la web y el endpoint a la vez; no instala ninguna dependencia.

### Otros hospedajes

- **Netlify**: mueve `api/` a `netlify/functions/` y en `index.html` cambia el endpoint a
  `/.netlify/functions/agendar`.
- **Hosting sin Node (cPanel, WordPress…)**: sube solo `index.html` y deja el backend en Vercel;
  en `index.html` pon la URL completa: `endpoint: "https://tu-proyecto.vercel.app/api/agendar"`.

---

## Qué personalizar en `index.html`

**Horario y reglas del calendario** — bloque `CONFIG` al inicio del `<script>`:

```js
horario: {
  0: null,      // domingo cerrado
  1: [9, 19],   // lunes 9:00 a 19:00
  ...
  6: [9, 14]    // sábado
},
intervaloMin: 30,       // duración de cada cita
anticipacionHoras: 2,   // no aceptar citas dentro de las próximas 2 horas
diasMaximos: 60,        // hasta cuándo se puede agendar
diasBloqueados: ["2026-12-25", "2027-01-01"]   // vacaciones y festivos
```

**Datos que hay que reemplazar** (todos son de ejemplo):

- Nombre de la clínica y de la doctora, cédula profesional
- Teléfono: encabezado, contacto, pie y mensaje de error del formulario (`55 1234 5678`)
- Correo `citas@clinicaalmendra.mx`
- Dirección y el mapa esquemático → cámbialo por un `<iframe>` de Google Maps si prefieres
- Servicios, textos y **precios**
- Estadísticas (15 años, 3,400 pacientes, 4.9, 6 min)
- El enlace de *aviso de privacidad* (`href="#"`) → apunta a tu documento real

---

## Qué ya trae resuelto

- Calendario propio: bloquea domingos, fechas pasadas, horas ya transcurridas y los días festivos que marques
- Semana que empieza en lunes, meses y días en español, navegación limitada al rango permitido
- Validación en el navegador **y otra vez en el servidor** (nadie puede saltarse el formulario)
- Campo trampa anti-spam (honeypot) y límite de 5 solicitudes por IP cada 10 minutos
- Correo al consultorio con `reply_to` del paciente: das *Responder* y le escribes directo
- Diseño en tonos claros, responsive, con teclado y lectores de pantalla contemplados

## Siguiente paso natural

Esto envía la solicitud por correo, pero **no reserva el horario**: si dos personas piden el mismo
espacio, ambos correos llegan y tú decides. Para bloquear horarios ya ocupados hace falta guardar las
citas (una base de datos como Supabase, o sincronizar con Google Calendar). Se puede agregar después
sin rehacer la web.
