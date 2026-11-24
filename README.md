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

1. Publica este servidor en un hosting con Node (Render, Railway, Fly.io…),
   por ejemplo en `https://asistente.recursoseducatiusips.es`.
2. En WordPress (Elementor → widget HTML) pega:

```html
<iframe src="https://asistente.recursoseducatiusips.es"
        allow="geolocation"
        style="width:100%;height:700px;border:0;border-radius:16px"></iframe>
```

`allow="geolocation"` es necesario para que el chat pueda pedir la ubicación
dentro del iframe.

## Notas del prototipo

- Las conversaciones se guardan en memoria 2 horas; al reiniciar se pierden.
- Modelo: `claude-opus-5-5` con búsqueda web y respaldo automático si una
  consulta es rechazada.
- Antes de abrirlo al público: límite de mensajes por visitante, aviso de
  privacidad sobre la ubicación (RGPD) y revisar costes.
