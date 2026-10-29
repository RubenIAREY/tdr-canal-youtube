/* Panel privado con contraseña (29/10/2026).
   Los datos del panel se publican cifrados en cifrado/ (PANEL-REDES/cifrar_panel.py: gzip + AES-256-GCM, clave por PBKDF2-SHA256 con la
   sal y las iteraciones de cifrado/manifiesto.json). Esta página pide la contraseña, saca la clave en el navegador y, desde ese momento,
   cualquier fetch a datos_redes.json o datos/*.json baja el .enc y lo devuelve ya descifrado: el resto del panel no cambia.
   La clave (no la contraseña) se guarda en la pestaña (sessionStorage) y, si se marca «Recordar», en el navegador (localStorage).
   Uso: <script src="../comun/candado.js" data-arrancar="terminal.js"></script> (los scripts de data-arrancar se cargan al abrir). */
(function () {
  "use strict";
  var yo = document.currentScript;
  var BASE = new URL("../", yo.src);                       // raíz del repositorio (comun/..)
  var ARRANCAR = (yo.dataset.arrancar || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  var LLAVE_KEY = "tdr-panel-llave";
  var sutil = window.crypto && window.crypto.subtle;
  var fetchOriginal = window.fetch.bind(window);
  var llave = null, manifiesto = null;

  document.documentElement.classList.add("bloqueado");
  var estilo = document.createElement("style");
  estilo.textContent = [
    "html.bloqueado body > *:not(#candado){display:none !important}",
    "#candado{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:#f4efe6;color:#1f2430;",
    "font-family:'Avenir Next',Avenir,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;overflow:auto}",
    "#candado *{box-sizing:border-box}",
    "#candado .caja-c{width:100%;max-width:380px;padding:30px 26px 26px;border-radius:18px;background:#fffcf6;border:1px solid #d9cfbf;box-shadow:0 20px 50px rgba(0,0,0,.12);text-align:center}",
    "#candado .icono{width:52px;height:52px;margin:0 auto 14px;display:grid;place-items:center;border-radius:50%;background:#f3dccd}",
    "#candado h1{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-weight:600;font-size:1.5rem;margin:0 0 6px;color:#1f2430}",
    "#candado p{margin:0 0 18px;color:#5d5a55;font-size:.95rem}",
    "#candado label.et{display:block;text-align:left;font-size:.8rem;font-weight:600;color:#5d5a55;margin-bottom:6px}",
    "#candado .fila{position:relative}",
    "#candado input[type=password],#candado input[type=text]{width:100%;font:inherit;font-size:1rem;padding:12px 74px 12px 14px;border-radius:10px;border:1px solid #d9cfbf;background:#f4efe6;color:#1f2430}",
    "#candado input:focus{outline:3px solid #b4532a;outline-offset:1px}",
    "#candado .ver{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#b4532a;font:inherit;font-size:.85rem;font-weight:600;padding:8px;cursor:pointer}",
    "#candado .recordar{display:flex;align-items:center;gap:8px;margin:12px 0 0;font-size:.85rem;color:#5d5a55;text-align:left;cursor:pointer}",
    "#candado .recordar input{width:16px;height:16px;accent-color:#b4532a}",
    "#candado button.entrar{width:100%;margin-top:14px;padding:12px;border:0;border-radius:10px;background:#b4532a;color:#fff;font:inherit;font-weight:700;font-size:1rem;cursor:pointer}",
    "#candado button.entrar:disabled{opacity:.6;cursor:progress}",
    "#candado .error{min-height:1.4em;margin:12px 0 0;color:#a8322d;font-size:.9rem;font-weight:600}",
    "#candado{color-scheme:light}"
  ].join("");
  document.head.appendChild(estilo);

  function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function hex(h) { var u = new Uint8Array(h.length / 2); for (var i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16); return u; }
  function aB64(buf) { var u = new Uint8Array(buf), s = ""; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function leer(k) { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v, recordar) { try { sessionStorage.setItem(k, v); if (recordar) localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function olvidar() { try { sessionStorage.removeItem(LLAVE_KEY); localStorage.removeItem(LLAVE_KEY); } catch (e) { /* nada */ } }

  function cargarManifiesto() {
    return fetchOriginal(new URL("cifrado/manifiesto.json?t=" + Date.now(), BASE).href, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("manifiesto " + r.status); return r.json(); });
  }
  function comprobar(k) {
    var c = b64(manifiesto.comprobacion);
    return sutil.decrypt({ name: "AES-GCM", iv: c.slice(0, 12) }, k, c.slice(12)).then(function () { return k; });
  }
  function derivar(clave) {
    return sutil.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, ["deriveKey"]).then(function (mat) {
      return sutil.deriveKey({ name: "PBKDF2", salt: hex(manifiesto.sal), iterations: manifiesto.iteraciones, hash: "SHA-256" },
        mat, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
    });
  }
  function importar(raw) { return sutil.importKey("raw", b64(raw), { name: "AES-GCM" }, true, ["decrypt"]); }

  function rutaCifrada(input) {
    try {
      var u = new URL(typeof input === "string" ? input : input.url, location.href);
      if (u.origin !== BASE.origin || u.pathname.indexOf(BASE.pathname) !== 0) return null;
      var rel = u.pathname.slice(BASE.pathname.length);
      return /^(datos_redes\.json|datos\/[^\/]+\.json)$/.test(rel) ? rel : null;
    } catch (e) { return null; }
  }
  function gunzip(buf) {
    if (!window.DecompressionStream) throw new Error("navegador sin DecompressionStream");
    return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  function fetchCifrado(input, init) {
    var rel = rutaCifrada(input);
    if (!rel || !llave) return fetchOriginal(input, init);
    return fetchOriginal(new URL("cifrado/" + rel + ".enc?t=" + Date.now(), BASE).href, { cache: "no-store" }).then(function (r) {
      if (!r.ok) return new Response(null, { status: r.status, statusText: "sin datos cifrados" });
      return r.arrayBuffer().then(function (ab) {
        var u = new Uint8Array(ab);
        return sutil.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, llave, u.slice(12));
      }).then(gunzip).then(function (txt) {
        return new Response(txt, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } });
      });
    });
  }

  function abrir(k) {
    llave = k;
    window.fetch = fetchCifrado;
    var c = document.getElementById("candado"); if (c) c.remove();
    document.documentElement.classList.remove("bloqueado");
    (function siguiente(i) {
      if (i >= ARRANCAR.length) return;
      var s = document.createElement("script");
      s.src = ARRANCAR[i]; s.onload = function () { siguiente(i + 1); };
      document.body.appendChild(s);
    })(0);
  }

  function pintarFormulario(mensaje) {
    var d = document.createElement("div");
    d.id = "candado";
    d.innerHTML = '<main class="caja-c"><div class="icono" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b4532a" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>' +
      '<h1>Página privada</h1><p>Escribe la contraseña para verla.</p>' +
      '<form id="c-form" autocomplete="off"><label class="et" for="c-clave">Contraseña</label><div class="fila">' +
      '<input id="c-clave" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required autofocus>' +
      '<button class="ver" type="button" id="c-ver" aria-label="Mostrar u ocultar la contraseña">Ver</button></div>' +
      '<label class="recordar"><input type="checkbox" id="c-recordar"> Recordar en este equipo</label>' +
      '<button class="entrar" type="submit" id="c-entrar">Entrar</button><p class="error" id="c-error" role="alert"></p></form>' +
      '<noscript>Hace falta JavaScript para abrir esta página.</noscript></main>';
    document.body.appendChild(d);
    var campo = d.querySelector("#c-clave"), boton = d.querySelector("#c-entrar"), error = d.querySelector("#c-error");
    if (mensaje) error.textContent = mensaje;
    d.querySelector("#c-ver").addEventListener("click", function () {
      campo.type = campo.type === "password" ? "text" : "password";
      this.textContent = campo.type === "password" ? "Ver" : "Ocultar"; campo.focus();
    });
    d.querySelector("#c-form").addEventListener("submit", function (e) {
      e.preventDefault(); error.textContent = "";
      var clave = campo.value.normalize("NFC").trim();
      if (!clave) return;
      boton.disabled = true; boton.textContent = "Abriendo…";
      var recordar = d.querySelector("#c-recordar").checked;
      (manifiesto ? Promise.resolve() : cargarManifiesto().then(function (m) { manifiesto = m; }))
        .then(function () { return derivar(clave); }).then(comprobar)
        .then(function (k) { return sutil.exportKey("raw", k).then(function (raw) { guardar(LLAVE_KEY, aB64(raw), recordar); return k; }); })
        .then(abrir)
        .catch(function (err) {
          boton.disabled = false; boton.textContent = "Entrar";
          error.textContent = !sutil ? "Este navegador no puede abrir la página. Prueba con uno actualizado."
            : err && /manifiesto/.test(err.message) ? "No se han podido cargar los datos. Prueba otra vez en un momento." : "Contraseña incorrecta.";
          campo.select();
        });
    });
  }

  window.panelPrivado = { salir: function () { olvidar(); location.reload(); } };

  function iniciar() {
    if (!sutil) { pintarFormulario("Este navegador no puede abrir la página. Prueba con uno actualizado."); return; }
    var guardada = leer(LLAVE_KEY);
    cargarManifiesto().then(function (m) {
      manifiesto = m;
      if (!guardada) { pintarFormulario(); return; }
      return importar(guardada).then(comprobar).then(abrir).catch(function () { olvidar(); pintarFormulario(); });
    }).catch(function () { pintarFormulario(); });
  }
  if (document.body) iniciar(); else document.addEventListener("DOMContentLoaded", iniciar);
})();
