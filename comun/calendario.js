/* Pestaña «Calendario» del Panel de redes TDR (08/10/2026, lo pidió Rubén).
   Todo lo que sale cada día, en qué red, qué es, con su imagen y su texto: el mes entero en una rejilla, se pincha un día y se ve
   todo lo de ese día; filtros por red, formato y estado, buscador y vista de lista. Datos: ../datos/calendario.json (lo rehace
   PANEL-REDES/calendario_datos.py en las rutinas de las 9:00 y las 17:00). Sin dependencias.

   montarCalendario(contenedor, { datos: url|objeto, clave }) → { actualizarTema(), destruir() } */

const CSS_URL = new URL("./calendario.css", import.meta.url).href;
const BASE_DATOS = new URL("../datos/", import.meta.url).href;
const REDES = [["youtube", "YouTube", "var(--ca-yt)"], ["instagram", "Instagram", "var(--ca-ig)"], ["tiktok", "TikTok", "var(--ca-tt)"], ["facebook", "Facebook", "var(--ca-fb)"]];
const FORMATOS = [["todos", "Todo"], ["largo", "Largos"], ["short", "Shorts"], ["reel", "Reels"], ["foto", "Fotos"]];
const ESTADOS = [["todos", "Todos"], ["programado", "Programado"], ["aprobado", "Falta programar"], ["previsto", "Cola de YouTube"],
  ["condicional", "Si hay HeyGen"], ["por hacer", "Por hacer"], ["publicado", "Publicado"]];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const NOMBRE_RED = Object.fromEntries(REDES.map(r => [r[0], r[1]]));
const FMT = { largo: "Largo", short: "Short", reel: "Reel", foto: "Foto" };

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deIso = s => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
const diaSemana = d => (d.getDay() + 6) % 7;      // lunes = 0

function cargarCss() {
  return new Promise(ok => {
    let l = document.querySelector("link[data-ca-css]");
    if (l) return ok(l);
    l = document.createElement("link"); l.rel = "stylesheet"; l.href = CSS_URL; l.dataset.caCss = "";
    l.onload = l.onerror = () => ok(l); document.head.appendChild(l);
  });
}
async function leer(datos) {
  if (datos && typeof datos === "object") return datos;
  const r = await fetch((datos || BASE_DATOS + "calendario.json") + "?" + Date.now());
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
const src = img => !img ? "" : /^https?:/.test(img) ? img : BASE_DATOS + img;

export async function montarCalendario(contenedor, opciones = {}) {
  if (!contenedor) throw new Error("montarCalendario: falta el contenedor");
  await cargarCss();
  const CLAVE = (opciones.clave || "tdr-calendario") + "-v1";
  const raiz = document.createElement("section");
  raiz.className = "ca"; raiz.setAttribute("aria-label", "Calendario de publicaciones");
  contenedor.appendChild(raiz);

  let C;
  try { C = await leer(opciones.datos); } catch (e) {
    raiz.innerHTML = `<p class="ca-avisos">El calendario todavía no está listo: no se ha podido leer calendario.json (${esc(e.message || e)}).</p>`;
    return { actualizarTema() {}, destruir() { raiz.remove(); } };
  }
  const ITEMS = (C.items || []).filter(x => x && /^\d{4}-\d\d-\d\d$/.test(x.dia || ""));
  ITEMS.forEach((x, i) => { x._i = i; x._busca = norm([x.titulo, x.texto, x.nota, (x.redes || []).join(" "), x.largo].join(" ")); });
  const HOY = C.hoy || iso(new Date());

  /* estado de la vista (se recuerda en el navegador) */
  let G = {};
  try { G = JSON.parse(localStorage.getItem(CLAVE) || "{}"); } catch (e) { G = {}; }
  const st = {
    mes: G.mes || HOY.slice(0, 7), dia: null, redes: new Set(G.redes || REDES.map(r => r[0])), formato: G.formato || "todos",
    estado: G.estado || "todos", texto: "", vista: G.vista || "mes",
  };
  if (st.mes < C.desde.slice(0, 7) || st.mes > C.hasta.slice(0, 7)) st.mes = HOY.slice(0, 7);
  st.dia = HOY.slice(0, 7) === st.mes ? HOY : null;
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify({ mes: st.mes, redes: [...st.redes], formato: st.formato, estado: st.estado, vista: st.vista })); } catch (e) { /* sin almacenamiento */ } };

  const pasa = x => (x.redes || []).some(r => st.redes.has(r)) && (st.formato === "todos" || x.formato === st.formato)
    && (st.estado === "todos" || x.estado === st.estado) && (!st.texto || x._busca.includes(st.texto));
  const delDia = d => ITEMS.filter(x => x.dia === d && pasa(x)).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

  /* esqueleto */
  const total = s => ITEMS.filter(x => x.dia >= HOY && x.estado === s).length;
  raiz.innerHTML = `
    <header class="ca-cab">
      <div>
        <div class="ca-ticker">CAL · <em>${esc(HOY.split("-").reverse().join("/"))}</em> · ACTUALIZADO ${esc((C.actualizado || "").slice(8, 10) + "/" + (C.actualizado || "").slice(5, 7) + " " + (C.actualizado || "").slice(11))}</div>
        <h1>Calendario de publicaciones</h1>
        <p>Qué sale cada día, en qué red y qué es. Pincha un día para verlo todo: la imagen, el texto y el enlace. Se rehace solo a las 9:00 y a las 17:00 con lo programado en Metricool y en YouTube.</p>
      </div>
      <div class="ca-resumen">
        <div class="ca-cifra"><b>${ITEMS.filter(x => x.dia >= HOY && x.estado === "programado").length}</b><span>programados</span></div>
        <div class="ca-cifra"><b>${total("aprobado")}</b><span>falta programar</span></div>
        <div class="ca-cifra"><b>${total("previsto")}</b><span>en la cola de YouTube</span></div>
        <div class="ca-cifra"><b>${ITEMS.filter(x => x.dia >= HOY && x.formato === "largo" && x.estado !== "condicional").length}</b><span>largos</span></div>
      </div>
    </header>
    ${(C.avisos || []).length ? `<p class="ca-avisos">${C.avisos.map(esc).join("<br>")}</p>` : ""}
    <div class="ca-mandos">
      <div class="ca-mes">
        <button class="ca-btn" data-mes="-1" aria-label="Mes anterior">‹</button>
        <h2 aria-live="polite"></h2>
        <button class="ca-btn" data-mes="1" aria-label="Mes siguiente">›</button>
        <button class="ca-btn" data-hoy>Hoy</button>
      </div>
      <div class="ca-grupo" data-g="redes"><span>Red</span>${REDES.map(([k, n, c]) => `<button class="ca-chip" data-red="${k}" aria-pressed="true"><i style="background:${c}"></i>${n}</button>`).join("")}</div>
      <div class="ca-grupo" data-g="formato"><span>Qué</span>${FORMATOS.map(([k, n]) => `<button class="ca-chip" data-fmt="${k}" aria-pressed="false">${n}</button>`).join("")}</div>
      <div class="ca-grupo" data-g="estado"><span>Estado</span>${ESTADOS.map(([k, n]) => `<button class="ca-chip" data-est="${k}" aria-pressed="false">${n}</button>`).join("")}</div>
      <input class="ca-buscar" type="search" placeholder="Buscar: aceite, Acerbis, 28…" aria-label="Buscar en el calendario">
      <div class="ca-grupo ca-vistas" data-g="vista"><span>Ver</span><button class="ca-btn" data-vista="mes">Mes</button><button class="ca-btn" data-vista="lista">Lista</button></div>
    </div>
    <div class="ca-leyenda">${Object.entries(C.estados || {}).map(([k, t]) => `<span><b class="ca-est ${k.replace(" ", "-")}">${esc(k)}</b>${esc(t)}</span>`).join("")}</div>
    <div class="ca-cuerpo">
      <div class="ca-mesgrid" role="grid" aria-label="Días del mes"></div>
      <aside class="ca-detalle" aria-live="polite"></aside>
    </div>`;
  const $ = s => raiz.querySelector(s);
  const grid = $(".ca-mesgrid"), det = $(".ca-detalle"), cuerpo = $(".ca-cuerpo");

  function pintarMandos() {
    const [a, m] = st.mes.split("-").map(Number);
    $(".ca-mes h2").textContent = `${MESES[m - 1]} ${a}`;
    raiz.querySelectorAll("[data-red]").forEach(b => b.setAttribute("aria-pressed", String(st.redes.has(b.dataset.red))));
    raiz.querySelectorAll("[data-fmt]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.fmt === st.formato)));
    raiz.querySelectorAll("[data-est]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.est === st.estado)));
    raiz.querySelectorAll("[data-vista]").forEach(b => b.classList.toggle("on", b.dataset.vista === st.vista));
    const ini = C.desde.slice(0, 7), fin = C.hasta.slice(0, 7);
    raiz.querySelector('[data-mes="-1"]').disabled = st.mes <= ini;
    raiz.querySelector('[data-mes="1"]').disabled = st.mes >= fin;
  }

  function pintarMes() {
    const [a, m] = st.mes.split("-").map(Number);
    const uno = new Date(a, m - 1, 1), dias = new Date(a, m, 0).getDate();
    const celdas = [];
    for (let k = 0; k < diaSemana(uno); k++) celdas.push(null);
    for (let d = 1; d <= dias; d++) celdas.push(new Date(a, m - 1, d));
    while (celdas.length % 7) celdas.push(null);
    let html = `<div class="ca-sem cab" role="row">${DIAS.map(d => `<div role="columnheader">${d}</div>`).join("")}</div>`;
    for (let k = 0; k < celdas.length; k += 7) {
      html += `<div class="ca-sem" role="row">` + celdas.slice(k, k + 7).map(d => {
        if (!d) return `<div class="ca-dia vacio" role="gridcell"></div>`;
        const s = iso(d), L = delDia(s);
        const largo = L.find(x => x.formato === "largo" && x.estado !== "condicional"), cond = L.find(x => x.formato === "largo" && x.estado === "condicional");
        const cuenta = Object.fromEntries(REDES.map(([r]) => [r, L.filter(x => (x.redes || []).includes(r)).length]));
        const fuera = s < C.desde || s > C.hasta;
        const minis = L.filter(x => x.img).slice(0, 4);
        const pend = L.some(x => x.estado === "aprobado" || x.estado === "por hacer");
        const etiqueta = `${DIAS_LARGO[diaSemana(d)]} ${d.getDate()}: ${L.length} publicaciones` + (largo ? ", con vídeo largo" : "");
        return `<button class="ca-dia${s === HOY ? " hoy" : ""}${fuera ? " fuera" : ""}" role="gridcell" data-dia="${s}" aria-pressed="${s === st.dia}" aria-label="${esc(etiqueta)}">
          <span class="ca-dia-cab"><span class="ca-num">${d.getDate()}</span>${largo ? `<span class="ca-largo" title="${esc(largo.titulo)}">LARGO</span>` : cond ? `<span class="ca-largo cond" title="${esc(cond.titulo)}">¿LARGO?</span>` : ""}</span>
          <span class="ca-minis">${minis.map(x => `<img src="${esc(src(x.img))}" alt="" loading="lazy">`).join("")}${L.length > minis.length && minis.length ? `<span class="mas">+${L.length - minis.length}</span>` : ""}</span>
          <span class="ca-puntos">${REDES.filter(([r]) => cuenta[r]).map(([r, n, c]) => `<span title="${n}: ${cuenta[r]}"><i style="background:${c}"></i>${cuenta[r]}<b class="ca-solo-lector"> ${n}</b></span>`).join("")}</span>
          ${pend ? `<span class="ca-pend" title="Hay algo aprobado que falta programar"></span>` : ""}
        </button>`;
      }).join("") + `</div>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll("[data-dia]").forEach(b => b.onclick = () => { st.dia = b.dataset.dia; pintarMes(); pintarDetalle(); if (window.innerWidth < 1100) det.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }

  function tarjeta(x) {
    const vertical = x.formato !== "largo";
    const foto = x.img ? `<img class="ca-foto" src="${esc(src(x.img))}" alt="Portada: ${esc(x.titulo)}" loading="lazy" data-ver="${x._i}">`
      : `<div class="ca-foto ca-sinfoto">${x.estado === "por hacer" ? "POR HACER" : "SIN IMAGEN"}</div>`;
    const redes = (x.redes || []).map(r => `<span class="ca-red ${r}">${esc(NOMBRE_RED[r] || r)}</span>`).join("");
    const links = [];
    if (x.enlace) links.push(`<a href="${esc(x.enlace)}" target="_blank" rel="noopener">Abrir en YouTube</a>`);
    if (x.video) links.push(`<button type="button" data-video="${x._i}">Ver el vídeo</button>`);
    if (x.texto) links.push(`<button type="button" data-texto="${x._i}" aria-expanded="false">Ver el texto</button>`);
    return `<article class="ca-pieza ${vertical ? "" : "largo"} ${x.formato === "foto" ? "foto" : ""}">
      ${foto}
      <div>
        <div class="ca-linea1"><span class="ca-hora">${esc(x.hora || "")}</span>${redes}<span class="ca-fmt">${esc(FMT[x.formato] || x.formato)}${x.segundos ? " · " + (x.segundos >= 120 ? Math.round(x.segundos / 60) + " min" : x.segundos + " s") : ""}</span>
          <span class="ca-est ${esc((x.estado || "").replace(" ", "-"))}">${esc(x.estado === "aprobado" ? "falta programar" : x.estado === "previsto" ? "cola YouTube" : x.estado)}</span></div>
        <p class="ca-tit">${esc(x.titulo)}</p>
        <p class="ca-nota">${esc(x.nota || "")}${x.tipo_cola ? " · short " + esc(x.tipo_cola) : ""}${x.largo ? " · del vídeo " + esc(x.largo) : ""}${x.ia ? " · marcado como IA" : ""}</p>
        ${links.length ? `<div class="ca-acciones">${links.join("")}</div>` : ""}
        <p class="ca-texto" hidden>${esc(x.texto || "")}</p>
      </div>
    </article>`;
  }

  function enganchar(cont) {
    cont.querySelectorAll("[data-texto]").forEach(b => b.onclick = () => {
      const p = b.closest("article").querySelector(".ca-texto"); p.hidden = !p.hidden;
      b.setAttribute("aria-expanded", String(!p.hidden)); b.textContent = p.hidden ? "Ver el texto" : "Ocultar el texto";
    });
    cont.querySelectorAll("[data-ver]").forEach(im => im.onclick = () => visor(`<img src="${esc(im.src)}" alt="">`));
    cont.querySelectorAll("[data-video]").forEach(b => b.onclick = () => visor(`<video src="${esc(ITEMS[+b.dataset.video].video)}" controls autoplay playsinline></video>`));
  }

  function pintarDetalle() {
    cuerpo.classList.toggle("lista", st.vista === "lista");
    grid.hidden = st.vista === "lista";
    if (st.vista === "lista") {
      const desde = st.mes + "-01", hasta = st.mes + "-31";
      const L = ITEMS.filter(x => x.dia >= desde && x.dia <= hasta && pasa(x)).sort((a, b) => (a.dia + a.hora).localeCompare(b.dia + b.hora));
      let html = `<h3>${esc($(".ca-mes h2").textContent)}: ${L.length} publicaciones</h3><p class="ca-sub">Todo el mes en lista, con los filtros de arriba.</p>`;
      let ult = "";
      for (const x of L) {
        if (x.dia !== ult) { const d = deIso(x.dia); html += `<h4 class="ca-fecha-lista">${DIAS_LARGO[diaSemana(d)]} ${d.getDate()}${x.dia === HOY ? " · hoy" : ""}</h4>`; ult = x.dia; }
        html += tarjeta(x);
      }
      det.innerHTML = L.length ? html : html + `<p class="ca-vacio">Nada con estos filtros.</p>`;
      enganchar(det); return;
    }
    if (!st.dia) { det.innerHTML = `<h3>Elige un día</h3><p class="ca-sub">Pincha en cualquier día del mes para ver todo lo que sale.</p>`; return; }
    const d = deIso(st.dia), L = delDia(st.dia);
    const porRed = REDES.map(([r, n]) => [n, L.filter(x => (x.redes || []).includes(r)).length]).filter(z => z[1]);
    det.innerHTML = `<h3>${DIAS_LARGO[diaSemana(d)]} ${d.getDate()} de ${MESES[d.getMonth()]}${st.dia === HOY ? " · hoy" : ""}</h3>
      <p class="ca-sub">${L.length ? `${L.length} publicaciones · ${porRed.map(z => z[0] + " " + z[1]).join(" · ")}` : "Nada este día con estos filtros."}</p>
      ${L.map(tarjeta).join("")}`;
    enganchar(det);
  }

  function visor(html) {
    const v = document.createElement("div"); v.className = "ca-visor"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true");
    v.innerHTML = html + `<button type="button" aria-label="Cerrar">×</button>`;
    const cerrar = () => { v.remove(); document.removeEventListener("keydown", tecla); };
    const tecla = e => { if (e.key === "Escape") cerrar(); };
    v.onclick = e => { if (e.target === v || e.target.tagName === "BUTTON") cerrar(); };
    document.addEventListener("keydown", tecla);
    raiz.appendChild(v); v.querySelector("button").focus();
  }

  function todo() { pintarMandos(); pintarMes(); pintarDetalle(); guardar(); }

  raiz.querySelectorAll("[data-mes]").forEach(b => b.onclick = () => {
    const [a, m] = st.mes.split("-").map(Number); const n = new Date(a, m - 1 + Number(b.dataset.mes), 1);
    st.mes = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
    st.dia = HOY.slice(0, 7) === st.mes ? HOY : (ITEMS.find(x => x.dia.startsWith(st.mes) && pasa(x)) || {}).dia || null; todo();
  });
  $("[data-hoy]").onclick = () => { st.mes = HOY.slice(0, 7); st.dia = HOY; todo(); };
  raiz.querySelectorAll("[data-red]").forEach(b => b.onclick = () => {
    const r = b.dataset.red;
    if (st.redes.size === REDES.length) { st.redes = new Set([r]); }          // el primer clic deja solo esa red
    else if (st.redes.has(r)) { st.redes.delete(r); if (!st.redes.size) st.redes = new Set(REDES.map(x => x[0])); }
    else st.redes.add(r);
    todo();
  });
  raiz.querySelectorAll("[data-fmt]").forEach(b => b.onclick = () => { st.formato = b.dataset.fmt; todo(); });
  raiz.querySelectorAll("[data-est]").forEach(b => b.onclick = () => { st.estado = b.dataset.est; todo(); });
  raiz.querySelectorAll("[data-vista]").forEach(b => b.onclick = () => { st.vista = b.dataset.vista; todo(); });
  let tBus = null;
  $(".ca-buscar").oninput = e => { clearTimeout(tBus); tBus = setTimeout(() => { st.texto = norm(e.target.value.trim()); todo(); }, 180); };
  todo();
  return { actualizarTema() {}, destruir() { raiz.remove(); } };
}
export default montarCalendario;
