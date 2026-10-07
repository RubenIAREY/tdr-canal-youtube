/* Sección «Futuro · modelo predictivo» del Panel de redes de TodoEnRecambio (TDR), como módulo para una pestaña.

     const { montarFuturo } = await import("../comun/futuro.js");
     const futuro = await montarFuturo(contenedor, { datos: "../datos/prediccion.json", eventos: "../datos/eventos.json" });
     futuro.actualizarTema();   // tras cambiar la paleta, la letra o la textura de la página
     futuro.destruir();         // quita gráficas, escuchadores y el HTML del módulo

   datos y eventos: URL (se leen con fetch) o el objeto ya leído. eventos es opcional.
   Opcionales: red ("global" | "youtube" | …), metrica ("seg" | "vis_dia" | …), horizonte ("1s" | "1m" | "3m" | "6m" | "1a" | "2a"),
   clave (localStorage donde se recuerdan los filtros; por defecto "tdr-futuro").
   Todo número que se ve sale de prediccion.json y eventos.json (formato en PANEL-REDES/_ENCARGO_V2.md).
   Usa las variables CSS de la página y window.LightweightCharts (4.2.3, la carga la página). */

const CSS_URL = new URL("./futuro.css", import.meta.url).href;
const ORDEN_REDES = ["global", "youtube", "instagram", "tiktok", "facebook"];
const RED_DEF = {
  global: { nombre: "Global", largo: "Todas las redes", corto: "TOTAL", color: "#d71119" },
  youtube: { nombre: "YouTube", largo: "YouTube", corto: "YT", color: "#ff3b30" },
  instagram: { nombre: "Instagram", largo: "Instagram", corto: "IG", color: "#e1306c" },
  tiktok: { nombre: "TikTok", largo: "TikTok", corto: "TT", color: "#25f4ee" },
  facebook: { nombre: "Facebook", largo: "Facebook", corto: "FB", color: "#1877f2" },
};
const ORDEN_MET = ["seg", "vis_dia", "vis_acum", "lk_dia", "lk_acum", "horas_12m"];
const MET_DEF = {
  seg: { nombre: "Seguidores", tipo: "nivel", ev: "seg" },
  vis_dia: { nombre: "Visualizaciones al día", tipo: "flujo", ev: "vis" },
  vis_acum: { nombre: "Visualizaciones acumuladas", tipo: "nivel", ev: "vis" },
  lk_dia: { nombre: "Me gusta al día", tipo: "flujo", ev: "likes" },
  lk_acum: { nombre: "Me gusta acumulados", tipo: "nivel", ev: "likes" },
  horas_12m: { nombre: "Horas vistas de vídeos largos (12 meses)", tipo: "nivel", ev: "vis" },
};
const PLAZOS = [["1s", 7, "1 semana"], ["1m", 30, "1 mes"], ["3m", 91, "3 meses"], ["6m", 182, "6 meses"], ["1a", 365, "1 año"], ["2a", 730, "2 años"]];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIA = 864e5;
let instancias = 0;

/* ─────────── formato (es-ES, miles siempre agrupados) ─────────── */
const fmt = (n, d = 0) => n == null || !isFinite(n) ? "–" : Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
const decs = n => n != null && Math.abs(n) < 10 && Math.round(n * 10) !== Math.round(n) * 10 ? 1 : 0;
const fmtN = n => fmt(n, decs(n));
const signo = (n, d = 0) => n == null || !isFinite(n) ? "–" : (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), d);
const cls = n => n == null || !isFinite(n) || Math.abs(n) < 1e-9 ? "igual" : n > 0 ? "sube" : "baja";
const flecha = n => n == null || !isFinite(n) ? "" : n > 0 ? "▲ " : n < 0 ? "▼ " : "■ ";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const aMs = s => Date.parse(String(s).slice(0, 10) + "T00:00:00Z");
const aIso = ms => new Date(ms).toISOString().slice(0, 10);
const sumar = (s, n) => aIso(aMs(s) + n * DIA);
const dias = (a, b) => Math.round((aMs(b) - aMs(a)) / DIA);
const fecha = s => { if (!s) return "–"; const [y, m, d] = String(s).slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]} ${y}`; };
const fechaCorta = s => { const [, m, d] = String(s).slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]}`; };
const mesAno = s => { if (!s) return "–"; const [y, m] = String(s).slice(0, 7).split("-"); return `${MES[+m - 1]} ${y}`; };
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const punto = s => String(s || "").trim().replace(/[.\s]+$/, "") + ".";
const recortar = (s, n) => s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
const claveT = t => t == null ? null : typeof t === "string" ? t : typeof t === "number" ? aIso(t * 1000) :
  `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;

/* ─────────── colores ─────────── */
function rgb(c) {
  c = String(c || "").trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { let h = m[1]; if (h.length <= 4) h = h.split("").map(x => x + x).join(""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  m = c.match(/rgba?\(([^)]+)\)/i);
  if (m) return m[1].split(/[ ,/]+/).slice(0, 3).map(Number);
  return null;
}
const hex = a => "#" + a.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
const rgba = (c, a) => { const v = rgb(c) || [0, 0, 0]; return `rgba(${v[0]},${v[1]},${v[2]},${a})`; };
function lum(v) { const f = x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }; return .2126 * f(v[0]) + .7152 * f(v[1]) + .0722 * f(v[2]); }
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
/* el color de la red, oscurecido o aclarado hacia la tinta hasta que se lea sobre el papel (3:1 para líneas) */
function legible(color, fondo, tinta) {
  const c = rgb(color), f = rgb(fondo), t = rgb(tinta);
  if (!c || !f || !t) return color;
  for (let k = 0; k <= 1.0001; k += .05) {
    const m = c.map((x, i) => x + (t[i] - x) * k);
    if (contraste(m, f) >= 3.2) return hex(m);
  }
  return hex(t);
}

/* ─────────── carga ─────────── */
async function leer(fuente) {
  if (fuente == null) return null;
  if (typeof fuente !== "string") return fuente;
  const r = await fetch(fuente + (fuente.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function cargarCss() {
  const ya = [...document.styleSheets].some(s => s.href === CSS_URL);
  let l = document.querySelector("link[data-fu-css]");
  if (ya && !l) return Promise.resolve(null);
  if (!l) {
    l = document.createElement("link"); l.rel = "stylesheet"; l.href = CSS_URL; l.dataset.fuCss = "";
    document.head.appendChild(l);
  }
  if (l.sheet) return Promise.resolve(l);
  return new Promise(res => {
    const fin = () => res(l);
    l.addEventListener("load", fin, { once: true }); l.addEventListener("error", fin, { once: true }); setTimeout(fin, 4000);
  });
}

const ICONO = {
  lleno: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>`,
  salir: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4"/></svg>`,
  cerrar: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>`,
  abajo: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>`,
  derecha: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 3l3 3-3 3"/></svg>`,
};

/* ─────────── capa propia de la gráfica: zona de previsión, banda p10–p90 rellena y raya del último dato real ───────────
   Primitiva de serie de lightweight-charts 4.x (series.attachPrimitive): dibuja en el mismo lienzo, por debajo de las líneas. */
class CapaPrevision {
  constructor(o) { this.o = o; this.v = { fondo: new VistaFondo(this), banda: new VistaBanda(this), hoy: new VistaHoy(this) }; }
  attached({ chart, series }) { this.chart = chart; this.serie = series; }
  detached() { this.chart = null; this.serie = null; }
  updateAllViews() { Object.values(this.v).forEach(v => v.update()); }
  paneViews() { return [this.v.fondo, this.v.banda, this.v.hoy]; }
  x(t) { return this.chart ? this.chart.timeScale().timeToCoordinate(t) : null; }
}
class VistaFondo {
  constructor(c) { this.c = c; this.x = null; }
  update() { this.x = this.c.x(this.c.o.hoy); }
  zOrder() { return "bottom"; }
  renderer() {
    const x = this.x, color = this.c.o.zona;
    return { draw(t) { if (x == null) return; t.useBitmapCoordinateSpace(({ context: c, bitmapSize: b, horizontalPixelRatio: h }) => {
      c.fillStyle = color; c.fillRect(Math.round(x * h), 0, b.width, b.height); }); } };
  }
}
class VistaBanda {
  constructor(c) { this.c = c; this.p = []; }
  update() {
    const c = this.c, s = c.serie; this.p = [];
    if (!c.chart || !s) return;
    for (const q of c.o.banda) {
      const x = c.x(q.time); if (x == null) continue;
      const a = s.priceToCoordinate(q.hi), b = s.priceToCoordinate(q.lo);
      if (a == null || b == null) continue;
      this.p.push([x, a, b]);
    }
  }
  zOrder() { return "bottom"; }
  renderer() {
    const p = this.p, color = this.c.o.relleno;
    return { draw(t) { if (p.length < 2) return; t.useBitmapCoordinateSpace(({ context: c, horizontalPixelRatio: h, verticalPixelRatio: v }) => {
      c.beginPath(); c.moveTo(p[0][0] * h, p[0][1] * v);
      for (let i = 1; i < p.length; i++) c.lineTo(p[i][0] * h, p[i][1] * v);
      for (let i = p.length - 1; i >= 0; i--) c.lineTo(p[i][0] * h, p[i][2] * v);
      c.closePath(); c.fillStyle = color; c.fill(); }); } };
  }
}
class VistaHoy {
  constructor(c) { this.c = c; this.x = null; this.xh = null; }
  update() { this.x = this.c.x(this.c.o.hoy); this.xh = this.c.o.hoyDe ? this.c.x(this.c.o.hoyDe) : null; }
  zOrder() { return "top"; }
  renderer() {
    const x = this.x, xh = this.xh, o = this.c.o;
    return { draw(t) { if (x == null) return; t.useBitmapCoordinateSpace(({ context: c, bitmapSize: b, horizontalPixelRatio: h, verticalPixelRatio: v }) => {
      const X = Math.round(x * h) + .5;
      c.save(); c.strokeStyle = o.raya; c.lineWidth = Math.max(1, h); c.setLineDash([4 * h, 4 * h]);
      c.beginPath(); c.moveTo(X, 0); c.lineTo(X, b.height); c.stroke(); c.setLineDash([]);
      c.font = `600 ${10 * v}px ${o.letra}`; c.textBaseline = "top";
      const pinta = (txt, xx0, der, y) => {
        const w = c.measureText(txt).width, pad = 4 * h, xx = der ? xx0 + 6 * h : xx0 - 6 * h - w - pad * 2;
        if (xx < 0 || xx + w + pad * 2 > b.width) return;
        c.fillStyle = o.fondoEtq; c.fillRect(xx, y - 2 * v, w + pad * 2, 15 * v);
        c.fillStyle = o.texto; c.fillText(txt, xx + pad, y + 1 * v);
      };
      pinta(o.etqReal, X, false, 6 * v); pinta(o.etqPrev, X, true, 6 * v);
      // hoy (el día en que se hizo la previsión), si cae después del último dato real: raya fina continua con su fecha abajo
      if (xh != null && Math.abs(xh - x) >= 2) {
        const XH = Math.round(xh * h) + .5;
        c.strokeStyle = o.texto; c.lineWidth = Math.max(1, h); c.globalAlpha = .7;
        c.beginPath(); c.moveTo(XH, 22 * v); c.lineTo(XH, b.height); c.stroke(); c.globalAlpha = 1;
        pinta(o.etqHoy, XH, true, b.height - 18 * v);
      }
      c.restore(); }); } };
  }
}

/* zona rayada con rótulo (meses en los que el canal aún no cobra): primitiva de serie, por debajo de las barras */
class CapaRayada {
  constructor(o) { this.o = o; this.r = null; const yo = this; this.vista = { zOrder: () => "bottom", renderer: () => yo.pintor() }; }
  attached({ chart }) { this.chart = chart; }
  detached() { this.chart = null; }
  paneViews() { return [this.vista]; }
  updateAllViews() {
    this.r = null; const o = this.o, t = o.tiempos;
    if (!this.chart || t.length < 2) return;
    const ts = this.chart.timeScale(), x0 = ts.timeToCoordinate(t[0]), x1 = ts.timeToCoordinate(t[1]);
    if (x0 == null || x1 == null) return;
    const m = (x1 - x0) / 2, xb = o.hasta ? ts.timeToCoordinate(o.hasta) : ts.timeToCoordinate(t[t.length - 1]);
    if (xb == null) return;
    this.r = [x0 - m, o.hasta ? xb - m : xb + m];
  }
  pintor() {
    const r = this.r, o = this.o;
    return { draw(tg) { if (!r || r[1] - r[0] < 2) return; tg.useBitmapCoordinateSpace(({ context: c, bitmapSize: b, horizontalPixelRatio: h, verticalPixelRatio: v }) => {
      const a = Math.max(0, r[0] * h), z = Math.min(b.width, r[1] * h);
      c.save(); c.beginPath(); c.rect(a, 0, z - a, b.height); c.clip();
      c.fillStyle = o.fondo; c.fillRect(a, 0, z - a, b.height);
      c.strokeStyle = o.raya; c.lineWidth = Math.max(1, h);
      for (let x = a - b.height; x < z; x += 9 * h) { c.beginPath(); c.moveTo(x, b.height); c.lineTo(x + b.height, 0); c.stroke(); }
      c.restore();
      c.save(); c.font = `600 ${10 * v}px ${o.letra}`; c.textBaseline = "top";
      const w = c.measureText(o.texto).width, pad = 5 * h;
      if (w + pad * 2 < z - a) { const xx = a + (z - a - w) / 2 - pad, y = 8 * v;
        c.fillStyle = o.fondoEtq; c.fillRect(xx, y - 3 * v, w + pad * 2, 17 * v); c.fillStyle = o.tinta; c.fillText(o.texto, xx + pad, y + 1 * v); }
      c.restore(); }); } };
  }
}

/* ═══════════════════════════════════════════ módulo ═══════════════════════════════════════════ */
export async function montarFuturo(contenedor, opciones = {}) {
  if (!contenedor) throw new Error("montarFuturo: falta el contenedor");
  const LC = window.LightweightCharts;
  const uid = "fu" + (++instancias) + Math.random().toString(36).slice(2, 6);
  const CLAVE = opciones.clave || "tdr-futuro";
  const linkCss = await cargarCss();
  const raiz = document.createElement("section");
  raiz.className = "fu";
  raiz.setAttribute("aria-labelledby", uid + "-tit");
  contenedor.appendChild(raiz);

  const avisos = [];
  let P = null, E = null;
  const [rp, re] = await Promise.allSettled([leer(opciones.datos), leer(opciones.eventos)]);
  if (rp.status === "fulfilled" && rp.value && rp.value.redes) P = rp.value;
  if (re.status === "fulfilled" && re.value) E = Array.isArray(re.value) ? { eventos: re.value } : re.value;
  else if (opciones.eventos) avisos.push("No se han podido leer los eventos (eventos.json): la gráfica va sin marcas de lo que pasó.");

  const vacio = { actualizarTema() {}, destruir() { raiz.remove(); } };
  if (!P) {
    const motivo = rp.status === "rejected" ? (rp.reason && rp.reason.message) || String(rp.reason) : "sin datos";
    raiz.innerHTML = `<p class="fu-nota fu-error">La previsión todavía no está lista: no se ha podido leer prediccion.json (${esc(motivo)}).</p>`;
    return vacio;
  }

  /* ─── estado ─── */
  const redesHay = ORDEN_REDES.filter(r => P.redes[r]);
  const metricas = Object.assign({}, MET_DEF);
  Object.entries(P.metricas || {}).forEach(([k, m]) => { metricas[k] = Object.assign({}, MET_DEF[k] || { ev: "vis" }, m); });
  const ordenMet = [...ORDEN_MET, ...Object.keys(metricas).filter(k => !ORDEN_MET.includes(k))];
  const plazos = PLAZOS.map(([k, d, n]) => { const h = (P.horizontes || []).find(x => x.k === k); return { k, dias: h ? h.dias : d, nombre: h ? h.nombre : n }; });
  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { guardado = {}; }
  const est = {
    red: [opciones.red, guardado.red, "global"].find(r => r && P.redes[r]) || redesHay[0],
    met: [opciones.metrica, guardado.met, "seg"].find(m => m && metricas[m]) || "seg",
    hor: [opciones.horizonte, guardado.hor, "6m"].find(h => h && plazos.some(p => p.k === h)) || "6m",
    abierta: null, ficha: null, todosEv: false, esc: "probable", monTabla: false, porQue: new Set(),
  };
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify({ red: est.red, met: est.met, hor: est.hor })); } catch (e) { /* sin almacenamiento */ } };
  const serieDe = (r, m) => (P.redes[r] && P.redes[r].series && P.redes[r].series[m]) || null;
  const tipoDe = m => (metricas[m] && metricas[m].tipo) || "nivel";
  const nombreMet = m => (metricas[m] && metricas[m].nombre) || m;
  const defRed = r => Object.assign({}, RED_DEF[r] || { nombre: r, largo: r, corto: r.slice(0, 2).toUpperCase(), color: "#888888" },
    P.redes[r] && P.redes[r].nombre ? (r === "global" ? { largo: P.redes[r].nombre } : { nombre: P.redes[r].nombre, largo: P.redes[r].nombre }) : {},
    P.redes[r] && P.redes[r].color ? { color: P.redes[r].color } : {});
  function asegurarMetrica() { if (!serieDe(est.red, est.met)) est.met = ordenMet.find(m => serieDe(est.red, m)) || est.met; }
  asegurarMetrica();

  /* ─── tema (variables CSS de la página) ─── */
  let T = null;
  function leerTema() {
    const s = getComputedStyle(raiz), v = (k, d) => s.getPropertyValue(k).trim() || d;
    T = {
      capa1: v("--capa1", "#fbf8f1"), capa2: v("--capa2", "#f3ecdf"), tinta: v("--tinta", "#1b1a18"), suave: v("--tinta-suave", "#57534c"),
      tenue: v("--tinta-tenue", "#7b766e"), linea: v("--linea", "#e0d6c5"), lineaF: v("--linea-fuerte", "#cbbfaa"),
      sube: v("--sube", "#2e7d57"), baja: v("--baja", "#b5701a"), marca: v("--marca", "#d71119"),
      texto: v("--g-texto", v("--tinta-tenue", "#6d6a64")), rejilla: v("--g-rejilla", v("--linea", "#e9e0d0")), borde: v("--g-borde", v("--linea", "#d6cbb8")),
      letra: v("--f-cifra", "monospace"),
    };
    T.sinRejilla = document.documentElement.dataset.rejilla === "no";
  }
  const colorRed = r => legible(defRed(r).color, T.capa1, T.tinta);

  /* ─── esqueleto ─── */
  const HOY = /^\d{4}-\d{2}-\d{2}/.test(P.generado || "") ? P.generado.slice(0, 10) : hoyIso();
  const diasPlazo = k => { const h = (P.horizontes || []).find(x => x.k === k); return h ? h.dias : null; };
  const P_GEN = P.generado ? `${fecha(P.generado)}${P.generado.length > 10 ? " a las " + esc(P.generado.slice(11, 16)) : ""}` : "–";
  raiz.innerHTML = `
    ${P.ejemplo ? `<p class="fu-ejemplo" role="note"><b>DATOS DE EJEMPLO.</b> ${esc(P.aviso || "Sirven para desarrollar esta sección: la previsión, los objetivos y las comprobaciones no son reales.")}</p>` : ""}
    <header class="fu-cab">
      <div class="fu-cab-izq">
        <div class="fu-ticker"><em>TDR</em>:FUTURO</div>
        <h1 id="${uid}-tit">Lo que puede pasar si seguimos así</h1>
        <p class="fu-sub" data-fu="sub"></p>
      </div>
      <p class="fu-promesa"><b>Es una estimación con los datos de hoy, no una promesa.</b> Cuanto más lejos, más ancha es la banda: a más de 1 año, tómalo como orientación.</p>
      <span class="fu-sello" aria-hidden="true">Estimación</span>
    </header>
    <div class="fu-mandos">
      <div class="fu-mando"><span class="fu-et" id="${uid}-et-red">Red</span><div class="fu-grupo" data-fu="redes" role="group" aria-labelledby="${uid}-et-red"></div></div>
      <div class="fu-mando"><span class="fu-et" id="${uid}-et-met">Métrica</span><div class="fu-grupo" data-fu="mets" role="group" aria-labelledby="${uid}-et-met"></div></div>
      <div class="fu-mando"><span class="fu-et" id="${uid}-et-hor">Horizonte de la gráfica</span><div class="fu-grupo" data-fu="hors" role="group" aria-labelledby="${uid}-et-hor"></div></div>
    </div>
    <article class="fu-caja fu-graf-caja fu-numerada caja" data-fu="grafcaja">
      <div class="fu-caja-cab fu-graf-cab">
        <h2 data-fu="graftit"></h2>
        <button type="button" class="fu-icono" data-fu="lleno" aria-pressed="false"></button>
        <div class="fu-leyenda" data-fu="leyenda" aria-live="off"></div>
      </div>
      <div class="fu-grafica" data-fu="grafica" role="img"></div>
      <div class="fu-claves" data-fu="claves"></div>
      <p class="fu-nota fu-graf-nota" data-fu="grafnota"></p>
      <div class="fu-eventos" data-fu="eventos"></div>
    </article>
    <section class="fu-bloque fu-numerada" aria-labelledby="${uid}-t-plazos">
      <h2 id="${uid}-t-plazos" data-fu="plazostit"></h2>
      <div class="fu-tarjetas" data-fu="tarjetas"></div>
      <p class="fu-tarj-clave" data-fu="tarjclave" aria-hidden="true"></p>
    </section>
    <div data-fu="monacceso"></div>
    <section class="fu-caja fu-numerada caja fu-mon" data-fu="mon" aria-labelledby="${uid}-t-mon" hidden></section>
    <div class="fu-doble">
      <section class="fu-caja fu-numerada caja" aria-labelledby="${uid}-t-obj">
        <div class="fu-caja-cab"><h2 id="${uid}-t-obj">Objetivos <small>como la autonomía de un coche eléctrico: cuánto llevas y cuándo llegarías a este ritmo</small></h2></div>
        <div data-fu="hitos"></div>
      </section>
      <div class="fu-col">
        <section class="fu-caja fu-numerada caja" aria-labelledby="${uid}-t-picos">
          <div class="fu-caja-cab"><h2 id="${uid}-t-picos">Hasta dónde puede llegar <small data-fu="picosred"></small></h2></div>
          <div class="fu-picos" data-fu="picos"></div>
        </section>
        <section class="fu-caja fu-numerada caja" aria-labelledby="${uid}-t-acierto">
          <div class="fu-caja-cab"><h2 id="${uid}-t-acierto">¿Acierta el modelo? <small data-fu="aciertored"></small></h2></div>
          <div class="fu-acierto-cuerpo" data-fu="acierto"></div>
        </section>
      </div>
    </div>
    <details class="fu-caja fu-como caja">
      <summary>${ICONO.derecha} Cómo se calcula <small>y qué significa la banda</small></summary>
      <div class="fu-como-txt" data-fu="como"></div>
    </details>
    <div class="fu-avisos" data-fu="avisos"></div>`;
  const $ = k => raiz.querySelector(`[data-fu="${k}"]`);
  const det = document.createElement("div");
  det.className = "fu-det"; det.id = uid + "-det"; det.hidden = true; det.setAttribute("role", "region");

  /* ─── mandos ─── */
  function pintarMandos() {
    $("redes").innerHTML = redesHay.map(r => `<button type="button" data-r="${r}" aria-pressed="${est.red === r}"><i style="background:${esc(defRed(r).color)}"></i>${esc(defRed(r).nombre)}</button>`).join("");
    const mets = ordenMet.filter(m => metricas[m] && (m !== "horas_12m" || serieDe(est.red, m)) && redesHay.some(r => serieDe(r, m)));
    $("mets").innerHTML = mets.map(m => { const hay = !!serieDe(est.red, m);
      return `<button type="button" data-m="${m}" aria-pressed="${est.met === m}"${hay ? "" : ` disabled title="${esc(defRed(est.red).largo)}: sin datos de esta métrica"`}>${esc(nombreMet(m))}</button>`; }).join("");
    $("hors").innerHTML = plazos.map(p => `<button type="button" data-h="${p.k}" aria-pressed="${est.hor === p.k}">${esc(p.nombre)}</button>`).join("");
  }
  raiz.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !raiz.contains(b)) return;
    const g = b.parentElement && b.parentElement.dataset.fu;
    if (g === "redes") { est.red = b.dataset.r; asegurarMetrica(); est.abierta = null; est.ficha = null; est.todosEv = false; cambiar(); }
    else if (g === "mets") { est.met = b.dataset.m; est.ficha = null; est.todosEv = false; cambiar(); }
    else if (g === "hors") { est.hor = b.dataset.h; guardar(); pintarMandos(); encuadrar(); pintarLeyenda(null); }
    else if (g === "escs") { est.esc = b.dataset.e; pintarMon(); const n = raiz.querySelector(`[data-fu="escs"] button[data-e="${CSS.escape(est.esc)}"]`); if (n) n.focus(); }
  });
  function cambiar() { guardar(); pintarTodo(); }

  /* ─── datos de la gráfica ─── */
  function prepararSerie(r, m) {
    const S = serieDe(r, m), red = P.redes[r], tipo = tipoDe(m);
    const hasta = red.datos_hasta || (S.historia && S.historia.length ? S.historia[S.historia.length - 1][0] : hoyIso());
    const H = (S.historia || []).filter(x => x && x[0] <= hasta).sort((a, b) => a[0] < b[0] ? -1 : 1);
    const real = new Map(H.map(x => [x[0], x[1]]));
    const fechas = [];
    if (H.length) for (let t = aMs(H[0][0]), fin = aMs(hasta); t <= fin; t += DIA) fechas.push(aIso(t));
    // media de 7 días (flujo), solo con los días que tienen dato
    const m7 = new Map(); const cola = [];
    fechas.forEach(f => { const v = real.get(f); if (v != null) { cola.push(v); if (cola.length > 7) cola.shift(); m7.set(f, cola.reduce((a, b) => a + b, 0) / cola.length); } });
    // previsión interpolada a diario (la parte semanal también), para que el eje de tiempo sea uniforme
    const pv = (S.prevision || []).filter(x => x && x[0] > hasta).sort((a, b) => a[0] < b[0] ? -1 : 1);
    const prev = [];
    for (let i = 0; i < pv.length; i++) {
      const a = pv[i], b = pv[i + 1];
      prev.push({ t: a[0], p10: a[1], p50: a[2], p90: a[3] });
      if (!b) break;
      const n = dias(a[0], b[0]);
      for (let k = 1; k < n; k++) { const f = k / n; prev.push({ t: sumar(a[0], k), p10: a[1] + (b[1] - a[1]) * f, p50: a[2] + (b[2] - a[2]) * f, p90: a[3] + (b[3] - a[3]) * f, interp: true }); }
    }
    const ultimoReal = [...fechas].reverse().find(f => real.get(f) != null);
    // escenario «si se queda como ahora» (ritmo medio de los últimos 30 días, sin tendencia), interpolado a diario como la previsión
    const cs = (S.constante || []).filter(x => x && x[0] > hasta && x[1] != null).sort((a, b) => a[0] < b[0] ? -1 : 1), cons = [];
    for (let i = 0; i < cs.length; i++) { const a = cs[i], b = cs[i + 1]; cons.push({ t: a[0], v: a[1] }); if (!b) break;
      const n = dias(a[0], b[0]); for (let k = 1; k < n; k++) cons.push({ t: sumar(a[0], k), v: a[1] + (b[1] - a[1]) * k / n, interp: true }); }
    const ancla = tipo === "flujo" ? (m7.get(ultimoReal) ?? S.actual) : (real.get(ultimoReal) ?? S.actual);
    return { S, red, tipo, hasta, fechas, real, m7, prev, cons, ancla, ultimoReal, desde: fechas[0] || hasta };
  }

  /* ─── gráfica ─── */
  let chart = null, sPrinc = null, sP50 = null, sP10 = null, sP90 = null, sM7 = null, sCons = null, capa = null, G = null, evVisibles = [], marcasConTexto = null, rafVis = 0;
  const ro = new ResizeObserver(() => colocarDetalle());
  function quitarGrafica() { if (chart) { chart.remove(); chart = null; } sPrinc = sP50 = sP10 = sP90 = sM7 = sCons = capa = null; }
  function pintarGrafica() {
    quitarGrafica();
    const el = $("grafica"); el.innerHTML = "";
    const r = est.red, m = est.met, S = serieDe(r, m);
    if (!LC || !S) { el.innerHTML = `<p class="fu-nota fu-error">${!LC ? "No se ha cargado la librería de gráficas." : "Sin datos de esta métrica en esta red."}</p>`; return; }
    G = prepararSerie(r, m);
    const col = colorRed(r), flujo = G.tipo === "flujo";
    chart = LC.createChart(el, {
      autoSize: true,
      layout: { background: { type: "solid", color: "rgba(0,0,0,0)" }, textColor: T.texto, fontFamily: T.letra, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: T.sinRejilla ? "rgba(0,0,0,0)" : T.rejilla }, horzLines: { color: T.sinRejilla ? "rgba(0,0,0,0)" : T.rejilla } },
      rightPriceScale: { borderColor: T.borde, scaleMargins: { top: .16, bottom: flujo ? 0 : .06 } },
      timeScale: { borderColor: T.borde, rightOffset: 2, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { mode: LC.CrosshairMode.Normal },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
      localization: { locale: "es-ES", priceFormatter: p => p < -1e-9 ? "" : fmt(p, Math.abs(p) < 10 && Math.round(p) !== p ? 1 : 0), dateFormat: "dd MMM yyyy" },
    });
    const pf = { type: "custom", formatter: p => fmt(p, Math.abs(p) < 10 && Math.round(p) !== p ? 1 : 0), minMove: .1 };
    const base = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: true, priceFormat: pf };
    // previsión: p10 y p90 finas, p50 discontinua; la banda se rellena con la capa propia
    const anc = G.ultimoReal ? [{ time: G.ultimoReal, value: G.ancla }] : [];
    const datosP = k => anc.concat(G.prev.map(x => ({ time: x.t, value: x[k] })));
    sP90 = chart.addLineSeries(Object.assign({}, base, { color: rgba(col, .55), lineWidth: 1, crosshairMarkerVisible: false }));
    sP10 = chart.addLineSeries(Object.assign({}, base, { color: rgba(col, .55), lineWidth: 1, crosshairMarkerVisible: false }));
    sP50 = chart.addLineSeries(Object.assign({}, base, { color: col, lineWidth: 2, lineStyle: LC.LineStyle.Dashed }));
    sP90.setData(datosP("p90")); sP10.setData(datosP("p10")); sP50.setData(datosP("p50"));
    if (G.cons.length) {
      sCons = chart.addLineSeries(Object.assign({}, base, { color: T.suave, lineWidth: 1, lineStyle: LC.LineStyle.Dotted, crosshairMarkerVisible: false }));
      sCons.setData(anc.concat(G.cons.map(x => ({ time: x.t, value: x.v }))));
    }
    // historia: línea continua (nivel) o barras del día + media de 7 días (flujo)
    if (flujo) {
      const bar = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false, priceFormat: pf, color: rgba(col, .26) });
      bar.setData(G.fechas.map(f => G.real.get(f) != null ? { time: f, value: G.real.get(f) } : { time: f }));
      sM7 = chart.addLineSeries(Object.assign({}, base, { color: col, lineWidth: 2 }));
      sM7.setData(G.fechas.map(f => G.m7.has(f) ? { time: f, value: G.m7.get(f) } : { time: f }));
      sPrinc = bar;
    } else {
      sPrinc = chart.addLineSeries(Object.assign({}, base, { color: col, lineWidth: 2 }));
      sPrinc.setData(G.fechas.map(f => G.real.get(f) != null ? { time: f, value: G.real.get(f) } : { time: f }));
    }
    // objetivos de esta red y métrica: raya de puntos con su nombre
    const vistos = new Set();
    (G.tipo === "nivel" ? P.redes[r].hitos || [] : []).filter(h => h.metrica === m && h.objetivo != null && !vistos.has(h.objetivo) && vistos.add(h.objetivo)).forEach(h => {
      sP50.createPriceLine({ price: h.objetivo, color: T.tinta, lineWidth: 1, lineStyle: LC.LineStyle.Dotted, axisLabelVisible: true, title: "Objetivo" });
    });
    capa = new CapaPrevision({
      hoy: G.ultimoReal || G.hasta, hoyDe: HOY > (G.ultimoReal || G.hasta) && G.prev.some(x => x.t === HOY) ? HOY : null, etqHoy: "HOY " + fechaCorta(HOY).toUpperCase(), banda: anc.map(a => ({ time: a.time, lo: a.value, hi: a.value })).concat(G.prev.map(x => ({ time: x.t, lo: x.p10, hi: x.p90 }))),
      relleno: rgba(col, .15), zona: rgba(T.tinta, .035), raya: T.suave, texto: T.suave, fondoEtq: rgba(T.capa1, .85), letra: T.letra,
      etqReal: "◂ REAL", etqPrev: "PREVISIÓN ▸",
    });
    if (typeof sP50.attachPrimitive === "function") sP50.attachPrimitive(capa);
    chart.subscribeCrosshairMove(pintarLeyenda);
    chart.subscribeClick(p => { const t = claveT(p && p.time); if (!t) return; const e = evVisibles.find(x => t >= x.fecha && t <= (x.hasta || x.fecha)) ||
      evVisibles.find(x => Math.abs(dias(x.fecha, t)) <= 1); if (e) abrirFicha(e.id, true); });
    chart.timeScale().subscribeVisibleTimeRangeChange(() => { cancelAnimationFrame(rafVis); rafVis = requestAnimationFrame(alMoverse); });
    marcasConTexto = null;
    encuadrar();
    el.setAttribute("aria-label", `Gráfica de ${nombreMet(m).toLowerCase()} de ${defRed(r).largo}: historia hasta el ${fecha(G.ultimoReal || G.hasta)} y previsión con su banda.`);
  }
  function encuadrar() {
    if (!chart || !G) return;
    const p = plazos.find(x => x.k === est.hor) || plazos[3];
    const fin = G.prev.length ? G.prev[G.prev.length - 1].t : G.hasta;
    const H = G.S.horizontes && G.S.horizontes[p.k];
    const to = [H && H.fecha ? H.fecha : sumar(HOY, p.dias), fin].sort()[0];
    let from = sumar(G.hasta, -Math.max(14, p.dias));
    if (from < G.desde) from = G.desde;
    try { chart.timeScale().setVisibleRange({ from, to }); } catch (e) { chart.timeScale().fitContent(); }
  }

  /* leyenda que sigue al cursor (y, sin cursor, lo que pasa al final del plazo elegido) */
  function pintarLeyenda(param) {
    if (!G) return;
    const el = $("leyenda"), unidad = G.tipo === "flujo" ? " ese día" : "";
    let t = param && param.time ? claveT(param.time) : null, txt = "";
    const enPrev = f => G.prev.find(x => x.t === f);
    if (!t) {
      const p = plazos.find(x => x.k === est.hor), H = G.S.horizontes && G.S.horizontes[p.k];
      t = H && H.fecha ? H.fecha : sumar(HOY, p.dias);
      const q0 = enPrev(t) || G.prev[G.prev.length - 1];
      const q = G.tipo === "nivel" && H ? { t, p10: H.p10, p50: H.p50, p90: H.p90 } : q0;
      const cc = G.tipo === "nivel" && H && H.constante != null ? H.constante : (G.cons.find(x => x.t === (q0 && q0.t)) || {}).v;
      if (q) txt = `<span class="fu-l-f">En ${esc(p.nombre)} · ${fecha(q.t)}</span><span>Lo más probable${unidad} <b>${fmtN(q.p50)}</b></span><span>8 de cada 10 veces entre <b>${fmtN(q.p10)}</b> y <b>${fmtN(q.p90)}</b></span>` +
        (cc != null ? `<span>Si se queda como ahora <b>${fmtN(cc)}</b></span>` : "");
    } else if (t <= G.hasta) {
      const v = G.real.get(t);
      txt = `<span class="fu-l-f">${fecha(t)}</span><span>Real${unidad} <b>${v == null ? "sin dato" : fmtN(v)}</b></span>` +
        (G.tipo === "flujo" && G.m7.has(t) ? `<span>Media de 7 días <b>${fmt(G.m7.get(t), G.m7.get(t) < 10 ? 1 : 0)}</b></span>` : "");
      const ev = evVisibles.filter(x => t >= x.fecha && t <= (x.hasta || x.fecha));
      if (ev.length) txt += `<span>· ${esc(recortar(ev[0].titulo || "", 48))}</span>`;
    } else {
      const q = enPrev(t);
      const c = G.cons.find(x => x.t === t);
      if (q) txt = `<span class="fu-l-f">${fecha(t)}${q.interp ? " · entre dos puntos semanales" : ""}</span><span>Lo más probable${unidad} <b>${fmtN(q.p50)}</b></span><span>8 de cada 10 veces entre <b>${fmtN(q.p10)}</b> y <b>${fmtN(q.p90)}</b></span>` +
        (c ? `<span>Si se queda como ahora <b>${fmtN(c.v)}</b></span>` : "");
    }
    el.innerHTML = txt;
  }

  /* ─── eventos: marcas en la historia y «Qué pasó en este periodo» ─── */
  function eventosDe(r, m) {
    if (!E || !Array.isArray(E.eventos) || !G) return [];
    const fam = (metricas[m] && metricas[m].ev) || MET_DEF.seg.ev;
    return E.eventos.filter(e => e && e.fecha && e.fecha >= G.desde && e.fecha <= G.hasta &&
      (r === "global" ? (e.red === "global" || e.tipo === "hito") : e.red === r) &&
      (e.metrica === fam || e.tipo === "hito")).sort((a, b) => a.fecha < b.fecha ? -1 : 1)
      .filter((e, i, L) => L.findIndex(x => x.fecha === e.fecha && (x.titulo || "") === (e.titulo || "")) === i);
  }
  function rangoVisible() {
    const r = chart && chart.timeScale().getVisibleRange();
    return r ? [claveT(r.from), claveT(r.to)] : [G.desde, G.hasta];
  }
  function alMoverse() {
    if (!chart || !G) return;
    const [a, b] = rangoVisible();
    const todos = eventosDe(est.red, est.met);
    evVisibles = todos.filter(e => e.fecha >= a && e.fecha <= b);
    const span = Math.max(1, dias(a, b)), sep = evVisibles.every((e, i) => !i || dias(evVisibles[i - 1].fecha, e.fecha) >= span * .14);
    const conTexto = evVisibles.length <= 4 && sep && $("grafica").clientWidth >= 560 &&
      evVisibles.every(e => dias(a, e.fecha) >= span * .08);
    const serieMarcas = sM7 || sPrinc;
    if (serieMarcas && marcasConTexto !== conTexto + "|" + todos.length + "|" + evVisibles.map(e => e.id).join()) {
      marcasConTexto = conTexto + "|" + todos.length + "|" + evVisibles.map(e => e.id).join();
      const conDato = G.tipo === "flujo" ? G.m7 : G.real;
      const fijar = f => { let x = f; for (let i = 0; i < 10 && !(conDato.get(x) != null); i++) x = sumar(x, -1); return conDato.get(x) != null ? x : null; };
      const marcas = todos.map(e => { const t = fijar(e.fecha); if (!t) return null;
        const sube = e.tipo === "subida", baja = e.tipo === "bajada";
        return { time: t, position: sube ? "belowBar" : "aboveBar", shape: sube ? "arrowUp" : baja ? "arrowDown" : "circle",
          color: sube ? T.sube : baja ? T.baja : e.tipo === "hito" ? T.tinta : T.tenue, size: 1,
          text: conTexto ? recortar(e.titulo || "", 26) : "" }; }).filter(Boolean).sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
      const vistos = new Set();
      serieMarcas.setMarkers(marcas.filter(x => { const k = x.time + x.shape; if (vistos.has(k)) return false; vistos.add(k); return true; }));
    }
    pintarEventos();
  }
  function pintarEventos() {
    const el = $("eventos");
    if (!E) { el.innerHTML = `<p class="fu-nota">Sin eventos: la gráfica va sin marcas de lo que pasó.</p>`; return; }
    const lista = evVisibles, MAX = 8, ver = est.todosEv ? lista : lista.slice(0, MAX);
    const forma = t => t === "subida" ? "subida" : t === "bajada" ? "bajada" : "punto";
    el.innerHTML = `<div class="fu-ev-cab"><h3>Qué pasó en este periodo</h3><span class="fu-nota">${lista.length
      ? `${fmt(lista.length)} ${lista.length === 1 ? "evento" : "eventos"} en la parte real que se ve · pulsa uno (o su marca) para ver la explicación`
      : "Nada señalado en la parte real que se ve. Amplía el plazo para ver más historia."}</span></div>` +
      (lista.length ? `<ul class="fu-ev-lista">${ver.map(e => `<li><button type="button" class="fu-ev" data-ev="${esc(e.id)}" aria-expanded="${est.ficha === e.id}" aria-controls="${uid}-ficha">
        <i class="fu-ev-s ${forma(e.tipo)}" aria-hidden="true"></i><time datetime="${esc(e.fecha)}">${fechaCorta(e.fecha)}${e.fecha.slice(0, 4) !== hoyIso().slice(0, 4) ? " " + e.fecha.slice(2, 4) : ""}</time><span>${esc(recortar(e.titulo || "", 48))}</span></button></li>`).join("")}
        ${lista.length > MAX ? `<li><button type="button" class="fu-ev-mas" data-evmas="1">${est.todosEv ? "Ver menos" : `Ver los ${fmt(lista.length)}`}</button></li>` : ""}</ul>` : "") +
      `<div id="${uid}-ficha" data-fu="ficha"></div>`;
    el.querySelectorAll("[data-ev]").forEach(b => b.onclick = () => abrirFicha(b.dataset.ev === est.ficha ? null : b.dataset.ev));
    const mas = el.querySelector("[data-evmas]"); if (mas) mas.onclick = () => { est.todosEv = !est.todosEv; pintarEventos(); };
    pintarFicha();
  }
  function abrirFicha(id, desdeGrafica = false) {
    est.ficha = id;
    if (id && !evVisibles.some(e => e.id === id)) est.todosEv = true;
    pintarEventos();
    if (id && desdeGrafica) { const f = raiz.querySelector(`[data-fu="ficha"]`); if (f) f.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  }
  function pintarFicha() {
    const el = raiz.querySelector(`[data-fu="ficha"]`); if (!el) return;
    const e = est.ficha && E && E.eventos.find(x => x.id === est.ficha);
    if (!e) { el.innerHTML = ""; return; }
    const veces = e.valor != null && e.esperado ? e.valor / e.esperado : null;
    const met = e.metrica === "seg" ? "seguidores" : e.metrica === "likes" ? "me gusta" : "visualizaciones";
    el.innerHTML = `<div class="fu-ficha" role="region" aria-label="${esc(e.titulo || "Evento")}">
      <button type="button" class="fu-cerrar" data-cerrarficha="1" aria-label="Cerrar la explicación">${ICONO.cerrar}</button>
      <h3>${esc(e.titulo || "Evento")}</h3>
      <p class="fu-f-meta"><span class="fu-chip"><i style="background:${esc(defRed(e.red).color)}"></i>${esc(defRed(e.red).corto)}</span>
        ${fecha(e.fecha)}${e.hasta && e.hasta !== e.fecha ? " – " + fecha(e.hasta) : ""} · ${esc(e.tipo || "")}${e.origen === "manual" ? " · revisado a mano" : e.origen === "auto" ? " · detectado por la rutina" : ""}</p>
      ${e.valor != null ? `<p>Pico: <b class="fu-cifra">${fmt(e.valor)}</b> ${met}${e.esperado != null ? ` · lo normal antes: <b class="fu-cifra">${fmt(e.esperado)}</b>${veces && veces >= 1.5 ? ` (${fmt(veces, veces < 10 ? 1 : 0)} veces más)` : ""}` : ""}</p>` : ""}
      ${e.detalle ? `<p>${esc(e.detalle)}</p>` : ""}
      ${Array.isArray(e.causa) && e.causa.length ? `<p class="fu-nota">Lo que más se vio esos días:</p><ul>${e.causa.map(c => `<li>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.titulo || c.url)}</a>` : esc(c.titulo || "")}${c.vis != null ? ` <span class="fu-cifra">· ${fmt(c.vis)} visualizaciones</span>` : ""}</li>`).join("")}</ul>` : ""}
    </div>`;
    el.querySelector("[data-cerrarficha]").onclick = () => { const id = est.ficha; abrirFicha(null); const b = raiz.querySelector(`[data-ev="${CSS.escape(id)}"]`); if (b) b.focus(); };
  }

  /* ─── barra de rango p10–p90 ─── */
  function barraRango({ p10, p50, p90, hoy = null, real = null, dentro = null, cons = null }, grande = false, etiqueta = null) {
    const vals = [p10, p50, p90, hoy, real, cons].filter(v => v != null && isFinite(v));
    if (!vals.length) return "";
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * .08 || Math.max(1, Math.abs(hi) * .05);
    lo -= pad; hi += pad;
    const x = v => ((v - lo) / (hi - lo) * 100).toFixed(2);
    let h = `<span class="fu-rb${grande ? " grande" : ""}" aria-hidden="true">`;
    if (p10 != null && p90 != null) h += `<i class="fu-rb-b" style="left:${x(p10)}%;width:${(x(p90) - x(p10)).toFixed(2)}%"></i>`;
    if (hoy != null) h += `<i class="fu-rb-h" style="left:${x(hoy)}%"></i>`;
    if (cons != null) h += `<i class="fu-rb-c" style="left:${x(cons)}%"></i>`;
    if (p50 != null) h += `<i class="fu-rb-p" style="left:${x(p50)}%"></i>`;
    if (real != null) h += `<i class="fu-rb-r${dentro === false ? " fuera" : ""}" style="left:${x(real)}%"></i>`;
    h += `</span>`;
    if (etiqueta && hoy != null) {
      const pos = v => { const p = +x(v); return p < 12 ? ["izq", p] : p > 88 ? ["der", p] : ["", p]; };
      const et = [];
      const [c, p] = pos(hoy); et.push(`<span class="${c}" style="left:${p}%">${esc(etiqueta)} ${fmtN(hoy)}</span>`);
      h += `<span class="fu-rb-etq" aria-hidden="true">${et.join("")}</span>`;
    }
    return h;
  }

  /* ─── tarjetas por plazo ─── */
  function cambioTxt(S, H, tipo, diasP) {
    if (!H) return { n: null, txt: "" };
    if (tipo === "flujo") {
      const c = H.cambio_p50, antes = c != null && H.p50 != null ? H.p50 - c : null;
      const pc = antes ? c / antes * 100 : null;
      return { n: c, txt: c == null ? `<span>sin un periodo anterior igual con datos</span>` :
        `${flecha(c)}${signo(c)}${pc != null ? ` (${signo(pc, Math.abs(pc) < 10 ? 1 : 0)} %)` : ""} <span>${diasP === 1 ? "frente al último día con dato" : `frente a los ${fmt(diasP)} días anteriores`}</span>` };
    }
    const c = H.cambio_p50 != null ? H.cambio_p50 : H.p50 != null && S.actual != null ? H.p50 - S.actual : null;
    const pc = c != null && S.actual ? c / S.actual * 100 : null;
    return { n: c, txt: c == null ? "" : `${flecha(c)}${signo(c, decs(c))}${pc != null ? ` (${signo(pc, Math.abs(pc) < 10 ? 1 : 0)} %)` : ""} <span>frente a hoy</span>` };
  }
  function pintarTarjetas() {
    const S = serieDe(est.red, est.met), tipo = tipoDe(est.met), cont = $("tarjetas");
    $("plazostit").innerHTML = `Qué número sale en cada plazo <small>${tipo === "flujo" ? "suma de todo el periodo, de mañana a esa fecha" : "valor en esa fecha"} · ${esc(nombreMet(est.met).toLowerCase())} de ${esc(defRed(est.red).largo)} · pulsa una para ver el detalle</small>`;
    if (!S) { cont.innerHTML = `<p class="fu-nota">Sin datos.</p>`; return; }
    const hs = (P.horizontes || []).filter(h => S.horizontes && S.horizontes[h.k]);
    cont.innerHTML = hs.map(h => {
      const H = S.horizontes[h.k], c = cambioTxt(S, H, tipo, h.dias), v = fmtN(H.p50);
      return `<button type="button" class="fu-tarjeta" data-k="${esc(h.k)}" aria-expanded="${est.abierta === h.k}" aria-controls="${det.id}">
        <span class="fu-t-cab"><span class="fu-t-nom">${esc(h.nombre)}</span><span class="fu-t-fecha">${fecha(H.fecha)}</span></span>
        <span class="fu-t-tipo">${tipo === "flujo" ? `lo más probable, suma de ${fmt(h.dias)} ${h.dias === 1 ? "día" : "días"}` : "lo más probable"}</span>
        <span class="fu-t-v${v.length > 11 ? " muy-largo" : v.length > 8 ? " largo" : ""}">${v}</span>
        <span class="fu-t-r">entre ${fmtN(H.p10)} y ${fmtN(H.p90)}</span>
        ${barraRango({ p10: H.p10, p50: H.p50, p90: H.p90, hoy: tipo === "nivel" ? S.actual : null, cons: H.constante })}
        <span class="fu-t-c ${cls(c.n)}">${c.txt || "&nbsp;"}</span>
        ${H.constante != null ? `<span class="fu-t-k">a ritmo constante: <b>${fmtN(H.constante)}</b></span>` : ""}
        <span class="fu-t-mas" aria-hidden="true">${est.abierta === h.k ? "Ocultar detalle" : "Ver detalle"} ${ICONO.abajo}</span>
      </button>`;
    }).join("");
    cont.querySelectorAll(".fu-tarjeta").forEach(b => b.onclick = () => {
      est.abierta = est.abierta === b.dataset.k ? null : b.dataset.k;
      pintarTarjetas();
      const n = cont.querySelector(`.fu-tarjeta[data-k="${CSS.escape(b.dataset.k)}"]`); if (n) n.focus();
    });
    const conCons = hs.some(h => S.horizontes[h.k].constante != null);
    $("tarjclave").innerHTML = `<span><i class="fu-rb-k p"></i>lo más probable</span><span><i class="fu-rb-k b"></i>8 de cada 10 veces</span>` +
      (tipo === "nivel" ? `<span><i class="fu-rb-k h"></i>hoy</span>` : "") + (conCons ? `<span><i class="fu-rb-k c"></i>a ritmo constante (si se queda como ahora)</span>` : "");
    pintarDetalle(); colocarDetalle();
  }
  let colsAntes = 0;
  function colocarDetalle() {
    const cont = $("tarjetas"); if (!cont) return;
    if (!est.abierta) { det.hidden = true; if (det.parentNode) det.remove(); return; }
    const cards = [...cont.querySelectorAll(".fu-tarjeta")], i = cards.findIndex(c => c.dataset.k === est.abierta);
    if (i < 0) { det.hidden = true; return; }
    const cols = getComputedStyle(cont).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
    const fin = Math.min(cards.length - 1, Math.floor(i / cols) * cols + cols - 1);
    if (cards[fin].nextElementSibling !== det || colsAntes !== cols) cards[fin].after(det);
    colsAntes = cols; det.hidden = false;
  }
  function pintarDetalle() {
    if (!est.abierta) { det.innerHTML = ""; return; }
    const k = est.abierta, h = (P.horizontes || []).find(x => x.k === k), S = serieDe(est.red, est.met), H = S && S.horizontes[k];
    if (!h || !H) { est.abierta = null; det.innerHTML = ""; return; }
    const tipo = tipoDe(est.met), red = P.redes[est.red], nm = nombreMet(est.met).toLowerCase();
    const filas = ORDEN_REDES.filter(r => serieDe(r, est.met) && serieDe(r, est.met).horizontes && serieDe(r, est.met).horizontes[k]).map(r => {
      const Sr = serieDe(r, est.met), Hr = Sr.horizontes[k], c = cambioTxt(Sr, Hr, tipo, h.dias);
      return `<tr class="${r === est.red ? "fu-esta" : ""}"><td><span class="fu-chip"><i style="background:${esc(defRed(r).color)}"></i>${esc(defRed(r).nombre)}</span>${Hr.fecha !== H.fecha ? `<small>para el ${fecha(Hr.fecha)}</small>` : ""}</td>
        <td class="n"><b>${fmtN(Hr.p50)}</b><small>${fmtN(Hr.p10)} – ${fmtN(Hr.p90)}</small></td><td class="n ${cls(c.n)}">${c.n == null ? "–" : signo(c.n, decs(c.n))}</td></tr>`;
    }).join("");
    const inicio = sumar(H.fecha, -(h.dias - 1));
    const como = [];
    if (tipo === "flujo") {
      como.push(`<p>Es la <b>suma</b> de ${esc(nm.replace(" al día", ""))} del ${fecha(inicio)} al ${fecha(H.fecha)} (${fmt(h.dias)} ${h.dias === 1 ? "día" : "días"}).</p>`);
      if (S.actual != null) como.push(`<p>Ahora la media es <b>${fmtN(S.actual)}</b> al día (últimos 7 días con dato): a ese ritmo, en ${fmt(h.dias)} ${h.dias === 1 ? "día" : "días"} serían <b>${fmt(S.actual * h.dias)}</b>.</p>`);
      como.push(`<p>El modelo prevé <b>${fmtN(H.p50)}</b> como lo más probable; si va bien, <b>${fmtN(H.p90)}</b>; si va mal, <b>${fmtN(H.p10)}</b>.</p>`);
      if (H.constante != null) como.push(`<p>Si se queda como ahora (cada día como la media de los últimos 30, sin tendencia): <b>${fmtN(H.constante)}</b>.</p>`);
    } else {
      como.push(`<p>Hoy: <b>${fmtN(S.actual)}</b> (último dato real, del ${fecha(red.datos_hasta)}).${S.ritmo ? ` ${esc(S.ritmo)}.` : ""}</p>`);
      como.push(`<p>Para el ${fecha(H.fecha)} lo más probable es <b>${fmtN(H.p50)}</b>; si va bien, <b>${fmtN(H.p90)}</b>; si va mal, <b>${fmtN(H.p10)}</b>.</p>`);
      if (H.constante != null) como.push(`<p>Si se queda como ahora (al ritmo medio de los últimos 30 días, sin tendencia): <b>${fmtN(H.constante)}</b>.</p>`);
    }
    const banda = punto((P.modelo && P.modelo.banda) || "p10–p90: 8 de cada 10 veces el valor real debería caer dentro");
    como.push(`<p class="fu-nota">${esc(banda)}${h.dias >= 365 && !/más de un año|más de 1 año/i.test(banda) ? " A más de 1 año la banda es ancha: es una orientación, no una promesa." : ""}</p>`);
    det.innerHTML = `<button type="button" class="fu-cerrar" data-cerrardet="1" aria-label="Cerrar el detalle de ${esc(h.nombre)}">${ICONO.cerrar}</button>
      <div class="fu-det-cab"><h3>${esc(h.nombre)} · ${fecha(H.fecha)}</h3><p>${esc(nombreMet(est.met))} · ${esc(defRed(est.red).largo)}</p></div>
      <div class="fu-det-cuerpo">
        <div class="fu-det-redes"><h4>Las cuatro redes en esa fecha</h4>
          <div class="fu-tabla-caja"><table class="fu-tabla"><thead><tr><th>Red</th><th class="n">Lo más probable <small>8 de cada 10 veces, entre</small></th><th class="n">${tipo === "flujo" ? "Frente al periodo anterior" : "Frente a hoy"}</th></tr></thead><tbody>${filas}</tbody></table></div></div>
        <div class="fu-det-como"><h4>Cómo sale el número</h4>${barraRango({ p10: H.p10, p50: H.p50, p90: H.p90, hoy: tipo === "nivel" ? S.actual : null, cons: H.constante }, true, tipo === "nivel" ? "hoy" : null)}${como.join("")}</div>
      </div>`;
    det.setAttribute("aria-label", `Detalle: ${h.nombre}`);
    det.querySelector("[data-cerrardet]").onclick = () => { const k2 = est.abierta; est.abierta = null; pintarTarjetas(); const b = raiz.querySelector(`.fu-tarjeta[data-k="${CSS.escape(k2)}"]`); if (b) b.focus(); };
  }

  /* ─── objetivos (hitos) ─── */
  const esCompuesto = h => h.objetivo == null || /monetiz/i.test(h.id || "");
  function hitosDe(x) {                       // sin repetidos (misma métrica y objetivo) y con los compuestos («Monetizar») primero
    const vistos = new Set();
    return ((P.redes[x] && P.redes[x].hitos) || []).filter(h => { if (h.objetivo == null) return true;
      const k = h.metrica + "|" + h.objetivo; if (vistos.has(k)) return false; vistos.add(k); return true; })
      .map((h, i) => [h, i]).sort((a, b) => (esCompuesto(b[0]) - esCompuesto(a[0])) || a[1] - b[1]).map(x => x[0]);
  }
  function pintarHitos() {
    const el = $("hitos"), r = est.red;
    const grupos = r === "global"
      ? [...redesHay.filter(x => x !== "global").map(x => [x, hitosDe(x).filter(esCompuesto)]), ["global", hitosDe("global")]]
      : [[r, hitosDe(r)]];
    const lista = grupos.filter(([, h]) => h.length);
    if (!lista.length) { el.innerHTML = `<p class="fu-nota fu-hueco">${esc(defRed(r).largo)} no tiene objetivos marcados en la previsión.</p>`; return; }
    el.innerHTML = `<div class="fu-hitos-lista">${lista.map(([x, hs]) => hs.map(h => hitoHTML(x, h)).join("")).join("")}</div>` +
      (r === "global" ? `<p class="fu-nota fu-hueco">En Global salen los objetivos de las cuatro redes juntas y el de monetizar YouTube; los demás, en la vista de cada red.</p>` : "");
    el.querySelectorAll("[data-irmon]").forEach(b => b.onclick = irAMon);
    el.querySelectorAll("[data-verhito]").forEach(b => b.onclick = () => {
      const [rr, mm] = b.dataset.verhito.split("|");
      est.red = rr; est.met = mm; est.hor = "2a"; est.abierta = null; est.ficha = null; asegurarMetrica(); cambiar();
      $("grafcaja").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }
  function hitoHTML(r, h) {
    const col = colorRed(r), comp = esCompuesto(h);
    const prog = Math.max(0, Math.min(1, h.progreso != null ? h.progreso : h.objetivo && h.actual != null ? h.actual / h.objetivo : 0)), hecho = prog >= 1;
    const pos = f => Math.max(0, Math.min(100, dias(HOY, f) / 730 * 100));
    const faltan = h.objetivo != null && h.actual != null ? h.objetivo - h.actual : null;
    const prob = h.prob_2a != null ? Math.round(h.prob_2a * 100) : null;
    let tl = "", txt = "";
    if (hecho) txt = `Objetivo cumplido con el último dato.`;
    else {
      const marcas = [0, 6, 12, 18, 24].map((m, i) => `<span class="fu-tl-marca${i === 0 ? " izq" : i === 4 ? " der" : ""}${i % 2 ? " fu-impar" : ""}" style="left:${(m / 24 * 100).toFixed(2)}%">${i === 0 ? "hoy" : mesAno(sumar(HOY, Math.round(m * 30.42)))}</span>`).join("");
      const a = h.fecha_p10 ? pos(h.fecha_p10) : null, b = h.fecha_p90 ? pos(h.fecha_p90) : 100;
      tl = `<div class="fu-tl" aria-hidden="true"><span class="fu-tl-eje"></span>
        ${a != null ? `<span class="fu-tl-ventana${h.fecha_p90 ? "" : " abierta"}" style="left:${a.toFixed(2)}%;width:${Math.max(1, b - a).toFixed(2)}%"></span>` : ""}
        <span class="fu-tl-hoy"></span>${h.fecha_p50 ? `<span class="fu-tl-p50" style="left:${pos(h.fecha_p50).toFixed(2)}%"></span>` : ""}${marcas}</div>`;
      if (h.fecha_p50) txt = `Lo más probable: <b>${mesAno(h.fecha_p50)}</b>; ` + (h.fecha_p90
        ? `entre <b>${mesAno(h.fecha_p10 || h.fecha_p50)}</b> si va bien y <b>${mesAno(h.fecha_p90)}</b> si va mal.`
        : `si va bien, <b>${mesAno(h.fecha_p10 || h.fecha_p50)}</b>; si va mal, puede que no llegue en 2 años.`);
      else if (prob) txt = `Lo más probable: <strong>después de 2 años</strong>. Solo ${fmt(prob)} de cada 100 futuros llegan antes${h.fecha_p10 ? `; si va bien, <b>${mesAno(h.fecha_p10)}</b>` : ""}.`;
      else txt = `<strong>Al ritmo de hoy no se alcanza en 2 años</strong>, ni siquiera si va bien (probabilidad 0 %).`;
    }
    const cifras = h.objetivo != null && h.actual != null
      ? `<div class="fu-h-cifras"><b>${fmtN(h.actual)}</b> de ${fmtN(h.objetivo)}${faltan != null && faltan > 0 ? ` · faltan ${fmtN(faltan)}` : ""}${tipoDe(h.metrica) === "nivel" ? ` · ${esc(nombreMet(h.metrica).toLowerCase())}` : ""}</div>` : "";
    const lbl = h.objetivo != null && h.actual != null ? `${fmtN(h.actual)} de ${fmtN(h.objetivo)}: ${fmt(prog * 100, 1)} %` : `${fmt(prog * 100, 1)} % conseguido`;
    const ver = h.objetivo != null && tipoDe(h.metrica) === "nivel" && serieDe(r, h.metrica);
    return `<article class="fu-hito${comp ? " destacado" : ""}" style="--fu-hc:${esc(col)}">
      <div class="fu-h-cab"><div class="fu-h-tit"><h3><span class="fu-chip"><i style="background:${esc(defRed(r).color)}"></i>${esc(defRed(r).corto)}</span>${esc(h.nombre)}${hecho ? `<span class="fu-conseguido">Conseguido</span>` : ""}</h3>
        ${h.detalle ? `<p>${esc(h.detalle)}</p>` : ""}</div>
        ${prob != null && !hecho ? `<div class="fu-h-prob"><b class="${prob >= 70 ? "sube" : prob < 30 ? "baja" : ""}">${fmt(prob)} %</b><span>de llegar en 2 años</span></div>` : ""}</div>
      <div class="fu-bateria-fila"><div class="fu-bateria${hecho ? " lleno" : ""}" role="img" aria-label="${esc(lbl)}"><i style="transform:scaleX(${prog.toFixed(4)})"></i><b></b></div>
        <div class="fu-bat-txt">${fmt(prog * 100, prog < .1 ? 1 : 0)} %<small>conseguido</small></div></div>
      ${cifras}${tl}<p class="fu-h-txt">${txt}</p>
      ${ver ? `<div class="fu-h-acciones"><button type="button" class="fu-enlace" data-verhito="${esc(r)}|${esc(h.metrica)}">Verlo en la gráfica (2 años) <span aria-hidden="true">→</span></button></div>` : ""}
      ${comp && r === "youtube" && MON ? `<div class="fu-h-acciones"><button type="button" class="fu-enlace" data-irmon="1">Cuándo y cuánto se cobraría <span aria-hidden="true">→</span></button></div>` : ""}
    </article>`;
  }

  /* ─── hasta dónde puede llegar (picos: mejor semana del próximo año frente al récord de hoy) ─── */
  function pintarPicos() {
    const r = est.red, L = (P.redes[r] && P.redes[r].picos) || [];
    $("picosred").textContent = defRed(r).largo;
    const el = $("picos");
    if (!L.length) { el.innerHTML = `<p class="fu-nota fu-hueco">Sin picos calculados para ${esc(defRed(r).largo)}.</p>`; return; }
    el.innerHTML = L.map(x => {
      const veces = x.record_actual ? x.p50 / x.record_actual : null, u = /me gusta/i.test(x.nombre || "") || x.metrica === "lk_dia" ? "me gusta" : "visualizaciones";
      return `<div class="fu-pico">
        <h3>${esc(x.nombre || "")}</h3>
        <p class="fu-pico-v"><b>${fmtN(x.p50)}</b> <span>${u} al día, lo más probable</span></p>
        <p class="fu-pico-r">entre ${fmtN(x.p10)} y ${fmtN(x.p90)} · récord actual (mejor semana) <b>${fmtN(x.record_actual)}</b>${veces && veces >= 1.1 ? ` · ${fmt(veces, veces < 10 ? 1 : 0)} veces el récord` : ""}</p>
        ${barraRango({ p10: x.p10, p50: x.p50, p90: x.p90, hoy: x.record_actual }, false, "récord")}
      </div>`;
    }).join("") + `<p class="fu-nota fu-hueco">La raya discontinua es el récord de hoy: la mejor semana (media al día) que ya ha tenido la red.</p>`;
  }

  /* ─── ¿acierta el modelo? ─── */
  function pintarAcierto() {
    const r = est.red, red = P.redes[r], Sx = serieDe(r, est.met), dePrec = Sx && Sx.precision && (Sx.precision["7"] || Sx.precision["30"]);
    const pr = (dePrec ? Sx.precision : red.precision) || {};
    $("aciertored").textContent = dePrec ? `${nombreMet(est.met).toLowerCase()} de ${defRed(r).largo}` : defRed(r).largo;
    const nivelFiab = e => e == null ? null : e < 20 ? ["bien", "Fiable", "error menor del 20 %"] : e <= 50 ? ["medio", "Orientativo", "error entre el 20 y el 50 %"] : ["mal", "Poco fiable", "error de más del 50 %"];
    const bloque = (d, x) => {
      if (!x) return `<div class="fu-prec-b"><span class="fu-et">A ${d} días</span><p>Todavía no hay pruebas con el pasado.</p></div>`;
      const n = x.en_banda_pct != null ? Math.round(x.en_banda_pct / 10) : null, f = nivelFiab(x.error_medio_pct);
      return `<div class="fu-prec-b">
        <div class="fu-prec-cab"><span class="fu-et">A ${d} días</span>${f ? `<span class="fu-semaforo ${f[0]}" title="${esc(f[2])}"><span class="fu-luces" aria-hidden="true"><i></i><i></i><i></i></span>${f[1]}</span>` : ""}</div>
        <span class="fu-big">${x.error_medio_pct != null ? fmt(x.error_medio_pct, 1) + " %" : "–"}<small>de error medio</small></span>
        ${n != null ? `<span class="fu-diez" role="img" aria-label="${fmt(x.en_banda_pct)} % de las veces dentro de la banda">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? "si" : ""}"></i>`).join("")}</span>
        <p><b class="fu-cifra">${fmt(x.en_banda_pct)} %</b> de las veces el valor real cayó dentro de la banda (lo esperado: 80 %)${x.pruebas != null ? ` · ${fmt(x.pruebas)} pruebas` : ""}.</p>` : ""}</div>`;
    };
    const tieneP = pr["7"] || pr["30"];
    const seg = (P.seguimiento || []).filter(s => r === "global" || s.red === r);
    const hechas = seg.filter(s => s.real != null).sort((a, b) => a.fecha < b.fecha ? 1 : -1);
    const pend = seg.filter(s => s.real == null).sort((a, b) => a.fecha < b.fecha ? -1 : 1);
    const hoy = HOY;
    let primera = pend.map(s => s.fecha).find(f => f >= hoy) || pend.map(s => s.fecha)[0];
    if (!primera) {
      const S = serieDe(r, est.met);
      primera = (P.horizontes || []).map(h => S && S.horizontes && S.horizontes[h.k] && S.horizontes[h.k].fecha).filter(Boolean).find(f => f > hoy);
    }
    const fila = s => {
      const estd = s.real == null ? "pendiente" : s.dentro ? "dentro" : "fuera";
      return `<li><div class="fu-sf-cab"><span class="fu-chip"><i style="background:${esc(defRed(s.red).color)}"></i>${esc(defRed(s.red).corto)}</span>
          <span>${esc(nombreMet(s.metrica))}${tipoDe(s.metrica) === "flujo" && (diasPlazo(s.horizonte) || 1) > 1 ? ` (suma de ${fmt(diasPlazo(s.horizonte))} días)` : ""} · para el <b class="fu-cifra">${fecha(s.fecha)}</b></span><small>hecha el ${fecha(s.hecha)}</small>
          <span class="fu-estado ${estd}">${estd === "pendiente" ? "Pendiente" : estd === "dentro" ? "Dentro" : "Fuera"}</span></div>
        <div class="fu-sf-num">Previsto <b>${fmtN(s.p50)}</b> (${fmtN(s.p10)} – ${fmtN(s.p90)})${s.real != null ? ` · real <b>${fmtN(s.real)}</b>${s.desvio_pct != null ? ` · desvío ${signo(s.desvio_pct, 1)} %` : ""}` : ""}</div>
        ${barraRango({ p10: s.p10, p50: s.p50, p90: s.p90, real: s.real, dentro: s.dentro })}
        ${s.explicacion ? `<p class="fu-sf-exp">${esc(s.explicacion)}</p>` : ""}</li>`;
    };
    $("acierto").innerHTML = `
      ${tieneP ? `<div class="fu-prec">${bloque(7, pr["7"])}${bloque(30, pr["30"])}</div>
        <p class="fu-nota">Prueba con el pasado: se hace la previsión como si fuera una fecha antigua y se compara con lo que pasó de verdad. Semáforo por el error medio: menos del 20 %, fiable; del 20 al 50 %, orientativo; más del 50 %, poco fiable (pasa con volúmenes pequeños, donde un día suelto lo cambia todo).</p>`
        : `<p class="fu-nota">Todavía no hay pruebas con el pasado para ${esc(defRed(r).largo)}.</p>`}
      <h3>Seguimiento <small>previsiones guardadas y lo que pasó</small></h3>
      ${hechas.length ? `<ul class="fu-seg">${hechas.slice(0, 8).map(fila).join("")}</ul>`
        : `<p class="fu-primera">Todavía no se ha podido comprobar ninguna. ${primera ? `La primera comprobación real será el <b>${fecha(primera)}</b>.` : ""}</p>`}
      ${pend.length ? `<p class="fu-pendientes">${hechas.length ? "Próximas comprobaciones" : "Guardadas para comprobar"}: ${pend.slice(0, 6).map(s => `${esc(defRed(s.red).corto)} ${esc(nombreMet(s.metrica).toLowerCase())} el ${fechaCorta(s.fecha)}`).join(" · ")}${pend.length > 6 ? ` y ${fmt(pend.length - 6)} más` : ""}.</p>` : ""}`;
  }

  /* ─── cómo se calcula ─── */
  function pintarComo() {
    const M = P.modelo || {};
    const parrafos = String(M.texto || "Sin explicación del modelo en prediccion.json.").split(/\n+/).filter(Boolean);
    $("como").innerHTML = parrafos.map(p => `<p>${esc(p)}</p>`).join("") +
      (M.banda ? `<p><b>La banda.</b> ${esc(punto(M.banda))}</p>` : "") +
      `<p class="fu-promesa"><b>Es una estimación con los datos de hoy, no una promesa.</b> A más de 1 año la banda es ancha: sirve para dimensionar objetivos, no para darlos por hechos.</p>`;
  }

  /* ─── pantalla completa ─── */
  const caja = () => $("grafcaja");
  const enLleno = () => document.fullscreenElement === caja() || caja().classList.contains("fu-lleno");
  function botonLleno() {
    const b = $("lleno"), si = enLleno();
    b.innerHTML = (si ? ICONO.salir : ICONO.lleno) + `<span class="fu-icono-txt">${si ? "Salir" : "Pantalla completa"}</span>`;
    b.setAttribute("aria-pressed", String(si)); b.setAttribute("aria-label", si ? "Salir de pantalla completa" : "Ver la gráfica a pantalla completa");
  }
  async function alternarLleno() {
    const c = caja();
    if (enLleno()) { if (document.fullscreenElement === c) await document.exitFullscreen().catch(() => {}); c.classList.remove("fu-lleno"); }
    else if (c.requestFullscreen && document.fullscreenEnabled) { try { await c.requestFullscreen(); } catch (e) { c.classList.add("fu-lleno"); } }
    else c.classList.add("fu-lleno");
    botonLleno();
  }
  const alCambiarLleno = () => botonLleno();
  const alTecla = e => {
    if (e.key !== "Escape") return;
    if (caja().classList.contains("fu-lleno")) { caja().classList.remove("fu-lleno"); botonLleno(); $("lleno").focus(); }
    else if (est.abierta && raiz.contains(document.activeElement)) { const k = est.abierta; est.abierta = null; pintarTarjetas(); const b = raiz.querySelector(`.fu-tarjeta[data-k="${CSS.escape(k)}"]`); if (b) b.focus(); }
  };
  document.addEventListener("fullscreenchange", alCambiarLleno);
  document.addEventListener("keydown", alTecla);
  $("lleno").onclick = alternarLleno;

  /* ─── Monetizar YouTube: cuándo y cuánto (redes.youtube.monetizacion) ─── */
  const MON = P.redes.youtube && P.redes.youtube.monetizacion;
  const ESC_GRAF = ["probable", "conservador", "muy_conservador"];
  const ESC_ETQ = { probable: "Lo más probable", conservador: "Prudente", muy_conservador: "Muy prudente", sin_crecer: "Sin crecimiento" };
  let chartMon = null;
  const euros = (a, b) => a == null ? "–" : (b == null || a === b ? fmt(a) : `${fmt(a)}–${fmt(b)}`) + " €";
  const nombreEsc = id => { const e = MON && (MON.escenarios || []).find(x => x.id === id); return e ? e.nombre : id; };
  const anfitrion = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
  function quitarMon() { if (chartMon) { chartMon.remove(); chartMon = null; } }
  function irAMon() {
    if (est.red !== "youtube") { est.red = "youtube"; asegurarMetrica(); est.abierta = null; est.ficha = null; est.todosEv = false; cambiar(); }
    const el = $("mon"); if (!el || el.hidden) return;
    el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const h = el.querySelector("h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }
  function pintarMon() {
    quitarMon();
    const el = $("mon"), acc = $("monacceso");
    if (!MON || !Array.isArray(MON.meses)) { el.hidden = true; el.innerHTML = ""; acc.innerHTML = ""; return; }
    const escs = MON.escenarios || [], prob = escs.find(e => e.id === "probable"), tot = MON.totales_2a || {};
    if (est.red !== "youtube") {
      el.hidden = true; el.innerHTML = "";
      acc.innerHTML = est.red !== "global" ? "" : `<div class="fu-caja caja fu-mon-acceso">
        <span class="fu-chip"><i style="background:${esc(defRed("youtube").color)}"></i>YT</span>
        <p><b>Monetizar YouTube.</b> ${prob ? (prob.fecha ? `Lo más probable: <strong class="fu-cifra">${mesAno(prob.fecha)}</strong>.` : "Lo más probable es que no llegue en 2 años.") : ""}
          ${tot.probable ? ` En 2 años, entre <span class="fu-cifra">${euros(tot.probable.eur_min, tot.probable.eur_max)}</span> de anuncios (estimación).` : ""}</p>
        <button type="button" class="fu-enlace fu-mon-ir" data-irmon="1">Ver cuándo se monetiza YouTube <span aria-hidden="true">→</span></button></div>`;
      const b = acc.querySelector("[data-irmon]"); if (b) b.onclick = irAMon;
      return;
    }
    acc.innerHTML = ""; el.hidden = false;
    if (!ESC_GRAF.includes(est.esc)) est.esc = "probable";
    const filas = MON.meses, E0 = est.esc, rpm = MON.rpm || {}, rep = MON.reparto_actual || {};
    const tarjeta = e => {
      const largo = (e.por_que || "").length > 130, abierto = est.porQue.has(e.id), t = tot[e.id];
      const fechaTxt = e.fecha ? mesAno(e.fecha) : e.id === "sin_crecer" ? "No se llega" : "No se llega en 2 años";
      return `<article class="fu-esc ${esc(e.id)}${ESC_GRAF.includes(e.id) && e.id === E0 ? " en-grafica" : ""}">
        <span class="fu-esc-tag">${esc(ESC_ETQ[e.id] || e.nombre)}</span>
        <h3>${esc(e.nombre)}</h3>
        <p class="fu-esc-fecha${e.fecha ? "" : " no"}">${fechaTxt}</p>
        ${t ? `<p class="fu-esc-tot">En 2 años: <b>${euros(t.eur_min, t.eur_max)}</b></p>` : e.id === "sin_crecer" ? `<p class="fu-esc-tot">En 2 años: sin ingresos por anuncios</p>` : ""}
        <p class="fu-esc-pq${largo && !abierto ? " corto" : ""}" id="${uid}-pq-${esc(e.id)}">${esc(e.por_que || "")}</p>
        ${largo ? `<button type="button" class="fu-enlace fu-pq-btn" data-pq="${esc(e.id)}" aria-expanded="${abierto}" aria-controls="${uid}-pq-${esc(e.id)}">${abierto ? "Leer menos" : "Por qué"}</button>` : ""}
      </article>`;
    };
    const celdaEur = x => !x ? "–" : x.monetizado <= 0 ? `<span class="fu-sin">sin monetizar</span>`
      : `${euros(x.eur_min, x.eur_max)}${x.monetizado < 1 ? `<small>${fmt(x.monetizado * 100)} % del mes</small>` : ""}`;
    el.innerHTML = `
      <div class="fu-caja-cab"><h2 id="${uid}-t-mon">Monetizar YouTube: cuándo y cuánto <small>fechas del modelo; los euros, con un RPM supuesto</small></h2></div>
      <div class="fu-mon-cuerpo">
        <div class="fu-esc-lista">${escs.map(tarjeta).join("")}</div>
        <div class="fu-mon-graf">
          <div class="fu-mon-graf-cab">
            <h3>Ingresos por anuncios al mes <small>parte llena: lo mínimo · parte clara: hasta lo máximo</small></h3>
            <div class="fu-grupo" data-fu="escs" role="group" aria-label="Escenario de la gráfica">${ESC_GRAF.filter(id => escs.some(e => e.id === id)).map(id =>
              `<button type="button" data-e="${id}" aria-pressed="${id === E0}">${esc(nombreEsc(id))}</button>`).join("")}</div>
          </div>
          <div class="fu-leyenda" data-fu="monley"></div>
          <div class="fu-grafica fu-mon-grafica" data-fu="mongraf" role="img" aria-label="Ingresos estimados por mes en el escenario ${esc(nombreEsc(E0).toLowerCase())}"></div>
          <p class="fu-nota">Rayado: meses en los que el canal aún no cobra. El primer mes puede ser parcial (se cobra desde el día en que se monetiza).</p>
        </div>
        <div class="fu-totales">
          <h3>En 2 años <small>suma de los ${fmt(filas.length)} meses</small></h3>
          <div class="fu-tot-lista">${ESC_GRAF.filter(id => tot[id]).map(id => `<div class="fu-tot${id === E0 ? " sel" : ""}"><span>${esc(nombreEsc(id))}</span><b>${euros(tot[id].eur_min, tot[id].eur_max)}</b></div>`).join("")}</div>
        </div>
        <details class="fu-mon-tabla" data-fu="montabla"${est.monTabla ? " open" : ""}>
          <summary>${ICONO.derecha} Mes a mes <small>euros de los tres escenarios y visualizaciones del ${esc(nombreEsc(E0).toLowerCase())}</small></summary>
          <div class="fu-tabla-caja"><table class="fu-tabla fu-tabla-mon">
            <thead><tr><th>Mes</th>${ESC_GRAF.map(id => `<th class="n${id === E0 ? " sel" : ""}">${esc(nombreEsc(id))} <small>€ al mes</small></th>`).join("")}<th class="n">Shorts <small>visualizaciones</small></th><th class="n">Largos <small>visualizaciones</small></th></tr></thead>
            <tbody>${filas.map(f => `<tr><th scope="row" class="f">${esc(f.nombre || mesAno(f.mes))}</th>${ESC_GRAF.map(id => `<td class="n${id === E0 ? " sel" : ""}">${celdaEur(f[id])}</td>`).join("")}<td class="n">${fmt(f[E0] && f[E0].vis_shorts)}</td><td class="n">${fmt(f[E0] && f[E0].vis_largos)}</td></tr>`).join("")}</tbody>
            <tfoot><tr><th scope="row">Total</th>${ESC_GRAF.map(id => `<td class="n${id === E0 ? " sel" : ""}"><b>${tot[id] ? euros(tot[id].eur_min, tot[id].eur_max) : "–"}</b></td>`).join("")}<td></td><td></td></tr></tfoot>
          </table></div>
        </details>
        <div class="fu-mon-notas">
          <p class="fu-mon-aviso"><b>Los euros son una estimación con un RPM supuesto</b> (lo que paga YouTube por cada 1.000 visualizaciones).
            ${rpm.shorts && rpm.largos && !/shorts\s+[\d,.]+/i.test(rpm.nota || "") ? `Se usa ${fmt(rpm.shorts[0], 2)}–${fmt(rpm.shorts[1], 2)} ${esc(rpm.moneda || "€")} en shorts y ${fmt(rpm.largos[0], rpm.largos[0] % 1 ? 2 : 0)}–${fmt(rpm.largos[1], rpm.largos[1] % 1 ? 2 : 0)} ${esc(rpm.moneda || "€")} en largos. ` : ""}${esc(rpm.nota || "")}
            ${Array.isArray(rpm.fuentes) && rpm.fuentes.length ? `Fuentes: ${rpm.fuentes.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(anfitrion(u))}</a>`).join(", ")}.` : ""}</p>
          ${MON.requisitos ? `<p><b>Requisitos.</b> ${esc(MON.requisitos)}</p>` : ""}
          ${MON.como_se_cobra ? `<p><b>Cómo se cobra.</b> ${esc(MON.como_se_cobra)}</p>` : ""}
          ${rep.cuota_shorts != null ? `<p><b>Cómo se reparte hoy.</b> El ${fmt(rep.cuota_shorts * 100, 1)} % de las visualizaciones son de shorts, que pagan muy poco${rep.min_por_vis_largo != null ? `; cada visualización de un vídeo largo dura ${fmt(rep.min_por_vis_largo, 2)} minutos de media` : ""}${rep.horas_largos_30d != null ? ` y los largos sumaron ${fmt(rep.horas_largos_30d)} horas en los últimos 30 días` : ""}.</p>` : ""}
          <p class="fu-apunte">El dinero de verdad está en lo que estos vídeos venden en la tienda.</p>
        </div>
      </div>`;
    el.querySelectorAll("[data-pq]").forEach(b => b.onclick = () => {
      const id = b.dataset.pq; est.porQue.has(id) ? est.porQue.delete(id) : est.porQue.add(id);
      const abierto = est.porQue.has(id), t = el.querySelector(`#${CSS.escape(uid + "-pq-" + id)}`);
      t.classList.toggle("corto", !abierto); b.setAttribute("aria-expanded", String(abierto)); b.textContent = abierto ? "Leer menos" : "Por qué";
    });
    el.querySelector('[data-fu="montabla"]').addEventListener("toggle", e => { est.monTabla = e.target.open; });

    // gráfica mensual: barra llena hasta el mínimo y prolongación clara hasta el máximo
    const g = el.querySelector('[data-fu="mongraf"]'), ley = el.querySelector('[data-fu="monley"]');
    if (!LC) { g.innerHTML = `<p class="fu-nota fu-error">No se ha cargado la librería de gráficas.</p>`; return; }
    const col = colorRed("youtube"), tiempos = filas.map(f => f.mes + "-01");
    const tope = Math.max(10, ...filas.flatMap(f => ESC_GRAF.map(id => (f[id] && f[id].eur_max) || 0))) * 1.08;
    const pfE = { type: "custom", formatter: v => v < -1e-9 ? "" : fmt(v) + " €", minMove: 1 };
    chartMon = LC.createChart(g, {
      autoSize: true,
      layout: { background: { type: "solid", color: "rgba(0,0,0,0)" }, textColor: T.texto, fontFamily: T.letra, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: "rgba(0,0,0,0)" }, horzLines: { color: T.sinRejilla ? "rgba(0,0,0,0)" : T.rejilla } },
      rightPriceScale: { borderColor: T.borde, scaleMargins: { top: .14, bottom: 0 } },
      timeScale: { borderColor: T.borde, fixLeftEdge: true, fixRightEdge: true, lockVisibleTimeRangeOnResize: true },
      handleScroll: false, handleScale: false,
      crosshair: { mode: LC.CrosshairMode.Normal, horzLine: { visible: false, labelVisible: false } },
      localization: { locale: "es-ES", priceFormatter: v => v < -1e-9 ? "" : fmt(v) + " €", timeFormatter: t => { const k = claveT(t); const f = filas.find(x => x.mes + "-01" === k); return f ? f.nombre : mesAno(k); } },
    });
    const escala = () => ({ priceRange: { minValue: 0, maxValue: tope } });
    const oscuro = lum(rgb(T.capa1) || [255, 255, 255]) < .2;
    const sMax = chartMon.addHistogramSeries({ color: rgba(col, oscuro ? .42 : .26), priceFormat: pfE, priceLineVisible: false, lastValueVisible: false, autoscaleInfoProvider: escala });
    const sMin = chartMon.addHistogramSeries({ color: col, priceFormat: pfE, priceLineVisible: false, lastValueVisible: false, autoscaleInfoProvider: escala });
    sMax.setData(filas.map(f => ({ time: f.mes + "-01", value: (f[E0] && f[E0].eur_max) || 0 })));
    sMin.setData(filas.map(f => ({ time: f.mes + "-01", value: (f[E0] && f[E0].eur_min) || 0, color: f[E0] && f[E0].monetizado > 0 ? col : rgba(T.tenue, .55) })));
    const primer = filas.find(f => f[E0] && f[E0].monetizado > 0);
    if (typeof sMax.attachPrimitive === "function" && (!primer || primer !== filas[0]))
      sMax.attachPrimitive(new CapaRayada({ tiempos, hasta: primer ? primer.mes + "-01" : null, texto: "AÚN SIN MONETIZAR",
        fondo: rgba(T.tinta, .03), raya: rgba(T.tinta, .09), fondoEtq: rgba(T.capa1, .9), tinta: T.suave, letra: T.letra }));
    chartMon.timeScale().fitContent();
    const t2 = tot[E0];
    const resumen = `<span class="fu-l-f">${esc(nombreEsc(E0))}</span>` +
      (primer ? `<span>Primer mes con ingresos: <b>${esc(primer.nombre || mesAno(primer.mes))}</b>${primer[E0].monetizado < 1 ? ` (${fmt(primer[E0].monetizado * 100)} % del mes)` : ""}</span>` : `<span><b>No se monetiza</b> en estos ${fmt(filas.length)} meses</span>`) +
      (t2 ? `<span>En 2 años <b>${euros(t2.eur_min, t2.eur_max)}</b></span>` : "");
    const pintaLey = param => {
      const k = param && param.time ? claveT(param.time) : null, f = k && filas.find(x => x.mes + "-01" === k), x = f && f[E0];
      if (!x) { ley.innerHTML = resumen; return; }
      ley.innerHTML = `<span class="fu-l-f">${esc(f.nombre || mesAno(f.mes))}</span>` +
        (x.monetizado > 0 ? `<span>Anuncios <b>${euros(x.eur_min, x.eur_max)}</b>${x.monetizado < 1 ? ` (monetizado el ${fmt(x.monetizado * 100)} % del mes)` : ""}</span>` : `<span><b>Aún sin monetizar</b></span>`) +
        `<span>Shorts <b>${fmt(x.vis_shorts)}</b> vis.</span><span>Largos <b>${fmt(x.vis_largos)}</b> vis.</span>`;
    };
    chartMon.subscribeCrosshairMove(pintaLey); pintaLey(null);
  }

  /* ─── pintar ─── */
  function pintarTodo() {
    leerTema();
    raiz.style.setProperty("--fu-color", colorRed(est.red));
    const red = P.redes[est.red];
    $("sub").innerHTML = `Previsión hecha el <b>${P_GEN}</b> con los datos hasta el <b>${fecha(red.datos_hasta)}</b> (${esc(defRed(est.red).largo)}).`;
    pintarMandos();
    const S = serieDe(est.red, est.met);
    $("graftit").innerHTML = `Previsión · <b>${esc(nombreMet(est.met))}</b><small>${esc(defRed(est.red).largo)}${S && S.actual != null ? ` · hoy ${fmtN(S.actual)}${tipoDe(est.met) === "flujo" ? " al día (media de 7 días)" : ""}` : ""}</small>`;
    const objs = tipoDe(est.met) === "nivel" ? (red.hitos || []).filter(h => h.metrica === est.met && h.objetivo != null) : [], G0 = S;
    $("claves").innerHTML = `<span><i class="fu-k-real"></i>${tipoDe(est.met) === "flujo" ? "Real: barras del día y media de 7 días" : "Real"}</span>
      <span><i class="fu-k-p50"></i>Lo más probable (p50)</span><span><i class="fu-k-banda"></i>8 de cada 10 veces cae aquí (p10–p90)</span>
      ${G0 && G0.constante ? `<span><i class="fu-k-cons"></i>Si se queda como ahora (ritmo de los últimos 30 días)</span>` : ""}
      <span><i class="fu-k-hoy"></i>Último dato real</span>${objs.length ? `<span><i class="fu-k-obj"></i>Objetivo</span>` : ""}`;
    $("grafnota").textContent = (S && S.ritmo ? S.ritmo + ". " : "") + (tipoDe(est.met) === "flujo"
      ? "Cada punto de la previsión es un día; las tarjetas de abajo suman todo el periodo."
      : "Desde los 3 meses la previsión viene por semanas; la gráfica une los puntos con rectas.");
    pintarGrafica();
    alMoverse();
    pintarLeyenda(null);
    pintarTarjetas();
    pintarMon();
    pintarHitos();
    pintarPicos();
    pintarAcierto();
    pintarComo();
    const av = avisos.slice();
    if (E && E.generado) av.push(`Eventos de lo que pasó: ${fmt((E.eventos || []).length)}, actualizados el ${fecha(E.generado)}${E.generado.length > 10 ? " a las " + E.generado.slice(11, 16) : ""}.`);
    $("avisos").innerHTML = av.map(a => `<p class="fu-nota">${esc(a)}</p>`).join("");
    botonLleno();
  }
  pintarTodo();
  ro.observe($("tarjetas"));

  return {
    actualizarTema() {
      if (!raiz.isConnected) return;
      const v = chart ? chart.timeScale().getVisibleLogicalRange() : null;
      pintarTodo();
      if (v && chart) try { chart.timeScale().setVisibleLogicalRange(v); } catch (e) { /* fuera de datos */ }
    },
    destruir() {
      cancelAnimationFrame(rafVis);
      ro.disconnect();
      document.removeEventListener("fullscreenchange", alCambiarLleno);
      document.removeEventListener("keydown", alTecla);
      if (document.fullscreenElement && raiz.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {});
      quitarGrafica();
      quitarMon();
      raiz.remove();
      if (linkCss && !document.querySelector(".fu")) linkCss.remove();
    },
  };
}
export default montarFuturo;
