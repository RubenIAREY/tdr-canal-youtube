/* Pestaña «Blog» del Panel de redes TDR (16/10/2026, lo pidió Rubén).
   Todo el blog de TodoEnRecambio en una pestaña: lo que tiene que hacer Rubén (Yoast, vídeos, enlaces rotos…), la cola de
   publicación, TODOS los posts con filtros (con vídeo / sin vídeo / falta meter el vídeo / sin Yoast…), el cruce con YouTube,
   Google (Search Console), oportunidades de título y meta, visitas reales (Analytics), lo que el blog manda a la tienda y las
   visitas desde ChatGPT y otras IA. Datos: ../datos/blog.json (lo rehace PANEL-REDES/blog_datos.py en las rutinas de las 9:00,
   las 12:30 y las 17:00). Sin dependencias.

   montarBlog(contenedor, { datos: url|objeto, clave, seccion }) → { actualizarTema(), irA(seccion), destruir() } */

const CSS_URL = new URL("./blog.css", import.meta.url).href;
const BASE_DATOS = new URL("../datos/", import.meta.url).href;
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const SECCIONES = [["blog-resumen", "Resumen"], ["blog-tareas", "Tareas"], ["blog-cola", "Cola"], ["blog-posts", "Posts"], ["blog-videos", "Vídeos"],
  ["blog-google", "Google"], ["blog-oportunidades", "Oportunidades"], ["blog-visitas", "Visitas"], ["blog-tienda", "Tienda"], ["blog-ia", "IA"]];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmt = (n, d = 0) => n == null || isNaN(n) ? "–" : Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
const pct = (a, b) => b ? (a - b) / b * 100 : null;
const signo = (n, d = 0) => n == null || isNaN(n) ? "" : (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n), d);
const clase = n => n == null || isNaN(n) || Math.abs(n) < 0.05 ? "igual" : n > 0 ? "sube" : "baja";
const deIso = s => { const [a, m, d] = s.slice(0, 10).split("-").map(Number); return new Date(a, m - 1, d); };
const fechaCorta = s => { if (!s) return "–"; const d = deIso(s); return `${d.getDate()} ${MES[d.getMonth()]}`; };
const fechaLarga = s => { if (!s) return "–"; const d = deIso(s); return `${DIA[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}${s.length > 10 ? " · " + s.slice(11, 16) : ""}`; };
const fechaAnio = s => { if (!s) return "–"; const d = deIso(s); return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`; };
const corto = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const ytMini = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const ytUrl = id => `https://youtu.be/${id}`;

function cargarCss() {
  return new Promise(ok => {
    let l = document.querySelector("link[data-bl-css]");
    if (l) return ok(l);
    l = document.createElement("link"); l.rel = "stylesheet"; l.href = CSS_URL; l.dataset.blCss = "";
    l.onload = l.onerror = () => ok(l); document.head.appendChild(l);
  });
}
async function leer(datos) {
  if (datos && typeof datos === "object") return datos;
  const r = await fetch((datos || BASE_DATOS + "blog.json") + "?" + Date.now());
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

/* ─────────── gráfica de líneas y barras en SVG (sin dependencias) ─────────── */
function grafica(cont, { fechas, series, alto = 240, fy = v => fmt(v), invertir = false, recortar = false }) {
  const W = 1000, H = alto, M = { l: 52, r: 12, t: 12, b: 26 };
  const n = fechas.length;
  if (!n) { cont.innerHTML = `<p class="bl-vacio">Sin datos todavía.</p>`; return; }
  const vals = series.flatMap(s => s.v.filter(x => x != null));
  let max = Math.max(...vals, 0), min = invertir ? Math.min(...vals) : 0;
  if (recortar && vals.length > 20) {          // tope en el percentil 97 si hay picos sueltos (p. ej. un día de bots)
    const o = [...vals].sort((a, b) => a - b), p97 = o[Math.floor(o.length * .97)];
    if (max > p97 * 1.8) max = p97 * 1.25;
  }
  if (invertir) { max = Math.ceil(max); min = Math.max(0, Math.floor(min)); }
  if (max === min) max = min + 1;
  const paso = (() => { const r = (max - min) / 4, e = Math.pow(10, Math.floor(Math.log10(r))); return [1, 2, 2.5, 5, 10].map(k => k * e).find(k => k >= r) || r; })();
  if (!invertir) max = Math.ceil(max / paso) * paso;
  const X = i => M.l + (W - M.l - M.r) * (n === 1 ? .5 : i / (n - 1));
  const anchoB = (W - M.l - M.r) / n;
  const Y = v => invertir ? M.t + (H - M.t - M.b) * (v - min) / (max - min) : H - M.b - (H - M.t - M.b) * (v - min) / (max - min);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map(x => x.n).join(", "))}">`;
  for (let v = invertir ? min : 0; v <= max + 1e-9; v += paso) {
    s += `<line class="rej" x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="eje" x="${M.l - 6}" y="${Y(v) + 3.5}" text-anchor="end">${esc(fy(v))}</text>`;
  }
  let ultMes = "";
  fechas.forEach((f, i) => {
    const m = f.slice(0, 7);
    if (m !== ultMes && (+f.slice(8, 10) <= 7 || i === 0)) {
      ultMes = m; const d = deIso(f);
      s += `<text class="eje" x="${X(i)}" y="${H - 8}" text-anchor="${i === 0 ? "start" : "middle"}">${MES[d.getMonth()]}${d.getMonth() === 0 || i === 0 ? " " + d.getFullYear() : ""}</text>`;
    }
  });
  for (const se of series) {
    if (se.tipo === "barra") {
      se.v.forEach((v, i) => { if (v == null) return; const y = Y(Math.min(v, max)); s += `<rect x="${X(i) - anchoB * .4}" y="${y}" width="${anchoB * .8}" height="${Math.max(0, Y(0) - y)}" style="fill:${se.c};opacity:${se.op ?? .55}"/>`;
        if (v > max) s += `<text class="eje" x="${X(i)}" y="${M.t + 9}" text-anchor="middle">▲ ${esc(fy(v))}</text>`; });
    } else {
      let d = ""; se.v.forEach((v, i) => { if (v == null) return; d += (d ? "L" : "M") + X(i).toFixed(1) + " " + Y(Math.min(v, max)).toFixed(1); });
      s += `<path d="${d}" style="fill:none;stroke:${se.c};stroke-width:${se.ancho || 2};stroke-linejoin:round${se.guion ? ";stroke-dasharray:5 4" : ""}"/>`;
    }
  }
  s += `<line class="cursor" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/><rect x="${M.l}" y="0" width="${W - M.l - M.r}" height="${H}" fill="transparent" data-capa/></svg>`;
  cont.classList.add("bl-graf");
  cont.innerHTML = s + `<div class="bl-tip" hidden></div>`;
  const svg = cont.querySelector("svg"), cur = svg.querySelector(".cursor"), tip = cont.querySelector(".bl-tip");
  const mover = e => {
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(n - 1, Math.round((x - M.l) / (W - M.l - M.r) * (n - 1))));
    cur.setAttribute("x1", X(i)); cur.setAttribute("x2", X(i)); cur.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.innerHTML = `${esc(fechaLarga(fechas[i]))}<br>` + series.map(se => `<span style="color:${se.c}">●</span> ${esc(se.n)}: <b>${se.v[i] == null ? "–" : esc(fy(se.v[i]))}</b>`).join("<br>");
    const px = X(i) / W * r.width, py = Math.min(...series.map(se => se.v[i] == null ? H : Y(Math.min(se.v[i], max)))) / H * r.height;
    tip.style.left = Math.max(70, Math.min(r.width - 70, px)) + "px"; tip.style.top = Math.max(40, py - 6) + "px";
  };
  svg.addEventListener("pointermove", mover);
  svg.addEventListener("pointerleave", () => { tip.hidden = true; cur.setAttribute("visibility", "hidden"); });
}
const media7 = v => v.map((_, i) => { const t = v.slice(Math.max(0, i - 6), i + 1).filter(x => x != null); return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null; });

export async function montarBlog(contenedor, opciones = {}) {
  if (!contenedor) throw new Error("montarBlog: falta el contenedor");
  await cargarCss();
  const CLAVE = (opciones.clave || "tdr-blog") + "-v1";
  const raiz = document.createElement("section");
  raiz.className = "bl"; raiz.setAttribute("aria-label", "Blog de TodoEnRecambio");
  contenedor.appendChild(raiz);

  let B;
  try { B = await leer(opciones.datos); } catch (e) {
    raiz.innerHTML = `<p class="bl-vacio">La pestaña Blog todavía no está lista: no se ha podido leer blog.json (${esc(e.message || e)}).</p>`;
    return { actualizarTema() {}, irA() {}, destruir() { raiz.remove(); } };
  }
  const P = B.posts || [], V = B.videos || {}, K = B.kpis || {}, G = B.gsc || {}, A = B.ga || {}, T = B.tienda || {}, IA = B.ia || {};
  const PID = Object.fromEntries(P.map(p => [p.id, p]));
  P.forEach(p => { p._busca = norm([p.titulo, p.slug, p.id, (p.categorias || []).join(" "), p.meta, (p.consultas || []).map(c => c.q).join(" ")].join(" ")); });
  const HOY = B.hoy;

  /* estado de los filtros: en el navegador y en la dirección (#blog-posts&video=sin…) para poder pasar un enlace */
  const BASE_ST = { estado: "todos", video: "todos", yoast: "todos", vertical: "todos", extra: "todos", q: "", orden: "cola", n: 40 };
  let st = { ...BASE_ST };
  try { Object.assign(st, JSON.parse(localStorage.getItem(CLAVE) || "{}")); } catch (e) { /* sin almacenamiento */ }
  const deHash = h => {
    const partes = (h || "").replace(/^#/, "").split("&");
    const q = Object.fromEntries(partes.slice(1).map(x => x.split("=").map(decodeURIComponent)));
    if (Object.keys(q).length) { st = { ...BASE_ST, ...q, n: 40 }; }
    return partes[0];
  };
  const guardar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify({ ...st, n: 40 })); } catch (e) { /* nada */ }
    const q = Object.entries(st).filter(([k, v]) => k !== "n" && v !== BASE_ST[k] && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    if (location.hash.startsWith("#blog")) history.replaceState(null, "", location.search + "#blog-posts" + (q.length ? "&" + q.join("&") : ""));
  };

  /* ─────────── pintar todo ─────────── */
  const tareas = B.avisos_tarea || [];
  const nTareas = tareas.filter(t => t.nivel !== "baja").length;
  raiz.innerHTML = `
    <header class="bl-cab" id="blog-resumen">
      <div>
        <div class="bl-ticker"><em>TDR</em>:BLOG · ${esc(fmt(K.publicados))} POSTS</div>
        <h1>Blog de TodoEnRecambio</h1>
        <p>Actualizado el ${esc(fechaLarga(B.actualizado))}. WordPress en directo, Search Console (28 días, del ${esc(fechaCorta((G.ventana || [])[0]))} al ${esc(fechaCorta((G.ventana || [])[1]))}),
          Google Analytics (30 días) y los vídeos del canal. Lo único que haces a mano es pegar el Yoast: aquí tienes cada texto para copiarlo.</p>
      </div>
      <div class="bl-enlaces">
        <a class="bl-boton" href="${esc(B.informe_lunes)}" target="_blank" rel="noopener">Informe SEO del lunes ↗</a>
        <a class="bl-boton" href="${esc(B.admin)}" target="_blank" rel="noopener">Abrir WordPress ↗</a>
        <button class="bl-boton" type="button" data-csv>Descargar posts (CSV)</button>
      </div>
    </header>
    <nav class="bl-indice" aria-label="Secciones del blog">${SECCIONES.map(([id, n]) => `<a href="#${id}" data-ir="${id}">${n}${id === "blog-tareas" && nTareas ? `<b>${nTareas}</b>` : ""}</a>`).join("")}</nav>
    <div class="bl-cifras" id="bl-cifras"></div>
    <section class="bl-sec" id="blog-tareas"><h2>Lo que tienes que hacer <small>ordenado por urgencia · rojo = esta semana</small></h2><div class="bl-tareas" id="bl-tareas"></div></section>
    <section class="bl-caja" id="blog-cola"><h2>Cola de publicación <small>programados en WordPress y, detrás, los borradores con su fecha propuesta</small></h2><div id="bl-cola"></div></section>
    <section class="bl-caja" id="blog-posts"><h2>Todos los posts <small>pincha en uno para ver sus búsquedas, su Yoast para copiar, sus vídeos y sus enlaces</small></h2>
      <div class="bl-mandos" id="bl-mandos"></div><div class="bl-posts" id="bl-posts"></div></section>
    <section class="bl-caja" id="blog-videos"><h2>Blog ↔ YouTube <small>cada vídeo dentro de su post y cada descripción enlazando al post: que se alimenten uno al otro</small></h2><div id="bl-videos"></div></section>
    <section class="bl-caja" id="blog-google"><h2>Google <small>Search Console · clics, impresiones y posición de los posts</small></h2><div id="bl-google"></div></section>
    <section class="bl-caja" id="blog-oportunidades"><h2>Oportunidades <small>posts que salen en Google pero casi no reciben clics: un título o una meta mejores los suben</small></h2><div id="bl-oport"></div></section>
    <section class="bl-caja" id="blog-visitas"><h2>Visitas reales <small>Google Analytics · solo cuentan las visitas con interacción (≥ 10 s, 2 páginas o un evento)</small></h2><div id="bl-visitas"></div></section>
    <section class="bl-caja" id="blog-tienda"><h2>Del blog a la tienda <small>¿el blog vende? lo que pasa después de leer un post</small></h2><div id="bl-tienda"></div></section>
    <section class="bl-caja" id="blog-ia"><h2>Asistentes de IA <small>visitas desde ChatGPT, Gemini, Copilot, Claude y Perplexity (90 días)</small></h2><div id="bl-ia"></div></section>
    <p class="bl-nota">${esc(B.nota || "")} ${(B.avisos || []).length ? "Avisos de la última actualización: " + esc(B.avisos.join(" · ")) : ""}</p>`;
  const $ = s => raiz.querySelector(s);

  /* ─────────── cifras ─────────── */
  function cifras() {
    const c = (v, t, extra = "", cls = "", ir = "") => `<${ir ? "button type=\"button\"" : "div"} class="bl-cifra ${cls}" ${ir}><b>${v}</b><span>${t}${extra}</span></${ir ? "button" : "div"}>`;
    const d = (a, b) => { const p = pct(a, b); return p == null ? "" : ` <i class="${clase(p)}">${signo(p, 0)} %</i>`; };
    $("#bl-cifras").innerHTML = [
      c(fmt(K.publicados), "publicados", ` · ${fmt(K.publicados_30)} en 30 días`),
      c(fmt(K.programados), "programados", K.siguiente ? ` · el próximo ${esc(fechaLarga(K.siguiente))}` : "", "", `data-filtro="estado=programado"`),
      c(fmt(K.borradores), "borradores", ` · ${fmt(K.sin_yoast_borr)} sin Yoast`, "", `data-filtro="estado=borrador"`),
      c(K.cola_hasta ? fechaCorta(K.cola_hasta) : "–", "la cola llega hasta", ` · ${fmt(K.dias_cola)} días`, K.dias_cola < 4 ? "alerta" : K.dias_cola < 7 ? "ojo" : ""),
      c(fmt(K.sin_yoast_cola), "programados sin Yoast", "", K.sin_yoast_cola ? "alerta" : "", `data-filtro="estado=programado&yoast=sin"`),
      c(fmt(K.sin_yoast_pub), "publicados sin Yoast", "", K.sin_yoast_pub ? "ojo" : "", `data-filtro="estado=publicado&yoast=sin"`),
      c(fmt(K.con_video), "publicados con vídeo", ` · ${fmt(K.publicados ? K.con_video / K.publicados * 100 : 0)} %`, "", `data-filtro="estado=publicado&video=con"`),
      c(fmt(K.falta_video + (K.quiza_video || 0)), "con un vídeo de su tema sin meter", "", K.falta_video ? "ojo" : "", `data-filtro="video=falta"`),
      c(fmt(G.clics), "clics de Google (28 d)", d(G.clics, G.clics_prev)),
      c(fmt(G.impr), "impresiones (28 d)", d(G.impr, G.impr_prev)),
      c(fmt(G.pos, 1), "posición media", G.pos_prev != null ? ` <i class="${clase(G.pos_prev - G.pos)}">${signo(G.pos - G.pos_prev, 1)}</i>` : ""),
      c(fmt(A.reales), "visitas reales (30 d)", d(A.reales, A.reales_prev)),
      c(fmt(A.es_reales), "de España (30 d)", d(A.es_reales, A.es_reales_prev)),
      c(fmt(T.a_tienda), "visitas a la tienda desde el blog", ` · ${fmt(T.carrito_desde)} al carrito`),
      c(fmt(IA.total), "visitas desde IA (90 d, web entera)", ` · ${fmt(IA.blog)} al blog`),
    ].join("");
    raiz.querySelectorAll("[data-filtro]").forEach(b => b.onclick = () => filtrar(b.dataset.filtro));
  }

  /* ─────────── tareas ─────────── */
  const GRUPOS = [
    ["cola", "La cola se acaba", "Programa los siguientes borradores (antes, pega su Yoast).", null],
    ["yoast", "Yoast por pegar en programados", "Salen sin meta descripción si no la pegas antes. Copia el texto y abre el editor.", "estado=programado&yoast=sin"],
    ["roto", "Enlaces a posts sin publicar", "Al lector le dan error 404 hasta que se publique el otro post.", "extra=rotos"],
    ["video", "Falta meter el vídeo en el post", "Hay un vídeo largo del mismo tema que no está dentro del post.", "video=falta"],
    ["video_sin_blog", "Vídeos largos que no están en ningún post", "Mételos en el post que encaja o haz el blog de ese tema.", null],
    ["indexacion", "Google aún no los ha indexado", "Publicados hace más de 7 días y sin indexar (inspección de URL de Search Console).", "extra=noindex"],
    ["duplicado", "Posibles duplicados", "Borradores o programados con un título muy parecido a otro post: que no compitan entre sí.", "extra=parecido"],
    ["imagen", "Sin imagen destacada", "", "extra=sinimg"],
    ["desc", "El vídeo está en el post, pero su descripción no enlaza al post", "Añade el enlace del post en la descripción de YouTube (la rutina de las 12:00 lo puede hacer).", null],
    ["yoast_pub", "Publicados sin Yoast", "Ya están en Google con la descripción que se inventa Google. Pega su meta cuando puedas.", "estado=publicado&yoast=sin"],
  ];
  function tareasHtml() {
    const por = {}; tareas.forEach(t => (por[t.tipo] = por[t.tipo] || []).push(t));
    const html = GRUPOS.filter(([k]) => por[k]).map(([k, tit, sub, filtro]) => {
      const L = por[k], nivel = L.some(t => t.nivel === "alta") ? "alta" : L.some(t => t.nivel === "media") ? "media" : "baja";
      const items = L.map((t, i) => {
        const p = t.id ? PID[t.id] : null, v = t.video ? V[t.video] : null;
        const acc = [];
        if (p && p.yoast_prep && !p.yoast && /yoast/.test(k)) acc.push(`<button class="bl-boton mini" data-copiar="${esc(p.yoast_prep.meta || "")}">Copiar meta</button>`, `<button class="bl-boton mini" data-copiar="${esc(p.yoast_prep.frase || "")}">Copiar frase clave</button>`);
        if (p) acc.push(`<a class="bl-boton mini" href="${esc(p.editar)}" target="_blank" rel="noopener">Editar en WordPress ↗</a>`, `<a class="bl-boton mini" href="${esc(p.ver)}" target="_blank" rel="noopener">Ver post ↗</a>`);
        if (v) acc.push(`<a class="bl-boton mini" href="${esc(ytUrl(v.id))}" target="_blank" rel="noopener">Ver vídeo ↗</a>`);
        if (p) acc.push(`<button class="bl-boton mini" data-abrir="${p.id}">Ficha</button>`);
        return `<li ${i >= 5 ? "hidden" : ""}>${p ? `<span class="tit">${esc(corto(p.titulo, 90))}</span> · ` : ""}${esc(t.texto)}${acc.length ? `<div class="acc">${acc.join("")}</div>` : ""}</li>`;
      }).join("");
      return `<article class="bl-tarea ${nivel}"><h3>${esc(tit)}<b>${L.length}</b></h3>${sub ? `<p>${esc(sub)}</p>` : ""}<ul>${items}</ul>
        ${L.length > 5 ? `<button class="bl-mas" data-mas>Ver los ${L.length}</button>` : ""}${filtro ? ` <button class="bl-mas" data-filtro="${filtro}">Filtrarlos en la lista de posts</button>` : ""}</article>`;
    }).join("");
    $("#bl-tareas").innerHTML = html || `<p class="bl-vacio">Nada pendiente. 👌</p>`;
    $("#bl-tareas").querySelectorAll("[data-mas]").forEach(b => b.onclick = () => { b.closest("article").querySelectorAll("li[hidden]").forEach(li => li.hidden = false); b.remove(); });
    $("#bl-tareas").querySelectorAll("[data-filtro]").forEach(b => b.onclick = () => filtrar(b.dataset.filtro));
  }

  /* ─────────── cola ─────────── */
  function cola() {
    const prog = P.filter(p => p.estado === "programado").sort((a, b) => a.fecha.localeCompare(b.fecha));
    const borr = P.filter(p => p.estado === "borrador" && p.fecha_propuesta).sort((a, b) => a.fecha_propuesta.localeCompare(b.fecha_propuesta));
    const sinFecha = P.filter(p => p.estado === "borrador" && !p.fecha_propuesta);
    const tarjeta = (p, cuando) => `<article class="bl-cola-item ${p.estado}">
      ${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : `<div class="sinimg">SIN IMAGEN</div>`}
      <div class="cuerpo"><div class="cuando">${esc(cuando)}</div><div class="tit">${esc(p.titulo)}</div>
        <div class="ets"><span class="bl-et ${p.vertical}">${esc(p.vertical)}</span>${p.yoast ? `<span class="bl-et ok">Yoast ✓</span>` : `<span class="bl-et mal">Falta Yoast</span>`}
          ${p.video_estado === "con" ? `<span class="bl-et ok">Vídeo ✓</span>` : p.video_estado === "falta" ? `<span class="bl-et ojo">Falta vídeo</span>` : ""}
          ${p.lote ? `<span class="bl-et gris">lote ${esc(p.lote)}</span>` : ""}</div>
        <div class="ets">${!p.yoast && p.yoast_prep ? `<button class="bl-boton mini" data-copiar="${esc(p.yoast_prep.meta || "")}">Copiar meta</button>` : ""}
          <a class="bl-boton mini" href="${esc(p.editar)}" target="_blank" rel="noopener">Editar ↗</a><button class="bl-boton mini" data-abrir="${p.id}">Ficha</button></div></div></article>`;
    // barra: días cubiertos de los próximos 30
    const dias = 30, cubiertos = Math.max(0, Math.min(dias, K.dias_cola || 0));
    const finProp = borr.length ? borr[borr.length - 1].fecha_propuesta : null;
    $("#bl-cola").innerHTML = `
      <p class="bl-sub">${prog.length ? `Hay <b>${prog.length}</b> posts programados: el blog tiene posts hasta el <b>${esc(fechaLarga(K.cola_hasta))}</b> (${fmt(K.dias_cola)} días).` : "No hay ningún post programado."}
        ${borr.length ? ` Detrás hay <b>${borr.length}</b> borradores con fecha propuesta, hasta el ${esc(fechaAnio(finProp))}.` : ""}${sinFecha.length ? ` ${sinFecha.length} borradores más no tienen fecha.` : ""}
        Ritmo: uno cada dos días a las 13:00.</p>
      <div class="bl-barra-cola" title="${cubiertos} de los próximos ${dias} días con post programado"><i style="width:${cubiertos / dias * 100}%;background:var(--bl-ok)"></i><i style="width:${(dias - cubiertos) / dias * 100}%;background:color-mix(in srgb,var(--bl-mal) 35%,transparent)"></i></div>
      <div class="bl-cola">${prog.map(p => tarjeta(p, fechaLarga(p.fecha))).join("")}
        ${borr.length ? `<div class="bl-cola-sep">Borradores con fecha propuesta (aún sin programar)</div>` + borr.slice(0, 8).map(p => tarjeta(p, "propuesto · " + fechaLarga(p.fecha_propuesta))).join("") : ""}</div>
      ${borr.length > 8 ? `<p class="bl-nota">Y ${borr.length - 8} borradores más con fecha propuesta: <button class="bl-mas" data-filtro="estado=borrador">verlos todos en la lista</button></p>` : ""}`;
    $("#bl-cola").querySelectorAll("[data-filtro]").forEach(b => b.onclick = () => filtrar(b.dataset.filtro));
  }

  /* ─────────── lista de posts con filtros ─────────── */
  const GRUPOS_F = [
    ["estado", "Estado", [["todos", "Todos"], ["publicado", "Publicados"], ["programado", "Programados"], ["borrador", "Borradores"]]],
    ["video", "Vídeo", [["todos", "Todos"], ["con", "Con vídeo"], ["sin", "Sin vídeo"], ["falta", "Falta meter el suyo"], ["quiza", "Quizá encaja uno"]]],
    ["yoast", "Yoast", [["todos", "Todos"], ["con", "Con Yoast"], ["sin", "Sin Yoast"]]],
    ["vertical", "Tipo", [["todos", "Todo"], ["moto", "Moto"], ["coche", "Coche"], ["otro", "Otro"]]],
    ["extra", "Más", [["todos", "—"], ["rotos", "Enlaces rotos"], ["noindex", "Sin indexar"], ["ganar", "Pierde clics"], ["parecido", "Parecido a otro"], ["sinimg", "Sin imagen"], ["tienda", "Manda a la tienda"]]],
  ];
  const ORDENES = [["cola", "Próximos primero"], ["reciente", "Más recientes"], ["clics", "Más clics de Google"], ["impr", "Más impresiones"], ["ganar", "Más clics perdidos"],
    ["reales", "Más visitas reales"], ["tienda", "Más visitas a la tienda"], ["pos", "Mejor posición"], ["antiguo", "Más antiguos"]];
  const pasaGrupo = (p, g, v) => {
    if (v === "todos") return true;
    if (g === "estado") return p.estado === v;
    if (g === "video") return v === "falta" ? p.video_estado === "falta" : v === "quiza" ? p.video_estado === "quiza" : v === "sin" ? p.video_estado !== "con" : p.video_estado === "con";
    if (g === "yoast") return v === "con" ? p.yoast : !p.yoast;
    if (g === "vertical") return p.vertical === v;
    if (g === "extra") return v === "rotos" ? (p.enlaces_rotos || []).length > 0 : v === "noindex" ? !!(p.indexado && p.indexado.verdict !== "PASS")
      : v === "ganar" ? p.ganar > 0 : v === "parecido" ? !!p.parecido : v === "sinimg" ? !p.img : v === "tienda" ? p.a_tienda > 0 : true;
    return true;
  };
  const pasa = (p, salvo) => GRUPOS_F.every(([g]) => g === salvo || pasaGrupo(p, g, st[g])) && (!st.q || p._busca.includes(norm(st.q)));
  const clave = p => p.fecha || p.fecha_propuesta || p.creado || "";
  const ORDENAR = {
    cola: (a, b) => { const r = p => p.estado === "programado" ? 0 : p.estado === "borrador" && p.fecha_propuesta ? 1 : p.estado === "borrador" ? 2 : 3;
      return r(a) - r(b) || (r(a) < 3 ? clave(a).localeCompare(clave(b)) : clave(b).localeCompare(clave(a))); },
    reciente: (a, b) => clave(b).localeCompare(clave(a)), antiguo: (a, b) => clave(a).localeCompare(clave(b)),
    clics: (a, b) => b.clics - a.clics, impr: (a, b) => b.impr - a.impr, ganar: (a, b) => b.ganar - a.ganar || b.impr - a.impr,
    reales: (a, b) => b.reales - a.reales, tienda: (a, b) => b.a_tienda - a.a_tienda || b.carrito_desde - a.carrito_desde,
    pos: (a, b) => (a.pos ?? 999) - (b.pos ?? 999),
  };
  function mandos() {
    $("#bl-mandos").innerHTML = GRUPOS_F.map(([g, n, ops]) => `<div class="bl-grupo" data-g="${g}"><span>${n}</span>${ops.map(([k, t]) => {
      const cuenta = P.filter(p => pasa(p, g) && pasaGrupo(p, g, k)).length;
      return `<button class="bl-chip ${["sin", "falta", "rotos", "noindex"].includes(k) && g !== "estado" ? "rojo" : ""}" data-g="${g}" data-v="${k}" aria-pressed="${st[g] === k}">${t} <small>${fmt(cuenta)}</small></button>`;
    }).join("")}</div>`).join("") + `<div class="bl-fila-mandos">
        <input class="bl-buscar" type="search" placeholder="Buscar por título, ID, categoría o búsqueda de Google…" value="${esc(st.q)}" aria-label="Buscar posts">
        <select class="bl-select" aria-label="Ordenar">${ORDENES.map(([k, t]) => `<option value="${k}" ${st.orden === k ? "selected" : ""}>${t}</option>`).join("")}</select>
        <button class="bl-boton mini" type="button" data-limpiar>Quitar filtros</button><button class="bl-boton mini" type="button" data-enlace>Copiar enlace a esta vista</button>
        <span class="bl-cuenta" id="bl-cuenta"></span></div>`;
    $("#bl-mandos").querySelectorAll(".bl-chip").forEach(b => b.onclick = () => { st[b.dataset.g] = b.dataset.v; st.n = 40; guardar(); mandos(); lista(); });
    const bus = $("#bl-mandos .bl-buscar");
    let t = null;
    bus.oninput = () => { clearTimeout(t); t = setTimeout(() => { st.q = bus.value.trim(); st.n = 40; guardar(); actualizarCuentas(); lista(); }, 180); };
    $("#bl-mandos select").onchange = e => { st.orden = e.target.value; guardar(); lista(); };
    $("#bl-mandos [data-limpiar]").onclick = () => { st = { ...BASE_ST }; guardar(); mandos(); lista(); };
    $("#bl-mandos [data-enlace]").onclick = () => { guardar(); location.hash.startsWith("#blog-posts") || history.replaceState(null, "", location.search + "#blog-posts"); copiar(location.href, "Enlace copiado"); };
  }
  function actualizarCuentas() {
    $("#bl-mandos").querySelectorAll(".bl-chip").forEach(b => { const g = b.dataset.g, k = b.dataset.v; b.querySelector("small").textContent = fmt(P.filter(p => pasa(p, g) && pasaGrupo(p, g, k)).length); });
  }
  const filtrados = () => P.filter(p => pasa(p)).sort(ORDENAR[st.orden] || ORDENAR.cola);
  function celdaVideo(p) {
    const puestos = (p.videos || []).filter(v => V[v]);
    if (puestos.length) {
      const v = V[puestos[0]], vuelta = (p.video_enlaza_post || {})[v.id];
      return `<div class="bl-vid"><img src="${esc(ytMini(v.id))}" alt="" loading="lazy"><span>✓ ${esc(v.titulo)}</span></div>
        <span class="peq">${puestos.length > 1 ? `y ${puestos.length - 1} más · ` : ""}${v.largo ? (vuelta ? "la descripción enlaza aquí" : "<span class='baja'>la descripción no enlaza aquí</span>") : "short"}</span>`;
    }
    if (p.video_falta && V[p.video_falta]) {
      const v = V[p.video_falta], fuerte = p.video_estado === "falta";
      return `<span class="bl-et ${fuerte ? "mal" : "ojo"}">${fuerte ? "Falta meter este" : "¿Este?"}</span><div class="bl-vid"><img src="${esc(ytMini(v.id))}" alt="" loading="lazy"><span>${esc(v.titulo)}</span></div>`;
    }
    if ((p.videos_otros || []).length) return `<span class="bl-et gris">Vídeo de otro canal</span>`;
    return `<span class="bl-et gris">Sin vídeo</span>${(p.shorts_tema || []).length ? `<span class="peq">${p.shorts_tema.length} shorts del tema</span>` : ""}`;
  }
  function fila(p) {
    const est = p.estado === "publicado" ? fechaAnio(p.fecha) : p.estado === "programado" ? fechaLarga(p.fecha) : p.fecha_propuesta ? "propuesto " + fechaCorta(p.fecha_propuesta) : "sin fecha";
    const dC = p.clics_prev ? pct(p.clics, p.clics_prev) : null;
    return `<div class="bl-post" data-id="${p.id}"><div class="fila" role="button" tabindex="0" aria-expanded="false">
      ${p.img ? `<img class="foto" src="${esc(p.img)}" alt="" loading="lazy">` : `<div class="foto sin">SIN IMAGEN</div>`}
      <div><div class="titulo">${esc(p.titulo)}</div><div class="meta"><span class="bl-et ${p.vertical}">${esc(p.vertical)}</span><span>ID ${p.id}</span>
        ${(p.categorias || []).slice(0, 2).map(c => `<span>${esc(c)}</span>`).join(" · ")}<span>${fmt(p.palabras)} palabras</span>
        ${(p.enlaces_rotos || []).length ? `<span class="bl-et mal">${p.enlaces_rotos.length} enlace(s) roto(s)</span>` : ""}
        ${p.parecido ? `<span class="bl-et ojo">parecido al ${p.parecido.id}</span>` : ""}
        ${p.indexado && p.indexado.verdict !== "PASS" ? `<span class="bl-et mal">sin indexar</span>` : ""}</div></div>
      <div class="col"><span class="bl-et ${p.estado}">${esc(p.estado)}</span><span class="peq">${esc(est)}</span></div>
      <div class="col">${p.yoast ? `<span class="bl-et ok">Yoast ✓</span>` : `<span class="bl-et mal">Falta Yoast</span>${p.yoast_prep && p.yoast_prep.meta ? `<button class="bl-boton mini" data-copiar="${esc(p.yoast_prep.meta)}">Copiar meta</button>` : `<span class="peq">sin texto preparado</span>`}`}</div>
      <div class="col">${celdaVideo(p)}</div>
      <div class="col n">${p.impr ? `<span class="grande">${fmt(p.clics)}</span><span class="peq">clics ${dC != null ? `<i class="${clase(dC)}">${signo(dC)} %</i>` : ""}</span><span class="peq">${fmt(p.impr)} impr. · pos. ${fmt(p.pos, 1)}</span>` : `<span class="peq">${p.estado === "publicado" ? "sin datos de Google" : "–"}</span>`}</div>
      <div class="col n">${p.sesiones ? `<span class="grande">${fmt(p.reales)}</span><span class="peq">reales · ${fmt(p.es_reales)} España</span>` : `<span class="peq">–</span>`}</div>
      <div class="col n">${p.a_tienda || p.carrito_desde ? `<span class="grande">${fmt(p.a_tienda)}</span><span class="peq">a la tienda · ${fmt(p.carrito_desde)} carrito</span>` : `<span class="peq">–</span>`}</div>
    </div></div>`;
  }
  function detalle(p) {
    const vids = (p.videos || []).filter(v => V[v]).map(v => V[v]);
    const tema = (p.videos_tema || []).filter(x => !x.puesto && V[x.id]);
    const yp = p.yoast_prep || {};
    const caja = (t, txt) => txt ? `<div class="bl-copiar"><b>${t}</b><p>${esc(txt)}</p><button class="bl-boton mini" data-copiar="${esc(txt)}">Copiar</button></div>` : "";
    const ix = p.indexado;
    return `<div class="bl-detalle">
      <div class="bloque"><h4>Búsquedas de Google (28 días)</h4>${(p.consultas || []).length ? `<table class="bl-mini-tabla"><thead><tr><th>Búsqueda</th><th class="n">Clics</th><th class="n">Impr.</th><th class="n">Pos.</th></tr></thead><tbody>
        ${p.consultas.map(c => `<tr><td>${esc(c.q)}</td><td class="n">${fmt(c.c)}</td><td class="n">${fmt(c.i)}</td><td class="n">${fmt(c.pos, 1)}</td></tr>`).join("")}</tbody></table>` : `<p class="bl-vacio">Sin búsquedas todavía.</p>`}
        ${p.ganar ? `<p class="bl-nota">Con un CTR normal para su posición tendría ~<b>${fmt(p.ganar)}</b> clics más en 28 días.</p>` : ""}
        ${p.sesiones ? `<p class="bl-nota">Analytics (30 d): ${fmt(p.sesiones)} visitas, ${fmt(p.reales)} reales (${fmt(p.es_reales)} de España), ${fmt(p.lecturas)} lecturas${p.seg_medio ? `, ${fmt(p.seg_medio)} s de media` : ""}${p.ia ? `, ${fmt(p.ia)} desde IA (90 d)` : ""}.</p>` : ""}
        ${ix ? `<p class="bl-nota">Indexación: <b>${esc(ix.estado || ix.verdict)}</b>${ix.rastreo ? ` · último rastreo ${esc(fechaCorta(ix.rastreo))}` : ""}.</p>` : ""}</div>
      <div class="bloque"><h4>Yoast ${p.yoast ? "(puesto)" : "(por pegar)"}</h4>
        ${p.yoast ? caja("Meta descripción actual", p.meta) : ""}
        ${!p.yoast && (yp.frase || yp.meta) ? caja("Frase clave", yp.frase) + caja("Título SEO", yp.titulo_seo) + caja("Meta descripción", yp.meta) : !p.yoast ? `<p class="bl-vacio">No hay texto preparado en los ficheros YOAST_LOTE*.md: escríbelo en el editor.</p>` : ""}
        ${p.estado === "borrador" && p.fecha_propuesta ? caja("Para programarlo (me lo pides y lo hago)", `py -X utf8 programar_blog.py ${p.id} ${p.fecha_propuesta}${p.slug ? " " + p.slug : ""}`) : ""}</div>
      <div class="bloque"><h4>Vídeos</h4>
        ${vids.map(v => `<a class="bl-vid" href="${esc(ytUrl(v.id))}" target="_blank" rel="noopener"><img src="${esc(ytMini(v.id))}" alt=""><span>✓ Dentro del post: ${esc(v.titulo)}${v.largo ? ((p.video_enlaza_post || {})[v.id] ? " · su descripción enlaza aquí" : " · <b class='baja'>su descripción NO enlaza aquí</b>") : " · short"}</span></a>`).join("")}
        ${tema.map(x => `<a class="bl-vid" href="${esc(ytUrl(x.id))}" target="_blank" rel="noopener"><img src="${esc(ytMini(x.id))}" alt=""><span>${x.nivel === "fuerte" ? "<b class='baja'>Falta meterlo:</b>" : x.nivel === "descripcion" ? "Su descripción enlaza aquí:" : "¿Encaja?"} ${esc(V[x.id].titulo)}${x.publico ? "" : " (aún no es público)"}${x.palabras.length ? ` · coinciden: ${esc(x.palabras.join(", "))}` : ""}</span></a>`).join("")}
        ${(p.shorts_tema || []).length ? `<p class="bl-nota">Shorts del mismo tema: ${p.shorts_tema.filter(k => V[k]).map(k => `<a href="${esc(ytUrl(k))}" target="_blank" rel="noopener">${esc(corto(V[k].titulo, 40))}</a>`).join(" · ")}</p>` : ""}
        ${!vids.length && !tema.length ? `<p class="bl-vacio">No hay ningún vídeo largo de este tema en el canal.</p>` : ""}
        <h4 style="margin-top:8px">Enlaces</h4><p class="bl-nota" style="margin:0">${fmt(p.enl_tienda)} a la tienda · ${fmt(p.enl_blog)} a otros posts${(p.enlaces_rotos || []).length ? ` · <b class="baja">${p.enlaces_rotos.length} a posts sin publicar:</b> ${p.enlaces_rotos.map(r => `${esc(corto(r.titulo, 40))} (${esc(r.estado)})`).join(", ")}` : ""}</p>
        ${p.parecido ? `<p class="bl-nota" style="margin:0"><b class="baja">Se parece a:</b> ${esc(p.parecido.titulo)} (ID ${p.parecido.id})</p>` : ""}</div>
      <div class="acciones"><a class="bl-boton fuerte" href="${esc(p.editar)}" target="_blank" rel="noopener">Editar en WordPress ↗</a><a class="bl-boton" href="${esc(p.ver)}" target="_blank" rel="noopener">${p.estado === "publicado" ? "Ver el post" : "Vista previa"} ↗</a>
        ${p.url ? `<a class="bl-boton" href="https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Atodoenrecambio.com&page=!${encodeURIComponent(p.url)}" target="_blank" rel="noopener">Search Console ↗</a>` : ""}
        <span class="bl-nota" style="margin:auto 0 auto auto">Creado ${esc(fechaAnio(p.creado))} · modificado ${esc(fechaAnio(p.modificado))}${p.lote ? ` · lote ${esc(p.lote)}` : ""}</span></div></div>`;
  }
  function lista() {
    const L = filtrados();
    $("#bl-cuenta").textContent = `${fmt(L.length)} de ${fmt(P.length)} posts`;
    const vis = L.slice(0, st.n);
    $("#bl-posts").innerHTML = (L.length ? `<div class="bl-cabpost"><span></span><span>Post</span><span>Estado</span><span>Yoast</span><span>Vídeo</span><span class="n">Google 28 d</span><span class="n">Visitas 30 d</span><span class="n">Tienda 30 d</span></div>` : "")
      + vis.map(fila).join("") + (L.length ? "" : `<p class="bl-vacio">Ningún post con estos filtros.</p>`)
      + (L.length > st.n ? `<div class="bl-pie-lista"><button class="bl-boton" data-mas-posts>Ver ${fmt(Math.min(40, L.length - st.n))} más</button><button class="bl-boton" data-todos-posts>Ver los ${fmt(L.length)}</button></div>` : "");
    enganchar($("#bl-posts"));
    const m = $("#bl-posts [data-mas-posts]"); if (m) m.onclick = () => { st.n += 40; lista(); };
    const t = $("#bl-posts [data-todos-posts]"); if (t) t.onclick = () => { st.n = 100000; lista(); };
  }
  function abrirFila(div, forzar) {
    const p = PID[div.dataset.id]; const f = div.querySelector(".fila");
    const abierto = div.classList.contains("abierto");
    if (abierto && !forzar) { div.classList.remove("abierto"); div.querySelector(".bl-detalle")?.remove(); f.setAttribute("aria-expanded", "false"); return; }
    if (!abierto) { div.classList.add("abierto"); div.insertAdjacentHTML("beforeend", detalle(p)); f.setAttribute("aria-expanded", "true"); enganchar(div.querySelector(".bl-detalle")); }
  }
  function enganchar(cont) {
    cont.querySelectorAll(".bl-post > .fila").forEach(f => {
      f.onclick = e => { if (e.target.closest("a,button")) return; abrirFila(f.parentElement); };
      f.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirFila(f.parentElement); } };
    });
    cont.querySelectorAll("[data-copiar]").forEach(b => b.onclick = e => { e.stopPropagation(); copiar(b.dataset.copiar); });
    cont.querySelectorAll("[data-abrir]").forEach(b => b.onclick = () => abrirFicha(+b.dataset.abrir));
  }
  function abrirFicha(id) {
    // busca el post sin filtros que lo oculten y lo abre
    if (!filtrados().some(p => p.id === id)) { st = { ...BASE_ST }; mandos(); }
    st.n = Math.max(st.n, filtrados().findIndex(p => p.id === id) + 1);
    lista();
    const div = $(`#bl-posts .bl-post[data-id="${id}"]`);
    if (div) { abrirFila(div, true); div.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }
  function filtrar(cadena) {
    st = { ...BASE_ST };
    cadena.split("&").forEach(x => { const [k, v] = x.split("="); st[k] = v; });
    guardar(); mandos(); lista();
    $("#blog-posts").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  let toastT = null;
  function copiar(txt, msg = "Copiado") {
    const ok = () => { let t = document.querySelector(".bl-toast"); if (!t) { t = document.createElement("div"); t.className = "bl-toast"; document.body.appendChild(t); }
      t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 1600); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, () => viejo());
    else viejo();
    function viejo() { const a = document.createElement("textarea"); a.value = txt; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); ok(); } catch (e) { /* nada */ } a.remove(); }
  }

  /* ─────────── vídeos ─────────── */
  let filtroVid = "todos";
  function videos() {
    const L = Object.values(V).filter(v => v.largo && v.estado === "public").sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const estado = v => v.en_posts.length && v.en_posts.some(id => v.desc_posts.includes(id)) ? "ok" : v.en_posts.length && !v.desc_posts.length ? "desc" : v.en_posts.length ? "parcial" : "sin";
    const nom = { ok: ["ok", "Enlazados en los dos sentidos"], parcial: ["ojo", "En el post; la descripción enlaza a otro"], desc: ["ojo", "En el post; falta el enlace en la descripción"], sin: ["mal", "No está en ningún post"] };
    const cuenta = k => L.filter(v => k === "todos" || estado(v) === k).length;
    const chips = [["todos", "Todos"], ["sin", "Sin post"], ["desc", "Falta en la descripción"], ["parcial", "Descripción a otro post"], ["ok", "Bien enlazados"]];
    const pubConVid = P.filter(p => p.estado === "publicado" && p.video_estado === "con").length;
    $("#bl-videos").innerHTML = `
      <div class="bl-cifras" style="margin-bottom:12px">
        <div class="bl-cifra"><b>${fmt(K.largos)}</b><span>vídeos largos públicos</span></div>
        <div class="bl-cifra"><b>${fmt(K.largos_en_blog)}</b><span>están dentro de algún post</span></div>
        <div class="bl-cifra"><b>${fmt(K.largos_desc_blog)}</b><span>su descripción enlaza a un post</span></div>
        <div class="bl-cifra"><b>${fmt(pubConVid)}</b><span>posts publicados con vídeo</span></div>
        <button type="button" class="bl-cifra ${K.falta_video ? "ojo" : ""}" data-filtro="video=falta"><b>${fmt(K.falta_video)}</b><span>posts a los que les falta su vídeo</span></button>
        <button type="button" class="bl-cifra" data-filtro="video=quiza"><b>${fmt(K.quiza_video || 0)}</b><span>posts con un vídeo que quizá encaja</span></button>
      </div>
      <div class="bl-grupo" style="margin-bottom:10px"><span>Ver</span>${chips.map(([k, t]) => `<button class="bl-chip" data-fv="${k}" aria-pressed="${filtroVid === k}">${t} <small>${cuenta(k)}</small></button>`).join("")}</div>
      <div class="bl-tabla-wrap"><table class="bl-tabla"><thead><tr><th>Vídeo</th><th class="n">Vistas</th><th>Dentro de los posts</th><th>La descripción enlaza a</th><th>Encaja con</th><th>Estado</th></tr></thead><tbody>
      ${L.filter(v => filtroVid === "todos" || estado(v) === filtroVid).map(v => {
        const chip = id => PID[id] ? `<a href="#" data-abrir-p="${id}" title="${esc(PID[id].titulo)}">${esc(corto(PID[id].titulo, 38))}${PID[id].estado !== "publicado" ? ` (${esc(PID[id].estado)})` : ""}</a>` : "";
        const [c, t] = nom[estado(v)];
        return `<tr><td><a class="bl-vid" href="${esc(ytUrl(v.id))}" target="_blank" rel="noopener"><img src="${esc(ytMini(v.id))}" alt="" loading="lazy"><span><b>${esc(v.titulo)}</b><br>${esc(fechaAnio(v.fecha))} · ${fmt(Math.round(v.seg / 60))} min</span></a></td>
          <td class="n">${fmt(v.vistas)}</td><td><div class="chips">${v.en_posts.map(chip).join("") || "–"}</div></td><td><div class="chips">${v.desc_posts.map(chip).join("") || "–"}</div></td>
          <td><div class="chips">${(v.posts_tema || []).filter(id => !v.en_posts.includes(id)).map(chip).join("") || "–"}</div></td><td><span class="bl-et ${c}">${t}</span></td></tr>`;
      }).join("")}</tbody></table></div>
      <p class="bl-nota">«Encaja con» sale de comparar el tema del título del vídeo con el de cada post (y del enlace de su descripción). Revísalo antes de meterlo: es una sugerencia.</p>`;
    $("#bl-videos").querySelectorAll("[data-fv]").forEach(b => b.onclick = () => { filtroVid = b.dataset.fv; videos(); });
    $("#bl-videos").querySelectorAll("[data-abrir-p]").forEach(a => a.onclick = e => { e.preventDefault(); abrirFicha(+a.dataset.abrirP); });
    $("#bl-videos").querySelectorAll("[data-filtro]").forEach(b => b.onclick = () => filtrar(b.dataset.filtro));
  }

  /* ─────────── Google ─────────── */
  let metG = "clics";
  function google() {
    const S = B.serie_gsc || [];
    const pub = P.filter(p => p.estado === "publicado");
    const top = [...pub].sort((a, b) => b.clics - a.clics).slice(0, 10);
    const conPrev = pub.filter(p => p.clics_prev >= 5 || p.clics >= 5);
    const suben = [...conPrev].sort((a, b) => (b.clics - b.clics_prev) - (a.clics - a.clics_prev)).slice(0, 8);
    const caen = [...conPrev].sort((a, b) => (a.clics - a.clics_prev) - (b.clics - b.clics_prev)).slice(0, 8);
    const tabla = (L, cab) => `<table class="bl-tabla"><thead><tr><th>${cab}</th><th class="n">Clics</th><th class="n">Antes</th><th class="n">Pos.</th></tr></thead><tbody>
      ${L.map(p => `<tr><td><a href="#" data-abrir-p="${p.id}">${esc(corto(p.titulo, 64))}</a></td><td class="n">${fmt(p.clics)}</td><td class="n">${fmt(p.clics_prev)}</td><td class="n">${fmt(p.pos, 1)}</td></tr>`).join("")}</tbody></table>`;
    const d = (a, b) => { const p = pct(a, b); return p == null ? "" : ` <i class="${clase(p)}">${signo(p, 0)} %</i>`; };
    $("#bl-google").innerHTML = `
      <div class="bl-cifras" style="margin-bottom:12px">
        <div class="bl-cifra"><b>${fmt(G.clics)}</b><span>clics en 28 días${d(G.clics, G.clics_prev)}</span></div>
        <div class="bl-cifra"><b>${fmt(G.impr)}</b><span>impresiones${d(G.impr, G.impr_prev)}</span></div>
        <div class="bl-cifra"><b>${fmt(G.ctr, 2)} %</b><span>CTR (antes ${fmt(G.ctr_prev, 2)} %)</span></div>
        <div class="bl-cifra"><b>${fmt(G.pos, 1)}</b><span>posición media (antes ${fmt(G.pos_prev, 1)})</span></div>
        <div class="bl-cifra"><b>${fmt(pub.filter(p => p.clics > 0).length)}</b><span>posts con algún clic</span></div>
        <div class="bl-cifra"><b>${fmt(pub.filter(p => !p.impr).length)}</b><span>publicados sin impresiones</span></div>
      </div>
      <div class="bl-fila-mandos" style="margin-bottom:6px"><b style="font:600 13px var(--f-titulo)">Día a día (120 días)</b>
        <div class="bl-botones">${[["clics", "Clics"], ["impr", "Impresiones"], ["pos", "Posición"]].map(([k, t]) => `<button class="bl-chip" data-mg="${k}" aria-pressed="${metG === k}">${t}</button>`).join("")}</div></div>
      <div id="bl-g-graf"></div><div class="bl-leyenda" id="bl-g-ley"></div>
      <div class="bl-tres" style="margin-top:16px"><div><h3 style="margin:0 0 6px;font:600 15px var(--f-titulo)">Los 10 con más clics</h3>${tabla(top, "Post")}</div>
        <div><h3 style="margin:0 0 6px;font:600 15px var(--f-titulo)">Los que más suben <small class="bl-nota">frente a los 28 días anteriores</small></h3>${tabla(suben, "Post")}</div>
        <div><h3 style="margin:0 0 6px;font:600 15px var(--f-titulo)">Los que más caen</h3>${tabla(caen, "Post")}</div></div>`;
    const fechas = S.map(x => x[0]);
    const col = getComputedStyle(raiz).getPropertyValue("--marca").trim() || "#d71119";
    if (metG === "clics") { const v = S.map(x => x[1]); grafica($("#bl-g-graf"), { fechas, series: [{ n: "Clics", c: col, v, tipo: "barra" }, { n: "Media de 7 días", c: "var(--tinta)", v: media7(v) }] }); }
    else if (metG === "impr") { const v = S.map(x => x[2]); grafica($("#bl-g-graf"), { fechas, series: [{ n: "Impresiones", c: "#6c8fd6", v, tipo: "barra" }, { n: "Media de 7 días", c: "var(--tinta)", v: media7(v) }] }); }
    else grafica($("#bl-g-graf"), { fechas, series: [{ n: "Posición media", c: col, v: S.map(x => x[3]) }], invertir: true, fy: v => fmt(v, 1) });
    $("#bl-g-ley").innerHTML = metG === "pos" ? "<span>Más arriba = mejor posición.</span>" : "<span><i style='background:var(--tinta)'></i>Media de 7 días</span><span>Search Console tarda unos 2 días en tener el dato completo.</span>";
    $("#bl-google").querySelectorAll("[data-mg]").forEach(b => b.onclick = () => { metG = b.dataset.mg; google(); });
    $("#bl-google").querySelectorAll("[data-abrir-p]").forEach(a => a.onclick = e => { e.preventDefault(); abrirFicha(+a.dataset.abrirP); });
  }

  /* ─────────── oportunidades ─────────── */
  function oportunidades() {
    const O = B.oportunidades || [], Q = B.busquedas || [], C = B.canibal || [];
    const curva = Object.entries(B.curva_ctr || {}).map(([k, v]) => `${k}: ${fmt(v, 2)} %`).join(" · ");
    $("#bl-oport").innerHTML = `
      <h3 style="margin:4px 0 6px;font:600 15px var(--f-titulo)">Posts que pierden clics <small class="bl-nota">${fmt(O.length)} posts · CTR por debajo del 70 % del normal del blog para su posición</small></h3>
      <div class="bl-tabla-wrap"><table class="bl-tabla"><thead><tr><th>Post</th><th class="n">Impr.</th><th class="n">Clics</th><th class="n">CTR</th><th class="n">Normal</th><th class="n">Pos.</th><th class="n">Clics que pierde</th><th>Búsquedas que lo traen</th><th>Meta actual</th><th></th></tr></thead><tbody>
      ${O.map(o => `<tr><td class="tit"><a href="#" data-abrir-p="${o.id}">${esc(o.titulo)}</a></td><td class="n">${fmt(o.i)}</td><td class="n">${fmt(o.c)}</td><td class="n">${fmt(o.ctr, 2)} %</td>
        <td class="n">${fmt(o.ctr_normal, 2)} %</td><td class="n">${fmt(o.pos, 1)}</td><td class="n"><b>~${fmt(o.ganar)}</b></td>
        <td><div class="chips">${(o.consultas || []).map(c => `<span title="${fmt(c.i)} impresiones · posición ${fmt(c.pos, 1)}">${esc(c.q)}</span>`).join("")}</div></td>
        <td style="max-width:280px;font-size:12px">${o.yoast ? esc(corto(o.meta, 150)) : `<span class="bl-et mal">sin meta</span>`}</td>
        <td><a class="bl-boton mini" href="${esc((PID[o.id] || {}).editar || "#")}" target="_blank" rel="noopener">Editar ↗</a></td></tr>`).join("") || `<tr><td colspan="10" class="bl-vacio">Ninguno ahora mismo.</td></tr>`}</tbody></table></div>
      <p class="bl-nota">CTR normal del blog por posición (sus propios posts con ≥ 300 impresiones, como en el informe del lunes): ${esc(curva)}. Qué tocar: el título SEO y la meta de Yoast, para que respondan justo a esas búsquedas.</p>
      <div class="bl-dos" style="margin-top:16px">
        <div><h3 style="margin:0 0 6px;font:600 15px var(--f-titulo)">Búsquedas grandes en las posiciones 4-15</h3>
          <div class="bl-tabla-wrap"><table class="bl-tabla"><thead><tr><th>Búsqueda</th><th>Post</th><th class="n">Impr.</th><th class="n">Clics</th><th class="n">Pos.</th></tr></thead><tbody>
          ${Q.slice(0, 25).map(q => `<tr><td class="tit">${esc(q.q)}</td><td>${q.id ? `<a href="#" data-abrir-p="${q.id}">${esc(corto(q.titulo, 46))}</a>` : esc(q.ruta)}</td><td class="n">${fmt(q.i)}</td><td class="n">${fmt(q.c)}</td><td class="n">${fmt(q.pos, 1)}</td></tr>`).join("")}</tbody></table></div></div>
        <div><h3 style="margin:0 0 6px;font:600 15px var(--f-titulo)">Canibalizaciones <small class="bl-nota">dos posts se reparten la misma búsqueda</small></h3>
          ${C.length ? C.slice(0, 14).map(c => `<div style="border-bottom:1px solid var(--linea);padding:6px 0"><b>${esc(c.q)}</b> <span class="bl-nota">${fmt(c.i)} impresiones · ${fmt(c.c)} clics</span>
            <div class="chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${c.paginas.map(x => x.id ? `<a class="bl-boton mini" href="#" data-abrir-p="${x.id}">${esc(corto(x.titulo, 40))} · ${fmt(x.i)} impr. · pos. ${fmt(x.pos, 1)}</a>` : `<span class="bl-et gris">${esc(corto(x.ruta, 40))}</span>`).join("")}</div></div>`).join("") : `<p class="bl-vacio">Ninguna.</p>`}</div></div>`;
    $("#bl-oport").querySelectorAll("[data-abrir-p]").forEach(a => a.onclick = e => { e.preventDefault(); abrirFicha(+a.dataset.abrirP); });
  }

  /* ─────────── visitas (Analytics) ─────────── */
  function visitas() {
    const S = B.serie_ga || [];
    const barras = (L, total, col) => `<div class="bl-barras">${L.map(([n, s, r]) => `<div class="bl-barra"><span>${esc(n)}</span><span class="pista"><i style="width:${total ? r / total * 100 : 0}%;background:${col}"></i><i style="width:${total ? (s - r) / total * 100 : 0}%;background:${col};opacity:.3"></i></span><span class="n">${fmt(r)} <small class="bl-nota">/ ${fmt(s)}</small></span></div>`).join("")}</div>`;
    const tot = (A.paises || []).reduce((a, x) => a + x[1], 0);
    const NOMC = { "Organic Search": "Google y buscadores", "Direct": "Directo", "Referral": "Otras webs", "AI Assistant": "Asistentes de IA", "Organic Social": "Redes sociales", "Organic Video": "Vídeo (YouTube)", "Unassigned": "Sin asignar", "Paid Search": "Anuncios", "Paid Shopping": "Shopping" };
    const d = (a, b) => { const p = pct(a, b); return p == null ? "" : ` <i class="${clase(p)}">${signo(p, 0)} %</i>`; };
    const es = (A.paises || []).find(x => x[0] === "España") || [0, 0, 0];
    $("#bl-visitas").innerHTML = `
      <div class="bl-cifras" style="margin-bottom:12px">
        <div class="bl-cifra"><b>${fmt(A.reales)}</b><span>visitas reales en 30 días${d(A.reales, A.reales_prev)}</span></div>
        <div class="bl-cifra"><b>${fmt(A.sesiones)}</b><span>visitas en total (con rebotes y bots)</span></div>
        <div class="bl-cifra"><b>${fmt(A.sesiones ? A.reales / A.sesiones * 100 : 0)} %</b><span>son reales</span></div>
        <div class="bl-cifra"><b>${fmt(tot ? es[1] / tot * 100 : 0)} %</b><span>vienen de España</span></div>
        <div class="bl-cifra"><b>${fmt(A.es_reales)}</b><span>reales de España${d(A.es_reales, A.es_reales_prev)}</span></div>
        <div class="bl-cifra"><b>${fmt(A.seg_medio)} s</b><span>de lectura media (visitas reales)</span></div>
      </div>
      <b style="font:600 13px var(--f-titulo)">Día a día (120 días)</b><div id="bl-v-graf"></div>
      <div class="bl-leyenda"><span><i style="background:#9aa3ad"></i>Todas las visitas</span><span><i style="background:var(--tinta)"></i>Reales</span><span><i style="background:var(--marca)"></i>Reales de España</span><span><i style="background:#d99a1e"></i>Latinoamérica (todas)</span><span>Líneas: media de 7 días. ▲ = pico recortado (valor real encima).</span></div>
      <div class="bl-dos" style="margin-top:16px">
        <div><h3 style="margin:0 0 8px;font:600 15px var(--f-titulo)">De dónde son <small class="bl-nota">reales / todas</small></h3>${barras(A.paises || [], tot, "var(--marca)")}
          <p class="bl-nota">TodoEnRecambio vende en España: Latinoamérica lee pero no puede comprar. Las visitas de 0 segundos (bots) se quedan en «todas».</p></div>
        <div><h3 style="margin:0 0 8px;font:600 15px var(--f-titulo)">Por dónde llegan <small class="bl-nota">reales / todas</small></h3>${barras((A.canales || []).map(([n, s, r]) => [NOMC[n] || n, s, r]), tot, "#6c8fd6")}</div></div>`;
    const fechas = S.map(x => x[0]);
    grafica($("#bl-v-graf"), { fechas, series: [{ n: "Todas las visitas", c: "#9aa3ad", v: S.map(x => x[1]), tipo: "barra", op: .35 }, { n: "Reales", c: "var(--tinta)", v: media7(S.map(x => x[2])) },
      { n: "Reales de España", c: getComputedStyle(raiz).getPropertyValue("--marca").trim() || "#d71119", v: media7(S.map(x => x[4])) }, { n: "Latinoamérica", c: "#d99a1e", v: media7(S.map(x => x[5])), guion: true }], recortar: true });
  }

  /* ─────────── tienda ─────────── */
  function tienda() {
    const L = P.filter(p => p.a_tienda || p.carrito_desde || p.carrito || p.compras).sort((a, b) => b.a_tienda - a.a_tienda).slice(0, 25);
    $("#bl-tienda").innerHTML = `
      <div class="bl-cifras" style="margin-bottom:12px">
        <div class="bl-cifra"><b>${fmt(T.a_tienda)}</b><span>páginas de la tienda vistas desde un post (30 d)</span></div>
        <div class="bl-cifra"><b>${fmt(T.carrito_desde)}</b><span>productos añadidos al carrito en esas páginas</span></div>
        <div class="bl-cifra ${T.compras ? "" : "ojo"}"><b>${fmt(T.compras)}</b><span>compras de visitas que entraron por el blog</span></div>
        <div class="bl-cifra"><b>${fmt(T.ingresos, 2)} €</b><span>ingresos de esas compras</span></div>
        <div class="bl-cifra"><b>${fmt(P.filter(p => p.a_tienda).length)}</b><span>posts que mandan gente a la tienda</span></div>
      </div>
      <div class="bl-tabla-wrap"><table class="bl-tabla"><thead><tr><th>Post</th><th class="n">Visitas reales</th><th class="n">A la tienda</th><th class="n">Al carrito</th><th class="n">Compras</th><th class="n">Enlaces a la tienda</th></tr></thead><tbody>
      ${L.map(p => `<tr><td class="tit"><a href="#" data-abrir-p="${p.id}">${esc(p.titulo)}</a></td><td class="n">${fmt(p.reales)}</td><td class="n">${fmt(p.a_tienda)}</td><td class="n">${fmt(p.carrito_desde)}</td><td class="n">${fmt(p.compras)}</td><td class="n">${fmt(p.enl_tienda)}</td></tr>`).join("") || `<tr><td colspan="6" class="bl-vacio">Ningún post manda visitas a la tienda.</td></tr>`}</tbody></table></div>
      <p class="bl-nota">«A la tienda»: páginas que no son del blog vistas justo después de un post (Analytics, página de procedencia). «Compras»: visitas que entraron por un post y compraron en esa misma visita.</p>`;
    $("#bl-tienda").querySelectorAll("[data-abrir-p]").forEach(a => a.onclick = e => { e.preventDefault(); abrirFicha(+a.dataset.abrirP); });
  }

  /* ─────────── IA ─────────── */
  function ia() {
    const F = IA.fuentes || [];
    const tot = F.reduce((a, x) => a + x[1], 0);
    const L = (IA.paginas || []).slice(0, 20);
    $("#bl-ia").innerHTML = `
      <div class="bl-cifras" style="margin-bottom:12px">
        <div class="bl-cifra"><b>${fmt(IA.total)}</b><span>visitas a la web desde asistentes de IA</span></div>
        <div class="bl-cifra"><b>${fmt(IA.blog)}</b><span>de ellas, al blog</span></div>
        <div class="bl-cifra"><b>${fmt(F.reduce((a, x) => a + x[3], 0))}</b><span>productos añadidos al carrito</span></div>
        <div class="bl-cifra"><b>${fmt(F.reduce((a, x) => a + x[4], 0))}</b><span>compras</span></div>
        <div class="bl-cifra"><b>${fmt(F.reduce((a, x) => a + (x[5] || 0), 0), 2)} €</b><span>ingresos de esas compras</span></div>
      </div>
      <div class="bl-dos"><div><h3 style="margin:0 0 8px;font:600 15px var(--f-titulo)">Qué asistente <small class="bl-nota">reales / todas</small></h3>
        <div class="bl-barras">${F.map(([n, s, r, c, t, e]) => `<div class="bl-barra" title="${fmt(c)} al carrito · ${fmt(t)} compras · ${fmt(e || 0, 2)} €"><span>${esc(n)}</span><span class="pista"><i style="width:${tot ? r / tot * 100 : 0}%;background:#10a37f"></i><i style="width:${tot ? (s - r) / tot * 100 : 0}%;background:#10a37f;opacity:.3"></i></span><span class="n">${fmt(r)} <small class="bl-nota">/ ${fmt(s)}</small></span></div>`).join("")}</div>
        <p class="bl-nota">ChatGPT añade «utm_source=chatgpt.com» a sus enlaces: son personas que han preguntado a la IA y han pinchado en la web.</p></div>
        <div><h3 style="margin:0 0 8px;font:600 15px var(--f-titulo)">A qué páginas llegan</h3><table class="bl-tabla"><thead><tr><th>Página</th><th class="n">Visitas</th></tr></thead><tbody>
          ${L.map(x => `<tr><td>${x.id ? `<a href="#" data-abrir-p="${x.id}">${esc(corto(x.titulo, 60))}</a>` : `<a href="https://todoenrecambio.com${esc(x.ruta)}" target="_blank" rel="noopener">${esc(corto(x.ruta, 60))}</a>`}</td><td class="n">${fmt(x.s)}</td></tr>`).join("")}</tbody></table></div></div>`;
    $("#bl-ia").querySelectorAll("[data-abrir-p]").forEach(a => a.onclick = e => { e.preventDefault(); abrirFicha(+a.dataset.abrirP); });
  }

  /* ─────────── CSV ─────────── */
  function csv() {
    const cols = [["id", "ID"], ["titulo", "Título"], ["estado", "Estado"], ["fecha", "Fecha"], ["fecha_propuesta", "Fecha propuesta"], ["vertical", "Tipo"], ["yoast", "Yoast"],
      ["video_estado", "Vídeo"], ["palabras", "Palabras"], ["clics", "Clics 28 d"], ["impr", "Impresiones 28 d"], ["ctr", "CTR %"], ["pos", "Posición"], ["ganar", "Clics que pierde"],
      ["reales", "Visitas reales 30 d"], ["es_reales", "Reales España"], ["a_tienda", "A la tienda"], ["carrito_desde", "Al carrito"], ["compras", "Compras"], ["url", "URL"], ["editar", "Editar"]];
    const v = x => x === true ? "sí" : x === false ? "no" : x == null ? "" : typeof x === "number" ? String(x).replace(".", ",") : `"${String(x).replace(/"/g, '""')}"`;
    const txt = "﻿" + cols.map(c => c[1]).join(";") + "\n" + filtrados().map(p => cols.map(([k]) => v(p[k])).join(";")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    a.download = `blog-tdr-${HOY}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function irA(id) {
    const el = id && raiz.querySelector("#" + CSS.escape(id));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function todo() { cifras(); tareasHtml(); cola(); mandos(); lista(); videos(); google(); oportunidades(); visitas(); tienda(); ia(); }
  const sec = deHash(opciones.seccion || location.hash);
  todo();
  enganchar(raiz.querySelector("#bl-tareas")); enganchar(raiz.querySelector("#bl-cola"));
  $("[data-csv]").onclick = csv;
  raiz.querySelectorAll(".bl-indice a").forEach(a => a.onclick = e => { e.preventDefault(); history.replaceState(null, "", location.search + "#" + a.dataset.ir); irA(a.dataset.ir); });
  if (sec && sec !== "blog") setTimeout(() => irA(sec), 60);

  return {
    actualizarTema() { google(); visitas(); },
    irA(h) { const s = deHash(h); if (/[&]/.test(h)) { mandos(); lista(); } irA(s); },
    destruir() { raiz.remove(); },
  };
}
