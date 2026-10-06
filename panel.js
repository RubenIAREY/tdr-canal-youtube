/* Panel de redes de TDR · gráficas al estilo TradingView (lightweight-charts 4.2, de TradingView, código abierto).
   Lee datos_redes.json, que regenera PANEL-REDES/construir_panel.py a las 9:00 y a las 17:00. */
"use strict";
const LC = window.LightweightCharts;
const C = { verde: "#26a69a", rojo: "#ef5350", texto: "#d1d4dc", suave: "#8b93a6", borde: "#232a38", panel: "#131722", rejilla: "#1a2030",
            amarillo: "#f5c451", azul: "#5b9cff", blanco: "#f4f5f7", tdr: "#d71119" };
const REDES = ["youtube", "instagram", "tiktok", "facebook"];
const ICO = { youtube: "▶", instagram: "IG", tiktok: "TT", facebook: "f", global: "TDR" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmt = (n, d = 0) => n == null || isNaN(n) ? "–" : Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
const signo = (n, d = 0) => n == null || isNaN(n) ? "–" : (n > 0 ? "+" : "") + fmt(n, d);
const cls = n => n == null || n === 0 ? "igual" : n > 0 ? "sube" : "baja";
const fecha = s => { if (!s) return "–"; const [y, m, d] = s.slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]} ${y}`; };
const pct = (a, b) => b ? (a - b) / b * 100 : null;
const flecha = n => n == null ? "" : n > 0 ? "▲ " : n < 0 ? "▼ " : "■ ";

let D, vista = "global", modoSeg = "velas", modoComp = "seg", filtroRed = "todas", orden = "fecha";
let graficas = {}, sincronizando = false;

fetch("datos_redes.json?" + Date.now()).then(r => r.json()).then(d => { D = d; arrancar(); })
  .catch(e => { document.getElementById("main").innerHTML = `<p class="nota">No se han podido cargar los datos (${e}).</p>`; });

function arrancar() {
  document.getElementById("actualizado").textContent = fecha(D.actualizado) + " " + D.actualizado.slice(11);
  ticker();
  document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => ir(b.dataset.vista));
  document.querySelectorAll("#modo-seg button").forEach(b => b.onclick = () => { modoSeg = b.dataset.m; marcar("#modo-seg", b); pintarRed(vista, true); });
  document.querySelectorAll("#modo-comp button").forEach(b => b.onclick = () => { modoComp = b.dataset.m; marcar("#modo-comp", b); comparativa(); });
  document.querySelectorAll("#filtros button[data-f]").forEach(b => b.onclick = () => { filtroRed = b.dataset.f; marcar("#filtros", b, "[data-f]"); tablaVideos(); });
  document.querySelectorAll("#filtros button[data-o]").forEach(b => b.onclick = () => { orden = b.dataset.o; marcar("#filtros", b, "[data-o]"); tablaVideos(); });
  document.querySelectorAll(".grupo.rango").forEach(g => {
    g.innerHTML = ["1M", "3M", "6M", "1A", "2A", "Todo"].map(r => `<button data-r="${r}">${r}</button>`).join("");
    g.querySelectorAll("button").forEach(b => b.onclick = () => { marcar(g, b); rango(g.dataset.graf, b.dataset.r); });
  });
  const h = location.hash.slice(1);
  ir(["global", ...REDES, "impacto", "videos"].includes(h) ? h : "global");
}
function marcar(sel, b, filtro = "") {
  const g = typeof sel === "string" ? document.querySelector(sel) : sel;
  g.querySelectorAll("button" + filtro).forEach(x => x.classList.toggle("on", x === b));
}

/* ─────────── barra de cotizaciones ─────────── */
function ticker() {
  const t = document.getElementById("ticker");
  const item = (k, nombre, color, r) => {
    const p = pct(r.seguidores, r.seguidores - (r.d30 || 0));
    return `<div class="tk" data-k="${k}"><span class="p" style="background:${color}"></span><span class="n">${nombre}</span>
      <span class="v">${fmt(r.seguidores)}</span><span class="c ${cls(r.d30)}">${flecha(r.d30)}${signo(r.d30)} (${signo(p, 2)} %) 30 d</span></div>`;
  };
  t.innerHTML = item("global", "TDR · TOTAL", C.tdr, D.global_) + REDES.map(r => item(r, D.redes[r].nombre.toUpperCase(), D.redes[r].color, D.redes[r].resumen)).join("");
  t.querySelectorAll(".tk").forEach(e => e.onclick = () => ir(e.dataset.k));
}

function ir(v) {
  vista = v; history.replaceState(null, "", "#" + v);
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.vista === v));
  document.querySelectorAll("#ticker .tk").forEach(b => b.classList.toggle("on", b.dataset.k === v));
  Object.values(graficas).forEach(g => g && g.remove()); graficas = {};
  document.getElementById("v-red").classList.toggle("oculta", !(v === "global" || REDES.includes(v)));
  document.getElementById("v-impacto").classList.toggle("oculta", v !== "impacto");
  document.getElementById("v-videos").classList.toggle("oculta", v !== "videos");
  if (v === "impacto") impacto(); else if (v === "videos") tablaVideos(); else pintarRed(v);
  window.scrollTo({ top: 0 });
}

/* ─────────── utilidades de series ─────────── */
function serieDe(k) {
  if (k === "global") return D.global_serie.map(x => ({ t: x[0], seg: x[1], vis: x[2] }));
  return D.series[k].map(x => ({ t: x[0], seg: x[1], vis: x[2], gan: x[3], per: x[4] }));
}
function recortarCola(s, campo) {                     // quita los últimos días sin dato (las redes van con 1-3 días de retraso)
  let i = s.length; while (i > 0 && (s[i - 1][campo] == null)) i--; return s.slice(0, i);
}
function media(vals, n) {
  const out = []; let suma = 0; const q = [];
  vals.forEach(v => { q.push(v); suma += v; if (q.length > n) suma -= q.shift(); out.push(suma / q.length); });
  return out;
}
function lunes(t) { const d = new Date(t + "T00:00:00Z"); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); }
function velasSemanales(p) {
  const sem = new Map(); p.forEach(x => { const k = lunes(x.time); if (!sem.has(k)) sem.set(k, []); sem.get(k).push(x.value); });
  let prev = null; const out = [];
  for (const [k, a] of sem) { const open = prev ?? a[0], close = a[a.length - 1];
    out.push({ time: k, open, close, high: Math.max(open, ...a), low: Math.min(open, ...a) }); prev = close; }
  return out;
}
function crear(id, extra = {}) {
  const el = document.getElementById(id); el.innerHTML = "";
  const ch = LC.createChart(el, Object.assign({
    autoSize: true,
    layout: { background: { type: "solid", color: C.panel }, textColor: C.suave, fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, attributionLogo: false },
    grid: { vertLines: { color: C.rejilla }, horzLines: { color: C.rejilla } },
    rightPriceScale: { borderColor: C.borde }, timeScale: { borderColor: C.borde, rightOffset: 3 },
    crosshair: { mode: LC.CrosshairMode.Normal },
    localization: { locale: "es-ES", priceFormatter: p => fmt(p, Math.abs(p) < 10 && p % 1 ? 1 : 0), dateFormat: "dd MMM yyyy" },
  }, extra));
  graficas[id] = ch;
  return ch;
}
function sincronizar(ids) {
  ids.forEach(a => graficas[a] && graficas[a].timeScale().subscribeVisibleTimeRangeChange(r => {
    if (sincronizando || !r) return; sincronizando = true;
    ids.forEach(b => { if (b !== a && graficas[b]) try { graficas[b].timeScale().setVisibleRange(r); } catch (e) {} });
    sincronizando = false;
  }));
}
const GRAF = { seg: ["g-seg", "g-vis", "g-acum"], vis: ["g-seg", "g-vis", "g-acum"], acum: ["g-seg", "g-vis", "g-acum"], comp: ["g-comp"], tienda: ["g-tienda"], marca: ["g-marca"] };
function rango(graf, r) {
  const ids = GRAF[graf];
  const hasta = new Date(D.actualizado.slice(0, 10) + "T00:00:00Z");
  ids.forEach(id => { const ch = graficas[id]; if (!ch) return;
    if (r === "Todo") { ch.timeScale().fitContent(); return; }
    const meses = { "1M": 1, "3M": 3, "6M": 6, "1A": 12, "2A": 24 }[r];
    const desde = new Date(hasta); desde.setUTCMonth(desde.getUTCMonth() - meses);
    try { ch.timeScale().setVisibleRange({ from: desde.toISOString().slice(0, 10), to: hasta.toISOString().slice(0, 10) }); } catch (e) {}
  });
  if (GRAF[graf] === GRAF.seg) document.querySelectorAll('.grupo.rango[data-graf="seg"],.grupo.rango[data-graf="vis"],.grupo.rango[data-graf="acum"]')
    .forEach(g => g.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.r === r)));
}
function leyenda(id, ch, filas) {                    // filas: [{nombre, color, serie, fmt}]
  const el = document.getElementById(id);
  const pinta = (param) => {
    let t = null; const vals = filas.map(f => {
      let v = null;
      if (param && param.time && param.seriesData) { const d = param.seriesData.get(f.serie); if (d) v = d.close ?? d.value; t = param.time; }
      else { const datos = f.datos; const u = datos[datos.length - 1]; if (u) { v = u.close ?? u.value; t = u.time; } }
      return `<span><i style="background:${f.color}"></i>${f.nombre} <b>${v == null ? "–" : (f.fmt || fmt)(v)}</b></span>`;
    });
    el.innerHTML = `<span>${t ? fecha(typeof t === "string" ? t : `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`) : ""}</span>` + vals.join("");
  };
  ch.subscribeCrosshairMove(pinta); pinta(null);
}

/* ─────────── vista de una red (o global) ─────────── */
function pintarRed(k, soloSeg = false) {
  const esG = k === "global";
  const R = esG ? D.global_ : D.redes[k].resumen;
  const color = esG ? C.tdr : D.redes[k].color;
  const s = serieDe(k);
  if (!soloSeg) perfilYkpis(k, R, s, color);

  // seguidores
  const segs = s.filter(x => x.seg != null).map(x => ({ time: x.t, value: x.seg }));
  if (graficas["g-seg"]) { graficas["g-seg"].remove(); delete graficas["g-seg"]; }
  const g1 = crear("g-seg");
  let serie1;
  if (modoSeg === "velas") {
    serie1 = g1.addCandlestickSeries({ upColor: C.verde, downColor: C.rojo, borderVisible: false, wickUpColor: C.verde, wickDownColor: C.rojo,
      priceFormat: { type: "price", precision: 0, minMove: 1 } });
    serie1.setData(velasSemanales(segs));
  } else {
    serie1 = g1.addAreaSeries({ lineColor: color, topColor: color + "55", bottomColor: color + "05", lineWidth: 2, priceFormat: { type: "price", precision: 0, minMove: 1 } });
    serie1.setData(segs);
  }
  const d1 = modoSeg === "velas" ? velasSemanales(segs) : segs;
  leyenda("ley-seg", g1, [{ nombre: modoSeg === "velas" ? "Cierre semana" : "Seguidores", color, serie: serie1, datos: d1 }]);
  document.getElementById("t-seg").textContent = esG ? "Seguidores · suma de las cuatro redes" : `Seguidores en ${D.redes[k].nombre}`;
  document.getElementById("n-seg").textContent = esG
    ? `La suma empieza el ${fecha(R.desde_seg)}, el primer día con seguidores medidos en las cuatro redes. Cada vela es una semana: abre con el cierre de la semana anterior; verde si ha subido y roja si ha bajado.`
    : (k === "youtube" ? "Desde que se abrió el canal: los seguidores de cada día salen de los suscriptores ganados y perdidos que da YouTube Analytics. "
                       : `Metricool guarda los seguidores de ${D.redes[k].nombre} desde el ${fecha(R.desde_seg)}. `) +
      (modoSeg === "velas" ? "Cada vela es una semana: verde si ha subido y roja si ha bajado." : "");
  if (soloSeg) { rango("seg", k === "youtube" ? "1A" : "Todo"); return; }

  // visualizaciones diarias: barras (verde si supera su media de 30 días) + media 7 y 30
  const sv = recortarCola(s.filter(x => x.t >= (R.desde_vis || "0")), "vis");
  const vals = sv.map(x => x.vis || 0);
  const m7 = media(vals, 7), m30 = media(vals, 30);
  const g2 = crear("g-vis");
  const barras = g2.addHistogramSeries({ priceFormat: { type: "volume" }, priceLineVisible: false });
  barras.setData(sv.map((x, i) => ({ time: x.t, value: vals[i], color: vals[i] >= m30[i] ? C.verde + "cc" : C.rojo + "aa" })));
  const l7 = g2.addLineSeries({ color: C.amarillo, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  l7.setData(sv.map((x, i) => ({ time: x.t, value: m7[i] })));
  const l30 = g2.addLineSeries({ color: C.azul, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  l30.setData(sv.map((x, i) => ({ time: x.t, value: m30[i] })));
  leyenda("ley-vis", g2, [{ nombre: "Día", color: C.verde, serie: barras, datos: barras.data() },
    { nombre: "Media 7 d", color: C.amarillo, serie: l7, datos: l7.data(), fmt: v => fmt(v) },
    { nombre: "Media 30 d", color: C.azul, serie: l30, datos: l30.data(), fmt: v => fmt(v) }]);

  // acumulado
  let acum = 0; const ac = sv.map(x => ({ time: x.t, value: (acum += x.vis || 0) }));
  const g3 = crear("g-acum");
  const a3 = g3.addAreaSeries({ lineColor: color, topColor: color + "44", bottomColor: color + "03", lineWidth: 2, priceFormat: { type: "volume" } });
  a3.setData(ac);
  leyenda("ley-acum", g3, [{ nombre: "Acumulado", color, serie: a3, datos: ac }]);
  document.getElementById("sub-acum").textContent = esG
    ? `suma de las cuatro redes desde ${fecha(sv[0] && sv[0].t)} (cada red entra cuando hay datos)`
    : `desde ${fecha(sv[0] && sv[0].t)}${k === "youtube" ? ", el primer día del canal" : " (lo que guarda Metricool)"}`;

  sincronizar(["g-vis", "g-acum"]);
  document.getElementById("caja-comp").style.display = esG ? "" : "none";
  if (esG) comparativa();
  rango("seg", k === "youtube" || esG ? "1A" : "Todo");
}

function perfilYkpis(k, R, s, color) {
  const esG = k === "global";
  const p = document.getElementById("perfil");
  const r30 = pct(R.seguidores, R.seguidores - (R.d30 || 0));
  p.innerHTML = `<div class="p-izq"><div class="ico" style="background:${color}">${ICO[k]}</div><div>
      <h1>${esG ? "TodoEnRecambio · todas las redes" : D.redes[k].nombre}</h1>
      <p>${esG ? "YouTube, Instagram, TikTok y Facebook juntos: seguidores, visualizaciones y hacia dónde van." : D.redes[k].usuario}</p>
      ${esG ? "" : `<a class="verperfil" href="${D.redes[k].url}" target="_blank" rel="noopener">Ver el perfil ↗</a>`}</div></div>
    <div class="precio"><div class="et">Seguidores${R.fecha_seg ? " · " + fecha(R.fecha_seg) : ""}</div><div class="grande">${fmt(R.seguidores)}</div>
      <div class="var ${cls(R.d30)}">${flecha(R.d30)}${signo(R.d30)} (${signo(r30, 2)} %) en 30 días</div></div>`;
  // tendencia de las visualizaciones: media de 30 días hoy frente a hace 30 días
  const sv = recortarCola(s.filter(x => x.t >= (R.desde_vis || "0")), "vis");
  const vals = sv.map(x => x.vis || 0), m30 = media(vals, 30);
  const tend = m30.length > 60 ? pct(m30[m30.length - 1], m30[m30.length - 31]) : null;
  let gan = null, per = null;
  if (!esG) { const ult = s.filter(x => x.t > (new Date(Date.parse(D.actualizado.slice(0, 10)) - 30 * 864e5)).toISOString().slice(0, 10));
    if (ult.some(x => x.gan != null)) { gan = ult.reduce((a, x) => a + (x.gan || 0), 0); per = ult.reduce((a, x) => a + (x.per || 0), 0); } }
  const kpi = (e, v, sub, c = "") => `<div class="kpi"><div class="e">${e}</div><div class="v">${v}</div><div class="s ${c}">${sub || "&nbsp;"}</div></div>`;
  document.getElementById("kpis").innerHTML = [
    kpi("Seguidores: último día", signo(R.d1), "frente al día anterior", cls(R.d1)),
    kpi("Seguidores: 7 días", signo(R.d7), `${signo(R.d7 / 7, 1)} al día de media`, cls(R.d7)),
    kpi("Seguidores: 30 días", signo(R.d30), `${signo(R.media_dia_30, 2)} al día de media`, cls(R.d30)),
    kpi("Seguidores: 90 días", signo(R.d90), `${signo(R.media_dia_90, 2)} al día de media`, cls(R.d90)),
    gan != null ? kpi("Ganados / perdidos 30 d", `${fmt(gan)} / ${fmt(per)}`, `neto ${signo(gan - per)}`, cls(gan - per)) : "",
    kpi("Visualizaciones históricas", fmt(R.vis_historico), k === "youtube" ? "todo el canal, desde 2021" : esG ? "suma de las cuatro redes" : `medidas desde ${fecha(R.desde_vis)}`),
    kpi("Visualizaciones: 30 días", fmt(R.vis_30), `${flecha(R.vis_cambio_30)}${signo(R.vis_cambio_30, 1)} % frente a los 30 anteriores`, cls(R.vis_cambio_30)),
    kpi("Media diaria (30 días)", fmt(R.vis_media_30), `últimos 7 días: ${fmt(R.vis_7)}`),
    kpi("Tendencia de las visualizaciones", tend == null ? "–" : (tend > 3 ? "Creciendo" : tend < -3 ? "Bajando" : "Estable"),
      tend == null ? "falta historia" : `media 30 d: ${signo(tend, 1)} % en un mes`, cls(tend)),
  ].join("");
}

function comparativa() {
  if (graficas["g-comp"]) { graficas["g-comp"].remove(); delete graficas["g-comp"]; }
  const g = crear("g-comp", { rightPriceScale: { borderColor: C.borde, mode: LC.PriceScaleMode.Percentage } });
  const filas = [];
  REDES.forEach(r => {
    const s = serieDe(r); let datos;
    if (modoComp === "seg") datos = s.filter(x => x.seg != null).map(x => ({ time: x.t, value: x.seg }));
    else { const sv = recortarCola(s.filter(x => x.t >= (D.redes[r].resumen.desde_vis || "0")), "vis"); const m = media(sv.map(x => x.vis || 0), 30);
      datos = sv.map((x, i) => ({ time: x.t, value: Math.max(m[i], 0.01) })); }
    const l = g.addLineSeries({ color: D.redes[r].color, lineWidth: 2, priceLineVisible: false });
    l.setData(datos); filas.push({ nombre: D.redes[r].nombre, color: D.redes[r].color, serie: l, datos, fmt: v => fmt(v) });
  });
  leyenda("ley-comp", g, filas);
  const desde = new Date(Date.parse(D.actualizado.slice(0, 10))); desde.setUTCMonth(desde.getUTCMonth() - 3);
  try { g.timeScale().setVisibleRange({ from: desde.toISOString().slice(0, 10), to: D.actualizado.slice(0, 10) }); } catch (e) {}
}

/* ─────────── impacto en TDR ─────────── */
function impacto() {
  const T = D.tienda.resumen;
  const tot = k => REDES.reduce((a, r) => a + (T[k][r] ? T[k][r][0] : 0), 0);
  const com = k => REDES.reduce((a, r) => a + (T[k][r] ? T[k][r][1] : 0), 0);
  const ing = k => REDES.reduce((a, r) => a + (T[k][r] ? T[k][r][2] : 0), 0);
  const marca = D.marca; const c30 = marca.slice(-30).reduce((a, x) => a + x[1], 0), cprev = marca.slice(-60, -30).reduce((a, x) => a + x[1], 0);
  const kpi = (e, v, sub, c = "") => `<div class="kpi"><div class="e">${e}</div><div class="v">${v}</div><div class="s ${c}">${sub || "&nbsp;"}</div></div>`;
  document.getElementById("kpis-tienda").innerHTML = [
    kpi("Visitas a la tienda desde redes", fmt(tot("total")), `desde ${fecha(T.desde)}`),
    kpi("Visitas: últimos 30 días", fmt(tot("d30")), `90 días: ${fmt(tot("d90"))}`),
    kpi("Compras atribuidas a redes", fmt(com("total")), `${fmt(ing("total"), 2)} € desde ${fecha(T.desde)}`),
    ...REDES.map(r => kpi(`Desde ${D.redes[r].nombre}`, fmt(T.total[r] ? T.total[r][0] : 0) + " visitas",
      `${fmt(T.total[r] ? T.total[r][1] : 0)} compras · ${fmt(T.total[r] ? T.total[r][2] : 0, 2)} €`)),
    kpi("Búsquedas de la marca: 30 días", fmt(c30) + " clics", `${flecha(pct(c30, cprev))}${signo(pct(c30, cprev), 1)} % frente a los 30 anteriores`, cls(pct(c30, cprev))),
  ].join("");

  // sesiones por semana y red
  const g = crear("g-tienda"); const filas = [];
  REDES.forEach(r => {
    const sem = new Map();
    D.tienda.serie.forEach(([f, x]) => { const k = lunes(f); sem.set(k, (sem.get(k) || 0) + (x[r] ? x[r][0] : 0)); });
    const datos = [...sem].sort().map(([t, v]) => ({ time: t, value: v }));
    const l = g.addLineSeries({ color: D.redes[r].color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    l.setData(datos); filas.push({ nombre: D.redes[r].nombre, color: D.redes[r].color, serie: l, datos });
  });
  leyenda("ley-tienda", g, filas); g.timeScale().fitContent();

  // marca
  const gm = crear("g-marca");
  const vals = marca.map(x => x[1]), m7 = media(vals, 7);
  const b = gm.addHistogramSeries({ color: C.tdr + "99", priceFormat: { type: "volume" }, priceLineVisible: false });
  b.setData(marca.map(x => ({ time: x[0], value: x[1] })));
  const l = gm.addLineSeries({ color: C.amarillo, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  l.setData(marca.map((x, i) => ({ time: x[0], value: m7[i] })));
  leyenda("ley-marca", gm, [{ nombre: "Clics", color: C.tdr, serie: b, datos: b.data() }, { nombre: "Media 7 d", color: C.amarillo, serie: l, datos: l.data(), fmt: v => fmt(v, 1) }]);
  gm.timeScale().fitContent();

  const ventas = [];
  D.tienda.serie.forEach(([f, x]) => REDES.forEach(r => { if (x[r] && x[r][1]) ventas.push([f, r, x[r][1], x[r][2]]); }));
  ventas.sort((a, b) => b[0].localeCompare(a[0]));
  document.getElementById("tabla-ventas").innerHTML = ventas.length ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Día</th><th>Red</th><th class="n">Compras</th><th class="n">Importe</th></tr></thead><tbody>` +
    ventas.map(v => `<tr><td>${fecha(v[0])}</td><td><span class="chip" style="background:${D.redes[v[1]].color}">${D.redes[v[1]].nombre}</span></td><td class="n">${v[2]}</td><td class="n">${fmt(v[3], 2)} €</td></tr>`).join("") +
    `</tbody></table></div><p class="nota">Compras en las que Google Analytics atribuye la visita a una red social (último clic de la sesión).</p>`
    : `<p class="nota">Todavía no hay compras atribuidas a redes.</p>`;
}

/* ─────────── vídeos ─────────── */
function tablaVideos() {
  let L = D.publicaciones.filter(p => filtroRed === "todas" || p.red === filtroRed);
  L = L.slice().sort((a, b) => orden === "vis" ? b.vis - a.vis : b.fecha.localeCompare(a.fecha));
  document.querySelector("#tabla-videos tbody").innerHTML = L.map(p => `<tr><td>${fecha(p.fecha)}</td>
    <td><span class="chip" style="background:${D.redes[p.red].color};${p.red === "tiktok" ? "color:#000" : ""}">${D.redes[p.red].nombre}</span>${p.tipo ? `<span class="tipo">${p.tipo}</span>` : ""}</td>
    <td><a href="${p.url}" target="_blank" rel="noopener">${(p.titulo || "(sin título)").replace(/</g, "&lt;")}</a></td>
    <td class="n">${fmt(p.vis)}</td><td class="n">${fmt(p.likes)}</td><td class="n">${fmt(p.comentarios)}</td></tr>`).join("");
}
