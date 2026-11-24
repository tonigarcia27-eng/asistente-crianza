# Asistente de crianza · recursoseducatiusips.es

Chat con IA que responde dudas de crianza, recomienda especialistas cercanos
(detectando la ubicación automáticamente) y compara material para comprar.

## Cómo funciona

- **Respuestas:** Claude prioriza los artículos de recursoseducatiusips.es, luego
  fuentes fiables (AEPap, AEP, UNICEF, AELFA…) y cita los enlaces.
- **Ubicación automática:** el navegador pide permiso de ubicación. Si la familia
  lo acepta, se usa el GPS; si no, la zona aproximada por IP.
- **Especialistas:** cuando los rasgos lo aconsejan, busca en Google Maps
  (Places API) los profesionales más cercanos, ordenados por distancia.
- **Compras:** busca en la web opciones de calidad y precio y compara 2 o 3.

## Puesta en marcha (local)

Requiere Node 20.12 o superior.

```bash
cp .env.example .env      # y rellena ANTHROPIC_API_KEY (y GOOGLE_MAPS_API_KEY si la tienes)
npm install
npm start                 # abre http://localhost:3000
```

Sin `GOOGLE_MAPS_API_KEY` funciona igual, pero busca especialistas con la
búsqueda web en lugar de Google Maps.

## Ponerlo en la web (WordPress)

1. Publica este servidor en Render (botón **New → Blueprint** con este
   repositorio; `render.yaml` ya lo configura). Te dará una dirección tipo
   `https://asistente-crianza.onrender.com`.
2. **Portada:** en Elementor, añade un widget HTML justo debajo del bloque
   principal y pega el contenido de `public/seccion-portada.html`, cambiando
   `TU-SERVIDOR` por tu dirección. Crea un bloque destacado con una caja para
   preguntar y sugerencias rápidas, y carga el botón flotante.
3. **Botón flotante en toda la web (opcional):** pega en el pie de página
   (Elementor → Theme Builder → Footer, o un plugin tipo "Insert Headers and
   Footers"):

```html
<script src="https://TU-SERVIDOR/widget.js" data-color="#2f8f6b" defer></script>
```

`data-color` es el color de la marca; cámbialo por el de la web. Cualquier
enlace con `href="#asistente"` (y opcionalmente `data-pregunta="..."`) abre el
chat, así que puedes añadirlo a botones del menú o de los artículos.

## Notas del prototipo

- Las conversaciones se guardan en memoria 2 horas; al reiniciar se pierden.
- Modelo: `claude-opus-5-5` con búsqueda web y respaldo automático si una
  consulta es rechazada.
- Antes de abrirlo al público: límite de mensajes por visitante, aviso de
  privacidad sobre la ubicación (RGPD) y revisar costes.
