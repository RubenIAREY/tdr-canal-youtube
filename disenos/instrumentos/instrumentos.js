/* Panel de redes de TDR · versión «Cuadro de instrumentos».
   El panel se lee como la pantalla TFT de una moto: modos (Global y cada red, más las pantallas Tienda y Vídeos),
   cuentarrevoluciones de visualizaciones y de me gusta al día con la zona roja en su récord, seguidores en el centro,
   cuentakilómetros (ODO, TRIP A, TRIP B) y testigos que solo se encienden si se cumple su condición.
   La lógica de datos viene de ../../panel.js (medias de 7 y 30 días, velas, recortarCola, rangos, comparativa, tendencia).
   Lee ../../datos_redes.json, que PANEL-REDES/construir_panel.py rehace a las 9:00 y a las 17:00. */
"use strict";

/* ─────────── utilidades ─────────── */
const REDES = ["youtube", "instagram", "tiktok", "facebook"];
const MODOS = ["global", ...REDES, "tienda", "videos"];
const NOMBRE_MODO = { global: "Global", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", tienda: "Tienda", videos: "Vídeos" };
const COLOR_RED = { youtube: "#ff3b30", instagram: "#e1306c", tiktok: "#25f4ee", facebook: "#1877f2" };
const TDR = "#D71119";
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmt = (n, d = 0) => n == null || isNaN(n) ? "–" : Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
const signo = (n, d = 0) => n == null || isNaN(n) ? "–" : (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), d);
const cls = n => n == null || isNaN(n) || n === 0 ? "igual" : n > 0 ? "sube" : "baja";
const fecha = s => { if (!s) return "–"; const [y, m, d] = s.slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]} ${y}`; };
const pct = (a, b) => a == null || !b ? null : (a - b) / b * 100;
const flecha = n => n == null || isNaN(n) ? "" : n > 0 ? "▲ " : n < 0 ? "▼ " : "";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtMedia = v => v == null ? "–" : fmt(v, Math.abs(v) >= 100 ? 0 : 1);
const plural = (n, uno, varios) => `${fmt(n)} ${n === 1 ? uno : varios}`;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* Curva de las animaciones: la misma cubic-bezier(0.23, 1, 0.32, 1) del CSS, resuelta para la aguja. */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t, dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
    if (t < 0 || t > 1 || Math.abs(sx(t) - x) > 1e-4) { let a = 0, b = 1; t = x; for (let i = 0; i < 30; i++) { if (sx(t) < x) a = t; else b = t; t = (a + b) / 2; } }
    return sy(Math.min(1, Math.max(0, t)));
  };
}
const curva = bezier(0.23, 1, 0.32, 1);

/* ─────────── ajustes en vivo (la URL manda sobre localStorage) ─────────── */
const AJ_DEF = { paleta: "noche", letra: "barlow", densidad: "normal", aguja: "animada", testigos: "mostrar", escala: "record" };
const AJ_OPC = { paleta: ["noche", "dia", "carbono", "dorsal"], letra: ["barlow", "saira", "oxanium"], densidad: ["compacta", "normal", "amplia"],
                 aguja: ["animada", "fija"], testigos: ["mostrar", "ocultar"], escala: ["record", "redonda"] };
const AJ_CLAVE = "tdr-panel-instrumentos";
const ajustes = (() => {
  let g = {}; try { g = JSON.parse(localStorage.getItem(AJ_CLAVE) || "{}") || {}; } catch (e) { g = {}; }
  const q = new URLSearchParams(location.search), a = {};
  for (const k in AJ_DEF) { const v = q.get(k) ?? g[k]; a[k] = AJ_OPC[k].includes(v) ? v : AJ_DEF[k]; }
  return a;
})();
function guardarAjustes() {
  const html = document.documentElement;
  for (const k in ajustes) html.dataset[k] = ajustes[k];
  const q = new URLSearchParams(location.search);
  for (const k in ajustes) q.set(k, ajustes[k]);
  history.replaceState(null, "", `${location.pathname}?${q}${location.hash}`);
  try { localStorage.setItem(AJ_CLAVE, JSON.stringify(ajustes)); } catch (e) { /* sin localStorage la página sigue funcionando */ }
}
const reducido = window.matchMedia("(prefers-reduced-motion: reduce)");
const animar = () => ajustes.aguja === "animada" && !reducido.matches;

/* ─────────── estado ─────────── */
const LC = window.LightweightCharts;
let D = null, modo = "global";
let modoSeg = "velas", perSeg = "semana", modoAcum = "velas", perAcum = "semana", modoLk = "dia", modoComp = "seg";
let filtroRed = "todas", orden = "fecha";
const rangos = { tres: "1A", comp: "3M", tienda: "Todo", marca: "Todo" };
let graficas = {}, sincronizando = false;
const suscritas = new WeakSet();
const relojes = {};
const CACHE = {};

guardarAjustes();
Promise.all([
  fetch("../../datos_redes.json?" + Date.now()).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))]),
]).then(([d]) => { D = d; arrancar(); })
  .catch(e => {
    console.warn(e);
    $("#contenido").insertAdjacentHTML("afterbegin", `<p class="aviso-error">No se han podido cargar los datos del panel (${esc(e.message || e)}). Vuelve a cargar la página en un momento.</p>`);
  });

function arrancar() {
  $("#actualizado").textContent = fecha(D.actualizado) + " " + D.actualizado.slice(11);
  relojes.a = montarReloj($("#reloj-a"));
  relojes.b = montarReloj($("#reloj-b"));
  ledsModos();

  // modos (pestañas) con clic y flechas
  const tabs = $$("#modos [role=tab]");
  tabs.forEach(b => b.addEventListener("click", () => { if (b.dataset.modo !== modo) ir(b.dataset.modo); }));
  $("#modos").addEventListener("keydown", e => {
    const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    const j = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (j < 0) return; e.preventDefault(); tabs[j].focus(); ir(tabs[j].dataset.modo);
  });

  // mandos de las gráficas
  botones("#modo-seg", "m", v => { modoSeg = v; graficaSeg(modo); aplicarRango("seg", "g-seg"); });
  botones("#per-seg", "p", v => { perSeg = v; graficaSeg(modo); aplicarRango("seg", "g-seg"); });
  botones("#modo-acum", "m", v => { modoAcum = v; graficaAcum(modo); aplicarRango("acum", "g-acum"); sincronizar(); });
  botones("#per-acum", "p", v => { perAcum = v; graficaAcum(modo); aplicarRango("acum", "g-acum"); sincronizar(); });
  botones("#modo-lk", "m", v => { modoLk = v; graficaLk(modo); aplicarRango("lk", "g-lk"); sincronizar(); });
  botones("#modo-comp", "m", v => { modoComp = v; graficaComp(); });
  botones("#filtro-red", "f", v => { filtroRed = v; tablaVideos(); });
  botones("#filtro-orden", "o", v => { orden = v; tablaVideos(); });
  $$(".seg.rango").forEach(g => {
    g.innerHTML = ["1M", "3M", "6M", "1A", "2A", "Todo"].map(r => `<button type="button" data-r="${r}" aria-pressed="false">${r}</button>`).join("");
    g.addEventListener("click", e => { const b = e.target.closest("button[data-r]"); if (b) rango(g.dataset.graf, b.dataset.r); });
  });

  montarAjustes();
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (MODOS.includes(h) && h !== modo) ir(h); });
  const h = location.hash.slice(1);
  ir(MODOS.includes(h) ? h : "global", true);
}
function botones(sel, attr, fn) {
  const g = $(sel);
  g.addEventListener("click", e => {
    const b = e.target.closest(`button[data-${attr}]`); if (!b || b.getAttribute("aria-pressed") === "true") return;
    g.querySelectorAll(`button[data-${attr}]`).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    fn(b.dataset[attr]);
  });
}

/* ─────────── cambiar de modo: cambia todo el cuadro ─────────── */
function ir(m, inicial = false) {
  modo = m;
  history.replaceState(null, "", `${location.pathname}${location.search}#${m}`);
  $$("#modos [role=tab]").forEach(b => { const on = b.dataset.modo === m; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  $("#cuadro").setAttribute("aria-labelledby", "m-" + m);
  Object.values(graficas).forEach(g => g && g.remove()); graficas = {};
  const esRed = m === "global" || REDES.includes(m);
  $("#v-redes").hidden = !esRed; $("#v-tienda").hidden = m !== "tienda"; $("#v-videos").hidden = m !== "videos";
  if (esRed) rangos.tres = m === "youtube" || m === "global" ? "1A" : "Todo";
  pintarCuadro(m);
  if (!LC) { avisoSinGraficas(); }
  else if (esRed) pintarRed(m);
  else if (m === "tienda") graficasTienda();
  if (m === "tienda") tablaVentas();
  if (m === "videos") tablaVideos();
  if (!inicial) window.scrollTo({ top: 0, behavior: "auto" });
}
function avisoSinGraficas() {
  $$(".grafica").forEach(g => { g.innerHTML = `<p class="nota">No se ha podido cargar la librería de gráficas (TradingView Lightweight Charts).</p>`; });
}

/* ─────────── series (de panel.js) ─────────── */
function resumen(k) { return k === "global" ? D.global_ : D.redes[k].resumen; }
function serieDe(k) {
  if (k === "global") return D.global_serie.map(x => ({ t: x[0], seg: x[1], vis: x[2], likes: x[3] }));
  return D.series[k].map(x => ({ t: x[0], seg: x[1], vis: x[2], gan: x[3], per: x[4], likes: x[5] }));
}
function recortarCola(s, campo) {                      // quita los últimos días sin dato (las redes van con 1-3 días de retraso)
  let i = s.length; while (i > 0 && (s[i - 1][campo] == null)) i--; return s.slice(0, i);
}
/* Media móvil de n días contando solo los días con dato (null = sin dato, no es 0).
   min: días con dato que hacen falta en la ventana; completa: no da valor hasta tener n días de historia. */
function mediaMovil(vals, n, min = 1, completa = false) {
  const out = []; let suma = 0, cuenta = 0;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]; if (v != null) { suma += v; cuenta++; }
    if (i >= n) { const s = vals[i - n]; if (s != null) { suma -= s; cuenta--; } }
    out.push((completa && i < n - 1) || cuenta < min ? null : suma / cuenta);
  }
  return out;
}
function lunes(t) { const d = new Date(t + "T00:00:00Z"); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); }

/* Velas por periodo: código de referencia del encargo, tal cual. */
function clavePeriodo(t, periodo) {            // periodo: "dia" | "semana" | "mes"
  if (periodo === "mes") return t.slice(0, 7) + "-01";
  if (periodo === "semana") { const d = new Date(t + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }
  return t;
}
function velas(puntos, periodo) {               // puntos: [{time: "AAAA-MM-DD", value}] en orden y sin nulos
  const grupos = new Map();
  puntos.forEach(p => { const k = clavePeriodo(p.time, periodo); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p.value); });
  const out = []; let prev = null;
  for (const [k, a] of grupos) {
    const open = prev ?? a[0], close = a[a.length - 1];
    out.push({ time: k, open, close, high: Math.max(open, ...a), low: Math.min(open, ...a) });
    prev = close;
  }
  return out;
}
function etiquetaPeriodo(t, periodo) {
  if (periodo === "mes") { const [y, m] = t.split("-"); return `${MES[+m - 1]} ${y}`; }
  if (periodo === "semana") return `semana del ${fecha(t)}`;
  return fecha(t);
}

/* Lo que mide un reloj: media de 30 días (ventanas completas, al menos 20 días con dato), su récord y cuándo fue. */
function medidorDe(fechas, vals) {
  const m = mediaMovil(vals, 30, 20, true);
  let iRec = -1;
  m.forEach((v, i) => { if (v != null && (iRec < 0 || v >= m[iRec])) iRec = i; });
  const ult = m.length - 1;
  return {
    valor: ult >= 0 ? m[ult] : null,
    record: iRec >= 0 ? m[iRec] : null,
    fechaRecord: iRec >= 0 ? fechas[iRec] : null,
    recordReciente: iRec >= 0 && iRec >= m.length - 7,     // récord en los últimos 7 días con dato
    hasta: ult >= 0 ? fechas[ult] : null,
    m30: m,
  };
}
function medidor(k, campo) {
  const clave = k + ":" + campo; if (CACHE[clave]) return CACHE[clave];
  const R = resumen(k), desde = campo === "vis" ? R.desde_vis : R.desde_lk;
  const s = recortarCola(serieDe(k).filter(x => x.t >= (desde || "9999")), campo);
  const med = medidorDe(s.map(x => x.t), s.map(x => x[campo]));
  med.serie = s;
  return (CACHE[clave] = med);
}
/* Tendencia (como panel.js): media de 30 días de hoy frente a la de hace 30 días. */
function tendencia(k) { const m = medidor(k, "vis").m30; return m.length > 60 ? pct(m[m.length - 1], m[m.length - 31]) : null; }
const palabraTend = t => t == null ? "–" : t > 3 ? "Creciendo" : t < -3 ? "Bajando" : "Estable";

function datosTienda() {
  if (CACHE.tienda) return CACHE.tienda;
  const T = D.tienda.resumen;
  const tot = (per, i) => REDES.reduce((a, r) => a + (T[per] && T[per][r] ? T[per][r][i] : 0), 0);
  // visitas de cada día desde las cuatro redes (un día sin fila en Analytics = 0 visitas)
  const porDia = new Map(D.tienda.serie.map(([f, x]) => [f, REDES.reduce((a, r) => a + (x[r] ? x[r][0] : 0), 0)]));
  const fechas = [], vals = [];
  for (let d = new Date(T.desde + "T00:00:00Z"), fin = new Date(T.hasta + "T00:00:00Z"); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    const f = d.toISOString().slice(0, 10); fechas.push(f); vals.push(porDia.get(f) || 0);
  }
  const suma = a => a.reduce((x, y) => x + y, 0);
  const mk = D.marca || [], mf = mk.map(x => x[0]), mv = mk.map(x => x[1]);
  const c30 = suma(mv.slice(-30)), cprev = suma(mv.slice(-60, -30));
  return (CACHE.tienda = {
    T, tot,
    cambioVis: pct(suma(vals.slice(-30)), suma(vals.slice(-60, -30))),
    medVis: medidorDe(fechas, vals),
    c30, cambioMarca: pct(c30, cprev), medMarca: medidorDe(mf, mv), hastaMarca: mf[mf.length - 1],
  });
}

/* ─────────── testigos ─────────── */
const ICONOS = {
  seg: '<circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3.4 2.7-6 6-6s6 2.6 6 6"/><path d="M19 8.5v8m-3-3 3 3 3-3"/>',
  baja: '<path d="M3 7l6 6 4-4 8 8"/><path d="M21 11.5V17h-5.5"/>',
  lupa: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/><path d="M8 10.5h5"/>',
  bandera: '<path d="M5 21V4"/><path d="M5 4h12.5l-2.8 4.5 2.8 4.5H5"/>',
  bolsa: '<path d="M5 8h14l-1.2 12H6.2L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
};
function testigosDe(m) {
  if (m === "videos") return [{ tipo: "info", ico: "reloj", nombre: "Números de hoy", det: `actualizado ${fecha(D.actualizado)} ${D.actualizado.slice(11)}`, on: true }];
  if (m === "tienda") {
    const t = datosTienda(), c30 = t.tot("d30", 1), i30 = t.tot("d30", 2);
    return [
      { tipo: "ambar", ico: "baja", nombre: "Visitas desde redes bajando", on: t.cambioVis != null && t.cambioVis < -3, det: `${signo(t.cambioVis, 1)} % frente a los 30 días anteriores` },
      { tipo: "ambar", ico: "lupa", nombre: "Búsquedas de la marca bajando", on: t.cambioMarca != null && t.cambioMarca < -3, det: `${signo(t.cambioMarca, 1)} % frente a los 30 días anteriores` },
      { tipo: "verde", ico: "bandera", nombre: "Récord de búsquedas de la marca", on: !!t.medMarca.recordReciente, det: `${fmtMedia(t.medMarca.record)} clics al día de media` },
      { tipo: "verde", ico: "bolsa", nombre: "Venta desde redes (30 días)", on: c30 > 0, det: `${plural(c30, "compra", "compras")} · ${fmt(i30, 2)} €` },
      { tipo: "info", ico: "reloj", nombre: `Datos hasta ${fecha(t.T.hasta)}`, on: true, det: `búsquedas de la marca hasta ${fecha(t.hastaMarca)}` },
    ];
  }
  const R = resumen(m), mv = medidor(m, "vis"), tend = tendencia(m), T30 = D.tienda.resumen.d30 || {};
  const conVenta = (m === "global" ? REDES : [m]).filter(r => T30[r] && T30[r][1] > 0);
  const compras = conVenta.reduce((a, r) => a + T30[r][1], 0), importe = conVenta.reduce((a, r) => a + T30[r][2], 0);
  return [
    { tipo: "ambar", ico: "seg", nombre: "Seguidores a la baja", on: R.d30 != null && R.d30 < 0, det: `${signo(R.d30)} en 30 días` },
    { tipo: "ambar", ico: "baja", nombre: "Visualizaciones bajando", on: tend != null && tend < -3, det: `media de 30 días: ${signo(tend, 1)} % en un mes` },
    { tipo: "verde", ico: "bandera", nombre: "Récord de visualizaciones", on: !!mv.recordReciente, det: `${fmtMedia(mv.record)} al día de media` },
    { tipo: "verde", ico: "bolsa", nombre: "Venta desde redes (30 días)", on: compras > 0,
      det: `${plural(compras, "compra", "compras")} · ${fmt(importe, 2)} €${m === "global" ? " · " + conVenta.map(r => D.redes[r].nombre).join(", ") : ""}` },
    { tipo: "info", ico: "reloj", nombre: `Datos hasta ${fecha(mv.hasta || R.fecha_vis)}`, on: true, det: "las redes van con 1-3 días de retraso" },
  ];
}
function pintarTestigos(m) {
  const lista = testigosDe(m);
  $("#testigos").dataset.n = lista.length;
  $("#testigos").innerHTML = lista.map(t => `<li class="testigo${t.on ? " on" : ""}" data-tipo="${t.tipo}">
      <span class="t-luz"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[t.ico]}</svg></span>
      <span class="t-txt"><span class="t-nombre">${t.nombre}</span>${t.on && t.det ? `<span class="t-det">${t.det}</span>` : ""}</span>
      <span class="oculto">${t.tipo === "info" ? "" : t.on ? ": encendido" : ": apagado"}</span></li>`).join("");
}
/* Luces pequeñas en cada modo: ámbar si tiene algún aviso encendido, verde si tiene alguna buena noticia. */
function ledsModos() {
  MODOS.forEach(m => {
    const b = $(`#modos [data-modo="${m}"]`); if (!b) return;
    const on = m === "videos" ? [] : testigosDe(m).filter(t => t.on && t.tipo !== "info");
    const amb = on.filter(t => t.tipo === "ambar").length, ver = on.filter(t => t.tipo === "verde").length;
    b.querySelector(".m-leds").innerHTML = (amb ? '<i class="ambar"></i>' : "") + (ver ? '<i class="verde"></i>' : "");
    b.querySelector(".m-raya").style.setProperty("--c", m === "global" ? TDR : COLOR_RED[m] || "transparent");
    const txt = [amb ? plural(amb, "aviso", "avisos") : "", ver ? plural(ver, "buena noticia", "buenas noticias") : ""].filter(Boolean).join(" y ");
    b.setAttribute("aria-label", NOMBRE_MODO[m] + (txt ? `: ${txt}` : ""));
    b.title = txt ? `${NOMBRE_MODO[m]}: ${txt}` : NOMBRE_MODO[m];
  });
}

/* ─────────── relojes (arco SVG con aguja) ─────────── */
const GEO = { w: 300, h: 236, cx: 150, cy: 136, rP: 110, rR: 123, rM: 99, rMay: 87, rMen: 93, rE: 75, a0: 150, a1: 390, agIn: 84, agOut: 121 };
function pol(r, a) { const t = a * Math.PI / 180; return [GEO.cx + r * Math.cos(t), GEO.cy + r * Math.sin(t)]; }
function arco(r, a0, a1) {
  if (a1 - a0 < 0.05) return "";
  const [x0, y0] = pol(r, a0), [x1, y1] = pol(r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const angulo = (v, M) => GEO.a0 + (GEO.a1 - GEO.a0) * Math.max(0, Math.min(1, (v || 0) / M));

/* Fondo de escala: récord × 1,15 redondeado a una cifra limpia (o a la siguiente cifra redonda 1-2-5). */
function fondoEscala(record) {
  const obj = record > 0 ? record * 1.15 : 1;
  const p = 10 ** Math.floor(Math.log10(obj)), m = obj / p;
  const pasos = ajustes.escala === "redonda" ? [1, 2, 5, 10] : [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
  return +(pasos.find(v => v >= m - 1e-9) * p).toPrecision(10);
}
/* Marcas: la mayor separación 1-2-5 que deje al menos 4 números; si la escala pasa de 1.000, los números van «×100» o «×1.000». */
function marcasEscala(M) {
  const cands = []; for (let e = -3; e <= 9; e++) for (const b of [1, 2, 5]) cands.push(+(b * 10 ** e).toPrecision(6));
  const L = cands.filter(c => Math.floor(M / c + 1e-9) + 1 >= 4).pop() || M / 4;
  const lider = +L.toExponential().charAt(0);
  const menor = L / (lider === 2 ? 4 : 5);
  const mult = M >= 1000 ? 10 ** Math.floor(Math.log10(L)) : 1;
  return { L, menor, mult };
}
function montarReloj(fig) {
  const [ax, ay] = [GEO.cx, GEO.cy];
  fig.innerHTML = `
    <figcaption class="r-cab"><span class="r-tit"></span><span class="r-tit-sub"></span></figcaption>
    <div class="r-dial">
      <svg viewBox="0 0 ${GEO.w} ${GEO.h}" aria-hidden="true" focusable="false">
        <path class="r-pista" d="${arco(GEO.rP, GEO.a0, GEO.a1)}"/>
        <path class="r-relleno" d=""/>
        <path class="r-roja" d=""/>
        <g class="r-marcas"></g>
        <g class="r-aguja" transform="rotate(${GEO.a0} ${ax} ${ay})"><path d="M${ax + GEO.agIn} ${ay - 3.8}L${ax + GEO.agOut} ${ay - 1.3}L${ax + GEO.agOut} ${ay + 1.3}L${ax + GEO.agIn} ${ay + 3.8}Z"/></g>
      </svg>
      <div class="r-etqs" aria-hidden="true"></div>
      <div class="r-lectura"><span class="r-valor">–</span><span class="r-sub"></span></div>
      <span class="r-mult" aria-hidden="true"></span>
    </div>
    <p class="r-lectura2"></p>
    <p class="r-record"></p>
    <p class="oculto r-sr"></p>`;
  const q = s => fig.querySelector(s);
  return { fig, tit: q(".r-tit"), relleno: q(".r-relleno"), roja: q(".r-roja"), marcas: q(".r-marcas"), aguja: q(".r-aguja"),
           etqs: q(".r-etqs"), lectura: q(".r-lectura"), valor: q(".r-valor"), valor2: q(".r-lectura2"), sub: q(".r-sub"), titSub: q(".r-tit-sub"), mult: q(".r-mult"), record: q(".r-record"), sr: q(".r-sr"),
           ang: GEO.a0, raf: 0 };
}
function pintarReloj(rel, c) {
  // c: { titulo, valor, record, fechaRecord, sub: [texto bajo la cifra], unidad }
  const M = fondoEscala(c.record), { L, menor, mult } = marcasEscala(M);
  rel.tit.textContent = c.titulo;
  rel.roja.setAttribute("d", c.record > 0 ? arco(GEO.rR, angulo(c.record, M), GEO.a1) : "");
  const n = Math.floor(M / menor + 1e-6), vals = [];
  for (let i = 0; i <= n; i++) vals.push(+(i * menor).toPrecision(10));
  if (M - vals[vals.length - 1] > menor * 1e-6) vals.push(M);
  let svg = "", etq = "", k = 0;
  const muchas = Math.floor(M / L + 1e-9) + 1 > 6;           // con más de 6 números, en relojes estrechos se ve uno de cada dos
  vals.forEach(v => {
    const a = angulo(v, M), mayor = Math.abs(v / L - Math.round(v / L)) < 1e-6, roja = c.record > 0 && v >= c.record - 1e-9;
    const [x0, y0] = pol(GEO.rM, a), [x1, y1] = pol(mayor ? GEO.rMay : GEO.rMen, a);
    svg += `<line class="r-marca${mayor ? " mayor" : ""}${roja ? " roja" : ""}" x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}"/>`;
    if (mayor) {
      const [xe, ye] = pol(GEO.rE, a), t = v / mult;
      etq += `<span class="r-etq${muchas && k++ % 2 ? " impar" : ""}" style="left:${(xe / GEO.w * 100).toFixed(2)}%;top:${(ye / GEO.h * 100).toFixed(2)}%">${fmt(t, Math.abs(t % 1) > 1e-9 ? 1 : 0)}</span>`;
    }
  });
  rel.marcas.innerHTML = svg;
  rel.etqs.innerHTML = etq;
  rel.mult.textContent = mult > 1 ? "×" + fmt(mult) : "";
  rel.valor.textContent = fmtMedia(c.valor);
  rel.valor2.textContent = fmtMedia(c.valor);
  rel.sub.textContent = c.sub[0];
  rel.titSub.textContent = c.sub[0];
  rel.record.innerHTML = c.record != null
    ? `<span class="r-rec"><i aria-hidden="true"></i>Récord: <b>${fmtMedia(c.record)}</b> ${c.unidad}</span><span class="r-fecha">(${fecha(c.fechaRecord)})</span>`
    : "Récord: sin datos";
  rel.sr.textContent = `Escala de 0 a ${fmt(M)}; la zona roja empieza en el récord.`;
  moverAguja(rel, c.valor == null ? GEO.a0 : angulo(c.valor, M));
}
function moverAguja(rel, destino) {
  cancelAnimationFrame(rel.raf);
  const pinta = a => {
    rel.ang = a;
    rel.aguja.setAttribute("transform", `rotate(${a.toFixed(3)} ${GEO.cx} ${GEO.cy})`);
    rel.relleno.setAttribute("d", arco(GEO.rP, GEO.a0, a));
  };
  const desde = rel.ang;
  if (!animar() || Math.abs(destino - desde) < 0.01) { pinta(destino); return; }
  const t0 = performance.now(), dur = 1500;
  const paso = ahora => { const k = Math.min(1, (ahora - t0) / dur); pinta(desde + (destino - desde) * curva(k)); if (k < 1) rel.raf = requestAnimationFrame(paso); };
  rel.raf = requestAnimationFrame(paso);
}

/* ─────────── cuentakilómetros: dígitos que ruedan ─────────── */
function odometro(el, n) {
  if (n == null) { el.textContent = "–"; return; }
  const txt = fmt(n), anim = animar();
  let p = txt.replace(/\D/g, "").length, html = "";
  for (const ch of txt) {
    if (/\d/.test(ch)) {
      p--;                                                  // posición desde la derecha: las unidades dan más vueltas
      const vueltas = anim ? [3, 2, 1][p] ?? 0 : 0, total = (vueltas + 1) * 10, y = -((vueltas * 10 + +ch) / total) * 100;
      let tira = ""; for (let i = 0; i < total; i++) tira += `<span>${i % 10}</span>`;
      html += `<span class="odo-c${anim ? "" : " quieto"}"><span class="odo-tira${anim ? "" : " sin-anim"}" data-y="${y.toFixed(4)}" style="transform:translateY(${anim ? 0 : y.toFixed(4)}%)">${tira}</span></span>`;
    } else html += `<span class="odo-sep">${ch}</span>`;
  }
  el.innerHTML = `<span class="oculto">${txt}</span><span class="odo" aria-hidden="true">${html}</span>`;
  if (!anim) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$(".odo-tira", el).forEach(t => { t.style.transform = `translateY(${t.dataset.y}%)`; });
    setTimeout(() => $$(".odo-c", el).forEach(c => c.classList.add("quieto")), 2000);
  }));
}
function pintarInf(celdas) {
  const el = $("#p-inf");
  el.innerHTML = celdas.map((c, i) => `<div><dt><b>${c.k}</b>${c.et}</dt><dd>${c.palabra
    ? `<span class="p-palabra ${c.palabra.cls}">${c.palabra.texto}</span>`
    : `<span class="odo-caja" data-i="${i}"></span>`}<span class="p-sub">${c.sub}</span></dd></div>`).join("");
  celdas.forEach((c, i) => { if (!c.palabra) odometro($(`.odo-caja[data-i="${i}"]`, el), c.n); });
}

/* ─────────── el cuadro de cada modo ─────────── */
function cabeceraModo(m) {
  if (REDES.includes(m)) return `<p class="c-modo"><i style="--c:${COLOR_RED[m]}"></i><small>Modo</small> ${D.redes[m].nombre}</p>
    <p class="c-modo-s">${esc(D.redes[m].usuario)} · <a href="${esc(D.redes[m].url)}" target="_blank" rel="noopener">Ver el perfil ↗</a></p>`;
  if (m === "global") return `<p class="c-modo"><i style="--c:${TDR}"></i><small>Modo</small> Global</p><p class="c-modo-s">YouTube, Instagram, TikTok y Facebook juntos</p>`;
  return `<p class="c-modo"><small>Pantalla</small> Tienda</p><p class="c-modo-s">todoenrecambio.com · Analytics y Search Console</p>`;
}
function pintarCuadro(m, soloRelojes = false) {
  const esRed = m === "global" || REDES.includes(m);
  $("#p-medio").hidden = m === "videos";
  $("#p-videos").hidden = m !== "videos";
  $("#p-inf").hidden = m === "videos";
  if (esRed) {
    const mv = medidor(m, "vis"), ml = medidor(m, "likes");
    pintarReloj(relojes.a, { titulo: "Visualizaciones al día", valor: mv.valor, record: mv.record, fechaRecord: mv.fechaRecord, sub: ["media de 30 días", "media 30 d"], unidad: "al día" });
    pintarReloj(relojes.b, { titulo: "Me gusta al día", valor: ml.valor, record: ml.record, fechaRecord: ml.fechaRecord, sub: ["media de 30 días", "media 30 d"], unidad: "al día" });
  } else if (m === "tienda") {
    const t = datosTienda();
    pintarReloj(relojes.a, { titulo: "Visitas desde redes al día", valor: t.medVis.valor, record: t.medVis.record, fechaRecord: t.medVis.fechaRecord, sub: ["media de 30 días", "media 30 d"], unidad: "al día" });
    pintarReloj(relojes.b, { titulo: "Búsquedas de la marca al día", valor: t.medMarca.valor, record: t.medMarca.record, fechaRecord: t.medMarca.fechaRecord, sub: ["clics · media de 30 días", "clics · 30 d"], unidad: "al día" });
  }
  pintarComoLeer(m);
  if (soloRelojes) return;
  pintarTestigos(m);
  if (esRed) {
    const R = resumen(m), esG = m === "global", tend = tendencia(m);
    const r30 = R.seguidores != null && R.d30 != null ? pct(R.seguidores, R.seguidores - R.d30) : null;
    $("#centro").innerHTML = cabeceraModo(m) + `
      <p class="c-et">Seguidores${esG ? " · las cuatro redes" : ""}</p>
      <p class="c-num">${fmt(R.seguidores)}</p>
      <p class="c-var ${cls(R.d30)}">${flecha(R.d30)}${signo(R.d30)} en 30 días <span>(${signo(r30, 2)} %)</span></p>
      <ul class="c-mini" aria-label="Cambio de seguidores">${[["1 día", R.d1], ["7 días", R.d7], ["90 días", R.d90]]
        .map(([e, v]) => `<li><span>${e}</span><b class="${cls(v)}">${signo(v)}</b></li>`).join("")}</ul>
      <p class="c-fecha">Último dato de seguidores: ${fecha(R.fecha_seg)}</p>`;
    pintarInf([
      { k: "ODO", et: "Visualizaciones", n: R.vis_historico,
        sub: m === "youtube" ? "todo el canal, desde 2021" : esG ? "suma de las cuatro redes" : `medidas desde el ${fecha(R.desde_vis)}` },
      { k: "TRIP A", et: "Últimos 30 días", n: R.vis_30,
        sub: R.vis_cambio_30 == null ? "sin comparación" : `<span class="${cls(R.vis_cambio_30)}">${flecha(R.vis_cambio_30)}${signo(R.vis_cambio_30, 1)} %</span> frente a los 30 anteriores` },
      { k: "TRIP B", et: "Últimos 7 días", n: R.vis_7, sub: `visualizaciones hasta el ${fecha(R.fecha_vis)}` },
      { k: "Tendencia", et: "", palabra: { texto: palabraTend(tend), cls: cls(tend == null ? null : tend > 3 ? 1 : tend < -3 ? -1 : 0) },
        sub: tend == null ? "falta historia" : `media de 30 días: ${signo(tend, 1)} % en un mes` },
    ]);
  } else if (m === "tienda") {
    const t = datosTienda();
    const c = (per, i) => t.tot(per, i);
    $("#centro").innerHTML = cabeceraModo(m) + `
      <p class="c-et">Ventas atribuidas a redes</p>
      <p class="c-num c-dinero">${fmt(c("total", 2), 2)} €</p>
      <p class="c-var igual">${plural(c("total", 1), "compra", "compras")} desde el ${fecha(t.T.desde)}</p>
      <ul class="c-mini" aria-label="Ventas recientes">
        <li><span>30 días</span><b>${fmt(c("d30", 2), 2)} €</b><small>${plural(c("d30", 1), "compra", "compras")}</small></li>
        <li><span>90 días</span><b>${fmt(c("d90", 2), 2)} €</b><small>${plural(c("d90", 1), "compra", "compras")}</small></li>
      </ul>
      <p class="c-fecha">Google Analytics: último clic de la sesión</p>`;
    pintarInf([
      { k: "ODO", et: "Visitas desde redes", n: c("total", 0), sub: `desde el ${fecha(t.T.desde)}` },
      { k: "TRIP A", et: "Últimos 30 días", n: c("d30", 0),
        sub: t.cambioVis == null ? "sin comparación" : `<span class="${cls(t.cambioVis)}">${flecha(t.cambioVis)}${signo(t.cambioVis, 1)} %</span> frente a los 30 anteriores` },
      { k: "TRIP B", et: "Últimos 90 días", n: c("d90", 0), sub: `visitas hasta el ${fecha(t.T.hasta)}` },
      { k: "Marca", et: "Búsquedas · 30 días", n: t.c30,
        sub: `clics · ${t.cambioMarca == null ? "sin comparación" : `<span class="${cls(t.cambioMarca)}">${flecha(t.cambioMarca)}${signo(t.cambioMarca, 1)} %</span> frente a los 30 anteriores`}` },
    ]);
  } else {
    pintarResumenVideos();
  }
  pintarOrdenador(m);
}
function pintarResumenVideos() {
  const P = D.publicaciones || [];
  const ult = P.slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  const vista = P.slice().sort((a, b) => (b.vis || 0) - (a.vis || 0))[0];
  const pieza = (et, p) => !p ? `<div class="pv-caja"><p class="pv-et">${et}</p><p class="pv-meta">sin datos</p></div>` : `<div class="pv-caja">
      <p class="pv-et">${et}</p>
      <a class="pv-tit" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.titulo || "(sin título)")}</a>
      <p class="pv-meta"><span><i class="punto" data-red="${p.red}"></i>${D.redes[p.red] ? D.redes[p.red].nombre : esc(p.red)}${p.tipo ? " · " + p.tipo : ""}</span><span>${fecha(p.fecha)}</span></p>
      <p class="pv-meta"><span><b>${fmt(p.vis)}</b> ${p.vis === 1 ? "visualización" : "visualizaciones"}</span><span><b>${fmt(p.likes)}</b> me gusta</span><span><b>${fmt(p.comentarios)}</b> ${p.comentarios === 1 ? "comentario" : "comentarios"}</span></p></div>`;
  $("#p-videos").innerHTML = `<div class="pv-caja"><p class="c-modo"><small>Pantalla</small> Vídeos</p>
      <p class="pv-et">Publicaciones en la lista</p><p class="pv-num">${fmt(P.length)}</p>
      <ul class="pv-redes">${REDES.map(r => [r, P.filter(p => p.red === r).length]).filter(x => x[1])
        .map(([r, n]) => `<li><i class="punto" data-red="${r}"></i>${D.redes[r].nombre} <b>${fmt(n)}</b></li>`).join("")}</ul></div>`
    + pieza("La última publicada", ult) + pieza("La más vista de la lista", vista);
}

/* ─────────── ordenador de a bordo (el resto de cifras) ─────────── */
function pintarOrdenador(m) {
  const sec = $("#ordenador"), rej = $("#ord-rejilla");
  sec.hidden = m === "videos"; if (m === "videos") return;
  const ancha = $("#ord-ancha");
  if (m === "tienda") { rej.innerHTML = ""; ancha.innerHTML = tablaTiendaPorRed(); return; }
  const R = resumen(m), esG = m === "global";
  const celda = (et, v, s) => `<div class="o-celda"><p class="o-et">${et}</p><p class="o-v">${v}</p>${s ? `<p class="o-s">${s}</p>` : ""}</div>`;
  let html = "";
  if (!esG) {
    const s = serieDe(m), desde = new Date(Date.parse(D.actualizado.slice(0, 10)) - 30 * 864e5).toISOString().slice(0, 10);
    const ult = s.filter(x => x.t > desde);
    if (ult.some(x => x.gan != null)) {
      const gan = ult.reduce((a, x) => a + (x.gan || 0), 0), per = ult.reduce((a, x) => a + (x.per || 0), 0);
      html += celda("Seguidores ganados / perdidos · 30 días", `${fmt(gan)} / ${fmt(per)}`, `neto <b class="${cls(gan - per)}">${signo(gan - per)}</b>`);
    }
  }
  html += celda("Me gusta históricos", fmt(R.lk_total), R.desde_lk ? `medidos desde el ${fecha(R.desde_lk)}` : "sin datos");
  html += celda("Me gusta · últimos 30 días", fmt(R.lk_30), R.lk_cambio_30 == null ? "sin comparación con los 30 anteriores"
    : `<span class="${cls(R.lk_cambio_30)}">${flecha(R.lk_cambio_30)}${signo(R.lk_cambio_30, 1)} %</span> frente a los 30 anteriores`);
  html += celda("Me gusta · últimos 7 días", fmt(R.lk_7), `media diaria de 30 días: ${fmt(R.lk_media_30, 1)}`);
  html += celda("Me gusta por cada 100 visualizaciones", R.vis_30 ? fmt(R.lk_30 / R.vis_30 * 100, 2) : "–", "últimos 30 días");
  ancha.innerHTML = esG ? tablaPorRed() : "";
  html += esG ? "" : `<div class="o-celda"><p class="o-et">Perfil</p><p class="o-s">${esc(D.redes[m].usuario)}</p>
    <a class="o-enlace" href="${esc(D.redes[m].url)}" target="_blank" rel="noopener" aria-label="Ver el perfil de ${D.redes[m].nombre}">Ver el perfil ↗</a></div>`;
  rej.innerHTML = html;
}
function tablaPorRed() {
  return `<div class="o-celda o-ancha"><p class="o-et">Por red</p><div class="tabla-caja"><table class="tabla">
    <thead><tr><th scope="col">Red</th><th scope="col" class="n">Seguidores</th><th scope="col" class="n">30 días</th><th scope="col" class="n">Visualizaciones 30 d</th><th scope="col" class="n">Me gusta 30 d</th><th scope="col">Perfil</th></tr></thead><tbody>`
    + REDES.map(r => { const R = D.redes[r].resumen; return `<tr><td><span class="red-nombre"><i class="punto" data-red="${r}"></i>${D.redes[r].nombre}</span></td>
      <td class="n">${fmt(R.seguidores)}</td><td class="n ${cls(R.d30)}">${signo(R.d30)}</td><td class="n">${fmt(R.vis_30)}</td><td class="n">${fmt(R.lk_30)}</td>
      <td><a href="${esc(D.redes[r].url)}" target="_blank" rel="noopener">${esc(D.redes[r].usuario)} ↗</a></td></tr>`; }).join("")
    + `</tbody></table></div></div>`;
}
function tablaTiendaPorRed() {
  const T = D.tienda.resumen, v = (per, r, i) => T[per] && T[per][r] ? T[per][r][i] : 0;
  return `<div class="o-celda o-ancha"><p class="o-et">Por red · desde el ${fecha(T.desde)}</p><div class="tabla-caja"><table class="tabla">
    <thead><tr><th scope="col">Red</th><th scope="col" class="n">Visitas</th><th scope="col" class="n">30 días</th><th scope="col" class="n">90 días</th><th scope="col" class="n">Compras</th><th scope="col" class="n">Importe</th></tr></thead><tbody>`
    + REDES.map(r => `<tr><td><span class="red-nombre"><i class="punto" data-red="${r}"></i>${D.redes[r].nombre}</span></td>
      <td class="n">${fmt(v("total", r, 0))}</td><td class="n">${fmt(v("d30", r, 0))}</td><td class="n">${fmt(v("d90", r, 0))}</td>
      <td class="n">${fmt(v("total", r, 1))}</td><td class="n">${fmt(v("total", r, 2), 2)} €</td></tr>`).join("")
    + `</tbody></table></div></div>`;
}

/* ─────────── cómo leer el cuadro ─────────── */
function pintarComoLeer(m) {
  const escala = ajustes.escala === "record"
    ? "Va de 0 al récord más un 15 %, redondeado a una cifra limpia."
    : "Va de 0 a la siguiente cifra redonda (1, 2 o 5 con ceros) por encima del récord más un 15 %.";
  const x = " Si pone «×100» o «×1.000», multiplica los números de la escala por esa cifra.";
  const filas = m === "videos" ? [
    ["Pantalla Vídeos", "Lo último publicado en cada red (unas 60 piezas) con sus números de hoy. Filtra por red y ordena por fecha, visualizaciones o me gusta; el título lleva a la publicación."],
  ] : m === "tienda" ? [
    ["Visitas desde redes al día", "La aguja marca la media de 30 días de las visitas a todoenrecambio.com que llegan desde las cuatro redes (Google Analytics)."],
    ["Búsquedas de la marca al día", "La media de 30 días de los clics en Google de búsquedas con «todoenrecambio» (Search Console)."],
    ["Zona roja y escala", "La zona roja empieza en el récord de esa media; la aguja solo la toca si la media de ahora es la más alta medida. " + escala + x],
    ["Ventas", "En el centro, el importe de las compras que Google Analytics atribuye a una red social (último clic de la sesión), y lo de 30 y 90 días."],
    ["ODO, TRIP A y TRIP B", "Visitas a la tienda desde redes: desde que hay datos, en los últimos 30 días (con su cambio frente a los 30 anteriores) y en los últimos 90. «Marca»: clics de búsquedas de la marca en 30 días."],
    ["Testigos", "Ámbar: visitas desde redes o búsquedas de la marca más de un 3 % por debajo de los 30 días anteriores. Verde: récord de búsquedas de la marca en los últimos 7 días, o alguna compra desde redes en 30 días. El de información dice hasta qué día llegan los datos. Apagados se ven en gris."],
  ] : [
    ["Modos", "Arriba eliges qué mide el cuadro: las cuatro redes juntas (Global) o una sola; Tienda y Vídeos son pantallas aparte. Una luz ámbar en un modo avisa de que tiene un aviso encendido; una verde, una buena noticia."],
    ["Visualizaciones al día", "La aguja marca la media de visualizaciones al día de los últimos 30 días con dato. Debajo, el récord de esa media y el día en que se alcanzó."],
    ["Zona roja", "Empieza en el récord de la media de 30 días: la aguja solo la toca cuando la media de ahora es la más alta que se ha medido."],
    ["Escala", escala + x],
    ["Me gusta al día", "El mismo reloj para los me gusta: media de 30 días, con su récord y su zona roja."],
    ["Seguidores", "En el centro, los del último día medido y cuánto han cambiado en 30 días; debajo, en 1, 7 y 90 días. Verde si suben, ámbar si bajan."],
    ["ODO", "El cuentakilómetros: todas las visualizaciones medidas (YouTube desde 2021; Instagram, TikTok y Facebook desde que Metricool guarda datos)."],
    ["TRIP A y TRIP B", "Los parciales: visualizaciones de los últimos 30 días, con su cambio frente a los 30 anteriores, y de los últimos 7 días."],
    ["Tendencia", "La media de 30 días de hoy frente a la de hace 30 días: por encima de +3 % es «Creciendo», por debajo de −3 % «Bajando» y en medio «Estable»."],
    ["Testigos", "Se encienden solo si se cumple su condición con los datos del modo. Ámbar: seguidores a la baja en 30 días, o tendencia de las visualizaciones por debajo de −3 %. Verde: la media de 30 días ha marcado récord en los últimos 7 días con dato, o hay alguna compra desde la red en los últimos 30 días. El de información dice hasta qué día llegan los datos (las redes van con 1-3 días de retraso). Apagados se ven en gris."],
  ];
  $("#como-leer-txt").innerHTML = filas.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("");
}

/* ─────────── gráficas (TradingView Lightweight Charts) ─────────── */
function tema() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  return { fondo: v("--pantalla"), texto: v("--tinta-2"), tinta: v("--tinta"), suave: v("--tinta-3"), rejilla: v("--rejilla"), borde: v("--linea"),
           verde: v("--verde"), ambar: v("--ambar"), fuente: v("--f-ins") || "sans-serif" };
}
const colorSerie = (k, T) => k === "global" ? T.tinta : COLOR_RED[k];
function crear(id, extra = {}) {
  const T = tema(), el = document.getElementById(id); el.innerHTML = "";
  const base = {
    autoSize: true,
    layout: { background: { type: "solid", color: T.fondo }, textColor: T.texto, fontFamily: T.fuente, fontSize: 12, attributionLogo: false },
    grid: { vertLines: { color: T.rejilla }, horzLines: { color: T.rejilla } },
    rightPriceScale: { borderColor: T.borde }, timeScale: { borderColor: T.borde, rightOffset: 3 },
    crosshair: { mode: LC.CrosshairMode.Normal,
      vertLine: { color: T.suave, width: 1, style: LC.LineStyle.Dashed, labelBackgroundColor: T.tinta },
      horzLine: { color: T.suave, width: 1, style: LC.LineStyle.Dashed, labelBackgroundColor: T.tinta } },
    localization: { locale: "es-ES", dateFormat: "dd MMM yyyy",
      priceFormatter: p => fmt(p, Math.abs(p) < 10 && p % 1 ? 1 : 0),
      percentageFormatter: p => fmt(p, Math.abs(p) < 10 ? 2 : 1) + " %" },
  };
  for (const k in extra) base[k] = Object.assign({}, base[k], extra[k]);
  const ch = LC.createChart(el, base);
  graficas[id] = ch;
  return ch;
}
function quitar(id) { if (graficas[id]) { graficas[id].remove(); delete graficas[id]; } }
const TRES = ["g-seg", "g-vis", "g-acum", "g-lk"];
const GRAF = { seg: TRES, vis: TRES, acum: TRES, lk: TRES, comp: ["g-comp"], tienda: ["g-tienda"], marca: ["g-marca"] };
const grupoDe = g => GRAF[g] === TRES ? "tres" : g;
function rango(graf, r) { rangos[grupoDe(graf)] = r; aplicarRango(graf); }
function aplicarRango(graf, soloId) {
  const grupo = grupoDe(graf), r = rangos[grupo];
  $$(".seg.rango").forEach(g => { if (grupoDe(g.dataset.graf) === grupo) g.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.r === r))); });
  if (!r) return;
  const hasta = new Date(D.actualizado.slice(0, 10) + "T00:00:00Z");
  GRAF[graf].forEach(id => {
    const ch = graficas[id]; if (!ch || (soloId && id !== soloId)) return;
    if (r === "Todo") { ch.timeScale().fitContent(); return; }
    const desde = new Date(hasta); desde.setUTCMonth(desde.getUTCMonth() - { "1M": 1, "3M": 3, "6M": 6, "1A": 12, "2A": 24 }[r]);
    try { ch.timeScale().setVisibleRange({ from: desde.toISOString().slice(0, 10), to: hasta.toISOString().slice(0, 10) }); } catch (e) { /* sin datos en ese tramo */ }
  });
}
/* Se mueven juntas las gráficas de un punto por día (visualizaciones, me gusta y el acumulado en área o velas de día). */
const SINC = ["g-vis", "g-acum", "g-lk"];
const diaria = id => id !== "g-acum" || modoAcum === "area" || perAcum === "dia";
function sincronizar() {
  SINC.forEach(a => {
    const ch = graficas[a]; if (!ch || suscritas.has(ch)) return; suscritas.add(ch);
    ch.timeScale().subscribeVisibleTimeRangeChange(r => {
      if (sincronizando || !r || !diaria(a)) return; sincronizando = true;
      SINC.forEach(b => { if (b !== a && graficas[b] && diaria(b)) try { graficas[b].timeScale().setVisibleRange(r); } catch (e) { /* fuera de rango */ } });
      sincronizando = false;
    });
  });
}
function ultimoConValor(datos) { for (let i = datos.length - 1; i >= 0; i--) { const d = datos[i]; if (d && (d.value != null || d.close != null)) return d; } return null; }
/* Leyenda que sigue al cursor. filas: [{nombre, color, serie, datos, fmt?, marca?}] o [{serie, datos, html(d)}]. */
function leyenda(id, ch, filas, etiqueta = fecha) {
  const el = document.getElementById(id);
  const texto = t => typeof t === "string" ? t : `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
  const pinta = param => {
    let t = null;
    const partes = filas.map(f => {
      let d = null;
      if (param && param.time !== undefined && param.seriesData) { d = param.seriesData.get(f.serie) || null; t = param.time; }
      else { const u = ultimoConValor(f.datos); if (u) { d = u; if (t == null) t = u.time; } }
      if (f.html) return f.html(d);
      const v = d ? (d.close ?? d.value) : null;
      return `<span><i class="l-mu ${f.marca || ""}" style="--c:${f.color}"></i>${f.nombre} <b>${v == null ? "–" : (f.fmt || fmt)(v)}</b></span>`;
    });
    el.innerHTML = `<span class="l-t">${t != null ? etiqueta(texto(t)) : ""}</span>` + partes.join("");
  };
  ch.subscribeCrosshairMove(pinta); pinta(null);
}
const filaVela = (serie, datos) => ({ serie, datos, html: d => d && d.close != null
  ? `<span>Cierre <b>${fmt(d.close)}</b></span><span>Cambio del periodo <b class="${cls(d.close - d.open)}">${signo(d.close - d.open)}</b></span>`
  : "<span>Cierre <b>–</b></span>" });
const UNA = { dia: "un día", semana: "una semana", mes: "un mes" };
const DEL = { dia: "del día", semana: "de la semana", mes: "del mes" };
const opcVelas = T => ({ upColor: T.verde, downColor: T.ambar, borderVisible: false, wickUpColor: T.verde, wickDownColor: T.ambar });

function pintarRed(k) {
  graficaSeg(k); graficaVis(k); graficaAcum(k); graficaLk(k);
  const esG = k === "global";
  $("#p-comp").hidden = !esG;
  if (esG) graficaComp();
  aplicarRango("seg");
  sincronizar();
}
function graficaSeg(k) {
  quitar("g-seg");
  const esG = k === "global", R = resumen(k), T = tema(), color = colorSerie(k, T), pf = { type: "price", precision: 0, minMove: 1 };
  const puntos = serieDe(k).filter(x => x.seg != null).map(x => ({ time: x.t, value: x.seg }));
  const ch = crear("g-seg");
  if (modoSeg === "velas") {
    const datos = velas(puntos, perSeg), s = ch.addCandlestickSeries(Object.assign(opcVelas(T), { priceFormat: pf }));
    s.setData(datos);
    leyenda("ley-seg", ch, [filaVela(s, datos)], t => etiquetaPeriodo(t, perSeg));
  } else {
    const s = ch.addAreaSeries({ lineColor: color, topColor: color + "40", bottomColor: color + "05", lineWidth: 2, priceFormat: pf });
    s.setData(puntos);
    leyenda("ley-seg", ch, [{ nombre: "Seguidores", color, serie: s, datos: puntos }]);
  }
  $("#per-seg-caja").hidden = modoSeg !== "velas";
  $("#t-seg").textContent = esG ? "Seguidores · suma de las cuatro redes" : `Seguidores en ${D.redes[k].nombre}`;
  $("#s-seg").textContent = modoSeg === "velas"
    ? `cada vela es ${UNA[perSeg]}: abre con el cierre ${DEL[perSeg]} anterior; verde si sube y ámbar si baja`
    : "seguidores de cada día medido";
  $("#n-seg").textContent = esG
    ? `La suma empieza el ${fecha(R.desde_seg)}, el primer día con seguidores medidos en las cuatro redes.`
    : k === "youtube" ? "Desde que se abrió el canal: los seguidores de cada día salen de los suscriptores ganados y perdidos que da YouTube Analytics."
    : `Metricool guarda los seguidores de ${D.redes[k].nombre} desde el ${fecha(R.desde_seg)}.`;
}
/* Barras diarias (verde si el día supera su media de 30 días, ámbar si no) + medias de 7 y 30 días + récord de la media de 30. */
function barrasConMedias(ch, T, s, vals, med, dec) {
  const m7 = mediaMovil(vals, 7, 5, true), m30 = med.m30;
  ch.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: 0.02 } });   // sin cifras negativas bajo las barras
  const b = ch.addHistogramSeries({ priceFormat: { type: "volume" }, priceLineVisible: false });
  b.setData(s.map((x, i) => vals[i] == null ? { time: x.t }
    : { time: x.t, value: vals[i], color: m30[i] == null ? T.suave + "80" : vals[i] >= m30[i] ? T.verde + "cc" : T.ambar + "b3" }));
  const l7 = ch.addLineSeries({ color: T.tinta, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  l7.setData(s.map((x, i) => m7[i] == null ? { time: x.t } : { time: x.t, value: m7[i] }));
  const l30 = ch.addLineSeries({ color: T.texto, lineWidth: 2, lineStyle: LC.LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
  l30.setData(s.map((x, i) => m30[i] == null ? { time: x.t } : { time: x.t, value: m30[i] }));
  if (med.record != null) l30.createPriceLine({ price: med.record, color: TDR, lineWidth: 1, lineStyle: LC.LineStyle.Solid, axisLabelVisible: true, title: "Récord" });
  return [{ nombre: "Día", color: T.verde, marca: "caja", serie: b, datos: b.data() },
          { nombre: "Media 7 d", color: T.tinta, serie: l7, datos: l7.data(), fmt: v => fmt(v, dec) },
          { nombre: "Media 30 d", color: T.texto, marca: "rayada", serie: l30, datos: l30.data(), fmt: v => fmt(v, dec) }];
}
function graficaVis(k) {
  quitar("g-vis");
  const T = tema(), med = medidor(k, "vis"), s = med.serie;
  const ch = crear("g-vis");
  leyenda("ley-vis", ch, barrasConMedias(ch, T, s, s.map(x => x.vis), med, 0));
}
function graficaAcum(k) {
  quitar("g-acum");
  const R = resumen(k), T = tema(), color = colorSerie(k, T), esG = k === "global";
  const sv = medidor(k, "vis").serie;                       // desde desde_vis y con recortarCola
  let acum = 0; const puntos = [];
  sv.forEach(x => { if (x.vis != null) { acum += x.vis; puntos.push({ time: x.t, value: acum }); } });
  const ch = crear("g-acum");
  if (modoAcum === "velas") {
    const datos = velas(puntos, perAcum), s = ch.addCandlestickSeries(Object.assign(opcVelas(T), { priceFormat: { type: "volume" } }));
    s.setData(datos);
    leyenda("ley-acum", ch, [filaVela(s, datos)], t => etiquetaPeriodo(t, perAcum));
  } else {
    const s = ch.addAreaSeries({ lineColor: color, topColor: color + "44", bottomColor: color + "03", lineWidth: 2, priceFormat: { type: "volume" } });
    s.setData(puntos);
    leyenda("ley-acum", ch, [{ nombre: "Acumulado", color, serie: s, datos: puntos }]);
  }
  $("#per-acum-caja").hidden = modoAcum !== "velas";
  const desde = puntos.length ? fecha(puntos[0].time) : "–";
  $("#sub-acum").textContent = (esG ? `suma de las cuatro redes desde el ${desde} (cada red entra cuando hay datos)`
    : `desde el ${desde}${k === "youtube" ? ", el primer día del canal" : " (lo que guarda Metricool)"}`)
    + (modoAcum === "velas" ? ` · cada vela es ${UNA[perAcum]}: el cuerpo es lo que se ha sumado en ese periodo` : "");
  $("#n-acum").textContent = R.vis_historico != null && puntos.length && Math.abs(acum - R.vis_historico) > 0.5
    ? `La suma de los días medidos llega a ${fmt(acum)}; el ODO (${fmt(R.vis_historico)}) usa el contador total de YouTube, por eso no coinciden del todo.`
    : "";
}
const NOTA_LK = {
  youtube: "YouTube: me gusta recibidos cada día por todos los vídeos del canal (YouTube Analytics).",
  tiktok: "TikTok: me gusta recibidos cada día por los vídeos de la cuenta (Metricool).",
  instagram: "Instagram: me gusta de cada publicación y reel, contados el día que se publicó (Metricool no los da por día recibido).",
  facebook: "Facebook: reacciones a las publicaciones de la página y me gusta de los reels (Metricool).",
  global: "Suma de las cuatro redes. YouTube y TikTok cuentan los me gusta del día; Instagram, los de lo publicado ese día; Facebook, reacciones y me gusta de reels.",
};
function graficaLk(k) {
  quitar("g-lk");
  const T = tema(), med = medidor(k, "likes"), s = med.serie, vals = s.map(x => x.likes);
  const ch = crear("g-lk");
  if (modoLk === "dia") {
    leyenda("ley-lk", ch, barrasConMedias(ch, T, s, vals, med, 1));
    $("#sub-lk").textContent = "barras: verde si el día supera su media de 30 días, ámbar si no · líneas: media de 7 y de 30 días · roja: récord de la media de 30 días";
  } else {
    const color = colorSerie(k, T); let a = 0; const ac = [];
    s.forEach(x => { if (x.likes != null) { a += x.likes; ac.push({ time: x.t, value: a }); } });
    const ar = ch.addAreaSeries({ lineColor: color, topColor: color + "44", bottomColor: color + "03", lineWidth: 2, priceFormat: { type: "volume" } });
    ar.setData(ac);
    leyenda("ley-lk", ch, [{ nombre: "Acumulados", color, serie: ar, datos: ac }]);
    $("#sub-lk").textContent = "suma de los me gusta de cada día medido";
  }
  $("#n-lk").textContent = (NOTA_LK[k] || "") + (s.length ? ` Desde el ${fecha(s[0].t)}.` : " Todavía no hay datos.");
}
function graficaComp() {
  quitar("g-comp");
  const T = tema(), ch = crear("g-comp", { rightPriceScale: { borderColor: T.borde, mode: LC.PriceScaleMode.Percentage } });
  const filas = REDES.map(r => {
    let datos;
    if (modoComp === "seg") datos = serieDe(r).filter(x => x.seg != null).map(x => ({ time: x.t, value: x.seg }));
    else { const med = medidor(r, modoComp === "likes" ? "likes" : "vis"); datos = med.serie.map((x, i) => med.m30[i] == null ? { time: x.t } : { time: x.t, value: Math.max(med.m30[i], 0.01) }); }
    const l = ch.addLineSeries({ color: COLOR_RED[r], lineWidth: 2, priceLineVisible: false });
    l.setData(datos);
    return { nombre: D.redes[r].nombre, color: COLOR_RED[r], serie: l, datos, fmt: v => fmt(v, modoComp === "seg" ? 0 : 1) };
  });
  leyenda("ley-comp", ch, filas);
  aplicarRango("comp");
}

/* ─────────── pantalla Tienda ─────────── */
function graficasTienda() {
  quitar("g-tienda"); quitar("g-marca");
  const T = tema();
  const g = crear("g-tienda");
  const filas = REDES.map(r => {
    const sem = new Map();
    D.tienda.serie.forEach(([f, x]) => { const k = lunes(f); sem.set(k, (sem.get(k) || 0) + (x[r] ? x[r][0] : 0)); });
    const datos = [...sem].sort((a, b) => a[0].localeCompare(b[0])).map(([t, v]) => ({ time: t, value: v }));
    const l = g.addLineSeries({ color: COLOR_RED[r], lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l.setData(datos);
    return { nombre: D.redes[r].nombre, color: COLOR_RED[r], serie: l, datos };
  });
  leyenda("ley-tienda", g, filas, t => `semana del ${fecha(t)}`);
  const gm = crear("g-marca"), mk = D.marca || [], vals = mk.map(x => x[1]), m7 = mediaMovil(vals, 7);
  gm.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: 0.02 } });
  const b = gm.addHistogramSeries({ color: TDR, priceFormat: { type: "volume" }, priceLineVisible: false });
  b.setData(mk.map(x => ({ time: x[0], value: x[1] })));
  const l = gm.addLineSeries({ color: T.tinta, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  l.setData(mk.map((x, i) => ({ time: x[0], value: m7[i] })));
  leyenda("ley-marca", gm, [{ nombre: "Clics", color: TDR, marca: "caja", serie: b, datos: b.data() },
                           { nombre: "Media 7 d", color: T.tinta, serie: l, datos: l.data(), fmt: v => fmt(v, 1) }]);
  aplicarRango("tienda"); aplicarRango("marca");
}
function tablaVentas() {
  const ventas = [];
  D.tienda.serie.forEach(([f, x]) => REDES.forEach(r => { if (x[r] && x[r][1]) ventas.push([f, r, x[r][1], x[r][2]]); }));
  ventas.sort((a, b) => b[0].localeCompare(a[0]));
  $("#tabla-ventas").innerHTML = ventas.length ? `<div class="ventas-caja"><table class="tabla"><thead><tr><th scope="col">Día</th><th scope="col">Red</th><th scope="col" class="n">Compras</th><th scope="col" class="n">Importe</th></tr></thead><tbody>`
    + ventas.map(v => `<tr><td class="ins">${fecha(v[0])}</td><td><span class="chip"><i class="punto" data-red="${v[1]}"></i>${D.redes[v[1]].nombre}</span></td><td class="n">${fmt(v[2])}</td><td class="n">${fmt(v[3], 2)} €</td></tr>`).join("")
    + `</tbody></table></div>`
    : `<p class="nota">Todavía no hay compras atribuidas a redes.</p>`;
}

/* ─────────── pantalla Vídeos ─────────── */
const ORDEN_TXT = { fecha: "de la más reciente a la más antigua", vis: "de la más vista a la menos vista", likes: "de la de más me gusta a la de menos" };
function tablaVideos() {
  let L = (D.publicaciones || []).filter(p => filtroRed === "todas" || p.red === filtroRed);
  L = L.slice().sort((a, b) => orden === "vis" ? (b.vis || 0) - (a.vis || 0) : orden === "likes" ? (b.likes || 0) - (a.likes || 0) : b.fecha.localeCompare(a.fecha));
  $("#tabla-videos tbody").innerHTML = L.map(p => `<tr>
    <td class="f">${fecha(p.fecha)}</td>
    <td class="r"><span class="chip"><i class="punto" data-red="${p.red}"></i>${D.redes[p.red] ? D.redes[p.red].nombre : esc(p.red)}</span>${p.tipo ? `<span class="tipo">${p.tipo}</span>` : ""}</td>
    <td class="t"><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.titulo || "(sin título)")}</a></td>
    <td class="n v" data-et="Visualizaciones">${fmt(p.vis)}</td><td class="n l" data-et="Me gusta">${fmt(p.likes)}</td><td class="n c" data-et="Comentarios">${fmt(p.comentarios)}</td></tr>`).join("")
    || `<tr><td colspan="6">No hay publicaciones de esta red en la lista.</td></tr>`;
  $("#cuenta-lista").textContent = `${plural(L.length, "publicación", "publicaciones")}${filtroRed === "todas" ? "" : " de " + D.redes[filtroRed].nombre}, ${ORDEN_TXT[orden]}.`;
}

/* ─────────── panel de Ajustes ─────────── */
function montarAjustes() {
  const btn = $("#btn-ajustes"), panel = $("#ajustes"), velo = $("#velo"), estado = $("#aj-estado");
  const marcarRadios = () => { for (const k in ajustes) { const r = panel.querySelector(`input[name="${k}"][value="${ajustes[k]}"]`); if (r) r.checked = true; } };
  marcarRadios();
  let cierre = 0;
  const abrir = () => {
    clearTimeout(cierre); estado.textContent = "";
    panel.hidden = false; velo.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { panel.classList.add("abierto"); velo.classList.add("abierto"); }));
    btn.setAttribute("aria-expanded", "true");
    (panel.querySelector("input:checked") || $("#aj-cerrar")).focus({ preventScroll: true });
  };
  const cerrar = () => {
    if (panel.hidden) return;
    panel.classList.remove("abierto"); velo.classList.remove("abierto");
    btn.setAttribute("aria-expanded", "false");
    cierre = setTimeout(() => { panel.hidden = true; velo.hidden = true; }, reducido.matches ? 0 : 400);
    btn.focus({ preventScroll: true });
  };
  btn.addEventListener("click", () => panel.hidden ? abrir() : cerrar());
  $("#aj-cerrar").addEventListener("click", cerrar);
  velo.addEventListener("click", cerrar);
  document.addEventListener("keydown", e => {
    if (panel.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); cerrar(); return; }
    if (e.key === "Tab") {                                  // el foco no sale del panel mientras está abierto
      const f = $$("button, input:checked, input[type=text], a[href]", panel).filter(x => !x.disabled && x.offsetParent !== null);
      const radios = $$("input[type=radio]", panel), primero = f[0], ultimo = f[f.length - 1];
      if (!f.includes(document.activeElement) && !radios.includes(document.activeElement)) { e.preventDefault(); primero.focus(); }
      else if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    }
  });
  panel.addEventListener("change", e => { const i = e.target; if (i.type === "radio") cambiarAjuste(i.name, i.value); });
  $("#aj-copiar").addEventListener("click", async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); estado.textContent = "Enlace copiado."; }
    catch (err) {
      estado.innerHTML = `Copia este enlace:<input type="text" readonly value="${esc(url)}" aria-label="Enlace de esta combinación">`;
      const i = estado.querySelector("input"); i.focus(); i.select();
      try { if (document.execCommand("copy")) estado.firstChild.textContent = "Enlace copiado:"; } catch (e2) { /* queda el campo para copiarlo a mano */ }
    }
  });
  $("#aj-restablecer").addEventListener("click", () => {
    const antes = Object.assign({}, ajustes);
    Object.assign(ajustes, AJ_DEF);
    try { localStorage.removeItem(AJ_CLAVE); } catch (e) { /* nada */ }
    guardarAjustes(); marcarRadios();
    efectos(antes);
    estado.textContent = "Ajustes restablecidos.";
  });
}
function cambiarAjuste(k, v) {
  if (!AJ_OPC[k] || !AJ_OPC[k].includes(v) || ajustes[k] === v) return;
  const antes = Object.assign({}, ajustes);
  ajustes[k] = v; guardarAjustes();
  efectos(antes);
}
function efectos(antes) {
  if (!D) return;
  const cambio = k => antes[k] !== ajustes[k];
  if (cambio("escala")) pintarCuadro(modo, true);
  if (cambio("letra")) {
    const f = getComputedStyle(document.documentElement).getPropertyValue("--f-ins").split(",")[0].trim();
    Promise.race([Promise.all([document.fonts.load(`600 16px ${f}`), document.fonts.load(`500 12px ${f}`)]), new Promise(r => setTimeout(r, 1500))])
      .catch(() => {}).then(repintarGraficas);
  } else if (cambio("paleta")) repintarGraficas();
}
function repintarGraficas() {
  if (!D || !LC) return;
  Object.values(graficas).forEach(g => g && g.remove()); graficas = {};
  if (modo === "tienda") graficasTienda();
  else if (modo !== "videos") pintarRed(modo);
}
