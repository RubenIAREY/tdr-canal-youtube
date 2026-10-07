/* Sección «Comentarios» del Panel de redes de TodoEnRecambio (TDR), como módulo para una pestaña.

     const { montarComentarios } = await import("../comun/comentarios.js");
     const com = await montarComentarios(contenedor, { datos: "../datos/comentarios.json" });
     com.actualizarTema();      // tras cambiar la paleta, la letra o la textura de la página
     com.elegirRed("youtube");  // abre la sección con esa red elegida ("global" | "youtube" | "instagram" | "tiktok" | "facebook")
     com.destruir();            // quita gráficas, escuchadores y el HTML del módulo

   datos: URL (se lee con fetch) o el objeto ya leído (formato en PANEL-REDES/_ENCARGO_COMENTARIOS.md).
   Opcionales: red (la de partida), clave (localStorage donde se recuerdan red, periodo, rango y orden; por defecto "tdr-comentarios"),
   logo (ruta del logo REAL de TDR, relativa a la página; por defecto "../../logo-tdr.png"),
   descargar(def, meta, formato, boton): la página hace el CSV o el Excel con sus funciones (def = {columnas, tipos, filas});
   si no se pasa, el módulo solo ofrece CSV, hecho por él.
   Todo número y todo texto que se ve sale de comentarios.json; los autores no vienen (la página es pública).
   Usa las variables CSS de la página y window.LightweightCharts (4.2.3, la carga la página). */

const CSS_URL = new URL("./comentarios.css", import.meta.url).href;
const ORDEN_REDES = ["global", "youtube", "instagram", "tiktok", "facebook"];
const RED_DEF = {
  global: { nombre: "Global", largo: "Todas las redes", corto: "TOTAL", color: "#d71119" },
  youtube: { nombre: "YouTube", largo: "YouTube", corto: "YT", color: "#ff3b30" },
  instagram: { nombre: "Instagram", largo: "Instagram", corto: "IG", color: "#e1306c" },
  tiktok: { nombre: "TikTok", largo: "TikTok", corto: "TT", color: "#25f4ee" },
  facebook: { nombre: "Facebook", largo: "Facebook", corto: "FB", color: "#1877f2" },
};
const TIPOS = { pregunta: ["Pregunta", "Preguntas"], peticion: ["Petición", "Peticiones"], correccion: ["Corrección", "Correcciones"],
  agradecimiento: ["Agradecimiento", "Agradecimientos"], opinion: ["Opinión", "Opiniones"], queja: ["Queja", "Quejas"], otro: ["Otro", "Otros"],
  nuestro: ["Nuestro", "Nuestros"] };
const ORDEN_TIPOS = ["pregunta", "peticion", "correccion", "agradecimiento", "opinion", "queja", "otro"];
const FORMATO = { short: "Short", largo: "Vídeo largo", respuesta: "Respuesta" };
const FILTROS = [["todos", "Todos"], ["preguntas", "Preguntas"], ["sinresp", "Sin responder"], ["tdr", "Respondidos por TDR"], ["peticiones", "Peticiones"], ["correcciones", "Correcciones"]];
const ORDENES = [["recientes", "Más recientes"], ["likes", "Más me gusta"], ["respuestas", "Más respuestas"]];
const PERIODOS = [["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]];
const NOMBRE_PER = { dia: "día", semana: "semana", mes: "mes" };
const RANGOS = [["1M", 1], ["3M", 3], ["6M", 6], ["1A", 12], ["2A", 24], ["Todo", 0]];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIA = 864e5, POR_PAGINA = 20, FILAS_TABLA = 10;
let instancias = 0;

/* ─────────── formato (es-ES, miles siempre agrupados) ─────────── */
const fmt = (n, d = 0) => n == null || !isFinite(n) ? "–" : Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
const signo = (n, d = 0) => n == null || !isFinite(n) ? "–" : (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), d);
const cls = n => n == null || !isFinite(n) || n === 0 ? "igual" : n > 0 ? "sube" : "baja";
const flecha = n => n == null || !isFinite(n) ? "" : n > 0 ? "▲ " : n < 0 ? "▼ " : "■ ";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => v == null || v === "" || !isFinite(+v) ? null : +v;
const pct = (a, b) => a != null && b ? (a - b) / b * 100 : null;
const corto = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const pad = n => String(n).padStart(2, "0");
const aMs = s => Date.parse(String(s).slice(0, 10) + "T00:00:00Z");
const aIso = ms => new Date(ms).toISOString().slice(0, 10);
const esDia = s => /^\d{4}-\d\d-\d\d$/.test(String(s || ""));
const fecha = s => { if (!s) return "–"; const [y, m, d] = String(s).slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]} ${y}`; };
const fechaCorta = s => { if (!s) return "–"; const [, m, d] = String(s).slice(0, 10).split("-"); return `${+d} ${MES[+m - 1]}`; };
const horaDe = s => { const m = String(s || "").match(/[ T](\d\d:\d\d)/); return m ? m[1] : ""; };
const fechaHora = s => { const h = horaDe(s); return h ? `${fecha(s)} · ${h}` : fecha(s); };
const hoyIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const sinTildes = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const claveT = t => t == null ? null : typeof t === "string" ? t : typeof t === "number" ? aIso(t * 1000) : `${t.year}-${pad(t.month)}-${pad(t.day)}`;
function lunes(t) { const d = new Date(t + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }
const clavePeriodo = (t, p) => p === "mes" ? t.slice(0, 7) + "-01" : p === "semana" ? lunes(t) : t;
const etiquetaPeriodo = (t, p) => p === "mes" ? `${MES[+t.slice(5, 7) - 1]} ${t.slice(0, 4)}` : (p === "semana" ? "semana del " : "") + fecha(t);
function horasTxt(h) {
  h = num(h); if (h == null) return "–";
  if (h < 1) return `${fmt(Math.max(1, Math.round(h * 60)))} min`;
  if (h < 48) return `${fmt(h, Math.round(h) !== h ? 1 : 0)} h`;
  return `${fmt(h / 24, 1)} días`;
}
const veces = n => `${fmt(n)} ${n === 1 ? "vez" : "veces"}`;
const plural = (n, uno, varios) => `${fmt(n)} ${n === 1 ? uno : varios}`;

/* ─────────── colores ─────────── */
function rgb(c) {
  c = String(c || "").trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { let h = m[1]; if (h.length <= 4) h = h.split("").map(x => x + x).join(""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  m = c.match(/rgba?\(([^)]+)\)/i);
  if (m) return m[1].split(/[ ,/]+/).slice(0, 3).map(Number);
  return null;
}
const rgba = (c, a) => { const v = rgb(c) || [0, 0, 0]; return `rgba(${v[0]},${v[1]},${v[2]},${a})`; };

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
  let l = document.querySelector("link[data-co-css]");
  if (ya && !l) return Promise.resolve(null);
  if (!l) { l = document.createElement("link"); l.rel = "stylesheet"; l.href = CSS_URL; l.dataset.coCss = ""; document.head.appendChild(l); }
  if (l.sheet) return Promise.resolve(l);
  return new Promise(res => { const fin = () => res(l); l.addEventListener("load", fin, { once: true }); l.addEventListener("error", fin, { once: true }); setTimeout(fin, 4000); });
}

/* CSV propio (solo si la página no da su función de descarga): BOM UTF-8, «;» y decimales con coma, para Excel en español */
function csvPropio(def) {
  const celda = (v, tipo) => {
    if (v == null || v === "" || (typeof v === "number" && !isFinite(v))) return "";
    if (typeof v === "number") { const d = tipo === "n1" ? 1 : tipo === "n2" || tipo === "pct" ? 2 : 0; return String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ","); }
    let s = String(v); if (/^[=+@-]/.test(s)) s = "'" + s;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\ufeff" + [def.columnas.map(c => celda(c, "txt")).join(";"), ...def.filas.map(f => f.map((v, i) => celda(v, def.tipos[i])).join(";"))].join("\r\n") + "\r\n";
}

const ICONO = {
  lleno: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>`,
  salir: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4"/></svg>`,
  bajar: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11"/></svg>`,
  abajo: `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>`,
  lupa: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/></svg>`,
  cerrar: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
};

/* ═══════════════════════════════════════════ módulo ═══════════════════════════════════════════ */
export async function montarComentarios(contenedor, opciones = {}) {
  if (!contenedor) throw new Error("montarComentarios: falta el contenedor");
  const LC = window.LightweightCharts;
  const uid = "co" + (++instancias) + Math.random().toString(36).slice(2, 6);
  const CLAVE = opciones.clave || "tdr-comentarios";
  const LOGO = opciones.logo || "../../logo-tdr.png";
  const linkCss = await cargarCss();
  const raiz = document.createElement("section");
  raiz.className = "co";
  raiz.setAttribute("aria-labelledby", uid + "-tit");
  contenedor.appendChild(raiz);

  let C = null, motivo = "sin datos";
  try { C = await leer(opciones.datos); } catch (e) { motivo = (e && e.message) || String(e); }
  if (!C || !C.redes) {
    raiz.innerHTML = `<p class="co-nota co-error">Los comentarios todavía no están listos: no se ha podido leer comentarios.json (${esc(motivo)}).</p>`;
    return { actualizarTema() {}, elegirRed() {}, destruir() { raiz.remove(); } };
  }

  /* ─── datos ─── */
  const redesHay = ORDEN_REDES.filter(r => r === "global" ? !!C.global : !!C.redes[r]);
  const defRed = r => Object.assign({}, RED_DEF[r] || { nombre: r, largo: r, corto: r.slice(0, 2).toUpperCase(), color: "#888888" },
    r !== "global" && C.redes[r] && C.redes[r].nombre ? { nombre: C.redes[r].nombre, largo: C.redes[r].nombre } : {},
    r !== "global" && C.redes[r] && C.redes[r].color ? { color: C.redes[r].color } : {});
  const YT = C.redes.youtube && C.redes.youtube.texto ? C.redes.youtube : null;
  const HILOS = YT && Array.isArray(YT.hilos) ? YT.hilos.filter(h => h && h.id) : [];
  const AJENOS = HILOS.filter(h => !h.de_tdr);                    // los comentarios de los espectadores (los nuestros de arriba no cuentan)
  const TODOS_NUEVOS = HILOS.length > 0 && HILOS.every(h => h.nuevo);  // primera carga: todos «nuevos», así que la etiqueta no dice nada
  const POR_ID = new Map(HILOS.map(h => [h.id, h]));
  const DOMID = new Map(HILOS.map((h, i) => [h.id, `${uid}-h${i}`]));
  const AN = C.analisis && typeof C.analisis === "object" ? C.analisis : null;
  const lista = k => AN && Array.isArray(AN[k]) ? AN[k].filter(Boolean) : [];
  const hayAnalisis = !!(AN && (String(AN.resumen || "").trim() || String(AN.sobre_nuestras_respuestas || "").trim() ||
    ["lo_que_mas_preguntan", "patrones", "ideas_de_contenido", "responder_ya"].some(k => lista(k).length)));
  const HASTA = esDia(String(C.generado || "").slice(0, 10)) ? C.generado.slice(0, 10) : hoyIso();
  const conTexto = r => !!YT && (r === "global" || r === "youtube");
  const R = r => r === "global" ? null : C.redes[r];
  const urlVideo = h => h.video_id ? `https://www.youtube.com/watch?v=${encodeURIComponent(h.video_id)}` : null;
  const enlaceSeguro = u => /^https?:\/\//i.test(String(u || "")) ? String(u) : null;

  // serie diaria de una red (o global): cada día desde el primero con algo hasta la fecha de los datos; un día sin comentarios vale 0
  const CACHE = {};
  function diaria(r) {
    if (CACHE[r]) return CACHE[r];
    const m = new Map(), add = (f, c, rr, tt) => { if (!esDia(f)) return; const a = m.get(f) || [0, 0, 0]; a[0] += c; a[1] += rr; a[2] += tt; m.set(f, a); };
    let conResp = false;
    if (r === "global") {
      ((C.global && C.global.serie) || []).forEach(x => Array.isArray(x) && add(x[0], num(x[1]) || 0, 0, 0));
      if (YT) { conResp = true; (YT.serie || []).forEach(x => Array.isArray(x) && add(x[0], 0, num(x[2]) || 0, num(x[3]) || 0)); }
    } else {
      const S = C.redes[r] || {}; conResp = !!S.texto;
      (S.serie || []).forEach(x => Array.isArray(x) && add(x[0], num(x[1]) || 0, conResp ? num(x[2]) || 0 : 0, conResp ? num(x[3]) || 0 : 0));
    }
    const fechas = [...m.keys()].filter(f => m.get(f).some(v => v > 0)).sort();
    const dias = [];
    if (fechas.length) {
      const fin = fechas[fechas.length - 1] > HASTA ? fechas[fechas.length - 1] : HASTA;
      for (let t = aMs(fechas[0]), z = aMs(fin); t <= z; t += DIA) { const f = aIso(t), a = m.get(f) || [0, 0, 0]; dias.push({ t: f, c: a[0], r: a[1], tdr: a[2] }); }
    }
    return (CACHE[r] = { dias, conResp, primero: fechas[0] || null });
  }
  function agrupar(dias, p, sorteos) {
    const g = new Map();
    dias.forEach(d => { const k = clavePeriodo(d.t, p); const a = g.get(k) || { time: k, c: 0, r: 0, tdr: 0, sorteo: false }; a.c += d.c; a.r += d.r; a.tdr += d.tdr;
      if (sorteos && sorteos.has(d.t)) a.sorteo = true; g.set(k, a); });
    return [...g.values()];
  }
  // días en que se publicó un sorteo (Instagram, TikTok, Facebook): disparan los comentarios y se señalan aparte
  const redesSin = () => redesHay.filter(x => x !== "global" && C.redes[x] && !C.redes[x].texto);
  function sorteosDe(r) {
    const s = new Set();
    (r === "global" ? redesSin() : [r]).forEach(x => { const S = C.redes[x]; if (S && !S.texto && Array.isArray(S.por_publicacion))
      S.por_publicacion.forEach(p => { if (p && p.sorteo && esDia(String(p.fecha || "").slice(0, 10))) s.add(p.fecha.slice(0, 10)); }); });
    return s;
  }
  // interés por mes: comentarios por cada 1.000 visualizaciones (y preguntas, que solo da YouTube); Global = suma de las redes
  function interesDe(r) {
    const m = new Map(), add = (mes, c, p, v) => { if (!/^\d{4}-\d\d$/.test(mes)) return; const a = m.get(mes) || { c: 0, p: 0, vis: 0, hayVis: false };
      a.c += c || 0; a.p += p || 0; if (v != null) { a.vis += v; a.hayVis = true; } m.set(mes, a); };
    (r === "global" ? redesHay.filter(x => x !== "global") : [r]).forEach(x => ((C.redes[x] && C.redes[x].interes) || []).forEach(f => Array.isArray(f) && add(f[0], num(f[1]), num(f[2]), num(f[3]))));
    const sorteos = sorteosDe(r), mesesSorteo = new Set([...sorteos].map(f => f.slice(0, 7)));
    let L = [...m.keys()].sort().map(mes => { const a = m.get(mes), uno = r !== "global" ? (C.redes[r].interes || []).find(f => f[0] === mes) : null;
      const por = uno && num(uno[4]) != null ? num(uno[4]) : a.hayVis && a.vis > 0 ? a.c / a.vis * 1000 : null;
      return { time: mes + "-01", mes, c: a.c, p: a.p, vis: a.hayVis ? a.vis : null, por, sorteo: mesesSorteo.has(mes) }; });
    const i0 = L.findIndex(x => x.c > 0 || (x.vis || 0) > 0);
    return i0 < 0 ? [] : L.slice(i0);
  }

  /* ─── estado ─── */
  let guardado = {};
  try { guardado = JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch (e) { guardado = {}; }
  const est = {
    red: [opciones.red, guardado.red, "global"].find(r => r && redesHay.includes(r)) || redesHay[0],
    periodo: PERIODOS.some(p => p[0] === guardado.periodo) ? guardado.periodo : "semana",
    rango: RANGOS.some(p => p[0] === guardado.rango) ? guardado.rango : "1A",
    orden: ORDENES.some(o => o[0] === guardado.orden) ? guardado.orden : "recientes",
    filtro: "todos", extra: null, q: "", ver: POR_PAGINA, abiertos: new Set(), tablaToda: false, temasTodos: false,
  };
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify({ red: est.red, periodo: est.periodo, rango: est.rango, orden: est.orden })); } catch (e) { /* sin almacenamiento */ } };

  /* ─── tema (variables CSS de la página) ─── */
  let T = null;
  function leerTema() {
    const s = getComputedStyle(raiz), v = (k, d) => s.getPropertyValue(k).trim() || d;
    T = {
      capa1: v("--capa1", "#fbf8f1"), tinta: v("--tinta", "#1b1a18"), suave: v("--tinta-suave", "#57534c"), tenue: v("--tinta-tenue", "#635e57"),
      marca: v("--marca", "#d71119"), ma30: v("--ma30", "#2a5db0"), baja: v("--baja", "#b5701a"),
      texto: v("--g-texto", v("--tinta-tenue", "#6d6a64")), rejilla: v("--g-rejilla", v("--linea", "#e9e0d0")), borde: v("--g-borde", v("--linea", "#d6cbb8")),
      letra: v("--f-cifra", "monospace"),
    };
    T.sinRejilla = document.documentElement.dataset.rejilla === "no";
    T.cC = rgba(T.ma30, .62); T.cR = rgba(T.tinta, .32); T.cT = T.marca;      // comentarios, respuestas (todas) y las de TDR
    T.cI = rgba(T.ma30, .74); T.cS = rgba(T.baja, .62); T.cP = T.tinta; T.cA = rgba(T.ma30, .9);   // interés, sorteos, preguntas y acumulado
  }

  /* ─── esqueleto ─── */
  const GEN = C.generado ? `${fecha(C.generado)}${horaDe(C.generado) ? " a las " + horaDe(C.generado) : ""}` : "–";
  const descargas = (que, nombre) => `<div class="co-grupo co-desc" role="group" aria-label="Descargar ${nombre}"><span class="co-desc-ico" aria-hidden="true">${ICONO.bajar}</span>` +
    `<button type="button" data-desc="${que}" data-formato="csv" aria-label="Descargar en CSV ${nombre}">CSV</button>` +
    (typeof opciones.descargar === "function" ? `<button type="button" data-desc="${que}" data-formato="xlsx" aria-label="Descargar en Excel ${nombre}">Excel</button>` : "") + `</div>`;
  const botonLlenoHTML = `<button type="button" class="co-icono" data-lleno="1" aria-pressed="false" aria-label="Ver la gráfica a pantalla completa">${ICONO.lleno}<span class="co-icono-txt">Pantalla completa</span></button>`;
  const rangoHTML = `<div class="co-grupo co-rango co-rango-pane" role="group" aria-label="Periodo que se ve">${RANGOS.map(([k]) => `<button type="button" data-rango="${k}">${k}</button>`).join("")}</div>`;
  raiz.innerHTML = `
    ${C.ejemplo ? `<p class="co-ejemplo" role="note"><b>DATOS DE EJEMPLO.</b> Sirven para desarrollar esta sección: los comentarios, las cifras y el análisis no son reales.</p>` : ""}
    <header class="co-cab">
      <div class="co-cab-izq">
        <div class="co-ticker"><em>TDR</em>:COMENTARIOS</div>
        <h1 id="${uid}-tit">Comentarios y preguntas</h1>
        <p class="co-sub">Datos del <b>${esc(GEN)}</b>. Mide el interés: no solo cuánta gente nos ve, sino cuánta nos escribe y qué nos pregunta.</p>
      </div>
      <span class="co-sello" data-co="sello" aria-hidden="true"></span>
    </header>
    <div class="co-mandos"><span class="co-et" id="${uid}-et-red">Red</span><div class="co-grupo co-redes" data-co="redes" role="group" aria-labelledby="${uid}-et-red"></div></div>
    <div data-co="aviso"></div>
    <div class="co-kpis" data-co="kpis"></div>
    <div data-co="porred"></div>
    <div class="co-mandos co-mandos-graf"><span class="co-et" id="${uid}-et-rango">Periodo de las gráficas</span>
      <div class="co-grupo co-rango" role="group" aria-labelledby="${uid}-et-rango">${RANGOS.map(([k]) => `<button type="button" data-rango="${k}">${k}</button>`).join("")}</div></div>
    <div class="co-graficas">
      <article class="caja co-caja co-graf-caja co-numerada co-interes" data-co="caja-i">
        <div class="co-caja-cab">
          <h2 data-co="t-i"></h2>
          <div class="co-botones">${rangoHTML}${descargas("interes", "los datos que se ven de la gráfica del interés")}${botonLlenoHTML}</div>
          <div class="co-leyenda" data-co="ley-i" aria-live="off"></div>
        </div>
        <div class="co-grafica" data-co="g-i" role="img"></div>
        <div class="co-claves" data-co="cl-i"></div>
        <p class="co-nota co-graf-nota" data-co="n-i"></p>
      </article>
      <article class="caja co-caja co-graf-caja co-numerada" data-co="caja-b">
        <div class="co-caja-cab">
          <h2 data-co="t-b"></h2>
          <div class="co-botones">
            <div class="co-grupo co-periodo" role="group" aria-label="Cada barra es">${PERIODOS.map(([k, n]) => `<button type="button" data-periodo="${k}">${n}</button>`).join("")}</div>
            ${rangoHTML}${descargas("barras", "los datos que se ven de la gráfica de comentarios")}${botonLlenoHTML}
          </div>
          <div class="co-leyenda" data-co="ley-b" aria-live="off"></div>
        </div>
        <div class="co-grafica" data-co="g-b" role="img"></div>
        <div class="co-claves" data-co="cl-b"></div>
        <p class="co-nota co-graf-nota" data-co="n-b"></p>
      </article>
      <article class="caja co-caja co-graf-caja co-numerada" data-co="caja-a">
        <div class="co-caja-cab">
          <h2>Comentarios acumulados <small>cómo crece la conversación, día a día</small></h2>
          <div class="co-botones">${rangoHTML}${descargas("acum", "los datos que se ven de la gráfica de comentarios acumulados")}${botonLlenoHTML}</div>
          <div class="co-leyenda" data-co="ley-a" aria-live="off"></div>
        </div>
        <div class="co-grafica" data-co="g-a" role="img"></div>
        <div class="co-claves" data-co="cl-a"></div>
        <p class="co-nota co-graf-nota" data-co="n-a"></p>
      </article>
    </div>
    <section class="caja co-caja co-numerada co-dicen" data-co="dicen" data-solo="texto" aria-labelledby="${uid}-t-dicen"></section>
    <div class="co-doble" data-solo="texto">
      <section class="caja co-caja co-numerada" aria-labelledby="${uid}-t-temas" data-co="temas"></section>
      <section class="caja co-caja co-numerada" aria-labelledby="${uid}-t-tipos" data-co="tipos"></section>
    </div>
    <section class="caja co-caja co-numerada co-lista" data-co="lista" data-solo="texto" aria-labelledby="${uid}-t-lista"></section>
    <section class="caja co-caja co-numerada" data-co="tabla" aria-labelledby="${uid}-t-tabla"></section>
    <div class="co-avisos" data-co="avisos"></div>
    <p class="co-estado-desc co-solo-lector" data-co="estado" role="status" aria-live="polite"></p>`;
  const $ = k => raiz.querySelector(`[data-co="${k}"]`);
  const cajaI = $("caja-i"), cajaB = $("caja-b"), cajaA = $("caja-a"), CAJAS = [cajaI, cajaB, cajaA];

  /* ─── cabecera, mandos y aviso de la red ─── */
  function pintarCabecera() {
    const sello = $("sello"), sin = YT ? num(YT.preguntas_sin_responder) : null, preg = YT ? num(YT.preguntas) : null;
    sello.textContent = !conTexto(est.red) || sin == null ? "" : sin > 0 ? `${fmt(sin)} sin responder` : preg ? "Todo contestado" : "";
    sello.hidden = !sello.textContent;
    $("redes").innerHTML = redesHay.map(r => `<button type="button" data-red="${r}" aria-pressed="${est.red === r}"><i style="background:${esc(defRed(r).color)}"></i>${esc(defRed(r).nombre)}</button>`).join("");
    const av = $("aviso");
    if (est.red === "global" || (R(est.red) && R(est.red).texto)) { av.innerHTML = ""; return; }
    const S = R(est.red);
    av.innerHTML = `<div class="co-aviso-red" role="note"><span class="co-chip"><i style="background:${esc(defRed(est.red).color)}"></i>${esc(defRed(est.red).corto)}</span>
      <p><b>Sin el texto de los comentarios.</b> ${esc(S.nota || "Metricool da cuántos comentarios tiene cada publicación, no el texto.")}
        Aquí se ve cuántos hay y en qué publicaciones; las preguntas, los temas y el análisis salen de YouTube.</p>
      ${YT ? `<button type="button" class="co-enlace co-fuerte" data-red="youtube">Ver los de YouTube <span aria-hidden="true">→</span></button>` : ""}</div>`;
  }

  /* ─── KPIs ─── */
  const kpi = ({ e, v, s = "", c = "", extra = "", tipo = "", barra = null, color = "" }) =>
    `<div class="caja co-kpi${tipo ? " " + tipo : ""}"><div class="co-k-e">${e}</div><div class="co-k-v">${v}</div>${s ? `<div class="co-k-s ${c}">${s}</div>` : ""}` +
    (barra != null ? `<div class="co-k-barra" aria-hidden="true"><i style="transform:scaleX(${Math.max(0, Math.min(1, barra)).toFixed(3)})${color ? `;background:${color}` : ""}"></i></div>` : "") + extra + `</div>`;
  function cambio30(u, p) {
    u = num(u); p = num(p);
    if (u == null || p == null) return { s: "sin comparación con los 30 días anteriores", c: "igual" };
    const d = u - p, pc = pct(u, p);
    return { s: `${flecha(d)}${signo(d)}${pc != null ? ` (${signo(pc, Math.abs(pc) < 10 ? 1 : 0)} %)` : ""} <span>frente a los 30 anteriores (${fmt(p)})</span>`, c: cls(d) };
  }
  const p1000 = n => n == null ? "–" : fmt(n, Math.abs(n) < 10 ? 2 : 1);
  const chipYT = ` <span class="co-chip co-k-chip" title="Dato de YouTube, la única red que da el texto"><i style="background:${esc(defRed("youtube").color)}"></i>YT</span>`;
  function kpisConversacion(etq) {        // los de YouTube, que es la única red con texto y respuestas
    const S = YT, sin = num(S.preguntas_sin_responder), preg = num(S.preguntas), tot = num(S.total_respuestas), nuestras = num(S.respuestas_tdr), p = num(S.pct_respondidos_tdr);
    const hechos = AJENOS.length && AJENOS.length === num(S.total_comentarios) ? AJENOS.filter(h => h.respondido_tdr).length : null;
    const au = num(S.autores_ultimos_30), ap = num(S.autores_previos_30), cau = cambio30(au, ap);
    const corr = num((S.tipos || {}).correccion), m30 = num(S.mediana_respuesta_h_30d), r30 = num(S.respondidos_30d);
    const L = [];
    if (au != null) L.push(kpi({ e: "Personas que comentan · 30 días" + etq, v: fmt(au), s: cau.s, c: cau.c,
      extra: num(S.autores_distintos) != null ? `<div class="co-k-s co-k-mas">${fmt(S.autores_distintos)} distintas desde siempre${num(S.autores_que_repiten) != null ? ` · ${fmt(S.autores_que_repiten)} repiten` : ""}${num(S.pct_del_que_mas_comenta) != null ? ` · la que más comenta hace el ${fmt(S.pct_del_que_mas_comenta, 0)} % de los comentarios` : ""}</div>` : "" }));
    L.push(
      kpi({ e: "Respuestas" + etq, v: fmt(tot), s: tot != null && nuestras != null ? `${fmt(nuestras)} nuestras · ${fmt(tot - nuestras)} de otras personas` : "" }),
      kpi({ e: "Hilos que hemos contestado" + etq, v: p == null ? "–" : fmt(p, 1) + " %", s: hechos != null ? `${fmt(hechos)} de ${plural(AJENOS.length, "hilo", "hilos")}` : "comentarios con al menos una respuesta de TDR", barra: p == null ? null : p / 100 }),
      m30 != null
        ? kpi({ e: "Tardamos en contestar · 30 días" + etq, v: horasTxt(m30), s: `mediana${r30 != null ? ` de ${plural(r30, "hilo contestado", "hilos contestados")}` : ""} · desde siempre: ${horasTxt(S.mediana_respuesta_h)}` })
        : kpi({ e: "Tardamos en contestar" + etq, v: horasTxt(S.mediana_respuesta_h), s: "mediana, del comentario a nuestra respuesta" }),
      kpi({ e: "Preguntas sin responder" + etq, v: `${fmt(sin)}${preg != null ? ` <small>de ${fmt(preg)}</small>` : ""}`, tipo: sin > 0 ? "alerta" : "",
        s: sin == null ? "" : sin > 0 ? "preguntas que esperan una respuesta de TDR" : "todas tienen respuesta nuestra",
        extra: sin > 0 && HILOS.length ? `<button type="button" class="co-enlace co-fuerte" data-pregsin="1">Verlas en la lista <span aria-hidden="true">→</span></button>` : "" }));
    if (corr != null) L.push(kpi({ e: "Correcciones" + etq, v: fmt(corr), tipo: corr > 0 ? "correccion" : "", s: "espectadores que nos corrigen un dato",
      extra: corr > 0 && HILOS.length ? `<button type="button" class="co-enlace co-fuerte" data-filtroir="correcciones">Verlas en la lista <span aria-hidden="true">→</span></button>` : "" }));
    return L;
  }
  function pintarKpis() {
    const r = est.red, el = $("kpis"), L = [];
    if (r === "global") {
      const G = C.global || {}, c = cambio30(G.ultimos_30, G.previos_30);
      const deSorteos = redesSin().reduce((a, x) => a + (num(C.redes[x].comentarios_sorteos) || 0), 0);
      L.push(kpi({ e: "Últimos 30 días", v: fmt(G.ultimos_30), s: c.s, c: c.c, tipo: "principal" }),
        kpi({ e: "Comentarios totales", v: fmt(G.total), s: deSorteos && num(G.total) != null ? `<b>Sin sorteos: ${fmt(G.total - deSorteos)}</b> · ${fmt(deSorteos)} son de sorteos de ${redesSin().filter(x => num(C.redes[x].comentarios_sorteos) > 0).map(x => defRed(x).nombre).join(" y ")}` : "las cuatro redes juntas" }));
      if (num(G.por_1000_vis) != null) L.push(kpi({ e: "Por cada 1.000 visualizaciones", v: p1000(num(G.por_1000_vis)), s: "comentarios: el interés que despierta lo que publicamos" }));
      if (YT) L.push(...kpisConversacion(chipYT));
    } else {
      const S = R(r), c = cambio30(S.ultimos_30, S.previos_30), dd = diaria(r);
      L.push(kpi({ e: "Últimos 30 días", v: fmt(S.ultimos_30), s: c.s, c: c.c, tipo: "principal" }));
      if (S.texto) {
        const arriba = num(S.comentarios_tdr_arriba);
        L.push(kpi({ e: "Comentarios totales", v: fmt(S.total_comentarios), s: `hilos${dd.primero ? ` desde el ${fecha(dd.primero)}` : ""}${arriba ? `; sin contar ${plural(arriba, "comentario nuestro", "comentarios nuestros")}` : ""}` }),
          kpi({ e: "Por cada 1.000 visualizaciones", v: p1000(num(S.por_1000_vis)), s: "comentarios: el interés que despierta lo que publicamos" }),
          ...kpisConversacion(""));
      } else {
        const sinS = num(S.total_sin_sorteos), deS = num(S.comentarios_sorteos), nS = num(S.sorteos), pub = num(S.publicaciones), conC = num(S.publicaciones_con_comentarios);
        L.push(kpi({ e: "Comentarios totales", v: fmt(S.total_comentarios), s: (deS ? `<b>Sin sorteos: ${fmt(sinS)}</b> · ` : "") + (S.desde ? `desde el ${fecha(S.desde)} (lo que guarda Metricool)` : "los que cuenta Metricool") }),
          kpi({ e: "Por cada 1.000 visualizaciones", v: p1000(num(S.por_1000_vis)), s: deS && num(S.por_1000_vis_sin_sorteos) != null ? `<b>sin sorteos: ${p1000(num(S.por_1000_vis_sin_sorteos))}</b> · comentarios por cada 1.000 visualizaciones` : "comentarios: el interés que despierta lo que publicamos" }));
        if (pub != null && conC != null) L.push(kpi({ e: "Publicaciones con comentarios", v: `${fmt(conC)} <small>de ${fmt(pub)}</small>`, s: `el ${fmt(pub ? conC / pub * 100 : 0, 0)} % de lo publicado tiene algún comentario`, barra: pub ? conC / pub : 0, color: "var(--ma30)" }));
        if (nS) L.push(kpi({ e: "Sorteos", v: fmt(nS), s: `${plural(deS || 0, "comentario", "comentarios")} de ${fmt(S.total_comentarios)} vienen de ${nS === 1 ? "él" : "ellos"}`, barra: S.total_comentarios ? (deS || 0) / S.total_comentarios : null, color: "var(--baja)" }));
      }
    }
    el.style.setProperty("--co-cols", String(L.length <= 5 ? L.length : Math.ceil(L.length / 2)));
    el.classList.toggle("impar", L.length % 2 === 1);           // en el móvil, la primera ocupa toda la fila solo si así cuadran las demás
    el.innerHTML = L.join("");
    // en Global, una tarjeta por red (pulsar = ver esa red)
    const pr = $("porred");
    if (r !== "global") { pr.innerHTML = ""; return; }
    pr.innerHTML = `<div class="co-tira" role="list" aria-label="Comentarios por red">${redesHay.filter(x => x !== "global").map(x => {
      const S = C.redes[x], c = cambio30(S.ultimos_30, S.previos_30), d = num(S.ultimos_30) != null && num(S.previos_30) != null ? S.ultimos_30 - S.previos_30 : null;
      return `<div role="listitem"><button type="button" class="co-red-c" data-red="${x}" aria-label="${esc(defRed(x).nombre)}: ${fmt(S.total_comentarios)} comentarios, ${fmt(S.ultimos_30)} en los últimos 30 días. Ver sus comentarios">
        <span class="co-chip"><i style="background:${esc(defRed(x).color)}"></i>${esc(defRed(x).nombre)}</span>
        <span class="co-rc-v">${fmt(S.total_comentarios)}<small>${S.texto ? "hilos" : "comentarios"}${num(S.comentarios_sorteos) ? ` · sin sorteos ${fmt(S.total_sin_sorteos)}` : ""}</small></span>
        <span class="co-rc-l">30 días: <b>${fmt(S.ultimos_30)}</b> <span class="${c.c}">${d == null ? "" : d === 0 ? "sin cambio" : flecha(d) + signo(d)}</span></span>
        <span class="co-rc-l">${num(S.por_1000_vis) == null ? "&nbsp;" : `<b>${p1000(num(num(S.comentarios_sorteos) ? S.por_1000_vis_sin_sorteos : S.por_1000_vis))}</b> por cada 1.000 visualizaciones${num(S.comentarios_sorteos) ? " (sin sorteos)" : ""}`}</span>
        <span class="co-rc-ir" aria-hidden="true">${S.texto ? "Ver los comentarios" : "Ver las publicaciones"} →</span></button></div>`;
    }).join("")}</div>`;
  }

  /* ─── gráficas ─── */
  let chI = null, chB = null, chA = null, datosI = null, datosB = null, datosA = null, conResp = false;
  function quitarGraficas() { [chI, chB, chA].forEach(ch => ch && ch.remove()); chI = chB = chA = null; }
  const opcGrafica = (abajo, extra = {}) => Object.assign({
    autoSize: true,
    layout: { background: { type: "solid", color: "rgba(0,0,0,0)" }, textColor: T.texto, fontFamily: T.letra, fontSize: 11, attributionLogo: false },
    grid: { vertLines: { color: T.sinRejilla ? "rgba(0,0,0,0)" : T.rejilla }, horzLines: { color: T.sinRejilla ? "rgba(0,0,0,0)" : T.rejilla } },
    rightPriceScale: { borderColor: T.borde, scaleMargins: { top: .14, bottom: abajo } },
    timeScale: { borderColor: T.borde, rightOffset: 2 },
    crosshair: { mode: LC.CrosshairMode.Normal },
    localization: { locale: "es-ES", priceFormatter: p => fmt(p, Math.abs(p) < 10 && Math.round(p) !== p ? 1 : 0), dateFormat: "dd MMM yyyy" },
  }, extra);
  const PF = { type: "custom", formatter: p => fmt(p, Math.abs(p) < 10 && Math.round(p) !== p ? 1 : 0), minMove: 1 };
  const PF2 = { type: "custom", formatter: p => fmt(p, Math.abs(p) < 10 ? 2 : 1), minMove: .01 };
  const clave = (color, txt, linea = false) => `<span><i class="${linea ? "co-k-l" : "co-k-b"}" style="background:${color}"></i>${txt}</span>`;
  const vacio = (el, msg) => { el.innerHTML = `<p class="co-nota co-vacio">${msg}</p>`; };
  const mesTxt = t => `${MES[+t.slice(5, 7) - 1]} ${t.slice(0, 4)}`;
  function pintarGraficas() {
    quitarGraficas();
    const r = est.red, dd = diaria(r), gI = $("g-i"), gB = $("g-b"), gA = $("g-a"), sorteos = sorteosDe(r), haySorteo = sorteos.size > 0;
    conResp = dd.conResp;
    raiz.querySelectorAll("[data-periodo]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.periodo === est.periodo)));

    /* 01 · interés por mes */
    const I = interesDe(r), conPreg = conTexto(r);
    datosI = I.length ? I : null;
    $("t-i").innerHTML = `Interés: comentarios por cada 1.000 visualizaciones <small>${conPreg ? "por mes, con las preguntas de cada mes" : "por mes"}${r === "global" ? " · las cuatro redes" : ""}</small>`;
    $("cl-i").innerHTML = clave(T.cI, "Comentarios por cada 1.000 visualizaciones (eje derecho)") + (haySorteo ? clave(T.cS, "mes con un sorteo") : "") +
      (conPreg ? clave(T.cP, "Preguntas en el mes (eje izquierdo)", true) : "");
    $("n-i").textContent = `Comentarios del mes divididos entre las visualizaciones del mes, por 1.000${r === "global" ? ", sumando las cuatro redes" : ""}: sube cuando comenta más gente aunque no crezcan las visualizaciones.` +
      (conPreg ? " Las preguntas son solo de YouTube, la única red que da el texto." : "") +
      (haySorteo ? " En otro color, los meses con un sorteo: los sorteos disparan los comentarios." : "") +
      ` El mes en curso va hasta el ${fecha(HASTA)}.`;
    if (!LC || !I.length) { vacio(gI, !LC ? "No se ha cargado la librería de gráficas." : `Todavía no hay datos del interés de ${esc(defRed(r).largo)}.`); $("ley-i").innerHTML = ""; }
    else {
      gI.innerHTML = "";
      chI = LC.createChart(gI, opcGrafica(0, conPreg ? { leftPriceScale: { visible: true, borderColor: T.borde, scaleMargins: { top: .14, bottom: 0 } } } : {}));
      chI.applyOptions({ localization: { timeFormatter: t => mesTxt(claveT(t)) } });
      const sI = chI.addHistogramSeries({ priceFormat: PF2, priceLineVisible: false, lastValueVisible: false });
      sI.setData(I.map(x => x.por == null ? { time: x.time } : { time: x.time, value: x.por, color: x.sorteo ? T.cS : T.cI }));
      if (conPreg) chI.addLineSeries({ priceScaleId: "left", color: T.cP, lineWidth: 2, priceFormat: PF, priceLineVisible: false, lastValueVisible: false, pointMarkersVisible: true, pointMarkersRadius: 3 })
        .setData(I.map(x => ({ time: x.time, value: x.p })));
      const porT = new Map(I.map(x => [x.time, x])), ley = $("ley-i");
      const pinta = param => {
        const k = param && param.time != null ? claveT(param.time) : null, x = (k && porT.get(k)) || I[I.length - 1];
        ley.innerHTML = `<span class="co-l-f">${mesTxt(x.time)}${x.mes === HASTA.slice(0, 7) ? ` (hasta el ${fechaCorta(HASTA)})` : ""}${x.sorteo ? " · con sorteo" : ""}</span>` +
          `<span><i style="background:${x.sorteo ? T.cS : T.cI}"></i>Por cada 1.000 <b>${p1000(x.por)}</b></span><span>Comentarios <b>${fmt(x.c)}</b></span>` +
          (conPreg ? `<span><i style="background:${T.cP}"></i>Preguntas <b>${fmt(x.p)}</b></span>` : "") + `<span>Visualizaciones <b>${fmt(x.vis)}</b></span>`;
      };
      chI.subscribeCrosshairMove(pinta); pinta(null);
      gI.setAttribute("aria-label", `Gráfica de barras por mes: comentarios por cada 1.000 visualizaciones en ${defRed(r).largo}${conPreg ? ", con una línea de las preguntas de cada mes" : ""}.`);
    }

    /* 02 · comentarios por día, semana o mes (las tres barras salen de cero y se pintan una encima de otra) */
    $("t-b").innerHTML = `Comentarios por ${NOMBRE_PER[est.periodo]} <small>${conResp ? (r === "global" ? "barras: las cuatro redes; encima, las respuestas de YouTube" : "barras: comentarios; encima, las respuestas y las nuestras") : "barras: comentarios de las publicaciones"}</small>`;
    $("cl-b").innerHTML = clave(T.cC, "Comentarios") + (haySorteo ? clave(T.cS, "con un sorteo") : "") +
      (conResp ? clave(T.cR, r === "global" ? "Respuestas en YouTube (todas)" : "Respuestas (todas)") + clave(T.cT, "Respuestas de TDR") : "");
    $("cl-a").innerHTML = clave(T.cA, "Comentarios", true) + (conResp ? clave(T.suave, "Respuestas", true) + clave(T.cT, "Respuestas de TDR", true) : "");
    const notaRed = r === "global"
      ? "Suma de las cuatro redes. YouTube cuenta cada comentario el día en que se escribió; Instagram, TikTok y Facebook, el día en que se publicó la publicación (Metricool no da la fecha de cada comentario). Las respuestas son solo de YouTube."
      : R(r).texto ? "Cada comentario cuenta el día en que se escribió, y cada respuesta, el día en que se contestó. Sin los comentarios que ponemos nosotros arriba."
        : `Comentarios de las publicaciones de ${defRed(r).nombre}, contados el día en que se publicó cada una (Metricool no da la fecha de cada comentario).`;
    $("n-b").textContent = notaRed + (conResp ? " Las barras salen de cero y se pintan una encima de otra: la roja son nuestras respuestas." : "") +
      (haySorteo ? " En otro color, los periodos con un sorteo." : "");
    if (!LC || !dd.dias.length) {
      const msg = !LC ? "No se ha cargado la librería de gráficas." : `Todavía no hay comentarios con fecha en ${esc(defRed(r).largo)}.`;
      vacio(gB, msg); vacio(gA, msg); $("ley-b").innerHTML = $("ley-a").innerHTML = ""; $("n-a").textContent = "";
      datosB = datosA = null; aplicarRango(); return;
    }
    gB.innerHTML = gA.innerHTML = "";
    const G = agrupar(dd.dias, est.periodo, sorteos), porT = new Map(G.map(x => [x.time, x]));
    datosB = G;
    chB = LC.createChart(gB, opcGrafica(0));
    const perB = est.periodo;
    chB.applyOptions({ localization: { timeFormatter: t => etiquetaPeriodo(claveT(t), perB) } });
    const base = { priceFormat: PF, priceLineVisible: false, lastValueVisible: false };
    const barra = (x, v, color) => v > 0 ? { time: x.time, value: v, color } : { time: x.time };    // los ceros, sin barra (si no, salen como una raya)
    chB.addHistogramSeries(Object.assign({ color: T.cC }, base)).setData(G.map(x => barra(x, x.c, x.sorteo ? T.cS : T.cC)));
    if (conResp) {
      chB.addHistogramSeries(Object.assign({ color: T.cR }, base)).setData(G.map(x => barra(x, x.r, T.cR)));
      chB.addHistogramSeries(Object.assign({ color: T.cT }, base)).setData(G.map(x => barra(x, x.tdr, T.cT)));
    }
    const leyB = $("ley-b");
    const pintaB = param => {
      const k = param && param.time != null ? claveT(param.time) : null, x = (k && porT.get(k)) || G[G.length - 1];
      leyB.innerHTML = `<span class="co-l-f">${etiquetaPeriodo(x.time, est.periodo)}${x.sorteo ? " · con sorteo" : ""}</span>` + `<span><i style="background:${x.sorteo ? T.cS : T.cC}"></i>Comentarios <b>${fmt(x.c)}</b></span>` +
        (conResp ? `<span><i style="background:${T.cR}"></i>Respuestas <b>${fmt(x.r)}</b></span><span><i style="background:${T.cT}"></i>De TDR <b>${fmt(x.tdr)}</b></span>` : "");
    };
    chB.subscribeCrosshairMove(pintaB); pintaB(null);
    gB.setAttribute("aria-label", `Gráfica de barras: comentarios por ${NOMBRE_PER[est.periodo]} en ${defRed(r).largo}${conResp ? ", con las respuestas y las de TDR encima" : ""}, desde el ${fecha(dd.primero)}.`);

    /* 03 · acumulado día a día */
    let a = 0, b = 0, c = 0;
    const AC = dd.dias.map(d => ({ time: d.t, c: (a += d.c), r: (b += d.r), tdr: (c += d.tdr) })), porA = new Map(AC.map(x => [x.time, x]));
    datosA = AC;
    chA = LC.createChart(gA, opcGrafica(.04));
    chA.applyOptions({ localization: { timeFormatter: t => fecha(claveT(t)) } });
    chA.addAreaSeries(Object.assign({}, base, { lineColor: T.cA, topColor: rgba(T.ma30, .26), bottomColor: rgba(T.ma30, .02), lineWidth: 2 }))
      .setData(AC.map(x => ({ time: x.time, value: x.c })));
    if (conResp) {
      chA.addLineSeries(Object.assign({}, base, { color: T.suave, lineWidth: 2 })).setData(AC.map(x => ({ time: x.time, value: x.r })));
      chA.addLineSeries(Object.assign({}, base, { color: T.cT, lineWidth: 2 })).setData(AC.map(x => ({ time: x.time, value: x.tdr })));
    }
    const leyA = $("ley-a");
    const pintaA = param => {
      const k = param && param.time != null ? claveT(param.time) : null, x = (k && porA.get(k)) || AC[AC.length - 1];
      leyA.innerHTML = `<span class="co-l-f">${fecha(x.time)}</span><span><i style="background:${T.cA}"></i>Comentarios <b>${fmt(x.c)}</b></span>` +
        (conResp ? `<span><i style="background:${T.suave}"></i>Respuestas <b>${fmt(x.r)}</b></span><span><i style="background:${T.cT}"></i>De TDR <b>${fmt(x.tdr)}</b></span>` : "");
    };
    chA.subscribeCrosshairMove(pintaA); pintaA(null);
    gA.setAttribute("aria-label", `Gráfica de área: comentarios acumulados en ${defRed(r).largo} desde el ${fecha(dd.primero)}.`);
    const total = r === "global" ? num((C.global || {}).total) : num(R(r).total_comentarios), suma = AC[AC.length - 1].c;
    $("n-a").textContent = `Desde el ${fecha(dd.primero)}, el primer día con comentarios en la serie.` +
      (total != null && total !== suma ? ` La serie suma ${plural(suma, "comentario", "comentarios")} y el total de ${r === "global" ? "las cuatro redes" : defRed(r).nombre} es ${fmt(total)}: no todos tienen fecha en la serie.` : "");
    aplicarRango();
  }
  function aplicarRango() {
    raiz.querySelectorAll("[data-rango]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.rango === est.rango)));
    const meses = (RANGOS.find(x => x[0] === est.rango) || [0, 0])[1];
    [chI, chB, chA].forEach(ch => {
      if (!ch) return;
      if (!meses) { ch.timeScale().fitContent(); return; }
      const d = new Date(HASTA + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - meses);
      const desde = ch === chI ? aIso(+d).slice(0, 7) + "-01" : aIso(+d);       // la del interés va por meses
      try { ch.timeScale().setVisibleRange({ from: desde, to: HASTA }); } catch (e) { ch.timeScale().fitContent(); }
    });
  }

  /* ─── pantalla completa (API del navegador o, si no hay, a toda la ventana) ─── */
  const enLleno = c => document.fullscreenElement === c || c.classList.contains("co-lleno");
  function botonLleno(c) {
    const b = c.querySelector("[data-lleno]"); if (!b) return;
    const si = enLleno(c);
    b.innerHTML = (si ? ICONO.salir : ICONO.lleno) + `<span class="co-icono-txt">${si ? "Salir" : "Pantalla completa"}</span>`;
    b.setAttribute("aria-pressed", String(si)); b.setAttribute("aria-label", si ? "Salir de pantalla completa" : "Ver la gráfica a pantalla completa");
  }
  async function alternarLleno(c) {
    if (enLleno(c)) { if (document.fullscreenElement === c) await document.exitFullscreen().catch(() => {}); c.classList.remove("co-lleno"); }
    else if (c.requestFullscreen && document.fullscreenEnabled) { try { await c.requestFullscreen(); } catch (e) { c.classList.add("co-lleno"); } }
    else c.classList.add("co-lleno");
    botonLleno(c);
  }
  const alCambiarLleno = () => CAJAS.forEach(botonLleno);
  const alTecla = e => {
    if (e.key !== "Escape") return;
    CAJAS.forEach(c => { if (c.classList.contains("co-lleno")) { c.classList.remove("co-lleno"); botonLleno(c); const b = c.querySelector("[data-lleno]"); if (b) b.focus(); } });
  };
  document.addEventListener("fullscreenchange", alCambiarLleno);
  document.addEventListener("keydown", alTecla);

  /* ─── 03 · Lo que nos dicen (análisis escrito en cada rutina) ─── */
  const GRUPOS = [];                       // ejemplos de cada conclusión, para «Ver los N en la lista»
  function ejemplosHTML(ids, etq, max = 1) {
    const T0 = (Array.isArray(ids) ? ids : []).map(id => POR_ID.get(id)).filter(Boolean), L = T0.slice(0, max);
    if (!L.length) return "";
    let mas = "";
    if (T0.length > L.length) { GRUPOS.push({ ids: T0.map(h => h.id), etq }); mas = `<button type="button" class="co-enlace co-ej-mas" data-grupo="${GRUPOS.length - 1}">Ver los ${fmt(T0.length)} ejemplos en la lista <span aria-hidden="true">→</span></button>`; }
    return `<ul class="co-ej" aria-label="Comentarios de ejemplo">${L.map(h => `<li><q>${esc(corto(h.texto, 140))}</q>
      <span class="co-ej-pie"><span class="co-ej-meta">${fechaCorta(h.fecha)} · ${esc(corto(h.video_titulo || "", 46))}</span>
        <button type="button" class="co-enlace" data-verhilo="${esc(h.id)}">Ver en la lista</button>${enlaceSeguro(h.url) ? `<a class="co-enlace" href="${esc(h.url)}" target="_blank" rel="noopener">Ver en YouTube ↗</a>` : ""}</span></li>`).join("")}</ul>${mas}`;
  }
  function pintarDicen() {
    const el = $("dicen");
    GRUPOS.length = 0;
    const meta = AN && (AN.actualizado || num(AN.comentarios_leidos) != null)
      ? `${AN.actualizado ? `análisis del ${fecha(AN.actualizado)}${horaDe(AN.actualizado) ? " a las " + horaDe(AN.actualizado) : ""}` : ""}${num(AN.comentarios_leidos) != null ? ` · ${plural(AN.comentarios_leidos, "comentario leído", "comentarios leídos")}` : ""}`
      : "conclusiones de los comentarios de YouTube";
    const cab = `<div class="co-caja-cab"><h2 id="${uid}-t-dicen">Lo que nos dicen <small>${esc(meta)}</small></h2></div>`;
    if (!hayAnalisis) {
      el.innerHTML = cab + `<p class="co-pendiente">El análisis se rehace en cada actualización (9:00 y 17:00).${AN ? "" : " Todavía no hay uno escrito."}</p>`;
      return;
    }
    const preg = lista("lo_que_mas_preguntan"), pat = lista("patrones"), ideas = lista("ideas_de_contenido"), ya = lista("responder_ya");
    const yaHilos = ya.map(x => ({ x, h: POR_ID.get(x.id) })).filter(o => o.h);
    const bloque = (titulo, cuerpo, extra = "") => `<div class="co-d-bloque${extra}"><h3>${titulo}</h3>${cuerpo}</div>`;
    el.innerHTML = cab + `<div class="co-d-cuerpo">
      ${AN.resumen ? `<p class="co-resumen">${esc(AN.resumen)}</p>` : ""}
      <div class="co-d-rejilla">
        ${preg.length ? bloque("Lo que más preguntan", `<ol class="co-preg">${preg.map(p => `<li>
          <div class="co-preg-cab">${p.tema ? `<span class="co-tema-etq">${esc(p.tema)}</span>` : ""}${num(p.veces) != null ? `<span class="co-veces">${veces(+p.veces)}</span>` : ""}</div>
          ${p.texto ? `<p>${esc(p.texto)}</p>` : ""}${ejemplosHTML(p.ejemplos, `Lo que más preguntan: ${p.tema || "ejemplos"}`)}</li>`).join("")}</ol>`) : ""}
        ${ya.length ? bloque(`Responder ya <span class="co-cuenta-ya">${fmt(ya.length)}</span>`, yaHilos.length ? `<ul class="co-ya">${yaHilos.map(({ x, h }) => `<li class="${h.respondido_tdr ? "hecho" : ""}">
          <div class="co-ya-meta"><span class="co-tipo ${esc(h.tipo || "otro")}">${esc((TIPOS[h.tipo] || TIPOS.otro)[0])}</span><time datetime="${esc(h.fecha)}">${fechaHora(h.fecha)}</time>
            ${h.respondido_tdr ? `<span class="co-estado tdr">Ya contestado</span>` : ""}</div>
          <p class="co-ya-txt">${esc(corto(h.texto, 220))}</p>
          <p class="co-ya-vid">En «${esc(corto(h.video_titulo || "", 70))}»</p>
          ${x.motivo ? `<p class="co-ya-por"><b>Por qué:</b> ${esc(x.motivo)}</p>` : ""}
          <div class="co-ya-acc">${enlaceSeguro(h.url) ? `<a class="co-boton" href="${esc(h.url)}" target="_blank" rel="noopener">Responder en YouTube ↗</a>` : ""}
            <button type="button" class="co-enlace" data-verhilo="${esc(h.id)}">Ver el hilo en la lista</button></div></li>`).join("")}</ul>`
          : `<p class="co-nota">Los comentarios que señala el análisis ya no están en la lista.</p>`, " co-ya-caja") : ""}
      </div>
      ${pat.length || ideas.length ? `<div class="co-d-rejilla">
        ${pat.length ? bloque("Patrones", `<ul class="co-pat">${pat.map((p, i) => `<li><p>${esc(p.texto || "")}</p>${ejemplosHTML(p.ejemplos, `Patrón ${i + 1}: ejemplos`)}</li>`).join("")}</ul>`) : ""}
        ${ideas.length ? bloque("Ideas de contenido", `<div class="co-ideas">${ideas.map(i => `<article class="co-idea">
          ${i.formato ? `<span class="co-formato ${esc(i.formato)}">${esc(FORMATO[i.formato] || i.formato)}</span>` : ""}
          <h4>${esc(i.idea || "")}</h4>${i.por_que ? `<p>${esc(i.por_que)}</p>` : ""}${ejemplosHTML(i.ejemplos, `Idea: ${corto(i.idea || "", 60)}`)}</article>`).join("")}</div>`) : ""}
      </div>` : ""}
      ${AN.sobre_nuestras_respuestas ? `<div class="co-sobre"><h3>Sobre nuestras respuestas</h3><p>${esc(AN.sobre_nuestras_respuestas)}</p></div>` : ""}
      <p class="co-nota">El análisis lo escribe la rutina de las 9:00 y las 17:00 leyendo los comentarios de YouTube (las demás redes no dan el texto).</p>
    </div>`;
  }

  /* ─── 04 · temas y tipos ─── */
  function pintarTemas() {
    const el = $("temas"), etq = est.red === "global" ? " · YouTube" : "";
    const L = (YT && Array.isArray(YT.temas) ? YT.temas : []).filter(x => Array.isArray(x) && x[0]).map(x => ({ t: String(x[0]), n: num(x[1]) || 0, p: num(x[2]) || 0 }));
    const cab = `<div class="co-caja-cab"><h2 id="${uid}-t-temas">Temas${etq} <small>comentarios y, dentro, cuántos son preguntas · pulsa uno para verlos</small></h2></div>`;
    if (!L.length) { el.innerHTML = cab + `<p class="co-nota co-hueco">Todavía no hay temas señalados.</p>`; return; }
    const TOPE = L.length <= 15 ? 15 : 12, max = Math.max(1, ...L.map(x => x.n)), ver = est.temasTodos ? L : L.slice(0, TOPE);
    el.innerHTML = cab + `<ul class="co-temas">${ver.map(x => `<li><button type="button" class="co-tema" data-tema="${esc(x.t)}" aria-label="${esc(x.t)}: ${plural(x.n, "comentario", "comentarios")}, ${plural(x.p, "pregunta", "preguntas")}. Ver en la lista">
        <span class="co-tema-nom">${esc(x.t)}</span>
        <span class="co-tema-barra" aria-hidden="true"><i style="width:${(x.n / max * 100).toFixed(1)}%"></i><i class="p" style="width:${(x.p / max * 100).toFixed(1)}%"></i></span>
        <span class="co-tema-n"><b>${fmt(x.n)}</b><small>${x.p ? plural(x.p, "pregunta", "preguntas") : "sin preguntas"}</small></span></button></li>`).join("")}</ul>
      ${L.length > TOPE ? `<button type="button" class="co-enlace co-mas-temas" data-temastodos="1">${est.temasTodos ? "Ver menos" : `Ver los ${fmt(L.length)} temas`}</button>` : ""}
      <p class="co-claves co-claves-temas" aria-hidden="true"><span><i class="co-k-b" style="background:${rgba(T.ma30, .32)}"></i>comentarios</span><span><i class="co-k-b" style="background:${T.ma30}"></i>de ellos, preguntas</span></p>`;
  }
  function pintarTipos() {
    const el = $("tipos"), etq = est.red === "global" ? " · YouTube" : "";
    const Tp = YT && YT.tipos && typeof YT.tipos === "object" ? YT.tipos : {};
    const L = [...ORDEN_TIPOS, ...Object.keys(Tp).filter(k => !ORDEN_TIPOS.includes(k))].map(k => ({ k, n: num(Tp[k]) || 0 })).filter(x => x.n > 0);
    const total = L.reduce((a, x) => a + x.n, 0);
    const cl = num(YT && YT.clasificados_por_claude);
    const cab = `<div class="co-caja-cab"><h2 id="${uid}-t-tipos">Qué tipo de comentario${etq} <small>reparto de los ${fmt(total)} comentarios · pulsa uno para verlos</small></h2></div>`;
    const pie = `<p class="co-nota co-hueco">${cl ? `Los ha clasificado Claude leyendo el texto (${fmt(cl)} de ${fmt(total)}). ` : ""}Corrección: un espectador nos corrige un dato. Sin contar los comentarios que ponemos nosotros.</p>`;
    if (!total) { el.innerHTML = cab + `<p class="co-nota co-hueco">Todavía no hay comentarios clasificados.</p>`; return; }
    const nom = k => (TIPOS[k] || [k, k])[1];
    el.innerHTML = cab + `<div class="co-tipos-cuerpo">
      <div class="co-reparto" role="img" aria-label="${esc(L.map(x => `${nom(x.k)}: ${fmt(x.n)} (${fmt(x.n / total * 100, 0)} %)`).join("; "))}">${L.map(x => `<i class="co-t-${esc(x.k)}" style="flex-grow:${x.n}" title="${esc(nom(x.k))}: ${fmt(x.n)}"></i>`).join("")}</div>
      <ul class="co-tipos">${L.map(x => `<li><button type="button" class="co-tipo-b" data-tipo="${esc(x.k)}">
        <i class="co-t-${esc(x.k)}" aria-hidden="true"></i><span>${esc(nom(x.k))}</span><b>${fmt(x.n)}</b><small>${fmt(x.n / total * 100, x.n / total < .1 ? 1 : 0)} %</small></button></li>`).join("")}</ul>
      </div>${pie}`;
  }

  /* ─── 05 · lista de comentarios (YouTube) ─── */
  const EXTRA = {
    tema: v => ({ etq: `Tema: ${v}`, fn: h => Array.isArray(h.temas) && h.temas.includes(v) }),
    tipo: v => ({ etq: `Tipo: ${(TIPOS[v] || [v, v])[1]}`, fn: h => (h.tipo || "otro") === v }),
    id: v => ({ etq: "Un comentario concreto", fn: h => h.id === v }),
    grupo: v => ({ etq: v.etq, fn: h => v.ids.includes(h.id) }),
    pregsin: () => ({ etq: "Preguntas sin responder", fn: h => h.tipo === "pregunta" && !h.respondido_tdr && !h.de_tdr }),
  };
  const filtroFn = { todos: () => true, preguntas: h => h.tipo === "pregunta", sinresp: h => !h.respondido_tdr && !h.de_tdr, tdr: h => !!h.respondido_tdr,
    peticiones: h => h.tipo === "peticion", correcciones: h => h.tipo === "correccion" };
  function filtrados() {
    const ex = est.extra ? EXTRA[est.extra.k](est.extra.v) : null, q = sinTildes(est.q).trim().split(/\s+/).filter(Boolean);
    let L = HILOS.filter(h => filtroFn[est.filtro](h) && (!ex || ex.fn(h)));
    if (q.length) L = L.filter(h => { const s = sinTildes([h.texto, h.video_titulo, ...(h.temas || []), (TIPOS[h.tipo] || [""])[0], ...(h.respuestas || []).map(x => x && x.texto)].join(" ")); return q.every(p => s.includes(p)); });
    const nr = h => (h.respuestas || []).length, f = h => String(h.fecha || "");
    return L.slice().sort((a, b) => est.orden === "likes" ? (num(b.likes) || 0) - (num(a.likes) || 0) || f(b).localeCompare(f(a))
      : est.orden === "respuestas" ? nr(b) - nr(a) || f(b).localeCompare(f(a)) : f(b).localeCompare(f(a)));
  }
  function pintarListaCaja() {
    const el = $("lista"), etq = est.red === "global" ? " · YouTube" : "";
    const cuenta = k => HILOS.filter(filtroFn[k]).length;
    el.innerHTML = `<div class="co-caja-cab"><h2 id="${uid}-t-lista">Comentarios${etq} <small>sin nombres: la página es pública</small></h2>
        <div class="co-botones">${descargas("hilos", "los comentarios de la lista, con los filtros puestos")}</div></div>
      <div class="co-l-mandos">
        <div class="co-grupo co-filtros" role="group" aria-label="Qué comentarios se ven">${FILTROS.map(([k, n]) => `<button type="button" data-filtro="${k}" aria-pressed="${est.filtro === k}">${n} <small>${fmt(cuenta(k))}</small></button>`).join("")}</div>
        <div class="co-l-fila">
          <label class="co-buscar"><span class="co-solo-lector">Buscar en los comentarios</span>${ICONO.lupa}<input type="search" data-co="q" value="${esc(est.q)}" placeholder="Buscar: texto, vídeo o tema" autocomplete="off" enterkeyhint="search"></label>
          <div class="co-grupo co-orden" role="group" aria-label="Orden">${ORDENES.map(([k, n]) => `<button type="button" data-orden="${k}" aria-pressed="${est.orden === k}">${n}</button>`).join("")}</div>
        </div>
      </div>
      <div data-co="extra"></div>
      <p class="co-cuenta" data-co="cuenta" aria-live="polite"></p>
      <ol class="co-hilos" data-co="hilos"></ol>
      <div class="co-l-pie" data-co="lpie"></div>`;
    const q = $("q"); let tq = 0;
    q.addEventListener("input", () => { clearTimeout(tq); tq = setTimeout(() => { est.q = q.value; est.ver = POR_PAGINA; pintarHilos(); }, 160); });
    pintarHilos();
  }
  function hiloHTML(h) {
    const resp = Array.isArray(h.respuestas) ? h.respuestas.filter(Boolean) : [], abierto = est.abiertos.has(h.id), id = DOMID.get(h.id);
    const tdr = resp.filter(x => x.es_tdr).length, nuestro = !!h.de_tdr, tipo = nuestro ? "nuestro" : TIPOS[h.tipo] ? h.tipo : "otro";
    const espera = !nuestro && !h.respondido_tdr && (tipo === "pregunta" || tipo === "peticion" || tipo === "correccion");
    const url = enlaceSeguro(h.url), uv = urlVideo(h), vt = h.video_tipo === "largo" ? "Largo" : h.video_tipo === "short" ? "Short" : "";
    const estado = nuestro ? `<span class="co-estado tdr">Comentario nuestro: no cuenta en las cifras</span>`
      : h.respondido_tdr ? `<span class="co-estado tdr"><img src="${esc(LOGO)}" alt="" width="16" height="16">Contestado por TDR${num(h.horas_hasta_respuesta) != null ? ` en ${horasTxt(h.horas_hasta_respuesta)}` : ""}</span>`
        : `<span class="co-estado ${espera ? "sin" : "nada"}">Sin respuesta de TDR</span>`;
    return `<li class="co-hilo${abierto ? " abierto" : ""}${espera ? " espera" : ""}${nuestro ? " nuestro" : ""}" id="${id}"><article tabindex="-1" aria-labelledby="${id}-t">
      <div class="co-h-meta">${nuestro ? `<span class="co-nuestro"><img src="${esc(LOGO)}" alt="" width="20" height="20"><b>TDR</b></span>` : ""}
        <time datetime="${esc(h.fecha)}">${fechaHora(h.fecha)}</time>${h.nuevo && !TODOS_NUEVOS ? `<span class="co-nuevo">Nuevo</span>` : ""}
        <span class="co-h-donde">${vt ? `<span class="co-vt">${vt}</span>` : ""}${uv ? `<a class="co-h-vid" href="${esc(uv)}" target="_blank" rel="noopener">${esc(corto(h.video_titulo || "(vídeo sin título)", 80))}</a>` : `<span class="co-h-vid">${esc(corto(h.video_titulo || "", 80))}</span>`}</span></div>
      <p class="co-h-txt" id="${id}-t">${esc(h.texto || "")}</p>
      <div class="co-h-pie"><span class="co-h-etq"><span class="co-tipo ${tipo}">${esc(TIPOS[tipo][0])}</span>${(h.temas || []).map(t => `<span class="co-tema-etq">${esc(t)}</span>`).join("")}
        ${h.revisado === false && !nuestro ? `<span class="co-likes">sin clasificar todavía</span>` : ""}
        ${num(h.likes) ? `<span class="co-likes">${plural(+h.likes, "me gusta", "me gusta")}</span>` : ""}</span>
        ${estado}
        ${resp.length ? `<button type="button" class="co-h-abrir" data-abrir="${esc(h.id)}" aria-expanded="${abierto}" aria-controls="${id}-r">${abierto ? "Ocultar" : "Ver"} ${plural(resp.length, "respuesta", "respuestas")}${tdr && !abierto ? ` <small>(${tdr === resp.length ? (tdr === 1 ? "la nuestra" : "todas nuestras") : fmt(tdr) + " nuestra" + (tdr === 1 ? "" : "s")})</small>` : ""} ${ICONO.abajo}</button>` : ""}
        ${url ? `<a class="co-h-yt" href="${esc(url)}" target="_blank" rel="noopener">Ver en YouTube ↗</a>` : ""}
      </div>
      ${resp.length ? `<ol class="co-resp" id="${id}-r"${abierto ? "" : " hidden"}>${resp.map(x => `<li class="co-r${x.es_tdr ? " tdr" : ""}">
        <div class="co-r-cab">${x.es_tdr ? `<img src="${esc(LOGO)}" alt="" width="20" height="20"><b>TDR</b><span class="co-r-quien">nuestra respuesta</span>` : `<b class="co-r-otro">Respuesta</b>`}
          <time datetime="${esc(x.fecha)}">${fechaHora(x.fecha)}</time>${num(x.likes) ? `<span class="co-likes">${plural(+x.likes, "me gusta", "me gusta")}</span>` : ""}</div>
        <p>${esc(x.texto || "")}</p></li>`).join("")}</ol>` : ""}
    </article></li>`;
  }
  function pintarHilos() {
    const L = filtrados(), ver = L.slice(0, est.ver), ex = est.extra ? EXTRA[est.extra.k](est.extra.v) : null;
    raiz.querySelectorAll("[data-filtro]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filtro === est.filtro)));
    raiz.querySelectorAll("[data-orden]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.orden === est.orden)));
    $("extra").innerHTML = ex ? `<p class="co-extra">Mostrando: <b>${esc(ex.etq)}</b><button type="button" class="co-quitar" data-quitar="1" aria-label="Quitar el filtro «${esc(ex.etq)}»">${ICONO.cerrar}<span>Quitar</span></button></p>` : "";
    $("cuenta").textContent = !HILOS.length ? "" : L.length ? `Se ven ${fmt(ver.length)} de ${plural(L.length, "comentario", "comentarios")}${L.length < HILOS.length ? ` (hay ${fmt(HILOS.length)} en total)` : ""}.` : "";
    $("hilos").innerHTML = ver.map(hiloHTML).join("") ||
      `<li class="co-vacio-l">${HILOS.length ? "Ningún comentario con estos filtros." : "Todavía no hay comentarios con texto."}</li>`;
    $("lpie").innerHTML = L.length > ver.length ? `<button type="button" class="co-mas" data-mas="1">Ver ${fmt(Math.min(POR_PAGINA, L.length - ver.length))} más <small>quedan ${fmt(L.length - ver.length)}</small></button>` : "";
  }
  function irALista(foco) {
    const el = $("lista"), suave = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (foco) { const a = raiz.querySelector(`#${CSS.escape(foco)} article`); if (a) { a.scrollIntoView({ block: "center", behavior: suave }); a.focus({ preventScroll: true }); return; } }
    el.scrollIntoView({ block: "start", behavior: suave });
    const h = el.querySelector("h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }
  function ponerExtra(k, v) {
    est.extra = { k, v }; est.filtro = "todos"; est.q = ""; est.ver = POR_PAGINA;
    if (k === "id") est.abiertos.add(v);
    if (!conTexto(est.red)) { est.red = "youtube"; guardar(); pintarTodo(); } else { const q = $("q"); if (q) q.value = ""; pintarHilos(); }
    irALista(k === "id" ? DOMID.get(v) : null);
  }

  /* ─── 06 · qué genera más comentarios (vídeos o publicaciones) ─── */
  function filasTabla() {
    const r = est.red, out = [];
    const TP = { short: "Short", largo: "Largo", reel: "Reel", post: "Post" };
    const deYT = () => (YT && Array.isArray(YT.por_video) ? YT.por_video : []).map(v => ({ red: "youtube", titulo: v.titulo, url: enlaceSeguro(v.url) || (v.video_id ? `https://www.youtube.com/watch?v=${encodeURIComponent(v.video_id)}` : null),
      fecha: null, tipo: TP[v.tipo] || "", sorteo: false, c: num(v.comentarios), resp: num(v.respuestas), tdr: num(v.respuestas_tdr), vis: null }));
    const deRed = x => (Array.isArray(C.redes[x].por_publicacion) ? C.redes[x].por_publicacion : []).map(p => ({ red: x, titulo: p.titulo, url: enlaceSeguro(p.url), fecha: p.fecha || null,
      tipo: TP[p.tipo] || "", sorteo: !!p.sorteo, c: num(p.comentarios), resp: null, tdr: null, vis: num(p.vis) }));
    if (r === "global") { if (YT) out.push(...deYT()); redesSin().forEach(x => out.push(...deRed(x))); }
    else if (R(r).texto) out.push(...deYT());
    else out.push(...deRed(r));
    return out.filter(x => x.c != null && x.c > 0).sort((a, b) => b.c - a.c || String(b.fecha || "").localeCompare(String(a.fecha || "")));
  }
  function pintarTabla() {
    const el = $("tabla"), r = est.red, F = filasTabla(), esYT = r !== "global" && R(r).texto, esG = r === "global";
    const titulo = esG ? "Qué genera más comentarios" : esYT ? "Por vídeo" : "Por publicación";
    const sub = esG ? "vídeos de YouTube y publicaciones de las demás redes, juntos" : esYT ? "qué vídeos generan más conversación" : `qué publicaciones de ${esc(defRed(r).nombre)} tienen comentarios`;
    const cab = `<div class="co-caja-cab"><h2 id="${uid}-t-tabla">${titulo} <small>${sub}</small></h2><div class="co-botones">${descargas("tabla", "la tabla completa")}</div></div>`;
    if (!F.length) { el.innerHTML = cab + `<p class="co-nota co-hueco">Sin ${esYT ? "vídeos" : "publicaciones"} con comentarios en los datos.</p>`; return; }
    const max = Math.max(1, ...F.map(x => x.c)), ver = est.tablaToda ? F : F.slice(0, FILAS_TABLA);
    const hayResp = F.some(x => x.resp != null), hayVis = F.some(x => x.vis != null), hayFecha = F.some(x => x.fecha);
    const pub = !esG && !esYT ? num(R(r).publicaciones) : null;
    el.innerHTML = cab + `<div class="co-tabla-caja"><table class="co-tabla">
      <thead><tr>${esG ? `<th scope="col">Red</th>` : ""}${hayFecha ? `<th scope="col">Fecha</th>` : ""}<th scope="col">${esYT ? "Vídeo" : esG ? "Vídeo o publicación" : "Publicación"}</th><th scope="col" class="n">Comentarios</th>
        ${hayResp ? `<th scope="col" class="n">Respuestas</th><th scope="col" class="n">De TDR</th>` : ""}${hayVis ? `<th scope="col" class="n">Visualizaciones</th><th scope="col" class="n">Por cada 1.000</th>` : ""}</tr></thead>
      <tbody>${ver.map(x => `<tr>${esG ? `<td><span class="co-chip"><i style="background:${esc(defRed(x.red).color)}"></i>${esc(defRed(x.red).corto)}</span></td>` : ""}
        ${hayFecha ? `<td class="f">${x.fecha ? fecha(x.fecha) : "–"}</td>` : ""}
        <td class="t">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(corto(x.titulo || "(sin título)", 90))}</a>` : esc(corto(x.titulo || "(sin título)", 90))}
          ${x.tipo || x.sorteo ? `<span class="co-t-etqs">${x.tipo ? `<span class="co-vt">${x.tipo}</span>` : ""}${x.sorteo ? `<span class="co-sorteo">Sorteo</span>` : ""}</span>` : ""}</td>
        <td class="n co-celda-barra" style="--w:${(x.c / max * 100).toFixed(1)}"><span>${fmt(x.c)}</span></td>
        ${hayResp ? `<td class="n">${fmt(x.resp)}</td><td class="n">${fmt(x.tdr)}</td>` : ""}
        ${hayVis ? `<td class="n">${fmt(x.vis)}</td><td class="n">${x.vis ? p1000(x.c / x.vis * 1000) : "–"}</td>` : ""}</tr>`).join("")}</tbody></table></div>
      ${F.length > FILAS_TABLA ? `<button type="button" class="co-enlace co-mas-tabla" data-tablatoda="1" aria-expanded="${est.tablaToda}">${est.tablaToda ? `Ver solo los ${FILAS_TABLA} primeros` : `Ver los ${fmt(F.length)}`}</button>` : ""}
      <p class="co-nota co-hueco">${esYT ? "Solo los vídeos con algún comentario." : pub != null ? `Solo las publicaciones con algún comentario: ${fmt(F.length)} de las ${fmt(pub)} que da Metricool.` : "Solo lo que tiene algún comentario."}${hayVis ? " «Por cada 1.000»: comentarios por cada 1.000 visualizaciones de esa publicación (Metricool)." : ""}</p>`;
  }

  /* ─── descargas ─── */
  function rangoVisible(ch) { const r = ch && ch.timeScale().getVisibleRange(); return r ? { from: claveT(r.from), to: claveT(r.to) } : null; }
  const dentro = (t, r) => !r || (t >= r.from && t <= r.to);
  function defDe(que) {
    const r = est.red, nombreR = defRed(r).largo;
    if (que === "interes" && datosI) {
      const rv = rangoVisible(chI), conPreg = conTexto(r), conS = datosI.some(x => x.sorteo);
      return { def: { columnas: ["Mes", "Comentarios", ...(conPreg ? ["Preguntas"] : []), "Visualizaciones", "Comentarios por cada 1.000 visualizaciones", ...(conS ? ["Mes con sorteo"] : [])],
          tipos: ["fecha", "n0", ...(conPreg ? ["n0"] : []), "n0", "n2", "txt"],
          filas: datosI.filter(x => !rv || (x.time >= rv.from.slice(0, 7) + "-01" && x.time <= rv.to)).map(x => [x.time, x.c, ...(conPreg ? [x.p] : []), x.vis, x.por, ...(conS ? [x.sorteo ? "sí" : "no"] : [])]) },
        meta: { titulo: `Interés: comentarios por cada 1.000 visualizaciones · ${nombreR}`, slug: "comentarios-interes", periodo: "mes", cadaFila: "un mes (la fecha es el día 1)", nota: $("n-i").textContent } };
    }
    if (que === "barras" && datosB) {
      const rv = rangoVisible(chB);
      return { def: { columnas: [est.periodo === "dia" ? "Día" : est.periodo === "semana" ? "Semana (lunes)" : "Mes", "Comentarios", ...(conResp ? ["Respuestas", "Respuestas de TDR"] : [])],
          tipos: ["fecha", "n0", "n0", "n0"], filas: datosB.filter(x => dentro(x.time, rv)).map(x => [x.time, x.c, ...(conResp ? [x.r, x.tdr] : [])]) },
        meta: { titulo: `Comentarios por ${NOMBRE_PER[est.periodo]} · ${nombreR}`, slug: "comentarios", periodo: est.periodo, cadaFila: `un ${NOMBRE_PER[est.periodo]}`, nota: $("n-b").textContent } };
    }
    if (que === "acum" && datosA) {
      const rv = rangoVisible(chA);
      return { def: { columnas: ["Día", "Comentarios acumulados", ...(conResp ? ["Respuestas acumuladas", "Respuestas de TDR acumuladas"] : [])],
          tipos: ["fecha", "n0", "n0", "n0"], filas: datosA.filter(x => dentro(x.time, rv)).map(x => [x.time, x.c, ...(conResp ? [x.r, x.tdr] : [])]) },
        meta: { titulo: `Comentarios acumulados · ${nombreR}`, slug: "comentarios-acumulados", cadaFila: "un día", nota: $("n-a").textContent } };
    }
    if (que === "hilos") {
      const L = filtrados(), ex = est.extra ? EXTRA[est.extra.k](est.extra.v) : null;
      const filtro = [FILTROS.find(f => f[0] === est.filtro)[1], ex && ex.etq, est.q.trim() && `búsqueda «${est.q.trim()}»`].filter(Boolean).join(" · ");
      return { def: { columnas: ["Fecha", "Vídeo", "Short o largo", "Tipo", "Temas", "Comentario", "Me gusta", "Respuestas", "Respuestas de TDR", "Contestado por TDR", "Horas hasta nuestra respuesta", "Enlace"],
          tipos: ["fechahora", "txt", "txt", "txt", "txt", "txt", "n0", "n0", "n0", "txt", "n1", "url"],
          filas: L.map(h => { const rs = (h.respuestas || []).filter(Boolean); return [String(h.fecha || "").replace("T", " ").slice(0, 16), h.video_titulo || "", h.video_tipo || "",
            h.de_tdr ? "Nuestro" : (TIPOS[h.tipo] || TIPOS.otro)[0],
            (h.temas || []).join(", "), h.texto || "", num(h.likes), rs.length, rs.filter(x => x.es_tdr).length, h.de_tdr ? "es nuestro" : h.respondido_tdr ? "sí" : "no", num(h.horas_hasta_respuesta), h.url || ""]; }), anchos: [16, 44, 10, 14, 24, 80, 8, 10, 10, 12, 12, 40] },
        meta: { titulo: "Comentarios de YouTube", slug: "comentarios-lista", cadaFila: "un comentario (hilo)", alcance: filtro, nota: "Sin nombres de autor: la página es pública." } };
    }
    if (que === "tabla") {
      const F = filasTabla(), esG = r === "global";
      return { def: { columnas: [...(esG ? ["Red"] : []), "Fecha", "Título", "Tipo", "Sorteo", "Enlace", "Comentarios", "Respuestas", "Respuestas de TDR", "Visualizaciones", "Comentarios por cada 1.000 visualizaciones"],
          tipos: [...(esG ? ["txt"] : []), "fechahora", "txt", "txt", "txt", "url", "n0", "n0", "n0", "n0", "n2"],
          filas: F.map(x => [...(esG ? [defRed(x.red).nombre] : []), x.fecha || "", x.titulo || "", x.tipo || "", x.sorteo ? "sí" : "", x.url || "", x.c, x.resp, x.tdr, x.vis, x.vis ? x.c / x.vis * 1000 : null]) },
        meta: { titulo: `${esG ? "Qué genera más comentarios" : "Comentarios por publicación"} · ${nombreR}`, slug: "comentarios-por-publicacion", cadaFila: "una publicación o un vídeo" } };
    }
    return null;
  }
  async function descargar(que, formato, boton) {
    const d = defDe(que), estado = $("estado");
    if (!d || !d.def.filas.length) { estado.textContent = "No hay datos que descargar con lo que se ve."; return; }
    d.meta.vista = "comentarios-" + est.red; d.meta.vistaNombre = "Comentarios · " + defRed(est.red).largo;
    if (typeof opciones.descargar === "function") { await opciones.descargar(d.def, d.meta, formato, boton); return; }
    const nombre = ["TDR-redes", d.meta.vista, d.meta.slug, d.meta.periodo, HASTA].filter(Boolean).join("-") + ".csv";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csvPropio(d.def)], { type: "text/csv;charset=utf-8" })); a.download = nombre; a.hidden = true;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    estado.textContent = `Descargado ${nombre} · ${fmt(d.def.filas.length)} filas`;
  }

  /* ─── clics (todo por delegación) ─── */
  function elegirRed(r) {
    if (!redesHay.includes(r)) return;
    if (r !== est.red) { est.red = r; est.tablaToda = false; guardar(); pintarTodo(); }
  }
  raiz.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !raiz.contains(b)) return;
    const d = b.dataset;
    if (d.red) { const foco = b.closest('[data-co="redes"]'); elegirRed(d.red); if (foco) { const n = raiz.querySelector(`[data-co="redes"] [data-red="${CSS.escape(d.red)}"]`); if (n) n.focus(); } else window.scrollTo({ top: Math.max(0, raiz.getBoundingClientRect().top + window.scrollY - 120), behavior: "auto" }); }
    else if (d.periodo) { est.periodo = d.periodo; guardar(); pintarGraficas(); }
    else if (d.rango) { est.rango = d.rango; guardar(); aplicarRango(); }
    else if (d.lleno) alternarLleno(b.closest(".co-graf-caja"));
    else if (d.desc) descargar(d.desc, d.formato, b);
    else if (d.filtro) { est.filtro = d.filtro; est.ver = POR_PAGINA; pintarHilos(); }
    else if (d.orden) { est.orden = d.orden; est.ver = POR_PAGINA; guardar(); pintarHilos(); }
    else if (d.quitar) { est.extra = null; est.ver = POR_PAGINA; pintarHilos(); const q = $("q"); if (q) q.focus(); }
    else if (d.mas) { const antes = est.ver; est.ver += POR_PAGINA; pintarHilos(); const L = raiz.querySelectorAll('[data-co="hilos"] > li article'); if (L[antes]) L[antes].focus(); }
    else if (d.abrir) {
      const id = d.abrir, li = b.closest(".co-hilo"), ol = li && li.querySelector(".co-resp"), si = !est.abiertos.has(id);
      si ? est.abiertos.add(id) : est.abiertos.delete(id);
      const h = POR_ID.get(id); if (li && h) { const n = document.createElement("template"); n.innerHTML = hiloHTML(h).trim(); li.replaceWith(n.content.firstChild);
        const nb = raiz.querySelector(`#${CSS.escape(DOMID.get(id))} [data-abrir]`); if (nb) nb.focus(); }
      else if (ol) ol.hidden = !si;
    }
    else if (d.verhilo) ponerExtra("id", d.verhilo);
    else if (d.grupo) { const g = GRUPOS[+d.grupo]; if (g) ponerExtra("grupo", { ids: g.ids.slice(), etq: g.etq }); }
    else if (d.tema) ponerExtra("tema", d.tema);
    else if (d.tipo) ponerExtra("tipo", d.tipo);
    else if (d.pregsin) ponerExtra("pregsin");
    else if (d.filtroir) { est.extra = null; est.q = ""; est.ver = POR_PAGINA; est.filtro = d.filtroir; if (!conTexto(est.red)) { est.red = "youtube"; guardar(); pintarTodo(); } else { const q = $("q"); if (q) q.value = ""; pintarHilos(); } irALista(); }
    else if (d.temastodos) { est.temasTodos = !est.temasTodos; pintarTemas(); }
    else if (d.tablatoda) { est.tablaToda = !est.tablaToda; pintarTabla(); const n = raiz.querySelector("[data-tablatoda]"); if (n) n.focus(); }
  });

  /* ─── pintar ─── */
  function pintarTodo() {
    leerTema();
    raiz.style.setProperty("--co-color", defRed(est.red).color);
    raiz.querySelectorAll("[data-solo='texto']").forEach(x => { x.hidden = !conTexto(est.red); });
    pintarCabecera();
    pintarKpis();
    pintarGraficas();
    if (conTexto(est.red)) { pintarDicen(); pintarTemas(); pintarTipos(); pintarListaCaja(); }
    pintarTabla();
    const arriba = num(YT && YT.comentarios_tdr_arriba);
    $("avisos").innerHTML = `<p class="co-nota">Comentarios: datos del ${esc(GEN)}. YouTube da el texto, la fecha y las respuestas de cada comentario (aquí sin nombres); Instagram, TikTok y Facebook, a través de Metricool, solo cuántos comentarios tiene cada publicación.` +
      `${arriba ? ` Los ${fmt(arriba)} comentarios que ponemos nosotros en nuestros vídeos salen en la lista con el logo, pero no cuentan en las cifras.` : ""}` +
      `${TODOS_NUEVOS && conTexto(est.red) ? " Es la primera carga: todos los comentarios han llegado en esta actualización; desde la próxima, los que lleguen saldrán como «Nuevo»." : ""}</p>`;
    alCambiarLleno();
  }
  pintarTodo();

  return {
    actualizarTema() {
      if (!raiz.isConnected) return;
      const v = [chI, chB, chA].map(ch => ch ? ch.timeScale().getVisibleLogicalRange() : null);
      leerTema(); pintarGraficas(); if (conTexto(est.red)) pintarTemas();
      [chI, chB, chA].forEach((ch, i) => { if (ch && v[i]) try { ch.timeScale().setVisibleLogicalRange(v[i]); } catch (e) { /* fuera de datos */ } });
    },
    elegirRed,
    destruir() {
      document.removeEventListener("fullscreenchange", alCambiarLleno);
      document.removeEventListener("keydown", alTecla);
      if (document.fullscreenElement && raiz.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {});
      quitarGraficas();
      raiz.remove();
      if (linkCss && !document.querySelector(".co")) linkCss.remove();
    },
  };
}
export default montarComentarios;
