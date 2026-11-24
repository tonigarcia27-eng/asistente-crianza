/*
 * Widget del asistente de crianza para recursoseducatiusips.es
 *
 * Uso (WordPress → Elementor → widget HTML, o en el pie de todas las páginas):
 *   <script src="https://TU-SERVIDOR/widget.js" data-color="#2f8f6b" defer></script>
 *
 * Crea un botón flotante abajo a la derecha que abre el chat en un panel.
 * Cualquier botón o formulario de la página puede abrirlo con una pregunta:
 *   window.AsistenteCrianza.abrir("Mi hijo no quiere leer")
 * o con un enlace: <a href="#asistente">Pregunta al asistente</a>
 */
(() => {
  if (window.AsistenteCrianza) return;
  const script = document.currentScript;
  const origen = new URL(script.src).origin;
  const color = script.dataset.color || "#2f8f6b";
  const texto = script.dataset.texto || "¿Dudas de crianza? Pregúntame";

  const css = `
  .ac-lanzador{position:fixed;right:max(20px,env(safe-area-inset-right,0px));bottom:max(20px,env(safe-area-inset-bottom,0px));z-index:99998;display:flex;align-items:center;gap:10px;padding:12px 18px 12px 14px;border:0;border-radius:999px;background:${color};color:#fff;font:700 15px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}
  .ac-lanzador:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.22)}
  .ac-lanzador:focus-visible{outline:3px solid #fff;outline-offset:2px}
  .ac-lanzador svg{width:26px;height:26px;flex:none}
  .ac-lanzador .ac-punto{position:absolute;top:6px;left:34px;width:10px;height:10px;border-radius:50%;background:#ffd166;border:2px solid ${color}}
  .ac-panel{position:fixed;right:max(20px,env(safe-area-inset-right,0px));bottom:max(20px,env(safe-area-inset-bottom,0px));z-index:99999;width:min(420px,calc(100vw - 40px));height:min(680px,calc(100vh - 40px));border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;opacity:0;transform:translateY(16px) scale(.98);pointer-events:none;transition:opacity .2s ease,transform .2s ease}
  .ac-panel.ac-abierto{opacity:1;transform:none;pointer-events:auto}
  .ac-cabecera{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;background:${color};color:#fff;font:700 16px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif}
  .ac-cabecera small{display:block;font-weight:400;font-size:12px;opacity:.85;margin-top:2px}
  .ac-cerrar{border:0;background:rgba(255,255,255,.18);color:#fff;width:34px;height:34px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer}
  .ac-panel iframe{flex:1;width:100%;border:0}
  @media (max-width:520px){.ac-panel{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0}.ac-lanzador span{display:none}.ac-lanzador{padding:14px}}
  @media (prefers-reduced-motion:reduce){.ac-lanzador,.ac-panel{transition:none}}`;
  const estilo = document.createElement("style");
  estilo.textContent = css;
  document.head.appendChild(estilo);

  const icono = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/></svg>';

  const lanzador = document.createElement("button");
  lanzador.type = "button";
  lanzador.className = "ac-lanzador";
  lanzador.setAttribute("aria-label", texto);
  lanzador.innerHTML = icono + '<span class="ac-punto"></span><span></span>';
  lanzador.lastChild.textContent = texto;

  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Asistente de crianza");
  panel.innerHTML = '<div class="ac-cabecera"><div>Asistente de crianza<small>Dudas, especialistas cerca y compras</small></div><button type="button" class="ac-cerrar" aria-label="Cerrar">×</button></div>';

  let iframe = null;
  function abrir(pregunta) {
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.title = "Asistente de crianza";
      iframe.allow = "geolocation";
      const url = new URL("/", origen);
      url.searchParams.set("embed", "1");
      url.searchParams.set("color", color);
      if (pregunta) url.searchParams.set("q", pregunta);
      iframe.src = url.toString();
      panel.appendChild(iframe);
    } else if (pregunta) {
      iframe.contentWindow.postMessage({ tipo: "pregunta", texto: pregunta }, origen);
    }
    panel.classList.add("ac-abierto");
    lanzador.hidden = true;
    lanzador.querySelector(".ac-punto")?.remove();
  }
  function cerrar() {
    panel.classList.remove("ac-abierto");
    lanzador.hidden = false;
    lanzador.focus();
  }

  lanzador.addEventListener("click", () => abrir());
  panel.querySelector(".ac-cerrar").addEventListener("click", cerrar);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("ac-abierto")) cerrar(); });
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest('a[href="#asistente"]');
    if (a) { e.preventDefault(); abrir(a.dataset.pregunta || ""); }
  });

  const montar = () => { document.body.appendChild(lanzador); document.body.appendChild(panel); };
  if (document.body) montar(); else document.addEventListener("DOMContentLoaded", montar);

  window.AsistenteCrianza = { abrir, cerrar };
})();
