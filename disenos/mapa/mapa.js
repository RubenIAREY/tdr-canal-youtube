/* Mapa 3D de vídeos de TodoEnRecambio (TDR).
   Módulo compartido: globo.html (window.MODO = "globo") y galaxia.html (window.MODO = "galaxia").
   Datos: mapa_videos.json, que genera PANEL-REDES/mapa_datos.py. Todo número que se ve sale de ahí.
   Three.js 0.160 (unpkg, por importmap) se carga con import() para que la interfaz salga aunque falle. */

const MODO = window.MODO === "galaxia" ? "galaxia" : "globo";
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
// colores por tipo (validados: separación para daltonismo y contraste sobre cada fondo)
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
const $ = id => document.getElementById(id);
const reduceMov = matchMedia("(prefers-reduced-motion: reduce)");

/* ─────────── Ajustes: URL > localStorage > por defecto ─────────── */
const AJ_DEF = { paleta: "noche", letra: "geist", densidad: "normal", brillo: "medio", rotar: "si", tam: "vis", color: "red", enlaces: "si" };
const OPC = {
  paleta: { t: "Paleta", o: [["noche", "Noche"], ["asfalto", "Asfalto"], ["papel", "Papel"]] },
  letra: { t: "Letra", o: [["geist", "Geist + Geist Mono"], ["barlow", "Barlow + IBM Plex"]] },
  densidad: { t: "Densidad", o: [["compacta", "Compacta"], ["normal", "Normal"], ["amplia", "Amplia"]] },
  brillo: { t: "Brillo", o: [["bajo", "Bajo"], ["medio", "Medio"], ["alto", "Alto"]] },
  rotar: { t: "Autorrotación", o: [["si", "Sí"], ["no", "No"]] },
  tam: { t: "Tamaño por", o: [["vis", "Visualizaciones"], ["likes", "Me gusta"]] },
  color: { t: "Color por", o: [["red", "Red"], ["tipo", "Tipo"]] },
  enlaces: { t: "Enlaces entre redes", o: [["si", "Sí"], ["no", "No"]] },
};
const MUESTRA = { noche: ["#050913", "#1a2540"], asfalto: ["#100f0d", "#3a342c"], papel: ["#efebe2", "#ffffff"] };
const CLAVE = "tdr-mapa-ajustes";

function leerAjustes() {
  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { guardado = {}; }
  const q = new URLSearchParams(location.search), a = {};
  for (const k in AJ_DEF) {
    const vale = v => OPC[k].o.some(o => o[0] === v);
    a[k] = vale(q.get(k)) ? q.get(k) : vale(guardado[k]) ? guardado[k] : AJ_DEF[k];
  }
  return a;
}
let aj = leerAjustes();

function guardarAjustes() {
  try { localStorage.setItem(CLAVE, JSON.stringify(aj)); } catch (e) { /* sin almacenamiento: la URL basta */ }
  const q = new URLSearchParams(location.search);
  for (const k in aj) q.set(k, aj[k]);
  const qs = "?" + q.toString();
  try { history.replaceState(null, "", location.pathname + qs + location.hash); } catch (e) { /* file:// u otros */ }
  document.querySelectorAll(".variantes a").forEach(a => { a.href = a.dataset.v + ".html" + qs; });
}
function cargarLetra() {
  if (aj.letra !== "barlow" || document.getElementById("letra-barlow")) return;
  const l = document.createElement("link");
  l.id = "letra-barlow"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
  document.head.appendChild(l);
}
function ajustesAlDOM() {
  const h = document.documentElement;
  h.dataset.paleta = aj.paleta; h.dataset.letra = aj.letra; h.dataset.densidad = aj.densidad; h.dataset.modo = MODO;
  cargarLetra();
}
const esClaro = () => aj.paleta === "papel";

/* ─────────── iconos (SVG en línea) ─────────── */
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

/* ─────────── interfaz ─────────── */
function plantilla() {
  return `
<div class="escena" id="escena" role="img" aria-label="Mapa 3D de los vídeos de TodoEnRecambio"></div>
<div class="vineta" aria-hidden="true"></div>
<div class="capa">
  <header class="barra">
    <img class="logo" src="../../logo-tdr.png" alt="TDR" width="28" height="28">
    <h1 class="titulo">Mapa de vídeos <span>· TDR</span></h1>
    <nav class="variantes" aria-label="Variante del mapa">
      <a href="globo.html" data-v="globo"${MODO === "globo" ? ' aria-current="page"' : ""}>Globo</a>
      <a href="galaxia.html" data-v="galaxia"${MODO === "galaxia" ? ' aria-current="page"' : ""}>Galaxia</a>
    </nav>
    <nav class="enlaces" aria-label="Otras páginas">
      <a href="../">← Todas las versiones</a>
      <a href="../../panel.html">Panel actual</a>
      <a href="../../index.html">Web del canal</a>
    </nav>
  </header>

  <section class="herr" aria-label="Filtros y búsqueda">
    <div class="filtros">
      <div class="chips panel" id="chips" role="group" aria-label="Redes"></div>
      <div class="seg panel" id="tipos" role="radiogroup" aria-label="Tipo de vídeo"></div>
    </div>
    <div class="acciones">
      <div class="busca panel" id="busca">
        ${ICO.buscar}
        <input id="q" type="search" placeholder="Buscar por título" aria-label="Buscar por título" autocomplete="off" spellcheck="false" aria-controls="resultados" aria-expanded="false">
        <button class="btn-x" id="q-x" type="button" aria-label="Borrar la búsqueda" hidden>${ICO.cerrar}</button>
        <div class="resultados" id="resultados" hidden></div>
      </div>
      <button class="btn btn-play" id="play" type="button" aria-pressed="false" aria-label="Reproducir crecimiento" disabled>
        <span class="ico ico-play">${ICO.play}</span><span class="ico ico-parar">${ICO.parar}</span>
        <span class="play-txt largo"><span class="t-play">Reproducir crecimiento</span><span class="t-parar">Parar</span></span>
        <span class="play-txt corto"><span class="t-play">Reproducir</span><span class="t-parar">Parar</span></span>
      </button>
    </div>
  </section>

  <div class="contadores panel" id="contadores" aria-label="Lo que se ve en el mapa">
    <div><b id="c-n">–</b><span>vídeos</span></div>
    <div><b id="c-vis">–</b><span>visualizaciones</span></div>
    <div><b id="c-lk">–</b><span>me gusta</span></div>
  </div>

  <div class="medio" id="medio">
    <p class="aviso" id="aviso">Cargando el mapa…</p>
    <div class="reloj" id="reloj" hidden aria-hidden="true">
      <span class="reloj-et">Publicados hasta el</span><b class="reloj-fecha" id="reloj-fecha">–</b>
      <div class="reloj-barra"><i id="reloj-barra"></i></div>
    </div>
    <aside class="ficha" id="ficha" hidden aria-labelledby="f-titulo">
      <div class="ficha-cab">
        <span class="etq-red" id="f-red"><i></i><span></span></span><span class="etq-tipo" id="f-tipo"></span>
        <button class="x" id="f-x" type="button" aria-label="Cerrar la ficha">${ICO.cerrar}</button>
      </div>
      <h2 id="f-titulo" tabindex="-1"></h2>
      <p class="ficha-fecha" id="f-fecha"></p>
      <dl class="cifras">
        <div><dt>Visualizaciones</dt><dd id="f-vis"></dd></div>
        <div><dt>Me gusta</dt><dd id="f-lk"></dd></div>
      </dl>
      <p class="puesto" id="f-puesto"></p>
      <div class="misma" id="f-misma" hidden><p>La misma pieza en</p><div id="f-misma-l"></div></div>
      <a class="btn btn-primario ver" id="f-ver" href="#" target="_blank" rel="noopener">Ver el vídeo ↗</a>
    </aside>
  </div>

  <div class="ley" id="ley">
    <div class="ley-cuerpo" id="ley-cuerpo">
      <section><h3 id="ley-color-t">Color = red</h3><ul class="ley-colores" id="ley-colores"></ul></section>
      <section><ul class="ley-formas">
        <li>${ICO.short}<span>Short o reel</span></li>
        <li>${ICO.largo}<span>Vídeo largo de YouTube (más de 3 min)</span></li>
        <li>${ICO.tam}<span id="ley-tam"></span></li>
      </ul></section>
      <section><p id="ley-modo"></p><p id="ley-enlaces"></p></section>
      <section>
        <p>Visualizaciones y me gusta de cada vídeo público, tal como estaban al generar el mapa.</p>
        <p class="ley-fuente" id="ley-fuente">Datos: YouTube API y Metricool · –</p>
      </section>
    </div>
    <button class="ley-btn" id="ley-btn" type="button" aria-expanded="true" aria-controls="ley-cuerpo">Leyenda ${ICO.chevron}</button>
  </div>

  <div class="botones">
    <button class="btn-icono" id="centrar" type="button" aria-label="Centrar la vista" title="Centrar la vista">${ICO.centrar}</button>
    <button class="btn-ajustes" id="btn-ajustes" type="button" aria-expanded="false" aria-controls="ajustes">${ICO.ajustes}<span>Ajustes</span></button>
  </div>
</div>

<div class="tooltip" id="tooltip" hidden aria-hidden="true"></div>
<div class="fondo-ajustes" id="fondo-ajustes" hidden></div>
<aside class="ajustes" id="ajustes" hidden role="dialog" aria-labelledby="aj-titulo">
  <div class="aj-cab"><h2 id="aj-titulo">Ajustes</h2><button class="x" id="aj-x" type="button" aria-label="Cerrar los ajustes">${ICO.cerrar}</button></div>
  <div class="aj-cuerpo" id="aj-cuerpo"></div>
  <div class="aj-pie">
    <button class="btn" id="aj-copiar" type="button">Copiar enlace de esta combinación</button>
    <button class="btn" id="aj-reset" type="button">Restablecer</button>
    <p class="aj-estado" id="aj-estado" aria-live="polite"></p>
  </div>
</aside>`;
}

function montarAjustes() {
  const c = $("aj-cuerpo");
  c.innerHTML = Object.entries(OPC).map(([k, g]) => `
    <fieldset class="aj-grupo"><legend>${g.t}</legend>
      <div class="aj-seg">${g.o.map(([v, t]) => `
        <label><input type="radio" name="aj-${k}" value="${v}"${aj[k] === v ? " checked" : ""}><span>${k === "paleta"
          ? `<i class="muestra" style="--m1:${MUESTRA[v][0]};--m2:${MUESTRA[v][1]}"></i>` : ""}${t}</span></label>`).join("")}
      </div>
    </fieldset>`).join("") + `<p class="aj-nota" id="aj-nota-mov" hidden>Tu sistema pide menos movimiento: la autorrotación y las animaciones quedan paradas.</p>`;
  c.addEventListener("change", e => {
    const inp = e.target; if (!inp.name || !inp.name.startsWith("aj-")) return;
    aj[inp.name.slice(3)] = inp.value; aplicarAjuste(inp.name.slice(3));
  });
  $("aj-nota-mov").hidden = !reduceMov.matches;
}
function marcarAjustes() {
  for (const k in aj) document.querySelectorAll(`input[name="aj-${k}"]`).forEach(i => { i.checked = i.value === aj[k]; });
}

let ajustesAbiertos = false;
function abrirAjustes() {
  const p = $("ajustes"), f = $("fondo-ajustes");
  ajustesAbiertos = true; p.hidden = false; f.hidden = false;
  $("btn-ajustes").setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => p.classList.add("abierto"));
  const marcado = p.querySelector("input:checked"); if (marcado) marcado.focus({ preventScroll: true });
}
function cerrarAjustes() {
  if (!ajustesAbiertos) return;
  const p = $("ajustes"), f = $("fondo-ajustes");
  ajustesAbiertos = false; p.classList.remove("abierto"); f.hidden = true;
  $("btn-ajustes").setAttribute("aria-expanded", "false");
  setTimeout(() => { if (!ajustesAbiertos) p.hidden = true; }, reduceMov.matches ? 0 : 280);
  $("btn-ajustes").focus({ preventScroll: true });
}
async function copiarEnlace() {
  const url = location.href, est = $("aj-estado");
  try { await navigator.clipboard.writeText(url); est.textContent = "Enlace copiado."; return; } catch (e) { /* alternativa abajo */ }
  const ta = document.createElement("textarea");
  ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.top = "0"; ta.style.left = "0"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  ta.remove();
  est.textContent = ok ? "Enlace copiado." : "No se ha podido copiar. Este es el enlace: " + url;
}
function restablecer() {
  aj = { ...AJ_DEF }; marcarAjustes(); aplicarAjuste("*");
  $("aj-estado").textContent = "Ajustes restablecidos.";
}
function aplicarAjuste(k) {
  ajustesAlDOM(); guardarAjustes();
  if (k !== "*") $("aj-estado").textContent = "";
  if (!listo) return;
  if (k === "*" || k === "paleta" || k === "brillo" || k === "color") temaEscena();
  if (k === "*" || k === "tam") tamanos();
  if (k === "*" || k === "enlaces") enlaces.obj.visible = aj.enlaces === "si";
  if (k === "*" || k === "rotar") controles.autoRotate = rotacionPermitida();
  medirEtiquetas();
  leyenda(); contar();
  requestAnimationFrame(() => { encuadrar(false); sucio = true; });
  sucio = true;
}

/* ─────────── estado ─────────── */
let THREE, OrbitControls, CSS2DRenderer, CSS2DObject, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass;
let D = null, S = [], listo = false, sucio = true;
const filtro = { redes: new Set(REDES), tipo: "todos", q: "", toks: [] };
let renderer, scene, camera, controles, etiquetas, compFinal, compBrillo, bloom, mezcla, bloomActivo = true;
let hover = null, sel = null, ultimaInteraccion = -1e9, ahoraMs = 0;
let lineas = [], enlaces = null, puntosBase = null;
const zona = {};                              // globo: zonas por red · galaxia: brazos por red
let logo, logoOcl, halo, reticula, anilloRepro, vistaInicial = null;
let R = 40, R0 = 17, R1 = 130;                // radio de la esfera (globo) · radios interior y exterior (galaxia)
const CAPA = 1;                               // capa de las cosas que brillan (bloom selectivo: el logo no brilla)
const TEX = {};
const repro = { activa: false, t0: 0, hasta: -1, T: [], dur: 20000 };

/* ─────────── arranque ─────────── */
ajustesAlDOM();
document.body.insertAdjacentHTML("afterbegin", plantilla());
montarAjustes();
guardarAjustes();
conectarInterfaz();
Promise.all([
  fetch("mapa_videos.json?" + Date.now()).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
  cargarTres(),
]).then(([datos]) => { D = datos; montar(); })
  .catch(e => {
    const a = $("aviso"); a.classList.add("error");
    a.textContent = `No se ha podido cargar el mapa (${e && e.message ? e.message : e}). Prueba a recargar la página.`;
    console.warn("Mapa de vídeos:", e);
  });

async function cargarTres() {
  const m = await Promise.all([
    import("three"),
    import("three/addons/controls/OrbitControls.js"),
    import("three/addons/renderers/CSS2DRenderer.js"),
    import("three/addons/postprocessing/EffectComposer.js"),
    import("three/addons/postprocessing/RenderPass.js"),
    import("three/addons/postprocessing/UnrealBloomPass.js"),
    import("three/addons/postprocessing/OutputPass.js"),
    import("three/addons/postprocessing/ShaderPass.js"),
  ]);
  THREE = m[0]; OrbitControls = m[1].OrbitControls; CSS2DRenderer = m[2].CSS2DRenderer; CSS2DObject = m[2].CSS2DObject;
  EffectComposer = m[3].EffectComposer; RenderPass = m[4].RenderPass; UnrealBloomPass = m[5].UnrealBloomPass;
  OutputPass = m[6].OutputPass; ShaderPass = m[7].ShaderPass;
}

function conectarInterfaz() {
  $("btn-ajustes").addEventListener("click", () => ajustesAbiertos ? cerrarAjustes() : abrirAjustes());
  $("aj-x").addEventListener("click", cerrarAjustes);
  $("fondo-ajustes").addEventListener("click", cerrarAjustes);
  $("aj-copiar").addEventListener("click", copiarEnlace);
  $("aj-reset").addEventListener("click", restablecer);
  $("f-x").addEventListener("click", () => cerrarFicha(true));
  $("ley-btn").addEventListener("click", () => leyendaAbierta(!($("ley-btn").getAttribute("aria-expanded") === "true")));
  leyendaAbierta(!matchMedia("(max-width: 720px)").matches);
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (ajustesAbiertos) { cerrarAjustes(); return; }
    if (!$("resultados").hidden) { mostrarResultados(false); return; }
    if (sel) cerrarFicha(true);
  });
  reduceMov.addEventListener?.("change", () => { $("aj-nota-mov").hidden = !reduceMov.matches; if (listo) controles.autoRotate = rotacionPermitida(); });
}
function leyendaAbierta(si) {
  $("ley-btn").setAttribute("aria-expanded", String(si));
  $("ley-cuerpo").classList.toggle("cerrada", !si);
  $("ley-cuerpo").setAttribute("aria-hidden", String(!si));
  $("ley-cuerpo").inert = !si;
  if (listo) encuadrar(false);
}

/* ─────────── datos → estrellas ─────────── */
function montar() {
  const nodos = (D.nodos || []).filter(n => RED[n.red]).slice().sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  if (!nodos.length) { $("aviso").textContent = "Todavía no hay vídeos en mapa_videos.json."; return; }
  S = nodos.map((n, i) => ({
    i, n, red: n.red, tipo: TIPOS.includes(n.tipo) ? n.tipo : (n.red === "youtube" ? "short" : "reel"),
    v: Math.max(0, +n.vis || 0), l: Math.max(0, +n.likes || 0), tn: norm(n.titulo),
    t: Date.parse((n.fecha || "").replace(" ", "T")) || 0, grupo: n.grupo || null,
    pos: new THREE.Vector3(), a: 0, k: 0, lit: true, match: false, aparece: 0, d: 1,
  }));
  for (const red of REDES) {
    const L = S.filter(s => s.red === red);
    for (const s of L) { s.puesto = 1 + L.filter(o => o.v > s.v).length; s.totalRed = L.length; }
  }
  $("ley-fuente").textContent = `Datos: YouTube API y Metricool · ${fecha(D.generado)}${hora(D.generado) ? ", " + hora(D.generado) : ""}`;
  montarFiltros();
  try { crearEscena(); }
  catch (e) {
    const a = $("aviso"); a.classList.add("error");
    a.textContent = "Este navegador no puede pintar el mapa en 3D (hace falta WebGL).";
    console.warn("Mapa de vídeos:", e); return;
  }
  $("aviso").hidden = true;
  $("play").disabled = false;
  listo = true;
  leyenda(); aplicarFiltros();
  requestAnimationFrame(bucle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { medirEtiquetas(); encuadrar(false); });
}

/* ─────────── filtros, búsqueda y contadores ─────────── */
function montarFiltros() {
  const cuenta = r => S.filter(s => s.red === r).length;
  $("chips").innerHTML = REDES.map(r => `<button type="button" class="chip" data-red="${r}" aria-pressed="true" style="--c:${RED[r].color}">
      <i></i><span>${RED[r].nombre}</span><b>${fmt(cuenta(r))}</b></button>`).join("");
  const nTipo = t => t === "todos" ? S.length : S.filter(s => s.tipo === t).length;
  $("tipos").innerHTML = FILTRO_TIPO.map(([t, nombre]) => `<label><input type="radio" name="tipo" value="${t}"${t === "todos" ? " checked" : ""}>
      <span>${nombre} <b>${fmt(nTipo(t))}</b></span></label>`).join("");
  $("chips").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    const r = b.dataset.red, on = !filtro.redes.has(r);
    on ? filtro.redes.add(r) : filtro.redes.delete(r);
    b.setAttribute("aria-pressed", String(on));
    aplicarFiltros();
  });
  $("tipos").addEventListener("change", e => { filtro.tipo = e.target.value; aplicarFiltros(); });
  const q = $("q");
  let espera = 0;
  q.addEventListener("input", () => {
    clearTimeout(espera);
    espera = setTimeout(() => { filtro.q = q.value; aplicarFiltros(); mostrarResultados(!!filtro.toks.length); }, 120);
    $("q-x").hidden = !q.value;
  });
  q.addEventListener("focus", () => { if (filtro.toks.length) mostrarResultados(true); });
  q.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { const b = $("resultados").querySelector("button"); if (b) { e.preventDefault(); b.focus(); } }
  });
  $("q-x").addEventListener("click", () => { q.value = ""; $("q-x").hidden = true; filtro.q = ""; aplicarFiltros(); mostrarResultados(false); q.focus(); });
  $("resultados").addEventListener("keydown", e => {
    const bs = [...$("resultados").querySelectorAll("button")], i = bs.indexOf(document.activeElement);
    if (e.key === "ArrowDown" && i < bs.length - 1) { e.preventDefault(); bs[i + 1].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? bs[i - 1] : q).focus(); }
  });
  document.addEventListener("pointerdown", e => { if (!$("busca").contains(e.target)) mostrarResultados(false); });
  $("play").addEventListener("click", () => repro.activa ? pararRepro() : empezarRepro());
  $("centrar").addEventListener("click", () => volverAVista());
  // en móvil la fila de filtros se desplaza: el degradado del borde avisa de que hay más, y se quita al llegar al final
  const fila = document.querySelector(".filtros");
  const finFila = () => fila.classList.toggle("al-final", fila.scrollLeft + fila.clientWidth >= fila.scrollWidth - 2);
  fila.addEventListener("scroll", finFila, { passive: true }); addEventListener("resize", finFila); finFila();
}

function aplicarFiltros() {
  filtro.toks = norm(filtro.q).split(/\s+/).filter(Boolean);
  for (const s of S) {
    const ok = filtro.redes.has(s.red) && (filtro.tipo === "todos" || s.tipo === filtro.tipo);
    s.match = filtro.toks.length > 0 && filtro.toks.every(t => s.tn.includes(t));
    s.lit = ok && (!filtro.toks.length || s.match);
  }
  pintarResultados();
  contar();
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
  $("c-n").textContent = fmt(n); $("c-vis").textContent = fmt(vis); $("c-lk").textContent = fmt(lk);
  for (const r of REDES) {
    const z = zona[r]; if (!z || !z.lblN) continue;
    const txt = porRed[r] === totalRed[r] ? fmt(totalRed[r]) : `${fmt(porRed[r])} de ${fmt(totalRed[r])}`;
    if (z.lblN.textContent !== txt) { z.lblN.textContent = txt; const e = ETIQ.find(x => x.red === r); if (e) e.w = 0; }
  }
  if (listo) $("escena").setAttribute("aria-label", `Mapa 3D (${MODO === "globo" ? "globo" : "galaxia"}) de ${plural(n, "vídeo", "vídeos")} de TodoEnRecambio: ${fmt(vis)} visualizaciones y ${fmt(lk)} me gusta. Usa el buscador para abrir la ficha de un vídeo.`);
}

function pintarResultados() {
  const caja = $("resultados");
  if (!filtro.toks.length) { caja.innerHTML = ""; return; }
  const L = S.filter(s => s.lit).sort((a, b) => b.v - a.v);
  caja.innerHTML = "";
  const p = document.createElement("p"); p.className = "res-n";
  p.textContent = L.length ? `${plural(L.length, "coincidencia", "coincidencias")}${L.length > 6 ? " · las 6 más vistas" : ""}` : "Sin coincidencias con los filtros elegidos.";
  caja.appendChild(p);
  const ul = document.createElement("ul");
  for (const s of L.slice(0, 6)) {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.style.setProperty("--c", RED[s.red].color);
    const i = document.createElement("i"), t = document.createElement("span"), m = document.createElement("span");
    t.className = "res-t"; t.textContent = s.n.titulo || "(sin título)";
    m.className = "res-m"; m.textContent = `${RED[s.red].nombre} · ${fecha(s.n.fecha)} · ${fmt(s.n.vis)} vis.`;
    b.append(i, t, m);
    b.addEventListener("click", () => { mostrarResultados(false); seleccionar(s, true); });
    li.appendChild(b); ul.appendChild(li);
  }
  caja.appendChild(ul);
}
function mostrarResultados(si) {
  const caja = $("resultados");
  caja.hidden = !si || !filtro.toks.length;
  $("q").setAttribute("aria-expanded", String(!caja.hidden));
}

/* ─────────── escena ─────────── */
function crearEscena() {
  const cont = $("escena");
  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NoToneMapping;
  cont.appendChild(renderer.domElement);

  etiquetas = new CSS2DRenderer();
  etiquetas.setSize(innerWidth, innerHeight);
  etiquetas.domElement.className = "etiquetas";
  cont.appendChild(etiquetas.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(MODO === "globo" ? 40 : 34, innerWidth / innerHeight, 0.5, 6000);
  crearTexturas();

  // composición: el bloom se calcula aparte solo con la capa que brilla (el logo real queda tal cual)
  const muestras = renderer.capabilities.isWebGL2 && pr < 2 ? 4 : 0;
  compFinal = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: muestras }));
  compFinal.setPixelRatio(pr);
  compFinal.addPass(new RenderPass(scene, camera));
  compBrillo = new EffectComposer(renderer);
  compBrillo.renderToScreen = false;
  compBrillo.setPixelRatio(pr * 0.5);
  compBrillo.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.55, 0);
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
  compFinal.setSize(innerWidth, innerHeight);
  compBrillo.setSize(innerWidth, innerHeight);

  controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true; controles.dampingFactor = 0.08;
  controles.rotateSpeed = 0.7; controles.zoomSpeed = 0.9;
  controles.autoRotateSpeed = 0.55;
  controles.addEventListener("start", () => { ultimaInteraccion = ahoraMs; controles.autoRotate = false; });
  controles.addEventListener("change", () => { sucio = true; });

  crearEstrellas();
  if (MODO === "globo") montarGlobo(); else montarGalaxia();
  crearLogo();
  crearEnlaces();

  reticula = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.reticula, color: ROJO_TDR, transparent: true, depthTest: false, depthWrite: false }));
  reticula.renderOrder = 10; reticula.visible = false; scene.add(reticula);

  temaEscena(); tamanos();
  enlaces.obj.visible = aj.enlaces === "si";
  encuadrar(true);
  controles.autoRotate = rotacionPermitida();

  // entrada: las estrellas aparecen por orden de fecha en poco más de un segundo (sin animación si se pide menos movimiento)
  const t0 = performance.now() + 150;
  for (const s of S) s.aparece = reduceMov.matches ? 0 : t0 + 1100 * (s.i / S.length);
  prepararRepro();

  addEventListener("resize", redimensionar);
  conectarPuntero();
}

function lienzo(T, dibuja) {
  const c = document.createElement("canvas"); c.width = c.height = T;
  dibuja(c.getContext("2d"), T / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function crearTexturas() {
  const PI2 = Math.PI * 2;
  // estrella para fondo oscuro: núcleo (≈ 48 % del sprite) y un resplandor corto (el resto lo pone el bloom);
  // el vídeo largo lleva además un anillo fino
  const brillo = (g, r, anillo) => {
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,1)");
    gr.addColorStop(0.42, "rgba(255,255,255,0.75)"); gr.addColorStop(0.5, "rgba(255,255,255,0.4)");
    gr.addColorStop(0.62, "rgba(255,255,255,0.12)"); gr.addColorStop(0.8, "rgba(255,255,255,0.03)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 2 * r, 2 * r);
    if (anillo) { g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = r * 0.06; g.beginPath(); g.arc(r, r, r * 0.8, 0, PI2); g.stroke(); }
  };
  // estrella para fondo claro: disco con borde del mismo tono más oscuro y sombra suave
  const disco = (g, r, anillo) => {
    const sh = g.createRadialGradient(r, r, r * 0.42, r, r, r * 0.72);
    sh.addColorStop(0, "rgba(0,0,0,0.20)"); sh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh; g.fillRect(0, 0, 2 * r, 2 * r);
    const rd = anillo ? r * 0.4 : r * 0.48;
    g.fillStyle = "#fff"; g.beginPath(); g.arc(r, r, rd, 0, PI2); g.fill();
    g.strokeStyle = "rgb(92,92,92)"; g.lineWidth = r * 0.07; g.beginPath(); g.arc(r, r, rd - r * 0.035, 0, PI2); g.stroke();
    if (anillo) { g.strokeStyle = "rgb(105,105,105)"; g.lineWidth = r * 0.08; g.beginPath(); g.arc(r, r, r * 0.74, 0, PI2); g.stroke(); }
  };
  TEX.oscuro = lienzo(128, (g, r) => brillo(g, r, false));
  TEX.oscuroLargo = lienzo(128, (g, r) => brillo(g, r, true));
  TEX.claro = lienzo(128, (g, r) => disco(g, r, false));
  TEX.claroLargo = lienzo(128, (g, r) => disco(g, r, true));
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

/* tamaño del núcleo (unidades de escena) ∝ raíz de visualizaciones o de me gusta, acotado */
const DMIN = MODO === "globo" ? 1.2 : 1.15, DMAX = MODO === "globo" ? 5.6 : 4.6, HALO_ESTRELLA = 2.1;
let vMax = 1, lMax = 1;
function crearEstrellas() {
  vMax = Math.max(1, ...S.map(s => s.v)); lMax = Math.max(1, ...S.map(s => s.l));
  const grupo = new THREE.Group(); scene.add(grupo);
  for (const s of S) {
    s.dVis = DMIN + (DMAX - DMIN) * Math.sqrt(s.v / vMax);
    s.dLk = DMIN + (DMAX - DMIN) * Math.sqrt(s.l / lMax);
    s.mat = new THREE.SpriteMaterial({ map: TEX.oscuro, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    s.spr = new THREE.Sprite(s.mat);
    s.spr.layers.enable(CAPA); s.spr.visible = false;
    grupo.add(s.spr);
  }
}
function tamanos() { for (const s of S) s.d = aj.tam === "likes" ? s.dLk : s.dVis; sucio = true; }
function colorDe(s) { return aj.color === "tipo" ? COLOR_TIPO[esClaro() ? "claro" : "oscuro"][s.tipo] : RED[s.red].color; }

function crearLogo() {
  const tex = new THREE.TextureLoader().load("../../logo-tdr.png", () => { sucio = true; });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const LD = MODO === "globo" ? R * 0.34 : R0 * 1.4;
  const pos = new THREE.Vector3(0, MODO === "globo" ? 0 : LD * 0.5 + 0.6, 0);
  // el halo va antes que el logo y el logo escribe profundidad: lo que está detrás no lo pisa y lo que está delante sí
  halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.halo, color: ROJO_TDR, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4 }));
  halo.position.copy(pos); halo.scale.setScalar(LD * 2.5); halo.renderOrder = -2;
  logo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: true, alphaTest: 0.02 }));
  logo.position.copy(pos); logo.scale.setScalar(LD); logo.renderOrder = -1;
  // en la pasada del brillo el logo es un disco negro: tapa el halo y lo que queda detrás, y no brilla
  logoOcl = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x000000, transparent: true, depthWrite: true, alphaTest: 0.5 }));
  logoOcl.position.copy(pos); logoOcl.scale.setScalar(LD); logoOcl.renderOrder = -1; logoOcl.layers.set(CAPA);
  scene.add(halo, logo, logoOcl);
  logo.userData.radio = LD * 0.5;
}

/* ─────────── líneas con alfa por vértice ───────────
   tramo = { p: [Vector3...], vis: () => 0..1, color: (c0, c1) => void, alfa: u => 0..1 } */
function conjunto(tramos, brilla = true) {
  let nv = 0;
  for (const t of tramos) { t.v0 = nv; nv += (t.p.length - 1) * 2; }
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 4);
  for (const t of tramos) {
    let k = t.v0;
    for (let j = 0; j < t.p.length - 1; j++) for (let q = j; q <= j + 1; q++) { const p = t.p[q]; pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; k++; }
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
        for (let j = 0; j < n; j++) for (let q = j; q <= j + 1; q++) {
          const u = q / n; cc.copy(c0).lerp(c1, u);
          col[k * 4] = cc.r; col[k * 4 + 1] = cc.g; col[k * 4 + 2] = cc.b; col[k * 4 + 3] = t.alfa(u) * f; k++;
        }
      }
      geo.attributes.color.needsUpdate = true;
    },
  };
  lineas.push(cj);
  return cj;
}
function lineasSimples(puntos, opacidad, cerrar = false) {    // rejilla, anillos y bordes de zona (no brillan)
  const geo = new THREE.BufferGeometry().setFromPoints(puntos);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: opacidad, depthWrite: false });
  const obj = cerrar ? new THREE.LineLoop(geo, mat) : new THREE.LineSegments(geo, mat);
  obj.userData.opacidad = opacidad;
  scene.add(obj);
  return obj;
}
let refRejilla = [];                                            // líneas de referencia que toman el color --rejilla
let refRed = [];                                                // líneas de referencia del color de una red

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
  R = extMax / (2 * Math.sin(THREE.MathUtils.degToRad(40) / 2));
  // 3) casquetes (latitud, longitud en grados). La cámara empieza mirando a la longitud 0: YouTube a la izquierda y las
  //    otras tres a la derecha, de modo que el centro, donde está el logo, queda despejado en la primera vista
  const CENTRO = { youtube: [10, -56], tiktok: [26, 50], instagram: [-24, 56], facebook: [4, 94] };
  const dir = (lat, lon) => { const a = THREE.MathUtils.degToRad(lat), o = THREE.MathUtils.degToRad(lon); return new THREE.Vector3(Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)); };
  const arriba = new THREE.Vector3(0, 1, 0);
  for (const red of REDES) {
    const c = dir(...CENTRO[red]);
    const u = new THREE.Vector3().crossVectors(arriba, c).normalize(), v = new THREE.Vector3().crossVectors(c, u);
    const ang = 2 * Math.asin(Math.min(1, plano[red].ext / (2 * R)));
    for (const s of plano[red].L) {
      const r = Math.hypot(s.px, s.py), phi = Math.atan2(s.py, s.px);
      const th = 2 * Math.asin(Math.min(1, r / (2 * R)));          // proyección de igual área (Lambert) sobre la esfera
      s.pos.copy(c).multiplyScalar(Math.cos(th)).addScaledVector(u, Math.sin(th) * Math.cos(phi)).addScaledVector(v, Math.sin(th) * Math.sin(phi)).multiplyScalar(R);
    }
    const nodo = c.clone().multiplyScalar(R * 0.52);
    zona[red] = { c, u, v, ang, nodo, n: plano[red].L.length };
  }
  for (const s of S) s.spr.position.copy(s.pos);

  // rejilla de la esfera (meridianos y paralelos, muy tenue)
  const pts = [], Rg = R * 0.985;
  for (const lat of [-60, -30, 0, 30, 60]) for (let k = 0; k < 72; k++) pts.push(dir(lat, k * 5).multiplyScalar(Rg), dir(lat, (k + 1) * 5).multiplyScalar(Rg));
  for (let lon = 0; lon < 360; lon += 30) for (let lat = -80; lat < 80; lat += 5) pts.push(dir(lat, lon).multiplyScalar(Rg), dir(lat + 5, lon).multiplyScalar(Rg));
  refRejilla.push(lineasSimples(pts, 0.07));

  // borde de cada zona, nodo de red, líneas finísimas estrella → nodo y nodo → TDR
  const radios = [], ejes = [];
  for (const red of REDES) {
    const z = zona[red]; if (!z.n) continue;
    const a = z.ang + THREE.MathUtils.degToRad(2.5), borde = [];
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
  // puntos que deben caber en pantalla: la esfera (con margen para las etiquetas de red)
  for (let k = 0; k < 96; k++) {
    const y = 1 - 2 * (k + 0.5) / 96, rr = Math.sqrt(1 - y * y), a = k * Math.PI * (3 - Math.sqrt(5));
    puntosEncuadre.push(new THREE.Vector3(rr * Math.cos(a), y, rr * Math.sin(a)).multiplyScalar(R * 1.1));
  }
}

/* ─────────── GALAXIA: un brazo por red; distancia = orden de publicación, altura = visualizaciones ─────────── */
const radioDe = idx => R0 + (R1 - R0) * (idx + 0.5) / Math.max(1, S.length);
const BRAZO = { youtube: 0, tiktok: Math.PI / 2, instagram: Math.PI, facebook: Math.PI * 1.5 };
const PASO_ESPIRAL = 1 / Math.tan(THREE_RAD(21));
function THREE_RAD(g) { return g * Math.PI / 180; }
const anguloDe = (red, r) => BRAZO[red] + Math.log(r / R0) * PASO_ESPIRAL;
let HMAX = 56;
function montarGalaxia() {
  for (const s of S) {
    const r = radioDe(s.i);
    const jit = ((s.i * 0.6180339887) % 1 - 0.5) * 4.8;            // anchura del brazo, siempre igual para el mismo vídeo
    const th = anguloDe(s.red, r) + jit / r;
    s.h = Math.max(0.6, HMAX * Math.sqrt(s.v / vMax));
    s.base = new THREE.Vector3(r * Math.cos(th), 0, r * Math.sin(th));
    s.pos.set(s.base.x, s.h, s.base.z);
    s.spr.position.copy(s.pos);
  }
  // suelo tenue
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(R1 + 14, 96), new THREE.MeshBasicMaterial({ map: TEX.suelo, transparent: true, depthWrite: false, opacity: 0.1 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -0.05; scene.add(suelo); refRejilla.push(suelo); suelo.userData.opacidad = 0.1;

  // guía de cada brazo + etiqueta en su extremo
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

  // pilares (como barras en 3D) y su pie en el plano
  const pilares = S.map(s => ({ p: [s.base, s.pos], vis: () => s.a, color: (c0, c1) => { c0.set(colorDe(s)); c1.copy(c0); }, alfa: u => 0.07 + 0.5 * u }));
  conjunto(pilares);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(S.flatMap(s => [s.base.x, 0.02, s.base.z])), 3));
  pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(S.length * 4), 4));
  puntosBase = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.5, map: TEX.punto, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(puntosBase);

  // anillos de referencia: donde empieza cada uno de los últimos meses y cada año (sin pisarse)
  const inicios = [];
  let prevMes = "";
  S.forEach((s, i) => { const m = (s.n.fecha || "").slice(0, 7); if (m !== prevMes) { inicios.push({ m, i }); prevMes = m; } });
  // candidatos: los cuatro últimos meses con vídeos y el primer mes con vídeos de cada año (etiqueta «sep 2026», «may 2023»)
  const recientes = new Set(inicios.slice(-4).map(x => x.m));
  const candidatos = inicios.filter((x, k) => recientes.has(x.m) || k === 0 || x.m.slice(0, 4) !== inicios[k - 1].m.slice(0, 4));
  const elegidos = [];
  for (const x of candidatos.slice().reverse()) {                 // de fuera hacia dentro; si dos se pisan, gana el más reciente
    const r = R0 + (R1 - R0) * x.i / S.length;
    if (elegidos.length && elegidos[elegidos.length - 1].r - r < 6.5) continue;
    elegidos.push({ ...x, r });
  }
  elegidos.forEach((x, k) => {
    const pts = []; for (let j = 0; j < 128; j++) { const a = j / 128 * Math.PI * 2; pts.push(new THREE.Vector3(x.r * Math.cos(a), 0, x.r * Math.sin(a))); }
    refRejilla.push(lineasSimples(pts, 0.16, true));
    const [y, mm] = x.m.split("-");
    const texto = `${MES[+mm - 1]} ${y}`;
    const a = THREE_RAD(64);
    etiquetaMes(texto, new THREE.Vector3(x.r * Math.cos(a), 0.2, x.r * Math.sin(a)), 500 - k);   // la más reciente, primero
  });
  // anillo de la reproducción (fecha que avanza)
  const pr = []; for (let k = 0; k < 160; k++) { const a = k / 160 * Math.PI * 2; pr.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); }
  anilloRepro = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pr), new THREE.LineBasicMaterial({ color: ROJO_TDR, transparent: true, opacity: 0.9, depthWrite: false }));
  anilloRepro.position.y = 0.08; anilloRepro.visible = false; anilloRepro.layers.enable(CAPA); scene.add(anilloRepro);
  // puntos que deben caber en pantalla: el borde del disco (donde van las etiquetas de los brazos) y la punta de cada pilar
  for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; puntosEncuadre.push(new THREE.Vector3((R1 + 12) * Math.cos(a), 0, (R1 + 12) * Math.sin(a))); }
  for (const s of S) puntosEncuadre.push(s.pos);
}

function etiquetaRed(red, pos) {
  const el = document.createElement("div"); el.className = "lbl lbl-red";
  const inn = document.createElement("span"); inn.className = "lbl-in"; inn.style.setProperty("--c", RED[red].color);
  const i = document.createElement("i"), b = document.createElement("b"), n = document.createElement("span");
  b.textContent = RED[red].nombre; n.className = "n"; n.textContent = fmt(zona[red].n);
  inn.append(i, b, n); el.appendChild(inn);
  const o = new CSS2DObject(el); o.position.copy(pos); scene.add(o);
  Object.assign(zona[red], { lbl: o, lblIn: inn, lblN: n });
  ETIQ.push({ obj: o, inn, pos: pos.clone(), prio: 1000 + zona[red].n, tipo: "red", red, w: 0, h: 0 });
  ETIQ.sort((a, b) => b.prio - a.prio);
}
function etiquetaMes(texto, pos, prio) {
  const el = document.createElement("div"); el.className = "lbl lbl-mes";
  const inn = document.createElement("span"); inn.className = "lbl-in"; inn.textContent = texto; el.appendChild(inn);
  const o = new CSS2DObject(el); o.position.copy(pos); scene.add(o);
  ETIQ.push({ obj: o, inn, pos: pos.clone(), prio, tipo: "mes", w: 0, h: 0 });
  ETIQ.sort((a, b) => b.prio - a.prio);
}
const medirEtiquetas = () => { for (const e of ETIQ) e.w = 0; };

/* arcos «misma pieza en varias redes» */
function crearEnlaces() {
  const porGrupo = new Map();
  for (const s of S) if (s.grupo != null) { if (!porGrupo.has(s.grupo)) porGrupo.set(s.grupo, []); porGrupo.get(s.grupo).push(s); }
  const tramos = [];
  for (const L of porGrupo.values()) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], p = [];
    for (let k = 0; k <= 28; k++) {
      const t = k / 28;
      if (MODO === "globo") {
        // curva sobre la esfera que pasa por arriba (hacia el polo norte) para no cruzar por delante del logo
        const ua = a.pos.clone().normalize(), ub = b.pos.clone().normalize();
        const w = ua.clone().add(ub).add(new THREE.Vector3(0, 2.2 * ua.angleTo(ub) / Math.PI, 0)).normalize();
        const v = esferica(esferica(ua, w, t), esferica(w, ub, t), t);
        p.push(v.multiplyScalar(R * (1 + 0.08 * Math.sin(Math.PI * t))));
      } else {
        const m = a.pos.clone().add(b.pos).multiplyScalar(0.5); m.y += 6 + a.pos.distanceTo(b.pos) * 0.08;
        const q = new THREE.Vector3().copy(a.pos).multiplyScalar((1 - t) * (1 - t)).addScaledVector(m, 2 * t * (1 - t)).addScaledVector(b.pos, t * t);
        p.push(q);
      }
    }
    const [a0, a1] = MODO === "globo" ? [0.22, 0.2] : [0.12, 0.14];
    tramos.push({ p, vis: () => Math.min(a.a, b.a), color: (c0, c1) => { c0.set(colorEnlace); c1.copy(c0); }, alfa: u => a0 + a1 * Math.sin(Math.PI * u) });
  }
  enlaces = conjunto(tramos);
}
let colorEnlace = "#ffffff";
function esferica(a, b, t) {                                    // interpolación esférica entre dos vectores unitarios
  const ang = a.angleTo(b), s = Math.sin(ang);
  if (s < 1e-5) return a.clone();
  return a.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(b.clone().multiplyScalar(Math.sin(t * ang) / s)).normalize();
}

/* ─────────── tema de la escena (paleta, brillo, color por) ─────────── */
const equilibrio = c => { const L = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; return Math.min(1.25, Math.max(0.6, Math.pow(0.25 / Math.max(L, 0.01), 0.4))); };
function temaEscena() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  const claro = esClaro(), nb = { bajo: 0, medio: 1, alto: 2 }[aj.brillo];
  scene.background = new THREE.Color(v("--escena") || "#050913");
  bloomActivo = !claro;
  bloom.strength = [0.3, 0.5, 0.8][nb]; bloom.radius = 0.3; bloom.threshold = 0;
  mezcla.uniforms.fuerza.value = bloomActivo ? 1 : 0;
  const inten = claro ? 1 : [0.75, 0.95, 1.2][nb];
  for (const s of S) {
    s.mat.map = s.tipo === "largo" ? (claro ? TEX.claroLargo : TEX.oscuroLargo) : (claro ? TEX.claro : TEX.oscuro);
    s.mat.blending = claro ? THREE.NormalBlending : THREE.AdditiveBlending;
    s.mat.color.set(colorDe(s));
    // en oscuro (luz que se suma) se iguala el brillo: el cian de TikTok luce el triple que el rojo y saturaría
    if (!claro) s.mat.color.multiplyScalar(inten * equilibrio(s.mat.color));
    s.mat.needsUpdate = true;
  }
  colorEnlace = v("--enlace-escena") || "#ffffff";
  const fl = claro ? [1.3, 1.6, 2][nb] : [0.7, 1, 1.35][nb];
  for (const cj of lineas) { cj.factor = fl; cj.mat.blending = claro ? THREE.NormalBlending : THREE.AdditiveBlending; cj.mat.needsUpdate = true; cj.pintar(); }
  const rej = v("--rejilla") || "#8ea6db";
  for (const o of refRejilla) { o.material.color.set(rej); o.material.opacity = Math.min(1, o.userData.opacidad * (claro ? 1.9 : 1)); }
  for (const o of refRed) { o.material.color.set(RED[o.userData.red].color); o.material.opacity = claro ? 0.6 : 0.34; }
  if (puntosBase) { puntosBase.material.blending = claro ? THREE.NormalBlending : THREE.AdditiveBlending; puntosBase.material.needsUpdate = true; }
  for (const red of REDES) { const z = zona[red]; if (z && z.sprNodo) { z.sprNodo.material.blending = claro ? THREE.NormalBlending : THREE.AdditiveBlending; z.sprNodo.material.color.set(RED[red].color); } }
  halo.material.blending = claro ? THREE.NormalBlending : THREE.AdditiveBlending;
  halo.material.opacity = claro ? 0.2 : [0.28, 0.4, 0.55][nb];
  if (anilloRepro) anilloRepro.material.opacity = claro ? 1 : 0.9;
  sucio = true;
}

/* ─────────── encuadre de la cámara ─────────── */
const desplaz = { x: 0, y: 0, ax: 0, ay: 0, listo: false };       // desplazamiento de la vista (objetivo y actual)
function aplicarDesplaz() {
  camera.setViewOffset(innerWidth, innerHeight, -desplaz.ax, -desplaz.ay, innerWidth, innerHeight);
  camera.updateProjectionMatrix();
}
function encuadrar(inicial) {
  const W = innerWidth, H = innerHeight, r = $("medio").getBoundingClientRect(), movil = W <= 720;
  // en ordenador el mapa se centra en el hueco que deja la leyenda abierta (a su derecha)
  const ley = $("ley-cuerpo");
  const izq = !movil && !ley.classList.contains("cerrada") ? ley.getBoundingClientRect().right + 8 : 0;
  const ancho = Math.max(240, W - izq - 16), alto = Math.max(160, r.height);
  desplaz.x = (izq + (W - izq) / 2) - W / 2;
  desplaz.y = (r.top + r.height / 2) - H / 2;
  if (inicial || !desplaz.listo || reduceMov.matches) { desplaz.ax = desplaz.x; desplaz.ay = desplaz.y; desplaz.listo = true; }
  camera.aspect = W / H;
  aplicarDesplaz();
  let ajuste;
  if (MODO === "globo") {
    controles.enablePan = false;
    const objetivo = new THREE.Vector3();
    ajuste = distanciaQueCabe(THREE_RAD(76), 0, objetivo, puntosEncuadre, ancho - 32, alto - (movil ? 24 : 16), 0);
    controles.minDistance = R * 1.45; controles.maxDistance = Math.max(ajuste.d * 2.2, R * 4);
    vistaInicial = { pos: new THREE.Vector3().setFromSphericalCoords(ajuste.d, THREE_RAD(76), 0), target: objetivo };
  } else {
    controles.enablePan = true; controles.screenSpacePanning = false;
    controles.maxPolarAngle = THREE_RAD(86);
    const polar = THREE_RAD(movil ? 36 : 58), azim = THREE_RAD(18), objetivo = new THREE.Vector3(0, movil ? 4 : 8, 0);
    ajuste = distanciaQueCabe(polar, azim, objetivo, puntosEncuadre, ancho - 24, alto - 16, 0.7);
    controles.minDistance = 30; controles.maxDistance = ajuste.d * 2.2;
    vistaInicial = { pos: new THREE.Vector3().setFromSphericalCoords(ajuste.d, polar, azim).add(objetivo), target: objetivo };
  }
  desplaz.x -= ajuste.sx; desplaz.y -= ajuste.sy;
  if (inicial || reduceMov.matches) { desplaz.ax = desplaz.x; desplaz.ay = desplaz.y; aplicarDesplaz(); }
  if (inicial) { camera.position.copy(vistaInicial.pos); controles.target.copy(vistaInicial.target); controles.update(); }
  sucio = true;
}
/* Distancia a la que todo `puntos` cabe en ancho × alto px. `fr` (0..1) es cuánto se centra la caja de lo que se ve en vez
   del pivote de giro: el disco inclinado de la galaxia queda más abajo que su centro y así se aprovecha el hueco. */
let puntosEncuadre = [];
function distanciaQueCabe(polar, azim, objetivo, puntos, ancho, alto, fr) {
  const cam = camera.clone(), v = new THREE.Vector3(), W = innerWidth, H = innerHeight;
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
let vuelo = null;
function volverAVista() {
  if (!vistaInicial) return;
  ultimaInteraccion = ahoraMs;
  if (reduceMov.matches) { camera.position.copy(vistaInicial.pos); controles.target.copy(vistaInicial.target); controles.update(); sucio = true; return; }
  vuelo = { t0: ahoraMs, p0: camera.position.clone(), q0: controles.target.clone() };
}
function redimensionar() {
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H); compFinal.setSize(W, H); compBrillo.setSize(W, H); etiquetas.setSize(W, H);
  encuadrar(false);
}

/* ─────────── autorrotación ─────────── */
function rotacionPermitida() { return aj.rotar === "si" && !reduceMov.matches && !sel; }

/* ─────────── puntero: hover, clic y toque ─────────── */
const _v = { x: 0, y: 0, z: 0 };
let pv;
function aPantalla(p) {
  pv.copy(p).project(camera);
  _v.x = (pv.x + 1) / 2 * innerWidth; _v.y = (1 - pv.y) / 2 * innerHeight; _v.z = pv.z;
  return _v;
}
function elegir(x, y, radioMin) {
  let mejor = null, mejorD = Infinity;
  const cam = camera.position, tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), H = innerHeight;
  const lp = aPantalla(logo.position), lx = lp.x, ly = lp.y, dLogo = cam.distanceTo(logo.position);
  const lr = logo.userData.radio / (dLogo * tanF) * (H / 2);
  for (const s of S) {
    if (!s.lit || s.a < 0.5 || !s.spr.visible) continue;
    const p = aPantalla(s.pos); if (p.z > 1) continue;
    const dist = cam.distanceTo(s.pos);
    const rpx = (s.d * s.k * 0.5) / (dist * tanF) * (H / 2);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > Math.max(radioMin, rpx + 4)) continue;
    if (dist > dLogo && Math.hypot(p.x - lx, p.y - ly) < lr) continue;            // tapada por el logo
    const pts = d + dist * 0.004;
    if (pts < mejorD) { mejorD = pts; mejor = s; }
  }
  return mejor;
}
function conectarPuntero() {
  pv = new THREE.Vector3();
  const cv = renderer.domElement;
  let abajo = null, pendiente = null;
  cv.addEventListener("pointerdown", e => { abajo = { x: e.clientX, y: e.clientY, t: performance.now() }; ultimaInteraccion = ahoraMs; controles.autoRotate = false; });
  cv.addEventListener("pointerup", e => {
    if (!abajo) return;
    const mov = Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y), dur = performance.now() - abajo.t;
    abajo = null;
    if (mov > 6 || dur > 600) return;
    const s = elegir(e.clientX, e.clientY, e.pointerType === "mouse" ? 12 : 24);
    if (s) seleccionar(s, false); else if (sel) cerrarFicha(false);
  });
  cv.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    if (e.buttons) { if (hover) { hover = null; ocultarTooltip(); } return; }
    pendiente = { x: e.clientX, y: e.clientY };
    requestAnimationFrame(() => {
      if (!pendiente) return;
      const { x, y } = pendiente; pendiente = null;
      const s = elegir(x, y, 12);
      if (s !== hover) { hover = s; sucio = true; }
      cv.style.cursor = s ? "pointer" : "";
      s ? mostrarTooltip(s, x, y) : ocultarTooltip();
    });
  });
  cv.addEventListener("pointerleave", () => { pendiente = null; if (hover) { hover = null; sucio = true; } ocultarTooltip(); });
}

function rellenarRed(el, s) {
  el.style.setProperty("--c", RED[s.red].color);
  el.querySelector("span").textContent = RED[s.red].nombre;
}
function mostrarTooltip(s, x, y) {
  const tt = $("tooltip");
  tt.innerHTML = `<div class="tt-m"><span class="etq-red"><i></i><span></span></span> · <span class="tt-tipo"></span></div>
    <p class="tt-t"></p><div class="tt-m tt-f"></div><div class="tt-c"><div><b class="tt-v"></b> <span>visualizaciones</span></div><div><b class="tt-l"></b> <span>me gusta</span></div></div>`;
  rellenarRed(tt.querySelector(".etq-red"), s);
  tt.querySelector(".tt-tipo").textContent = TIPO[s.tipo];
  tt.querySelector(".tt-t").textContent = s.n.titulo || "(sin título)";
  tt.querySelector(".tt-f").textContent = fecha(s.n.fecha) + (hora(s.n.fecha) ? " · " + hora(s.n.fecha) : "");
  tt.querySelector(".tt-v").textContent = fmt(s.n.vis);
  tt.querySelector(".tt-l").textContent = fmt(s.n.likes);
  tt.hidden = false;
  const w = tt.offsetWidth, h = tt.offsetHeight;
  let l = x + 16, t = y + 16;
  if (l + w > innerWidth - 8) l = x - w - 16;
  if (t + h > innerHeight - 8) t = y - h - 16;
  tt.style.transform = `translate(${Math.max(8, l)}px, ${Math.max(8, t)}px)`;
}
function ocultarTooltip() { $("tooltip").hidden = true; }

/* ─────────── ficha ─────────── */
function seleccionar(s, foco) {
  sel = s; ocultarTooltip();
  controles.autoRotate = false;
  rellenarRed($("f-red"), s);
  $("f-tipo").textContent = TIPO[s.tipo];
  $("f-titulo").textContent = s.n.titulo || "(sin título)";
  $("f-fecha").textContent = `Publicado el ${fecha(s.n.fecha)}${hora(s.n.fecha) ? " a las " + hora(s.n.fecha) : ""}`;
  $("f-vis").textContent = fmt(s.n.vis);
  $("f-lk").textContent = fmt(s.n.likes);
  const p = $("f-puesto"); p.textContent = "";
  if (s.totalRed > 1) {
    const b = document.createElement("b"); b.textContent = `Puesto ${fmt(s.puesto)} de ${fmt(s.totalRed)}`;
    p.append(b, ` en ${RED[s.red].nombre} por visualizaciones`);
  }
  const otros = s.grupo != null ? S.filter(o => o.grupo === s.grupo && o !== s) : [];
  $("f-misma").hidden = !otros.length;
  const l = $("f-misma-l"); l.innerHTML = "";
  for (const o of otros) {
    const b = document.createElement("button"); b.type = "button"; b.style.setProperty("--c", RED[o.red].color);
    const i = document.createElement("i"), t = document.createElement("span"), n = document.createElement("b");
    t.textContent = RED[o.red].nombre; n.textContent = fmt(o.n.vis);
    b.append(i, t, n); b.title = `${RED[o.red].nombre}: ${fmt(o.n.vis)} visualizaciones`;
    b.addEventListener("click", () => seleccionar(o, true));
    l.appendChild(b);
  }
  const ver = $("f-ver"); ver.href = s.n.url || "#"; ver.hidden = !s.n.url;
  ver.setAttribute("aria-label", `Ver el vídeo en ${RED[s.red].nombre} (se abre en una pestaña nueva)`);
  const f = $("ficha");
  if (f.hidden) { f.hidden = false; requestAnimationFrame(() => f.classList.add("abierta")); }
  if (foco) $("f-titulo").focus({ preventScroll: true });
  reticula.visible = true;
  sucio = true;
}
function cerrarFicha(devolverFoco) {
  if (!sel) return;
  const prev = sel; sel = null; reticula.visible = false;
  const f = $("ficha"); f.classList.remove("abierta");
  setTimeout(() => { if (!sel) f.hidden = true; }, reduceMov.matches ? 0 : 300);
  if (devolverFoco && document.activeElement && f.contains(document.activeElement)) $("q").focus({ preventScroll: true });
  ultimaInteraccion = ahoraMs;
  sucio = true;
  return prev;
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
  repro.activa = true; repro.t0 = ahoraMs; repro.hasta = -1;
  $("play").setAttribute("aria-pressed", "true");
  $("play").setAttribute("aria-label", "Parar la reproducción");
  $("reloj").hidden = false;
  if (anilloRepro) anilloRepro.visible = true;
  contar(); sucio = true;
}
function pararRepro() {
  repro.activa = false;
  $("play").setAttribute("aria-pressed", "false");
  $("play").setAttribute("aria-label", "Reproducir crecimiento");
  $("reloj").hidden = true;
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
  $("reloj-fecha").textContent = fechaDe(ts);
  $("reloj-barra").style.transform = `scaleX(${Math.min(1, t / repro.dur)})`;
  if (anilloRepro) anilloRepro.scale.setScalar(radioDe(idxF));
  if (cambio) contar();
  if (t >= repro.dur) pararRepro();
}

/* ─────────── bucle ─────────── */
let ultimo = performance.now();
function bucle(ahora) {
  requestAnimationFrame(bucle);
  ahoraMs = ahora;
  const dt = Math.min(0.1, Math.max(0, (ahora - ultimo) / 1000)); ultimo = ahora;
  let mover = false;

  if (rotacionPermitida() && !controles.autoRotate && ahora - ultimaInteraccion > 15000) controles.autoRotate = true;
  if (!rotacionPermitida() && controles.autoRotate) controles.autoRotate = false;
  if (vuelo) {
    const u = Math.min(1, (ahora - vuelo.t0) / 800), e = 1 - Math.pow(1 - u, 3);
    camera.position.lerpVectors(vuelo.p0, vistaInicial.pos, e); controles.target.lerpVectors(vuelo.q0, vistaInicial.target, e);
    if (u >= 1) vuelo = null;
    mover = true;
  }
  if (desplaz.ax !== desplaz.x || desplaz.ay !== desplaz.y) {       // la vista se recoloca con suavidad (p. ej. al plegar la leyenda)
    const f = 1 - Math.exp(-dt * 10);
    desplaz.ax += (desplaz.x - desplaz.ax) * f; desplaz.ay += (desplaz.y - desplaz.ay) * f;
    if (Math.abs(desplaz.x - desplaz.ax) < 0.5 && Math.abs(desplaz.y - desplaz.ay) < 0.5) { desplaz.ax = desplaz.x; desplaz.ay = desplaz.y; }
    aplicarDesplaz(); mover = true;
  }
  if (controles.update(dt)) mover = true;
  if (MODO === "galaxia") {                                       // que no se pierda el centro al desplazar
    const t = controles.target, lim = R1 * 0.7, l = Math.hypot(t.x, t.z);
    if (l > lim) { t.x *= lim / l; t.z *= lim / l; }
    t.y = Math.min(Math.max(t.y, -5), HMAX);
  }
  if (repro.activa) { avanzarRepro(); mover = true; }
  if (animarEstrellas(dt, ahora)) mover = true;
  if (reticula.visible) {
    if (!reduceMov.matches) reticula.material.rotation += dt * 0.5;
    reticula.position.copy(sel.pos); reticula.scale.setScalar(sel.d * Math.max(sel.k, 0.5) * 2.4 + 3);
    mover = true;
  }
  if (mover || sucio) { colocarEtiquetas(); pintar(); sucio = false; }
}

const DIM_OSCURO = 0.08, DIM_CLARO = 0.14;
function animarEstrellas(dt, ahora) {
  const f = reduceMov.matches ? 1 : 1 - Math.exp(-dt * 9);
  const dim = esClaro() ? DIM_CLARO : DIM_OSCURO;
  let activo = false;
  for (const s of S) {
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

/* Etiquetas: las de red del globo se ponen al lado de su nodo, hacia fuera del logo; todas se quedan dentro de la
   pantalla y no se pisan (las de red se apartan; las de mes más antiguas se esconden si chocan). */
const ETIQ = [];                      // { obj, inn, pos, prio, tipo: "red"|"mes", red?, w, h }
function colocarEtiquetas() {
  const W = innerWidth, H = innerHeight, tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const lp = aPantalla(logo.position), lx = lp.x, ly = lp.y;
  const lr = logo.userData.radio / (camera.position.distanceTo(logo.position) * tanF) * (H / 2);
  const haciaCam = camera.position.clone().normalize();
  const ocupado = [{ l: lx - lr, r: lx + lr, t: ly - lr, b: ly + lr }];
  const choca = q => ocupado.find(o => q.l < o.r && q.r > o.l && q.t < o.b && q.b > o.t);
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
      e.obj.element.classList.toggle("lejos", zona[e.red].c.dot(haciaCam) < -0.2);
    }
    cx = Math.min(Math.max(cx, 8 + e.w / 2), W - 8 - e.w / 2);
    cy = Math.min(Math.max(cy, 8 + e.h / 2), H - 8 - e.h / 2);
    const caja = () => ({ l: cx - e.w / 2 - 4, r: cx + e.w / 2 + 4, t: cy - e.h / 2 - 3, b: cy + e.h / 2 + 3 });
    let q = caja(), o = choca(q);
    if (o && e.tipo === "red") {                                    // se aparta arriba o abajo, lo que menos mueva
      const abajo = o.b - q.t, arriba = q.b - o.t;
      cy += abajo < arriba ? abajo : -arriba; q = caja(); o = null;   // las de red siempre se ven
    }
    const oculta = !!o && e.tipo === "mes";
    e.inn.classList.toggle("oculta", oculta);
    if (oculta) continue;
    e.inn.style.transform = `translate(${(cx - px).toFixed(1)}px, ${(cy - py).toFixed(1)}px)`;
    ocupado.push(q);
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
  const claro = esClaro();
  const items = aj.color === "tipo"
    ? TIPOS.map(t => [t === "largo" ? "Vídeo largo" : t === "short" ? "Short" : "Reel (Instagram, TikTok, Facebook)", COLOR_TIPO[claro ? "claro" : "oscuro"][t]])
    : REDES.map(r => [RED[r].nombre, RED[r].color]);
  $("ley-color-t").textContent = aj.color === "tipo" ? "Color = tipo" : "Color = red";
  const ul = $("ley-colores"); ul.innerHTML = "";
  for (const [t, c] of items) { const li = document.createElement("li"), i = document.createElement("i"); i.style.setProperty("--c", c); li.append(i, t); ul.appendChild(li); }
  $("ley-tam").textContent = aj.tam === "likes" ? "Tamaño = me gusta" : "Tamaño = visualizaciones";
  $("ley-modo").textContent = MODO === "globo"
    ? "Cada red ocupa su zona; dentro, lo más visto queda en el centro. Líneas finísimas: vídeo → nodo de su red → TDR."
    : "Un brazo por red. Distancia al centro = orden de publicación: cada vídeo queda un paso más afuera que el anterior, así ago–oct 2026 no se aplasta; cada anillo marca dónde empieza un mes. Altura y pilar = visualizaciones.";
  $("ley-enlaces").textContent = aj.enlaces === "si" ? "Arcos: la misma pieza subida a varias redes el mismo día." : "";
  $("ley-enlaces").hidden = aj.enlaces !== "si";
}
