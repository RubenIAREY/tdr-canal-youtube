/* Pestaña «Auditoría SEO» del panel (10/11/2026). Contrato de datos: panel-auditoria/ESQUEMA.md.
   Datos: ../datos/auditoria_seo.json, que llega cifrado como los demás (el fetch ya lo descifra comun/candado.js).
   Subsecciones con enlace propio en la dirección (lo de después de # ; el ? se queda para los ajustes de aspecto):
     #auditoria-resumen · #auditoria-plan · #auditoria-capitulos · #auditoria-funciona
     y detrás, con &: a=<id de la auditoría>, pri, cap, resp, plazo, esf, afecta (repetibles), q=<texto>, acc=<acción abierta>, c=<capítulo>.
     Ej.: #auditoria-plan&a=2026-11-10&pri=Crítica&resp=Desarrollo&q=sitemap&acc=IDX-01
   Uso: const a = await montarAuditoria(contenedor, { datos: "../datos/auditoria_seo.json", hash: location.hash });
        a.irA(hash); a.mostrar(); a.actualizarTema(); a.destruir(); */

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sinTildes = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaLarga = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ""); return m ? `${+m[3]} ${MES[+m[2] - 1]} ${m[1]}` : esc(s || "–"); };
const fechaCorta = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || ""); };

const SUBS = [["resumen", "Resumen"], ["plan", "Plan de acción"], ["capitulos", "Capítulos"], ["funciona", "Lo que funciona y huecos"]];
const PRIORIDADES = ["Crítica", "Alta", "Media", "Baja"];
const PLAZOS = ["0-30 días", "31-60 días", "61-90 días", "Más de 90 días"];
const ESFUERZOS = ["Bajo", "Medio", "Alto"];
const RESPONSABLES = ["Desarrollo", "Contenido", "Marketing", "Sistemas", "Analítica", "Catálogo"];
const AFECTA = ["moto", "coche", "blog", "catálogo técnico", "portada", "toda la web"];
const FACETAS = [
  { k: "pri", t: "Prioridad", de: a => [a.prioridad], orden: PRIORIDADES },
  { k: "plazo", t: "Plazo", de: a => [a.plazo], orden: PLAZOS },
  { k: "resp", t: "Responsable", de: a => [a.responsable], orden: RESPONSABLES },
  { k: "esf", t: "Esfuerzo", de: a => [nivelEsfuerzo(a.esfuerzo)], orden: ESFUERZOS },
  { k: "afecta", t: "Afecta a", de: a => (Array.isArray(a.afecta_a) ? a.afecta_a : []), orden: AFECTA },
  { k: "cap", t: "Capítulo", de: a => [a.capitulo], orden: null },
];
const CLAVES_F = FACETAS.map(f => f.k);
function nivelEsfuerzo(e) { const p = String(e || "").trim().split(/[\s:]/)[0]; return ESFUERZOS.find(x => sinTildes(x) === sinTildes(p)) || (p || "Sin dato"); }
const rango = (L, v) => { const i = L.indexOf(v); return i < 0 ? L.length : i; };
const slug = s => sinTildes(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const banda = n => n == null || isNaN(n) ? "sin" : n < 50 ? "mal" : n < 75 ? "medio" : "bien";

/* ─────────── dirección (hash) ─────────── */
function leerHash(h) {
  h = String(h || "").replace(/^#/, "");
  if (!h.startsWith("auditoria")) return null;
  const amp = h.indexOf("&"), cab = amp < 0 ? h : h.slice(0, amp), resto = amp < 0 ? "" : h.slice(amp + 1);
  const sub = cab.startsWith("auditoria-") ? cab.slice(10) : "";
  const q = new URLSearchParams(resto);
  return { sub: SUBS.some(s => s[0] === sub) ? sub : "", q };
}

export async function montarAuditoria(cont, op = {}) {
  let J = null, error = null;
  try {
    const r = await fetch(op.datos + "?t=" + Date.now(), { cache: "no-store" });
    if (r.ok) J = await r.json(); else if (r.status !== 404) error = "HTTP " + r.status;
  } catch (e) { error = e && e.message || String(e); }
  const auds = J && Array.isArray(J.auditorias) ? J.auditorias.filter(a => a && a.id).slice().sort((x, y) => String(y.fecha || y.id).localeCompare(String(x.fecha || x.id))) : [];
  if (!auds.length) {
    cont.innerHTML = `<div class="seo seo-vacio"><header class="simbolo"><div class="izq"><div class="ico" style="background:var(--capa2)"><img src="../logo-tdr.png" alt="" width="30" height="30"></div>
      <div><div class="ticker"><em>TDR</em>:SEO</div><h1>Auditoría SEO</h1></div></div></header>
      <p class="futuro-aviso">Todavía no hay ninguna auditoría.${error ? ` <small>(No se ha podido leer datos/auditoria_seo.json: ${esc(error)})</small>` : ""}</p></div>`;
    return { irA() {}, mostrar() {}, actualizarTema() {}, destruir() { cont.innerHTML = ""; } };
  }

  /* estado */
  const S = { a: auds[0].id, sub: "resumen", f: Object.fromEntries(CLAVES_F.map(k => [k, new Set()])), q: "", acc: new Set(), c: null };
  let A = auds[0], vivo = true;
  const aud = () => A;

  function aplicarHash(h) {
    const p = leerHash(h); if (!p) return;
    const id = p.q.get("a"); A = auds.find(x => x.id === id) || auds[0]; S.a = A.id;
    S.sub = p.sub || "resumen";
    CLAVES_F.forEach(k => { S.f[k] = new Set(p.q.getAll(k).filter(Boolean)); });
    S.q = p.q.get("q") || "";
    S.acc = new Set(p.q.getAll("acc").filter(Boolean));
    S.c = p.q.get("c") || null;
  }
  function hashActual() {
    const q = new URLSearchParams(); q.set("a", S.a);
    if (S.sub === "plan") { CLAVES_F.forEach(k => S.f[k].forEach(v => q.append(k, v))); if (S.q) q.set("q", S.q); S.acc.forEach(v => q.append("acc", v)); }
    if (S.sub === "capitulos" && S.c) q.set("c", S.c);
    return "#auditoria-" + S.sub + "&" + q.toString();
  }
  function escribirHash() {                 // solo mientras se ve la pestaña: si no, la dirección es de otra pestaña
    if (!vivo || document.querySelector("#v-auditoria.oculta")) return;
    const h = hashActual(); if (location.hash !== h) history.replaceState(null, "", location.search + h);
  }
  const enlace = () => location.href.split("#")[0] + hashActual();

  /* ─────────── esqueleto ─────────── */
  cont.innerHTML = `<div class="seo">
    <header class="simbolo seo-cab"><div class="izq"><div class="ico" style="background:var(--capa2)"><img src="../logo-tdr.png" alt="" width="30" height="30"></div>
      <div><div class="ticker"><em>TDR</em>:SEO</div><h1 class="seo-titulo"></h1><p class="seo-ambito"></p></div></div>
      <div class="der seo-elige"><label for="seo-aud">Auditoría</label>
        <select id="seo-aud">${auds.map(a => `<option value="${esc(a.id)}">${fechaLarga(a.fecha || a.id)}${a.id === auds[0].id ? " · la última" : ""}</option>`).join("")}</select>
        <div class="var seo-fecha"></div></div></header>
    <nav class="inf-sub grupo seo-sub" role="tablist" aria-label="Apartados de la auditoría">${SUBS.map(([k, t]) => `<button type="button" role="tab" data-sub="${k}">${t}</button>`).join("")}</nav>
    <div class="seo-cuerpo"></div>
    <p class="seo-toast" role="status" aria-live="polite"></p></div>`;
  const $ = s => cont.querySelector(s);
  const cuerpo = $(".seo-cuerpo");

  function cabecera() {
    const a = aud();
    $(".seo-titulo").innerHTML = `${esc(a.titulo || "Auditoría SEO")} <small>${fechaLarga(a.fecha || a.id)}</small>`;
    $(".seo-ambito").textContent = a.ambito || "";
    $("#seo-aud").value = a.id;
    $(".seo-fecha").innerHTML = `<span>Datos del</span> ${esc(fechaCorta((J.actualizado || "").slice(0, 10)))} · ${esc((J.actualizado || "").slice(11))}`;
    cont.querySelectorAll(".seo-sub button").forEach(b => { const on = b.dataset.sub === S.sub; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
  }

  /* ─────────── utilidades de acciones ─────────── */
  const acciones = () => (aud().acciones || []).filter(a => a && a.id);
  const porId = () => Object.fromEntries(acciones().map(a => [a.id, a]));
  const ordenar = L => L.slice().sort((x, y) => rango(PRIORIDADES, x.prioridad) - rango(PRIORIDADES, y.prioridad) ||
    rango(PLAZOS, x.plazo) - rango(PLAZOS, y.plazo) || String(x.id).localeCompare(String(y.id), "es", { numeric: true }));
  const textoBusqueda = a => sinTildes([a.id, a.titulo, a.capitulo, a.que, a.donde, a.por_que, a.evidencia, a.impacto, a.esfuerzo, a.responsable, a.plazo, a.como_medir,
    (a.afecta_a || []).join(" "), (a.depende_de || []).join(" ")].join(" \u0001 "));
  const cumpleTexto = (a, q) => !q || sinTildes(q).split(/\s+/).filter(Boolean).every(p => textoBusqueda(a).includes(p));
  function cumple(a, sin) {
    if (!cumpleTexto(a, S.q)) return false;
    return FACETAS.every(F => F.k === sin || !S.f[F.k].size || F.de(a).some(v => S.f[F.k].has(v)));
  }
  const filtradas = () => ordenar(acciones().filter(a => cumple(a)));
  const hayFiltros = () => !!S.q || CLAVES_F.some(k => S.f[k].size);
  function valoresFaceta(F) {
    const vistos = new Set(); acciones().forEach(a => F.de(a).forEach(v => v && vistos.add(v)));
    const orden = F.orden || (aud().capitulos || []).map(c => c.titulo);
    return [...vistos].sort((x, y) => rango(orden, x) - rango(orden, y) || x.localeCompare(y, "es"));
  }
  const capDe = titulo => (aud().capitulos || []).find(c => c.titulo === titulo);

  function marcar(txt) {                      // resalta lo buscado (sin distinguir mayúsculas; las tildes se ignoran al filtrar, no al resaltar)
    const s = esc(txt); if (!S.q) return s;
    const partes = S.q.split(/\s+/).filter(p => p.length > 1).map(p => esc(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return partes.length ? s.replace(new RegExp("(" + partes.join("|") + ")", "gi"), "<mark>$1</mark>") : s;
  }
  const clsPri = p => "p-" + slug(p || "sin");

  /* ─────────── Resumen ─────────── */
  function anillo(n) {
    const r = 52, L = 2 * Math.PI * r, v = Math.max(0, Math.min(100, +n || 0));
    return `<svg viewBox="0 0 128 128" class="seo-anillo b-${banda(n)}" role="img" aria-label="Nota global ${esc(n)} sobre 100">
      <circle cx="64" cy="64" r="${r}" class="pista"/><circle cx="64" cy="64" r="${r}" class="valor" stroke-dasharray="${(L * v / 100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 64 64)"/>
      <text x="64" y="70" text-anchor="middle" class="num">${esc(n ?? "–")}</text><text x="64" y="90" text-anchor="middle" class="de">de 100</text></svg>`;
  }
  function barrasNotas(L, conPeso) {
    return `<ul class="seo-notas">${L.map(n => `<li class="b-${banda(n.nota)}"><div class="fila"><span class="cat">${esc(n.categoria)}${conPeso ? ` <small>peso ${esc(n.peso)} %</small>` : ""}</span>
      <span class="pista"><i style="width:${Math.max(0, Math.min(100, +n.nota || 0))}%"></i></span><b class="val">${esc(n.nota ?? "–")}</b></div>
      ${n.porque ? `<p class="porque">${esc(n.porque)}</p>` : ""}</li>`).join("")}</ul>`;
  }
  function pintarResumen() {
    const a = aud(), notas = a.notas || [], enG = notas.filter(n => n.global), fuera = notas.filter(n => !n.global);
    const crit = ordenar(acciones().filter(x => x.prioridad === "Crítica"));
    const tono = t => t === "bien" ? "sube" : t === "mal" ? "baja" : "igual";
    cuerpo.innerHTML = `<div class="seo-res">
      <section class="caja seo-global b-${banda(a.nota_global)}"><div class="caja-cab"><h2>Nota global</h2></div>
        <div class="seo-global-in">${anillo(a.nota_global)}<p>Media ponderada de las ${enG.length} categorías que entran en la nota. ${a.acciones ? `<b>${acciones().length}</b> acciones en el plan.` : ""}</p></div>
        <span class="sello" aria-hidden="true">Auditado ${esc(fechaCorta(a.fecha || a.id))}</span></section>
      <section class="caja seo-cats"><div class="caja-cab"><h2>Notas por categoría <small>de 0 a 100</small></h2></div>
        <h3 class="seo-tit">Entran en la nota global</h3>${barrasNotas(enG, true)}
        ${fuera.length ? `<h3 class="seo-tit">No entran en la nota global</h3>${barrasNotas(fuera, false)}` : ""}</section>
    </div>
    ${(a.indicadores || []).length ? `<section class="seo-bloque"><h3 class="inf-tit">Indicadores clave</h3><div class="kpis">${a.indicadores.map(k => `<div class="caja kpi">
      <div class="e">${esc(k.nombre)}</div><div class="v">${esc(k.valor)}</div><div class="s"><span class="${tono(k.tono)}">${k.tono === "bien" ? "▲ " : k.tono === "mal" ? "▼ " : ""}${esc(k.variacion || "")}</span>
      <span class="inf-kn">${esc([k.fuente, k.periodo].filter(Boolean).join(" · "))}</span></div></div>`).join("")}</div></section>` : ""}
    <section class="caja seo-bloque seo-direccion"><div class="caja-cab"><h2>Resumen para dirección</h2></div>
      ${(a.resumen || []).map(p => `<p>${esc(p)}</p>`).join("")}</section>
    <section class="caja seo-bloque"><div class="caja-cab"><h2>Acciones críticas <small>${crit.length}</small></h2></div>
      ${crit.length ? `<ul class="seo-crit">${crit.map(x => `<li><button type="button" class="seo-ir-acc" data-acc="${esc(x.id)}" data-pri="Crítica">
        <span class="seo-id">${esc(x.id)}</span><span class="t">${esc(x.titulo)}</span><span class="m">${esc(x.plazo || "")} · ${esc(x.responsable || "")}</span>
        <span class="pq">${esc(x.por_que || "")}</span></button></li>`).join("")}</ul>
      <button type="button" class="mas seo-ver-plan" data-pri="Crítica">Ver las críticas en el plan de acción <span aria-hidden="true">→</span></button>`
      : `<p class="nota">No hay acciones críticas en esta auditoría.</p>`}</section>`;
  }

  /* ─────────── Plan de acción ─────────── */
  function pintarPlan() {
    cuerpo.innerHTML = `<section class="caja seo-filtros" aria-label="Filtros del plan">
      <div class="seo-busca"><label for="seo-q" class="seo-et">Buscar</label>
        <input id="seo-q" type="search" placeholder="Texto en el título, el porqué, la evidencia…" value="${esc(S.q)}" autocomplete="off">
        <span class="seo-cuenta" aria-live="polite"></span></div>
      ${FACETAS.map(F => { const V = valoresFaceta(F); return V.length ? `<div class="seo-faceta" data-f="${F.k}"><span class="seo-et">${F.t}</span><div class="seo-chips">${V.map(v =>
        `<button type="button" class="seo-chip ${F.k === "pri" ? clsPri(v) : ""}" data-f="${F.k}" data-v="${esc(v)}" aria-pressed="false">${esc(v)} <b></b></button>`).join("")}</div></div>` : ""; }).join("")}
      <div class="seo-acc-bar"><button type="button" class="seo-boton" data-hacer="limpiar">Quitar filtros</button>
        <button type="button" class="seo-boton" data-hacer="abrir">Desplegar todas</button><button type="button" class="seo-boton" data-hacer="cerrar">Plegar todas</button>
        <span class="sep" aria-hidden="true"></span>
        <button type="button" class="seo-boton prim" data-hacer="csv">Descargar CSV</button><button type="button" class="seo-boton" data-hacer="imprimir">Imprimir</button>
        <button type="button" class="seo-boton" data-hacer="enlace">Copiar enlace</button></div></section>
    <p class="seo-filtro-txt"></p>
    <div class="seo-lista"></div>`;
    const q = $("#seo-q"); let t = null;
    q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { S.q = q.value.trim(); actualizarPlan(); escribirHash(); }, 160); });
    actualizarPlan();
  }
  function actualizarPlan() {
    const L = filtradas(), total = acciones().length, cuenta = $(".seo-cuenta");
    if (!cuenta) return;   // el buscador dispara con retraso: si ya se ha cambiado de subsección, no hay plan que pintar
    cuenta.innerHTML = `<b>${L.length}</b> de ${total} acciones`;
    FACETAS.forEach(F => cont.querySelectorAll(`.seo-chip[data-f="${F.k}"]`).forEach(b => {
      const v = b.dataset.v, n = acciones().filter(a => cumple(a, F.k) && F.de(a).includes(v)).length, on = S.f[F.k].has(v);
      b.querySelector("b").textContent = n; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("cero", !n && !on);
    }));
    const activos = FACETAS.filter(F => S.f[F.k].size).map(F => `${F.t}: ${[...S.f[F.k]].join(" o ")}`);
    if (S.q) activos.push(`texto «${S.q}»`);
    $(".seo-filtro-txt").innerHTML = activos.length ? `<b>Filtrado por</b> ${esc(activos.join(" · "))}` : "";
    const lista = $(".seo-lista"), I = porId(), bloquea = {};
    acciones().forEach(a => (a.depende_de || []).forEach(d => { (bloquea[d] ||= []).push(a.id); }));
    if (!L.length) { lista.innerHTML = `<p class="futuro-aviso">Ninguna acción cumple estos filtros. <button type="button" class="seo-boton" data-hacer="limpiar">Quitar filtros</button></p>`; return; }
    const grupos = PRIORIDADES.concat([...new Set(L.map(a => a.prioridad).filter(p => !PRIORIDADES.includes(p)))]);
    lista.innerHTML = grupos.map(p => { const G = L.filter(a => a.prioridad === p); return G.length ? `<section class="seo-grupo ${clsPri(p)}">
      <h3 class="seo-grupo-t"><span class="seo-pri ${clsPri(p)}">${esc(p)}</span> <span>${G.length} ${G.length === 1 ? "acción" : "acciones"}</span></h3>
      ${G.map(a => tarjeta(a, I, bloquea)).join("")}</section>` : ""; }).join("");
  }
  function enlaceAcc(id, I) { return I[id] ? `<button type="button" class="seo-enl" data-acc="${esc(id)}" title="${esc(I[id].titulo)}">${esc(id)}</button>` : `<span class="seo-enl roto" title="No está en esta auditoría">${esc(id)}</span>`; }
  function tarjeta(a, I, bloquea) {
    const abierta = S.acc.has(a.id), cid = "seo-c-" + slug(a.id), cap = capDe(a.capitulo);
    const fila = (t, v, html = false) => v ? `<div><dt>${t}</dt><dd>${html ? v : marcar(v)}</dd></div>` : "";
    return `<article class="seo-acc ${clsPri(a.prioridad)}${abierta ? " abierta" : ""}" id="seo-acc-${esc(slug(a.id))}" data-id="${esc(a.id)}">
      <button type="button" class="seo-acc-cab" aria-expanded="${abierta}" aria-controls="${cid}">
        <span class="seo-acc-l1"><span class="seo-id">${esc(a.id)}</span><span class="seo-pri ${clsPri(a.prioridad)}">${esc(a.prioridad)}</span>
          <span class="seo-meta">${esc(a.plazo || "")} · ${esc(a.responsable || "")} · esfuerzo ${esc(nivelEsfuerzo(a.esfuerzo).toLowerCase())}</span><span class="seo-flecha" aria-hidden="true"></span></span>
        <span class="seo-acc-t">${marcar(a.titulo)}</span>
        <span class="seo-acc-pq"><b>Por qué:</b> ${marcar(a.por_que)}</span></button>
      <div class="seo-acc-cuerpo" id="${cid}"${abierta ? "" : " hidden"}>
        <div class="seo-porque"><span>Por qué</span><p>${marcar(a.por_que)}</p></div>
        <dl class="seo-dl">${fila("Qué hacer", a.que)}${fila("Dónde", a.donde)}${fila("Evidencia", a.evidencia)}${fila("Impacto esperado", a.impacto)}
          ${fila("Esfuerzo", a.esfuerzo)}${fila("Responsable", a.responsable)}${fila("Plazo", a.plazo)}${fila("Cómo medirlo", a.como_medir)}
          ${fila("Depende de", (a.depende_de || []).length ? a.depende_de.map(d => enlaceAcc(d, I)).join(" ") : "", true)}
          ${fila("Hace falta para", (bloquea[a.id] || []).length ? bloquea[a.id].map(d => enlaceAcc(d, I)).join(" ") : "", true)}
          ${fila("Afecta a", (a.afecta_a || []).length ? (a.afecta_a || []).map(x => `<span class="chip">${esc(x)}</span>`).join(" ") : "", true)}
          ${fila("Capítulo", cap ? `<button type="button" class="seo-enl" data-cap="${esc(cap.id)}">${esc(cap.id)} · ${esc(cap.titulo)}</button>` : esc(a.capitulo || ""), true)}</dl>
        <div class="seo-acc-pie"><button type="button" class="seo-boton" data-copiar-acc="${esc(a.id)}">Copiar enlace a esta acción</button></div></div></article>`;
  }
  function abrirTarjeta(id, si) {
    const el = cont.querySelector(`.seo-acc[data-id="${CSS.escape(id)}"]`); if (!el) return null;
    const b = el.querySelector(".seo-acc-cab"), c = el.querySelector(".seo-acc-cuerpo");
    const abrir = si == null ? b.getAttribute("aria-expanded") !== "true" : si;
    b.setAttribute("aria-expanded", String(abrir)); c.hidden = !abrir; el.classList.toggle("abierta", abrir);
    if (abrir) S.acc.add(id); else S.acc.delete(id);
    return el;
  }
  function irAccion(id, pri) {            // abre una acción en el plan; si los filtros la esconden, se quitan
    const a = porId()[id]; if (!a) return;
    S.sub = "plan"; S.acc = new Set([id]);
    if (pri) { CLAVES_F.forEach(k => S.f[k].clear()); S.q = ""; S.f.pri.add(pri); }
    if (!cumple(a)) { CLAVES_F.forEach(k => S.f[k].clear()); S.q = ""; }
    pintar(false);
    const el = cont.querySelector(`.seo-acc[data-id="${CSS.escape(id)}"]`);
    if (el) { el.scrollIntoView({ block: "start", behavior: "smooth" }); el.classList.add("destello"); setTimeout(() => el.classList.remove("destello"), 1600); el.querySelector(".seo-acc-cab").focus({ preventScroll: true }); }
  }

  function csv() {
    const C = [["id", "ID"], ["prioridad", "Prioridad"], ["plazo", "Plazo"], ["capitulo", "Capítulo"], ["titulo", "Acción"], ["que", "Qué hacer"], ["donde", "Dónde"],
      ["por_que", "Por qué"], ["evidencia", "Evidencia"], ["impacto", "Impacto"], ["esfuerzo", "Esfuerzo"], ["responsable", "Responsable"],
      ["depende_de", "Depende de"], ["como_medir", "Cómo medirlo"], ["afecta_a", "Afecta a"]];
    const celda = v => { v = Array.isArray(v) ? v.join(", ") : String(v ?? ""); return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const L = filtradas();
    const txt = "﻿" + [C.map(c => c[1]).join(";")].concat(L.map(a => C.map(c => celda(a[c[0]])).join(";"))).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    const enl = document.createElement("a"); enl.href = url; enl.download = `auditoria-seo-${aud().id}-plan${hayFiltros() ? "-filtrado" : ""}.csv`;
    document.body.appendChild(enl); enl.click(); enl.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    aviso(`CSV con ${L.length} ${L.length === 1 ? "acción" : "acciones"}`);
  }

  /* ─────────── Capítulos ─────────── */
  function pintarCapitulos() {
    const caps = aud().capitulos || [], L = acciones();
    const cuantas = t => L.filter(a => a.capitulo === t).length;
    const c = S.c && caps.find(x => x.id === S.c);
    if (!c) {
      S.c = null;
      cuerpo.innerHTML = caps.length ? `<ol class="seo-indice">${caps.map(x => `<li><button type="button" class="caja seo-cap b-${banda(x.nota)}" data-cap="${esc(x.id)}">
        <span class="seo-cap-l1"><span class="seo-num">${esc(x.id)}</span><span class="seo-cap-t">${esc(x.titulo)}</span><b class="seo-cap-nota">${esc(x.nota ?? "–")}</b></span>
        <span class="pista"><i style="width:${Math.max(0, Math.min(100, +x.nota || 0))}%"></i></span>
        <span class="seo-cap-2">${esc(x.en_dos_lineas || "")}</span><span class="seo-cap-n">${cuantas(x.titulo)} acciones <span aria-hidden="true">→</span></span></button></li>`).join("")}</ol>`
        : `<p class="futuro-aviso">Esta auditoría no tiene capítulos.</p>`;
      return;
    }
    const i = caps.indexOf(c), ant = caps[i - 1], sig = caps[i + 1], n = cuantas(c.titulo);
    cuerpo.innerHTML = `<div class="seo-cap-nav"><button type="button" class="seo-boton" data-cap="">← Índice de capítulos</button>
        <button type="button" class="seo-boton prim" data-ver-cap="${esc(c.titulo)}">Ver sus ${n} ${n === 1 ? "acción" : "acciones"} →</button>
        <button type="button" class="seo-boton" data-hacer="imprimir">Imprimir</button><button type="button" class="seo-boton" data-hacer="enlace">Copiar enlace</button></div>
      <article class="caja seo-md b-${banda(c.nota)}"><div class="seo-md-cab"><span class="seo-num">${esc(c.id)}</span><b>Nota ${esc(c.nota ?? "–")}</b><span>${esc(c.en_dos_lineas || "")}</span></div>
        <div class="seo-md-in">${c.html || `<p>${esc(c.en_dos_lineas || "")}</p>`}</div></article>
      <div class="seo-cap-nav">${ant ? `<button type="button" class="seo-boton" data-cap="${esc(ant.id)}">← ${esc(ant.id)} · ${esc(ant.titulo)}</button>` : ""}
        ${sig ? `<button type="button" class="seo-boton" data-cap="${esc(sig.id)}">${esc(sig.id)} · ${esc(sig.titulo)} →</button>` : ""}</div>`;
    cuerpo.querySelectorAll(".seo-md-in a[href^='#']").forEach(x => x.addEventListener("click", e => {   // enlaces a otras pestañas del panel
      const k = x.getAttribute("href").slice(1);
      if (k.startsWith("auditoria")) { e.preventDefault(); irA("#" + k); }
      else if (typeof window.irPanel === "function") { e.preventDefault(); window.irPanel(k); }
    }));
    cuerpo.querySelectorAll(".seo-md-in a[href^='http']").forEach(x => { x.target = "_blank"; x.rel = "noopener"; });
  }

  /* ─────────── Lo que funciona y huecos ─────────── */
  function pintarFunciona() {
    const a = aud();
    const lista = (L, cls) => L && L.length ? `<ul class="seo-lista-p ${cls}">${L.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="nota">Nada anotado.</p>`;
    cuerpo.innerHTML = `<div class="seo-dos">
      <section class="caja seo-bloque"><div class="caja-cab"><h2>Lo que ya funciona</h2></div>${lista(a.funciona, "bien")}</section>
      <section class="caja seo-bloque"><div class="caja-cab"><h2>Huecos <small>lo que no se pudo medir</small></h2></div>${lista(a.huecos, "hueco")}</section></div>
      <section class="caja seo-bloque"><div class="caja-cab"><h2>Fuentes</h2></div>
        ${(a.fuentes || []).length ? `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Fuente</th><th>Periodo</th><th>Detalle</th></tr></thead><tbody>
        ${a.fuentes.map(f => `<tr><td><b>${esc(f.nombre)}</b></td><td class="f">${esc(f.periodo || "")}</td><td>${esc(f.detalle || "")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="nota">Sin fuentes anotadas.</p>`}</section>`;
  }

  /* ─────────── pintar y navegar ─────────── */
  function pintar(arriba = true) {
    cabecera();
    if (S.sub === "plan") pintarPlan(); else if (S.sub === "capitulos") pintarCapitulos(); else if (S.sub === "funciona") pintarFunciona(); else { S.sub = "resumen"; pintarResumen(); }
    cabecera();
    escribirHash();
    if (arriba) { const r = cont.getBoundingClientRect(); if (r.top < 0) cont.scrollIntoView({ block: "start" }); }
  }
  function irA(h) { aplicarHash(h); pintar(); }
  function aviso(t) { const el = $(".seo-toast"); el.textContent = t; el.classList.add("on"); clearTimeout(aviso.t); aviso.t = setTimeout(() => el.classList.remove("on"), 2200); }
  async function copiar(url, txt) {
    try { await navigator.clipboard.writeText(url); aviso(txt || "Enlace copiado"); }
    catch (e) { window.prompt("Copia el enlace:", url); }
  }
  function imprimir() { window.print(); }   // auditoria.css (@media print) deja solo la pestaña y despliega las tarjetas filtradas

  cont.addEventListener("click", e => {
    const t = e.target;
    const sb = t.closest(".seo-sub button"); if (sb) { S.sub = sb.dataset.sub; if (S.sub !== "capitulos") S.c = null; pintar(); return; }
    const cab = t.closest(".seo-acc-cab"); if (cab) { abrirTarjeta(cab.closest(".seo-acc").dataset.id); escribirHash(); return; }
    const ch = t.closest(".seo-chip");
    if (ch) { const s = S.f[ch.dataset.f]; s.has(ch.dataset.v) ? s.delete(ch.dataset.v) : s.add(ch.dataset.v); actualizarPlan(); escribirHash();
      const n = cont.querySelector(`.seo-chip[data-f="${ch.dataset.f}"][data-v="${CSS.escape(ch.dataset.v)}"]`); if (n) n.focus(); return; }
    const ia = t.closest("[data-acc]"); if (ia) { irAccion(ia.dataset.acc, ia.dataset.pri); return; }
    const vp = t.closest(".seo-ver-plan"); if (vp) { S.sub = "plan"; CLAVES_F.forEach(k => S.f[k].clear()); S.q = ""; S.acc.clear(); S.f.pri.add(vp.dataset.pri); pintar(); return; }
    const cp = t.closest("[data-cap]"); if (cp) { S.sub = "capitulos"; S.c = cp.dataset.cap || null; pintar(); return; }
    const vc = t.closest("[data-ver-cap]"); if (vc) { S.sub = "plan"; CLAVES_F.forEach(k => S.f[k].clear()); S.q = ""; S.acc.clear(); S.f.cap.add(vc.dataset.verCap); pintar(); return; }
    const ca = t.closest("[data-copiar-acc]"); if (ca) { const g = new Set(S.acc); S.acc = new Set([ca.dataset.copiarAcc]); const u = enlace(); S.acc = g; copiar(u, "Enlace a la acción copiado"); return; }
    const h = t.closest("[data-hacer]");
    if (h) {
      const k = h.dataset.hacer;
      if (k === "limpiar") { CLAVES_F.forEach(x => S.f[x].clear()); S.q = ""; const q = $("#seo-q"); if (q) q.value = ""; actualizarPlan(); escribirHash(); }
      else if (k === "abrir" || k === "cerrar") { cont.querySelectorAll(".seo-acc").forEach(el => abrirTarjeta(el.dataset.id, k === "abrir")); escribirHash(); }
      else if (k === "csv") csv();
      else if (k === "imprimir") imprimir();
      else if (k === "enlace") copiar(enlace());
    }
  });
  cont.addEventListener("change", e => { if (e.target.id === "seo-aud") { const a = auds.find(x => x.id === e.target.value); if (!a) return; A = a; S.a = a.id; S.acc.clear(); S.c = null;
    CLAVES_F.forEach(k => S.f[k].clear()); S.q = ""; pintar(); } });
  const alCambiarHash = () => { if (location.hash.startsWith("#auditoria") && location.hash !== hashActual()) { if (typeof window.irPanel === "function" && document.querySelector("#v-auditoria.oculta")) window.irPanel("auditoria"); irA(location.hash); } };
  window.addEventListener("hashchange", alCambiarHash);

  aplicarHash(op.hash || location.hash);
  pintar(false);
  if (S.acc.size && S.sub === "plan") { const id = [...S.acc][0]; setTimeout(() => { const el = cont.querySelector(`.seo-acc[data-id="${CSS.escape(id)}"]`); if (el) el.scrollIntoView({ block: "start" }); }, 60); }
  else if (S.sub === "capitulos" && S.c) { /* el capítulo ya está abierto */ }

  return {
    irA,
    mostrar() { escribirHash(); },
    actualizarTema() { /* todo va con variables CSS: cambia solo */ },
    destruir() { vivo = false; window.removeEventListener("hashchange", alCambiarHash); cont.innerHTML = ""; },
  };
}
