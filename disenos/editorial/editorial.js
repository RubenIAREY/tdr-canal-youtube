/* Informe de redes de TDR · versión «Editorial»: un informe que se lee de arriba abajo.
   Datos: ../../datos_redes.json, que rehace PANEL-REDES/construir_panel.py a las 9:00 y a las 17:00.
   La lógica de los datos viene de ../../panel.js (medias de 7 y 30 días, velas, recortarCola, rangos, comparativa en %,
   tendencia), adaptada: los días sin dato no se pintan ni cuentan como cero. Las velas por periodo usan el código de
   referencia del encargo tal cual. Gráficas: TradingView Lightweight Charts 4.2.3. */
"use strict";
window.__informeEditorial = true;

(function () {
  const LC = window.LightweightCharts || null;
  const RAIZ = document.documentElement;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const movReducido = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ─────────────── formato ─────────────── */
  const REDES = ["youtube", "instagram", "tiktok", "facebook"];
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const NB = " ", MENOS = "−";
  const fmt = (n, d = 0) => n == null || isNaN(n) ? "–" :
    Number(n).toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" }).replace("-", MENOS);
  const signo = (n, d = 0) => n == null || isNaN(n) ? "–" : (n > 0 ? "+" : "") + fmt(n, d);
  const pctTxt = (n, d = 1) => n == null || isNaN(n) ? "–" : signo(n, d) + NB + "%";
  const cls = n => n == null || isNaN(n) || n === 0 ? "igual" : n > 0 ? "sube" : "baja";
  const flecha = n => n == null || isNaN(n) || n === 0 ? "" : (n > 0 ? "▲" : "▼") + NB;
  const fecha = s => { if (!s) return "–"; const [y, m, d] = String(s).slice(0, 10).split("-"); return `${+d}${NB}${MES[+m - 1]}${NB}${y}`; };
  const pct = (a, b) => a == null || b == null || !b ? null : (a - b) / b * 100;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iso = d => d.toISOString().slice(0, 10);
  const diaMas = (s, n) => iso(new Date(Date.parse(String(s).slice(0, 10) + "T00:00:00Z") + n * 864e5));
  const tTxt = t => typeof t === "string" ? t : typeof t === "number" ? iso(new Date(t * 1000))
    : t && t.year ? `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}` : "";
  const cifra = (txt, c) => `<span class="cifra${c ? " " + c : ""}">${txt}</span>`;
  const plural = (n, uno, varios) => n === 1 ? uno : varios;
  const lista = a => a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + (/^h?[iI]/.test(a[a.length - 1]) ? " e " : " y ") + a[a.length - 1];
  const urlSegura = u => /^https?:\/\//i.test(u || "") ? u : null;

  /* ─────────────── ajustes ─────────────── */
  const CLAVE = "tdr-panel-editorial";
  const AJUSTES = [
    { k: "paleta", etq: "Paleta", def: "papel", muestras: true, ops: [
      { v: "papel", t: "Papel técnico", m: ["#fbfbfc", "#111317"] },
      { v: "imprenta", t: "Imprenta", m: ["#ffffff", "#000000"] },
      { v: "plano", t: "Plano (oscuro)", m: ["#121a24", "#e8eef5"] }] },
    { k: "letra", etq: "Letra", def: "archivo", vertical: true, ops: [
      { v: "archivo", t: "Archivo + Source Serif" }, { v: "barlow", t: "Barlow + Newsreader" }, { v: "geist", t: "Archivo + Geist" }] },
    { k: "densidad", etq: "Densidad", def: "normal", ops: [{ v: "compacta", t: "Compacta" }, { v: "normal", t: "Normal" }, { v: "amplia", t: "Amplia" }] },
    { k: "portada", etq: "Portada", def: "frase", par: true, ops: [{ v: "frase", t: "Frase" }, { v: "cifras", t: "Cifras" }] },
    { k: "ancho", etq: "Ancho de lectura", def: "estrecho", par: true, ops: [{ v: "estrecho", t: "Estrecho" }, { v: "ancho", t: "Ancho" }] },
    { k: "notas", etq: "Notas de las gráficas", def: "si", ops: [{ v: "si", t: "Visibles" }, { v: "no", t: "Ocultas" }] },
  ];
  const FUENTES = {
    barlow: "https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700;800;900&family=Barlow+Condensed:wght@600;700;800;900&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap",
    geist: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap",
  };
  const A = {};
  AJUSTES.forEach(a => { const v = RAIZ.dataset[a.k]; A[a.k] = a.ops.some(o => o.v === v) ? v : a.def; RAIZ.dataset[a.k] = A[a.k]; });

  function cargarFuentes(letra) {
    const url = FUENTES[letra];
    if (!url) return Promise.resolve();
    let l = document.querySelector(`link[data-fuente="${letra}"]`);
    if (!l) { l = document.createElement("link"); l.rel = "stylesheet"; l.href = url; l.dataset.fuente = letra; document.head.appendChild(l); }
    return new Promise(res => {
      if (l.sheet) { res(); return; }
      l.addEventListener("load", res, { once: true }); l.addEventListener("error", res, { once: true }); setTimeout(res, 2500);
    });
  }
  function fuentesListas() {      // el lienzo de las gráficas usa la letra que haya cargada al pintar
    const fam = getComputedStyle(RAIZ).getPropertyValue("--f-tit").split(",")[0].trim();
    const espera = document.fonts && fam
      ? Promise.all([document.fonts.load(`500 12px ${fam}`), document.fonts.load(`700 16px ${fam}`)]).catch(() => {}) : Promise.resolve();
    return Promise.race([espera, new Promise(r => setTimeout(r, 1500))]);
  }
  function guardarAjustes() {
    try { localStorage.setItem(CLAVE, JSON.stringify(A)); } catch (e) { /* sin almacenamiento: la URL basta */ }
    const q = new URLSearchParams(location.search);
    AJUSTES.forEach(a => q.set(a.k, A[a.k]));
    try { history.replaceState(null, "", location.pathname + "?" + q.toString() + location.hash); } catch (e) { /* nada */ }
  }
  function marcarAjustes() { $$("#aj-controles button").forEach(b => b.setAttribute("aria-pressed", String(A[b.dataset.aj] === b.dataset.v))); }
  function ponerAjuste(k, v) {
    if (A[k] === v) return;
    A[k] = v; RAIZ.dataset[k] = v;
    guardarAjustes(); marcarAjustes(); aviso("Guardado: el enlace de la página ya lleva esta combinación.");
    if (k === "paleta") repintarGraficas();
    else if (k === "letra") { repintarGraficas(); cargarFuentes(v).then(fuentesListas).then(repintarGraficas); }
  }
  function aviso(t) { const a = $("#aj-aviso"); if (a) a.textContent = t; }

  function montarAjustes() {
    const grupoHTML = a => `<div class="aj-grupo"><span class="aj-etq" id="aj-e-${a.k}">${a.etq}</span>
      <div class="aj-seg${a.vertical ? " vertical" : ""}${a.muestras ? " muestras" : ""}" role="group" aria-labelledby="aj-e-${a.k}">${a.ops.map(o =>
        `<button type="button" data-aj="${a.k}" data-v="${o.v}" aria-pressed="false">${o.m ? `<i class="muestra" style="--m1:${o.m[0]};--m2:${o.m[1]}" aria-hidden="true"></i>` : ""}<span>${o.t}</span></button>`).join("")}</div></div>`;
    let html = "";
    for (let i = 0; i < AJUSTES.length; i++) {          // los ajustes de dos opciones que van juntos se ponen lado a lado
      const a = AJUSTES[i], b = AJUSTES[i + 1];
      if (a.par && b && b.par) { html += `<div class="aj-par">${grupoHTML(a)}${grupoHTML(b)}</div>`; i++; }
      else html += grupoHTML(a);
    }
    $("#aj-controles").innerHTML = html;
    $$("#aj-controles button").forEach(b => b.addEventListener("click", () => ponerAjuste(b.dataset.aj, b.dataset.v)));
    marcarAjustes();

    const btn = $("#btn-ajustes"), panel = $("#ajustes"), velo = $("#velo");
    let abierto = false;
    const abrir = () => {
      abierto = true; panel.removeAttribute("inert"); panel.classList.add("abierto"); velo.classList.add("abierto");
      btn.setAttribute("aria-expanded", "true");
      setTimeout(() => $("#aj-cerrar").focus({ preventScroll: true }), 30);
    };
    const cerrar = (foco = true) => {
      if (!abierto) return;
      abierto = false; panel.classList.remove("abierto"); velo.classList.remove("abierto"); panel.setAttribute("inert", "");
      btn.setAttribute("aria-expanded", "false");
      if (foco) btn.focus({ preventScroll: true });
    };
    btn.addEventListener("click", () => abierto ? cerrar() : abrir());
    $("#aj-cerrar").addEventListener("click", () => cerrar());
    velo.addEventListener("click", () => cerrar(false));
    document.addEventListener("pointerdown", e => { if (abierto && !panel.contains(e.target) && !btn.contains(e.target)) cerrar(false); });
    document.addEventListener("keydown", e => {
      if (!abierto) return;
      if (e.key === "Escape") { e.preventDefault(); cerrar(); return; }
      if (e.key !== "Tab") return;
      const f = $$("button, input, a[href]", panel).filter(x => !x.hidden && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });

    $("#aj-copiar").addEventListener("click", () => {
      guardarAjustes();
      const url = location.href, campo = $("#aj-url");
      const hecho = () => { campo.hidden = true; aviso("Enlace copiado."); };
      const aMano = () => { campo.hidden = false; campo.value = url; campo.focus(); campo.select(); aviso("No se ha podido copiar solo: el enlace está seleccionado, cópialo con Ctrl+C."); };
      const antiguo = () => {
        try {
          const t = document.createElement("textarea"); t.value = url; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
          document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); ok ? hecho() : aMano();
        } catch (e) { aMano(); }
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(hecho, antiguo); else antiguo();
    });
    $("#aj-reset").addEventListener("click", () => {
      const antes = Object.assign({}, A);
      AJUSTES.forEach(a => { A[a.k] = a.def; RAIZ.dataset[a.k] = a.def; });
      try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
      const q = new URLSearchParams(location.search); AJUSTES.forEach(a => q.delete(a.k));
      const qs = q.toString();
      try { history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch (e) { /* nada */ }
      marcarAjustes(); $("#aj-url").hidden = true; aviso("Ajustes restablecidos.");
      if (antes.paleta !== A.paleta || antes.letra !== A.letra) fuentesListas().then(repintarGraficas);
    });
  }

  /* ─────────────── datos (lógica de panel.js) ─────────────── */
  let D = null;
  const resumen = k => k === "global" ? D.global_ : D.redes[k].resumen;
  const nombreRed = k => k === "global" ? "Global" : D.redes[k].nombre;
  function serieDe(k) {
    if (k === "global") return D.global_serie.map(x => ({ t: x[0], seg: x[1], vis: x[2], likes: x[3] }));
    return D.series[k].map(x => ({ t: x[0], seg: x[1], vis: x[2], gan: x[3], per: x[4], likes: x[5] }));
  }
  function recortarCola(s, campo) {                     // quita los últimos días sin dato (las redes van con 1-3 días de retraso)
    let i = s.length; while (i > 0 && (s[i - 1][campo] == null)) i--; return s.slice(0, i);
  }
  function diarios(k, campo) {                          // días con dato desde que se mide, en orden, sin la cola vacía
    const R = resumen(k), desde = campo === "likes" ? R.desde_lk : (R.desde_vis || "0");
    if (!desde) return [];
    return recortarCola(serieDe(k).filter(x => x.t >= desde), campo).filter(x => x[campo] != null).map(x => ({ t: x.t, v: x[campo] }));
  }
  function medias(vals, n) {                            // media de los últimos n días con dato
    const out = [], q = []; let suma = 0;
    vals.forEach(v => { q.push(v); suma += v; if (q.length > n) suma -= q.shift(); out.push(suma / q.length); });
    return out;
  }
  function lunes(t) { const d = new Date(t + "T00:00:00Z"); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); }

  /* velas por periodo: código de referencia del encargo, tal cual */
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
  const etiquetaPeriodo = (t, periodo) => periodo === "mes" ? `${MES[+t.slice(5, 7) - 1]}${NB}${t.slice(0, 4)}`
    : periodo === "semana" ? `semana del ${fecha(t)}` : fecha(t);

  const puntosSeg = k => serieDe(k).filter(x => x.seg != null).map(x => ({ time: x.t, value: x.seg }));
  function puntosAcum(k) { let a = 0; return diarios(k, "vis").map(x => ({ time: x.t, value: (a += x.v) })); }

  function tendencia(k) {                               // media de 30 días hoy frente a la de hace 30 días
    const m = medias(diarios(k, "vis").map(x => x.v), 30);
    if (m.length <= 60) return null;
    const hoy = m[m.length - 1], antes = m[m.length - 31], c = pct(hoy, antes);
    return { hoy, antes, c, et: c == null ? "–" : c > 3 ? "Creciendo" : c < -3 ? "Bajando" : "Estable",
             cl: c == null ? "" : c > 3 ? "sube" : c < -3 ? "baja" : "igual" };
  }
  function ganPer(k) {
    if (k === "global") return null;
    const desde = diaMas(D.actualizado, -30), ult = serieDe(k).filter(x => x.t > desde);
    if (!ult.some(x => x.gan != null)) return null;
    return { gan: ult.reduce((a, x) => a + (x.gan || 0), 0), per: ult.reduce((a, x) => a + (x.per || 0), 0) };
  }

  /* ─────────────── frases generadas con los datos ─────────────── */
  // «un 77 % más que…», «un 12 % menos que…», «lo mismo que…»; con menos de 50 en el periodo anterior se da esa cifra en vez del %.
  function cambioTxt(actual, prev, c, cola) {
    const tras = cola ? " " + cola : "";
    if (prev != null && prev < 50 && actual != null) {
      if (actual === prev) return `lo mismo${tras}`;
      return `frente a ${cifra(fmt(prev))} en los 30 días anteriores`;
    }
    if (c == null || isNaN(c)) return "";
    const a = Math.abs(c);
    if (a < 0.05) return `lo mismo${tras}`;
    return `un ${cifra(fmt(a, a >= 10 ? 0 : 1) + NB + "%", c > 0 ? "sube" : "baja")} ${c > 0 ? "más" : "menos"}${tras}`;
  }
  const difSeg = d => d == null ? "" : d > 0 ? `${cifra(fmt(d), "sube")} más que hace 30 días`
    : d < 0 ? `${cifra(fmt(-d), "baja")} menos que hace 30 días` : "los mismos que hace 30 días";

  function tesis() {
    const G = D.global_;
    if (G.vis_30 != null) {
      const c = cambioTxt(G.vis_30, G.vis_prev_30, G.vis_cambio_30, "que en los 30 días anteriores");
      return `En los últimos 30 días, lo publicado por TDR en redes se ha visto ${cifra(fmt(G.vis_30))} ${plural(G.vis_30, "vez", "veces")}${c ? ", " + c : ""}.`;
    }
    if (G.seguidores != null) return `TDR suma ${cifra(fmt(G.seguidores))} seguidores entre YouTube, Instagram, TikTok y Facebook${G.d30 != null ? ", " + difSeg(G.d30) : ""}.`;
    return "Todavía no hay datos suficientes para escribir el resumen.";
  }
  function entradilla() {
    const G = D.global_, t = tendencia("global"), p = [];
    if (G.seguidores != null) p.push(`Entre YouTube, Instagram, TikTok y Facebook, TDR suma ${cifra(fmt(G.seguidores))} seguidores${G.d30 != null ? ": " + difSeg(G.d30) : ""}.`);
    if (G.lk_30 != null) {
      const c = G.lk_cambio_30, v = G.vis_cambio_30, base = G.lk_prev_30 != null && G.lk_prev_30 >= 50;
      if (c != null && Math.abs(c) >= 0.05 && base) {
        const sube = c > 0, vaIgual = v != null && Math.abs(v) >= 0.05 && (v > 0) === sube;
        p.push(`Los me gusta${vaIgual ? " también" : v != null ? ", en cambio," : ""} ${sube ? "suben" : "bajan"}: ${cifra(fmt(G.lk_30))} en 30 días, ${cambioTxt(G.lk_30, G.lk_prev_30, c, "")}.`);
      } else {
        const cmp = cambioTxt(G.lk_30, G.lk_prev_30, c, "que en los 30 días anteriores");
        p.push(`En 30 días ha recibido ${cifra(fmt(G.lk_30))} me gusta${cmp ? ", " + cmp : ""}.`);
      }
    }
    if (t) p.push(`La media diaria de visualizaciones está en ${cifra(fmt(t.hoy))}; hace un mes estaba en ${cifra(fmt(t.antes))}. Tendencia: ${t.et.toLowerCase()}.`);
    return p.join(" ");
  }
  function titularRed(k) {
    const R = resumen(k), n = esc(D.redes[k].nombre);
    if (R.seguidores == null) return `${n}: sin datos de seguidores`;
    return `${n}: ${cifra(fmt(R.seguidores))} ${plural(R.seguidores, "seguidor", "seguidores")}${R.d30 != null ? ", " + difSeg(R.d30) : ""}`;
  }
  function deckRed(k) {
    const R = resumen(k), partes = [];
    if (R.vis_30 != null) {
      const c = cambioTxt(R.vis_30, R.vis_prev_30, R.vis_cambio_30, "que en los 30 anteriores");
      partes.push(`${cifra(fmt(R.vis_30))} ${plural(R.vis_30, "visualización", "visualizaciones")}${c ? ", " + c : ""}`);
    }
    if (R.lk_30 != null) {
      if (R.lk_30 === 0) partes.push("ningún me gusta");
      else { const c = cambioTxt(R.lk_30, R.lk_prev_30, R.lk_cambio_30, ""); partes.push(`${cifra(fmt(R.lk_30))} me gusta${c ? ", " + c : ""}`); }
    }
    return partes.length ? `En 30 días: ${partes.join(", y ")}.` : "Sin datos de los últimos 30 días.";
  }

  /* ─────────────── arranque ─────────────── */
  montarAjustes();
  revelado();
  pegado();
  fetch("../../datos_redes.json?" + Date.now())
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(d => { D = d; arrancar(); })
    .catch(e => {
      $("#tesis").textContent = "No se han podido cargar los datos.";
      $("#entradilla").textContent = `Prueba a recargar la página dentro de un momento (${e.message || e}).`;
    });

  function arrancar() {
    const ed = D.actualizado ? `${fecha(D.actualizado)}, ${D.actualizado.slice(11, 16)}` : "–";
    $("#edicion").textContent = ed; $("#edicion-pie").textContent = ed;
    portada(); frescura(); tira();
    $("#ficha-global").innerHTML = ficha("global", "h3");
    montarTendencia(); montarComparativa(); redes(); tienda(); montarVideos();
    indiceActivo();
    fuentesListas().then(repintarGraficas);
  }

  /* ─────────────── portada ─────────────── */
  function portada() {
    const G = D.global_;
    const ante = G.fecha_vis ? `Resumen · 30 días hasta el ${fecha(G.fecha_vis)}` : "Resumen";
    $("#ante-resumen").textContent = ante;
    $("#tesis").innerHTML = tesis();
    $("#entradilla").innerHTML = entradilla();
    const t = tendencia("global");
    const item = (e, n, d, c) => `<div><dt>${e}</dt><dd class="n">${n}</dd><dd class="d ${c || ""}">${d}</dd></div>`;
    $("#portada-cifras").innerHTML = `<p class="antetitulo">${ante}</p>
      <h1 class="cifras-tit">TDR en redes: los últimos 30 días, en cuatro cifras</h1>
      <dl class="cifras">
        ${item("Visualizaciones en 30 días", fmt(G.vis_30), G.vis_cambio_30 == null ? "sin comparación" : `${flecha(G.vis_cambio_30)}${pctTxt(G.vis_cambio_30)} frente a los 30 anteriores`, cls(G.vis_cambio_30))}
        ${item("Seguidores en las cuatro redes", fmt(G.seguidores), G.d30 == null ? "–" : `${flecha(G.d30)}${signo(G.d30)} en 30 días`, cls(G.d30))}
        ${item("Me gusta en 30 días", fmt(G.lk_30), G.lk_cambio_30 == null ? "sin comparación" : `${flecha(G.lk_cambio_30)}${pctTxt(G.lk_cambio_30)} frente a los 30 anteriores`, cls(G.lk_cambio_30))}
        ${item("Visualizaciones al día (media de 30 días)", fmt(G.vis_media_30), t ? `tendencia: ${t.et.toLowerCase()} (${pctTxt(t.c)} en un mes)` : "–", t ? t.cl : "")}
      </dl>`;
  }
  function frescura() {
    const T = D.tienda && D.tienda.resumen, M = D.marca || [];
    $("#frescura").innerHTML = `<table><thead><tr><th scope="col">Red</th><th scope="col">Seguidores</th><th scope="col">Visualizaciones</th></tr></thead><tbody>
      ${REDES.map(r => { const R = D.redes[r].resumen; return `<tr><th scope="row"><span class="red-etq"><i class="punto" style="--c:${D.redes[r].color}" aria-hidden="true"></i>${esc(D.redes[r].nombre)}</span></th><td>${fecha(R.fecha_seg)}</td><td>${fecha(R.fecha_vis)}</td></tr>`; }).join("")}
      <tr><th scope="row">Tienda</th><td colspan="2">${fecha(T && T.hasta)}</td></tr>
      <tr><th scope="row">Marca en Google</th><td colspan="2">${fecha(M.length ? M[M.length - 1][0] : null)}</td></tr></tbody></table>`;
  }
  function spark(pts) {                                // minilínea de seguidores (solo días con dato)
    if (pts.length < 2) return `<span class="spark-vacia">sin datos</span>`;
    const W = 100, H = 30, vs = pts.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs), r = mx - mn;
    const t0 = Date.parse(pts[0].t), dt = Date.parse(pts[pts.length - 1].t) - t0 || 1;
    const xy = pts.map(p => [(Date.parse(p.t) - t0) / dt * W, r ? H - 2 - (p.v - mn) / r * (H - 4) : H / 2]);
    const d = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join("");
    const y = xy[xy.length - 1][1];
    return `<span class="spark" aria-hidden="true"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" focusable="false">
      <path class="spark-area" d="${d}L${W} ${H}L0 ${H}Z"/><path class="spark-linea" d="${d}"/></svg><i style="top:${(y / H * 100).toFixed(1)}%"></i></span>`;
  }
  function tira() {
    const desde = diaMas(D.actualizado, -90);
    $("#tira").innerHTML = REDES.map(r => {
      const N = D.redes[r], R = N.resumen;
      const p = R.seguidores != null && R.d30 != null ? pct(R.seguidores, R.seguidores - R.d30) : null;
      const pts = serieDe(r).filter(x => x.seg != null && x.t > desde).map(x => ({ t: x.t, v: x.seg }));
      const etq = `${N.nombre}: ${fmt(R.seguidores)} seguidores, ${signo(R.d30)} en 30 días. Ir a su ficha.`;
      return `<a class="tira-item" href="#red-${r}" style="--c:${N.color}" aria-label="${esc(etq)}">
        <span class="tira-red"><i class="punto" aria-hidden="true"></i>${esc(N.nombre)}<span class="tira-ir" aria-hidden="true">↓</span></span>
        <span class="tira-v cifra">${fmt(R.seguidores)}</span>
        <span class="tira-c ${cls(R.d30)}">${flecha(R.d30)}${signo(R.d30)} en 30 días${p != null ? ` · ${pctTxt(p)}` : ""}</span>
        ${spark(pts)}
        <span class="tira-pie">Seguidores, últimos 90 días</span></a>`;
    }).join("");
  }

  /* ─────────────── fichas técnicas (KPIs completos) ─────────────── */
  function ficha(k, h) {
    const R = resumen(k), esG = k === "global", t = tendencia(k), gp = ganPer(k);
    const fila = (e, v, s, cv, cs) => `<div class="f-fila"><dt>${e}</dt><dd class="f-v ${cv || ""}">${v}</dd>${s ? `<dd class="f-s ${cs || ""}">${s}</dd>` : ""}</div>`;
    const grupo = (tit, filas) => `<section class="f-grupo"><${h}>${tit}</${h}><dl>${filas.filter(Boolean).join("")}</dl></section>`;
    const alDia = (n, d) => n == null ? "" : `${signo(n, d)} al día de media`;
    return [
      grupo("Seguidores", [
        fila("Seguidores", fmt(R.seguidores), R.fecha_seg ? `a ${fecha(R.fecha_seg)}` : "sin datos"),
        fila("Último día", signo(R.d1), "frente al día anterior", cls(R.d1)),
        fila("7 días", signo(R.d7), R.d7 == null ? "" : alDia(R.d7 / 7, 1), cls(R.d7)),
        fila("30 días", signo(R.d30), alDia(R.media_dia_30, 2), cls(R.d30)),
        fila("90 días", signo(R.d90), alDia(R.media_dia_90, 2), cls(R.d90)),
        gp ? fila("Ganados / perdidos (30 días)", `${fmt(gp.gan)} / ${fmt(gp.per)}`, `neto ${signo(gp.gan - gp.per)}`, "", cls(gp.gan - gp.per)) : "",
      ]),
      grupo("Visualizaciones", [
        fila("Históricas", fmt(R.vis_historico), k === "youtube" ? "todo el canal, desde 2021" : esG ? "suma de las cuatro redes" : `medidas desde el ${fecha(R.desde_vis)}`),
        fila("30 días", fmt(R.vis_30), R.vis_cambio_30 == null ? "sin comparación" : `${flecha(R.vis_cambio_30)}${pctTxt(R.vis_cambio_30)} frente a los 30 anteriores`, "", cls(R.vis_cambio_30)),
        fila("Media diaria (30 días)", fmt(R.vis_media_30)),
        fila("Últimos 7 días", fmt(R.vis_7), "suma de la semana"),
        fila("Tendencia", t ? t.et : "–", t ? `media de 30 días: ${pctTxt(t.c)} en un mes` : "falta historia", t ? t.cl : ""),
      ]),
      grupo("Me gusta", [
        fila("Históricos", fmt(R.lk_total), R.desde_lk ? `medidos desde el ${fecha(R.desde_lk)}` : "sin datos"),
        fila("30 días", fmt(R.lk_30), R.lk_cambio_30 == null ? "sin comparación" : `${flecha(R.lk_cambio_30)}${pctTxt(R.lk_cambio_30)} frente a los 30 anteriores`, "", cls(R.lk_cambio_30)),
        fila("Media diaria (30 días)", fmt(R.lk_media_30, 1)),
        fila("Últimos 7 días", fmt(R.lk_7)),
        fila("Por cada 100 visualizaciones (30 días)", R.vis_30 && R.lk_30 != null ? fmt(R.lk_30 / R.vis_30 * 100, 2) : "–"),
      ]),
    ].join("");
  }

  /* ─────────────── gráficas: tema, creación, leyenda y rangos ─────────────── */
  let TEMA = null;
  const graficas = {};
  function hexRgb(h) { h = String(h).replace("#", "").trim(); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const alfa = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r}, ${g}, ${b}, ${a})`; };
  function luminancia(h) { return hexRgb(h).map(c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }).reduce((a, c, i) => a + c * [.2126, .7152, .0722][i], 0); }
  function contraste(a, b) { const x = luminancia(a), y = luminancia(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  function leerTema() {
    const cs = getComputedStyle(RAIZ), v = n => cs.getPropertyValue(n).trim();
    TEMA = { papel: v("--papel"), tinta: v("--tinta"), t2: v("--tinta-2"), t3: v("--tinta-3"), linea: v("--linea"), rejilla: v("--rejilla"),
             sube: v("--sube"), baja: v("--baja"), barra: v("--barra"), m7: v("--m7"), m30: v("--m30"), tdr: v("--tdr"),
             oscuro: RAIZ.dataset.paleta === "plano", fuente: v("--f-tit") || "sans-serif" };
  }
  const colorDe = k => k === "global" ? TEMA.tinta : D.redes[k].color;
  const fmtEje = p => fmt(p, Math.abs(p) < 10 && p % 1 ? 1 : 0);

  function crear(id, o = {}) {
    if (graficas[id]) { try { graficas[id].remove(); } catch (e) { /* nada */ } delete graficas[id]; }
    const el = document.getElementById(id);
    if (!el) return null;
    el.innerHTML = "";
    if (!LC) { el.innerHTML = `<p class="vacio">No se ha podido cargar la librería de gráficas.</p>`; return null; }
    const t = TEMA;
    const ch = LC.createChart(el, {
      autoSize: true,
      layout: { background: { type: LC.ColorType.Solid, color: t.papel }, textColor: t.t3, fontFamily: t.fuente, fontSize: 12, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: t.rejilla } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.06 } },
      timeScale: {
        borderColor: t.linea, rightOffset: 2, minBarSpacing: 0.1,
        tickMarkFormatter: (time, tipo) => { const s = tTxt(time); if (!s) return ""; const [y, m, d] = s.split("-"); return tipo === 0 ? y : tipo === 1 ? MES[+m - 1] : String(+d); },
      },
      crosshair: {
        mode: LC.CrosshairMode.Normal,
        vertLine: { color: alfa(t.tinta, .35), width: 1, style: LC.LineStyle.Solid, labelBackgroundColor: t.tinta },
        horzLine: { color: alfa(t.tinta, .22), width: 1, style: LC.LineStyle.Solid, labelBackgroundColor: t.tinta },
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: { time: true, price: false }, axisDoubleClickReset: true },
      localization: {
        locale: "es-ES", priceFormatter: fmtEje,
        percentageFormatter: p => fmt(p, Math.abs(p) < 10 ? 2 : 1) + NB + "%",
        timeFormatter: time => { const s = tTxt(time); return o.periodo ? etiquetaPeriodo(s, o.periodo) : fecha(s); },
      },
    });
    graficas[id] = ch;
    return ch;
  }
  function vacio(id, texto) {
    if (graficas[id]) { try { graficas[id].remove(); } catch (e) { /* nada */ } delete graficas[id]; }
    const el = document.getElementById(id); if (el) el.innerHTML = `<p class="vacio">${texto}</p>`;
  }
  function addLinea(ch, color, datos, o = {}) {
    const flojo = contraste(color, TEMA.papel) < 2;     // p. ej. el cian de TikTok sobre papel claro: se le pone un borde de tinta
    const pf = { type: "price", precision: o.decimales || 0, minMove: o.decimales ? 0.1 : 1 };
    if (flojo) ch.addLineSeries({ color: alfa(TEMA.tinta, .55), lineWidth: 4, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: pf }).setData(datos);
    const base = { lineWidth: 2, priceLineVisible: false, lastValueVisible: !!o.ultimo, priceFormat: pf, title: o.titulo || "",
                   crosshairMarkerRadius: 4, crosshairMarkerBorderWidth: 2, crosshairMarkerBorderColor: flojo ? TEMA.tinta : TEMA.papel, crosshairMarkerBackgroundColor: color };
    const s = o.area
      ? ch.addAreaSeries(Object.assign(base, { lineColor: color, topColor: alfa(color, TEMA.oscuro ? .24 : .16), bottomColor: alfa(color, 0) }))
      : ch.addLineSeries(Object.assign(base, { color }));
    s.setData(datos);
    return s;
  }
  function addBarras(ch, p, m30) {                      // verde si el día supera su media de 30 días; gris si no
    const b = ch.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "price", precision: 0, minMove: 1 } });
    b.setData(p.map((x, i) => ({ time: x.t, value: x.v, color: x.v >= m30[i] ? alfa(TEMA.sube, TEMA.oscuro ? .85 : .8) : TEMA.barra })));
    return b;
  }
  function leyenda(idEl, ch, filas, fechaTxt) {         // filas: [{nombre, color, forma, serie, datos, texto}]
    const el = document.getElementById(idEl); if (!el) return () => {};
    const fx = fechaTxt || fecha;
    const pinta = param => {
      const enCursor = !!(param && param.time !== undefined && param.seriesData);
      let t = enCursor ? tTxt(param.time) : "";
      const partes = filas.map(f => {
        let d = null;
        if (enCursor) d = param.seriesData.get(f.serie) || null;
        else { const u = f.datos[f.datos.length - 1]; if (u) { d = u; if (!t) t = tTxt(u.time); } }
        const hay = d && (d.value != null || d.close != null);
        const val = hay ? (f.texto ? f.texto(d) : fmt(d.value != null ? d.value : d.close)) : "–";
        const clave = f.forma === "nada" ? "" : `<i class="ley-${f.forma || "linea"}" style="--c:${f.color || TEMA.tinta}" aria-hidden="true"></i>`;
        return `<span class="ley-item">${clave}${esc(f.nombre)} <b>${val}</b></span>`;
      });
      el.innerHTML = `<span class="ley-fecha">${t ? fx(t) : ""}</span>${partes.join("")}`;
    };
    ch.subscribeCrosshairMove(pinta);
    pinta(null);
    return pinta;
  }
  const RANGOS = [["1M", "Último mes"], ["3M", "Últimos 3 meses"], ["6M", "Últimos 6 meses"], ["1A", "Último año"], ["2A", "Últimos 2 años"], ["Todo", "Toda la historia"]];
  function montarRango(nombre, alElegir) {
    const g = $(`.seg.rango[data-rango="${nombre}"]`);
    g.innerHTML = RANGOS.map(([r, t]) => `<button type="button" data-r="${r}" title="${t}" aria-label="${t}">${r}</button>`).join("");
    $$("button", g).forEach(b => b.addEventListener("click", () => { pulsar(g, "r", b.dataset.r); alElegir(b.dataset.r); }));
  }
  function pulsar(sel, attr, v) {
    const g = typeof sel === "string" ? $(sel) : sel; if (!g) return;
    $$(`button[data-${attr}]`, g).forEach(b => b.setAttribute("aria-pressed", String(b.dataset[attr] === v)));
  }
  function aplicarRango(id, r) {
    const ch = graficas[id]; if (!ch) return;
    if (r === "Todo") { ch.timeScale().fitContent(); return; }
    const meses = { "1M": 1, "3M": 3, "6M": 6, "1A": 12, "2A": 24 }[r];
    const hasta = new Date(D.actualizado.slice(0, 10) + "T00:00:00Z"), desde = new Date(hasta);
    desde.setUTCMonth(desde.getUTCMonth() - meses);
    try { ch.timeScale().setVisibleRange({ from: iso(desde), to: iso(hasta) }); } catch (e) { ch.timeScale().fitContent(); }
  }

  function repintarGraficas() {
    if (!D) return;
    if (!LC) {                                          // sin la librería: se queda el texto y las tablas, y se avisa en cada gráfica
      $$(".grafica").forEach(el => { el.innerHTML = `<p class="vacio">No se ha podido cargar la librería de gráficas. Prueba a recargar la página.</p>`; });
      return;
    }
    leerTema();
    pintarTendencia(); pintarComparativa(); pintarMinis(); pintarTiendaGraf();
  }

  /* ─────────────── tendencia: la gráfica grande ─────────────── */
  const T = { red: "global", met: "vis", forma: { seg: "velas", acum: "velas", lk: "dia" }, periodo: { seg: "semana", acum: "semana" }, rango: null };
  const FORMAS = { seg: [["velas", "Velas"], ["linea", "Línea"]], acum: [["velas", "Velas"], ["area", "Área"]], lk: [["dia", "Diarios"], ["acum", "Acumulados"]] };
  const rangoDef = k => k === "youtube" || k === "global" ? "1A" : "Todo";
  const VIS_NOTA = {
    global: "Suma de las cuatro redes; cada red entra cuando hay datos. YouTube cuenta las visualizaciones de vídeos; Instagram, las de la cuenta; TikTok, las de vídeos del día; Facebook, las del contenido de la página.",
    youtube: "YouTube: visualizaciones de vídeos (YouTube Analytics).",
    instagram: "Instagram: visualizaciones de la cuenta, publicaciones y reels (Metricool).",
    tiktok: "TikTok: visualizaciones de vídeos del día (Metricool).",
    facebook: "Facebook: visualizaciones del contenido de la página (Metricool).",
  };
  const NOTA_LK = {
    youtube: "YouTube: me gusta recibidos cada día por todos los vídeos del canal (YouTube Analytics).",
    tiktok: "TikTok: me gusta recibidos cada día por los vídeos de la cuenta (Metricool).",
    instagram: "Instagram: me gusta de cada publicación y reel, contados el día que se publicó (Metricool no los da por día recibido).",
    facebook: "Facebook: reacciones a las publicaciones de la página y me gusta de los reels (Metricool).",
    global: "Suma de las cuatro redes. YouTube y TikTok cuentan los me gusta del día; Instagram, los de lo publicado ese día; Facebook, reacciones y me gusta de reels.",
  };
  const PERIODO_TXT = { dia: "un día", semana: "una semana", mes: "un mes" };

  function montarTendencia() {
    $("#t-red").innerHTML = ["global", ...REDES].map(k => `<button type="button" data-red="${k}"><i class="punto" style="--c:${k === "global" ? "var(--tinta)" : D.redes[k].color}" aria-hidden="true"></i>${esc(nombreRed(k))}</button>`).join("");
    $$("#t-red button").forEach(b => b.addEventListener("click", () => { T.red = b.dataset.red; pintarTendencia(); }));
    $$("#t-met button").forEach(b => b.addEventListener("click", () => { T.met = b.dataset.met; pintarTendencia(); }));
    $$("#t-periodo button").forEach(b => b.addEventListener("click", () => { T.periodo[T.met] = b.dataset.periodo; pintarTendencia(); }));
    montarRango("tend", r => { T.rango = r; aplicarRango("g-tend", r); });
    controlesTendencia();
  }
  function controlesTendencia() {
    pulsar("#t-red", "red", T.red); pulsar("#t-met", "met", T.met);
    const f = FORMAS[T.met], g = $("#t-forma");
    $("#ctl-forma").hidden = !f;
    if (f) {
      if (g.dataset.met !== T.met) {
        g.dataset.met = T.met;
        g.innerHTML = f.map(([v, t]) => `<button type="button" data-forma="${v}">${t}</button>`).join("");
        $$("button", g).forEach(b => b.addEventListener("click", () => { T.forma[T.met] = b.dataset.forma; pintarTendencia(); }));
      }
      pulsar(g, "forma", T.forma[T.met]);
    }
    const conPeriodo = (T.met === "seg" || T.met === "acum") && T.forma[T.met] === "velas";
    $("#ctl-periodo").hidden = !conPeriodo;
    if (conPeriodo) pulsar("#t-periodo", "periodo", T.periodo[T.met]);
    pulsar('.seg.rango[data-rango="tend"]', "r", T.rango || rangoDef(T.red));
  }

  function pintarTendencia() {
    if (!D || !TEMA || !LC) { if (D) controlesTendencia(); return; }
    controlesTendencia();
    const k = T.red, esG = k === "global", R = resumen(k), col = colorDe(k), quien = esG ? "las cuatro redes" : D.redes[k].nombre;
    let titulo = "", sub = "", nota = "", filas = [], fechaTxt = null, ch = null, hay = true;

    if (T.met === "seg" || T.met === "acum") {
      const pts = T.met === "seg" ? puntosSeg(k) : puntosAcum(k);
      const forma = T.forma[T.met], periodo = T.periodo[T.met];
      const queEs = T.met === "seg" ? "Seguidores" : "Visualizaciones acumuladas";
      titulo = T.met === "seg" ? (esG ? "Seguidores · suma de las cuatro redes" : `Seguidores en ${D.redes[k].nombre}`) : `Visualizaciones acumuladas · ${quien}`;
      hay = pts.length > 0;
      if (hay && forma === "velas") {
        ch = crear("g-tend", { periodo });
        const v = velas(pts, periodo);
        const s = ch.addCandlestickSeries({ upColor: TEMA.sube, downColor: TEMA.baja, borderVisible: false, wickUpColor: TEMA.sube, wickDownColor: TEMA.baja,
          priceLineVisible: false, lastValueVisible: true, priceFormat: { type: "price", precision: 0, minMove: 1 } });
        s.setData(v);
        fechaTxt = t => etiquetaPeriodo(t, periodo);
        filas = [
          { nombre: "Cierre", forma: "vela", serie: s, datos: v, texto: d => fmt(d.close) },
          { nombre: "Cambio del periodo", forma: "nada", serie: s, datos: v, texto: d => `<span class="${cls(d.close - d.open)}">${signo(d.close - d.open)}</span>` },
        ];
        sub = T.met === "seg"
          ? `Cada vela es ${PERIODO_TXT[periodo]}: abre con el cierre del periodo anterior y cierra con el último dato. Verde si ha subido; naranja si ha bajado.`
          : `Cada vela es ${PERIODO_TXT[periodo]}: el cuerpo es lo que se ha sumado en ese periodo, por eso casi todas suben.`;
      } else if (hay) {
        ch = crear("g-tend");
        const s = addLinea(ch, col, pts, { area: T.met === "acum", ultimo: true });
        filas = [{ nombre: queEs, color: col, forma: T.met === "acum" ? "barra" : "linea", serie: s, datos: pts }];
        sub = T.met === "seg" ? "Seguidores de cada día con dato." : "Suma de las visualizaciones día a día.";
      }
      if (T.met === "seg") {
        nota = esG ? `La suma empieza el ${fecha(R.desde_seg)}, el primer día con seguidores medidos en las cuatro redes.`
          : k === "youtube" ? "Desde que se abrió el canal: los seguidores de cada día salen de los suscriptores ganados y perdidos que da YouTube Analytics."
          : `Metricool guarda los seguidores de ${D.redes[k].nombre} desde el ${fecha(R.desde_seg)}.`;
      } else {
        const p0 = pts[0] && pts[0].time;
        nota = esG ? `Suma de las cuatro redes desde el ${fecha(p0)} (cada red entra cuando hay datos).`
          : `Desde el ${fecha(p0)}${k === "youtube" ? ", el primer día del canal" : " (lo que guarda Metricool)"}.`;
      }
    } else if (T.met === "vis") {
      const p = diarios(k, "vis");
      titulo = `Visualizaciones diarias · ${quien}`;
      sub = "Barras: en verde, los días que superan su media de 30 días; en gris, los que no. Líneas: medias de 7 y 30 días.";
      nota = VIS_NOTA[k] + (p.length && !esG ? ` Desde el ${fecha(p[0].t)}.` : "");
      hay = p.length > 0;
      if (hay) {
        ch = crear("g-tend");
        const vals = p.map(x => x.v), m7 = medias(vals, 7), m30 = medias(vals, 30);
        const b = addBarras(ch, p, m30);
        const l7 = addLinea(ch, TEMA.m7, p.map((x, i) => ({ time: x.t, value: m7[i] })));
        const l30 = addLinea(ch, TEMA.m30, p.map((x, i) => ({ time: x.t, value: m30[i] })), { ultimo: true });
        filas = [{ nombre: "Día", forma: "doble", serie: b, datos: b.data() },
          { nombre: "Media 7 d", color: TEMA.m7, serie: l7, datos: l7.data() },
          { nombre: "Media 30 d", color: TEMA.m30, serie: l30, datos: l30.data() }];
      }
    } else {
      const p = diarios(k, "likes"), forma = T.forma.lk;
      titulo = `Me gusta ${forma === "dia" ? "diarios" : "acumulados"} · ${quien}`;
      sub = forma === "dia" ? "Barras: en verde, los días que superan su media de 30 días; en gris, los que no. Líneas: medias de 7 y 30 días." : "Suma de los me gusta día a día.";
      nota = NOTA_LK[k] + (p.length ? ` Desde el ${fecha(p[0].t)}.` : " Todavía no hay datos.");
      hay = p.length > 0;
      if (hay) {
        ch = crear("g-tend");
        if (forma === "dia") {
          const vals = p.map(x => x.v), m7 = medias(vals, 7), m30 = medias(vals, 30);
          const b = addBarras(ch, p, m30);
          const l7 = addLinea(ch, TEMA.m7, p.map((x, i) => ({ time: x.t, value: m7[i] })), { decimales: 1 });
          const l30 = addLinea(ch, TEMA.m30, p.map((x, i) => ({ time: x.t, value: m30[i] })), { decimales: 1, ultimo: true });
          filas = [{ nombre: "Día", forma: "doble", serie: b, datos: b.data() },
            { nombre: "Media 7 d", color: TEMA.m7, serie: l7, datos: l7.data(), texto: d => fmt(d.value, 1) },
            { nombre: "Media 30 d", color: TEMA.m30, serie: l30, datos: l30.data(), texto: d => fmt(d.value, 1) }];
        } else {
          let a = 0; const ac = p.map(x => ({ time: x.t, value: (a += x.v) }));
          const s = addLinea(ch, col, ac, { ultimo: true });
          filas = [{ nombre: "Me gusta acumulados", color: col, serie: s, datos: ac }];
        }
      }
    }

    $("#fig-tend-t").textContent = titulo;
    $("#fig-tend-sub").textContent = sub;
    $("#nota-tend").textContent = nota;
    $("#g-tend").setAttribute("aria-label", `${titulo}. Los valores del día o periodo bajo el cursor se leen en la línea de encima de la gráfica.`);
    if (!hay || !ch) { vacio("g-tend", "Sin datos para esta red y esta métrica."); $("#ley-tend").innerHTML = ""; return; }
    leyenda("ley-tend", ch, filas, fechaTxt);
    aplicarRango("g-tend", T.rango || rangoDef(k));
  }

  /* ─────────────── comparativa entre redes (% desde el primer día visible) ─────────────── */
  const CMP = { modo: "seg", rango: "3M" };
  function montarComparativa() {
    $$("#t-comp button").forEach(b => b.addEventListener("click", () => { CMP.modo = b.dataset.comp; pintarComparativa(); }));
    montarRango("comp", r => { CMP.rango = r; aplicarRango("g-comp", r); });
    pulsar("#t-comp", "comp", CMP.modo); pulsar('.seg.rango[data-rango="comp"]', "r", CMP.rango);
  }
  function primerVisible(ch, datos) {
    const r = ch.timeScale().getVisibleRange();
    if (!r) return datos.length ? datos[0].value : null;
    const desde = tTxt(r.from), p = datos.find(x => x.time >= desde);
    return p ? p.value : null;
  }
  function pintarComparativa() {
    if (!D || !TEMA) return;
    pulsar("#t-comp", "comp", CMP.modo); pulsar('.seg.rango[data-rango="comp"]', "r", CMP.rango);
    const ch = crear("g-comp"); if (!ch) return;
    ch.priceScale("right").applyOptions({ mode: LC.PriceScaleMode.Percentage });
    const filas = [];
    REDES.forEach(r => {
      let datos;
      if (CMP.modo === "seg") datos = puntosSeg(r);
      else {
        const campo = CMP.modo === "likes" ? "likes" : "vis", p = diarios(r, campo), m = medias(p.map(x => x.v), 30);
        datos = p.map((x, i) => ({ time: x.t, value: Math.max(m[i], 0.01) }));
      }
      if (!datos.length) return;
      // sin etiqueta de último valor en el eje: tres redes van cerca del 0 % y se pisarían; el % va en la leyenda
      const s = addLinea(ch, D.redes[r].color, datos, { decimales: CMP.modo === "seg" ? 0 : 1 });
      const fila = { nombre: D.redes[r].nombre, color: D.redes[r].color, serie: s, datos };
      fila.texto = d => { const b = primerVisible(ch, datos), c = b ? pct(d.value, b) : null;
        return `${fmt(d.value, CMP.modo === "seg" || d.value >= 10 ? 0 : 1)} <small class="${cls(c)}">(${pctTxt(c)})</small>`; };
      filas.push(fila);
    });
    const pinta = leyenda("ley-comp", ch, filas);
    ch.timeScale().subscribeVisibleTimeRangeChange(() => pinta(null));
    aplicarRango("g-comp", CMP.rango);
  }

  /* ─────────────── red a red ─────────────── */
  function redes() {
    $("#redes-lista").innerHTML = REDES.map(r => {
      const N = D.redes[r], R = N.resumen, url = urlSegura(N.url);
      return `<article class="red revela" id="red-${r}" aria-labelledby="red-${r}-t">
        <p class="red-kicker"><span class="red-nombre"><i class="punto" style="--c:${N.color}" aria-hidden="true"></i>${esc(N.nombre)}</span>
          <span>${esc(N.usuario)}</span><span>visualizaciones hasta el ${fecha(R.fecha_vis)}</span>
          ${url ? `<a class="boton red-perfil" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Ver el perfil de TDR en ${esc(N.nombre)} (se abre en otra pestaña)">Ver el perfil ↗</a>` : ""}</p>
        <h3 class="red-titular" id="red-${r}-t">${titularRed(r)}</h3>
        <p class="red-deck">${deckRed(r)}</p>
        <div class="ficha">${ficha(r, "h4")}</div>
        <figure class="figura" aria-labelledby="mini-${r}-t">
          <figcaption class="fig-cab"><h4 class="fig-titulo" id="mini-${r}-t">Visualizaciones diarias en ${esc(N.nombre)}, últimos tres meses</h4>
            <p class="fig-sub notas">En verde, los días por encima de su media de 30 días; la línea es esa media.</p></figcaption>
          <div class="leyenda" id="ley-mini-${r}"></div>
          <div class="grafica mini" id="g-mini-${r}" role="img" aria-label="Visualizaciones diarias en ${esc(N.nombre)}, últimos tres meses"></div>
          <div class="red-pie"><button type="button" class="boton" data-ver="${r}">Ver en la gráfica grande ↑</button></div>
        </figure>
      </article>`;
    }).join("");
    $$("[data-ver]").forEach(b => b.addEventListener("click", () => {
      T.red = b.dataset.ver; pintarTendencia();
      $("#tendencia").scrollIntoView({ behavior: movReducido.matches ? "auto" : "smooth", block: "start" });
      $("#tendencia-t").focus({ preventScroll: true });
    }));
    observarRevelado($$("#redes-lista .revela"));
  }
  function pintarMinis() {
    REDES.forEach(r => {
      const id = "g-mini-" + r, p = diarios(r, "vis");
      if (!p.length) { vacio(id, "Sin datos de visualizaciones."); return; }
      const ch = crear(id); if (!ch) return;
      const m30 = medias(p.map(x => x.v), 30);
      const b = addBarras(ch, p, m30);
      const l = addLinea(ch, TEMA.m30, p.map((x, i) => ({ time: x.t, value: m30[i] })), { ultimo: true });
      leyenda("ley-mini-" + r, ch, [{ nombre: "Día", forma: "doble", serie: b, datos: b.data() },
        { nombre: "Media 30 d", color: TEMA.m30, serie: l, datos: l.data(), texto: d => fmt(d.value, d.value < 10 ? 1 : 0) }]);
      aplicarRango(id, "3M");
    });
  }

  /* ─────────────── tienda ─────────────── */
  const RT = { tienda: "Todo", marca: "6M" };
  const sumaTienda = (k, i) => REDES.reduce((a, r) => a + (D.tienda.resumen[k] && D.tienda.resumen[k][r] ? D.tienda.resumen[k][r][i] : 0), 0);
  function marca30() {
    const M = (D.marca || []).filter(x => x[1] != null);
    if (M.length < 30) return null;
    const c30 = M.slice(-30).reduce((a, x) => a + x[1], 0), i30 = M.slice(-30).reduce((a, x) => a + (x[2] || 0), 0);
    const cp = M.length >= 60 ? M.slice(-60, -30).reduce((a, x) => a + x[1], 0) : null;
    return { c30, i30, cp, c: pct(c30, cp), hasta: M[M.length - 1][0] };
  }
  function tienda() {
    const TR = D.tienda.resumen, d = TR.d30;
    const s = sumaTienda("d30", 0), c = sumaTienda("d30", 1), i = sumaTienda("d30", 2);
    $("#ante-tienda").textContent = `Tienda · 30 días hasta el ${fecha(TR.hasta)}`;
    $("#tesis-tienda").innerHTML = `En los últimos 30 días, las redes llevaron ${cifra(fmt(s))} ${plural(s, "visita", "visitas")} a todoenrecambio.com` +
      (c > 0 ? ` y ${cifra(fmt(c))} ${plural(c, "compra", "compras")}, por ${cifra(fmt(i, 2) + NB + "€")}.` : ", sin compras atribuidas.");
    const p = [], orden = REDES.map(r => [r, d[r] ? d[r][0] : 0]).sort((a, b) => b[1] - a[1]);
    if (orden[0][1] > 0) p.push(`${esc(D.redes[orden[0][0]].nombre)} fue la red que más visitas llevó: ${cifra(fmt(orden[0][1]))}.`);
    const conCompra = REDES.filter(r => d[r] && d[r][1] > 0);
    if (conCompra.length) p.push(`${c === 1 ? "La compra llegó" : "Las compras llegaron"} desde ${lista(conCompra.map(r => esc(D.redes[r].nombre) + (c > 1 ? ` (${fmt(d[r][1])})` : "")))}.`);
    const m = marca30();
    if (m) {
      const cmp = m.cp != null ? cambioTxt(m.c30, m.cp, m.c, "que en los 30 días anteriores") : "";
      p.push(`En Google, las búsquedas con «todoenrecambio» dieron ${cifra(fmt(m.c30))} ${plural(m.c30, "clic", "clics")} en 30 días${cmp ? ", " + cmp : ""}.`);
    }
    $("#deck-tienda").innerHTML = p.join(" ");

    const fila = (e, v, s2, cs) => `<div class="f-fila"><dt>${e}</dt><dd class="f-v">${v}</dd>${s2 ? `<dd class="f-s ${cs || ""}">${s2}</dd>` : ""}</div>`;
    const grupo = (t, f) => `<section class="f-grupo"><h3>${t}</h3><dl>${f.join("")}</dl></section>`;
    $("#ficha-tienda").innerHTML = [
      grupo("Visitas desde las redes", [
        fila("Total", fmt(sumaTienda("total", 0)), `desde el ${fecha(TR.desde)}`),
        fila("Últimos 30 días", fmt(s)), fila("Últimos 90 días", fmt(sumaTienda("d90", 0)))]),
      grupo("Compras atribuidas", [
        fila("Total", fmt(sumaTienda("total", 1)), `${fmt(sumaTienda("total", 2), 2)}${NB}€ desde el ${fecha(TR.desde)}`),
        fila("Últimos 30 días", fmt(c), `${fmt(i, 2)}${NB}€`), fila("Últimos 90 días", fmt(sumaTienda("d90", 1)), `${fmt(sumaTienda("d90", 2), 2)}${NB}€`)]),
      grupo("Búsquedas de la marca", m ? [
        fila("Clics en 30 días", fmt(m.c30), m.c == null ? "sin comparación" : `${flecha(m.c)}${pctTxt(m.c)} frente a los 30 anteriores`, cls(m.c)),
        fila("Clics en los 30 anteriores", fmt(m.cp)), fila("Impresiones en 30 días", fmt(m.i30), `hasta el ${fecha(m.hasta)}`)] : [fila("Clics en 30 días", "–", "sin datos")]),
    ].join("");

    const celda = (k, r, i2, d2) => fmt(TR[k] && TR[k][r] ? TR[k][r][i2] : 0, d2 || 0);
    $("#tabla-redes-tienda").innerHTML = `<table class="tabla"><thead><tr><th scope="col">Red</th><th scope="col" class="n">Visitas (total)</th><th scope="col" class="n">Visitas 30 días</th><th scope="col" class="n">Visitas 90 días</th><th scope="col" class="n">Compras (total)</th><th scope="col" class="n">Importe (total)</th></tr></thead>
      <tbody>${REDES.map(r => `<tr><td><span class="red-etq"><i class="punto" style="--c:${D.redes[r].color}" aria-hidden="true"></i>${esc(D.redes[r].nombre)}</span></td>
        <td class="n">${celda("total", r, 0)}</td><td class="n">${celda("d30", r, 0)}</td><td class="n">${celda("d90", r, 0)}</td><td class="n">${celda("total", r, 1)}</td><td class="n">${celda("total", r, 2, 2)}${NB}€</td></tr>`).join("")}</tbody>
      <tfoot><tr><td>Las cuatro</td><td class="n">${fmt(sumaTienda("total", 0))}</td><td class="n">${fmt(s)}</td><td class="n">${fmt(sumaTienda("d90", 0))}</td><td class="n">${fmt(sumaTienda("total", 1))}</td><td class="n">${fmt(sumaTienda("total", 2), 2)}${NB}€</td></tr></tfoot></table>`;

    const ventas = [];
    D.tienda.serie.forEach(([f, x]) => REDES.forEach(r => { if (x[r] && x[r][1]) ventas.push([f, r, x[r][1], x[r][2]]); }));
    ventas.sort((a, b) => b[0].localeCompare(a[0]));
    $("#tabla-ventas").innerHTML = ventas.length
      ? `<table class="tabla"><thead><tr><th scope="col">Día</th><th scope="col">Red</th><th scope="col" class="n">Compras</th><th scope="col" class="n">Importe</th></tr></thead><tbody>` +
        ventas.map(v => `<tr><td>${fecha(v[0])}</td><td><span class="red-etq"><i class="punto" style="--c:${D.redes[v[1]].color}" aria-hidden="true"></i>${esc(D.redes[v[1]].nombre)}</span></td><td class="n">${fmt(v[2])}</td><td class="n">${fmt(v[3], 2)}${NB}€</td></tr>`).join("") +
        `</tbody></table>`
      : `<p class="nota">Todavía no hay compras atribuidas a las redes.</p>`;

    const dom = new Date(TR.hasta + "T00:00:00Z").getUTCDay() === 0;
    $("#nota-tienda").textContent = `Datos de Google Analytics del ${fecha(TR.desde)} al ${fecha(TR.hasta)}.` +
      (dom ? "" : ` La última semana llega hasta el ${fecha(TR.hasta)} y todavía está incompleta.`);
    montarRango("tienda", r => { RT.tienda = r; aplicarRango("g-tienda", r); });
    montarRango("marca", r => { RT.marca = r; aplicarRango("g-marca", r); });
    pulsar('.seg.rango[data-rango="tienda"]', "r", RT.tienda); pulsar('.seg.rango[data-rango="marca"]', "r", RT.marca);
  }
  function pintarTiendaGraf() {
    const TR = D.tienda.resumen;
    const ch = crear("g-tienda");
    if (ch) {
      const semanas = [];
      for (let w = lunes(TR.desde); w <= lunes(TR.hasta); w = diaMas(w, 7)) semanas.push(w);
      const filas = [];
      REDES.forEach(r => {                              // las semanas sin ninguna visita desde esa red cuentan como 0 visitas
        const m = new Map(semanas.map(w => [w, 0]));
        D.tienda.serie.forEach(([f, x]) => { const w = lunes(f); if (m.has(w) && x[r]) m.set(w, m.get(w) + x[r][0]); });
        const datos = [...m].map(([t, v]) => ({ time: t, value: v }));
        const s = addLinea(ch, D.redes[r].color, datos);
        filas.push({ nombre: D.redes[r].nombre, color: D.redes[r].color, serie: s, datos });
      });
      leyenda("ley-tienda", ch, filas, t => `semana del ${fecha(t)}`);
      aplicarRango("g-tienda", RT.tienda);
    }
    const gm = crear("g-marca");
    if (gm) {
      const M = (D.marca || []).filter(x => x[1] != null), m7 = medias(M.map(x => x[1]), 7);
      const b = gm.addHistogramSeries({ color: TEMA.barra, priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "price", precision: 0, minMove: 1 } });
      b.setData(M.map(x => ({ time: x[0], value: x[1] })));
      const l = addLinea(gm, TEMA.tdr, M.map((x, i) => ({ time: x[0], value: m7[i] })), { ultimo: true, decimales: 1 });
      leyenda("ley-marca", gm, [{ nombre: "Clics del día", forma: "barra", color: TEMA.barra, serie: b, datos: b.data() },
        { nombre: "Media 7 d", color: TEMA.tdr, serie: l, datos: l.data(), texto: d => fmt(d.value, 1) }]);
      aplicarRango("g-marca", RT.marca);
    }
  }

  /* ─────────────── vídeos ─────────────── */
  const V = { red: "todas", orden: "fecha", todo: false };
  const movil = window.matchMedia("(max-width: 720px)");
  const vMax = () => movil.matches ? 10 : 20;
  function montarVideos() {
    const n = r => D.publicaciones.filter(p => r === "todas" || p.red === r).length;
    $("#v-red").innerHTML = ["todas", ...REDES].map(r => `<button type="button" data-vred="${r}">${r === "todas" ? "Todas"
      : `<i class="punto" style="--c:${D.redes[r].color}" aria-hidden="true"></i>${esc(D.redes[r].nombre)}`} <span class="cuenta">${fmt(n(r))}</span></button>`).join("");
    $$("#v-red button").forEach(b => b.addEventListener("click", () => { V.red = b.dataset.vred; V.todo = false; pintarVideos(); }));
    $$("#v-orden button").forEach(b => b.addEventListener("click", () => { V.orden = b.dataset.orden; V.todo = false; pintarVideos(); }));
    $("#v-mas").addEventListener("click", () => { V.todo = true; pintarVideos(); });
    pintarVideos();
  }
  function pintarVideos() {
    pulsar("#v-red", "vred", V.red); pulsar("#v-orden", "orden", V.orden);
    let L = D.publicaciones.filter(p => V.red === "todas" || p.red === V.red);
    L = L.slice().sort((a, b) => V.orden === "vis" ? (b.vis || 0) - (a.vis || 0) : V.orden === "likes" ? (b.likes || 0) - (a.likes || 0) : String(b.fecha).localeCompare(String(a.fecha)));
    const ver = V.todo ? L : L.slice(0, vMax()), resto = L.length - ver.length;
    $("#tabla-videos tbody").innerHTML = ver.map(filaVideo).join("") || `<tr><td colspan="6" class="vacio">No hay publicaciones de esta red.</td></tr>`;
    const b = $("#v-mas");
    b.hidden = resto <= 0;
    b.textContent = resto === 1 ? "Mostrar la que falta" : `Mostrar las ${fmt(resto)} restantes`;
    const ord = { fecha: "de la más reciente a la más antigua", vis: "de la más vista a la menos vista", likes: "de la que más me gusta tiene a la que menos" }[V.orden];
    $("#videos-cap").textContent = `${fmt(L.length)} ${plural(L.length, "publicación", "publicaciones")}${V.red === "todas" ? "" : " de " + D.redes[V.red].nombre}, ${ord}`;
  }
  function filaVideo(p) {
    const N = D.redes[p.red] || { nombre: p.red, color: "#888888" }, u = urlSegura(p.url), tit = esc(p.titulo || "(sin título)");
    return `<tr><td class="v-fecha">${fecha(p.fecha)}<span class="hora">${esc(String(p.fecha || "").slice(11, 16))}</span></td>
      <td class="v-red"><span class="red-etq"><i class="punto" style="--c:${N.color}" aria-hidden="true"></i>${esc(N.nombre)}</span>${p.tipo ? `<span class="tipo">${esc(p.tipo)}</span>` : ""}</td>
      <td class="v-tit">${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${tit}</a>` : tit}</td>
      <td class="n v-vis" data-etq="Visualizaciones">${fmt(p.vis)}</td><td class="n v-lk" data-etq="Me gusta">${fmt(p.likes)}</td><td class="n v-com" data-etq="Comentarios">${fmt(p.comentarios)}</td></tr>`;
  }

  /* ─────────────── índice activo, índice pegado y revelado ─────────────── */
  function indiceActivo() {
    const enlaces = $$("#indice-lista a"), ol = $("#indice-lista");
    const secciones = enlaces.map(a => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    const dentro = new Set();
    let actual = null;
    const marcar = id => {
      if (id === actual) return; actual = id;
      enlaces.forEach(a => a.getAttribute("href") === "#" + id ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current"));
      const a = enlaces.find(x => x.getAttribute("href") === "#" + id);
      if (a && ol.scrollWidth > ol.clientWidth) ol.scrollTo({ left: Math.max(0, a.offsetLeft - (ol.clientWidth - a.offsetWidth) / 2), behavior: movReducido.matches ? "auto" : "smooth" });
    };
    const decidir = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) { marcar(secciones[secciones.length - 1].id); return; }
      const s = secciones.find(x => dentro.has(x.id));
      if (s) marcar(s.id);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? dentro.add(e.target.id) : dentro.delete(e.target.id)); decidir(); },
        { rootMargin: "-30% 0px -65% 0px" });
      secciones.forEach(s => io.observe(s));
    }
    window.addEventListener("scroll", () => { if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) decidir(); }, { passive: true });
    marcar(secciones[0].id);
  }
  function pegado() {
    const c = $("#centinela");
    if (!c || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(([e]) => RAIZ.classList.toggle("pegado", !e.isIntersecting && e.boundingClientRect.top < 0)).observe(c);
  }
  let ioRevela = null;
  function revelado() {
    if (!RAIZ.classList.contains("revelar")) return;  // el script de cabecera decide (menos movimiento, capturas automáticas)
    ioRevela = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visto"); ioRevela.unobserve(e.target); } }),
      { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });
    observarRevelado($$(".revela"));
    window.addEventListener("beforeprint", () => $$(".revela").forEach(el => el.classList.add("visto")));
  }
  function observarRevelado(els) { if (ioRevela) els.forEach(el => ioRevela.observe(el)); }
})();
