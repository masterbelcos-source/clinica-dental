/**
 * Servidor todo-en-uno (sin dependencias): sirve la web y expone POST /api/agendar.
 * Úsalo para probar en tu computadora o para hospedar en un VPS.
 *
 *   node --env-file=.env server.js      (Node 20+)
 *   node server.js                      (si las variables ya están en el entorno)
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { validar, enviarCorreos } from "./api/agendar.js";

const RAIZ = fileURLToPath(new URL(".", import.meta.url));
const PUERTO = process.env.PORT || 3000;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  /* ---------- API ---------- */
  if (url.pathname === "/api/agendar") {
    if (req.method !== "POST") return json(res, 405, { error: "Método no permitido" });

    let crudo = "";
    for await (const trozo of req) {
      crudo += trozo;
      if (crudo.length > 20_000) { req.destroy(); return; }   // corta cargas absurdas
    }

    try {
      const datos = JSON.parse(crudo || "{}");
      const problema = validar(datos);
      if (problema === "spam") return json(res, 200, { ok: true });
      if (problema) return json(res, 400, { error: problema });

      const resultado = await enviarCorreos(datos);
      console.log(`✓ Cita solicitada: ${datos.nombre} — ${datos.fecha} ${datos.hora}`);
      return json(res, 200, { ok: true, ...resultado });
    } catch (err) {
      console.error("Error al agendar:", err);
      return json(res, 500, { error: "No se pudo enviar el correo." });
    }
  }

  /* ---------- Archivos estáticos ---------- */
  const relativo = url.pathname === "/" ? "index.html" : normalize(url.pathname).replace(/^(\.\.[/\\])+/, "").slice(1);
  try {
    const archivo = await readFile(join(RAIZ, relativo));
    res.writeHead(200, { "Content-Type": TIPOS[extname(relativo)] || "application/octet-stream" });
    res.end(archivo);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 — no encontrado");
  }
}).listen(PUERTO, () => {
  console.log(`Clínica Almendra en http://localhost:${PUERTO}`);
});
