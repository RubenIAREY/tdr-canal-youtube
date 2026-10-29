/* Pestañas de negocio del panel (29/10/2026): Tienda, Analytics, Search Console y Urgente.
   Pinta cualquier «informe» JSON que generan PANEL-REDES/tienda_datos.py, ga_datos.py, gsc_datos.py y urgente_datos.py:
     {titulo, ticker, subtitulo, actualizado, periodo, avisos: [...], secciones: [{id, titulo, bloques: [...]}], fuentes}
   Bloques: kpis · serie (línea o barras) · barras (horizontales) · tabla (ordenable, con «ver todo») · avisos · texto.
   Los datos llegan cifrados: el fetch que usa este módulo ya lo descifra comun/candado.js.
   Uso: const inf = await montarInforme(contenedor, { datos: "../datos/ga.json", clave: "tdr-terminal-papel-2-ga" });
        inf.irA("canales"); inf.actualizarTema(); inf.destruir(); */

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NF = {};
const nf = (min, max) => (NF[min + "-" + max] ||= new Intl.NumberFormat("es-ES", { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: "always" }));
const WEB = "https://todoenrecambio.com";

function fmt(v, f = "num") {
  if (v == null || v === "" || (typeof v === "number" && isNaN(v))) return "–";
  if (typeof v === "boolean") return v ? "sí" : "no";
  switch (f) {
    case "num": return nf(0, Math.abs(v) < 10 && v % 1 ? 1 : 0).format(v);
    case "num1": return nf(0, 2).format(v);
    case "eur": return nf(2, 2).format(v) + " €";
    case "eur0": return nf(0, 0).format(v) + " €";
    case "pct": return nf(0, Math.abs(v) < 10 ? 2 : 1).format(v) + " %";
    case "pos": return nf(1, 1).format(v);
    case "seg": { const s = Math.round(v); return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`; }
    default: return esc(v);
  }
}
const clsVar = (n, mejor = "sube") => n == null || isNaN(n) || n === 0 || mejor === "neutro" ? "igual" : (n > 0) === (mejor !== "baja") ? "sube" : "baja";
const flecha = n => n == null || isNaN(n) ? "" : n > 0 ? "▲ " : n < 0 ? "▼ " : "■ ";
const varTxt = (n, mejor) => n == null ? "" : `<span class="${clsVar(n, mejor)}">${flecha(n)}${n > 0 ? "+" : ""}${nf(0, 1).format(n)} %</span>`;
const corta = u => { try { const x = new URL(u, WEB); return decodeURIComponent(x.pathname + (x.hash || "")).replace(/\/$/, "") || "/"; } catch (e) { return String(u); } };

function celda(v, f) {
  if (f === "var") return varTxt(v);
  if (f === "dif") return v == null ? "–" : `<span class="${v > 0 ? "sube" : v < 0 ? "baja" : "igual"}">${v > 0 ? "+" : ""}${nf(0, 0).format(v)}</span>`;
  if (f === "sino") return v ? "sí" : `<span class="baja">no</span>`;
  if (f === "url" && v) return `<a href="${esc(v)}" target="_blank" rel="noopener" title="${esc(v)}">${esc(corta(v))}</a>`;
  if (f === "ruta" && v) return String(v).startsWith("/") ? `<a href="${esc(WEB + v)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
  return fmt(v, f);
}

/* ─────────── bloques ─────────── */
function bKpis(b) {
  return `<div class="kpis">${b.items.map(k => `<div class="caja kpi"><div class="e">${esc(k.etiqueta)}</div><div class="v">${fmt(k.valor, k.formato)}</div>
    <div class="s">${k.var != null ? varTxt(k.var, k.mejor) + ` <span class="inf-antes">antes ${fmt(k.antes, k.formato)}</span>` : k.antes != null ? `<span class="inf-antes">antes ${fmt(k.antes, k.formato)}</span>` : ""}${k.nota ? `<span class="inf-kn">${esc(k.nota)}</span>` : ""}${k.var == null && k.antes == null && !k.nota ? "&nbsp;" : ""}</div></div>`).join("")}</div>`;
}

function bBarras(b) {
  const max = Math.max(1e-9, ...b.filas.map(f => Math.abs(f.valor || 0)));
  return `<ul class="inf-barras">${b.filas.map(f => `<li><span class="et" title="${esc(f.etiqueta)}">${esc(f.etiqueta)}</span>
    <span class="pista"><i style="transform:scaleX(${Math.max(0, (f.valor || 0) / max)})"></i></span><span class="val">${fmt(f.valor, b.formato)}${f.extra ? ` <small>${esc(f.extra)}</small>` : ""}</span></li>`).join("")}</ul>`;
}

function bTabla(b, id) {
  return `<div class="tabla-wrap"><table class="tabla inf-tabla" data-t="${id}"><thead><tr>${b.columnas.map((c, i) =>
    `<th class="${c.f !== "txt" && c.f !== "url" && c.f !== "ruta" ? "n" : ""}" data-i="${i}" role="button" tabindex="0" title="Ordenar">${esc(c.t)}</th>`).join("")}</tr></thead>
    <tbody></tbody></table></div>${b.filas.length > (b.visibles || 12) ? `<button type="button" class="mas inf-vertodo" data-t="${id}">Ver las ${b.filas.length} filas <span aria-hidden="true">↓</span></button>` : ""}`;
}
function filasTabla(b, abierta, orden) {
  let F = b.filas.slice();
  if (orden) {
    const c = b.columnas[orden.i], k = c.k, txt = c.f === "txt" || c.f === "url" || c.f === "ruta";
    F.sort((x, y) => { const a = x[k], z = y[k]; if (a == null) return 1; if (z == null) return -1;
      return (txt ? String(a).localeCompare(String(z), "es") : a - z) * orden.dir; });
  }
  if (!abierta) F = F.slice(0, b.visibles || 12);
  return F.map(f => `<tr>${b.columnas.map(c => `<td class="${c.f !== "txt" && c.f !== "url" && c.f !== "ruta" ? "n" : ""}">${celda(f[c.k], c.f)}</td>`).join("")}</tr>`).join("") ||
    `<tr><td colspan="${b.columnas.length}" class="inf-vacio">Nada que enseñar.</td></tr>`;
}

const NIVEL = { alta: "Urgente", media: "Esta semana", baja: "Cuando haya hueco", info: "Información" };
function bAvisos(b) {
  return `<ul class="inf-avisos">${b.items.map(a => `<li class="inf-aviso n-${esc(a.nivel)}"><div class="cab"><span class="nivel">${NIVEL[a.nivel] || esc(a.nivel)}</span>${a.area ? `<span class="area">${esc(a.area)}</span>` : ""}</div>
    <p class="tit">${esc(a.titulo)}</p>${a.texto ? `<p class="txt">${esc(a.texto)}</p>` : ""}${a.accion ? `<p class="acc"><b>Qué hacer:</b> ${esc(a.accion)}</p>` : ""}
    ${a.enlace ? `<button type="button" class="inf-ir" data-enlace="${esc(a.enlace)}">Ver <span aria-hidden="true">→</span></button>` : ""}</li>`).join("")}</ul>`;
}

/* gráficas en SVG con las variables de color del panel (cambian solas con el tema) */
const COLORES = ["var(--marca)", "var(--ma30)", "var(--sube)", "var(--baja)"];
function pintarSerie(el, b) {
  const W = Math.max(280, el.clientWidth || 600), H = 230, mi = 54, md = 12, ms = 12, mb = 26;
  const S = b.series, n = b.fechas.length;
  const vals = S.flatMap(s => s.valores).filter(v => v != null && !isNaN(v));
  if (!n || !vals.length) { el.innerHTML = `<p class="nota">Sin datos.</p>`; return; }
  const barras = b.grafica === "barras";   // barras para la 1.ª serie; las demás (p. ej. la media de 7 días) van como líneas encima
  let lo = Math.min(0, ...vals), hi = Math.max(...vals); if (hi === lo) hi = lo + 1;
  const x = i => mi + (barras ? (i + 0.5) * (W - mi - md) / n : (n === 1 ? (W - mi - md) / 2 : i * (W - mi - md) / (n - 1)));
  const y = v => ms + (H - ms - mb) * (1 - (v - lo) / (hi - lo));
  const f = S[0].formato || "num";
  let g = "";
  for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3; g += `<line x1="${mi}" x2="${W - md}" y1="${y(v)}" y2="${y(v)}" class="rej"/><text x="${mi - 6}" y="${y(v) + 4}" class="ej" text-anchor="end">${fmt(v, f === "eur" ? "eur0" : f === "pct" ? "pct" : "num")}</text>`; }
  const paso = Math.max(1, Math.ceil(n / 7));
  for (let i = 0; i < n; i += paso) g += `<text x="${x(i)}" y="${H - 8}" class="ej" text-anchor="middle">${esc(etiquetaX(b.fechas[i]))}</text>`;
  const linea = (s, k) => {
    let d = "", pen = false;
    s.valores.forEach((v, i) => { if (v == null || isNaN(v)) { pen = false; return; } d += (pen ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); pen = true; });
    return `<path d="${d}" fill="none" stroke="${COLORES[k % 4]}" stroke-width="${k ? 1.6 : 2}" stroke-linejoin="round"/>`;
  };
  if (barras) {
    const bw = Math.max(1, (W - mi - md) / n * 0.72);
    S[0].valores.forEach((v, i) => { if (v == null) return; const y0 = y(Math.max(0, v)), y1 = y(Math.min(0, v));
      g += `<rect x="${x(i) - bw / 2}" y="${y0}" width="${bw}" height="${Math.max(0.5, y1 - y0)}" fill="${COLORES[0]}" opacity="${S.length > 1 ? ".55" : ".85"}"><title>${esc(etiquetaX(b.fechas[i], true))}\n${S.map(s => `${s.nombre}: ${fmt(s.valores[i], s.formato || f)}`).join("\n")}</title></rect>`; });
    S.slice(1).forEach((s, k) => { g += linea(s, k + 1); });
  } else {
    S.forEach((s, k) => { g += linea(s, k); });
    const w = (W - mi - md) / Math.max(1, n - 1);
    for (let i = 0; i < n; i++) g += `<rect x="${x(i) - w / 2}" y="${ms}" width="${w}" height="${H - ms - mb}" fill="transparent" class="zona"><title>${esc(etiquetaX(b.fechas[i], true))}\n${S.map(s => `${s.nombre}: ${fmt(s.valores[i], s.formato || f)}`).join("\n")}</title></rect>`;
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="${esc(b.titulo)}">${g}</svg>` +
    (S.length > 1 ? `<div class="leyenda">${S.map((s, k) => `<span><i style="background:${COLORES[k % 4]}"></i>${esc(s.nombre)}</span>`).join("")}</div>` : "");
}
function etiquetaX(v, largo) {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(v));
  if (m) return largo ? `${m[3]}/${m[2]}/${m[1]}` : `${m[3]}/${m[2]}`;
  const mm = /^(\d{4})-(\d\d)$/.exec(String(v));
  return mm ? `${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][+mm[2] - 1]} ${mm[1].slice(2)}` : String(v);
}

/* ─────────── montaje ─────────── */
export async function montarInforme(cont, op = {}) {
  const r = await fetch(op.datos + "?t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error("los datos aún no están (" + r.status + ")");
  const J = await r.json();
  const clave = op.clave || "tdr-informe";
  const secs = J.secciones || [];
  let actual = (() => { try { return localStorage.getItem(clave + "-sec"); } catch (e) { return null; } })();
  if (op.seccion && secs.some(s => s.id === op.seccion)) actual = op.seccion;
  if (!secs.some(s => s.id === actual)) actual = secs[0] && secs[0].id;
  const graficas = new Map(), tablas = new Map();
  const ro = new ResizeObserver(() => graficas.forEach((b, el) => pintarSerie(el, b)));
  const [fe, ho] = String(J.actualizado || "").split(" ");
  cont.innerHTML = `<div class="inf">
    <header class="simbolo"><div class="izq"><div class="ico" style="background:var(--capa2)"><img src="../logo-tdr.png" alt="" width="30" height="30"></div>
      <div><div class="ticker"><em>${esc((J.ticker || "TDR").split(":")[0])}</em>:${esc((J.ticker || "").split(":")[1] || "")}</div><h1>${esc(J.titulo)} <small>${esc(J.subtitulo || "")}</small></h1></div></div>
      <div class="der"><div class="var"><span>Datos del</span> ${esc(fe ? fe.split("-").reverse().join("/") : "–")} · ${esc(ho || "")}</div></div></header>
    ${J.periodo ? `<p class="inf-periodo">${esc(J.periodo)}</p>` : ""}
    ${(() => { const enAlertas = secs.some(s => s.id === "alertas"); const top = (J.avisos || []).filter(a => !enAlertas || a.nivel === "info");
      return top.length ? `<div class="inf-top">${bAvisos({ items: top })}</div>` : ""; })()}
    <nav class="inf-sub grupo" role="tablist" aria-label="Apartados">${secs.map(s => `<button type="button" role="tab" data-s="${esc(s.id)}">${esc(s.titulo)}</button>`).join("")}</nav>
    <div class="inf-cuerpo"></div>
    ${J.fuentes ? `<p class="nota inf-fuentes"><b>De dónde sale.</b> ${esc(J.fuentes)}</p>` : ""}</div>`;
  const cuerpo = cont.querySelector(".inf-cuerpo");

  function pintar() {
    graficas.forEach((b, el) => ro.unobserve(el)); graficas.clear(); tablas.clear();
    cont.querySelectorAll(".inf-sub button").forEach(b => { const on = b.dataset.s === actual; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
    const s = secs.find(x => x.id === actual);
    if (!s) { cuerpo.innerHTML = `<p class="futuro-aviso">Sin datos todavía.</p>`; return; }
    cuerpo.innerHTML = (s.descripcion ? `<p class="inf-desc">${esc(s.descripcion)}</p>` : "") + s.bloques.map((b, i) => {
      const id = actual + "-" + i;
      const ancho = b.ancho || b.tipo === "kpis" || b.tipo === "avisos" || b.tipo === "texto" ? " ancho" : "";
      const tit = b.titulo ? `<div class="caja-cab"><h2>${esc(b.titulo)}</h2></div>` : "";
      let dentro = "";
      if (b.tipo === "kpis") return `<section class="inf-bloque ancho">${b.titulo ? `<h3 class="inf-tit">${esc(b.titulo)}</h3>` : ""}${bKpis(b)}${b.nota ? `<p class="nota inf-nota">${esc(b.nota)}</p>` : ""}</section>`;
      if (b.tipo === "avisos") return `<section class="inf-bloque ancho">${b.titulo ? `<h3 class="inf-tit">${esc(b.titulo)}</h3>` : ""}${bAvisos(b)}${b.nota ? `<p class="nota">${esc(b.nota)}</p>` : ""}</section>`;
      if (b.tipo === "texto") return `<section class="caja inf-bloque ancho">${tit}<p class="inf-texto">${esc(b.texto)}</p></section>`;
      if (b.tipo === "serie") dentro = `<div class="inf-graf" data-g="${id}"></div>`;
      else if (b.tipo === "barras") dentro = bBarras(b);
      else if (b.tipo === "tabla") { dentro = bTabla(b, id); tablas.set(id, { b, abierta: false, orden: null }); }
      return `<article class="caja inf-bloque${ancho}">${tit}${dentro}${b.nota ? `<p class="nota">${esc(b.nota)}</p>` : ""}</article>`;
    }).join("");
    s.bloques.forEach((b, i) => {
      const id = actual + "-" + i;
      if (b.tipo === "serie") { const el = cuerpo.querySelector(`[data-g="${id}"]`); graficas.set(el, b); pintarSerie(el, b); ro.observe(el); }
      if (b.tipo === "tabla") rellenar(id);
    });
  }
  function rellenar(id) {
    const t = tablas.get(id), tb = cuerpo.querySelector(`table[data-t="${id}"] tbody`);
    if (!t || !tb) return;
    tb.innerHTML = filasTabla(t.b, t.abierta, t.orden);
    cuerpo.querySelectorAll(`table[data-t="${id}"] th`).forEach(th => th.removeAttribute("aria-sort"));
    if (t.orden) { const th = cuerpo.querySelector(`table[data-t="${id}"] th[data-i="${t.orden.i}"]`); th && th.setAttribute("aria-sort", t.orden.dir > 0 ? "ascending" : "descending"); }
  }
  function ir(enlace) {
    if (!enlace) return;
    if (enlace.startsWith("#")) {
      const k = enlace.slice(1);
      if (secs.some(s => s.id === k)) { irA(k); return; }
      if (typeof window.irPanel === "function") { window.irPanel(k); return; }
    }
    window.open(enlace, "_blank", "noopener");
  }
  function irA(id) {
    if (!secs.some(s => s.id === id)) return;
    actual = id; try { localStorage.setItem(clave + "-sec", id); } catch (e) { /* sin almacenamiento */ }
    pintar(); cont.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  cont.addEventListener("click", e => {
    const sb = e.target.closest(".inf-sub button"); if (sb) { irA(sb.dataset.s); return; }
    const vt = e.target.closest(".inf-vertodo");
    if (vt) { const t = tablas.get(vt.dataset.t); t.abierta = !t.abierta; rellenar(vt.dataset.t);
      vt.innerHTML = t.abierta ? `Ver menos <span aria-hidden="true">↑</span>` : `Ver las ${t.b.filas.length} filas <span aria-hidden="true">↓</span>`; return; }
    const th = e.target.closest(".inf-tabla th");
    if (th) { const id = th.closest("table").dataset.t, t = tablas.get(id), i = +th.dataset.i;
      t.orden = t.orden && t.orden.i === i ? { i, dir: -t.orden.dir } : { i, dir: ["txt", "url", "ruta"].includes(t.b.columnas[i].f) ? 1 : -1 }; rellenar(id); return; }
    const a = e.target.closest(".inf-ir"); if (a) ir(a.dataset.enlace);
  });
  cont.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".inf-tabla th")) { e.preventDefault(); e.target.click(); } });
  pintar();
  return {
    irA,
    actualizarTema() { graficas.forEach((b, el) => pintarSerie(el, b)); },
    destruir() { ro.disconnect(); cont.innerHTML = ""; },
  };
}
