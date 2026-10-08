/* Tablones de Facebook e Instagram del Panel de redes TDR (08/10/2026, lo pidió Rubén).
   Facebook: todo lo que da la API de Meta (página, estadísticas de 30 días, comentarios CON NOMBRE y respuestas, reels con sus
   reproducciones y publicaciones). Datos: ../datos/facebook.json (PANEL-REDES/facebook_tablon.py).
   Instagram: «PENDIENTE» hasta que se conecte su API, con qué falta y cómo cerrarlo. Datos: ../datos/instagram.json
   (PANEL-REDES/instagram_estado.py). Los dos los rehacen las rutinas de las 9:00 y las 17:00. Sin dependencias.

   montarTablon(contenedor, { red: "facebook"|"instagram", datos }) → { actualizarTema(), destruir() } */

const CSS_URL = new URL("./tablon.css", import.meta.url).href;
const BASE_DATOS = new URL("../datos/", import.meta.url).href;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = x => x == null ? "–" : Number(x).toLocaleString("es-ES");
const fecha = s => { if (!s) return ""; const d = new Date(s.replace("+0000", "Z")); return isNaN(d) ? s.slice(0, 10) : d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }); };
const fechaHora = s => { if (!s) return ""; const d = new Date(s.replace("+0000", "Z")); return isNaN(d) ? s : d.toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };

function cargarCss() {
  return new Promise(ok => {
    let l = document.querySelector("link[data-tb-css]");
    if (l) return ok(l);
    l = document.createElement("link"); l.rel = "stylesheet"; l.href = CSS_URL; l.dataset.tbCss = "";
    l.onload = l.onerror = () => ok(l); document.head.appendChild(l);
  });
}
async function leer(datos, defecto) {
  if (datos && typeof datos === "object") return datos;
  const r = await fetch((datos || BASE_DATOS + defecto) + "?" + Date.now());
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function barras(dias, relativo = false) {
  // relativo (seguidores): la escala va del mínimo al máximo del mes, si no todas las barras salen llenas
  const v0 = dias.map(d => Number(d[1]) || 0), base = relativo ? Math.min(...v0) - Math.max(1, (Math.max(...v0) - Math.min(...v0)) * .25) : 0;
  const v = v0.map(x => x - base), max = Math.max(1, ...v), w = 100 / Math.max(1, v.length);
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">${v.map((x, i) =>
    `<rect x="${(i * w + w * .12).toFixed(2)}" y="${(40 - (x / max) * 38).toFixed(2)}" width="${(w * .76).toFixed(2)}" height="${((x / max) * 38 + .01).toFixed(2)}"><title>${esc(dias[i][0])}: ${v0[i]}</title></rect>`).join("")}</svg>`;
}

function comentario(c, sub = false) {
  return `<div class="tb-com">
    <div class="tb-com-cab"><b>${esc(c.autor || "Sin nombre")}</b>${c.es_tdr ? `<span class="tb-tdr">TDR</span>` : ""}${c.sin_responder ? `<span class="tb-sin">SIN RESPONDER</span>` : ""}
      <span>${esc(fechaHora(c.fecha))}</span>${c.me_gusta ? `<span>♥ ${n(c.me_gusta)}</span>` : ""}
      ${!sub && c.en_enlace ? `<span>en <a href="${esc(c.en_enlace)}" target="_blank" rel="noopener">${esc(c.en)}: ${esc(c.en_texto || "ver")}</a></span>` : ""}</div>
    <p>${esc(c.texto)}</p>
    ${(c.respuestas || []).length ? `<div class="tb-resp">${c.respuestas.map(r => comentario(r, true)).join("")}</div>` : ""}
  </div>`;
}

function montarFacebook(raiz, F) {
  const P = F.pagina || {}, R = F.resumen || {}, K = F.reel_kpi || {};
  const est = Object.entries(F.estadisticas || {});
  raiz.style.setProperty("--tb-color", "var(--tb-fb)");
  raiz.innerHTML = `
    <header class="tb-cab">
      ${P.foto ? `<img class="tb-foto" src="${esc(P.foto)}" alt="">` : ""}
      <div><div class="tb-ticker">FB · <em>${esc(P.usuario || "")}</em> · ACTUALIZADO ${esc(F.actualizado || "")}</div>
        <h1>Tablón de Facebook · ${esc(P.nombre || "")}</h1>
        <p>Todo lo que da la API de Meta de la página: estadísticas, comentarios con el nombre de quien comenta, reels y publicaciones.
          <a href="${esc(P.enlace)}" target="_blank" rel="noopener">Abrir la página ↗</a></p></div>
    </header>
    <div class="tb-kpis">
      <div class="tb-kpi"><b>${n(P.seguidores)}</b><span>seguidores</span></div>
      <div class="tb-kpi"><b>${n(R.publicaciones_120d)}</b><span>publicaciones (120 días)</span></div>
      <div class="tb-kpi"><b>${n(R.reels)}</b><span>reels</span></div>
      <div class="tb-kpi"><b>${n(R.reacciones_120d)}</b><span>reacciones (120 días)</span></div>
      <div class="tb-kpi"><b>${n(R.compartidos_120d)}</b><span>compartidos (120 días)</span></div>
      <div class="tb-kpi"><b>${n(R.comentarios)}</b><span>comentarios · ${n(R.respuestas)} respuestas</span></div>
      <div class="tb-kpi ${R.sin_responder ? "alerta" : ""}"><b>${n(R.sin_responder)}</b><span>sin responder</span></div>
    </div>
    ${est.length ? `<section class="tb-caja"><h2>Últimos 30 días <small>cada barra es un día (estadísticas de la página que da Meta)</small></h2>
      <div class="tb-stats">${est.map(([k, s]) => { const t = s.dias.reduce((a, d) => a + (Number(d[1]) || 0), 0); const ult = s.dias[s.dias.length - 1];
        return `<div class="tb-stat"><header><span>${esc(s.nombre)}</span><b>${k === "page_follows" ? n(ult && ult[1]) : n(t)}</b></header>${barras(s.dias, k === "page_follows")}
          <p class="tb-nota">${k === "page_follows" ? "seguidores el último día" : "suma de 30 días"} · último día ${n(ult && ult[1])}</p></div>`; }).join("")}</div></section>` : ""}
    <section class="tb-caja"><h2>Comentarios <small>con su nombre y sus respuestas</small>
      <span class="tb-filtros"><button class="tb-chip" data-c="todos" aria-pressed="true">Todos</button><button class="tb-chip" data-c="sin" aria-pressed="false">Sin responder</button><button class="tb-chip" data-c="publico" aria-pressed="false">Solo del público</button></span></h2>
      <div data-lista="com"></div></section>
    <section class="tb-caja"><h2>Reels <small>${n((F.reels || []).length)} · reproducciones y tiempo visto según Meta</small></h2><div class="tb-rejilla" data-lista="reels"></div></section>
    <section class="tb-caja"><h2>Publicaciones <small>últimos 120 días</small></h2><div class="tb-rejilla" data-lista="posts"></div></section>
    <p class="tb-nota">${esc(F.nota || "")}${(F.errores || []).length ? " · Avisos: " + F.errores.map(esc).join(" · ") : ""}</p>`;

  const lc = raiz.querySelector('[data-lista="com"]');
  let filtro = "todos";
  const pintarCom = () => {
    const L = (F.comentarios || []).filter(c => filtro === "todos" || (filtro === "sin" ? c.sin_responder : !c.es_tdr));
    lc.innerHTML = L.length ? L.map(c => comentario(c)).join("") :
      `<p class="tb-vacio">${filtro === "todos" ? "La página aún no tiene comentarios." : "Ninguno."} Solo hay ${n((F.comentarios || []).length)} en total: en Facebook casi nadie comenta (los de Instagram llegarán cuando se conecte su API).</p>`;
  };
  raiz.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
    filtro = b.dataset.c; raiz.querySelectorAll("[data-c]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); pintarCom();
  });
  pintarCom();

  const rejilla = (cont, L, tipo, paso = 12) => {
    let ver = paso;
    const pinta = () => {
      cont.innerHTML = L.slice(0, ver).map(x => {
        const e = x.estadisticas || {};
        const play = e.blue_reels_play_count ?? e.fb_reels_total_plays;
        const nums = tipo === "reel"
          ? `${play != null ? `<span><b>${n(play)}</b> reprod.</span>` : ""}<span>♥ <b>${n(x.me_gusta)}</b></span><span>💬 <b>${n(x.comentarios)}</b></span>${e.post_video_avg_time_watched ? `<span><b>${(e.post_video_avg_time_watched / 1000).toFixed(1)} s</b> de media</span>` : ""}${x.segundos ? `<span>${x.segundos} s</span>` : ""}`
          : `<span>👍 <b>${n(x.reacciones)}</b></span><span>💬 <b>${n(x.comentarios)}</b></span><span>↗ <b>${n(x.compartidos)}</b></span>`;
        return `<article class="tb-pieza ${tipo === "reel" ? "" : "post"}">
          ${x.imagen ? `<a href="${esc(x.enlace)}" target="_blank" rel="noopener"><img src="${esc(x.imagen)}" alt="" loading="lazy"></a>` : `<div class="tb-sinimg">SIN IMAGEN</div>`}
          <div class="tb-pie"><time>${esc(fecha(x.fecha))}</time><p title="Pincha para ver todo">${esc(x.texto || "(sin texto)")}</p><div class="tb-nums">${nums}</div></div></article>`;
      }).join("") + (L.length > ver ? `<button class="tb-mas" type="button">Ver más (${L.length - ver})</button>` : "");
      cont.querySelectorAll(".tb-pie p").forEach(p => p.onclick = () => p.classList.toggle("abierto"));
      const m = cont.querySelector(".tb-mas"); if (m) m.onclick = () => { ver += paso; pinta(); };
    };
    pinta();
  };
  rejilla(raiz.querySelector('[data-lista="reels"]'), F.reels || [], "reel");
  rejilla(raiz.querySelector('[data-lista="posts"]'), F.publicaciones || [], "post");
}

function montarInstagram(raiz, I) {
  raiz.style.setProperty("--tb-color", "var(--tb-ig)");
  const ok = I.estado === "conectado";
  raiz.innerHTML = `
    <header class="tb-cab">
      <div><div class="tb-ticker">IG · <em>@todoenrecambio</em> · COMPROBADO ${esc(I.actualizado || "")}</div>
        <h1>Tablón de Instagram</h1>
        <p>${ok ? "La API de Instagram ya responde: falta montar este tablón con sus datos (como el de Facebook)." : "Aquí irán los comentarios con nombre, las publicaciones y las estadísticas de Instagram en cuanto se conecte su API."}</p></div>
    </header>
    <section class="tb-caja tb-pendiente">
      <div class="tb-sello">${ok ? "CONECTADO" : "PENDIENTE"}</div>
      <p>${esc(I.por_que || "")}</p>
      <p class="tb-nota">Última comprobación: ${esc(I.comprobacion || "")} · Se vuelve a comprobar en cada rutina (9:00 y 17:00)${I.comprobaciones ? ` · ${I.comprobaciones === 1 ? "primera comprobación sin conectar" : `lleva ${n(I.comprobaciones)} comprobaciones sin conectar`}` : ""}.</p>
    </section>
    <div class="tb-dos">
      <section class="tb-caja"><h2>Lo que falta</h2><ul class="tb-lista">${(I.falta || []).map(x => `<li><span>${esc(x)}</span></li>`).join("")}</ul>
        <p class="tb-nota">Todo el detalle: ${esc(I.documento || "")}</p></section>
      <section class="tb-caja"><h2>Lo que saldrá aquí</h2><ul class="tb-lista">${(I.cuando_este || []).map(x => `<li><span>${esc(x)}</span></li>`).join("")}</ul>
        <p class="tb-nota">${esc(I.mientras || "")}</p></section>
    </div>`;
}

export async function montarTablon(contenedor, opciones = {}) {
  if (!contenedor) throw new Error("montarTablon: falta el contenedor");
  await cargarCss();
  const red = opciones.red === "instagram" ? "instagram" : "facebook";
  const raiz = document.createElement("section");
  raiz.className = "tb"; raiz.setAttribute("aria-label", red === "facebook" ? "Tablón de Facebook" : "Tablón de Instagram");
  contenedor.appendChild(raiz);
  try {
    const D = await leer(opciones.datos, red + ".json");
    (red === "facebook" ? montarFacebook : montarInstagram)(raiz, D);
  } catch (e) {
    raiz.innerHTML = `<p class="tb-vacio">El tablón aún no está listo: no se ha podido leer ${red}.json (${esc(e.message || e)}).</p>`;
  }
  return { actualizarTema() {}, destruir() { raiz.remove(); } };
}
export default montarTablon;
