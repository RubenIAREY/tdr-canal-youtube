/* Panel de redes TDR · versión «Terminal» (prueba de diseño).
   Misma lógica y mismos datos que panel.js (datos_redes.json, que rehace PANEL-REDES/construir_panel.py a las 9:00 y a las 17:00),
   con otra presentación: cabecera de «valor», tres bloques de cotización con su minigráfica, cuadrícula de gráficas, carril con los
   valores de cada red, la tienda y las últimas publicaciones. Gráficas: TradingView lightweight-charts 4.2. */
"use strict";
const LC = window.LightweightCharts;
const $ = s => document.querySelector(s);
const REDES = ["youtube", "instagram", "tiktok", "facebook"];
const SIMB = { global: "TOTAL", youtube: "YT", instagram: "IG", tiktok: "TT", facebook: "FB" };
const MARCA = "#d71119";
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmt = (n, d = 0) => n == null || isNaN(n) ? "–" : Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
const signo = (n, d = 0) => n == null || isNaN(n) ? "–" : (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), d);
const cls = n => n == null || isNaN(n) || n === 0 ? "igual" : n > 0 ? "sube" : "baja";
const flecha = n => n == null || isNaN(n) ? "" : n > 0 ? "▲ " : n < 0 ? "▼ " : "■ ";
const fecha = s => { if (!s) return "–"; const [y, m, d] = s.slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]} ${y}`; };
const diaMes = s => { const [, m, d] = s.slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]}`; };
const pct = (a, b) => b ? (a - b) / b * 100 : null;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const colorRed = k => k === "global" ? MARCA : D.redes[k].color;
const nombreRed = k => k === "global" ? "Todas las redes" : D.redes[k].nombre;

/* ─────────── ajustes en vivo ─────────── */
const AJ = [
  { k: "paleta", t: "Paleta", def: "grafito", cols: 2, ops: [
    ["grafito", "Grafito", ["#0c0f13", "#181d25", "#d71119", "#2fb59a"]],
    ["medianoche", "Medianoche", ["#090e19", "#142036", "#d71119", "#7aa8ff"]],
    ["rojo", "Rojo profundo", ["#0b090a", "#161a1d", "#660708", "#d71119"]],
    ["claro", "Claro", ["#eef0f3", "#ffffff", "#d71119", "#0c8a70"]]] },
  { k: "letra", t: "Letra", def: "plex", cols: 1, ops: [
    ["plex", "IBM Plex Sans + IBM Plex Mono"], ["geist", "Instrument Sans + Geist + Geist Mono"], ["barlow", "Barlow + JetBrains Mono"]] },
  { k: "densidad", t: "Densidad", def: "normal", ops: [["compacta", "Compacta"], ["normal", "Normal"], ["amplia", "Amplia"]] },
  { k: "graficas", t: "Gráficas", def: "cuadricula", cols: 2, ops: [["cuadricula", "Cuadrícula 2 × 2"], ["columna", "Una columna"]] },
  { k: "rejilla", t: "Rejilla de las gráficas", def: "si", cols: 2, ops: [["si", "Con rejilla"], ["no", "Sin rejilla"]] },
  { k: "animar", t: "Cifras al cargar", def: "si", cols: 2, ops: [["si", "Animadas"], ["no", "Fijas"]] },
];
const FUENTES = {
  plex: "family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600",
  geist: "family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Instrument+Sans:wght@500;600;700",
  barlow: "family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600",
};
const CLAVE = "tdr-terminal-ajustes";
const AJUSTES = {};

function leerAjustes() {
  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { guardado = {}; }
  const q = new URLSearchParams(location.search);
  AJ.forEach(a => { const v = q.get(a.k) ?? guardado[a.k]; AJUSTES[a.k] = a.ops.some(o => o[0] === v) ? v : a.def; });
}
function aplicarAjustes(conRepintado = true) {
  const html = document.documentElement;
  AJ.forEach(a => { html.dataset[a.k] = AJUSTES[a.k]; });
  const link = $("#fuentes"), href = `https://fonts.googleapis.com/css2?${FUENTES[AJUSTES.letra]}&display=swap`;
  if (link.getAttribute("href") !== href) {
    link.onload = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { if (D) repintar(); });
    link.setAttribute("href", href);
  }
  try { localStorage.setItem(CLAVE, JSON.stringify(AJUSTES)); } catch (e) { /* sin almacenamiento: da igual */ }
  const q = new URLSearchParams(location.search);
  AJ.forEach(a => q.set(a.k, AJUSTES[a.k]));
  history.replaceState(null, "", "?" + q.toString() + location.hash);
  pintarAjustes();
  if (conRepintado && D) repintar();
}
function pintarAjustes(foco) {
  const c = $("#aj-cuerpo");
  c.innerHTML = AJ.map(a => `<fieldset class="aj-grupo"><legend>${a.t}</legend><div class="aj-ops" style="--cols:${a.cols || 3}">` +
    a.ops.map(o => `<button type="button" data-k="${a.k}" data-v="${o[0]}" aria-pressed="${AJUSTES[a.k] === o[0]}">` +
      (o[2] ? `<span class="muestra" aria-hidden="true">${o[2].map(x => `<i style="background:${x}"></i>`).join("")}</span>` : "") + `${o[1]}</button>`).join("") +
    `</div></fieldset>`).join("");
  c.querySelectorAll("button").forEach(b => b.onclick = () => {
    AJUSTES[b.dataset.k] = b.dataset.v; aplicarAjustes(); aviso("");
    const n = c.querySelector(`button[data-k="${b.dataset.k}"][data-v="${b.dataset.v}"]`); if (n) n.focus();
  });
  if (foco) { const b = c.querySelector('button[aria-pressed="true"]'); if (b) b.focus(); }
}
function aviso(html) { $("#aj-aviso").innerHTML = html; }
function abrirAjustes(si) {
  const p = $("#ajustes"), b = $("#ajustes-btn");
  p.classList.toggle("abierto", si); p.setAttribute("aria-hidden", String(!si)); p.inert = !si;
  b.setAttribute("aria-expanded", String(si));
  if (si) { const x = p.querySelector('button[aria-pressed="true"]'); if (x) x.focus(); }
}
function montarAjustes() {
  const p = $("#ajustes"), b = $("#ajustes-btn");
  p.inert = true;
  b.onclick = () => abrirAjustes(!p.classList.contains("abierto"));
  $("#aj-cerrar").onclick = () => { abrirAjustes(false); b.focus(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && p.classList.contains("abierto")) { abrirAjustes(false); b.focus(); } });
  document.addEventListener("pointerdown", e => { if (p.classList.contains("abierto") && !p.contains(e.target) && !b.contains(e.target)) abrirAjustes(false); });
  $("#aj-copiar").onclick = async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); aviso("Enlace copiado. Pégalo en el chat para decir cuál te gusta."); }
    catch (e) { aviso(`<input readonly value="${esc(url)}" style="width:100%;font:12px var(--f-cifra);padding:6px;background:var(--capa2);color:var(--tinta);border:1px solid var(--linea)">`);
      const i = $("#aj-aviso input"); i.focus(); i.select(); }
  };
  $("#aj-reset").onclick = () => { AJ.forEach(a => { AJUSTES[a.k] = a.def; }); aplicarAjustes(); aviso("Vuelta a los valores de partida."); };
}

/* ─────────── arranque ─────────── */
let D, vista = "global", modoSeg = "velas", modoComp = "seg", modoLk = "dia", filtroRed = "todas", orden = "fecha";
let periodoSeg = "semana", modoAcum = "velas", periodoAcum = "semana";   // velas de seguidores y del acumulado: día, semana o mes
let graficas = {}, sincronizando = false;

leerAjustes(); montarAjustes(); aplicarAjustes(false);
fetch("../../datos_redes.json?" + Date.now()).then(r => r.json())
  .then(d => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { D = d; arrancar(); }))
  .catch(e => { $("#principal").innerHTML = `<p class="nota">No se han podido cargar los datos (${esc(e)}).</p>`; });

function arrancar() {
  $("#actualizado").textContent = fecha(D.actualizado) + " · " + D.actualizado.slice(11);
  valores(); tiendaMini(); teletipo();
  document.querySelectorAll("#pestanas button").forEach(b => b.onclick = () => ir(b.dataset.vista));
  document.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => ir(b.dataset.ir));
  document.querySelectorAll("#modo-seg button").forEach(b => b.onclick = () => { modoSeg = b.dataset.m; marcar("#modo-seg", b); seguidores(vista); });
  document.querySelectorAll("#periodo-seg button").forEach(b => b.onclick = () => { periodoSeg = b.dataset.p; marcar("#periodo-seg", b); seguidores(vista); });
  document.querySelectorAll("#modo-acum button").forEach(b => b.onclick = () => { modoAcum = b.dataset.m; marcar("#modo-acum", b); acumulado(vista); });
  document.querySelectorAll("#periodo-acum button").forEach(b => b.onclick = () => { periodoAcum = b.dataset.p; marcar("#periodo-acum", b); acumulado(vista); });
  document.querySelectorAll("#modo-comp button").forEach(b => b.onclick = () => { modoComp = b.dataset.m; marcar("#modo-comp", b); comparativa(); });
  document.querySelectorAll("#modo-lk button").forEach(b => b.onclick = () => { modoLk = b.dataset.m; marcar("#modo-lk", b); megusta(vista); });
  document.querySelectorAll("#filtros button[data-f]").forEach(b => b.onclick = () => { filtroRed = b.dataset.f; marcar("#filtros", b, "[data-f]"); tablaVideos(); });
  document.querySelectorAll("#filtros button[data-o]").forEach(b => b.onclick = () => { orden = b.dataset.o; marcar("#filtros", b, "[data-o]"); tablaVideos(); });
  document.querySelectorAll(".grupo.rango").forEach(g => {
    g.innerHTML = ["1M", "3M", "6M", "1A", "2A", "Todo"].map(r => `<button data-r="${r}">${r}</button>`).join("");
    g.querySelectorAll("button").forEach(b => b.onclick = () => rango(g.dataset.graf, b.dataset.r));
  });
  const h = location.hash.slice(1);
  ir(["global", ...REDES, "impacto", "videos"].includes(h) ? h : "global");
}
function marcar(sel, b, filtro = "") {
  const g = typeof sel === "string" ? $(sel) : sel;
  g.querySelectorAll("button" + filtro).forEach(x => x.classList.toggle("on", x === b));
}

/* ─────────── utilidades ─────────── */
function serieDe(k) {
  if (k === "global") return D.global_serie.map(x => ({ t: x[0], seg: x[1], vis: x[2], likes: x[3] }));
  return D.series[k].map(x => ({ t: x[0], seg: x[1], vis: x[2], gan: x[3], per: x[4], likes: x[5] }));
}
function recortarCola(s, campo) { let i = s.length; while (i > 0 && s[i - 1][campo] == null) i--; return s.slice(0, i); }
function media(vals, n) { const out = []; let suma = 0; const q = []; vals.forEach(v => { q.push(v); suma += v; if (q.length > n) suma -= q.shift(); out.push(suma / q.length); }); return out; }
function lunes(t) { const d = new Date(t + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }
// velas por periodo: "dia", "semana" (lunes) o "mes" (día 1). Abre con el cierre del periodo anterior y cierra con su último dato.
function clavePeriodo(t, periodo) { return periodo === "mes" ? t.slice(0, 7) + "-01" : periodo === "semana" ? lunes(t) : t; }
function velas(p, periodo) {
  const grupos = new Map(); p.forEach(x => { const k = clavePeriodo(x.time, periodo); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(x.value); });
  let prev = null; const out = [];
  for (const [k, a] of grupos) { const open = prev ?? a[0], close = a[a.length - 1]; out.push({ time: k, open, close, high: Math.max(open, ...a), low: Math.min(open, ...a) }); prev = close; }
  return out;
}
const NOMBRE_PERIODO = { dia: "un día", semana: "una semana", mes: "un mes" };
function etiquetaPeriodo(t, periodo) {
  if (periodo === "mes") { const [y, m] = t.split("-"); return `${MES[+m - 1]} ${y}`; }
  return (periodo === "semana" ? "semana del " : "") + fecha(t);
}
function spark(vals, color, alto = 38) {
  const v = vals.filter(x => x != null && !isNaN(x));
  if (v.length < 2) return `<svg class="spark" viewBox="0 0 120 ${alto}" aria-hidden="true"></svg>`;
  const w = 120, min = Math.min(...v), max = Math.max(...v), r = max - min || 1;
  const pts = v.map((y, i) => [i / (v.length - 1) * w, alto - 3 - (y - min) / r * (alto - 6)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
  return `<svg class="spark" viewBox="0 0 ${w} ${alto}" preserveAspectRatio="none" aria-hidden="true">` +
    `<path d="${d}L${w} ${alto}L0 ${alto}Z" fill="${color}" opacity=".13"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
const num = (n, d = 0, conSigno = false, u = "") => n == null || isNaN(n) ? "–" :
  `<span data-n="${n}" data-d="${d}"${conSigno ? ' data-s="1"' : ""}${u ? ` data-u="${esc(u)}"` : ""}>${(conSigno ? signo(n, d) : fmt(n, d)) + u}</span>`;
function animarCifras(raiz) {
  if (AJUSTES.animar !== "si" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const els = [...raiz.querySelectorAll("[data-n]")]; if (!els.length) return;
  const t0 = performance.now(), dur = 750;
  const paso = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    els.forEach(el => { const n = +el.dataset.n, d = +(el.dataset.d || 0), v = k < 1 ? n * e : n;
      el.textContent = (el.dataset.s ? signo(v, d) : fmt(v, d)) + (el.dataset.u || ""); });
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/* ─────────── carril: valores, tienda y teletipo ─────────── */
function filaValor(k) {
  const R = k === "global" ? D.global_ : D.redes[k].resumen, color = colorRed(k);
  const p = pct(R.seguidores, R.seguidores - (R.d30 || 0));
  const segs = serieDe(k).filter(x => x.seg != null).slice(-90).map(x => x.seg);
  return `<button class="valor" data-k="${k}" aria-label="${nombreRed(k)}: ${fmt(R.seguidores)} seguidores, ${signo(R.d30)} en 30 días">
    <span class="n"><b><i style="background:${color}"></i>${SIMB[k]}</b><span>${nombreRed(k)}</span></span>
    <span class="p"><b>${fmt(R.seguidores)}</b><span class="${cls(R.d30)}">${signo(R.d30)} · ${signo(p, 1)} %</span></span>
    ${spark(segs, color, 28)}</button>`;
}
function valores() {
  const html = ["global", ...REDES].map(filaValor).join("");
  $("#valores").innerHTML = html; $("#cinta").innerHTML = html;
  document.querySelectorAll(".valor").forEach(b => b.onclick = () => ir(b.dataset.k));
}
function tiendaMini() {
  const T = D.tienda.resumen, suma = i => REDES.reduce((a, r) => a + (T.d30[r] ? T.d30[r][i] : 0), 0);
  const c = suma(1);
  $("#tienda-mini").innerHTML = `<div><b>${fmt(suma(0))}</b><span>visitas</span></div><div><b>${fmt(c)}</b><span>${c === 1 ? "compra" : "compras"}</span></div>` +
    `<div><b>${fmt(suma(2), 2)} €</b><span>importe</span></div>`;
}
function teletipo() {
  const L = D.publicaciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);
  $("#teletipo").innerHTML = L.map(p => `<li><time datetime="${p.fecha.replace(" ", "T")}">${diaMes(p.fecha)} · ${p.fecha.slice(11, 16)}</time>
    <span class="chip"><i style="background:${D.redes[p.red].color}"></i>${SIMB[p.red]}${p.tipo ? ` · ${p.tipo === "largo" ? "LARGO" : "SHORT"}` : ""}</span>
    <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.titulo || "(sin título)")}</a>
    <span class="mini">${fmt(p.vis)} visualizaciones · ${fmt(p.likes)} me gusta</span></li>`).join("");
}

/* ─────────── navegación ─────────── */
function ir(v, conAnimacion = true) {
  vista = v;
  history.replaceState(null, "", location.search + "#" + v);
  document.querySelectorAll("#pestanas button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.vista === v)));
  document.querySelectorAll(".valor").forEach(b => b.classList.toggle("on", b.dataset.k === v));
  const activo = document.querySelector(`#cinta .valor[data-k="${v}"]`);
  if (activo && conAnimacion) activo.scrollIntoView({ block: "nearest", inline: "nearest" });
  Object.values(graficas).forEach(g => g && g.remove()); graficas = {};
  $("#v-red").classList.toggle("oculta", !(v === "global" || REDES.includes(v)));
  $("#v-impacto").classList.toggle("oculta", v !== "impacto");
  $("#v-videos").classList.toggle("oculta", v !== "videos");
  if (v === "impacto") impacto(conAnimacion); else if (v === "videos") tablaVideos(); else pintarRed(v, conAnimacion);
  if (conAnimacion) window.scrollTo({ top: 0 });
}
function repintar() { if (D) ir(vista, false); }

/* ─────────── gráficas ─────────── */
function tema() {
  const s = getComputedStyle(document.documentElement), v = k => s.getPropertyValue(k).trim();
  return { fondo: v("--g-fondo"), texto: v("--g-texto"), rejilla: AJUSTES.rejilla === "si" ? v("--g-rejilla") : "rgba(0,0,0,0)", borde: v("--g-borde"),
    sube: v("--sube"), baja: v("--baja"), ma7: v("--ma7"), ma30: v("--ma30"), letra: v("--f-cifra") || "monospace" };
}
function crear(id, extra = {}) {
  const T = tema(), el = document.getElementById(id); el.innerHTML = "";
  const ch = LC.createChart(el, Object.assign({
    autoSize: true,
    layout: { background: { type: "solid", color: T.fondo }, textColor: T.texto, fontFamily: T.letra, fontSize: 11, attributionLogo: false },
    grid: { vertLines: { color: T.rejilla }, horzLines: { color: T.rejilla } },
    rightPriceScale: { borderColor: T.borde }, timeScale: { borderColor: T.borde, rightOffset: 3 },
    crosshair: { mode: LC.CrosshairMode.Normal },
    localization: { locale: "es-ES", priceFormatter: p => fmt(p, Math.abs(p) < 10 && p % 1 ? 1 : 0),
      percentageFormatter: p => signo(p, Math.abs(p) < 10 ? 1 : 0) + " %", dateFormat: "dd MMM yyyy" },
  }, extra));
  graficas[id] = ch;
  return ch;
}
const enlaces = {};                                    // un solo enlace de sincronía por gráfica
function sincronizar(ids) {
  ids.forEach(a => {
    const ch = graficas[a]; if (!ch) return;
    if (enlaces[a] && enlaces[a].ch === ch) ch.timeScale().unsubscribeVisibleTimeRangeChange(enlaces[a].fn);
    const fn = r => {
      if (sincronizando || !r) return; sincronizando = true;
      ids.forEach(b => { if (b !== a && graficas[b]) try { graficas[b].timeScale().setVisibleRange(r); } catch (e) { /* fuera de datos */ } });
      sincronizando = false;
    };
    ch.timeScale().subscribeVisibleTimeRangeChange(fn); enlaces[a] = { ch, fn };
  });
}
const CUATRO = ["g-seg", "g-vis", "g-acum", "g-lk"];
const GRAF = { seg: CUATRO, comp: ["g-comp"], tienda: ["g-tienda"], marca: ["g-marca"] };
function rango(graf, r) {
  const hasta = new Date(D.actualizado.slice(0, 10) + "T00:00:00Z");
  GRAF[graf].forEach(id => {
    const ch = graficas[id]; if (!ch) return;
    if (r === "Todo") { ch.timeScale().fitContent(); return; }
    const desde = new Date(hasta); desde.setUTCMonth(desde.getUTCMonth() - { "1M": 1, "3M": 3, "6M": 6, "1A": 12, "2A": 24 }[r]);
    try { ch.timeScale().setVisibleRange({ from: desde.toISOString().slice(0, 10), to: hasta.toISOString().slice(0, 10) }); } catch (e) { /* sin datos */ }
  });
  document.querySelectorAll(`.grupo.rango[data-graf="${graf}"] button`).forEach(b => b.classList.toggle("on", b.dataset.r === r));
}
function leyenda(id, ch, filas, periodo = null) {     // periodo: si la serie son velas
  const el = document.getElementById(id);
  const pinta = param => {
    let t = null;
    const vals = filas.map(f => {
      let d = null;
      if (param && param.time && param.seriesData) { d = param.seriesData.get(f.serie) || null; t = param.time; }
      else { const u = f.datos[f.datos.length - 1]; if (u) { d = u; t = u.time; } }
      const v = d ? (d.close ?? d.value) : null, cambio = d && d.open != null ? d.close - d.open : null;
      return `<span><i style="background:${f.color}"></i>${f.nombre} <b>${v == null ? "–" : (f.fmt || fmt)(v)}</b>` +
        (cambio != null ? ` · cambio <b class="${cls(cambio)}">${signo(cambio)}</b>` : "") + `</span>`;
    });
    const tt = t ? (typeof t === "string" ? t : `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`) : null;
    el.innerHTML = `<span>${tt ? (periodo ? etiquetaPeriodo(tt, periodo) : fecha(tt)) : ""}</span>` + vals.join("");
  };
  ch.subscribeCrosshairMove(pinta); pinta(null);
}

/* ─────────── vista de una red (o global) ─────────── */
function pintarRed(k, conAnimacion = true) {
  const esG = k === "global", R = esG ? D.global_ : D.redes[k].resumen, color = colorRed(k), s = serieDe(k), T = tema();
  cabecera(k, R, color); cotizaciones(k, R, s, color, conAnimacion);
  seguidores(k, true);

  // visualizaciones diarias: barras (verde si el día supera su media de 30) + medias de 7 y 30
  const sv = recortarCola(s.filter(x => x.t >= (R.desde_vis || "0")), "vis");
  const vals = sv.map(x => x.vis || 0), m7 = media(vals, 7), m30 = media(vals, 30);
  const g2 = crear("g-vis");
  const barras = g2.addHistogramSeries({ priceFormat: { type: "volume" }, priceLineVisible: false });
  barras.setData(sv.map((x, i) => ({ time: x.t, value: vals[i], color: vals[i] >= m30[i] ? T.sube + "cc" : T.baja + "99" })));
  const l7 = g2.addLineSeries({ color: T.ma7, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  l7.setData(sv.map((x, i) => ({ time: x.t, value: m7[i] })));
  const l30 = g2.addLineSeries({ color: T.ma30, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  l30.setData(sv.map((x, i) => ({ time: x.t, value: m30[i] })));
  leyenda("ley-vis", g2, [{ nombre: "Día", color: T.sube, serie: barras, datos: barras.data() },
    { nombre: "Media 7 d", color: T.ma7, serie: l7, datos: l7.data() }, { nombre: "Media 30 d", color: T.ma30, serie: l30, datos: l30.data() }]);

  acumulado(k, true);
  megusta(k, true);
  sincronizar(["g-vis", "g-acum", "g-lk"]);
  $("#p-comp").classList.toggle("oculta", !esG);
  if (esG) comparativa();
  const act = document.querySelector('.grupo.rango[data-graf="seg"] button.on');
  rango("seg", act && !conAnimacion ? act.dataset.r : (k === "youtube" || esG ? "1A" : "Todo"));
}
function rangoActual(k) {
  const act = document.querySelector('.grupo.rango[data-graf="seg"] button.on');
  return act ? act.dataset.r : (k === "youtube" || k === "global" ? "1A" : "Todo");
}

/* seguidores: velas (día, semana o mes) o línea */
function seguidores(k, inicial = false) {
  const esG = k === "global", R = esG ? D.global_ : D.redes[k].resumen, color = colorRed(k), T = tema();
  const segs = serieDe(k).filter(x => x.seg != null).map(x => ({ time: x.t, value: x.seg }));
  if (graficas["g-seg"]) { graficas["g-seg"].remove(); delete graficas["g-seg"]; }
  const g1 = crear("g-seg");
  let serie1, d1;
  if (modoSeg === "velas") {
    serie1 = g1.addCandlestickSeries({ upColor: T.sube, downColor: T.baja, borderVisible: false, wickUpColor: T.sube, wickDownColor: T.baja, priceFormat: { type: "price", precision: 0, minMove: 1 } });
    d1 = velas(segs, periodoSeg);
  } else {
    serie1 = g1.addAreaSeries({ lineColor: color, topColor: color + "55", bottomColor: color + "05", lineWidth: 2, priceFormat: { type: "price", precision: 0, minMove: 1 } });
    d1 = segs;
  }
  serie1.setData(d1);
  $("#periodo-seg").classList.toggle("oculta", modoSeg !== "velas");
  leyenda("ley-seg", g1, [{ nombre: modoSeg === "velas" ? "Cierre" : "Seguidores", color: modoSeg === "velas" ? T.sube : color, serie: serie1, datos: d1 }], modoSeg === "velas" ? periodoSeg : null);
  $("#t-seg").innerHTML = esG ? "Seguidores <small>suma de las cuatro redes</small>" : `Seguidores <small>${D.redes[k].nombre}</small>`;
  $("#n-seg").textContent = (esG
    ? `La suma empieza el ${fecha(R.desde_seg)}, el primer día con seguidores medidos en las cuatro redes.`
    : k === "youtube" ? "Desde que se abrió el canal: los seguidores de cada día salen de los suscriptores ganados y perdidos de YouTube Analytics."
      : `Metricool guarda los seguidores de ${D.redes[k].nombre} desde el ${fecha(R.desde_seg)}.`) +
    (modoSeg === "velas" ? ` Cada vela es ${NOMBRE_PERIODO[periodoSeg]}: abre con el cierre del anterior; verde si sube, naranja si baja.` : "");
  if (!inicial) rango("seg", rangoActual(k));
}

/* visualizaciones acumuladas: velas (día, semana o mes) o área */
function acumulado(k, inicial = false) {
  const esG = k === "global", R = esG ? D.global_ : D.redes[k].resumen, color = colorRed(k), T = tema();
  const sv = recortarCola(serieDe(k).filter(x => x.t >= (R.desde_vis || "0")), "vis");
  let acum = 0; const ac = sv.map(x => ({ time: x.t, value: (acum += x.vis || 0) }));
  if (graficas["g-acum"]) { graficas["g-acum"].remove(); delete graficas["g-acum"]; }
  const g3 = crear("g-acum");
  let a3, d3;
  if (modoAcum === "velas") {
    a3 = g3.addCandlestickSeries({ upColor: T.sube, downColor: T.baja, borderVisible: false, wickUpColor: T.sube, wickDownColor: T.baja, priceFormat: { type: "volume" } });
    d3 = velas(ac, periodoAcum);
  } else {
    a3 = g3.addAreaSeries({ lineColor: color, topColor: color + "44", bottomColor: color + "03", lineWidth: 2, priceFormat: { type: "volume" } });
    d3 = ac;
  }
  a3.setData(d3);
  $("#periodo-acum").classList.toggle("oculta", modoAcum !== "velas");
  leyenda("ley-acum", g3, [{ nombre: modoAcum === "velas" ? "Cierre" : "Acumulado", color: modoAcum === "velas" ? T.sube : color, serie: a3, datos: d3 }], modoAcum === "velas" ? periodoAcum : null);
  $("#sub-acum").textContent = (esG ? `Suma de las cuatro redes desde el ${fecha(sv[0] && sv[0].t)} (cada red entra cuando hay datos).`
    : `Desde el ${fecha(sv[0] && sv[0].t)}${k === "youtube" ? ", el primer día del canal." : " (lo que guarda Metricool)."}`) +
    (modoAcum === "velas" ? ` Cada vela es ${NOMBRE_PERIODO[periodoAcum]}: el cuerpo son las visualizaciones sumadas en ese periodo.` : "");
  if (!inicial) { sincronizar(["g-vis", "g-acum", "g-lk"]); rango("seg", rangoActual(k)); }
}

function cabecera(k, R, color) {
  const esG = k === "global", r30 = pct(R.seguidores, R.seguidores - (R.d30 || 0));
  const ico = esG ? `<img src="../../logo-tdr.png" alt="" width="30" height="30">` : `<span style="color:${k === "tiktok" ? "#06121a" : "#fff"}">${SIMB[k]}</span>`;
  $("#simbolo").innerHTML = `<div class="izq"><div class="ico" style="background:${esG ? "var(--capa2)" : color}">${ico}</div><div>
      <div class="ticker"><em>TDR</em>:${SIMB[k]}</div>
      <h1>${nombreRed(k)}<small>${esG ? "YouTube, Instagram, TikTok y Facebook juntos" : esc(D.redes[k].usuario)}</small></h1>
      ${esG ? "" : `<a class="verperfil" href="${esc(D.redes[k].url)}" target="_blank" rel="noopener">Ver el perfil en ${D.redes[k].nombre} ↗</a>`}</div></div>
    <div class="der"><div class="precio">${num(R.seguidores)}<small>seguidores</small></div>
      <div class="var ${cls(R.d30)}">${flecha(R.d30)}${num(R.d30, 0, true)} (${signo(r30, 2)} %) <span>en 30 días · dato del ${fecha(R.fecha_seg)}</span></div></div>`;
}

function cotizaciones(k, R, s, color, conAnimacion) {
  const esG = k === "global";
  const seg90 = s.filter(x => x.seg != null).slice(-90).map(x => x.seg);
  let gan = null, per = null;
  if (!esG) {
    const desde = new Date(Date.parse(D.actualizado.slice(0, 10)) - 30 * 864e5).toISOString().slice(0, 10);
    const ult = s.filter(x => x.t > desde);
    if (ult.some(x => x.gan != null)) { gan = ult.reduce((a, x) => a + (x.gan || 0), 0); per = ult.reduce((a, x) => a + (x.per || 0), 0); }
  }
  const sv = recortarCola(s.filter(x => x.t >= (R.desde_vis || "0")), "vis");
  const vals = sv.map(x => x.vis || 0), m7 = media(vals, 7), m30 = media(vals, 30);
  const tend = m30.length > 60 ? pct(m30[m30.length - 1], m30[m30.length - 31]) : null;
  const tendTxt = tend == null ? "–" : tend > 3 ? "Creciendo" : tend < -3 ? "Bajando" : "Estable";
  const sl = recortarCola(s.filter(x => x.t >= (R.desde_lk || "9999")), "likes");
  const lm7 = media(sl.map(x => x.likes || 0), 7);
  const hist = k === "youtube" ? "todo el canal, desde 2021" : esG ? "suma de las cuatro redes" : `medidas desde el ${fecha(R.desde_vis)}`;
  const fila = (dt, dd, nota = "", c = "") => `<div class="fila"><dt>${dt}</dt><dd class="${c}">${dd}${nota ? `<small>${nota}</small>` : ""}</dd></div>`;
  const r30 = pct(R.seguidores, R.seguidores - (R.d30 || 0));
  const c = $("#cotizaciones");
  c.innerHTML = `
  <div class="caja cot entra">
    <div class="e">Seguidores <span>· cambio en 30 días</span></div>
    <div class="v ${cls(R.d30)}">${num(R.d30, 0, true)}</div>
    <div class="c ${cls(R.d30)}">${flecha(R.d30)}${signo(r30, 2)} % <span>· ${signo(R.media_dia_30, 2)} al día de media</span></div>
    ${spark(seg90, color)}<div class="leye">Seguidores, últimos 90 días con dato (hasta el ${fecha(R.fecha_seg)})</div>
    <dl>${fila("Último día", signo(R.d1), "", cls(R.d1))}
      ${fila("7 días", signo(R.d7), `${signo(R.d7 / 7, 1)} al día`, cls(R.d7))}
      ${fila("90 días", signo(R.d90), `${signo(R.media_dia_90, 2)} al día`, cls(R.d90))}
      ${gan != null ? fila("Ganados / perdidos (30 d)", `${fmt(gan)} / ${fmt(per)}`, `neto ${signo(gan - per)}`) : ""}</dl>
  </div>
  <div class="caja cot entra">
    <div class="e">Visualizaciones <span>· últimos 30 días</span></div>
    <div class="v">${num(R.vis_30)}</div>
    <div class="c ${cls(R.vis_cambio_30)}">${flecha(R.vis_cambio_30)}${num(R.vis_cambio_30, 1, true, " %")} <span>frente a los 30 anteriores</span></div>
    ${spark(m7.slice(-90), color)}<div class="leye">Media de 7 días, últimos 90 días con dato</div>
    <dl>${fila("Media diaria (30 d)", fmt(R.vis_media_30))}
      ${fila("Últimos 7 días", fmt(R.vis_7))}
      ${fila("Históricas", fmt(R.vis_historico), hist)}
      ${fila("Tendencia", tendTxt, tend == null ? "falta historia" : `media 30 d ${signo(tend, 1)} % en un mes`, cls(tend))}</dl>
  </div>
  <div class="caja cot entra">
    <div class="e">Me gusta <span>· últimos 30 días</span></div>
    <div class="v">${num(R.lk_30)}</div>
    <div class="c ${cls(R.lk_cambio_30)}">${R.lk_cambio_30 == null ? `<span>sin comparación con los 30 anteriores</span>` : `${flecha(R.lk_cambio_30)}${num(R.lk_cambio_30, 1, true, " %")} <span>frente a los 30 anteriores</span>`}</div>
    ${spark(lm7.slice(-90), color)}<div class="leye">Media de 7 días, últimos 90 días con dato</div>
    <dl>${fila("Media diaria (30 d)", fmt(R.lk_media_30, 1))}
      ${fila("Últimos 7 días", fmt(R.lk_7))}
      ${fila("Históricos", fmt(R.lk_total), R.desde_lk ? "desde el " + fecha(R.desde_lk) : "sin datos")}
      ${fila("Por cada 100 visualizaciones", R.vis_30 ? fmt(R.lk_30 / R.vis_30 * 100, 2) : "–", "30 días")}</dl>
  </div>`;
  if (conAnimacion) { animarCifras(c); animarCifras($("#simbolo")); }
}

/* ─────────── me gusta ─────────── */
const NOTA_LK = {
  youtube: "YouTube: me gusta recibidos cada día por todos los vídeos del canal (YouTube Analytics).",
  tiktok: "TikTok: me gusta recibidos cada día por los vídeos de la cuenta (Metricool).",
  instagram: "Instagram: me gusta de cada publicación y reel, contados el día que se publicó (Metricool no los da por día recibido).",
  facebook: "Facebook: reacciones a las publicaciones de la página y me gusta de los reels (Metricool).",
  global: "Suma de las cuatro redes. YouTube y TikTok cuentan los me gusta del día; Instagram, los de lo publicado ese día; Facebook, reacciones y me gusta de reels.",
};
function megusta(k, inicial = false) {
  const esG = k === "global", R = esG ? D.global_ : D.redes[k].resumen, T = tema();
  if (graficas["g-lk"]) { graficas["g-lk"].remove(); delete graficas["g-lk"]; }
  const s = recortarCola(serieDe(k).filter(x => x.t >= (R.desde_lk || "9999")), "likes");
  const vals = s.map(x => x.likes || 0);
  const g = crear("g-lk");
  if (modoLk === "dia") {
    const m7 = media(vals, 7), m30 = media(vals, 30);
    const b = g.addHistogramSeries({ priceFormat: { type: "volume" }, priceLineVisible: false });
    b.setData(s.map((x, i) => ({ time: x.t, value: vals[i], color: vals[i] >= m30[i] ? T.sube + "cc" : T.baja + "99" })));
    const l7 = g.addLineSeries({ color: T.ma7, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l7.setData(s.map((x, i) => ({ time: x.t, value: m7[i] })));
    const l30 = g.addLineSeries({ color: T.ma30, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l30.setData(s.map((x, i) => ({ time: x.t, value: m30[i] })));
    leyenda("ley-lk", g, [{ nombre: "Día", color: T.sube, serie: b, datos: b.data() },
      { nombre: "Media 7 d", color: T.ma7, serie: l7, datos: l7.data(), fmt: v => fmt(v, 1) },
      { nombre: "Media 30 d", color: T.ma30, serie: l30, datos: l30.data(), fmt: v => fmt(v, 1) }]);
  } else {
    let a = 0; const ac = s.map(x => ({ time: x.t, value: (a += x.likes || 0) }));
    const col = colorRed(k);
    const ar = g.addAreaSeries({ lineColor: col, topColor: col + "44", bottomColor: col + "03", lineWidth: 2, priceFormat: { type: "volume" } });
    ar.setData(ac);
    leyenda("ley-lk", g, [{ nombre: "Acumulados", color: col, serie: ar, datos: ac }]);
  }
  $("#n-lk").textContent = (NOTA_LK[k] || "") + (s.length ? ` Desde el ${fecha(s[0].t)}.` : " Todavía no hay datos.");
  if (!inicial) {
    sincronizar(["g-vis", "g-acum", "g-lk"]);
    const act = document.querySelector('.grupo.rango[data-graf="seg"] button.on');
    rango("seg", act ? act.dataset.r : (k === "youtube" || esG ? "1A" : "Todo"));
  }
}

/* ─────────── comparativa (como en bolsa: % desde el primer día visible) ─────────── */
function comparativa() {
  if (graficas["g-comp"]) { graficas["g-comp"].remove(); delete graficas["g-comp"]; }
  const T = tema();
  const g = crear("g-comp", { rightPriceScale: { borderColor: T.borde, mode: LC.PriceScaleMode.Percentage } });
  const filas = [];
  REDES.forEach(r => {
    const s = serieDe(r); let datos;
    if (modoComp === "seg") datos = s.filter(x => x.seg != null).map(x => ({ time: x.t, value: x.seg }));
    else {
      const campo = modoComp === "likes" ? "likes" : "vis", desde = modoComp === "likes" ? D.redes[r].resumen.desde_lk : D.redes[r].resumen.desde_vis;
      const sv = recortarCola(s.filter(x => x.t >= (desde || "9999")), campo), m = media(sv.map(x => x[campo] || 0), 30);
      datos = sv.map((x, i) => ({ time: x.t, value: Math.max(m[i], 0.01) }));
    }
    const l = g.addLineSeries({ color: D.redes[r].color, lineWidth: 2, priceLineVisible: false });
    l.setData(datos); filas.push({ nombre: D.redes[r].nombre, color: D.redes[r].color, serie: l, datos });
  });
  leyenda("ley-comp", g, filas);
  const act = document.querySelector('.grupo.rango[data-graf="comp"] button.on');
  rango("comp", act ? act.dataset.r : "3M");
}

/* ─────────── impacto en TDR ─────────── */
function impacto(conAnimacion = true) {
  const T = D.tienda.resumen, Tm = tema();
  const tot = k => REDES.reduce((a, r) => a + (T[k][r] ? T[k][r][0] : 0), 0);
  const com = k => REDES.reduce((a, r) => a + (T[k][r] ? T[k][r][1] : 0), 0);
  const ing = k => REDES.reduce((a, r) => a + (T[k][r] ? T[k][r][2] : 0), 0);
  const marca = D.marca, c30 = marca.slice(-30).reduce((a, x) => a + x[1], 0), cprev = marca.slice(-60, -30).reduce((a, x) => a + x[1], 0);
  const total = tot("total") || 1;
  const kpi = (e, v, sub, c = "", barra = null, color = null) => `<div class="caja kpi entra"><div class="e">${e}</div><div class="v">${v}</div><div class="s ${c}">${sub || "&nbsp;"}</div>` +
    (barra != null ? `<div class="barra-dato" aria-hidden="true"><i style="background:${color};transform:scaleX(${Math.max(0, Math.min(1, barra))})"></i></div>` : "") + `</div>`;
  $("#kpis-tienda").innerHTML = [
    kpi("Visitas desde redes", num(tot("total")), `desde el ${fecha(T.desde)}`),
    kpi("Visitas: últimos 30 días", num(tot("d30")), `90 días: ${fmt(tot("d90"))}`),
    kpi("Compras atribuidas a redes", num(com("total")), `${fmt(ing("total"), 2)} € desde el ${fecha(T.desde)}`),
    ...REDES.map(r => kpi(`Desde ${D.redes[r].nombre}`, `${num(T.total[r] ? T.total[r][0] : 0)} <small style="font:400 12px var(--f-texto);color:var(--tinta-tenue)">visitas</small>`,
      `${fmt(T.total[r] ? T.total[r][1] : 0)} ${(T.total[r] ? T.total[r][1] : 0) === 1 ? "compra" : "compras"} · ${fmt(T.total[r] ? T.total[r][2] : 0, 2)} €`, "", (T.total[r] ? T.total[r][0] : 0) / total, D.redes[r].color)),
    kpi("Búsquedas de la marca: 30 días", `${num(c30)} <small style="font:400 12px var(--f-texto);color:var(--tinta-tenue)">clics</small>`,
      `${flecha(pct(c30, cprev))}${signo(pct(c30, cprev), 1)} % frente a los 30 anteriores`, cls(pct(c30, cprev))),
  ].join("");
  if (conAnimacion) animarCifras($("#kpis-tienda"));

  const g = crear("g-tienda"), filas = [];
  REDES.forEach(r => {
    const sem = new Map();
    D.tienda.serie.forEach(([f, x]) => { const k = lunes(f); sem.set(k, (sem.get(k) || 0) + (x[r] ? x[r][0] : 0)); });
    const datos = [...sem].sort().map(([t, v]) => ({ time: t, value: v }));
    const l = g.addLineSeries({ color: D.redes[r].color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l.setData(datos); filas.push({ nombre: D.redes[r].nombre, color: D.redes[r].color, serie: l, datos });
  });
  leyenda("ley-tienda", g, filas); g.timeScale().fitContent();

  const gm = crear("g-marca"), vals = marca.map(x => x[1]), m7 = media(vals, 7);
  const b = gm.addHistogramSeries({ color: MARCA + "99", priceFormat: { type: "volume" }, priceLineVisible: false });
  b.setData(marca.map(x => ({ time: x[0], value: x[1] })));
  const l = gm.addLineSeries({ color: Tm.ma7, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  l.setData(marca.map((x, i) => ({ time: x[0], value: m7[i] })));
  leyenda("ley-marca", gm, [{ nombre: "Clics", color: MARCA, serie: b, datos: b.data() }, { nombre: "Media 7 d", color: Tm.ma7, serie: l, datos: l.data(), fmt: v => fmt(v, 1) }]);
  gm.timeScale().fitContent();
  document.querySelectorAll('.grupo.rango[data-graf="tienda"] button, .grupo.rango[data-graf="marca"] button').forEach(x => x.classList.toggle("on", x.dataset.r === "Todo"));

  const ventas = [];
  D.tienda.serie.forEach(([f, x]) => REDES.forEach(r => { if (x[r] && x[r][1]) ventas.push([f, r, x[r][1], x[r][2]]); }));
  ventas.sort((a, c) => c[0].localeCompare(a[0]));
  $("#tabla-ventas").innerHTML = ventas.length
    ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Día</th><th>Red</th><th class="n">Compras</th><th class="n">Importe</th></tr></thead><tbody>` +
      ventas.map(v => `<tr><td class="f">${fecha(v[0])}</td><td><span class="chip"><i style="background:${D.redes[v[1]].color}"></i>${D.redes[v[1]].nombre}</span></td><td class="n">${v[2]}</td><td class="n">${fmt(v[3], 2)} €</td></tr>`).join("") +
      `</tbody></table></div><p class="nota">Compras en las que Google Analytics atribuye la visita a una red social (último clic de la sesión).</p>`
    : `<p class="nota">Todavía no hay compras atribuidas a redes.</p>`;
}

/* ─────────── vídeos ─────────── */
function tablaVideos() {
  let L = D.publicaciones.filter(p => filtroRed === "todas" || p.red === filtroRed);
  L = L.slice().sort((a, b) => orden === "vis" ? b.vis - a.vis : orden === "likes" ? b.likes - a.likes : b.fecha.localeCompare(a.fecha));
  const max = Math.max(1, ...L.map(p => p.vis || 0));
  document.querySelector("#tabla-videos tbody").innerHTML = L.map(p => `<tr>
    <td class="f">${fecha(p.fecha)}</td>
    <td><span class="chip"><i style="background:${D.redes[p.red].color}"></i>${D.redes[p.red].nombre}</span>${p.tipo ? `<span class="tipo">${p.tipo}</span>` : ""}</td>
    <td><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.titulo || "(sin título)")}</a></td>
    <td class="n celda-barra" style="--w:${((p.vis || 0) / max * 100).toFixed(1)}"><span>${fmt(p.vis)}</span></td>
    <td class="n">${fmt(p.likes)}</td><td class="n col-com">${fmt(p.comentarios)}</td></tr>`).join("");
}
