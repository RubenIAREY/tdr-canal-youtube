/* Panel de redes TDR · versión «Terminal papel 2» (prueba local, 06/10/2026).
   Misma lógica y mismos datos que panel.js (datos_redes.json, que rehace PANEL-REDES/construir_panel.py a las 9:00 y a las 17:00),
   con la presentación «Terminal» en colores papel y, además:
   - gráficas grandes una debajo de otra (tamaño en Ajustes), pantalla completa por gráfica y descargas CSV / Excel de lo que se ve;
   - eventos (../datos/eventos.json): marcas en las velas, ficha al hacer clic y «Qué pasó en este periodo» bajo cada gráfica;
   - tramos de 2, 4, 8 y 12 horas: ESTIMADOS en todas las redes, repartiendo el dato del día con la actividad de la audiencia por hora
     (../datos/perfil_horario.json, Metricool); en YouTube, además, lo medido entre las fotos del canal de las 9:00 y las 17:00
     (../datos/intradia_youtube.json);
   - bloque «¿A qué hora está tu audiencia?», pestaña «Futuro» (módulo ../comun/futuro.js) y más paletas, con una personalizada.
   Gráficas: TradingView lightweight-charts 4.2. Excel: SheetJS (se carga solo al descargar). */
"use strict";
const LC = window.LightweightCharts;
const $ = s => document.querySelector(s);
const REDES = ["youtube", "instagram", "tiktok", "facebook"];
const SIMB = { global: "TOTAL", youtube: "YT", instagram: "IG", tiktok: "TT", facebook: "FB" };
const MARCA = "#d71119";
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const DIAS_C = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
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
const colorEv = r => r === "global" ? MARCA : D.redes[r] ? D.redes[r].color : "#888888";
const corto = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const pad = n => String(n).padStart(2, "0");
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtEst = v => fmt(v, Math.abs(v) < 100 ? 1 : 0);

/* ─────────── hora de Madrid (los tramos y la medición por horas van en hora de Madrid) ─────────── */
const FMT_MAD = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function partesMadrid(ts) { const o = {}; FMT_MAD.formatToParts(new Date(ts * 1000)).forEach(p => { o[p.type] = p.value; }); return o; }
function tsMadrid(dia, h = 0) {            // segundos UTC de las h:00 de ese día en Madrid
  const [y, m, d] = dia.split("-").map(Number), g = Date.UTC(y, m - 1, d, h) / 1000, p = partesMadrid(g);
  return g - ((+p.hour - h + 24) % 24) * 3600;
}
const fechaHora = ts => { const p = partesMadrid(ts); return `${+p.day} ${MES[+p.month - 1]} ${p.year} · ${p.hour}:${p.minute}`; };
const isoHora = ts => { const p = partesMadrid(ts); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`; };
const HORAS = { "2h": 2, "4h": 4, "8h": 8, "12h": 12 };
const esHoras = p => Object.prototype.hasOwnProperty.call(HORAS, p);
function etiquetaHora(ts, periodo) {
  const p = partesMadrid(ts), base = `${+p.day} ${MES[+p.month - 1]} ${p.year}`, n = HORAS[periodo];
  return n ? `${base} · ${p.hour}:00–${pad((+p.hour + n) % 24 || 24)}:00` : `${base} · ${p.hour}:${p.minute}`;
}
function marcaHora(t, tipo) {              // etiquetas del eje de tiempo en hora de Madrid
  const p = partesMadrid(t);
  return tipo === 0 ? p.year : tipo === 1 ? MES[+p.month - 1] : tipo === 2 ? `${+p.day} ${MES[+p.month - 1]}` : `${p.hour}:${p.minute}`;
}
const normT = t => t == null ? null : typeof t === "object" ? `${t.year}-${pad(t.month)}-${pad(t.day)}` : t;

/* ─────────── ajustes en vivo ─────────── */
const PALETAS = [
  ["crema", "Papel crema", ["#ece4d9", "#fbf8f1", "#1b1a18", "#d71119"]],
  ["kraft", "Kraft", ["#b8915f", "#fbf8f1", "#1b1a18", "#d71119"]],
  ["corporativo", "Corporativo", ["#121317", "#1b1d22", "#f3f1ec", "#d71119"]],
  ["pizarra", "Pizarra", ["#1f2120", "#2d302e", "#f4f4f0", "#ffd21e"]],
  ["grafito", "Original (grafito)", ["#0c0f13", "#181d25", "#d71119", "#2fb59a"]],
  ["sepia", "Sepia", ["#e3d3b8", "#f8f0e2", "#2a2017", "#d71119"]],
  ["periodico", "Periódico", ["#dedcd5", "#f5f4f0", "#161616", "#d71119"]],
  ["azulado", "Papel azulado", ["#dbe3ec", "#f6f9fc", "#13202f", "#d71119"]],
  ["libreta", "Papel verde libreta", ["#d8e5d6", "#f5f9f2", "#16231a", "#d71119"]],
  ["rosa", "Papel rosa", ["#ecdcd8", "#fcf5f3", "#2a1919", "#d71119"]],
  ["hormigon", "Hormigón", ["#cccbc7", "#efeeeb", "#1a1b1c", "#d71119"]],
  ["noche", "Tinta azul noche", ["#0e1828", "#152238", "#eef2f8", "#d71119"]],
  ["carbon", "Carbón", ["#151413", "#1f1e1c", "#f2efe9", "#d71119"]],
  ["propia", "Personalizado", null],
];
const AJ = [
  { k: "paleta", t: "Colores", def: "crema", cols: 2, ops: PALETAS },
  { k: "textura", t: "Textura del papel", def: "si", cols: 2, ops: [["si", "Con textura"], ["no", "Lisa"]] },
  { k: "letra", t: "Letra", def: "plex", cols: 1, ops: [
    ["plex", "La de la Terminal (IBM Plex)"], ["videos", "La de los vídeos (Anton + Instrument Serif)"], ["barlow", "Barlow + JetBrains Mono"]] },
  { k: "detalles", t: "Detalles de papel", def: "si", cols: 2, ops: [["no", "Solo colores"], ["si", "Etiquetas, tickets y sellos"]] },
  { k: "densidad", t: "Densidad", def: "normal", ops: [["compacta", "Compacta"], ["normal", "Normal"], ["amplia", "Amplia"]] },
  { k: "tamano", t: "Tamaño de las gráficas", def: "grande", ops: [["normal", "Normal"], ["grande", "Grande"], ["muy", "Muy grande"]] },
  { k: "graficas", t: "Disposición de las gráficas", def: "columna", cols: 2, ops: [["columna", "Una debajo de otra"], ["cuadricula", "Cuadrícula 2 × 2"]] },
  { k: "eventos", t: "Eventos en las gráficas", def: "todos", ops: [["todos", "Todos"], ["subidas", "Solo subidas y bajadas"], ["no", "Ninguno"]] },
  { k: "rejilla", t: "Rejilla de las gráficas", def: "si", cols: 2, ops: [["si", "Con rejilla"], ["no", "Sin rejilla"]] },
  { k: "animar", t: "Cifras al cargar", def: "si", cols: 2, ops: [["si", "Animadas"], ["no", "Fijas"]] },
];
const FUENTES = {
  videos: "family=Anton&family=Archivo:wght@400;500;600;700&family=Instrument+Serif:ital@1&family=JetBrains+Mono:wght@400;500;600",
  plex: "family=Anton&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600",
  geist: "family=Anton&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Instrument+Sans:wght@500;600;700",
  barlow: "family=Anton&family=Barlow:wght@400;500;600&family=Barlow+Semi+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600",
};
const CLAVE = "tdr-terminal-papel-2-ajustes";
const PROPIA = { fondo: "ece4d9", tarjetas: "fbf8f1", tinta: "1b1a18" };     // colores de partida del «Personalizado» (los de crema)
const AJUSTES = {};

function leerAjustes() {
  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { guardado = {}; }
  const q = new URLSearchParams(location.search);
  AJ.forEach(a => { const v = q.get(a.k) ?? guardado[a.k]; AJUSTES[a.k] = a.ops.some(o => o[0] === v) ? v : a.def; });
  Object.keys(PROPIA).forEach(k => { const v = String(q.get(k) ?? guardado[k] ?? "").replace(/^#/, "").toLowerCase(); AJUSTES[k] = /^[0-9a-f]{6}$/.test(v) ? v : PROPIA[k]; });
}

/* colores: utilidades para el «Personalizado» (calcula grises, líneas y colores de subida/bajada con contraste AA) */
const rgb = h => { const n = parseInt(h.replace("#", ""), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hex = c => "#" + c.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
const mezcla = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const luz = h => rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
const contraste = (a, b) => { const x = luz(a), y = luz(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function hacia(tinta, fondo, minimo, maxMezcla) { for (let t = maxMezcla; t > 0.001; t -= .02) { const c = mezcla(tinta, fondo, t); if (contraste(c, fondo) >= minimo) return c; } return tinta; }
const elige = (lista, fondo, min) => lista.find(c => contraste(c, fondo) >= min) || lista[lista.length - 1];
const VARS_PROPIA = ["--fondo", "--capa1", "--capa2", "--capa3", "--tinta", "--tinta-suave", "--tinta-tenue", "--linea", "--linea-fuerte", "--sube", "--baja",
  "--ma7", "--ma30", "--marca-suave", "--marca-tinta", "--g-fondo", "--g-texto", "--g-rejilla", "--g-borde", "--sombra-1", "--sombra-2", "color-scheme", "--tex-fondo", "--tex-caja"];
function aplicarPropia() {
  const st = document.documentElement.style;
  if (AJUSTES.paleta !== "propia") { VARS_PROPIA.forEach(v => st.removeProperty(v)); return; }
  const f = "#" + AJUSTES.fondo, c = "#" + AJUSTES.tarjetas, t = "#" + AJUSTES.tinta, claro = luz(c) > .3;
  const tenue = hacia(t, c, 4.6, .5), suave = hacia(t, c, 6.5, .35);
  const V = {
    "--fondo": f, "--capa1": c, "--capa2": mezcla(c, t, .045), "--capa3": mezcla(c, t, .09),
    "--tinta": t, "--tinta-suave": suave, "--tinta-tenue": tenue, "--linea": mezcla(c, t, .12), "--linea-fuerte": mezcla(c, t, .24),
    "--sube": elige(claro ? ["#2e7d57", "#226546", "#174d35"] : ["#3dbd8f", "#62d2a9", "#93e4c5"], c, 4.5),
    "--baja": elige(claro ? ["#b5701a", "#94570f", "#74430b"] : ["#e8a23d", "#f0b866", "#f6cf95"], c, 4.5),
    "--ma7": t, "--ma30": elige(claro ? ["#2a5db0", "#1f4a8e", "#163a70"] : ["#7aa8ff", "#a3c2ff", "#c8dbff"], c, 4.5),
    "--marca-suave": claro ? "#d7111916" : "#d711192b",
    "--marca-tinta": elige(claro ? ["#b80d16", "#960a12", "#73070d"] : ["#ff5a63", "#ff8a90", "#ffb3b7"], c, 4.5),
    "--g-fondo": "rgba(0,0,0,0)", "--g-texto": tenue, "--g-rejilla": mezcla(c, t, .07), "--g-borde": mezcla(c, t, .14),
    "--sombra-1": claro ? `0 1px 1px ${t}12, 0 2px 4px ${t}0f, 0 14px 30px -18px ${t}55` : "inset 0 1px 0 #ffffff08, 0 1px 2px #0000004d, 0 10px 28px -16px #000000a6",
    "--sombra-2": claro ? `0 2px 6px ${t}1f, 0 26px 50px -22px ${t}66` : "inset 0 1px 0 #ffffff0d, 0 2px 6px #00000059, 0 24px 48px -20px #000000cc",
    "color-scheme": claro ? "light" : "dark",
    "--tex-fondo": claro ? 'url("tex-grano.jpg")' : 'url("tex-grano-osc.jpg")', "--tex-caja": claro ? 'url("tex-grano.jpg")' : 'url("tex-grano-osc.jpg")',
  };
  Object.entries(V).forEach(([k, v]) => st.setProperty(k, v));
}
function esClara() {
  const c = getComputedStyle(document.documentElement).getPropertyValue("--capa1").trim();
  return /^#[0-9a-f]{6}$/i.test(c) ? luz(c) > .3 : !["corporativo", "pizarra", "grafito", "noche", "carbon"].includes(AJUSTES.paleta);
}

function aplicarAjustes(conRepintado = true) {
  const html = document.documentElement;
  AJ.forEach(a => { html.dataset[a.k] = AJUSTES[a.k]; });
  aplicarPropia();
  html.dataset.tono = esClara() ? "claro" : "oscuro";
  const link = $("#fuentes"), href = `https://fonts.googleapis.com/css2?${FUENTES[AJUSTES.letra]}&display=swap`;
  if (link.getAttribute("href") !== href) {
    link.onload = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { if (D) repintar(); });
    link.setAttribute("href", href);
  }
  try { localStorage.setItem(CLAVE, JSON.stringify(AJUSTES)); } catch (e) { /* sin almacenamiento: da igual */ }
  const q = new URLSearchParams(location.search);
  AJ.forEach(a => q.set(a.k, AJUSTES[a.k]));
  Object.keys(PROPIA).forEach(k => { if (AJUSTES.paleta === "propia") q.set(k, AJUSTES[k]); else q.delete(k); });
  history.replaceState(null, "", "?" + q.toString() + location.hash);
  pintarAjustes();
  if (mapa) mapa.setTema(temaMapa());
  if (futuro) try { futuro.actualizarTema(); } catch (e) { /* el módulo se repinta en su próximo cambio */ }
  if (conRepintado && D) repintar();
}
function pintarAjustes() {
  const c = $("#aj-cuerpo");
  const muestraPropia = ["#" + AJUSTES.fondo, "#" + AJUSTES.tarjetas, "#" + AJUSTES.tinta, MARCA];
  c.innerHTML = AJ.map(a => `<fieldset class="aj-grupo"><legend>${a.t}</legend><div class="aj-ops" style="--cols:${a.cols || 3}">` +
    a.ops.map(o => { const m = o[0] === "propia" ? muestraPropia : o[2];
      return `<button type="button" data-k="${a.k}" data-v="${o[0]}" aria-pressed="${AJUSTES[a.k] === o[0]}">` +
        (m ? `<span class="muestra" aria-hidden="true">${m.map(x => `<i style="background:${x}"></i>`).join("")}</span>` : "") + `${o[1]}</button>`; }).join("") +
    `</div>` + (a.k === "paleta" && AJUSTES.paleta === "propia" ? pickersPropia() : "") + `</fieldset>`).join("");
  c.querySelectorAll("button[data-k]").forEach(b => b.onclick = () => {
    AJUSTES[b.dataset.k] = b.dataset.v; aplicarAjustes(); aviso("");
    const n = c.querySelector(`button[data-k="${b.dataset.k}"][data-v="${b.dataset.v}"]`); if (n) n.focus();
  });
  c.querySelectorAll("input[data-c]").forEach(i => {
    i.oninput = () => { AJUSTES[i.dataset.c] = i.value.slice(1).toLowerCase(); aplicarPropia(); };
    i.onchange = () => { AJUSTES[i.dataset.c] = i.value.slice(1).toLowerCase(); aplicarAjustes(); const n = $(`#aj-c-${i.dataset.c}`); if (n) n.focus(); };
  });
}
function pickersPropia() {
  const bajo = contraste("#" + AJUSTES.tinta, "#" + AJUSTES.tarjetas) < 4.5;
  return `<div class="aj-propia">` + [["fondo", "Fondo"], ["tarjetas", "Tarjetas"], ["tinta", "Tinta"]].map(([k, n]) =>
    `<label for="aj-c-${k}"><input type="color" id="aj-c-${k}" data-c="${k}" value="#${AJUSTES[k]}"><span>${n}</span></label>`).join("") +
    `<p class="aj-nota">${bajo ? `<b>Ojo:</b> la tinta sobre las tarjetas se lee mal (contraste ${fmt(contraste("#" + AJUSTES.tinta, "#" + AJUSTES.tarjetas), 1)} : 1; hace falta 4,5). `
      : ""}Se guardan en el enlace. Los grises de apoyo, las líneas y los colores de subida y bajada se calculan solos para que se lean bien.</p></div>`;
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
  document.addEventListener("keydown", alPulsarTecla);
  document.addEventListener("pointerdown", e => {
    if (p.classList.contains("abierto") && !p.contains(e.target) && !b.contains(e.target)) abrirAjustes(false);
    const f = $("#ficha-ev"); if (f && !f.hidden && !f.contains(e.target)) cerrarFicha(false);
  });
  $("#aj-copiar").onclick = async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); aviso("Enlace copiado. Pégalo en el chat para decir cuál te gusta."); }
    catch (e) { aviso(`<input readonly value="${esc(url)}" style="width:100%;font:12px var(--f-cifra);padding:6px;background:var(--capa2);color:var(--tinta);border:1px solid var(--linea)">`);
      const i = $("#aj-aviso input"); i.focus(); i.select(); }
  };
  $("#aj-reset").onclick = () => { AJ.forEach(a => { AJUSTES[a.k] = a.def; }); Object.assign(AJUSTES, PROPIA); aplicarAjustes(); aviso("Vuelta a los valores de partida."); };
}
function alPulsarTecla(e) {
  if (e.key !== "Escape") return;
  const f = $("#ficha-ev");
  if (f && !f.hidden) { cerrarFicha(); e.preventDefault(); return; }
  if (paneCompleta) { salirPantalla(); e.preventDefault(); return; }      // capa fija; con Fullscreen API el navegador ya sale solo
  const p = $("#ajustes");
  if (p.classList.contains("abierto")) { abrirAjustes(false); $("#ajustes-btn").focus(); }
}

/* ─────────── arranque ─────────── */
let D, vista = "global", modoSeg = "velas", modoComp = "seg", modoLk = "dia", filtroRed = "todas", orden = "fecha";
let periodoSeg = "semana", modoAcum = "velas", periodoAcum = "semana", periodoVis = "dia", periodoLk = "dia";
let graficas = {}, INFO = {}, sincronizando = false, paneCompleta = null;
let mapa = null, cargandoMapa = null, futuro = null, cargandoFuturo = null, intentosFuturo = 0;
let EV = [], EV_POR_ID = {}, EV_ESTADO = "cargando", INTRA = null, PERFIL = null, redAudiencia = "youtube";

leerAjustes(); montarAjustes(); aplicarAjustes(false);
const leerJSON = url => fetch(url + "?" + Date.now()).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
Promise.all([
  leerJSON("../datos_redes.json"),
  leerJSON("../datos/eventos.json").then(cargarEventos, () => { EV_ESTADO = "falta"; }),
  leerJSON("../datos/intradia_youtube.json").then(cargarIntradia, () => { INTRA = null; }),
  leerJSON("../datos/perfil_horario.json").then(p => { PERFIL = p && p.redes ? p : null; }, () => { PERFIL = null; }),
]).then(([d]) => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { D = d; arrancar(); }))
  .catch(e => { $("#principal").innerHTML = `<p class="nota">No se han podido cargar los datos (${esc(e)}).</p>`; });

function cargarEventos(j) {
  const L = (j && Array.isArray(j.eventos) ? j.eventos : []).filter(e => e && e.id && /^\d{4}-\d\d-\d\d$/.test(e.fecha || ""));
  L.forEach(e => { if (!e.hasta || e.hasta < e.fecha) e.hasta = e.fecha; });
  L.sort((a, b) => a.fecha.localeCompare(b.fecha));
  EV = L; EV_POR_ID = Object.fromEntries(L.map(e => [e.id, e])); EV_ESTADO = "ok";
}
function cargarIntradia(j) {
  const P = (j && Array.isArray(j.puntos) ? j.puntos : []).filter(p => Array.isArray(p) && typeof p[0] === "string" && !isNaN(Date.parse(p[0])));
  P.sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));
  INTRA = { desde: (j && j.desde) || (P[0] && P[0][0]) || null, puntos: P };
}

function arrancar() {
  $("#actualizado").textContent = fecha(D.actualizado) + " · " + D.actualizado.slice(11);
  valores(); tiendaMini(); teletipo(); montarAcciones();
  document.querySelectorAll("#pestanas button").forEach(b => b.onclick = () => ir(b.dataset.vista));
  document.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => ir(b.dataset.ir));
  const bot = (sel, fn) => document.querySelectorAll(sel + " button").forEach(b => b.onclick = () => { if (b.getAttribute("aria-disabled") === "true") return; fn(b); });
  bot("#modo-seg", b => { modoSeg = b.dataset.m; marcar("#modo-seg", b); seguidores(vista); });
  bot("#periodo-seg", b => { periodoSeg = b.dataset.p; marcar("#periodo-seg", b); seguidores(vista); });
  bot("#modo-acum", b => { modoAcum = b.dataset.m; marcar("#modo-acum", b); acumulado(vista); });
  bot("#periodo-acum", b => { periodoAcum = b.dataset.p; marcar("#periodo-acum", b); acumulado(vista); });
  bot("#periodo-vis", b => { periodoVis = b.dataset.p; marcar("#periodo-vis", b); visDiarias(vista); });
  bot("#modo-lk", b => { modoLk = b.dataset.m; marcar("#modo-lk", b); megusta(vista); });
  bot("#periodo-lk", b => { periodoLk = b.dataset.p; marcar("#periodo-lk", b); megusta(vista); });
  bot("#modo-comp", b => { modoComp = b.dataset.m; marcar("#modo-comp", b); comparativa(); });
  document.querySelectorAll("#filtros button[data-f]").forEach(b => b.onclick = () => { filtroRed = b.dataset.f; marcar("#filtros", b, "[data-f]"); tablaVideos(); });
  document.querySelectorAll("#filtros button[data-o]").forEach(b => b.onclick = () => { orden = b.dataset.o; marcar("#filtros", b, "[data-o]"); tablaVideos(); });
  document.querySelectorAll(".grupo.rango").forEach(g => {
    g.innerHTML = ["1M", "3M", "6M", "1A", "2A", "Todo"].map(r => `<button type="button" data-r="${r}">${r}</button>`).join("");
    g.querySelectorAll("button").forEach(b => b.onclick = () => rango(g.dataset.graf, b.dataset.r));
  });
  $("#descargar-todo").onclick = () => descargarTodo($("#descargar-todo"));
  $("#ficha-ev .cerrar").onclick = () => cerrarFicha();
  document.addEventListener("fullscreenchange", alCambiarPantalla);
  document.addEventListener("webkitfullscreenchange", alCambiarPantalla);
  const h = location.hash.slice(1);
  ir(["global", ...REDES, "impacto", "videos", "futuro", "mapa"].includes(h) ? h : "global");
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
const NOMBRE_PERIODO = { dia: "un día", semana: "una semana", mes: "un mes", "2h": "2 horas", "4h": "4 horas", "8h": "8 horas", "12h": "12 horas" };
function etiquetaPeriodo(t, periodo) {
  if (periodo === "mes") { const [y, m] = t.split("-"); return `${MES[+m - 1]} ${y}`; }
  return (periodo === "semana" ? "semana del " : "") + fecha(t);
}
function finPeriodo(k, periodo) {          // último día (texto) o último segundo (número) del periodo que empieza en k
  if (typeof k === "number") return k + (HORAS[periodo] || 1) * 3600 - 1;
  if (periodo === "semana") { const d = new Date(k + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); }
  if (periodo === "mes") { const d = new Date(k + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1, 0); return d.toISOString().slice(0, 10); }
  return k;
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
const dentro = (t, r) => !r || (t >= r.from && t <= r.to);

/* ─────────── tramos de horas: ESTIMADOS con el perfil horario de Metricool (no hay medición por horas) ─────────── */
const perfilDe = r => { const p = PERFIL && PERFIL.redes && PERFIL.redes[r]; return p && Array.isArray(p.reparto) && p.reparto.length === 7 ? p : null; };
const modoHoras = k => (k === "global" ? REDES : [k]).some(r => perfilDe(r)) ? "estimado" : null;
const IDX = {};
function filaDe(k, t) { if (!IDX[k]) IDX[k] = new Map(serieDe(k).map(x => [x.t, x])); return IDX[k].get(t); }
function diaAntes(t) { const d = new Date(t + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
function valorDia(k, campo, t) {           // campo: "seg" (seguidores netos del día), "vis" o "likes"
  const x = filaDe(k, t); if (!x) return null;
  if (campo !== "seg") return x[campo] == null ? null : x[campo];
  const a = filaDe(k, diaAntes(t)); return x.seg == null || !a || a.seg == null ? null : x.seg - a.seg;
}
function diasConDato(k, campo) {
  const R = k === "global" ? D.global_ : D.redes[k].resumen, desde = campo === "likes" ? R.desde_lk : campo === "vis" ? R.desde_vis : R.desde_seg;
  return serieDe(k).filter(x => x.t >= (desde || "0") && valorDia(k, campo, x.t) != null).map(x => x.t);
}
// el dato de cada uno de los últimos 30 días con dato, repartido en tramos de N horas según el reparto del día de la semana
// (Global = suma de lo repartido de cada red con su propio perfil)
function estimarTramos(k, campo, N) {
  const reds = (k === "global" ? REDES : [k]).filter(r => perfilDe(r)), out = [];
  diasConDato(k, campo).slice(-30).forEach(t => {
    const w = (new Date(t + "T00:00:00Z").getUTCDay() + 6) % 7, tramos = new Array(24 / N).fill(0); let hay = false;
    reds.forEach(r => { const v = valorDia(r, campo, t); if (v == null) return; hay = true;
      const rep = perfilDe(r).reparto[w] || []; for (let h = 0; h < 24; h++) tramos[Math.floor(h / N)] += v * (rep[h] || 0); });
    if (hay) tramos.forEach((v, j) => out.push({ time: tsMadrid(t, j * N), value: v, dia: t }));
  });
  return out;
}
const FRASE_EST = "Estimado: el dato del día repartido según la actividad de la audiencia por hora (Metricool). No es una medición.";
function notaHoras(k, N) {
  const quien = k === "global" ? "de cada red (y se suma)" : `de ${D.redes[k].nombre}`;
  return `Estimado: el dato de cada día repartido en tramos de ${N} horas según la actividad de la audiencia ${quien} por hora y día de la semana (Metricool). No es una medición. Últimos 30 días con dato, hora de Madrid.`;
}
function estadoHoras(k) {
  const m = modoHoras(k);
  if (!m) { if (esHoras(periodoSeg)) periodoSeg = "semana"; if (esHoras(periodoAcum)) periodoAcum = "semana"; if (esHoras(periodoVis)) periodoVis = "dia"; if (esHoras(periodoLk)) periodoLk = "dia"; }
  [["#periodo-seg", periodoSeg], ["#periodo-acum", periodoAcum], ["#periodo-vis", periodoVis], ["#periodo-lk", periodoLk]].forEach(([sel, p]) => {
    $(sel).querySelectorAll("button").forEach(b => {
      b.classList.toggle("on", b.dataset.p === p);
      if (!b.classList.contains("hora")) return;
      b.setAttribute("aria-disabled", String(!m));
      b.title = m ? `Estimado: el dato de cada día repartido en tramos de ${HORAS[b.dataset.p]} horas según la actividad de la audiencia por hora (Metricool). No es una medición.`
        : "No se ha podido leer el perfil horario de la audiencia (datos/perfil_horario.json)";
    });
  });
}
// YouTube: lo medido de verdad entre dos fotos seguidas del canal (las que toman las rutinas de las 9:00 y las 17:00)
function medidoYT() {
  if (!INTRA || INTRA.puntos.length < 2) return "";
  const P = INTRA.puntos.map(p => ({ ts: Date.parse(p[0]) / 1000, vis: p[1] })).filter(p => typeof p.vis === "number");
  let dia = null, noche = null;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], h = (b.ts - a.ts) / 3600;
    if (h < 4 || h > 20) continue;                   // solo fotos seguidas (sin una rutina perdida en medio)
    const pa = partesMadrid(a.ts), pb = partesMadrid(b.ts), mismo = `${pa.year}${pa.month}${pa.day}` === `${pb.year}${pb.month}${pb.day}`;
    const tramo = { pa, pb, suma: b.vis - a.vis };
    if (mismo && +pa.hour < 13 && +pb.hour >= 13) dia = tramo; else if (!mismo && +pa.hour >= 13 && +pb.hour < 13) noche = tramo;
  }
  if (!dia && !noche) return "";
  const hm = p => `${+p.hour}:${p.minute}`, dm = p => `${+p.day} ${MES[+p.month - 1]}`;
  const L = [];
  if (dia) L.push(`el ${dm(dia.pa)}, de ${hm(dia.pa)} a ${hm(dia.pb)} se sumaron <b>${fmt(dia.suma)}</b> visualizaciones`);
  if (noche) L.push(`del ${dm(noche.pa)} al ${dm(noche.pb)}, de ${hm(noche.pa)} a ${hm(noche.pb)}, <b>${fmt(noche.suma)}</b>${dia ? "" : " visualizaciones"}`);
  return `<span class="medido-et">Medido</span> ${L.join("; ")}. <small>Suma de todos los vídeos públicos del canal entre las fotos que toman las rutinas de las 9:00 y las 17:00.</small>`;
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
  const cambia = v !== vista;
  vista = v;
  history.replaceState(null, "", location.search + "#" + v);
  document.querySelectorAll("#pestanas button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.vista === v)));
  document.querySelectorAll(".valor").forEach(b => b.classList.toggle("on", b.dataset.k === v));
  const activo = document.querySelector(`#cinta .valor[data-k="${v}"]`);
  if (activo && conAnimacion) activo.scrollIntoView({ block: "nearest", inline: "nearest" });
  cerrarFicha(false);
  if (cambia && paneCompleta) salirPantalla();
  Object.values(graficas).forEach(g => g && g.remove()); graficas = {}; INFO = {};
  $("#v-red").classList.toggle("oculta", !(v === "global" || REDES.includes(v)));
  $("#v-impacto").classList.toggle("oculta", v !== "impacto");
  $("#v-videos").classList.toggle("oculta", v !== "videos");
  $("#v-futuro").classList.toggle("oculta", v !== "futuro");
  $("#v-mapa").classList.toggle("oculta", v !== "mapa");
  if (v !== "mapa" && mapa) mapa.pausar();
  if (v === "impacto") impacto(conAnimacion); else if (v === "videos") tablaVideos(); else if (v === "mapa") abrirMapa();
  else if (v === "futuro") abrirFuturo(); else pintarRed(v, conAnimacion);
  if (conAnimacion) window.scrollTo({ top: 0 });
}
function repintar() {
  if (!D) return;
  ir(vista, false);
  if (futuro) try { futuro.actualizarTema(); } catch (e) { /* nada */ }
}

/* ─────────── gráficas ─────────── */
function tema() {
  const s = getComputedStyle(document.documentElement), v = k => s.getPropertyValue(k).trim();
  return { fondo: v("--g-fondo"), texto: v("--g-texto"), rejilla: AJUSTES.rejilla === "si" ? v("--g-rejilla") : "rgba(0,0,0,0)", borde: v("--g-borde"),
    sube: v("--sube"), baja: v("--baja"), ma7: v("--ma7"), ma30: v("--ma30"), hito: v("--ma30"), nota: v("--tinta-suave"), letra: v("--f-cifra") || "monospace" };
}
function crear(id, extra = {}) {
  const horas = !!extra.horas, resto = Object.assign({}, extra); delete resto.horas;
  const T = tema(), el = document.getElementById(id); el.innerHTML = "";
  const ch = LC.createChart(el, Object.assign({
    autoSize: true,
    layout: { background: { type: "solid", color: T.fondo }, textColor: T.texto, fontFamily: T.letra, fontSize: 11, attributionLogo: false },
    grid: { vertLines: { color: T.rejilla }, horzLines: { color: T.rejilla } },
    rightPriceScale: { borderColor: T.borde },
    timeScale: Object.assign({ borderColor: T.borde, rightOffset: 3 }, horas ? { timeVisible: true, secondsVisible: false, tickMarkFormatter: marcaHora } : {}),
    crosshair: { mode: LC.CrosshairMode.Normal },
    localization: Object.assign({ locale: "es-ES", priceFormatter: p => fmt(p, Math.abs(p) < 10 && p % 1 ? 1 : 0),
      percentageFormatter: p => signo(p, Math.abs(p) < 10 ? 1 : 0) + " %", dateFormat: "dd MMM yyyy" }, horas ? { timeFormatter: t => fechaHora(t) } : {}),
  }, resto));
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
      const h = !!(INFO[a] && INFO[a].horas);         // solo se sincronizan gráficas del mismo tipo de tiempo (días u horas)
      ids.forEach(b => { if (b !== a && graficas[b] && !!(INFO[b] && INFO[b].horas) === h) try { graficas[b].timeScale().setVisibleRange(r); } catch (e) { /* fuera de datos */ } });
      sincronizando = false;
    };
    ch.timeScale().subscribeVisibleTimeRangeChange(fn); enlaces[a] = { ch, fn };
  });
}
const CUATRO = ["g-seg", "g-vis", "g-acum", "g-lk"];
const GRAF = { seg: CUATRO, comp: ["g-comp"], tienda: ["g-tienda"], marca: ["g-marca"] };
const MESES_R = { "1M": 1, "3M": 3, "6M": 6, "1A": 12, "2A": 24 };
function rango(graf, r) {
  const hasta = new Date(D.actualizado.slice(0, 10) + "T00:00:00Z");
  GRAF[graf].forEach(id => {
    const ch = graficas[id]; if (!ch) return;
    if (r === "Todo") { ch.timeScale().fitContent(); return; }
    const desde = new Date(hasta); desde.setUTCMonth(desde.getUTCMonth() - MESES_R[r]);
    const info = INFO[id];
    if (info && info.horas) {                         // tramos de horas: hay pocos días, así que casi siempre se ve todo
      const de = desde.getTime() / 1000;
      if (info.primero == null || de <= info.primero) ch.timeScale().fitContent();
      else try { ch.timeScale().setVisibleRange({ from: de, to: info.ultimo }); } catch (e) { ch.timeScale().fitContent(); }
      return;
    }
    try { ch.timeScale().setVisibleRange({ from: desde.toISOString().slice(0, 10), to: hasta.toISOString().slice(0, 10) }); } catch (e) { /* sin datos */ }
  });
  document.querySelectorAll(`.grupo.rango[data-graf="${graf}"] button`).forEach(b => b.classList.toggle("on", b.dataset.r === r));
}
function leyenda(id, ch, filas, periodo = null, opc = {}) {     // periodo: el de las velas o tramos («dia» si es diaria)
  const el = document.getElementById(id), gid = "g-" + id.slice(4);
  const pinta = param => {
    let t = null; const sobre = !!(param && param.time != null && param.seriesData);
    const vals = filas.map(f => {
      let d = null;
      if (sobre) { d = param.seriesData.get(f.serie) || null; t = param.time; }
      else { const u = f.datos[f.datos.length - 1]; if (u) { d = u; t = u.time; } }
      const v = d ? (d.close ?? d.value) : null, cambio = d && d.open != null ? d.close - d.open : null;
      return `<span><i style="background:${f.color}"></i>${f.nombre} <b>${v == null ? "–" : (f.fmt || fmt)(v)}</b>` +
        (cambio != null ? ` · cambio <b class="${cls(cambio)}">${signo(cambio)}</b>` : "") + `</span>`;
    });
    const tt = normT(t);
    const et = tt == null ? "" : typeof tt === "number" ? etiquetaHora(tt, periodo) : periodo ? etiquetaPeriodo(tt, periodo) : fecha(tt);
    let ev = "";
    if (sobre) {
      const evs = eventosEn(param.time, INFO[gid]);
      if (evs.length) ev = `<span class="ev-ley"><span class="ev-ico ev-${esc(evs[0].tipo)}" aria-hidden="true"></span>${esc(corto(evs[0].titulo, 64))}` +
        `${evs.length > 1 ? ` <em>y ${evs.length - 1} más</em>` : ""} <small>· clic para ver qué pasó</small></span>`;
    }
    el.innerHTML = (opc.estimado ? `<span class="est-tag">Estimado</span>` : "") + `<span>${et}</span>` + vals.join("") + ev +
      (opc.estimado && sobre ? `<span class="est-frase">${FRASE_EST}</span>` : "");
  };
  ch.subscribeCrosshairMove(pinta); pinta(null);
}

/* ─────────── eventos: marcas, lista «Qué pasó en este periodo» y ficha ─────────── */
function eventosPara(k, metrica) {
  if (AJUSTES.eventos === "no") return [];
  // Global: solo los de red «global»; cada red, los suyos (las notas de vídeos largos van como círculo pequeño)
  return EV.filter(e => e.red === k && e.metrica === metrica && (AJUSTES.eventos === "todos" || e.tipo === "subida" || e.tipo === "bajada"));
}
const rangoEv = (e, horas) => horas ? [tsMadrid(e.fecha), tsMadrid(e.hasta) + 86399] : [e.fecha, e.hasta];
function eventosEn(t, info) {               // eventos cuyo intervalo toca el periodo (vela, barra o tramo) que empieza en t
  if (!info || !info.ev || t == null) return [];
  const k = normT(t), fin = finPeriodo(k, info.ev.periodo), horas = typeof k === "number";
  return info.ev.lista.filter(e => { const [a, b] = rangoEv(e, horas); return a <= fin && b >= k; });
}
function buscarTiempo(tiempos, a, b, periodo) {   // primera vela/barra cuyo periodo toca [a, b]
  let lo = 0, hi = tiempos.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (finPeriodo(tiempos[m], periodo) < a) lo = m + 1; else hi = m; }
  return lo < tiempos.length && tiempos[lo] <= b ? tiempos[lo] : null;
}
function marcasDe(lista, tiempos, periodo, T) {
  if (!tiempos.length) return [];
  const horas = typeof tiempos[0] === "number", out = [];
  lista.forEach(e => {
    const [a, b] = rangoEv(e, horas), t = buscarTiempo(tiempos, a, b, periodo); if (t == null) return;
    const tipo = e.tipo;
    out.push({ time: t, grande: tipo !== "nota", text: corto(e.titulo, 26), size: tipo === "nota" ? 0.45 : tipo === "hito" ? 0.9 : 1,
      position: tipo === "subida" ? "belowBar" : "aboveBar", shape: tipo === "subida" ? "arrowUp" : tipo === "bajada" ? "arrowDown" : "circle",
      color: tipo === "subida" ? T.sube : tipo === "bajada" ? T.baja : tipo === "hito" ? T.hito : T.nota });
  });
  return out.sort((x, y) => x.time < y.time ? -1 : x.time > y.time ? 1 : 0);
}
// series: [{serie, tiempos}] donde poner las marcas (vacío = solo lista); periodo: el de las velas/barras de esa gráfica
function ponerEventos(id, series, lista, periodo) {
  const ch = graficas[id], info = INFO[id], cont = document.getElementById("ev-" + id.slice(2));
  if (!ch || !info) return;
  info.ev = AJUSTES.eventos === "no" || EV_ESTADO !== "ok" ? null : { lista, periodo };
  if (!info.ev) { if (cont) { cont.innerHTML = ""; delete cont.dataset.firma; } return; }
  const T = tema(), conjuntos = series.map(s => ({ serie: s.serie, marcas: marcasDe(lista, s.tiempos, periodo, T) }));
  let conTexto = null, pendiente = false;
  const actualizar = () => {
    pendiente = false;
    if (graficas[id] !== ch) return;
    const r = ch.timeScale().getVisibleRange(), rr = r && { from: normT(r.from), to: normT(r.to) };
    const enVista = conjuntos.reduce((a, c) => a + c.marcas.filter(m => m.grande && dentro(m.time, rr)).length, 0);
    const caben = Math.max(2, Math.floor((ch.timeScale().width() || 600) / 130));
    const txt = enVista <= caben;                    // con muchas marcas a la vista, sin texto (lo dicen la leyenda y la lista)
    if (txt !== conTexto) {
      conTexto = txt;
      conjuntos.forEach(c => c.serie.setMarkers(c.marcas.map(m => ({ time: m.time, position: m.position, shape: m.shape, color: m.color, size: m.size, text: txt && m.grande ? m.text : "" }))));
    }
    listaEventos(id, cont, rr);
  };
  ch.timeScale().subscribeVisibleTimeRangeChange(() => { if (!pendiente) { pendiente = true; requestAnimationFrame(actualizar); } });
  ch.subscribeClick(param => {
    if (!param || param.time == null || !INFO[id]) return;
    const evs = eventosEn(param.time, INFO[id]); if (evs.length) abrirFicha(evs);
  });
  if (cont) delete cont.dataset.firma;
  actualizar();
}
function fechaRango(a, b) {
  if (!b || a === b) return fecha(a);
  const [ya, ma, da] = a.split("-"), [yb, mb, db] = b.split("-");
  if (ya === yb && ma === mb) return `${+da}–${+db} ${MES[+mb - 1]} ${yb}`;
  if (ya === yb) return `${+da} ${MES[+ma - 1]} – ${+db} ${MES[+mb - 1]} ${yb}`;
  return `${fecha(a)} – ${fecha(b)}`;
}
const NOMBRE_TIPO = { subida: "Subida", bajada: "Bajada", hito: "Hito", nota: "Nota" };
const UNIDAD = { vis: "visualizaciones", seg: "seguidores", likes: "me gusta" };
const NOMBRE_MET = { vis: "Visualizaciones", seg: "Seguidores", likes: "Me gusta" };
const valorCorto = e => e.valor != null ? `${fmt(e.valor)}${e.esperado != null ? ` frente a ${fmt(e.esperado)}` : ""}` : "";
const itemEvento = e => `<li><button type="button" class="ev-item${e.tipo === "nota" ? " nota" : ""}" data-ev="${esc(e.id)}">` +
  `<span class="ev-ico ev-${esc(e.tipo)}" aria-hidden="true"></span><time datetime="${e.fecha}">${fechaRango(e.fecha, e.hasta)}</time>` +
  `<span class="chip"><i style="background:${colorEv(e.red)}"></i>${SIMB[e.red] || esc(e.red)}</span>` +
  `<span class="ev-t"><span class="sr">${NOMBRE_TIPO[e.tipo] || ""}: </span>${esc(e.titulo)}</span><span class="ev-v">${valorCorto(e)}</span></button></li>`;
function listaEventos(id, cont, rr) {
  if (!cont) return;
  const info = INFO[id]; if (!info || !info.ev) { cont.innerHTML = ""; return; }
  const per = info.ev.periodo;
  const L = info.ev.lista.filter(e => { if (!rr) return true; const [a, b] = rangoEv(e, typeof rr.from === "number"); return a <= finPeriodo(rr.to, per) && b >= rr.from; }).slice().reverse();
  const firma = L.map(e => e.id).join("|") || "-";
  if (cont.dataset.firma === firma) return;          // nada nuevo: no se repinta mientras se arrastra la gráfica
  cont.dataset.firma = firma;
  cont.innerHTML = `<h3>Qué pasó en este periodo <span>${L.length ? `${L.length === 1 ? "1 evento" : fmt(L.length) + " eventos"} en lo que se ve, del más reciente al más antiguo` : ""}</span></h3>` +
    (L.length ? `<ul>${L.map(itemEvento).join("")}</ul>` : `<p class="ev-vacio">Nada señalado en lo que se ve de la gráfica.</p>`);
  cont.querySelectorAll("[data-ev]").forEach(b => b.onclick = () => { const e = EV_POR_ID[b.dataset.ev]; if (e) abrirFicha([e], b); });
}
function fichaEvento(e) {
  const red = e.red === "global" ? "Las cuatro redes" : D.redes[e.red] ? D.redes[e.red].nombre : e.red, u = UNIDAD[e.metrica] || "";
  let datos = "";
  if (e.valor != null || e.esperado != null) {
    let rel = "";
    if (e.valor != null && e.esperado) { const r = e.valor / e.esperado; rel = r >= 2 ? `${fmt(r, r >= 10 ? 0 : 1)} veces lo normal` : `${signo(pct(e.valor, e.esperado), 0)} % frente a lo normal`; }
    datos = `<dl class="fe-datos"><div><dt>${e.tipo === "bajada" ? "Durante la bajada" : "En el evento"}</dt><dd>${fmt(e.valor)}<small>${u}${rel ? " · " + rel : ""}</small></dd></div>` +
      `<div><dt>Lo normal antes</dt><dd>${fmt(e.esperado)}<small>${u} (media)</small></dd></div></dl>`;
  }
  const causas = (e.causa || []).filter(c => c && c.titulo);
  return `<article class="fe-ev">
    <p class="fe-meta"><span class="fe-tipo"><span class="ev-ico ev-${esc(e.tipo)}" aria-hidden="true"></span>${NOMBRE_TIPO[e.tipo] || esc(e.tipo)}</span>
      <span class="chip"><i style="background:${colorEv(e.red)}"></i>${esc(red)}</span><span>${NOMBRE_MET[e.metrica] || ""}</span>
      <time datetime="${e.fecha}">${fechaRango(e.fecha, e.hasta)}</time></p>
    <h4>${esc(e.titulo)}</h4>${datos}
    ${e.detalle ? `<p class="fe-det">${esc(e.detalle)}</p>` : ""}
    ${causas.length ? `<ul class="fe-causas" aria-label="Qué lo explica">${causas.map(c => `<li>${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.titulo)} ↗</a>` : `<b>${esc(c.titulo)}</b>`}` +
      `<span>${esc(D.redes[c.red] ? D.redes[c.red].nombre : c.red || "")}${c.vis != null ? ` · ${fmt(c.vis)} visualizaciones hoy` : ""}</span></li>`).join("")}</ul>` : ""}
    <p class="fe-origen">${e.origen === "manual" ? "Escrito y revisado a mano." : "Lo ha detectado la rutina que repasa los datos."}</p></article>`;
}
let fichaOrigen = null;
function abrirFicha(evs, origen) {
  const f = $("#ficha-ev"); if (!f || !evs.length) return;
  (paneCompleta || document.body).appendChild(f);
  f.querySelector("#fe-tit").textContent = evs.length > 1 ? `Qué pasó · ${evs.length} eventos` : "Qué pasó";
  f.querySelector(".fe-cuerpo").innerHTML = evs.map(fichaEvento).join("");
  f.hidden = false; f.scrollTop = 0;
  fichaOrigen = origen || null;
  f.querySelector(".cerrar").focus({ preventScroll: true });
}
function cerrarFicha(devolverFoco = true) {
  const f = $("#ficha-ev"); if (!f || f.hidden) return;
  f.hidden = true;
  if (devolverFoco && fichaOrigen && document.contains(fichaOrigen)) fichaOrigen.focus({ preventScroll: true });
  fichaOrigen = null;
}

/* ─────────── vista de una red (o global) ─────────── */
function pintarRed(k, conAnimacion = true) {
  const esG = k === "global", R = esG ? D.global_ : D.redes[k].resumen, color = colorRed(k), s = serieDe(k);
  cabecera(k, R, color); cotizaciones(k, R, s, color, conAnimacion);
  estadoHoras(k);
  seguidores(k, true);
  visDiarias(k, true);
  acumulado(k, true);
  megusta(k, true);
  sincronizar(["g-vis", "g-acum", "g-lk"]);
  $("#p-comp").classList.toggle("oculta", !esG);
  if (esG) comparativa();
  avisoDatos(k);
  audiencia(k);
  const act = document.querySelector('.grupo.rango[data-graf="seg"] button.on');
  rango("seg", act && !conAnimacion ? act.dataset.r : (k === "youtube" || esG ? "1A" : "Todo"));
}
function rangoActual(k) {
  const act = document.querySelector('.grupo.rango[data-graf="seg"] button.on');
  return act ? act.dataset.r : (k === "youtube" || k === "global" ? "1A" : "Todo");
}
function avisoDatos(k) {
  const L = [];
  if (EV_ESTADO === "falta") L.push("No se ha podido leer el fichero de eventos (datos/eventos.json): las gráficas van sin marcas.");
  if (!PERFIL) L.push("Sin perfil horario de la audiencia (datos/perfil_horario.json): los tramos de horas no están disponibles.");
  $("#aviso-datos").textContent = L.join(" ");
}
const opcVelas = (T, pf) => ({ upColor: T.sube, downColor: T.baja, borderVisible: false, wickUpColor: T.sube, wickDownColor: T.baja, priceFormat: pf });
function defVelas(d, r) {
  return { columnas: ["Periodo (inicio)", "Apertura", "Máximo", "Mínimo", "Cierre", "Cambio"], tipos: ["fecha", "n0", "n0", "n0", "n0", "n0"],
    filas: d.filter(x => dentro(x.time, r)).map(x => [x.time, x.open, x.high, x.low, x.close, x.close - x.open]) };
}
const defSimple = (d, r, horas, nombre, tipo, est) => ({
  columnas: [horas ? "Tramo (inicio, hora de Madrid)" : "Día", nombre, ...(horas ? ["Estimado"] : [])], tipos: [horas ? "ts" : "fecha", tipo, "txt"],
  filas: d.filter(x => dentro(x.time, r)).map(x => [x.time, x.value, ...(horas ? [est ? "sí" : "no"] : [])]) });

/* seguidores: velas (día, semana, mes o tramos reales), barras de netos estimados por tramo, o línea */
function seguidores(k, inicial = false) {
  const esG = k === "global", R = esG ? D.global_ : D.redes[k].resumen, color = colorRed(k), T = tema(), id = "g-seg";
  const segs = serieDe(k).filter(x => x.seg != null).map(x => ({ time: x.t, value: x.seg }));
  if (graficas[id]) { graficas[id].remove(); delete graficas[id]; }
  const N = modoSeg === "velas" && esHoras(periodoSeg) && modoHoras(k) ? HORAS[periodoSeg] : 0, est = !!N;
  const g1 = crear(id, { horas: !!N });
  let serie1, d1, per = modoSeg === "velas" ? periodoSeg : "dia", fila;
  if (est) {
    d1 = estimarTramos(k, "seg", N).map(x => ({ time: x.time, value: x.value, color: (x.value >= 0 ? T.sube : T.baja) + "73" }));
    serie1 = g1.addHistogramSeries({ priceFormat: { type: "price", precision: 1, minMove: 0.1 }, priceLineVisible: false, lastValueVisible: false });
    fila = { nombre: "Netos del tramo", color: T.sube + "73", fmt: v => signo(v, 1) };
  } else if (modoSeg === "velas") {
    d1 = velas(segs, periodoSeg); serie1 = g1.addCandlestickSeries(opcVelas(T, { type: "price", precision: 0, minMove: 1 }));
    fila = { nombre: "Cierre", color: T.sube };
  } else {
    serie1 = g1.addAreaSeries({ lineColor: color, topColor: color + "55", bottomColor: color + "05", lineWidth: 2, priceFormat: { type: "price", precision: 0, minMove: 1 } });
    d1 = segs; fila = { nombre: "Seguidores", color };
  }
  serie1.setData(d1);
  $("#periodo-seg").classList.toggle("oculta", modoSeg !== "velas");
  INFO[id] = { horas: !!N, estimado: est, primero: d1.length ? d1[0].time : null, ultimo: d1.length ? d1[d1.length - 1].time : null,
    titulo: "Seguidores", slug: "seguidores", periodo: modoSeg === "velas" ? periodoSeg : "dia",
    cadaFila: est ? `un tramo de ${N} horas (seguidores netos estimados)` : modoSeg === "velas" ? `una vela de ${NOMBRE_PERIODO[periodoSeg]}` : "un día",
    nota: est ? FRASE_EST : null,
    datos: r => est ? defSimple(d1, r, true, "Seguidores netos (estimado)", "n2", true) : d1.length && d1[0].open != null ? defVelas(d1, r) : defSimple(d1, r, false, "Seguidores", "n0") };
  leyenda("ley-seg", g1, [Object.assign({ serie: serie1, datos: d1 }, fila)], per, { estimado: est });
  $("#t-seg").innerHTML = (est ? "Seguidores netos por tramos" : "Seguidores") + (esG ? " <small>suma de las cuatro redes</small>" : ` <small>${D.redes[k].nombre}</small>`);
  $("#n-seg").textContent = N ? notaHoras(k, N) : (esG
    ? `La suma empieza el ${fecha(R.desde_seg)}, el primer día con seguidores medidos en las cuatro redes.`
    : k === "youtube" ? "Desde que se abrió el canal: los seguidores de cada día salen de los suscriptores ganados y perdidos de YouTube Analytics."
      : `Metricool guarda los seguidores de ${D.redes[k].nombre} desde el ${fecha(R.desde_seg)}.`) +
    (modoSeg === "velas" && !N ? ` Cada vela es ${NOMBRE_PERIODO[periodoSeg]}: abre con el cierre del anterior; verde si sube y naranja u ocre si baja.` : "");
  ponerEventos(id, [{ serie: serie1, tiempos: d1.map(x => x.time) }], eventosPara(k, "seg"), per);
  if (!inicial) rango("seg", rangoActual(k));
}

/* visualizaciones diarias: barras (verde si el día supera su media de 30) + medias de 7 y 30, o barras por tramos de horas */
function visDiarias(k, inicial = false) {
  const esG = k === "global", R = esG ? D.global_ : D.redes[k].resumen, T = tema(), color = colorRed(k), id = "g-vis";
  if (graficas[id]) { graficas[id].remove(); delete graficas[id]; }
  const N = esHoras(periodoVis) && modoHoras(k) ? HORAS[periodoVis] : 0;
  const g2 = crear(id, { horas: !!N });
  const med = k === "youtube" ? medidoYT() : "";
  $("#medido-yt").innerHTML = med; $("#medido-yt").hidden = !med;
  if (N) {
    const d = estimarTramos(k, "vis", N).map(x => ({ time: x.time, value: x.value, color: T.ma30 + "73" }));
    const b = g2.addHistogramSeries({ priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false });
    b.setData(d);
    INFO[id] = { horas: true, estimado: true, primero: d.length ? d[0].time : null, ultimo: d.length ? d[d.length - 1].time : null,
      titulo: "Visualizaciones por tramos", slug: "visualizaciones", periodo: periodoVis, cadaFila: `un tramo de ${N} horas (estimado)`,
      nota: FRASE_EST, datos: r => defSimple(d, r, true, "Visualizaciones (estimado)", "n1", true) };
    leyenda("ley-vis", g2, [{ nombre: "Tramo", color: T.ma30 + "73", serie: b, datos: d, fmt: fmtEst }], periodoVis, { estimado: true });
    $("#t-vis").innerHTML = "Visualizaciones por tramos <small>estimado: el dato del día repartido por horas</small>";
    $("#n-vis").textContent = notaHoras(k, N);
    ponerEventos(id, [{ serie: b, tiempos: d.map(x => x.time) }], eventosPara(k, "vis"), periodoVis);
  } else {
    const sv = recortarCola(serieDe(k).filter(x => x.t >= (R.desde_vis || "0")), "vis");
    const vals = sv.map(x => x.vis || 0), m7 = media(vals, 7), m30 = media(vals, 30);
    const barras = g2.addHistogramSeries({ priceFormat: { type: "volume" }, priceLineVisible: false });
    barras.setData(sv.map((x, i) => ({ time: x.t, value: vals[i], color: vals[i] >= m30[i] ? T.sube + "cc" : T.baja + "99" })));
    const l7 = g2.addLineSeries({ color: T.ma7, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l7.setData(sv.map((x, i) => ({ time: x.t, value: m7[i] })));
    const l30 = g2.addLineSeries({ color: T.ma30, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l30.setData(sv.map((x, i) => ({ time: x.t, value: m30[i] })));
    INFO[id] = { horas: false, titulo: "Visualizaciones diarias", slug: "visualizaciones-diarias", periodo: null, cadaFila: "un día",
      datos: r => ({ columnas: ["Día", "Visualizaciones", "Media 7 días", "Media 30 días"], tipos: ["fecha", "n0", "n1", "n1"],
        filas: sv.map((x, i) => [x.t, vals[i], m7[i], m30[i]]).filter(f => dentro(f[0], r)) }) };
    leyenda("ley-vis", g2, [{ nombre: "Día", color: T.sube, serie: barras, datos: barras.data() },
      { nombre: "Media 7 d", color: T.ma7, serie: l7, datos: l7.data() }, { nombre: "Media 30 d", color: T.ma30, serie: l30, datos: l30.data() }], "dia");
    $("#t-vis").innerHTML = "Visualizaciones diarias <small>barra verde: el día supera su media de 30 días</small>";
    $("#n-vis").textContent = "Líneas: media de 7 días y media de 30 días.";
    ponerEventos(id, [{ serie: barras, tiempos: sv.map(x => x.t) }], eventosPara(k, "vis"), "dia");
  }
  if (!inicial) { sincronizar(["g-vis", "g-acum", "g-lk"]); rango("seg", rangoActual(k)); }
}

/* visualizaciones acumuladas: velas (día, semana, mes o tramos reales), línea discontinua estimada por tramos, o área */
function acumulado(k, inicial = false) {
  const esG = k === "global", R = esG ? D.global_ : D.redes[k].resumen, color = colorRed(k), T = tema(), id = "g-acum";
  const sv = recortarCola(serieDe(k).filter(x => x.t >= (R.desde_vis || "0")), "vis");
  let acum = 0; const ac = sv.map(x => ({ time: x.t, value: (acum += x.vis || 0) }));
  if (graficas[id]) { graficas[id].remove(); delete graficas[id]; }
  const N = modoAcum === "velas" && esHoras(periodoAcum) && modoHoras(k) ? HORAS[periodoAcum] : 0, est = !!N;
  const g3 = crear(id, { horas: !!N });
  let a3, d3, fila, per = modoAcum === "velas" ? periodoAcum : "dia";
  if (est) {
    const e = estimarTramos(k, "vis", N), primerDia = e.length ? e[0].dia : null;
    let base = 0; for (const x of ac) { if (x.time >= primerDia) break; base = x.value; }      // acumulado hasta el día anterior
    let suma = base; d3 = e.map(x => ({ time: x.time, value: (suma += x.value) }));
    a3 = g3.addLineSeries({ color, lineWidth: 2, lineStyle: LC.LineStyle.Dashed, priceFormat: { type: "volume" }, priceLineVisible: false });
    fila = { nombre: "Acumulado (estimado)", color };
  } else if (modoAcum === "velas") {
    d3 = velas(ac, periodoAcum); a3 = g3.addCandlestickSeries(opcVelas(T, { type: "volume" })); fila = { nombre: "Cierre", color: T.sube };
  } else {
    a3 = g3.addAreaSeries({ lineColor: color, topColor: color + "44", bottomColor: color + "03", lineWidth: 2, priceFormat: { type: "volume" } });
    d3 = ac; fila = { nombre: "Acumulado", color };
  }
  a3.setData(d3);
  $("#periodo-acum").classList.toggle("oculta", modoAcum !== "velas");
  INFO[id] = { horas: !!N, estimado: est, primero: d3.length ? d3[0].time : null, ultimo: d3.length ? d3[d3.length - 1].time : null,
    titulo: "Visualizaciones acumuladas", slug: "visualizaciones-acumuladas", periodo: modoAcum === "velas" ? periodoAcum : "dia",
    cadaFila: est ? `un tramo de ${N} horas (acumulado estimado al final del tramo)` : modoAcum === "velas" ? `una vela de ${NOMBRE_PERIODO[periodoAcum]}` : "un día",
    nota: est ? FRASE_EST : null,
    datos: r => est ? defSimple(d3, r, true, "Acumulado (estimado)", "n0", true) : d3.length && d3[0].open != null ? defVelas(d3, r) : defSimple(d3, r, false, "Acumulado", "n0") };
  leyenda("ley-acum", g3, [Object.assign({ serie: a3, datos: d3 }, fila)], per, { estimado: est });
  $("#t-acum").innerHTML = "Visualizaciones acumuladas" + (est ? " <small>línea discontinua: estimado por tramos</small>" : "");
  $("#sub-acum").textContent = N ? notaHoras(k, N) + " La línea discontinua parte del acumulado real del día anterior al primero estimado."
    : (esG ? `Suma de las cuatro redes desde el ${fecha(sv[0] && sv[0].t)} (cada red entra cuando hay datos).`
      : `Desde el ${fecha(sv[0] && sv[0].t)}${k === "youtube" ? ", el primer día del canal." : " (lo que guarda Metricool)."}`) +
    (modoAcum === "velas" ? ` Cada vela es ${NOMBRE_PERIODO[periodoAcum]}: el cuerpo son las visualizaciones sumadas en ese periodo.` : "");
  ponerEventos(id, [{ serie: a3, tiempos: d3.map(x => x.time) }], eventosPara(k, "vis"), per);
  if (!inicial) { sincronizar(["g-vis", "g-acum", "g-lk"]); rango("seg", rangoActual(k)); }
}

function cabecera(k, R, color) {
  const esG = k === "global", r30 = pct(R.seguidores, R.seguidores - (R.d30 || 0));
  const ico = esG ? `<img src="../logo-tdr.png" alt="" width="30" height="30">` : `<span style="color:${k === "tiktok" ? "#06121a" : "#fff"}">${SIMB[k]}</span>`;
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
    ${r30 == null ? "" : `<span class="sello" aria-hidden="true">${signo(r30, 1)} %</span>`}
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
    ${R.vis_cambio_30 == null ? "" : `<span class="sello" aria-hidden="true">${signo(R.vis_cambio_30, 0)} %</span>`}
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
    ${R.lk_cambio_30 == null ? "" : `<span class="sello" aria-hidden="true">${signo(R.lk_cambio_30, 0)} %</span>`}
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
  const esG = k === "global", R = esG ? D.global_ : D.redes[k].resumen, T = tema(), id = "g-lk";
  if (graficas[id]) { graficas[id].remove(); delete graficas[id]; }
  const s = recortarCola(serieDe(k).filter(x => x.t >= (R.desde_lk || "9999")), "likes");
  const vals = s.map(x => x.likes || 0);
  const N = modoLk === "dia" && esHoras(periodoLk) && modoHoras(k) ? HORAS[periodoLk] : 0;
  const g = crear(id, { horas: !!N });
  let serieEv, tiempos, per = "dia";
  if (N) {
    const d = estimarTramos(k, "likes", N).map(x => ({ time: x.time, value: x.value, color: T.ma30 + "73" }));
    const b = g.addHistogramSeries({ priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false });
    b.setData(d); serieEv = b; tiempos = d.map(x => x.time); per = periodoLk;
    INFO[id] = { horas: true, estimado: true, primero: d.length ? d[0].time : null, ultimo: d.length ? d[d.length - 1].time : null,
      titulo: "Me gusta por tramos", slug: "me-gusta", periodo: periodoLk, cadaFila: `un tramo de ${N} horas (estimado)`,
      nota: FRASE_EST, datos: r => defSimple(d, r, true, "Me gusta (estimado)", "n2", true) };
    leyenda("ley-lk", g, [{ nombre: "Tramo", color: T.ma30 + "73", serie: b, datos: d, fmt: fmtEst }], periodoLk, { estimado: true });
  } else if (modoLk === "dia") {
    const m7 = media(vals, 7), m30 = media(vals, 30);
    const b = g.addHistogramSeries({ priceFormat: { type: "volume" }, priceLineVisible: false });
    b.setData(s.map((x, i) => ({ time: x.t, value: vals[i], color: vals[i] >= m30[i] ? T.sube + "cc" : T.baja + "99" })));
    const l7 = g.addLineSeries({ color: T.ma7, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l7.setData(s.map((x, i) => ({ time: x.t, value: m7[i] })));
    const l30 = g.addLineSeries({ color: T.ma30, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l30.setData(s.map((x, i) => ({ time: x.t, value: m30[i] })));
    serieEv = b; tiempos = s.map(x => x.t);
    INFO[id] = { horas: false, titulo: "Me gusta diarios", slug: "me-gusta-diarios", periodo: null, cadaFila: "un día",
      datos: r => ({ columnas: ["Día", "Me gusta", "Media 7 días", "Media 30 días"], tipos: ["fecha", "n0", "n1", "n1"], filas: s.map((x, i) => [x.t, vals[i], m7[i], m30[i]]).filter(f => dentro(f[0], r)) }) };
    leyenda("ley-lk", g, [{ nombre: "Día", color: T.sube, serie: b, datos: b.data() },
      { nombre: "Media 7 d", color: T.ma7, serie: l7, datos: l7.data(), fmt: v => fmt(v, 1) },
      { nombre: "Media 30 d", color: T.ma30, serie: l30, datos: l30.data(), fmt: v => fmt(v, 1) }], "dia");
  } else {
    let a = 0; const ac = s.map(x => ({ time: x.t, value: (a += x.likes || 0) }));
    const col = colorRed(k);
    const ar = g.addAreaSeries({ lineColor: col, topColor: col + "44", bottomColor: col + "03", lineWidth: 2, priceFormat: { type: "volume" } });
    ar.setData(ac); serieEv = ar; tiempos = ac.map(x => x.time);
    INFO[id] = { horas: false, titulo: "Me gusta acumulados", slug: "me-gusta-acumulados", periodo: null, cadaFila: "un día", datos: r => defSimple(ac, r, false, "Me gusta acumulados", "n0") };
    leyenda("ley-lk", g, [{ nombre: "Acumulados", color: col, serie: ar, datos: ac }], "dia");
  }
  $("#periodo-lk").classList.toggle("oculta", modoLk !== "dia");
  $("#t-lk").innerHTML = N ? "Me gusta por tramos <small>estimado: el dato del día repartido por horas</small>" : "Me gusta";
  $("#n-lk").textContent = N ? notaHoras(k, N) : (NOTA_LK[k] || "") + (s.length ? ` Desde el ${fecha(s[0].t)}.` : " Todavía no hay datos.");
  ponerEventos(id, [{ serie: serieEv, tiempos }], eventosPara(k, "likes"), per);
  if (!inicial) { sincronizar(["g-vis", "g-acum", "g-lk"]); rango("seg", rangoActual(k)); }
}

/* ─────────── comparativa (como en bolsa: % desde el primer día visible) ─────────── */
function comparativa() {
  if (graficas["g-comp"]) { graficas["g-comp"].remove(); delete graficas["g-comp"]; }
  const T = tema();
  const g = crear("g-comp", { rightPriceScale: { borderColor: T.borde, mode: LC.PriceScaleMode.Percentage } });
  const filas = [], porRed = {};
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
    porRed[r] = new Map(datos.map(x => [x.time, x.value]));
  });
  const que = { seg: "seguidores", vis: "visualizaciones-media-30", likes: "me-gusta-media-30" }[modoComp];
  INFO["g-comp"] = { horas: false, titulo: "Comparativa por red", slug: "comparativa-" + que, periodo: null, cadaFila: "un día",
    nota: "El % es el cambio desde el primer día visible de cada red, como en la gráfica.",
    datos: r => {
      const dias = [...new Set(REDES.flatMap(x => [...porRed[x].keys()]))].sort().filter(t => dentro(t, r));
      const base = {}; REDES.forEach(x => { const t0 = dias.find(t => porRed[x].has(t)); base[x] = t0 ? porRed[x].get(t0) : null; });
      return { columnas: ["Día", ...REDES.flatMap(x => [D.redes[x].nombre, `${D.redes[x].nombre}: % desde el primer día visible`])],
        tipos: ["fecha", ...REDES.flatMap(() => [modoComp === "seg" ? "n0" : "n1", "pct"])],
        filas: dias.map(t => [t, ...REDES.flatMap(x => { const v = porRed[x].get(t); return [v ?? null, v != null && base[x] ? pct(v, base[x]) : null]; })]) };
    } };
  leyenda("ley-comp", g, filas);
  ponerEventos("g-comp", [], eventosPara("global", modoComp), "dia");
  const act = document.querySelector('.grupo.rango[data-graf="comp"] button.on');
  rango("comp", act ? act.dataset.r : "3M");
}

/* ─────────── ¿a qué hora está tu audiencia? (perfil horario de Metricool) ─────────── */
function audiencia(k) {
  const el = $("#audiencia"); if (!el) return;
  const cab = sel => `<div class="caja-cab"><h2>¿A qué hora está tu audiencia? <small>actividad por hora y día de la semana · hora de Madrid</small></h2>${sel || ""}</div>`;
  const hay = REDES.filter(r => perfilDe(r) && Array.isArray(perfilDe(r).actividad) && perfilDe(r).actividad.length === 7);
  if (!PERFIL || !hay.length) { el.innerHTML = cab() + `<p class="nota">No se ha podido leer el perfil horario de la audiencia (datos/perfil_horario.json).</p>`; return; }
  if (k !== "global" && !hay.includes(k)) { el.innerHTML = cab() + `<p class="nota">Metricool no da la actividad por horas de ${esc(D.redes[k].nombre)}.</p>`; return; }
  if (!hay.includes(redAudiencia)) redAudiencia = hay[0];
  const r = k === "global" ? redAudiencia : k, A = perfilDe(r).actividad.map(f => Array.from({ length: 24 }, (_, h) => +f[h] || 0));
  const sel = k === "global" ? `<div class="botones"><div class="grupo" id="aud-red" role="group" aria-label="Red de la que se ve la audiencia">` +
    hay.map(x => `<button type="button" data-r="${x}" class="${x === r ? "on" : ""}" aria-pressed="${x === r}"><i class="pt" style="background:${D.redes[x].color}"></i>${D.redes[x].nombre}</button>`).join("") + `</div></div>` : "";
  const max = Math.max(1, ...A.flat()), sumaH = (dias, h0, h1) => dias.reduce((a, d) => a + A[d].slice(h0, h1).reduce((x, y) => x + y, 0), 0);
  const SEM = [0, 1, 2, 3, 4, 5, 6], LV = [0, 1, 2, 3, 4], FS = [5, 6];
  const porc = (dias, h0, h1) => { const t = sumaH(dias, 0, 24); return t ? sumaH(dias, h0, h1) / t * 100 : null; };
  const porHora = Array.from({ length: 24 }, (_, h) => A.reduce((a, f) => a + f[h], 0)), totalSem = porHora.reduce((a, v) => a + v, 0) || 1;
  const top = porHora.map((v, h) => [h, v]).sort((a, b) => b[1] - a[1]).slice(0, 3), topSet = new Set(top.map(x => x[0]));
  let mejor = [0, 0]; A.forEach((f, d) => f.forEach((v, h) => { if (v > A[mejor[0]][mejor[1]]) mejor = [d, h]; }));
  const franja = h => `${pad(h)}:00–${pad(h + 1)}:00`;
  const calor = `<table class="calor"><caption class="sr">Actividad de la audiencia de ${esc(D.redes[r].nombre)} por día de la semana (filas) y hora de Madrid (columnas), según Metricool</caption>
    <thead><tr><th scope="col"><span class="sr">Día</span></th>${porHora.map((_, h) => `<th scope="col" class="${topSet.has(h) ? "top" : ""}" title="${franja(h)}${topSet.has(h) ? " · de las 3 mejores horas" : ""}"><span${h % 3 ? ' class="sr"' : ""}>${h}</span></th>`).join("")}</tr></thead>
    <tbody>${A.map((f, d) => `<tr><th scope="row" title="${cap(DIAS[d])}">${DIAS_C[d]}</th>${f.map((v, h) =>
      `<td style="--k:${(v / max).toFixed(3)}" title="${cap(DIAS[d])}, ${franja(h)}: ${fmt(v)}"><span class="sr">${fmt(v)}</span></td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const tabla = (filas, titulo) => {
    const vals = filas.map(([h0, h1]) => [SEM, LV, FS].map(ds => porc(ds, h0, h1)));
    const mx = Math.max(1, ...vals.flat().filter(v => v != null));
    return `<table class="aud-tramos"><caption>${titulo}</caption><thead><tr><th scope="col">Tramo</th><th scope="col" class="n">Semana</th><th scope="col" class="n">Lun–vie</th><th scope="col" class="n">Sáb–dom</th></tr></thead><tbody>` +
      filas.map(([h0, h1, nombre], i) => `<tr><th scope="row">${nombre ? `${nombre} <small>${pad(h0)}–${pad(h1)} h</small>` : `${pad(h0)}–${pad(h1)} h`}</th>` +
        vals[i].map(v => `<td class="n" style="--w:${v == null ? 0 : (v / mx * 100).toFixed(1)}"><span>${v == null ? "–" : fmt(v, 1) + " %"}</span></td>`).join("") + `</tr>`).join("") + `</tbody></table>`;
  };
  el.innerHTML = cab(sel) + `<div class="aud-cuerpo">
    <div class="calor-wrap">${calor}
      <div class="calor-escala" aria-hidden="true"><span>Menos actividad</span>${[0.05, 0.25, 0.5, 0.75, 1].map(x => `<i style="--k:${x}"></i>`).join("")}<span>Más</span></div></div>
    <div class="aud-resumen"><div class="aud-mejores">
      <h3>Las 3 mejores horas <small>suma de la semana</small></h3>
      <ol class="aud-top">${top.map(([h, v]) => `<li><b>${franja(h)}</b><span>${fmt(v / totalSem * 100, 1)} % de la actividad de la semana</span></li>`).join("")}</ol>
      <p class="aud-mejor">La hora con más actividad: <b>${DIAS[mejor[0]]} de ${franja(mejor[1])}</b>.</p></div>
      ${tabla([[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24]], "Tramos de 4 horas · % de la actividad")}
      ${tabla([[0, 8, "Madrugada"], [8, 16, "Mañana y mediodía"], [16, 24, "Tarde y noche"]], "Tramos de 8 horas · % de la actividad")}
    </div></div>
    <p class="nota">Fuente: ${esc(PERFIL.fuente || "Metricool")}${PERFIL.generado ? `, datos del ${fecha(PERFIL.generado)}` : ""}. Los valores de cada casilla son los de Metricool (pasa el ratón para verlos) y sirven para comparar horas de una misma red. Es lo que se usa para estimar los tramos de 2H a 12H.</p>`;
  el.querySelectorAll("#aud-red button").forEach(b => b.onclick = () => { redAudiencia = b.dataset.r; audiencia(vista); const n = $(`#aud-red button[data-r="${redAudiencia}"]`); if (n) n.focus(); });
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

  const g = crear("g-tienda"), filas = [], semanas = {};
  REDES.forEach(r => {
    const sem = new Map();
    D.tienda.serie.forEach(([f, x]) => { const k = lunes(f); sem.set(k, (sem.get(k) || 0) + (x[r] ? x[r][0] : 0)); });
    const datos = [...sem].sort().map(([t, v]) => ({ time: t, value: v }));
    semanas[r] = sem;
    const l = g.addLineSeries({ color: D.redes[r].color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l.setData(datos); filas.push({ nombre: D.redes[r].nombre, color: D.redes[r].color, serie: l, datos });
  });
  INFO["g-tienda"] = { horas: false, vista: "impacto", titulo: "Visitas a la tienda desde redes", slug: "visitas-tienda-semanal", periodo: null, cadaFila: "una semana (lunes a domingo)",
    datos: r => ({ columnas: ["Semana (lunes)", ...REDES.map(x => `${D.redes[x].nombre}: visitas`)], tipos: ["fecha", "n0", "n0", "n0", "n0"],
      filas: [...new Set(REDES.flatMap(x => [...semanas[x].keys()]))].sort().filter(t => dentro(t, r)).map(t => [t, ...REDES.map(x => semanas[x].get(t) ?? 0)]) }) };
  leyenda("ley-tienda", g, filas); g.timeScale().fitContent();

  const gm = crear("g-marca"), vals = marca.map(x => x[1]), m7 = media(vals, 7);
  const b = gm.addHistogramSeries({ color: MARCA + "99", priceFormat: { type: "volume" }, priceLineVisible: false });
  b.setData(marca.map(x => ({ time: x[0], value: x[1] })));
  const l = gm.addLineSeries({ color: Tm.ma7, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  l.setData(marca.map((x, i) => ({ time: x[0], value: m7[i] })));
  INFO["g-marca"] = { horas: false, vista: "impacto", titulo: "Búsquedas de la marca en Google", slug: "busquedas-marca", periodo: null, cadaFila: "un día",
    datos: r => ({ columnas: ["Día", "Clics", "Media 7 días", "Impresiones"], tipos: ["fecha", "n0", "n1", "n0"], filas: marca.map((x, i) => [x[0], x[1], m7[i], x[2]]).filter(f => dentro(f[0], r)) }) };
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

/* ─────────── acciones de cada gráfica: pantalla completa y descargas ─────────── */
const ICO = {
  pantalla: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>`,
  salir: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v4H2M10 2v4h4M10 14v-4h4M6 14v-4H2"/></svg>`,
  bajar: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11"/></svg>`,
};
const PANES = [["p-seg", "g-seg", "Seguidores"], ["p-vis", "g-vis", "Visualizaciones diarias"], ["p-acum", "g-acum", "Visualizaciones acumuladas"],
  ["p-lk", "g-lk", "Me gusta"], ["p-comp", "g-comp", "Comparativa por red"], ["p-tienda", "g-tienda", "Visitas a la tienda"], ["p-marca", "g-marca", "Búsquedas de la marca"]];
function montarAcciones() {
  PANES.forEach(([pid, gid, nombre]) => {
    const pane = document.getElementById(pid); if (!pane) return;
    let bot = pane.querySelector(".caja-cab .botones");
    if (!bot) { bot = document.createElement("div"); bot.className = "botones"; pane.querySelector(".caja-cab h2").after(bot); }
    if (CUATRO.includes(gid)) bot.insertAdjacentHTML("beforeend", `<div class="grupo rango rango-pane" data-graf="seg" role="group" aria-label="Periodo de las gráficas"></div>`);
    bot.insertAdjacentHTML("beforeend", `<div class="acciones">
      <div class="grupo descargas" role="group" aria-label="Descargar los datos que se ven de ${nombre}"><span class="ico" aria-hidden="true">${ICO.bajar}</span>` +
      `<button type="button" data-desc="csv" aria-label="Descargar en CSV los datos que se ven de ${nombre}">CSV</button>` +
      `<button type="button" data-desc="xlsx" aria-label="Descargar en Excel los datos que se ven de ${nombre}">Excel</button></div>
      <button type="button" class="b-pantalla" aria-pressed="false" aria-label="Ver ${nombre} a pantalla completa">${ICO.pantalla}<span>Pantalla completa</span></button></div>`);
    bot.querySelectorAll("[data-desc]").forEach(b => b.onclick = () => descargarGrafica(gid, b.dataset.desc, b));
    const bp = bot.querySelector(".b-pantalla");
    bp.dataset.nombre = nombre;
    bp.onclick = () => paneCompleta === pane ? salirPantalla() : entrarPantalla(pane);
  });
}
function botonPantalla(pane, on) {
  const b = pane.querySelector(".b-pantalla"); if (!b) return;
  b.setAttribute("aria-pressed", String(on));
  b.setAttribute("aria-label", on ? "Salir de la pantalla completa" : `Ver ${b.dataset.nombre} a pantalla completa`);
  b.innerHTML = (on ? ICO.salir : ICO.pantalla) + `<span>${on ? "Salir" : "Pantalla completa"}</span>`;
}
function moverFlotantes(destino) { ["#ficha-ev", "#toast"].forEach(s => { const e = $(s); if (e && e.parentElement !== destino) destino.appendChild(e); }); }
async function entrarPantalla(pane) {
  if (paneCompleta) limpiarPantalla(true);
  paneCompleta = pane; pane.classList.add("pantalla"); botonPantalla(pane, true); moverFlotantes(pane);
  const pedir = pane.requestFullscreen || pane.webkitRequestFullscreen;
  let ok = false;
  if (pedir) { try { const r = pedir.call(pane); if (r && r.then) await r; ok = !!(document.fullscreenElement || document.webkitFullscreenElement); } catch (e) { ok = false; } }
  if (!ok && paneCompleta === pane) { pane.classList.add("fija"); document.documentElement.classList.add("con-pantalla-fija"); }   // iPhone: capa fija
  const b = pane.querySelector(".b-pantalla"); if (b) b.focus({ preventScroll: true });
}
function salirPantalla() {
  if (!paneCompleta) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    const s = document.exitFullscreen || document.webkitExitFullscreen;
    try { const r = s.call(document); if (r && r.catch) r.catch(() => limpiarPantalla()); } catch (e) { limpiarPantalla(); }
  } else limpiarPantalla();
}
function limpiarPantalla(sinFoco = false) {
  const p = paneCompleta; if (!p) return;
  paneCompleta = null; cerrarFicha(false);
  p.classList.remove("pantalla", "fija"); document.documentElement.classList.remove("con-pantalla-fija");
  botonPantalla(p, false); moverFlotantes(document.body);
  if (!sinFoco) { const b = p.querySelector(".b-pantalla"); if (b) b.focus({ preventScroll: true }); }
}
function alCambiarPantalla() {
  const fs = document.fullscreenElement || document.webkitFullscreenElement;
  if (!fs && paneCompleta && !paneCompleta.classList.contains("fija")) limpiarPantalla();
}

let temporizadorToast = null;
function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("visible");
  clearTimeout(temporizadorToast); temporizadorToast = setTimeout(() => t.classList.remove("visible"), 3600);
}
function ocupado(b, si) { if (!b) return; b.setAttribute("aria-busy", String(si)); b.disabled = si; }

/* CSV (BOM UTF-8, «;» y decimales con coma, para que Excel en español lo abra bien) y Excel (SheetJS bajo demanda) */
const DEC = { n0: 0, n1: 1, n2: 2, pct: 2 };
function celdaCSV(v, tipo) {
  if (v == null || v === "" || (typeof v === "number" && !isFinite(v))) return "";
  if (tipo === "ts" && typeof v === "number") return isoHora(v);
  if (typeof v === "number") { const d = DEC[tipo] ?? 2; return String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ","); }
  let s = String(v); if (/^[=+@]/.test(s)) s = "'" + s;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const aCSV = def => "﻿" + [def.columnas.map(c => celdaCSV(c, "txt")).join(";"),
  ...def.filas.map(f => f.map((v, i) => celdaCSV(v, def.tipos[i])).join(";"))].join("\r\n") + "\r\n";
function bajarBlob(blob, nombre) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; a.style.display = "none";
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
let promesaXLSX = null;
function cargarXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!promesaXLSX) promesaXLSX = new Promise((ok, mal) => {
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.crossOrigin = "anonymous";
    s.onload = () => window.XLSX ? ok(window.XLSX) : mal(new Error("la librería de Excel no ha arrancado"));
    s.onerror = () => { promesaXLSX = null; s.remove(); mal(new Error("no se ha podido cargar la librería de Excel")); };
    document.head.appendChild(s);
  });
  return promesaXLSX;
}
const serialExcel = (y, m, d, h = 0, mi = 0) => (Date.UTC(y, m - 1, d, h, mi) - Date.UTC(1899, 11, 30)) / 864e5;
function celdaXLSX(v, tipo) {
  if (v == null || v === "" || (typeof v === "number" && !isFinite(v))) return null;
  if (tipo === "fecha" && typeof v === "string" && /^\d{4}-\d\d-\d\d$/.test(v)) { const [y, m, d] = v.split("-").map(Number); return { t: "n", v: serialExcel(y, m, d), z: "dd/mm/yyyy" }; }
  if (tipo === "fechahora" && typeof v === "string") { const m = v.match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/); if (m) return { t: "n", v: serialExcel(+m[1], +m[2], +m[3], +m[4], +m[5]), z: "dd/mm/yyyy hh:mm" }; }
  if (tipo === "ts" && typeof v === "number") { const p = partesMadrid(v); return { t: "n", v: serialExcel(+p.year, +p.month, +p.day, +p.hour, +p.minute), z: "dd/mm/yyyy hh:mm" }; }
  if (typeof v === "number") { const d = DEC[tipo] ?? 2; return { t: "n", v: Math.round(v * 10 ** d) / 10 ** d, z: d === 0 ? "#,##0" : "#,##0." + "0".repeat(d) }; }
  if (tipo === "url" && /^https?:\/\//.test(String(v))) return { t: "s", v: String(v), l: { Target: String(v) } };
  return { t: "s", v: String(v) };
}
// filas: arrays (usan los tipos de las columnas) u objetos {t: tipos, v: valores} para bloques con otro formato
function hoja(X, columnas, tipos, filas, anchos) {
  const ws = {}; let maxC = columnas.length - 1;
  columnas.forEach((c, j) => { ws[X.utils.encode_cell({ r: 0, c: j })] = { t: "s", v: String(c) }; });
  filas.forEach((f, i) => {
    const vals = Array.isArray(f) ? f : f.v, tp = Array.isArray(f) ? tipos : f.t;
    vals.forEach((v, j) => { const c = celdaXLSX(v, tp[j]); if (c) ws[X.utils.encode_cell({ r: i + 1, c: j })] = c; if (j > maxC) maxC = j; });
  });
  ws["!ref"] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: maxC } });
  ws["!cols"] = Array.from({ length: maxC + 1 }, (_, j) => ({ wch: (anchos && anchos[j]) || Math.min(48, Math.max(11, String(columnas[j] ?? "").length + 2)) }));
  return ws;
}
const nombreVista = v => v === "impacto" ? "Impacto en TDR" : v === "global" ? "Global (las cuatro redes)" : D.redes[v] ? D.redes[v].nombre : v;
async function descargarGrafica(id, formato, boton) {
  const info = INFO[id], ch = graficas[id];
  if (!info || !ch) { toast("Esta gráfica no tiene datos que descargar."); return; }
  const r0 = ch.timeScale().getVisibleRange(), r = r0 && { from: normT(r0.from), to: normT(r0.to) };
  const def = info.datos(r), v = info.vista || vista;
  const nombre = ["TDR-redes", v, info.slug, info.periodo, D.actualizado.slice(0, 10)].filter(Boolean).join("-");
  if (formato === "csv") {
    bajarBlob(new Blob([aCSV(def)], { type: "text/csv;charset=utf-8" }), nombre + ".csv");
    toast(`Descargado ${nombre}.csv · ${fmt(def.filas.length)} filas`); return;
  }
  ocupado(boton, true);
  try {
    const X = await cargarXLSX(), wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, hoja(X, def.columnas, def.tipos, def.filas), "Datos");
    const f0 = def.filas.length ? def.filas[0][0] : null, f1 = def.filas.length ? def.filas[def.filas.length - 1][0] : null;
    const txt = t => t == null ? "–" : typeof t === "number" ? fechaHora(t) : fecha(t);
    X.utils.book_append_sheet(wb, hoja(X, ["Dato", "Valor"], ["txt", "txt"], [
      ["Panel", "Panel de redes de TodoEnRecambio (Terminal papel 2)"], ["Vista", nombreVista(v)], ["Gráfica", info.titulo], ["Cada fila", info.cadaFila || "–"],
      ["Lo que se veía", `${txt(f0)} – ${txt(f1)}`], ["Filas", fmt(def.filas.length)], ["Datos del", `${fecha(D.actualizado)} ${D.actualizado.slice(11)}`],
      ...(info.nota ? [["Nota", info.nota]] : [])], [20, 100]), "Info");
    X.writeFile(wb, nombre + ".xlsx", { compression: true });
    toast(`Descargado ${nombre}.xlsx · ${fmt(def.filas.length)} filas`);
  } catch (e) { toast("No se ha podido preparar el Excel: " + (e && e.message || e)); }
  finally { ocupado(boton, false); }
}
function hojaPrediccion(X, P) {
  const met = k => (P.metricas && P.metricas[k]) || {};
  const filas = [];
  Object.entries(P.redes || {}).forEach(([r, R]) => Object.entries(R.series || {}).forEach(([m, S]) => (P.horizontes || []).forEach(h => {
    const x = S && S.horizontes && S.horizontes[h.k]; if (!x) return;
    filas.push([R.nombre || r, met(m).nombre || m, h.nombre, h.dias, x.fecha, x.p10, x.p50, x.p90, x.cambio_p50, S.actual,
      met(m).tipo === "flujo" ? "suma del periodo" : "valor en esa fecha", S.ritmo || "", R.datos_hasta || ""]);
  })));
  const tObj = ["txt", "txt", "txt", "n0", "n0", "pct", "fecha", "fecha", "fecha", "pct", "txt"];
  const objetivos = [];
  Object.entries(P.redes || {}).forEach(([r, R]) => (R.hitos || []).forEach(o => objetivos.push({ t: tObj,
    v: [R.nombre || r, o.nombre || "", met(o.metrica).nombre || o.metrica || "", o.objetivo, o.actual, o.progreso != null ? o.progreso * 100 : null,
      o.fecha_p10, o.fecha_p50, o.fecha_p90 || "no llega en 2 años", o.prob_2a != null ? o.prob_2a * 100 : null, o.detalle || ""] })));
  const txt = n => ({ t: Array(n.length).fill("txt"), v: n });
  if (objetivos.length) filas.push(txt([]), txt(["Objetivos", "Nombre", "Métrica", "Objetivo", "Actual", "Progreso (%)", "Fecha si va bien (p10)", "Fecha probable (p50)", "Fecha si va mal (p90)", "Probabilidad en 2 años (%)", "Detalle"]), ...objetivos);
  if (P.modelo) filas.push(txt([]), txt(["Cómo se calcula", String(P.modelo.texto || "").replace(/\s+/g, " ")]), txt(["Banda", P.modelo.banda || ""]));
  filas.push(txt(["Previsión hecha el", P.generado || ""]));
  return hoja(X, ["Red", "Métrica", "Plazo", "Días", "Fecha", "Escenario bajo (p10)", "Lo más probable (p50)", "Escenario alto (p90)", "Cambio (p50)", "Valor actual", "Qué es", "Ritmo", "Datos hasta"],
    ["txt", "txt", "txt", "n0", "fecha", "n1", "n1", "n1", "n1", "n1", "txt", "txt", "fecha"], filas, [14, 30, 12, 7, 12, 14, 14, 14, 12, 12, 18, 48, 12]);
}
async function descargarTodo(boton) {
  ocupado(boton, true);
  try {
    const [X, pred] = await Promise.all([cargarXLSX(), leerJSON("../datos/prediccion.json").catch(() => null)]);
    const wb = X.utils.book_new(), add = (n, ws) => X.utils.book_append_sheet(wb, ws, n);
    const resumen = ["global", ...REDES].map(k => {
      const R = k === "global" ? D.global_ : D.redes[k].resumen;
      return [k === "global" ? "Global (las cuatro redes)" : D.redes[k].nombre, R.seguidores, R.fecha_seg, R.d1, R.d7, R.d30, R.d90, R.d365, R.media_dia_30, R.media_dia_90,
        R.vis_30, R.vis_prev_30, R.vis_cambio_30, R.vis_media_30, R.vis_7, R.vis_historico, R.lk_total, R.lk_30, R.lk_prev_30, R.lk_cambio_30, R.lk_media_30, R.lk_7,
        R.vis_30 ? R.lk_30 / R.vis_30 * 100 : null, k === "global" ? "" : D.redes[k].url];
    });
    resumen.push({ t: ["txt"], v: [] }, { t: ["txt"], v: [`Datos del ${fecha(D.actualizado)} a las ${D.actualizado.slice(11)}; se rehacen a las 9:00 y a las 17:00. Fuentes: YouTube Analytics, Metricool, Google Analytics y Search Console.`] });
    add("Resumen", hoja(X, ["Red", "Seguidores", "Dato del", "Cambio último día", "Cambio 7 días", "Cambio 30 días", "Cambio 90 días", "Cambio 365 días",
      "Seguidores al día (media 30 d)", "Seguidores al día (media 90 d)", "Visualizaciones 30 días", "Visualizaciones 30 días anteriores", "Cambio visualizaciones 30 d (%)",
      "Visualizaciones al día (media 30 d)", "Visualizaciones últimos 7 días", "Visualizaciones históricas", "Me gusta históricos", "Me gusta 30 días",
      "Me gusta 30 días anteriores", "Cambio me gusta 30 d (%)", "Me gusta al día (media 30 d)", "Me gusta últimos 7 días", "Me gusta por cada 100 visualizaciones (30 d)", "Perfil"],
      ["txt", "n0", "fecha", "n0", "n0", "n0", "n0", "n0", "n2", "n2", "n0", "n0", "pct", "n1", "n0", "n0", "n0", "n0", "n0", "pct", "n1", "n0", "n2", "url"], resumen, [26]));
    add("Global", hoja(X, ["Día", "Seguidores", "Visualizaciones", "Me gusta"], ["fecha", "n0", "n0", "n0"], D.global_serie.map(x => [x[0], x[1], x[2], x[3]])));
    REDES.forEach(r => add(D.redes[r].nombre, hoja(X, ["Día", "Seguidores", "Visualizaciones", "Seguidores ganados", "Seguidores perdidos", "Me gusta"],
      ["fecha", "n0", "n0", "n0", "n0", "n0"], D.series[r].map(x => [x[0], x[1], x[2], x[3], x[4], x[5]]))));
    const tc = ["Día"], tt = ["fecha"];
    REDES.forEach(r => { const n = D.redes[r].nombre; tc.push(`${n}: visitas`, `${n}: compras`, `${n}: importe (€)`); tt.push("n0", "n0", "n2"); });
    add("Tienda", hoja(X, tc, tt, D.tienda.serie.map(([f, x]) => [f, ...REDES.flatMap(r => x[r] ? [x[r][0], x[r][1], x[r][2]] : [0, 0, 0])])));
    add("Marca", hoja(X, ["Día", "Clics", "Impresiones"], ["fecha", "n0", "n0"], D.marca.map(x => [x[0], x[1], x[2]])));
    add("Vídeos", hoja(X, ["Fecha", "Red", "Tipo", "Título", "Enlace", "Visualizaciones", "Me gusta", "Comentarios", "Alcance"],
      ["fechahora", "txt", "txt", "txt", "url", "n0", "n0", "n0", "n0"],
      D.publicaciones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map(p => [p.fecha, D.redes[p.red].nombre, p.tipo === "largo" ? "Largo" : p.tipo === "short" ? "Short" : "",
        p.titulo || "", p.url || "", p.vis, p.likes, p.comentarios, p.alcance ?? null]), [16, 11, 7, 60, 36]));
    add("Eventos", hoja(X, ["Desde", "Hasta", "Red", "Métrica", "Tipo", "Título", "Valor", "Lo normal antes", "Detalle", "Qué lo explica", "Origen"],
      ["fecha", "fecha", "txt", "txt", "txt", "txt", "n0", "n0", "txt", "txt", "txt"],
      EV.map(e => [e.fecha, e.hasta, e.red === "global" ? "Global" : D.redes[e.red] ? D.redes[e.red].nombre : e.red, NOMBRE_MET[e.metrica] || e.metrica, NOMBRE_TIPO[e.tipo] || e.tipo,
        e.titulo, e.valor, e.esperado, e.detalle || "", (e.causa || []).map(c => `${c.titulo}${c.vis != null ? ` (${fmt(c.vis)} visualizaciones)` : ""}${c.url ? " " + c.url : ""}`).join(" | "),
        e.origen === "manual" ? "Escrito a mano" : "Rutina automática"]), [12, 12, 10, 15, 9, 44, 10, 12, 80, 80, 16]));
    if (pred && pred.redes) add("Predicción", hojaPrediccion(X, pred));
    const nombre = `TDR-redes-datos-${D.actualizado.slice(0, 10)}.xlsx`;
    X.writeFile(wb, nombre, { compression: true });
    toast(`Descargado ${nombre} · ${wb.SheetNames.length} hojas${pred && pred.redes ? "" : " (sin predicción: no se ha podido leer prediccion.json)"}`);
  } catch (e) { toast("No se ha podido preparar el Excel: " + (e && e.message || e)); }
  finally { ocupado(boton, false); }
}

/* ─────────── mapa de vídeos (módulo común, se carga al abrir la pestaña) ─────────── */
function temaMapa() {
  const s = getComputedStyle(document.documentElement), v = k => s.getPropertyValue(k).trim();
  return { claro: esClara(), fondo: v("--fondo"), superficie: v("--capa1"), tinta: v("--tinta"),
    suave: v("--tinta-suave"), linea: v("--linea"), letraTexto: v("--f-texto"), letraCifras: v("--f-cifra") };
}
function abrirMapa() {
  if (mapa) { mapa.reanudar(); return; }
  if (cargandoMapa) return;
  const cont = $("#mapa-3d");
  cargandoMapa = (async () => {
    try {
      const { montarMapa } = await import("../comun/mapa3d.js");
      cont.innerHTML = "";
      mapa = await montarMapa(cont, { datos: "../disenos/mapa/mapa_videos.json", logo: "../logo-tdr.png", modo: "globo",
        clave: "tdr-terminal-papel-2-mapa", tema: temaMapa() });
      if (vista !== "mapa") mapa.pausar();
    } catch (e) {
      cont.innerHTML = `<p class="nota mapa-cargando">El mapa todavía no está listo (${esc(e && e.message || e)}).</p>`;
    }
    cargandoMapa = null;
  })();
}

/* ─────────── Futuro (módulo comun/futuro.js, se carga al abrir la pestaña) ─────────── */
function abrirFuturo() {
  if (futuro || cargandoFuturo) return;
  const cont = $("#futuro");
  cargandoFuturo = (async () => {
    try {
      const { montarFuturo } = await import("../comun/futuro.js" + (intentosFuturo ? "?r=" + intentosFuturo : ""));
      cont.innerHTML = "";
      futuro = await montarFuturo(cont, { datos: "../datos/prediccion.json", eventos: "../datos/eventos.json", clave: "tdr-terminal-papel-2-futuro" });
    } catch (e) {
      futuro = null;
      cont.innerHTML = `<p class="futuro-aviso">La sección Futuro se está preparando.</p>`;
    }
    intentosFuturo++;
    cargandoFuturo = null;
  })();
}
