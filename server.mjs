// Asistente de crianza para recursoseducatiusips.es
// Servidor Express: chat con Claude + búsqueda web + especialistas cercanos (Google Places).

import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MODEL = "claude-opus-5-5";
const BETAS = ["server-side-fallback-2026-07-01"];
const MAX_TOOL_ROUNDS = 8;

// ---------------------------------------------------------------------------
// Instrucciones del asistente (fijas: no meter datos variables aquí, para que
// funcione la caché de prompts; la ubicación va en cada mensaje del usuario).
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Eres el asistente de crianza de PADRESMOLONES (recursoseducatiusips.es), una web de recursos prácticos y materiales descargables para la vida familiar cotidiana: rutinas, juego, emociones, lectura, matemáticas y alimentación saludable.

Hablas con madres y padres de España. Responde en el idioma en que te escriban (castellano o catalán), con calidez, sin juzgar y en un tono cercano y práctico.

CÓMO RESPONDER
- Da pasos concretos que la familia pueda aplicar hoy. Respuestas breves: 3 a 6 ideas, no ensayos.
- Fuentes, en este orden de preferencia:
  1. recursoseducatiusips.es: si hay un artículo o descargable relacionado, recomiéndalo con su enlace. Búscalo con la búsqueda web usando "site:recursoseducatiusips.es".
  2. Fuentes fiables: Familia y Salud (familiaysalud.es, AEPap), En Familia (enfamilia.aeped.es, AEP), UNICEF, OMS, AELFA (logopedia), Consejo General de Colegios de Ópticos-Optometristas, Plena Inclusión, asociaciones de altas capacidades, Ministerio de Sanidad y Ministerio de Educación.
  3. Otras webs solo si no encuentras nada en las anteriores.
- Cita siempre las fuentes externas con su enlace.

ESPECIALISTAS
- Si los rasgos que describe la familia pueden necesitar valoración profesional (dificultades persistentes de lectura o lenguaje, problemas de visión, conducta, sueño, alimentación, desarrollo, posibles altas capacidades, ansiedad...), explica qué tipo de especialista conviene y por qué, y usa la herramienta buscar_especialistas con la ubicación que te llega en el mensaje.
- Tipos habituales: pediatra, psicólogo infantil, neuropediatra, logopeda, optometrista comportamental, oftalmólogo pediátrico, psicopedagogo, centro de altas capacidades, terapeuta ocupacional, fisioterapeuta pediátrico.
- Recuerda que el primer paso suele ser el pediatra del centro de salud (gratuito) y el orientador del colegio.
- Presenta los resultados como opciones a valorar, con dirección, valoración y enlace. No digas que un profesional es "el mejor" ni inventes datos.

COMPRAS
- Si preguntan por material (libros, juegos, sillas, material de lectura...), busca en la web opciones de buena calidad y buen precio y compara 2 o 3, con enlace y precio aproximado, avisando de que los precios cambian.

SEGURIDAD
- No diagnosticas ni sustituyes a un profesional. Dilo con naturalidad cuando hables de salud o desarrollo.
- Ante señales de urgencia (dificultad para respirar, convulsiones, pérdida de conciencia, intoxicación, ideas de hacerse daño, maltrato), indica llamar al 112 inmediatamente. Para maltrato infantil, también el teléfono ANAR 900 20 20 10.
- No pidas datos personales innecesarios del menor (nombre completo, colegio, etc.).`;

// ---------------------------------------------------------------------------
// Herramientas
// ---------------------------------------------------------------------------
const tools = [
  {
    type: "web_search_20260209",
    name: "web_search",
    max_uses: 5,
  },
  {
    name: "buscar_especialistas",
    description:
      "Busca profesionales o centros infantiles cercanos a la familia (psicólogos, pediatras, logopedas, optometristas, centros de altas capacidades, etc.) usando Google Maps. Devuelve nombre, dirección, valoración, teléfono, web y enlace a Maps.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          description:
            "Tipo de especialista en castellano, p. ej. 'logopeda infantil', 'psicólogo infantil', 'optometrista comportamental'.",
        },
        latitud: { type: "number" },
        longitud: { type: "number" },
        radio_km: {
          type: "number",
          description: "Radio de búsqueda en km (por defecto 10).",
        },
      },
      required: ["tipo", "latitud", "longitud"],
      additionalProperties: false,
    },
    strict: true,
  },
];

async function buscarEspecialistas({ tipo, latitud, longitud, radio_km }) {
  if (!GOOGLE_KEY) {
    return {
      error:
        "La búsqueda en Google Maps no está configurada. Usa la búsqueda web para encontrar especialistas en la ciudad de la familia.",
    };
  }
  const radius = Math.min(Math.max((radio_km || 10) * 1000, 1000), 50000);
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": [
        "places.displayName",
        "places.formattedAddress",
        "places.rating",
        "places.userRatingCount",
        "places.nationalPhoneNumber",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.location",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery: tipo,
      languageCode: "es",
      regionCode: "ES",
      maxResultCount: 8,
      locationBias: {
        circle: { center: { latitude: latitud, longitude: longitud }, radius },
      },
    }),
  });
  if (!res.ok) {
    return { error: `Google Places respondió ${res.status}` };
  }
  const data = await res.json();
  const resultados = (data.places || []).map((p) => ({
    nombre: p.displayName?.text,
    direccion: p.formattedAddress,
    valoracion: p.rating ?? null,
    num_opiniones: p.userRatingCount ?? 0,
    telefono: p.nationalPhoneNumber ?? null,
    web: p.websiteUri ?? null,
    maps: p.googleMapsUri,
    distancia_km: p.location
      ? Math.round(distanciaKm(latitud, longitud, p.location.latitude, p.location.longitude) * 10) / 10
      : null,
  }));
  resultados.sort((a, b) => (a.distancia_km ?? 99) - (b.distancia_km ?? 99));
  return { resultados };
}

function distanciaKm(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// ---------------------------------------------------------------------------
// Ubicación: GPS del navegador si el padre lo permite; si no, por IP.
// ---------------------------------------------------------------------------
async function ubicacionPorIp(ip) {
  try {
    const isLocal = !ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.");
    const url = isLocal ? "https://ipapi.co/json/" : `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.error || d.latitude == null) return null;
    return {
      lat: d.latitude,
      lon: d.longitude,
      ciudad: d.city,
      region: d.region,
      pais: d.country_code,
      zona_horaria: d.timezone,
      fuente: "ip",
    };
  } catch {
    return null;
  }
}

async function ciudadDesdeCoordenadas(lat, lon) {
  if (!GOOGLE_KEY) return {};
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&language=es&result_type=locality&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const d = await res.json();
    const comps = d.results?.[0]?.address_components || [];
    const get = (t) => comps.find((c) => c.types.includes(t));
    return {
      ciudad: get("locality")?.long_name,
      region: get("administrative_area_level_1")?.long_name,
      pais: get("country")?.short_name,
    };
  } catch {
    return {};
  }
}

async function resolverUbicacion(req, gps) {
  if (gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lon)) {
    const extra = await ciudadDesdeCoordenadas(gps.lat, gps.lon);
    return { lat: gps.lat, lon: gps.lon, ...extra, fuente: "gps" };
  }
  return ubicacionPorIp(req.ip);
}

// ---------------------------------------------------------------------------
// Conversaciones en memoria (prototipo). El historial se guarda tal cual lo
// devuelve la API, sin editarlo, como exige el modelo.
// ---------------------------------------------------------------------------
const conversaciones = new Map(); // id -> { messages, ubicacion, updated }
const TTL_MS = 2 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, c] of conversaciones) if (now - c.updated > TTL_MS) conversaciones.delete(id);
}, 10 * 60 * 1000).unref();

function textoUbicacion(u) {
  if (!u) return "[Ubicación de la familia: desconocida. Si hace falta, pregunta la ciudad.]";
  const lugar = [u.ciudad, u.region, u.pais].filter(Boolean).join(", ") || "sin nombre";
  const precision = u.fuente === "gps" ? "precisa (GPS)" : "aproximada (por IP)";
  return `[Ubicación de la familia: ${lugar} · lat ${u.lat}, lon ${u.lon} · ${precision}]`;
}

async function ejecutarTurno(conv) {
  for (let ronda = 0; ronda < MAX_TOOL_ROUNDS; ronda++) {
    const webSearch = { ...tools[0] };
    if (conv.ubicacion?.pais) {
      webSearch.user_location = {
        type: "approximate",
        ...(conv.ubicacion.ciudad && { city: conv.ubicacion.ciudad }),
        ...(conv.ubicacion.region && { region: conv.ubicacion.region }),
        country: conv.ubicacion.pais,
        ...(conv.ubicacion.zona_horaria && { timezone: conv.ubicacion.zona_horaria }),
      };
    }

    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      system: SYSTEM_PROMPT,
      tools: [webSearch, tools[1]],
      messages: conv.messages,
    });
    const msg = await stream.finalMessage();
    conv.messages.push({ role: "assistant", content: msg.content });

    if (msg.stop_reason === "refusal") {
      return "Lo siento, no puedo ayudar con esta consulta. Si es una urgencia, llama al 112.";
    }
    if (msg.stop_reason === "pause_turn") continue;
    if (msg.stop_reason !== "tool_use") {
      return msg.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    }

    const resultados = [];
    for (const block of msg.content) {
      if (block.type !== "tool_use") continue;
      let content;
      let is_error = false;
      try {
        if (block.name === "buscar_especialistas") {
          content = JSON.stringify(await buscarEspecialistas(block.input));
        } else {
          content = `Herramienta desconocida: ${block.name}`;
          is_error = true;
        }
      } catch (e) {
        content = `Error: ${e.message}`;
        is_error = true;
      }
      resultados.push({ type: "tool_result", tool_use_id: block.id, content, is_error });
    }
    conv.messages.push({ role: "user", content: resultados });
  }
  return "He tardado demasiado en preparar la respuesta. ¿Puedes reformular la pregunta?";
}

// ---------------------------------------------------------------------------
// API HTTP
// ---------------------------------------------------------------------------
const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(here, "public")));

app.post("/api/chat", async (req, res) => {
  const { conversacionId, mensaje, gps } = req.body || {};
  if (typeof mensaje !== "string" || !mensaje.trim() || mensaje.length > 4000) {
    return res.status(400).json({ error: "Mensaje vacío o demasiado largo." });
  }

  let id = conversacionId;
  let conv = id && conversaciones.get(id);
  if (!conv) {
    id = crypto.randomUUID();
    conv = { messages: [], ubicacion: null, updated: Date.now() };
    conversaciones.set(id, conv);
  }
  if (!conv.ubicacion || (gps && conv.ubicacion.fuente !== "gps")) {
    conv.ubicacion = await resolverUbicacion(req, gps);
  }
  if (conv.ocupada) {
    return res.status(409).json({ error: "Espera a que termine la respuesta anterior." });
  }
  conv.ocupada = true;
  conv.updated = Date.now();
  const longitudPrevia = conv.messages.length;

  conv.messages.push({
    role: "user",
    content: `${textoUbicacion(conv.ubicacion)}\n\n${mensaje.trim()}`,
  });

  try {
    const respuesta = await ejecutarTurno(conv);
    res.json({
      conversacionId: id,
      respuesta,
      ubicacion: conv.ubicacion
        ? { ciudad: conv.ubicacion.ciudad, fuente: conv.ubicacion.fuente }
        : null,
    });
  } catch (error) {
    // Deshacer este turno completo para poder reintentar
    conv.messages.length = longitudPrevia;
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Hay mucha demanda. Prueba en un minuto." });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Error de la API ${error.status}:`, error.message);
    } else {
      console.error(error);
    }
    res.status(500).json({ error: "No he podido responder. Inténtalo de nuevo." });
  } finally {
    conv.ocupada = false;
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Asistente de crianza en http://localhost:${port}`));
