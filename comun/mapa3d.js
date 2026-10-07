/* Mapa 3D de vídeos de TodoEnRecambio (TDR) como pieza embebible: pestaña «Mapa» de cualquier versión del panel.
   Contrato: PANEL-REDES/_CONTRATO_MAPA.md. Parte de disenos/mapa/mapa.js (la página publicada, que no se toca).

     const { montarMapa } = await import("../comun/mapa3d.js");
     const mapa = await montarMapa(contenedor, { datos, logo, modo, clave, tema });
     mapa.setTema({...}); mapa.setModo("galaxia"); mapa.pausar(); mapa.reanudar(); mapa.destruir();

   Todo número que se ve sale de mapa_videos.json. Toda la interfaz vive dentro del contenedor (nada fijo sobre la ventana).
   Three.js 0.160 llega por el importmap de la página anfitriona y se carga con import() una sola vez por página. */

const REDES = ["youtube", "instagram", "tiktok", "facebook"];
const RED = {
  youtube: { nombre: "YouTube", color: "#ff3b30" },
  instagram: { nombre: "Instagram", color: "#e1306c" },
  tiktok: { nombre: "TikTok", color: "#25f4ee" },
  facebook: { nombre: "Facebook", color: "#1877f2" },
};
const TIPOS = ["short", "largo", "reel"];
const TIPO = { short: "Short", largo: "Vídeo largo", reel: "Reel" };
const FILTRO_TIPO = [["todos", "Todos"], ["short", "Shorts"], ["largo", "Largos"], ["reel", "Reels"]];
// colores por tipo (validados: separación para daltonismo y contraste sobre fondo claro u oscuro)
const COLOR_TIPO = { oscuro: { short: "#bd8318", largo: "#9474f2", reel: "#22ad79" }, claro: { short: "#a35f00", largo: "#6b46d6", reel: "#0d8259" } };
const ROJO_TDR = "#d71119";
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const AGRUPA = (() => { try { return (1234).toLocaleString("es-ES", { useGrouping: "always" }) !== "1234"; } catch (e) { return false; } })();
const fmt = n => n == null || isNaN(n) ? "–" : AGRUPA ? Math.round(n).toLocaleString("es-ES", { useGrouping: "always" })
  : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const fecha = s => { if (!s) return "–"; const [y, m, d] = s.slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]} ${y}`; };
const fechaDe = t => { const d = new Date(t); return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`; };
const hora = s => s && s.length >= 16 ? s.slice(11, 16) : "";
const norm = t => (t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();   // sin tildes ni diéresis
const plural = (n, uno, varios) => `${fmt(n)} ${n === 1 ? uno : varios}`;
const RAD = g => g * Math.PI / 180;
const texUrl = n => new URL(`./tex/${n}`, import.meta.url).href;

/* ─────────── paletas propias del mapa («Los del panel» se calcula con el tema del anfitrión) ───────────
   estrellas: "luz" = estrellas que brillan (mezcla aditiva + bloom) · "disco" = discos con borde, como en papel */
const PALETAS = {
  noche: { claro: false, estrellas: "luz", escena: "#050913", tex: null, vineta: "224 70% 2%", vinetaA: 0.6,
    sup: "rgb(10 17 31 / 0.8)", maciza: "#0b1220", sup2: "rgb(32 44 72 / 0.62)", borde: "rgb(150 172 214 / 0.16)", borde2: "rgb(150 172 214 / 0.32)",
    tinta: "#edf1f8", tinta2: "#b5bfd2", tinta3: "#8e99b0", sel: "rgb(215 17 25 / 0.2)", sombra: "224 72% 2%", sombraA: 1,
    etiqueta: "rgb(6 11 22 / 0.74)", rejilla: "#8ea6db", enlace: "#ffffff", muestra: ["#050913", "#d71119"] },
  asfalto: { claro: false, estrellas: "luz", escena: "#100f0d", tex: null, vineta: "30 25% 2%", vinetaA: 0.6,
    sup: "rgb(27 25 22 / 0.8)", maciza: "#1a1815", sup2: "rgb(70 62 52 / 0.45)", borde: "rgb(232 214 190 / 0.14)", borde2: "rgb(232 214 190 / 0.3)",
    tinta: "#f2ede5", tinta2: "#c5bcaf", tinta3: "#9f9689", sel: "rgb(215 17 25 / 0.22)", sombra: "28 30% 2%", sombraA: 1,
    etiqueta: "rgb(18 16 14 / 0.76)", rejilla: "#d9c7aa", enlace: "#fff6e8", muestra: ["#100f0d", "#d71119"] },
  crema: { claro: true, estrellas: "disco", escena: "#efe7d8", tex: "papel_crema.jpg", vineta: "36 25% 40%", vinetaA: 0.14,
    sup: "rgb(251 248 241 / 0.9)", maciza: "#fbf8f1", sup2: "rgb(27 26 24 / 0.06)", borde: "rgb(27 26 24 / 0.15)", borde2: "rgb(27 26 24 / 0.3)",
    tinta: "#1b1a18", tinta2: "#4b4741", tinta3: "#6a655d", sel: "rgb(215 17 25 / 0.1)", sombra: "32 22% 30%", sombraA: 0.35,
    etiqueta: "rgb(251 248 241 / 0.88)", rejilla: "#1b1a18", enlace: "#1b1a18", muestra: ["#efe7d8", "#d71119"] },
  kraft: { claro: true, estrellas: "disco", escena: "#b8915f", tex: "papel_kraft.jpg", vineta: "28 40% 18%", vinetaA: 0.22,
    sup: "rgb(244 236 222 / 0.92)", maciza: "#f4ecde", sup2: "rgb(27 26 24 / 0.07)", borde: "rgb(27 26 24 / 0.18)", borde2: "rgb(27 26 24 / 0.32)",
    tinta: "#1b1a18", tinta2: "#463c30", tinta3: "#5e5242", sel: "rgb(215 17 25 / 0.12)", sombra: "28 35% 18%", sombraA: 0.45,
    etiqueta: "rgb(244 236 222 / 0.9)", rejilla: "#1b1a18", enlace: "#1b1a18", muestra: ["#b8915f", "#d71119"] },
  corporativo: { claro: false, estrellas: "luz", escena: "#121317", tex: "corp.jpg", vineta: "230 15% 3%", vinetaA: 0.55,
    sup: "rgb(24 25 31 / 0.84)", maciza: "#17181d", sup2: "rgb(255 255 255 / 0.06)", borde: "rgb(255 255 255 / 0.12)", borde2: "rgb(255 255 255 / 0.24)",
    tinta: "#f1f1f3", tinta2: "#b9bac2", tinta3: "#90929c", sel: "rgb(215 17 25 / 0.22)", sombra: "230 20% 2%", sombraA: 1,
    etiqueta: "rgb(18 19 23 / 0.78)", rejilla: "#c8cad4", enlace: "#ffffff", muestra: ["#121317", "#d71119"] },
  pizarra: { claro: false, estrellas: "disco", escena: "#202221", tex: "pizarra.jpg", vineta: "150 5% 3%", vinetaA: 0.5,
    sup: "rgb(30 33 32 / 0.86)", maciza: "#1d201f", sup2: "rgb(236 234 228 / 0.07)", borde: "rgb(236 234 228 / 0.14)", borde2: "rgb(236 234 228 / 0.28)",
    tinta: "#eceae4", tinta2: "#bdbab2", tinta3: "#96938b", sel: "rgb(215 17 25 / 0.24)", sombra: "150 8% 2%", sombraA: 1,
    etiqueta: "rgb(29 32 31 / 0.82)", rejilla: "#eceae4", enlace: "#eceae4", muestra: ["#202221", "#eceae4"] },
};
const mezclaCss = (c, a) => `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
function luminancia(c) {                                          // 0..1 de cualquier color CSS (para saber si el panel es claro)
  try {
    const x = document.createElement("canvas").getContext("2d"); x.fillStyle = "#000"; x.fillStyle = c;
    const m = /^#([0-9a-f]{6})$/i.exec(x.fillStyle); if (!m) return 0.5;
    const v = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(u => u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  } catch (e) { return 0.5; }
}
function paletaPanel(t) {
  const fondo = t.fondo || "#efe7d8";
  const claro = typeof t.claro === "boolean" ? t.claro : luminancia(fondo) > 0.4;
  const sup = t.superficie || fondo, tinta = t.tinta || (claro ? "#1b1a18" : "#eceae4"), suave = t.suave || tinta;
  return { claro, estrellas: claro ? "disco" : "luz", escena: fondo, tex: null,
    vineta: claro ? "36 20% 35%" : "224 40% 3%", vinetaA: claro ? 0.12 : 0.55,
    sup: mezclaCss(sup, 0.9), maciza: sup, sup2: mezclaCss(tinta, claro ? 0.06 : 0.08), borde: t.linea || mezclaCss(tinta, 0.16), borde2: mezclaCss(tinta, 0.3),
    tinta, tinta2: suave, tinta3: suave, sel: claro ? "rgb(215 17 25 / 0.1)" : "rgb(215 17 25 / 0.22)",
    sombra: claro ? "32 18% 30%" : "224 60% 2%", sombraA: claro ? 0.35 : 1, etiqueta: mezclaCss(sup, 0.88),
    rejilla: claro ? tinta : suave, enlace: tinta, muestra: [fondo, sup] };
}

/* ─────────── ajustes del mapa (se guardan con `clave`) ─────────── */
const AJ_DEF = { colores: "panel", brillo: "medio", rotar: "si", tam: "vis", color: "red", enlaces: "si" };
const OPC = {
  colores: { t: "Colores", o: [["panel", "Los del panel"], ["noche", "Noche"], ["asfalto", "Asfalto"], ["crema", "Papel crema"], ["kraft", "Kraft"], ["corporativo", "Corporativo"], ["pizarra", "Pizarra"]] },
  brillo: { t: "Brillo", o: [["bajo", "Bajo"], ["medio", "Medio"], ["alto", "Alto"]] },
  rotar: { t: "Autorrotación", o: [["si", "Sí"], ["no", "No"]] },
  tam: { t: "Tamaño por", o: [["vis", "Visualizaciones"], ["likes", "Me gusta"]] },
  color: { t: "Color por", o: [["red", "Red"], ["tipo", "Tipo"]] },
  enlaces: { t: "Enlaces entre redes", o: [["si", "Sí"], ["no", "No"]] },
};

/* ─────────── iconos ─────────── */
const ICO = {
  buscar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
  cerrar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l11.6-7.2a1 1 0 0 0 0-1.72L8.5 3.94A1 1 0 0 0 7 4.8z" fill="currentColor"/></svg>',
  parar: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
  ajustes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg>',
  centrar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>',
  chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  short: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="currentColor" opacity=".16"/><circle cx="10" cy="10" r="3.4" fill="currentColor"/></svg>',
  largo: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.2" fill="currentColor"/><circle cx="10" cy="10" r="6.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  tam: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="3" cy="13" r="1.5" fill="currentColor"/><circle cx="8" cy="12" r="2.4" fill="currentColor"/><circle cx="15" cy="10.5" r="3.9" fill="currentColor"/></svg>',
};

/* three.js y sus añadidos: una sola carga por página */
let promesaTres = null;
function cargarTres() {
  if (!promesaTres) promesaTres = Promise.all([
    import("three"),
    import("three/addons/controls/OrbitControls.js"),
    import("three/addons/renderers/CSS2DRenderer.js"),
    import("three/addons/postprocessing/EffectComposer.js"),
    import("three/addons/postprocessing/RenderPass.js"),
    import("three/addons/postprocessing/UnrealBloomPass.js"),
    import("three/addons/postprocessing/OutputPass.js"),
    import("three/addons/postprocessing/ShaderPass.js"),
  ]).then(m => ({ THREE: m[0], OrbitControls: m[1].OrbitControls, CSS2DRenderer: m[2].CSS2DRenderer, CSS2DObject: m[2].CSS2DObject,
    EffectComposer: m[3].EffectComposer, RenderPass: m[4].RenderPass, UnrealBloomPass: m[5].UnrealBloomPass,
    OutputPass: m[6].OutputPass, ShaderPass: m[7].ShaderPass })).catch(e => { promesaTres = null; throw e; });
  return promesaTres;
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
export async function montarMapa(contenedor, opciones = {}) {
  if (!contenedor) throw new Error("montarMapa: falta el contenedor");
  const op = Object.assign({ modo: null, clave: "tdr-mapa3d", tema: {} }, opciones);
  const urlDatos = op.datos || "mapa_videos.json";
  const urlLogo = op.logo || new URL("../../logo-tdr.png", import.meta.url).href;
  let tema = Object.assign({}, op.tema || {});
  const uid = "m3d" + Math.random().toString(36).slice(2, 8);
  const reduceMov = matchMedia("(prefers-reduced-motion: reduce)");

  // ajustes guardados (try/catch: la página funciona sin localStorage)
  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem(op.clave) || "{}") || {}; } catch (e) { guardado = {}; }
  const aj = {};
  for (const k in AJ_DEF) aj[k] = OPC[k].o.some(o => o[0] === guardado[k]) ? guardado[k] : AJ_DEF[k];
  let MODO = op.modo === "galaxia" || op.modo === "globo" ? op.modo : (guardado.modo === "galaxia" ? "galaxia" : "globo");
  const guardar = () => { try { localStorage.setItem(op.clave, JSON.stringify({ ...aj, modo: MODO })); } catch (e) { /* sin almacenamiento */ } };

  // escuchadores que hay que quitar en destruir()
  const limpiezas = [];
  const escuchar = (obj, tipo, fn, o) => { obj.addEventListener(tipo, fn, o); limpiezas.push(() => obj.removeEventListener(tipo, fn, o)); };

  /* ─────────── interfaz (dentro del contenedor) ─────────── */
  const raiz = document.createElement("div");
  raiz.className = "m3d";
  raiz.setAttribute("role", "region");
  raiz.setAttribute("aria-label", "Mapa 3D de vídeos");
  raiz.innerHTML = plantilla(uid);
  contenedor.appendChild(raiz);
  const q = s => raiz.querySelector(s);
  const el = {
    escena: q(".m3d-escena"), chips: q(".m3d-chips"), tipos: q(".m3d-seg"), busca: q(".m3d-busca"), q: q(".m3d-q"), qx: q(".m3d-q-x"),
    res: q(".m3d-resultados"), play: q(".m3d-play"), modo: q(".m3d-modo"), centrar: q(".m3d-centrar"), btnAj: q(".m3d-btn-ajustes"),
    cN: q(".m3d-c-n"), cVis: q(".m3d-c-vis"), cLk: q(".m3d-c-lk"), medio: q(".m3d-medio"), aviso: q(".m3d-aviso"),
    reloj: q(".m3d-reloj"), relojF: q(".m3d-reloj-fecha"), relojB: q(".m3d-reloj-barra i"),
    ficha: q(".m3d-ficha"), fRed: q(".m3d-f-red"), fTipo: q(".m3d-f-tipo"), fTit: q(".m3d-f-titulo"), fFecha: q(".m3d-f-fecha"),
    fVis: q(".m3d-f-vis"), fLk: q(".m3d-f-lk"), fPuesto: q(".m3d-puesto"), fMisma: q(".m3d-misma"), fMismaL: q(".m3d-misma div"), fVer: q(".m3d-ver"), fX: q(".m3d-f-x"),
    leyBtn: q(".m3d-ley-btn"), leyCuerpo: q(".m3d-ley-cuerpo"), leyColT: q(".m3d-ley-color-t"), leyCol: q(".m3d-ley-colores"),
    leyTam: q(".m3d-ley-tam"), leyModo: q(".m3d-ley-modo"), leyEnl: q(".m3d-ley-enlaces"), leyFuente: q(".m3d-ley-fuente"),
    tooltip: q(".m3d-tooltip"), fondoAj: q(".m3d-fondo-ajustes"), ajustes: q(".m3d-ajustes"), ajCuerpo: q(".m3d-aj-cuerpo"),
    ajX: q(".m3d-aj-x"), ajReset: q(".m3d-aj-reset"), ajEstado: q(".m3d-aj-estado"), filtros: q(".m3d-filtros"),
  };

  let W = 1, H = 1;
  const medir = () => { W = Math.max(1, raiz.clientWidth); H = Math.max(1, raiz.clientHeight); raiz.style.setProperty("--m3d-alto", H + "px"); };
  const estrecho = () => W <= 720;
  medir();

  // estado
  let THREE, OrbitControls, CSS2DRenderer, CSS2DObject, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass;
  let D = null, S = [], listo = false, sucio = true, destruido = false, pausado = false, tPausa = 0, raf = 0;
  const filtro = { redes: new Set(REDES), tipo: "todos", q: "", toks: [] };
  let renderer, scene, camera, controles, etiquetas, compFinal, compBrillo, bloom, mezcla, bloomActivo = true;
  let hover = null, sel = null, ultimaInteraccion = -1e9, ahoraMs = 0, ultimo = performance.now();
  let lineas = [], enlaces = null, puntosBase = null, refRejilla = [], refRed = [], puntosEncuadre = [];
  const zona = {}, ETIQ = [], TEX = {}, fondos = {};
  let logo, logoOcl, halo, reticula, anilloRepro, texLogo, vistaInicial = null, vuelo = null, colorEnlace = "#ffffff";
  let R = 40, vMax = 1, lMax = 1;
  const R0 = 17, R1 = 130, HMAX = 56, CAPA = 1, HALO_ESTRELLA = 2.1;
  const repro = { activa: false, t0: 0, hasta: -1, T: [], dur: 20000 };
  const desplaz = { x: 0, y: 0, ax: 0, ay: 0, listo: false };
  let pal = PALETAS.noche, pv = null, ajustesAbiertos = false, encuadreReal = false;
  const _v = { x: 0, y: 0, z: 0 };
  const radioDe = idx => R0 + (R1 - R0) * (idx + 0.5) / Math.max(1, S.length);           // galaxia: orden de publicación → radio
  const BRAZO = { youtube: 0, tiktok: Math.PI / 2, instagram: Math.PI, facebook: Math.PI * 1.5 };
  const anguloDe = (red, r) => BRAZO[red] + Math.log(r / R0) / Math.tan(RAD(21));
  // (las declaraciones con let/const van aquí arriba: lo que viene tras el «return» de abajo son solo funciones)

  montarAjustes();
  aplicarLetras();
  aplicarColores();
  marcarModo();
  conectarInterfaz();
  leyendaAbierta(!estrecho(), false);

  const ro = new ResizeObserver(() => { if (!destruido) redimensionar(); });
  ro.observe(raiz);
  limpiezas.push(() => ro.disconnect());

  try {
    const [datos, tres] = await Promise.all([
      fetch(urlDatos + (urlDatos.includes("?") ? "&" : "?") + Date.now()).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
      cargarTres(),
    ]);
    if (destruido) return api();
    ({ THREE, OrbitControls, CSS2DRenderer, CSS2DObject, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass } = tres);
    D = datos;
    montar();
  } catch (e) {
    el.aviso.classList.add("m3d-error");
    el.aviso.textContent = `No se ha podido cargar el mapa (${e && e.message ? e.message : e}).`;
    console.warn("Mapa de vídeos:", e);
  }
  return api();

  /* ══════════════════════════ API ══════════════════════════ */
  function api() {
    return {
      setTema(t) { tema = Object.assign({}, tema, t || {}); aplicarLetras(); if (aj.colores === "panel") aplicarColores(); else pintarMuestraPanel(); },
      setModo(m) { if (m === "globo" || m === "galaxia") cambiarModo(m); },
      pausar, reanudar, destruir,
    };
  }
  function pausar() {
    if (pausado || destruido) return;
    pausado = true; tPausa = performance.now();
    if (raf) cancelAnimationFrame(raf); raf = 0;
    ocultarTooltip();
  }
  function reanudar() {
    if (!pausado || destruido) return;
    pausado = false;
    const d = performance.now() - tPausa;
    if (repro.activa) repro.t0 += d;
    ultimo = performance.now();
    redimensionar(); sucio = true;
    if (listo && !raf) raf = requestAnimationFrame(bucle);
  }
  function destruir() {
    if (destruido) return;
    destruido = true;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    limpiezas.splice(0).forEach(f => { try { f(); } catch (e) { /* nada */ } });
    if (renderer) {
      vaciarEscena();
      Object.values(TEX).forEach(t => t.dispose()); Object.values(fondos).forEach(t => t.dispose()); if (texLogo) texLogo.dispose();
      if (controles) controles.dispose();
      for (const c of [compFinal, compBrillo]) if (c) { c.passes.forEach(p => p.dispose && p.dispose()); c.dispose(); }
      renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove();
    }
    raiz.remove();
  }

  /* ══════════════════════════ interfaz ══════════════════════════ */
  function plantilla(u) {
    return `
<div class="m3d-escena" role="img" aria-label="Mapa 3D de los vídeos de TodoEnRecambio"></div>
<div class="m3d-vineta" aria-hidden="true"></div>
<div class="m3d-capa">
  <section class="m3d-herr" aria-label="Filtros y vista del mapa">
    <div class="m3d-filtros">
      <div class="m3d-chips m3d-panel" role="group" aria-label="Redes"></div>
      <div class="m3d-seg m3d-panel" role="radiogroup" aria-label="Tipo de vídeo"></div>
    </div>
    <div class="m3d-acciones">
      <div class="m3d-busca m3d-panel">
        ${ICO.buscar}
        <input class="m3d-q" type="search" placeholder="Buscar por título" aria-label="Buscar por título" autocomplete="off" spellcheck="false" aria-controls="${u}-res" aria-expanded="false">
        <button class="m3d-x m3d-q-x" type="button" aria-label="Borrar la búsqueda" hidden>${ICO.cerrar}</button>
        <div class="m3d-resultados" id="${u}-res" hidden></div>
      </div>
      <button class="m3d-btn m3d-play" type="button" aria-pressed="false" aria-label="Reproducir crecimiento" disabled>
        <span class="m3d-ico m3d-ico-play">${ICO.play}</span><span class="m3d-ico m3d-ico-parar">${ICO.parar}</span>
        <span class="m3d-play-txt m3d-largo"><span class="m3d-t-play">Reproducir crecimiento</span><span class="m3d-t-parar">Parar</span></span>
        <span class="m3d-play-txt m3d-corto"><span class="m3d-t-play">Reproducir</span><span class="m3d-t-parar">Parar</span></span>
      </button>
    </div>
    <div class="m3d-vista">
      <div class="m3d-modo m3d-panel" role="group" aria-label="Vista del mapa">
        <button type="button" data-modo="globo" aria-pressed="false">Globo</button><button type="button" data-modo="galaxia" aria-pressed="false">Galaxia</button>
      </div>
      <button class="m3d-btn m3d-btn-icono m3d-centrar" type="button" aria-label="Centrar la vista" title="Centrar la vista">${ICO.centrar}</button>
      <button class="m3d-btn m3d-btn-ajustes" type="button" aria-expanded="false" aria-controls="${u}-aj">${ICO.ajustes}<span>Ajustes del mapa</span></button>
    </div>
  </section>

  <div class="m3d-contadores m3d-panel" aria-label="Lo que se ve en el mapa">
    <div><b class="m3d-c-n">–</b><span>vídeos</span></div>
    <div><b class="m3d-c-vis">–</b><span>visualizaciones</span></div>
    <div><b class="m3d-c-lk">–</b><span>me gusta</span></div>
  </div>

  <div class="m3d-medio">
    <p class="m3d-aviso">Cargando el mapa…</p>
    <div class="m3d-reloj" hidden aria-hidden="true">
      <span class="m3d-reloj-et">Publicados hasta el</span><b class="m3d-reloj-fecha">–</b>
      <div class="m3d-reloj-barra"><i></i></div>
    </div>
    <aside class="m3d-ficha" hidden aria-labelledby="${u}-ft">
      <div class="m3d-ficha-cab">
        <span class="m3d-etq-red m3d-f-red"><i></i><span></span></span><span class="m3d-etq-tipo m3d-f-tipo"></span>
        <button class="m3d-x m3d-f-x" type="button" aria-label="Cerrar la ficha">${ICO.cerrar}</button>
      </div>
      <h2 class="m3d-f-titulo" id="${u}-ft" tabindex="-1"></h2>
      <p class="m3d-ficha-fecha m3d-f-fecha"></p>
      <dl class="m3d-cifras">
        <div><dt>Visualizaciones</dt><dd class="m3d-f-vis"></dd></div>
        <div><dt>Me gusta</dt><dd class="m3d-f-lk"></dd></div>
      </dl>
      <p class="m3d-puesto"></p>
      <div class="m3d-misma" hidden><p>La misma pieza en</p><div></div></div>
      <a class="m3d-btn m3d-primario m3d-ver" href="#" target="_blank" rel="noopener">Ver el vídeo ↗</a>
    </aside>
  </div>

  <div class="m3d-ley">
    <div class="m3d-ley-cuerpo" id="${u}-ley">
      <section><h3 class="m3d-ley-color-t">Color = red</h3><ul class="m3d-ley-colores"></ul></section>
      <section><ul class="m3d-ley-formas">
        <li>${ICO.short}<span>Short o reel</span></li>
        <li>${ICO.largo}<span>Vídeo largo de YouTube (más de 3 min)</span></li>
        <li>${ICO.tam}<span class="m3d-ley-tam"></span></li>
      </ul></section>
      <section><p class="m3d-ley-modo"></p><p class="m3d-ley-enlaces"></p></section>
      <section>
        <p>Visualizaciones y me gusta de cada vídeo público, tal como estaban al generar el mapa.</p>
        <p class="m3d-ley-fuente">Datos: YouTube API y Metricool · –</p>
      </section>
    </div>
    <button class="m3d-ley-btn" type="button" aria-expanded="true" aria-controls="${u}-ley">Leyenda ${ICO.chevron}</button>
  </div>
</div>

<div class="m3d-tooltip" hidden aria-hidden="true"></div>
<div class="m3d-fondo-ajustes" hidden></div>
<aside class="m3d-ajustes" id="${u}-aj" hidden role="dialog" aria-labelledby="${u}-ajt">
  <div class="m3d-aj-cab"><h2 id="${u}-ajt">Ajustes del mapa</h2><button class="m3d-x m3d-aj-x" type="button" aria-label="Cerrar los ajustes del mapa">${ICO.cerrar}</button></div>
  <div class="m3d-aj-cuerpo"></div>
  <div class="m3d-aj-pie"><button class="m3d-btn m3d-aj-reset" type="button">Restablecer</button><p class="m3d-aj-estado" aria-live="polite"></p></div>
</aside>`;
  }

  function montarAjustes() {
    el.ajCuerpo.innerHTML = Object.entries(OPC).map(([k, g]) => `
      <fieldset class="m3d-aj-grupo"><legend>${g.t}</legend>
        <div class="m3d-aj-seg${k === "colores" ? " m3d-aj-colores" : ""}">${g.o.map(([v, t]) => `
          <label><input type="radio" name="${uid}-${k}" value="${v}"${aj[k] === v ? " checked" : ""}><span>${k === "colores" ? muestra(v) : ""}${t}</span></label>`).join("")}
        </div>
      </fieldset>`).join("") +
      `<p class="m3d-aj-nota" hidden>Tu sistema pide menos movimiento: la autorrotación y las animaciones quedan paradas.</p>`;
    escuchar(el.ajCuerpo, "change", e => {
      const i = e.target; if (!i.name || !i.name.startsWith(uid + "-")) return;
      aj[i.name.slice(uid.length + 1)] = i.value; aplicarAjuste(i.name.slice(uid.length + 1));
    });
    raiz.querySelector(".m3d-aj-nota").hidden = !reduceMov.matches;
  }
  function muestra(v) {
    const p = v === "panel" ? paletaPanel(tema) : PALETAS[v];
    const tex = p.tex ? `;--m-tex:url('${texUrl(p.tex)}')` : "";
    return `<i class="m3d-muestra" data-m="${v}" style="--m1:${p.muestra[0]};--m2:${p.muestra[1]}${tex}" aria-hidden="true"></i>`;
  }
  function pintarMuestraPanel() {
    const i = raiz.querySelector('.m3d-muestra[data-m="panel"]'); if (!i) return;
    const p = paletaPanel(tema); i.style.setProperty("--m1", p.muestra[0]); i.style.setProperty("--m2", p.muestra[1]);
  }
  function marcarAjustes() { for (const k in aj) raiz.querySelectorAll(`input[name="${uid}-${k}"]`).forEach(i => { i.checked = i.value === aj[k]; }); }

  function abrirAjustes() {
    ajustesAbiertos = true;
    if (!estrecho()) {                                            // debajo de su botón, dentro del contenedor
      const rr = raiz.getBoundingClientRect(), b = el.btnAj.getBoundingClientRect();
      el.ajustes.style.top = Math.round(b.bottom - rr.top + 8) + "px";
      el.ajustes.style.maxHeight = Math.max(200, Math.round(H - (b.bottom - rr.top) - 20)) + "px";
    } else { el.ajustes.style.top = ""; el.ajustes.style.maxHeight = ""; }
    el.ajustes.hidden = false; el.fondoAj.hidden = false;
    el.btnAj.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => el.ajustes.classList.add("m3d-abierto"));
    const m = el.ajustes.querySelector("input:checked"); if (m) m.focus({ preventScroll: true });
  }
  function cerrarAjustes() {
    if (!ajustesAbiertos) return;
    ajustesAbiertos = false; el.ajustes.classList.remove("m3d-abierto"); el.fondoAj.hidden = true;
    el.btnAj.setAttribute("aria-expanded", "false");
    setTimeout(() => { if (!ajustesAbiertos) el.ajustes.hidden = true; }, reduceMov.matches ? 0 : 280);
    el.btnAj.focus({ preventScroll: true });
  }
  function restablecer() {
    Object.assign(aj, AJ_DEF); marcarAjustes(); aplicarAjuste("*");
    el.ajEstado.textContent = "Ajustes del mapa restablecidos.";
  }
  function aplicarAjuste(k) {
    guardar();
    if (k !== "*") el.ajEstado.textContent = "";
    if (k === "*" || k === "colores") aplicarColores();
    if (!listo) return;
    if (k === "*" || k === "brillo" || k === "color") temaEscena();
    if (k === "*" || k === "tam") tamanos();
    if (k === "*" || k === "enlaces") enlaces.obj.visible = aj.enlaces === "si";
    if (k === "*" || k === "rotar") controles.autoRotate = rotacionPermitida();
    leyenda(); contar(); sucio = true;
  }

  /* letras del panel anfitrión (los títulos pueden ir con `letraTitulos`; si no, con la del texto) */
  function aplicarLetras() {
    const txt = tema.letraTexto || "system-ui, -apple-system, 'Segoe UI', sans-serif";
    raiz.style.setProperty("--m3d-f-txt", txt);
    raiz.style.setProperty("--m3d-f-tit", tema.letraTitulos || txt);
    raiz.style.setProperty("--m3d-f-num", tema.letraCifras || "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace");
    for (const e of ETIQ) e.w = 0;
  }
  /* colores: variables CSS de la interfaz y, si la escena ya existe, su fondo, estrellas y líneas */
  function aplicarColores() {
    pal = aj.colores === "panel" ? paletaPanel(tema) : PALETAS[aj.colores] || PALETAS.noche;
    const s = raiz.style, v = { escena: pal.escena, vineta: pal.vineta, "vineta-a": pal.vinetaA, sup: pal.sup, "sup-maciza": pal.maciza, sup2: pal.sup2,
      borde: pal.borde, borde2: pal.borde2, tinta: pal.tinta, tinta2: pal.tinta2, tinta3: pal.tinta3, sel: pal.sel, sombra: pal.sombra, "sombra-a": pal.sombraA, etiqueta: pal.etiqueta };
    for (const k in v) s.setProperty("--m3d-" + k, String(v[k]));
    s.backgroundImage = pal.tex ? `url('${texUrl(pal.tex)}')` : "none";
    raiz.dataset.claro = pal.claro ? "si" : "no";
    raiz.dataset.estrellas = pal.estrellas;
    pintarMuestraPanel();
    if (listo) { temaEscena(); leyenda(); }
  }

  function conectarInterfaz() {
    escuchar(el.btnAj, "click", () => ajustesAbiertos ? cerrarAjustes() : abrirAjustes());
    escuchar(el.ajX, "click", cerrarAjustes);
    escuchar(el.fondoAj, "click", cerrarAjustes);
    escuchar(el.ajReset, "click", restablecer);
    escuchar(el.fX, "click", () => cerrarFicha(true));
    escuchar(el.leyBtn, "click", () => leyendaAbierta(el.leyBtn.getAttribute("aria-expanded") !== "true", true));
    escuchar(el.modo, "click", e => { const b = e.target.closest("button[data-modo]"); if (b) cambiarModo(b.dataset.modo); });
    escuchar(el.centrar, "click", () => volverAVista());
    escuchar(el.play, "click", () => repro.activa ? pararRepro() : empezarRepro());
    // Esc solo cuando el foco está dentro del mapa (no pisa el Esc del panel)
    escuchar(raiz, "keydown", e => {
      if (e.key !== "Escape") return;
      if (ajustesAbiertos) { cerrarAjustes(); e.stopPropagation(); return; }
      if (!el.res.hidden) { mostrarResultados(false); e.stopPropagation(); return; }
      if (sel) { cerrarFicha(true); e.stopPropagation(); }
    });
    escuchar(document, "pointerdown", e => { if (!el.busca.contains(e.target)) mostrarResultados(false); });
    escuchar(reduceMov, "change", () => { raiz.querySelector(".m3d-aj-nota").hidden = !reduceMov.matches; if (listo) controles.autoRotate = rotacionPermitida(); });
    const finFila = () => el.filtros.classList.toggle("m3d-al-final", el.filtros.scrollLeft + el.filtros.clientWidth >= el.filtros.scrollWidth - 2);
    escuchar(el.filtros, "scroll", finFila, { passive: true }); finFila();
  }
  function leyendaAbierta(si, reencuadrar) {
    el.leyBtn.setAttribute("aria-expanded", String(si));
    el.leyCuerpo.classList.toggle("m3d-cerrada", !si);
    el.leyCuerpo.setAttribute("aria-hidden", String(!si));
    el.leyCuerpo.inert = !si;
    if (listo && reencuadrar) encuadrar(false);
  }
  function marcarModo() {
    raiz.dataset.modo = MODO;
    el.modo.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.modo === MODO)));
  }

  /* ══════════════════════════ datos ══════════════════════════ */
  function montar() {
    const nodos = (D.nodos || []).filter(n => RED[n.red]).slice().sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
    if (!nodos.length) { el.aviso.textContent = "Todavía no hay vídeos en mapa_videos.json."; return; }
    S = nodos.map((n, i) => ({
      i, n, red: n.red, tipo: TIPOS.includes(n.tipo) ? n.tipo : (n.red === "youtube" ? "short" : "reel"),
      v: Math.max(0, +n.vis || 0), l: Math.max(0, +n.likes || 0), tn: norm(n.titulo),
      t: Date.parse((n.fecha || "").replace(" ", "T")) || 0, grupo: n.grupo || null,
      pos: null, a: 0, k: 0, lit: true, match: false, aparece: 0, d: 1,
    }));
    for (const red of REDES) {
      const L = S.filter(s => s.red === red);
      for (const s of L) { s.puesto = 1 + L.filter(o => o.v > s.v).length; s.totalRed = L.length; }
    }
    vMax = Math.max(1, ...S.map(s => s.v)); lMax = Math.max(1, ...S.map(s => s.l));
    el.leyFuente.textContent = `Datos: YouTube API y Metricool · ${fecha(D.generado)}${hora(D.generado) ? ", " + hora(D.generado) : ""}`;
    montarFiltros();
    try { crearMotor(); }
    catch (e) {
      el.aviso.classList.add("m3d-error");
      el.aviso.textContent = "Este navegador no puede pintar el mapa en 3D (hace falta WebGL).";
      console.warn("Mapa de vídeos:", e); return;
    }
    el.aviso.hidden = true;
    el.play.disabled = false;
    listo = true;
    construirEscena();
    leyenda(); aplicarFiltros();
    if (!pausado) raf = requestAnimationFrame(bucle);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!destruido) { for (const e of ETIQ) e.w = 0; encuadrar(false); } });
  }

  function montarFiltros() {
    const cuenta = r => S.filter(s => s.red === r).length;
    el.chips.innerHTML = REDES.map(r => `<button type="button" class="m3d-chip" data-red="${r}" aria-pressed="true" style="--c:${RED[r].color}">
        <i></i><span>${RED[r].nombre}</span><b>${fmt(cuenta(r))}</b></button>`).join("");
    const nTipo = t => t === "todos" ? S.length : S.filter(s => s.tipo === t).length;
    el.tipos.innerHTML = FILTRO_TIPO.map(([t, nombre]) => `<label><input type="radio" name="${uid}-tipo" value="${t}"${t === "todos" ? " checked" : ""}>
        <span>${nombre} <b>${fmt(nTipo(t))}</b></span></label>`).join("");
    escuchar(el.chips, "click", e => {
      const b = e.target.closest(".m3d-chip"); if (!b) return;
      const r = b.dataset.red, on = !filtro.redes.has(r);
      on ? filtro.redes.add(r) : filtro.redes.delete(r);
      b.setAttribute("aria-pressed", String(on));
      aplicarFiltros();
    });
    escuchar(el.tipos, "change", e => { filtro.tipo = e.target.value; aplicarFiltros(); });
    let espera = 0;
    escuchar(el.q, "input", () => {
      clearTimeout(espera);
      espera = setTimeout(() => { if (destruido) return; filtro.q = el.q.value; aplicarFiltros(); mostrarResultados(!!filtro.toks.length); }, 120);
      el.qx.hidden = !el.q.value;
    });
    escuchar(el.q, "focus", () => { if (filtro.toks.length) mostrarResultados(true); });
    escuchar(el.q, "keydown", e => {
      if (e.key === "ArrowDown") { const b = el.res.querySelector("button"); if (b) { e.preventDefault(); b.focus(); } }
    });
    escuchar(el.qx, "click", () => { el.q.value = ""; el.qx.hidden = true; filtro.q = ""; aplicarFiltros(); mostrarResultados(false); el.q.focus(); });
    escuchar(el.res, "keydown", e => {
      const bs = [...el.res.querySelectorAll("button")], i = bs.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && i < bs.length - 1) { e.preventDefault(); bs[i + 1].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? bs[i - 1] : el.q).focus(); }
    });
  }

  function aplicarFiltros() {
    filtro.toks = norm(filtro.q).split(/\s+/).filter(Boolean);
    for (const s of S) {
      const ok = filtro.redes.has(s.red) && (filtro.tipo === "todos" || s.tipo === filtro.tipo);
      s.match = filtro.toks.length > 0 && filtro.toks.every(t => s.tn.includes(t));
      s.lit = ok && (!filtro.toks.length || s.match);
    }
    pintarResultados(); contar();
    if (hover && !hover.lit) { hover = null; ocultarTooltip(); }
    sucio = true;
  }
  function contar() {
    let n = 0, vis = 0, lk = 0;
    const porRed = Object.fromEntries(REDES.map(r => [r, 0])), totalRed = Object.fromEntries(REDES.map(r => [r, 0]));
    for (const s of S) {
      totalRed[s.red]++;
      if (!s.lit || (repro.activa && s.i > repro.hasta)) continue;
      n++; vis += s.v; lk += s.l; porRed[s.red]++;
    }
    el.cN.textContent = fmt(n); el.cVis.textContent = fmt(vis); el.cLk.textContent = fmt(lk);
    for (const r of REDES) {
      const z = zona[r]; if (!z || !z.lblN) continue;
      const txt = porRed[r] === totalRed[r] ? fmt(totalRed[r]) : `${fmt(porRed[r])} de ${fmt(totalRed[r])}`;
      if (z.lblN.textContent !== txt) { z.lblN.textContent = txt; const e = ETIQ.find(x => x.red === r); if (e) e.w = 0; }
    }
    if (listo) el.escena.setAttribute("aria-label", `Mapa 3D (${MODO}) de ${plural(n, "vídeo", "vídeos")} de TodoEnRecambio: ${fmt(vis)} visualizaciones y ${fmt(lk)} me gusta. Usa el buscador para abrir la ficha de un vídeo.`);
  }
  function pintarResultados() {
    const caja = el.res;
    caja.innerHTML = "";
    if (!filtro.toks.length) return;
    const L = S.filter(s => s.lit).sort((a, b) => b.v - a.v);
    const p = document.createElement("p"); p.className = "m3d-res-n";
    p.textContent = L.length ? `${plural(L.length, "coincidencia", "coincidencias")}${L.length > 6 ? " · las 6 más vistas" : ""}` : "Sin coincidencias con los filtros elegidos.";
    caja.appendChild(p);
    const ul = document.createElement("ul");
    for (const s of L.slice(0, 6)) {
      const li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.style.setProperty("--c", RED[s.red].color);
      const i = document.createElement("i"), t = document.createElement("span"), m = document.createElement("span");
      t.className = "m3d-res-t"; t.textContent = s.n.titulo || "(sin título)";
      m.className = "m3d-res-m"; m.textContent = `${RED[s.red].nombre} · ${fecha(s.n.fecha)} · ${fmt(s.n.vis)} vis.`;
      b.append(i, t, m);
      b.addEventListener("click", () => { mostrarResultados(false); seleccionar(s, true); });
      li.appendChild(b); ul.appendChild(li);
    }
    caja.appendChild(ul);
  }
  function mostrarResultados(si) {
    el.res.hidden = !si || !filtro.toks.length;
    el.q.setAttribute("aria-expanded", String(!el.res.hidden));
  }

  /* ══════════════════════════ motor (se crea una vez) ══════════════════════════ */
  function crearMotor() {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.NoToneMapping;
    el.escena.appendChild(renderer.domElement);

    etiquetas = new CSS2DRenderer();
    etiquetas.setSize(W, H);
    etiquetas.domElement.className = "m3d-etiquetas";
    el.escena.appendChild(etiquetas.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, W / H, 0.5, 6000);
    crearTexturas();
    texLogo = new THREE.TextureLoader().load(urlLogo, () => { sucio = true; });
    texLogo.colorSpace = THREE.SRGBColorSpace;
    texLogo.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // composición: el bloom se calcula aparte solo con la capa que brilla (el logo real queda tal cual)
    const muestras = renderer.capabilities.isWebGL2 && pr < 2 ? 4 : 0;
    compFinal = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: muestras }));
    compFinal.setPixelRatio(pr);
    compFinal.addPass(new RenderPass(scene, camera));
    compBrillo = new EffectComposer(renderer);
    compBrillo.renderToScreen = false;
    compBrillo.setPixelRatio(pr * 0.5);
    compBrillo.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.5, 0.3, 0);
    compBrillo.addPass(bloom);
    // se suma solo el resplandor (renderTargetsHorizontal[0] = mezcla de los desenfoques), no los objetos otra vez
    mezcla = new ShaderPass(new THREE.ShaderMaterial({
      uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloom.renderTargetsHorizontal[0].texture }, fuerza: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform sampler2D baseTexture; uniform sampler2D bloomTexture; uniform float fuerza; varying vec2 vUv;" +
        "void main() { gl_FragColor = texture2D(baseTexture, vUv) + fuerza * vec4(texture2D(bloomTexture, vUv).rgb, 0.0); }",
    }), "baseTexture");
    mezcla.needsSwap = true;
    compFinal.addPass(mezcla);
    compFinal.addPass(new OutputPass());
    compFinal.setSize(W, H);
    compBrillo.setSize(W, H);

    controles = new OrbitControls(camera, renderer.domElement);
    controles.enableDamping = true; controles.dampingFactor = 0.08;
    controles.rotateSpeed = 0.7; controles.zoomSpeed = 0.9;
    controles.autoRotateSpeed = 0.55;
    controles.addEventListener("start", () => { ultimaInteraccion = ahoraMs; controles.autoRotate = false; });
    controles.addEventListener("change", () => { sucio = true; });
    pv = new THREE.Vector3();
    conectarPuntero();
  }

  /* lo que depende del modo (globo o galaxia): se vacía y se vuelve a hacer al cambiar, sin volver a pedir los datos */
  function construirEscena() {
    camera.fov = MODO === "globo" ? 40 : 34;
    camera.updateProjectionMatrix();
    crearEstrellas();
    if (MODO === "globo") montarGlobo(); else montarGalaxia();
    crearLogo();
    crearEnlaces();
    reticula = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.reticula, color: ROJO_TDR, transparent: true, depthTest: false, depthWrite: false }));
    reticula.renderOrder = 10; reticula.visible = false; scene.add(reticula);
    temaEscena(); tamanos();
    enlaces.obj.visible = aj.enlaces === "si";
    desplaz.listo = false;
    encuadrar(true);
    controles.autoRotate = rotacionPermitida();
    ultimaInteraccion = -1e9;
    // entrada: las estrellas aparecen por orden de fecha en poco más de un segundo (sin animación si se pide menos movimiento)
    const t0 = performance.now() + 150;
    for (const s of S) { s.a = 0; s.k = 0; s.aparece = reduceMov.matches ? 0 : t0 + 1100 * (s.i / S.length); }
    prepararRepro();
    contar();
    sucio = true;
  }
  function vaciarEscena() {
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    scene.clear();                                                // las etiquetas CSS2D se quitan solas del DOM al salir de la escena
    lineas = []; enlaces = null; puntosBase = null; refRejilla = []; refRed = []; puntosEncuadre = [];
    ETIQ.length = 0; for (const k of Object.keys(zona)) delete zona[k];
    logo = logoOcl = halo = reticula = anilloRepro = null;
    for (const s of S) { s.spr = null; s.mat = null; }
  }
  function cambiarModo(m) {
    if (m !== "globo" && m !== "galaxia") return;
    if (m === MODO) { marcarModo(); return; }
    MODO = m; marcarModo(); guardar();
    if (!listo) return;
    if (repro.activa) pararRepro();
    if (sel) cerrarFicha(false);
    hover = null; ocultarTooltip(); vuelo = null;
    vaciarEscena(); construirEscena(); leyenda(); aplicarFiltros();
  }

  function lienzo(T, dibuja) {
    const c = document.createElement("canvas"); c.width = c.height = T;
    dibuja(c.getContext("2d"), T / 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function crearTexturas() {
    const PI2 = Math.PI * 2;
    // estrella que brilla: núcleo (≈ 48 % del sprite) y resplandor corto (el resto lo pone el bloom); el vídeo largo lleva anillo
    const brillo = (g, r, anillo) => {
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,1)");
      gr.addColorStop(0.42, "rgba(255,255,255,0.75)"); gr.addColorStop(0.5, "rgba(255,255,255,0.4)");
      gr.addColorStop(0.62, "rgba(255,255,255,0.12)"); gr.addColorStop(0.8, "rgba(255,255,255,0.03)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 2 * r, 2 * r);
      if (anillo) { g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = r * 0.06; g.beginPath(); g.arc(r, r, r * 0.8, 0, PI2); g.stroke(); }
    };
    // estrella en papel: disco con borde del mismo tono más oscuro y sombra suave
    const disco = (g, r, anillo) => {
      const sh = g.createRadialGradient(r, r, r * 0.42, r, r, r * 0.72);
      sh.addColorStop(0, "rgba(0,0,0,0.20)"); sh.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sh; g.fillRect(0, 0, 2 * r, 2 * r);
      const rd = anillo ? r * 0.4 : r * 0.48;
      g.fillStyle = "#fff"; g.beginPath(); g.arc(r, r, rd, 0, PI2); g.fill();
      g.strokeStyle = "rgb(92,92,92)"; g.lineWidth = r * 0.07; g.beginPath(); g.arc(r, r, rd - r * 0.035, 0, PI2); g.stroke();
      if (anillo) { g.strokeStyle = "rgb(105,105,105)"; g.lineWidth = r * 0.08; g.beginPath(); g.arc(r, r, r * 0.74, 0, PI2); g.stroke(); }
    };
    TEX.luz = lienzo(128, (g, r) => brillo(g, r, false));
    TEX.luzLargo = lienzo(128, (g, r) => brillo(g, r, true));
    TEX.disco = lienzo(128, (g, r) => disco(g, r, false));
    TEX.discoLargo = lienzo(128, (g, r) => disco(g, r, true));
    TEX.punto = lienzo(64, (g, r) => {
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.42, "rgba(255,255,255,0.95)");
      gr.addColorStop(0.6, "rgba(255,255,255,0.25)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 2 * r, 2 * r);
    });
    TEX.halo = lienzo(256, (g, r) => {
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.3, "rgba(255,255,255,0.5)");
      gr.addColorStop(0.55, "rgba(255,255,255,0.16)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 2 * r, 2 * r);
    });
    TEX.reticula = lienzo(256, (g, r) => {
      g.strokeStyle = "#fff"; g.lineCap = "round";
      g.lineWidth = r * 0.045; g.beginPath(); g.arc(r, r, r * 0.62, 0, PI2); g.stroke();
      g.lineWidth = r * 0.07;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        g.beginPath(); g.moveTo(r + Math.cos(a) * r * 0.74, r + Math.sin(a) * r * 0.74); g.lineTo(r + Math.cos(a) * r * 0.94, r + Math.sin(a) * r * 0.94); g.stroke();
      }
    });
    TEX.suelo = lienzo(256, (g, r) => {
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(0.5, "rgba(255,255,255,0.18)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 2 * r, 2 * r);
    });
  }
  /* fondo de papel dentro de WebGL (cubre el contenedor sin deformarse, como background-size: cover) */
  function fondoEscena() {
    if (!pal.tex) return new THREE.Color(pal.escena);
    if (!fondos[pal.tex]) {
      const t = new THREE.TextureLoader().load(texUrl(pal.tex), () => { ajustarFondo(); sucio = true; });
      t.colorSpace = THREE.SRGBColorSpace;
      fondos[pal.tex] = t;
    }
    return fondos[pal.tex];
  }
  function ajustarFondo() {
    const t = scene && scene.background; if (!t || !t.isTexture) return;
    const ia = t.image && t.image.width ? t.image.width / t.image.height : 1, ca = W / H;
    if (ca > ia) { t.repeat.set(1, ia / ca); t.offset.set(0, (1 - ia / ca) / 2); }
    else { t.repeat.set(ca / ia, 1); t.offset.set((1 - ca / ia) / 2, 0); }
  }

  /* tamaño del núcleo (unidades de escena) ∝ raíz de visualizaciones o de me gusta, acotado */
  function crearEstrellas() {
    const [DMIN, DMAX] = MODO === "globo" ? [1.2, 5.6] : [1.15, 4.6];
    const grupo = new THREE.Group(); scene.add(grupo);
    for (const s of S) {
      s.pos = new THREE.Vector3();
      s.dVis = DMIN + (DMAX - DMIN) * Math.sqrt(s.v / vMax);
      s.dLk = DMIN + (DMAX - DMIN) * Math.sqrt(s.l / lMax);
      s.mat = new THREE.SpriteMaterial({ map: TEX.luz, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      s.spr = new THREE.Sprite(s.mat);
      s.spr.layers.enable(CAPA); s.spr.visible = false;
      grupo.add(s.spr);
    }
  }
  function tamanos() { for (const s of S) s.d = aj.tam === "likes" ? s.dLk : s.dVis; sucio = true; }
  function colorDe(s) { return aj.color === "tipo" ? COLOR_TIPO[pal.claro ? "claro" : "oscuro"][s.tipo] : RED[s.red].color; }

  function crearLogo() {
    const LD = MODO === "globo" ? R * 0.34 : R0 * 1.4;
    const pos = new THREE.Vector3(0, MODO === "globo" ? 0 : LD * 0.5 + 0.6, 0);
    // el halo va antes que el logo y el logo escribe profundidad: lo que está detrás no lo pisa y lo que está delante sí
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.halo, color: ROJO_TDR, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4 }));
    halo.position.copy(pos); halo.scale.setScalar(LD * 2.5); halo.renderOrder = -2;
    logo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLogo, transparent: true, depthWrite: true, alphaTest: 0.02 }));
    logo.position.copy(pos); logo.scale.setScalar(LD); logo.renderOrder = -1;
    // en la pasada del brillo el logo es un disco negro: tapa el halo y lo que queda detrás, y no brilla
    logoOcl = new THREE.Sprite(new THREE.SpriteMaterial({ map: texLogo, color: 0x000000, transparent: true, depthWrite: true, alphaTest: 0.5 }));
    logoOcl.position.copy(pos); logoOcl.scale.setScalar(LD); logoOcl.renderOrder = -1; logoOcl.layers.set(CAPA);
    scene.add(halo, logo, logoOcl);
    logo.userData.radio = LD * 0.5;
  }

  /* líneas con alfa por vértice. tramo = { p: [Vector3...], vis: () => 0..1, color: (c0, c1) => void, alfa: u => 0..1 } */
  function conjunto(tramos, brilla = true) {
    let nv = 0;
    for (const t of tramos) { t.v0 = nv; nv += (t.p.length - 1) * 2; }
    const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 4);
    for (const t of tramos) {
      let k = t.v0;
      for (let j = 0; j < t.p.length - 1; j++) for (let qq = j; qq <= j + 1; qq++) { const p = t.p[qq]; pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; k++; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
    geo.computeBoundingSphere();
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const obj = new THREE.LineSegments(geo, mat);
    if (brilla) obj.layers.enable(CAPA);
    scene.add(obj);
    const c0 = new THREE.Color(), c1 = new THREE.Color(), cc = new THREE.Color();
    const cj = {
      obj, mat, factor: 1,
      pintar() {
        for (const t of tramos) {
          const f = t.vis() * cj.factor; t.color(c0, c1);
          const n = t.p.length - 1; let k = t.v0;
          for (let j = 0; j < n; j++) for (let qq = j; qq <= j + 1; qq++) {
            const u = qq / n; cc.copy(c0).lerp(c1, u);
            col[k * 4] = cc.r; col[k * 4 + 1] = cc.g; col[k * 4 + 2] = cc.b; col[k * 4 + 3] = t.alfa(u) * f; k++;
          }
        }
        geo.attributes.color.needsUpdate = true;
      },
    };
    lineas.push(cj);
    return cj;
  }
  function lineasSimples(puntos, opacidad, cerrar = false) {     // rejilla, anillos y bordes de zona (no brillan)
    const geo = new THREE.BufferGeometry().setFromPoints(puntos);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: opacidad, depthWrite: false });
    const obj = cerrar ? new THREE.LineLoop(geo, mat) : new THREE.LineSegments(geo, mat);
    obj.userData.opacidad = opacidad;
    scene.add(obj);
    return obj;
  }

  /* ─────────── GLOBO: constelación en una esfera ─────────── */
  function montarGlobo() {
    const GA = Math.PI * (3 - Math.sqrt(5)), HUECO = 1.8, PASO = 0.26;
    let rMin = Infinity;
    for (const s of S) { s.rho = Math.max(s.dVis, s.dLk) / 2 + HUECO / 2; rMin = Math.min(rMin, s.rho); }
    // 1) reparto en el plano por red: candidatos en espiral de Fibonacci; cada estrella (de más a menos vista) toma el primer hueco libre
    const plano = {};
    for (const red of REDES) {
      const L = S.filter(s => s.red === red).sort((a, b) => b.v - a.v || a.i - b.i);
      if (!L.length) { plano[red] = { L, ext: 0 }; continue; }
      const celda = 2 * Math.max(...L.map(s => s.rho));
      const rej = new Map();
      const libre = (x, y, rho) => {
        const cx = Math.floor(x / celda), cy = Math.floor(y / celda);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const b = rej.get((cx + dx) + "," + (cy + dy));
          if (b) for (const o of b) if (Math.hypot(o.px - x, o.py - y) < o.rho + rho) return false;
        }
        return true;
      };
      const cx = m => PASO * Math.sqrt(m) * Math.cos(m * GA), cy = m => PASO * Math.sqrt(m) * Math.sin(m * GA);
      let primero = 0, ext = 0;
      for (const s of L) {
        while (!libre(cx(primero), cy(primero), rMin)) primero++;
        let m = primero;
        while (!libre(cx(m), cy(m), s.rho)) m++;
        s.px = cx(m); s.py = cy(m);
        const k = Math.floor(s.px / celda) + "," + Math.floor(s.py / celda);
        if (!rej.has(k)) rej.set(k, []); rej.get(k).push(s);
        ext = Math.max(ext, Math.hypot(s.px, s.py) + s.rho);
      }
      plano[red] = { L, ext };
    }
    // 2) radio de la esfera: el casquete de YouTube (la red con más vídeos) abarca ~40°
    const extMax = Math.max(...REDES.map(r => plano[r].ext), 8);
    R = extMax / (2 * Math.sin(RAD(40) / 2));
    // 3) casquetes (latitud, longitud): la cámara empieza mirando a la longitud 0, con el centro (el logo) despejado
    const CENTRO = { youtube: [10, -56], tiktok: [26, 50], instagram: [-24, 56], facebook: [4, 94] };
    const dir = (lat, lon) => { const a = RAD(lat), o = RAD(lon); return new THREE.Vector3(Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)); };
    const arriba = new THREE.Vector3(0, 1, 0);
    for (const red of REDES) {
      const c = dir(...CENTRO[red]);
      const u = new THREE.Vector3().crossVectors(arriba, c).normalize(), v = new THREE.Vector3().crossVectors(c, u);
      const ang = 2 * Math.asin(Math.min(1, plano[red].ext / (2 * R)));
      for (const s of plano[red].L) {
        const r = Math.hypot(s.px, s.py), phi = Math.atan2(s.py, s.px);
        const th = 2 * Math.asin(Math.min(1, r / (2 * R)));        // proyección de igual área (Lambert) sobre la esfera
        s.pos.copy(c).multiplyScalar(Math.cos(th)).addScaledVector(u, Math.sin(th) * Math.cos(phi)).addScaledVector(v, Math.sin(th) * Math.sin(phi)).multiplyScalar(R);
      }
      zona[red] = { c, u, v, ang, nodo: c.clone().multiplyScalar(R * 0.52), n: plano[red].L.length };
    }
    for (const s of S) s.spr.position.copy(s.pos);

    const pts = [], Rg = R * 0.985;
    for (const lat of [-60, -30, 0, 30, 60]) for (let k = 0; k < 72; k++) pts.push(dir(lat, k * 5).multiplyScalar(Rg), dir(lat, (k + 1) * 5).multiplyScalar(Rg));
    for (let lon = 0; lon < 360; lon += 30) for (let lat = -80; lat < 80; lat += 5) pts.push(dir(lat, lon).multiplyScalar(Rg), dir(lat + 5, lon).multiplyScalar(Rg));
    refRejilla.push(lineasSimples(pts, 0.07));

    const radios = [], ejes = [];
    for (const red of REDES) {
      const z = zona[red]; if (!z.n) continue;
      const a = z.ang + RAD(2.5), borde = [];
      for (let k = 0; k <= 96; k++) {
        const t = k / 96 * Math.PI * 2;
        borde.push(z.c.clone().multiplyScalar(Math.cos(a)).addScaledVector(z.u, Math.sin(a) * Math.cos(t)).addScaledVector(z.v, Math.sin(a) * Math.sin(t)).multiplyScalar(R * 1.004));
      }
      const lb = lineasSimples(borde, 0.34, true); lb.userData.red = red; refRed.push(lb);
      const nodo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.punto, color: RED[red].color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      nodo.position.copy(z.nodo); nodo.scale.setScalar(2.6); nodo.layers.enable(CAPA); scene.add(nodo); z.sprNodo = nodo;
      ejes.push({ p: [z.c.clone().multiplyScalar(R * 0.17), z.nodo], vis: () => filtro.redes.has(red) ? 1 : 0.3,
        color: (c0, c1) => { c0.set(ROJO_TDR); c1.set(RED[red].color); }, alfa: () => 0.55 });
      etiquetaRed(red, z.nodo);
    }
    for (const s of S) {
      const z = zona[s.red];
      radios.push({ p: [s.pos, z.nodo], vis: () => s.a, color: (c0, c1) => { c0.set(colorDe(s)); c1.copy(c0); }, alfa: u => 0.16 * (1 - 0.8 * u) });
    }
    conjunto(radios); conjunto(ejes);
    for (let k = 0; k < 96; k++) {
      const y = 1 - 2 * (k + 0.5) / 96, rr = Math.sqrt(1 - y * y), a = k * Math.PI * (3 - Math.sqrt(5));
      puntosEncuadre.push(new THREE.Vector3(rr * Math.cos(a), y, rr * Math.sin(a)).multiplyScalar(R * 1.1));
    }
  }

  /* ─────────── GALAXIA: un brazo por red; distancia = orden de publicación, altura = visualizaciones ─────────── */
  function montarGalaxia() {
    for (const s of S) {
      const r = radioDe(s.i);
      const jit = ((s.i * 0.6180339887) % 1 - 0.5) * 4.8;
      const th = anguloDe(s.red, r) + jit / r;
      s.h = Math.max(0.6, HMAX * Math.sqrt(s.v / vMax));
      s.base = new THREE.Vector3(r * Math.cos(th), 0, r * Math.sin(th));
      s.pos.set(s.base.x, s.h, s.base.z);
      s.spr.position.copy(s.pos);
    }
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(R1 + 14, 96), new THREE.MeshBasicMaterial({ map: TEX.suelo, transparent: true, depthWrite: false, opacity: 0.1 }));
    suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.05; scene.add(suelo); refRejilla.push(suelo); suelo.userData.opacidad = 0.1;

    const guias = [];
    for (const red of REDES) {
      const p = [];
      for (let k = 0; k <= 160; k++) { const r = R0 + (R1 - R0) * k / 160; const th = anguloDe(red, r); p.push(new THREE.Vector3(r * Math.cos(th), 0, r * Math.sin(th))); }
      guias.push({ p, vis: () => filtro.redes.has(red) ? 1 : 0.35, color: (c0, c1) => { c0.set(RED[red].color); c1.copy(c0); }, alfa: u => 0.10 + 0.14 * u });
      const rE = R1 + 7, thE = anguloDe(red, rE);
      zona[red] = { n: S.filter(s => s.red === red).length };
      etiquetaRed(red, new THREE.Vector3(rE * Math.cos(thE), 0, rE * Math.sin(thE)));
    }
    conjunto(guias, false);

    conjunto(S.map(s => ({ p: [s.base, s.pos], vis: () => s.a, color: (c0, c1) => { c0.set(colorDe(s)); c1.copy(c0); }, alfa: u => 0.07 + 0.5 * u })));
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(S.flatMap(s => [s.base.x, 0.02, s.base.z])), 3));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(S.length * 4), 4));
    puntosBase = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.5, map: TEX.punto, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(puntosBase);

    // anillos: los cuatro últimos meses con vídeos y el primer mes con vídeos de cada año, sin pisarse (gana el más reciente)
    const inicios = [];
    let prevMes = "";
    S.forEach((s, i) => { const m = (s.n.fecha || "").slice(0, 7); if (m !== prevMes) { inicios.push({ m, i }); prevMes = m; } });
    const recientes = new Set(inicios.slice(-4).map(x => x.m));
    const candidatos = inicios.filter((x, k) => recientes.has(x.m) || k === 0 || x.m.slice(0, 4) !== inicios[k - 1].m.slice(0, 4));
    const elegidos = [];
    for (const x of candidatos.slice().reverse()) {
      const r = R0 + (R1 - R0) * x.i / S.length;
      if (elegidos.length && elegidos[elegidos.length - 1].r - r < 6.5) continue;
      elegidos.push({ ...x, r });
    }
    elegidos.forEach((x, k) => {
      const pts = []; for (let j = 0; j < 128; j++) { const a = j / 128 * Math.PI * 2; pts.push(new THREE.Vector3(x.r * Math.cos(a), 0, x.r * Math.sin(a))); }
      refRejilla.push(lineasSimples(pts, 0.16, true));
      const [y, mm] = x.m.split("-");
      etiquetaMes(`${MES[+mm - 1]} ${y}`, new THREE.Vector3(x.r * Math.cos(RAD(64)), 0.2, x.r * Math.sin(RAD(64))), 500 - k);
    });
    const pr = []; for (let k = 0; k < 160; k++) { const a = k / 160 * Math.PI * 2; pr.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
    anilloRepro = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pr), new THREE.LineBasicMaterial({ color: ROJO_TDR, transparent: true, opacity: 0.9, depthWrite: false }));
    anilloRepro.position.y = 0.08; anilloRepro.visible = false; anilloRepro.layers.enable(CAPA); scene.add(anilloRepro);
    for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; puntosEncuadre.push(new THREE.Vector3((R1 + 12) * Math.cos(a), 0, (R1 + 12) * Math.sin(a))); }
    for (const s of S) puntosEncuadre.push(s.pos);
  }

  function etiquetaRed(red, pos) {
    const e = document.createElement("div"); e.className = "m3d-lbl m3d-lbl-red";
    const inn = document.createElement("span"); inn.className = "m3d-lbl-in"; inn.style.setProperty("--c", RED[red].color);
    const i = document.createElement("i"), b = document.createElement("b"), n = document.createElement("span");
    b.textContent = RED[red].nombre; n.className = "m3d-n"; n.textContent = fmt(zona[red].n);
    inn.append(i, b, n); e.appendChild(inn);
    const o = new CSS2DObject(e); o.position.copy(pos); scene.add(o);
    Object.assign(zona[red], { lbl: o, lblIn: inn, lblN: n });
    ETIQ.push({ obj: o, inn, pos: pos.clone(), prio: 1000 + zona[red].n, tipo: "red", red, w: 0, h: 0 });
    ETIQ.sort((a, b2) => b2.prio - a.prio);
  }
  function etiquetaMes(texto, pos, prio) {
    const e = document.createElement("div"); e.className = "m3d-lbl m3d-lbl-mes";
    const inn = document.createElement("span"); inn.className = "m3d-lbl-in"; inn.textContent = texto; e.appendChild(inn);
    const o = new CSS2DObject(e); o.position.copy(pos); scene.add(o);
    ETIQ.push({ obj: o, inn, pos: pos.clone(), prio, tipo: "mes", w: 0, h: 0 });
    ETIQ.sort((a, b2) => b2.prio - a.prio);
  }

  /* arcos «misma pieza en varias redes» */
  function esferica(a, b, t) {
    const ang = a.angleTo(b), s = Math.sin(ang);
    if (s < 1e-5) return a.clone();
    return a.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(b.clone().multiplyScalar(Math.sin(t * ang) / s)).normalize();
  }
  function crearEnlaces() {
    const porGrupo = new Map();
    for (const s of S) if (s.grupo != null) { if (!porGrupo.has(s.grupo)) porGrupo.set(s.grupo, []); porGrupo.get(s.grupo).push(s); }
    const tramos = [];
    for (const L of porGrupo.values()) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j], p = [];
      for (let k = 0; k <= 28; k++) {
        const t = k / 28;
        if (MODO === "globo") {                                   // por arriba (hacia el polo norte), sin cruzar por delante del logo
          const ua = a.pos.clone().normalize(), ub = b.pos.clone().normalize();
          const w = ua.clone().add(ub).add(new THREE.Vector3(0, 2.2 * ua.angleTo(ub) / Math.PI, 0)).normalize();
          p.push(esferica(esferica(ua, w, t), esferica(w, ub, t), t).multiplyScalar(R * (1 + 0.08 * Math.sin(Math.PI * t))));
        } else {
          const m = a.pos.clone().add(b.pos).multiplyScalar(0.5); m.y += 6 + a.pos.distanceTo(b.pos) * 0.08;
          p.push(new THREE.Vector3().copy(a.pos).multiplyScalar((1 - t) * (1 - t)).addScaledVector(m, 2 * t * (1 - t)).addScaledVector(b.pos, t * t));
        }
      }
      const [a0, a1] = MODO === "globo" ? [0.22, 0.2] : [0.12, 0.14];
      tramos.push({ p, vis: () => Math.min(a.a, b.a), color: (c0, c1) => { c0.set(colorEnlace); c1.copy(c0); }, alfa: u => a0 + a1 * Math.sin(Math.PI * u) });
    }
    enlaces = conjunto(tramos);
  }

  /* ─────────── tema de la escena (paleta, brillo, color por) ─────────── */
  function equilibrio(c) { const L = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; return Math.min(1.25, Math.max(0.6, Math.pow(0.25 / Math.max(L, 0.01), 0.4))); }
  function temaEscena() {
    if (!scene || !logo) return;
    const disco = pal.estrellas === "disco", nb = { bajo: 0, medio: 1, alto: 2 }[aj.brillo];
    const mezclaDisco = disco ? THREE.NormalBlending : THREE.AdditiveBlending;
    scene.background = fondoEscena(); ajustarFondo();
    bloomActivo = !disco;
    bloom.strength = [0.3, 0.5, 0.8][nb]; bloom.radius = 0.3; bloom.threshold = 0;
    mezcla.uniforms.fuerza.value = bloomActivo ? 1 : 0;
    const inten = [0.75, 0.95, 1.2][nb];
    for (const s of S) {
      s.mat.map = s.tipo === "largo" ? (disco ? TEX.discoLargo : TEX.luzLargo) : (disco ? TEX.disco : TEX.luz);
      s.mat.blending = mezclaDisco;
      s.mat.color.set(colorDe(s));
      // con luz que se suma se iguala el brillo: el cian de TikTok luce el triple que el rojo y saturaría
      if (!disco) s.mat.color.multiplyScalar(inten * equilibrio(s.mat.color));
      s.mat.needsUpdate = true;
    }
    colorEnlace = pal.enlace;
    const fl = disco ? [1.3, 1.6, 2][nb] : [0.7, 1, 1.35][nb];
    for (const cj of lineas) { cj.factor = fl; cj.mat.blending = mezclaDisco; cj.mat.needsUpdate = true; cj.pintar(); }
    for (const o of refRejilla) { o.material.color.set(pal.rejilla); o.material.opacity = Math.min(1, o.userData.opacidad * (disco ? 1.9 : 1)); }
    for (const o of refRed) { o.material.color.set(RED[o.userData.red].color); o.material.opacity = disco ? 0.6 : 0.34; }
    if (puntosBase) { puntosBase.material.blending = mezclaDisco; puntosBase.material.needsUpdate = true; }
    for (const red of REDES) { const z = zona[red]; if (z && z.sprNodo) { z.sprNodo.material.blending = mezclaDisco; z.sprNodo.material.color.set(RED[red].color); } }
    halo.material.blending = disco ? THREE.NormalBlending : THREE.AdditiveBlending;
    halo.material.opacity = disco ? 0.2 : [0.28, 0.4, 0.55][nb];
    if (anilloRepro) anilloRepro.material.opacity = disco ? 1 : 0.9;
    sucio = true;
  }

  /* ─────────── encuadre de la cámara (todo en coordenadas del contenedor) ─────────── */
  function aplicarDesplaz() {
    camera.setViewOffset(W, H, -desplaz.ax, -desplaz.ay, W, H);
    camera.updateProjectionMatrix();
  }
  function encuadrar(inicial) {
    if (!camera || !puntosEncuadre.length) return;
    const rr = raiz.getBoundingClientRect(), r = el.medio.getBoundingClientRect(), movil = estrecho();
    const izq = !movil && !el.leyCuerpo.classList.contains("m3d-cerrada") ? el.leyCuerpo.getBoundingClientRect().right - rr.left + 8 : 0;
    const ancho = Math.max(240, W - izq - 16), alto = Math.max(160, r.height);
    desplaz.x = (izq + (W - izq) / 2) - W / 2;
    desplaz.y = (r.top - rr.top + r.height / 2) - H / 2;
    if (inicial || !desplaz.listo || reduceMov.matches) { desplaz.ax = desplaz.x; desplaz.ay = desplaz.y; desplaz.listo = true; }
    camera.aspect = W / H;
    aplicarDesplaz();
    let ajuste;
    if (MODO === "globo") {
      controles.enablePan = false; controles.maxPolarAngle = Math.PI;
      const objetivo = new THREE.Vector3();
      ajuste = distanciaQueCabe(RAD(76), 0, objetivo, puntosEncuadre, ancho - 32, alto - (movil ? 24 : 16), 0);
      controles.minDistance = R * 1.45; controles.maxDistance = Math.max(ajuste.d * 2.2, R * 4);
      vistaInicial = { pos: new THREE.Vector3().setFromSphericalCoords(ajuste.d, RAD(76), 0), target: objetivo };
    } else {
      controles.enablePan = true; controles.screenSpacePanning = false; controles.maxPolarAngle = RAD(86);
      const polar = RAD(movil ? 36 : 58), azim = RAD(18), objetivo = new THREE.Vector3(0, movil ? 4 : 8, 0);
      ajuste = distanciaQueCabe(polar, azim, objetivo, puntosEncuadre, ancho - 24, alto - 16, 0.7);
      controles.minDistance = 30; controles.maxDistance = ajuste.d * 2.2;
      vistaInicial = { pos: new THREE.Vector3().setFromSphericalCoords(ajuste.d, polar, azim).add(objetivo), target: objetivo };
    }
    desplaz.x -= ajuste.sx; desplaz.y -= ajuste.sy;
    if (inicial || reduceMov.matches) { desplaz.ax = desplaz.x; desplaz.ay = desplaz.y; aplicarDesplaz(); }
    if (inicial) {
      camera.position.copy(vistaInicial.pos); controles.target.copy(vistaInicial.target); controles.update();
      encuadreReal = raiz.clientWidth > 0 && raiz.clientHeight > 0;          // montado con la pestaña oculta: se rehace al verse
    }
    sucio = true;
  }
  /* distancia a la que todo `puntos` cabe en ancho × alto px; `fr` = cuánto se centra la caja visible en vez del pivote */
  function distanciaQueCabe(polar, azim, objetivo, puntos, ancho, alto, fr) {
    const cam = camera.clone(), v = new THREE.Vector3();
    let d = 300, bx = 0, by = 0;
    for (let it = 0; it < 8; it++) {
      cam.position.setFromSphericalCoords(d, polar, azim).add(objetivo); cam.lookAt(objetivo); cam.updateMatrixWorld();
      v.copy(objetivo).project(cam); const cx = (v.x + 1) / 2 * W, cy = (1 - v.y) / 2 * H;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of puntos) {
        v.copy(p).project(cam); const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      bx = fr * ((x0 + x1) / 2 - cx); by = fr * ((y0 + y1) / 2 - cy);
      const ex = Math.max(Math.abs(x1 - cx - bx), Math.abs(x0 - cx - bx), 1), ey = Math.max(Math.abs(y1 - cy - by), Math.abs(y0 - cy - by), 1);
      d *= Math.max(2 * ex / Math.max(120, ancho), 2 * ey / Math.max(120, alto));
    }
    return { d, sx: bx, sy: by };
  }
  function volverAVista() {
    if (!vistaInicial) return;
    ultimaInteraccion = ahoraMs;
    if (reduceMov.matches) { camera.position.copy(vistaInicial.pos); controles.target.copy(vistaInicial.target); controles.update(); sucio = true; return; }
    vuelo = { t0: ahoraMs, p0: camera.position.clone(), q0: controles.target.clone() };
  }
  function redimensionar() {
    const w0 = W, h0 = H;
    medir();
    if (!renderer || raiz.clientWidth === 0 || raiz.clientHeight === 0) return;   // pestaña oculta: se rehace al volver
    if (W === w0 && H === h0 && encuadreReal) return;
    renderer.setSize(W, H); compFinal.setSize(W, H); compBrillo.setSize(W, H); etiquetas.setSize(W, H);
    ajustarFondo();
    for (const e of ETIQ) e.w = 0;
    encuadrar(!encuadreReal);
    sucio = true;
  }

  function rotacionPermitida() { return aj.rotar === "si" && !reduceMov.matches && !sel; }

  /* ─────────── puntero: hover, clic y toque (coordenadas del contenedor) ─────────── */
  function aPantalla(p) {
    pv.copy(p).project(camera);
    _v.x = (pv.x + 1) / 2 * W; _v.y = (1 - pv.y) / 2 * H; _v.z = pv.z;
    return _v;
  }
  function elegir(x, y, radioMin) {
    let mejor = null, mejorD = Infinity;
    const cam = camera.position, tanF = Math.tan(RAD(camera.fov) / 2);
    const lp = aPantalla(logo.position), lx = lp.x, ly = lp.y, dLogo = cam.distanceTo(logo.position);
    const lr = logo.userData.radio / (dLogo * tanF) * (H / 2);
    for (const s of S) {
      if (!s.lit || s.a < 0.5 || !s.spr || !s.spr.visible) continue;
      const p = aPantalla(s.pos); if (p.z > 1) continue;
      const dist = cam.distanceTo(s.pos);
      const rpx = (s.d * s.k * 0.5) / (dist * tanF) * (H / 2);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d > Math.max(radioMin, rpx + 4)) continue;
      if (dist > dLogo && Math.hypot(p.x - lx, p.y - ly) < lr) continue;          // tapada por el logo
      const pts = d + dist * 0.004;
      if (pts < mejorD) { mejorD = pts; mejor = s; }
    }
    return mejor;
  }
  function conectarPuntero() {
    const cv = renderer.domElement;
    const rel = e => { const r = raiz.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let abajo = null, pendiente = null;
    escuchar(cv, "pointerdown", e => { abajo = { x: e.clientX, y: e.clientY, t: performance.now() }; ultimaInteraccion = ahoraMs; controles.autoRotate = false; });
    escuchar(cv, "pointerup", e => {
      if (!abajo || !logo) return;
      const mov = Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y), dur = performance.now() - abajo.t;
      abajo = null;
      if (mov > 6 || dur > 600) return;
      const [x, y] = rel(e);
      const s = elegir(x, y, e.pointerType === "mouse" ? 12 : 24);
      if (s) seleccionar(s, false); else if (sel) cerrarFicha(false);
    });
    escuchar(cv, "pointermove", e => {
      if (e.pointerType !== "mouse") return;
      if (e.buttons) { if (hover) { hover = null; ocultarTooltip(); } return; }
      const [x, y] = rel(e);
      const primero = !pendiente;
      pendiente = { x, y };
      if (!primero) return;
      requestAnimationFrame(() => {
        if (!pendiente || destruido || !logo) { pendiente = null; return; }
        const { x: px, y: py } = pendiente; pendiente = null;
        const s = elegir(px, py, 12);
        if (s !== hover) { hover = s; sucio = true; }
        cv.style.cursor = s ? "pointer" : "";
        s ? mostrarTooltip(s, px, py) : ocultarTooltip();
      });
    });
    escuchar(cv, "pointerleave", () => { pendiente = null; if (hover) { hover = null; sucio = true; } ocultarTooltip(); });
  }

  function rellenarRed(e, s) { e.style.setProperty("--c", RED[s.red].color); e.querySelector("span").textContent = RED[s.red].nombre; }
  function mostrarTooltip(s, x, y) {
    const tt = el.tooltip;
    tt.innerHTML = `<div class="m3d-tt-m"><span class="m3d-etq-red"><i></i><span></span></span> · <span class="m3d-tt-tipo"></span></div>
      <p class="m3d-tt-t"></p><div class="m3d-tt-m m3d-tt-f"></div><div class="m3d-tt-c"><div><b class="m3d-tt-v"></b> <span>visualizaciones</span></div><div><b class="m3d-tt-l"></b> <span>me gusta</span></div></div>`;
    rellenarRed(tt.querySelector(".m3d-etq-red"), s);
    tt.querySelector(".m3d-tt-tipo").textContent = TIPO[s.tipo];
    tt.querySelector(".m3d-tt-t").textContent = s.n.titulo || "(sin título)";
    tt.querySelector(".m3d-tt-f").textContent = fecha(s.n.fecha) + (hora(s.n.fecha) ? " · " + hora(s.n.fecha) : "");
    tt.querySelector(".m3d-tt-v").textContent = fmt(s.n.vis);
    tt.querySelector(".m3d-tt-l").textContent = fmt(s.n.likes);
    tt.hidden = false;
    const w = tt.offsetWidth, h = tt.offsetHeight;
    let l = x + 16, t = y + 16;
    if (l + w > W - 8) l = x - w - 16;
    if (t + h > H - 8) t = y - h - 16;
    tt.style.transform = `translate(${Math.max(8, Math.min(l, W - w - 8))}px, ${Math.max(8, Math.min(t, H - h - 8))}px)`;
  }
  function ocultarTooltip() { el.tooltip.hidden = true; }

  /* ─────────── ficha ─────────── */
  function seleccionar(s, foco) {
    if (!reticula) return;
    sel = s; ocultarTooltip();
    controles.autoRotate = false;
    rellenarRed(el.fRed, s);
    el.fTipo.textContent = TIPO[s.tipo];
    el.fTit.textContent = s.n.titulo || "(sin título)";
    el.fFecha.textContent = `Publicado el ${fecha(s.n.fecha)}${hora(s.n.fecha) ? " a las " + hora(s.n.fecha) : ""}`;
    el.fVis.textContent = fmt(s.n.vis);
    el.fLk.textContent = fmt(s.n.likes);
    el.fPuesto.textContent = "";
    if (s.totalRed > 1) {
      const b = document.createElement("b"); b.textContent = `Puesto ${fmt(s.puesto)} de ${fmt(s.totalRed)}`;
      el.fPuesto.append(b, ` en ${RED[s.red].nombre} por visualizaciones`);
    }
    const otros = s.grupo != null ? S.filter(o => o.grupo === s.grupo && o !== s) : [];
    el.fMisma.hidden = !otros.length;
    el.fMismaL.innerHTML = "";
    for (const o of otros) {
      const b = document.createElement("button"); b.type = "button"; b.style.setProperty("--c", RED[o.red].color);
      const i = document.createElement("i"), t = document.createElement("span"), n = document.createElement("b");
      t.textContent = RED[o.red].nombre; n.textContent = fmt(o.n.vis);
      b.append(i, t, n); b.title = `${RED[o.red].nombre}: ${fmt(o.n.vis)} visualizaciones`;
      b.addEventListener("click", () => seleccionar(o, true));
      el.fMismaL.appendChild(b);
    }
    el.fVer.href = s.n.url || "#"; el.fVer.hidden = !s.n.url;
    el.fVer.setAttribute("aria-label", `Ver el vídeo en ${RED[s.red].nombre} (se abre en una pestaña nueva)`);
    if (el.ficha.hidden) { el.ficha.hidden = false; requestAnimationFrame(() => el.ficha.classList.add("m3d-abierta")); }
    if (foco) el.fTit.focus({ preventScroll: true });
    reticula.visible = true;
    sucio = true;
  }
  function cerrarFicha(devolverFoco) {
    if (!sel) return;
    sel = null; if (reticula) reticula.visible = false;
    el.ficha.classList.remove("m3d-abierta");
    setTimeout(() => { if (!sel) el.ficha.hidden = true; }, reduceMov.matches ? 0 : 300);
    if (devolverFoco && document.activeElement && el.ficha.contains(document.activeElement)) el.q.focus({ preventScroll: true });
    ultimaInteraccion = ahoraMs;
    sucio = true;
  }

  /* ─────────── reproducción del crecimiento ─────────── */
  function prepararRepro() {
    // cada vídeo pesa 1; los huecos entre fechas suman poco (logaritmo de los días): así se acelera en los meses vacíos
    const w = S.map((s, i) => i === 0 ? 0 : 1 + 0.2 * Math.log1p(Math.max(0, (s.t - S[i - 1].t) / 864e5)));
    const total = w.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    repro.T = w.map(x => { acc += x; return 500 + acc / total * (repro.dur - 1000); });
  }
  function empezarRepro() {
    if (!listo) return;
    repro.activa = true; repro.t0 = ahoraMs; repro.hasta = -1;
    el.play.setAttribute("aria-pressed", "true"); el.play.setAttribute("aria-label", "Parar la reproducción");
    el.reloj.hidden = false;
    if (anilloRepro) anilloRepro.visible = true;
    contar(); sucio = true;
  }
  function pararRepro() {
    repro.activa = false;
    el.play.setAttribute("aria-pressed", "false"); el.play.setAttribute("aria-label", "Reproducir crecimiento");
    el.reloj.hidden = true;
    if (anilloRepro) anilloRepro.visible = false;
    contar(); sucio = true;
  }
  function avanzarRepro() {
    const t = ahoraMs - repro.t0, N = S.length;
    let cambio = false;
    while (repro.hasta + 1 < N && repro.T[repro.hasta + 1] <= t) { repro.hasta++; cambio = true; }
    let ts, idxF;
    if (repro.hasta < 0) { ts = S[0].t; idxF = 0; }
    else if (repro.hasta < N - 1) {
      const a = repro.T[repro.hasta], b = repro.T[repro.hasta + 1], f = Math.min(1, Math.max(0, (t - a) / Math.max(1, b - a)));
      ts = S[repro.hasta].t + f * (S[repro.hasta + 1].t - S[repro.hasta].t); idxF = repro.hasta + f;
    } else { ts = S[N - 1].t; idxF = N - 1; }
    el.relojF.textContent = fechaDe(ts);
    el.relojB.style.transform = `scaleX(${Math.min(1, t / repro.dur)})`;
    if (anilloRepro) anilloRepro.scale.setScalar(radioDe(idxF));
    if (cambio) contar();
    if (t >= repro.dur) pararRepro();
  }

  /* ─────────── bucle ─────────── */
  function bucle(ahora) {
    raf = 0;
    if (destruido || pausado) return;
    raf = requestAnimationFrame(bucle);
    ahoraMs = ahora;
    const dt = Math.min(0.1, Math.max(0, (ahora - ultimo) / 1000)); ultimo = ahora;
    if (raiz.clientWidth === 0 || raiz.clientHeight === 0) return;       // contenedor oculto: no se pinta
    if (W !== raiz.clientWidth || H !== raiz.clientHeight) redimensionar();
    let mover = false;
    if (rotacionPermitida() && !controles.autoRotate && ahora - ultimaInteraccion > 15000) controles.autoRotate = true;
    if (!rotacionPermitida() && controles.autoRotate) controles.autoRotate = false;
    if (vuelo) {
      const u = Math.min(1, (ahora - vuelo.t0) / 800), e = 1 - Math.pow(1 - u, 3);
      camera.position.lerpVectors(vuelo.p0, vistaInicial.pos, e); controles.target.lerpVectors(vuelo.q0, vistaInicial.target, e);
      if (u >= 1) vuelo = null;
      mover = true;
    }
    if (desplaz.ax !== desplaz.x || desplaz.ay !== desplaz.y) {     // la vista se recoloca con suavidad (p. ej. al plegar la leyenda)
      const f = 1 - Math.exp(-dt * 10);
      desplaz.ax += (desplaz.x - desplaz.ax) * f; desplaz.ay += (desplaz.y - desplaz.ay) * f;
      if (Math.abs(desplaz.x - desplaz.ax) < 0.5 && Math.abs(desplaz.y - desplaz.ay) < 0.5) { desplaz.ax = desplaz.x; desplaz.ay = desplaz.y; }
      aplicarDesplaz(); mover = true;
    }
    if (controles.update(dt)) mover = true;
    if (MODO === "galaxia") {                                     // que no se pierda el centro al desplazar
      const t = controles.target, lim = R1 * 0.7, l = Math.hypot(t.x, t.z);
      if (l > lim) { t.x *= lim / l; t.z *= lim / l; }
      t.y = Math.min(Math.max(t.y, -5), HMAX);
    }
    if (repro.activa) { avanzarRepro(); mover = true; }
    if (animarEstrellas(dt, ahora)) mover = true;
    if (reticula && reticula.visible && sel) {
      if (!reduceMov.matches) reticula.material.rotation += dt * 0.5;
      reticula.position.copy(sel.pos); reticula.scale.setScalar(sel.d * Math.max(sel.k, 0.5) * 2.4 + 3);
      mover = true;
    }
    if (mover || sucio) { colocarEtiquetas(); pintar(); sucio = false; }
  }

  function animarEstrellas(dt, ahora) {
    const f = reduceMov.matches ? 1 : 1 - Math.exp(-dt * 9);
    const dim = pal.estrellas === "disco" ? 0.14 : 0.08;
    let activo = false;
    for (const s of S) {
      if (!s.spr) continue;
      const visible = ahora >= s.aparece && (!repro.activa || s.i <= repro.hasta);
      const ta = visible ? (s.lit ? 1 : dim) : 0;
      const tk = visible ? (s === hover ? 1.4 : 1) * (s === sel ? 1.2 : 1) * (s.match && s.lit ? 1.25 : 1) : 0;
      if (s.a !== ta || s.k !== tk) {
        s.a += (ta - s.a) * f; s.k += (tk - s.k) * f;
        if (Math.abs(ta - s.a) < 0.003) s.a = ta;
        if (Math.abs(tk - s.k) < 0.003) s.k = tk;
        activo = true;
      }
      s.mat.opacity = s.a;
      s.spr.scale.setScalar(Math.max(0.0001, s.d * s.k * HALO_ESTRELLA));
      s.spr.visible = s.a > 0.004 && s.k > 0.01;
    }
    if (activo || sucio) {
      for (const cj of lineas) cj.pintar();
      if (puntosBase) {
        const c = puntosBase.geometry.attributes.color, col = new THREE.Color();
        S.forEach((s, i) => { col.set(colorDe(s)); c.array[i * 4] = col.r; c.array[i * 4 + 1] = col.g; c.array[i * 4 + 2] = col.b; c.array[i * 4 + 3] = s.a * 0.8; });
        c.needsUpdate = true;
      }
    }
    return activo;
  }

  /* etiquetas: las de red del globo al lado de su nodo y hacia fuera del logo; todas dentro del contenedor y sin pisarse */
  function colocarEtiquetas() {
    if (!logo) return;
    const tanF = Math.tan(RAD(camera.fov) / 2);
    const lp = aPantalla(logo.position), lx = lp.x, ly = lp.y;
    const lr = logo.userData.radio / (camera.position.distanceTo(logo.position) * tanF) * (H / 2);
    const haciaCam = camera.position.clone().normalize();
    const ocupado = [{ l: lx - lr, r: lx + lr, t: ly - lr, b: ly + lr }];
    const choca = qq => ocupado.find(o => qq.l < o.r && qq.r > o.l && qq.t < o.b && qq.b > o.t);
    for (const e of ETIQ) {
      if (!e.w) { e.w = e.inn.offsetWidth; e.h = e.inn.offsetHeight; }
      const p = aPantalla(e.pos), px = p.x, py = p.y;
      if (p.z > 1) continue;
      let cx = px, cy = py;
      if (MODO === "globo" && e.tipo === "red") {
        let dx = px - lx, dy = py - ly; const L = Math.hypot(dx, dy);
        if (L < 1) { dx = 0; dy = -1; } else { dx /= L; dy /= L; }
        const m = Math.abs(dx) * e.w / 2 + Math.abs(dy) * e.h / 2;
        const d = Math.max(L + m + 10, lr + m + 12);
        cx = lx + dx * d; cy = ly + dy * d;
        e.obj.element.classList.toggle("m3d-lejos", zona[e.red].c.dot(haciaCam) < -0.2);
      }
      cx = Math.min(Math.max(cx, 8 + e.w / 2), W - 8 - e.w / 2);
      cy = Math.min(Math.max(cy, 8 + e.h / 2), H - 8 - e.h / 2);
      const caja = () => ({ l: cx - e.w / 2 - 4, r: cx + e.w / 2 + 4, t: cy - e.h / 2 - 3, b: cy + e.h / 2 + 3 });
      let qq = caja(), o = choca(qq);
      if (o && e.tipo === "red") {
        const abajo = o.b - qq.t, arriba = qq.b - o.t;
        cy += abajo < arriba ? abajo : -arriba; qq = caja(); o = null;
      }
      const oculta = !!o && e.tipo === "mes";
      e.inn.classList.toggle("m3d-oculta", oculta);
      if (oculta) continue;
      e.inn.style.transform = `translate(${(cx - px).toFixed(1)}px, ${(cy - py).toFixed(1)}px)`;
      ocupado.push(qq);
    }
  }

  function pintar() {
    if (bloomActivo) {
      const fondo = scene.background;
      scene.background = null;
      camera.layers.set(CAPA);
      compBrillo.render();
      camera.layers.set(0);
      scene.background = fondo;
    }
    compFinal.render();
    etiquetas.render(scene, camera);
  }

  /* ─────────── leyenda ─────────── */
  function leyenda() {
    const items = aj.color === "tipo"
      ? TIPOS.map(t => [t === "largo" ? "Vídeo largo" : t === "short" ? "Short" : "Reel (Instagram, TikTok, Facebook)", COLOR_TIPO[pal.claro ? "claro" : "oscuro"][t]])
      : REDES.map(r => [RED[r].nombre, RED[r].color]);
    el.leyColT.textContent = aj.color === "tipo" ? "Color = tipo" : "Color = red";
    el.leyCol.innerHTML = "";
    for (const [t, c] of items) { const li = document.createElement("li"), i = document.createElement("i"); i.style.setProperty("--c", c); li.append(i, t); el.leyCol.appendChild(li); }
    el.leyTam.textContent = aj.tam === "likes" ? "Tamaño = me gusta" : "Tamaño = visualizaciones";
    el.leyModo.textContent = MODO === "globo"
      ? "Cada red ocupa su zona; dentro, lo más visto queda en el centro. Líneas finísimas: vídeo → nodo de su red → TDR."
      : "Un brazo por red. Distancia al centro = orden de publicación: cada vídeo queda un paso más afuera que el anterior, así ago–oct 2026 no se aplasta; cada anillo marca dónde empieza un mes. Altura y pilar = visualizaciones.";
    el.leyEnl.textContent = aj.enlaces === "si" ? "Arcos: la misma pieza subida a varias redes el mismo día." : "";
    el.leyEnl.hidden = aj.enlaces !== "si";
  }
}

export default montarMapa;
