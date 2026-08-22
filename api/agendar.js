/**
 * POST /api/agendar
 *
 * Recibe el formulario de la web, valida los datos y envía dos correos con Resend:
 *   1. el aviso al consultorio (crítico)
 *   2. el acuse de recibo al paciente (opcional: si falla, la cita igual se registra)
 *
 * Archivo autocontenido y sin dependencias: funciona tal cual en Vercel,
 * en Netlify (moviéndolo a netlify/functions/) y desde server.js en local.
 */

const RESEND_URL = "https://api.resend.com/emails";

/* ---------- Variables de entorno (se configuran en Vercel) ---------- */
const {
  RESEND_API_KEY,
  MAIL_FROM = "Clínica Almendra <onboarding@resend.dev>",
  MAIL_TO = "dentista@tudominio.com",
  CLINICA_NOMBRE = "Clínica Dental Almendra",
  CLINICA_TEL = "55 1234 5678",
  CLINICA_DIR = "Av. Reforma 128, piso 3, consultorio 302, Col. Juárez, CDMX"
} = process.env;

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ============================================================
   VALIDACIÓN
   ============================================================ */
/** Devuelve null si todo está bien, o un texto con el motivo del rechazo. */
export function validar(d = {}) {
  if (d.empresa) return "spam";                                     // honeypot
  if (!d.nombre || String(d.nombre).trim().length < 3) return "Nombre inválido.";
  if (!d.email || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.email)) return "Correo inválido.";
  if (!d.telefono || String(d.telefono).replace(/\D/g, "").length < 10) return "Teléfono inválido.";
  if (!d.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) return "Fecha inválida.";
  if (!d.hora || !/^\d{2}:\d{2}$/.test(d.hora)) return "Hora inválida.";
  if (!d.servicio) return "Falta el motivo de la cita.";
  const cuando = new Date(`${d.fecha}T${d.hora}:00`);
  if (isNaN(cuando) || cuando < new Date()) return "La fecha de la cita ya pasó.";
  return null;
}

/* ============================================================
   PLANTILLAS DE CORREO
   ============================================================ */
const shell = (titulo, cuerpo) => `<!doctype html>
<html lang="es"><body style="margin:0;background:#f3f8f6;padding:28px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d2b27">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #eaf0ed;border-radius:16px;overflow:hidden">
    <tr><td style="background:#2c7a6c;padding:22px 28px;color:#fff;font-size:14px;letter-spacing:.12em;text-transform:uppercase">${esc(CLINICA_NOMBRE)}</td></tr>
    <tr><td style="padding:30px 28px">
      <h1 style="margin:0 0 18px;font-size:22px;font-weight:500;line-height:1.25">${esc(titulo)}</h1>
      ${cuerpo}
    </td></tr>
    <tr><td style="padding:18px 28px;background:#f3f8f6;font-size:12px;color:#5f736e;line-height:1.6">
      ${esc(CLINICA_NOMBRE)} · ${esc(CLINICA_TEL)}<br>${esc(CLINICA_DIR)}
    </td></tr>
  </table>
</body></html>`;

const filas = pares => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:15px;border-collapse:collapse">
  ${pares.filter(([, v]) => v).map(([k, v]) => `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef4f2;color:#5f736e;width:38%;vertical-align:top">${esc(k)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eef4f2;font-weight:600">${esc(v)}</td></tr>`).join("")}
</table>`;

async function enviar(payload) {
  const r = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

/* ============================================================
   ENVÍO
   ============================================================ */
export async function enviarCorreos(d) {
  if (!RESEND_API_KEY) throw new Error("Falta la variable RESEND_API_KEY");

  const cuando = `${d.fechaTexto || d.fecha} · ${d.hora} h`;
  const destinos = MAIL_TO.split(",").map(s => s.trim()).filter(Boolean);

  /* 1. Aviso interno para el consultorio */
  const alDentista = enviar({
    from: MAIL_FROM,
    to: destinos,
    reply_to: d.email,
    subject: `Nueva cita: ${d.nombre} — ${d.fecha} ${d.hora}`,
    html: shell("Nueva solicitud de cita", filas([
      ["Fecha y hora", cuando],
      ["Motivo", d.servicio],
      ["Paciente", d.nombre],
      ["Teléfono", d.telefono],
      ["Correo", d.email],
      ["¿Primera vez?", d.paciente],
      ["Comentarios", d.mensaje],
      ["Enviado desde", d.origen]
    ]) + `<p style="margin:22px 0 0;font-size:14px;color:#5f736e">Responde este correo para contestarle directo al paciente.</p>`)
  });

  /* 2. Acuse de recibo para el paciente
        (con dominio sin verificar, Resend solo permite enviarte a ti mismo:
         este correo fallará y se registra como aviso, sin romper la solicitud) */
  const alPaciente = enviar({
    from: MAIL_FROM,
    to: [d.email],
    reply_to: destinos[0],
    subject: `Recibimos tu solicitud de cita — ${CLINICA_NOMBRE}`,
    html: shell(`Hola ${d.nombre.split(" ")[0]}, ya tenemos tu solicitud`,
      `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#41544f">
         Esto <b>todavía no es una confirmación</b>: revisamos la agenda y te confirmamos por correo o WhatsApp dentro del horario de atención.
       </p>` +
      filas([["Fecha y hora", cuando], ["Motivo", d.servicio], ["Teléfono de contacto", d.telefono]]) +
      `<p style="margin:22px 0 0;font-size:14px;line-height:1.7;color:#41544f">
         ¿Necesitas cambiarla o es urgente? Llámanos al <b>${esc(CLINICA_TEL)}</b>.
       </p>`)
  });

  const [dentista, paciente] = await Promise.allSettled([alDentista, alPaciente]);

  if (dentista.status === "rejected") throw dentista.reason;
  if (paciente.status === "rejected") console.warn("Acuse al paciente no enviado:", paciente.reason?.message);

  return { id: dentista.value?.id, acuse: paciente.status === "fulfilled" };
}

/* ============================================================
   LÍMITE DE PETICIONES (memoria del proceso)
   ============================================================ */
const visitas = new Map();
const LIMITE = 5;                 // solicitudes...
const VENTANA = 10 * 60 * 1000;   // ...por cada 10 minutos y por IP

function excedido(ip) {
  const ahora = Date.now();
  const previas = (visitas.get(ip) || []).filter(t => ahora - t < VENTANA);
  previas.push(ahora);
  visitas.set(ip, previas);
  return previas.length > LIMITE;
}

/* ============================================================
   HANDLER (Vercel / Netlify)
   ============================================================ */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido" });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "local";
  if (excedido(ip)) return res.status(429).json({ error: "Demasiadas solicitudes. Inténtalo en unos minutos." });

  try {
    const datos = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const problema = validar(datos);
    if (problema === "spam") return res.status(200).json({ ok: true });   // bot: fingimos éxito
    if (problema) return res.status(400).json({ error: problema });

    const resultado = await enviarCorreos(datos);
    return res.status(200).json({ ok: true, ...resultado });
  } catch (err) {
    console.error("Error al agendar:", err);
    return res.status(500).json({ error: "No se pudo enviar el correo. Intenta de nuevo o llámanos." });
  }
}
