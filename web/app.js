/* 11 Ideal Argentina: armado con presupuesto (mercado tipo Gran DT), recomendador y simulacion. */
(function () {
  "use strict";

  var M = window.MotorOnceIdeal;
  var JUG = window.JUGADORES || [];
  var TORNEO = M.torneosDisponibles(JUG)[0];
  var POOL = M.jugadoresDeTorneo(JUG, TORNEO);
  var ETIQUETA_POS = { ARQ: "Arquero", DEF: "Defensor", VOL: "Volante", DEL: "Delantero" };
  var PLURAL_POS = { ARQ: "arqueros", DEF: "defensores", VOL: "volantes", DEL: "delanteros" };
  var PORCENTAJE_PRESUPUESTO = 0.6;

  // Formaciones disponibles (siempre 1 arquero). El banco es fijo: 7 suplentes (reglamento LPF).
  var FORMACIONES = {
    "4-3-3": { DEF: 4, VOL: 3, DEL: 3 },
    "4-4-2": { DEF: 4, VOL: 4, DEL: 2 },
    "4-2-3-1": { DEF: 4, VOL: 5, DEL: 1 },
    "3-5-2": { DEF: 3, VOL: 5, DEL: 2 },
    "3-4-3": { DEF: 3, VOL: 4, DEL: 3 },
    "5-3-2": { DEF: 5, VOL: 3, DEL: 2 }
  };

  // Colores aproximados de cada club para la camiseta de la lista (primario, secundario).
  var COLORES = {
    "Aldosivi": ["#1f8f4f", "#f5c542"], "Argentinos Juniors": ["#d62828", "#ffffff"], "Atlético Tucumán": ["#75aadb", "#ffffff"],
    "Banfield": ["#1f8f4f", "#ffffff"], "Barracas Central": ["#d62828", "#ffffff"], "Belgrano": ["#75aadb", "#0b2a4a"],
    "Boca Juniors": ["#0b3d91", "#f5c542"], "Central Córdoba (SE)": ["#111111", "#ffffff"], "Defensa y Justicia": ["#f5c542", "#1f8f4f"],
    "Dep. Riestra": ["#111111", "#ffffff"], "Estudiantes": ["#d62828", "#ffffff"], "Estudiantes (RC)": ["#75aadb", "#ffffff"],
    "Gimnasia": ["#ffffff", "#0b2a6f"], "Gimnasia (Mendoza)": ["#ffffff", "#111111"], "Huracán": ["#ffffff", "#d62828"],
    "Independiente": ["#d62828", "#d62828"], "Independiente Riv. (M)": ["#0b3d91", "#ffffff"], "Instituto": ["#d62828", "#ffffff"],
    "Lanús": ["#7a1f2b", "#7a1f2b"], "Newell`s": ["#d62828", "#111111"], "Platense": ["#ffffff", "#5a3a1a"],
    "Racing Club": ["#75aadb", "#ffffff"], "River Plate": ["#ffffff", "#d62828"], "Rosario Central": ["#0b3d91", "#f5c542"],
    "San Lorenzo": ["#0b2a6f", "#d62828"], "Sarmiento": ["#1f8f4f", "#ffffff"], "Talleres": ["#0b2a6f", "#ffffff"],
    "Tigre": ["#0b3d91", "#d62828"], "Unión": ["#d62828", "#ffffff"], "Vélez": ["#ffffff", "#0b3d91"]
  };

  // Criterios del recomendador (solo datos reales de AFA y de FIFA).
  var CRITERIOS = {
    ARQ: [["atajadas", "Más atajadas"], ["puntaje", "Mejor puntaje FIFA"], ["minutos", "Más minutos de juego"], ["relacion", "Mejor puntaje por precio"]],
    DEF: [["goles", "Más goleadores"], ["tarjetas", "Menos tarjetas recibidas"], ["minutos", "Más minutos de juego"], ["puntaje", "Mejor puntaje FIFA"]],
    VOL: [["goles", "Más goleadores"], ["asistencias", "Más asistencias"], ["minutos", "Más minutos de juego"], ["puntaje", "Mejor puntaje FIFA"]],
    DEL: [["goles", "Más goleadores"], ["asistencias", "Más asistencias"], ["puntaje", "Mejor puntaje FIFA"], ["relacion", "Mejor puntaje por precio"]]
  };

  var VELOCIDADES = { real: 60000, x2: 30000, x4: 15000 };
  var NOMBRE_VEL = { real: "Tiempo real", x2: "2x", x4: "4x" };

  var estado = {
    formacion: "4-3-3",
    titulares: [],
    suplentes: [],
    presupuestoTotal: 0,
    casilleroMercado: null,
    seleccion: null,
    filtros: { pos: "", texto: "", orden: "puntaje", club: "", min: "", max: "", presupuesto: false },
    res: null,
    modo: "rapida",
    lenta: { indice: 0, minuto: 0, velocidad: "x4", timer: null, pausado: false },
    rec: { paso: 1, pos: null, criterio: null }
  };

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    disponible: $("presupuesto-disponible"), total: $("presupuesto-total"),
    cancha: $("cancha"), banco: $("banco"), progreso: $("progreso"), progresoBarra: $("progreso-barra"),
    formacion: $("formacion"), mercado: $("mercado"), mercadoPres: $("mercado-presupuesto"), mercadoJug: $("mercado-jugadores"),
    vistaLista: $("mercado-vista-lista"), vistaFiltros: $("mercado-vista-filtros"),
    mercadoTitulo: $("mercado-titulo"), mercadoFicha: $("mercado-ficha"), buscar: $("mercado-buscar"),
    chipsPos: $("chips-pos"), chipsActivos: $("chips-activos"), lista: $("mercado-lista"),
    fOrden: $("filtro-orden"), fClub: $("filtro-club"), fMin: $("filtro-min"), fMax: $("filtro-max"), fPres: $("filtro-presupuesto"),
    simular: $("simular"), resultado: $("resultado"),
    rec: $("recomendador"), recTitulo: $("rec-titulo"), recAyuda: $("rec-ayuda"), recOpciones: $("rec-opciones"), recAtras: $("rec-atras")
  };

  // ---------- Utilidades ----------
  function esc(t) {
    return String(t === null || t === undefined ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function euros(v) {
    if (!v && v !== 0) return "-";
    if (v >= 1e6) return "€" + (v / 1e6).toFixed(1).replace(".", ",") + "M";
    if (v >= 1e3) return "€" + Math.round(v / 1e3) + "K";
    return "€" + v;
  }
  function puntaje(j) { return Math.round(j.promedio); }
  function sinAcentos(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function nombreCorto(nombre) {
    var p = String(nombre).trim().split(/\s+/);
    if (p.length < 2) return nombre;
    var resto = p.slice(1).join(" ");
    if (resto.length > 13) resto = p[p.length - 1];
    return p[0].charAt(0) + ". " + resto;
  }
  function estadoJugador(j) {
    if (!j.partidos) return ["Sin minutos", "gris"];
    var r = (j.titulares || 0) / j.partidos;
    if (r >= 0.7) return ["Titular", "verde"];
    if (r >= 0.3) return ["Alterna", "amarillo"];
    return ["Suplente", "rojo"];
  }
  function camisetaHTML(colores, clase) {
    var c1 = colores ? colores[0] : "#4a505a", c2 = colores ? colores[1] : "#4a505a";
    return "<svg class=\"" + (clase || "camiseta") + "\" viewBox=\"0 0 40 36\" aria-hidden=\"true\">" +
      "<path d=\"M13 2 L4 7 L0 16 L7 18 L9 14 L9 34 L31 34 L31 14 L33 18 L40 16 L36 7 L27 2 Q20 7 13 2 Z\" fill=\"" + c1 + "\" stroke=\"rgba(0,0,0,.35)\" stroke-width=\"1\"/>" +
      "<rect x=\"17\" y=\"8\" width=\"6\" height=\"26\" fill=\"" + c2 + "\" opacity=\"0.9\"/></svg>";
  }

  // ---------- Presupuesto ----------
  function calcularPresupuesto() {
    var costo = 0;
    var cupos = { ARQ: 1 + M.BANCO.ARQ, DEF: 4 + M.BANCO.DEF, VOL: 3 + M.BANCO.VOL, DEL: 3 + M.BANCO.DEL };
    M.POSICIONES.forEach(function (pos) {
      POOL.filter(function (j) { return j.pos === pos; }).sort(function (a, b) { return b.promedio - a.promedio; })
        .slice(0, cupos[pos]).forEach(function (j) { costo += j.valor || 0; });
    });
    return Math.round(costo * PORCENTAJE_PRESUPUESTO);
  }
  function todosLosCasilleros() { return estado.titulares.concat(estado.suplentes); }
  function gastado() { return todosLosCasilleros().reduce(function (s, c) { return s + (c.jugador ? c.jugador.valor || 0 : 0); }, 0); }
  function disponible() { return estado.presupuestoTotal - gastado(); }
  function nombresUsados(excepto) {
    var u = {};
    todosLosCasilleros().forEach(function (c) { if (c !== excepto && c.jugador) u[c.jugador.jugador] = true; });
    return u;
  }

  // ---------- Casilleros y formacion ----------
  function crearTitulares(formacion, anteriores) {
    var f = FORMACIONES[formacion];
    var cupos = { ARQ: 1, DEF: f.DEF, VOL: f.VOL, DEL: f.DEL };
    var porPos = { ARQ: [], DEF: [], VOL: [], DEL: [] };
    (anteriores || []).forEach(function (c) { if (c.jugador) porPos[c.pos].push(c.jugador); });
    var titulares = [], sobrantes = [];
    M.POSICIONES.forEach(function (pos) {
      for (var i = 0; i < cupos[pos]; i++) titulares.push({ pos: pos, jugador: porPos[pos][i] || null });
      sobrantes = sobrantes.concat(porPos[pos].slice(cupos[pos]));
    });
    return { titulares: titulares, sobrantes: sobrantes };
  }

  function crearCasilleros() {
    estado.titulares = crearTitulares(estado.formacion).titulares;
    estado.suplentes = [];
    M.POSICIONES.forEach(function (pos) {
      for (var k = 0; k < M.BANCO[pos]; k++) estado.suplentes.push({ pos: pos, jugador: null });
    });
  }

  // Al cambiar de formacion se conservan los jugadores; los que sobran pasan al banco (o se venden si no hay lugar).
  function cambiarFormacion(nueva) {
    var r = crearTitulares(nueva, estado.titulares);
    estado.formacion = nueva;
    estado.titulares = r.titulares;
    var vendidos = [];
    r.sobrantes.forEach(function (j) {
      var libre = estado.suplentes.filter(function (c) { return c.pos === j.pos && !c.jugador; })[0];
      if (libre) libre.jugador = j; else vendidos.push(j.jugador);
    });
    render();
    if (vendidos.length) alert("No había lugar en el banco, se vendieron: " + vendidos.join(", "));
  }

  function botonCasillero(c) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "casillero" + (c.jugador ? " lleno" : "") + (estado.casilleroMercado === c ? " activo" : "");
    if (c.jugador) b.title = c.jugador.jugador;
    var html = "<span class=\"camiseta-wrap\">" + camisetaHTML(c.jugador ? COLORES[c.jugador.equipo] : null) + "</span>" +
      "<span class=\"pos\">" + esc(c.pos) + "</span>";
    html += c.jugador
      ? "<span class=\"nombre\">" + esc(nombreCorto(c.jugador.jugador)) + "</span><span class=\"puntos\">" + puntaje(c.jugador) + " · " + euros(c.jugador.valor) + "</span>"
      : "<span class=\"nombre\">＋ Fichar</span>";
    b.innerHTML = html;
    b.addEventListener("click", function () { seleccionarCasillero(c); });
    return b;
  }

  function render() {
    el.cancha.innerHTML = "";
    ["DEL", "VOL", "DEF", "ARQ"].forEach(function (pos) {
      var linea = document.createElement("div");
      var de = estado.titulares.filter(function (c) { return c.pos === pos; });
      linea.className = "linea";
      linea.style.gridTemplateColumns = "repeat(" + de.length + ", 1fr)";
      de.forEach(function (c) { linea.appendChild(botonCasillero(c)); });
      el.cancha.appendChild(linea);
    });
    el.banco.innerHTML = "";
    estado.suplentes.forEach(function (c) { el.banco.appendChild(botonCasillero(c)); });

    var t = estado.titulares.filter(function (c) { return c.jugador; }).length;
    var s = estado.suplentes.filter(function (c) { return c.jugador; }).length;
    el.progreso.textContent = "Titulares: " + t + "/11 · Suplentes: " + s + "/7";
    el.progresoBarra.textContent = "Titulares " + t + "/11 · " + euros(disponible());
    el.simular.disabled = t < 11;
    el.disponible.textContent = euros(disponible());
    el.disponible.classList.toggle("negativo", disponible() < 0);
    el.total.textContent = "de " + euros(estado.presupuestoTotal);
    el.mercadoPres.textContent = euros(disponible());
    el.mercadoJug.textContent = (t + s) + "/18";
    pintarLista();
  }

  // ---------- Mercado ----------
  function seleccionarCasillero(c) {
    estado.casilleroMercado = c;
    estado.seleccion = c.jugador || null;
    estado.filtros.pos = c.pos;
    mostrarVista("lista");
    abrirMercadoMovil();
    render();
    pintarFicha();
  }

  function abrirMercadoMovil() { document.body.classList.add("mercado-abierto"); }
  function cerrarMercadoMovil() { document.body.classList.remove("mercado-abierto"); }

  function mostrarVista(v) {
    el.vistaLista.hidden = v !== "lista";
    el.vistaFiltros.hidden = v !== "filtros";
  }

  // Casillero destino: el elegido si coincide la posicion; si no, el primer libre de esa posicion (titulares primero).
  function destinoPara(j) {
    var c = estado.casilleroMercado;
    if (c && c.pos === j.pos) return c;
    return estado.titulares.concat(estado.suplentes).filter(function (x) { return x.pos === j.pos && !x.jugador; })[0] || null;
  }
  function margenPara(c) { return disponible() + (c && c.jugador ? c.jugador.valor || 0 : 0); }

  function pintarFicha() {
    var j = estado.seleccion;
    if (!j) {
      var c = estado.casilleroMercado;
      el.mercadoFicha.innerHTML = c
        ? "<p class=\"ayuda\">Elegí un " + esc(ETIQUETA_POS[c.pos].toLowerCase()) + " de la lista. Podés gastar hasta " + euros(margenPara(c)) + ".</p>"
        : "";
      el.mercadoTitulo.textContent = c ? "Fichar " + ETIQUETA_POS[c.pos].toLowerCase() : "Seleccioná tus jugadores";
      return;
    }
    var dest = destinoPara(j);
    var yaEsta = todosLosCasilleros().some(function (x) { return x.jugador && x.jugador.jugador === j.jugador; });
    var alcanza = dest && (j.valor || 0) <= margenPara(dest);
    var st = estadoJugador(j);
    var html = "<div class=\"ruleta ficha-visor\"><div class=\"ficha\">" +
      "<div class=\"ficha-nombre\">" + esc(j.jugador) + "</div>" +
      "<div class=\"ficha-linea\"><span class=\"ficha-pos\">" + esc(ETIQUETA_POS[j.pos]) + "</span><span class=\"ficha-sigla\">" + esc(j.pos) + "</span>" +
      "<span class=\"badge " + st[1] + "\">" + st[0] + "</span></div>" +
      "<div class=\"ficha-linea ficha-equipo\">" + esc(j.equipo) + "</div>" +
      "<div class=\"ficha-valores\">" +
        "<div><span class=\"ficha-etiqueta\">Puntaje</span><strong class=\"ficha-numero\">" + puntaje(j) + "</strong></div>" +
        "<div><span class=\"ficha-etiqueta\">Global</span><strong class=\"ficha-numero\">" + (j.grl || "-") + "</strong></div>" +
        "<div><span class=\"ficha-etiqueta\">Potencial</span><strong class=\"ficha-numero\">" + (j.pot || "-") + "</strong></div>" +
      "</div><div class=\"ficha-datos\">" +
        "<div><span>Valor</span><strong>" + euros(j.valor) + "</strong></div>" +
        "<div><span>Partidos</span><strong>" + (j.partidos || 0) + "</strong></div>" +
        "<div><span>" + (j.pos === "ARQ" ? "Atajadas" : "Goles") + "</span><strong>" + (j.pos === "ARQ" ? (j.atajadas || 0) : (j.goles || 0)) + "</strong></div>" +
        "<div><span>Prom.</span><strong>" + (j.prom !== null && j.prom !== undefined ? String(j.prom).replace(".", ",") : "-") + "</strong></div>" +
      "</div></div></div><div class=\"acciones\">";
    if (yaEsta) {
      html += "<button type=\"button\" class=\"boton secundario\" data-accion=\"vender\">Vender (+" + euros(j.valor) + ")</button>";
    } else if (!dest) {
      html += "<button type=\"button\" class=\"boton principal\" disabled>No hay lugar libre de " + esc(j.pos) + "</button>";
    } else {
      html += "<button type=\"button\" class=\"boton principal\" data-accion=\"fichar\" " + (alcanza ? "" : "disabled") + ">" +
        (alcanza ? "Fichar por " + euros(j.valor) : "No alcanza el presupuesto") + "</button>";
    }
    html += "</div>";
    el.mercadoTitulo.textContent = "Ficha del jugador";
    el.mercadoFicha.innerHTML = html;
    var bf = el.mercadoFicha.querySelector("[data-accion=fichar]");
    if (bf) bf.addEventListener("click", function () { fichar(j); });
    var bv = el.mercadoFicha.querySelector("[data-accion=vender]");
    if (bv) bv.addEventListener("click", function () { vender(j); });
  }

  function fichar(j) {
    var dest = destinoPara(j);
    if (!dest || (j.valor || 0) > margenPara(dest)) return;
    dest.jugador = j;
    estado.seleccion = null;
    estado.casilleroMercado = null;
    cerrarMercadoMovil();
    render();
    pintarFicha();
  }

  function vender(j) {
    todosLosCasilleros().forEach(function (c) { if (c.jugador && c.jugador.jugador === j.jugador) c.jugador = null; });
    estado.seleccion = null;
    render();
    pintarFicha();
  }

  function valorOrden(j, orden) {
    switch (orden) {
      case "valor-asc": return -(j.valor || 0);
      case "valor-desc": return j.valor || 0;
      case "relacion": return j.promedio / Math.max(j.valor || 1, 100000) * 1e6;
      case "goles": return j.goles || 0;
      case "asistencias": return j.asistencias || 0;
      case "minutos": return j.minutos || 0;
      case "atajadas": return j.atajadas || 0;
      case "tarjetas": return -((j.amarillas || 0) + 3 * (j.rojas || 0));
      case "prom": return j.prom || 0;
      default: return j.promedio;
    }
  }

  function filtrar(f, extra) {
    var usados = nombresUsados(null);
    var texto = sinAcentos(f.texto);
    var min = f.min === "" ? null : parseFloat(f.min) * 1e6;
    var max = f.max === "" ? null : parseFloat(f.max) * 1e6;
    var lista = POOL.filter(function (j) {
      if (usados[j.jugador]) return false;
      if (f.pos && j.pos !== f.pos) return false;
      if (f.club && j.equipo !== f.club) return false;
      if (texto && sinAcentos(j.jugador).indexOf(texto) === -1) return false;
      if (min !== null && (j.valor || 0) < min) return false;
      if (max !== null && (j.valor || 0) > max) return false;
      if (f.presupuesto && (j.valor || 0) > disponible()) return false;
      if (extra && !extra(j)) return false;
      return true;
    });
    if (f.orden === "nombre") lista.sort(function (a, b) { return a.jugador.localeCompare(b.jugador); });
    else lista.sort(function (a, b) { return valorOrden(b, f.orden) - valorOrden(a, f.orden) || b.promedio - a.promedio; });
    return lista;
  }

  function filaJugador(j, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    var dest = destinoPara(j);
    var caro = !dest || (j.valor || 0) > margenPara(dest);
    var st = estadoJugador(j);
    b.className = "fila-gdt" + (caro ? " caro" : "") + (estado.seleccion === j ? " activa" : "");
    b.innerHTML = "<span class=\"fila-camiseta\">" + camisetaHTML(COLORES[j.equipo], "camiseta-mini") + "</span>" +
      "<span class=\"fila-info\"><strong>" + esc(j.jugador) + "</strong>" +
      "<small>" + esc(j.pos) + " · " + esc(j.equipo) + "</small>" +
      "<span class=\"fila-precio\">" + euros(j.valor) + " <span class=\"badge " + st[1] + "\">" + st[0] + "</span></span></span>" +
      "<span class=\"fila-num verde\">" + puntaje(j) + "</span>" +
      "<span class=\"fila-num\">" + (j.prom !== null && j.prom !== undefined ? String(Math.round(j.prom * 10) / 10).replace(".", ",") : "-") + "</span>";
    b.addEventListener("click", onClick);
    return b;
  }

  var NOMBRES_ORDEN = { puntaje: "Mayor puntaje", "valor-asc": "Más baratos", "valor-desc": "Más caros", relacion: "Puntaje por precio",
    goles: "Más goleadores", asistencias: "Más asistencias", minutos: "Más minutos", prom: "Mayor promedio", nombre: "Nombre" };

  function pintarChips() {
    el.chipsPos.querySelectorAll("[data-pos]").forEach(function (b) {
      b.classList.toggle("activo", b.getAttribute("data-pos") === estado.filtros.pos);
    });
    var f = estado.filtros, chips = [];
    if (f.orden !== "puntaje") chips.push(["orden", NOMBRES_ORDEN[f.orden]]);
    if (f.club) chips.push(["club", f.club]);
    if (f.min !== "" || f.max !== "") chips.push(["precio", "€" + (f.min || 0) + "M – " + (f.max ? "€" + f.max + "M" : "máx.")]);
    if (f.presupuesto) chips.push(["presupuesto", "Dentro del presupuesto"]);
    el.chipsActivos.innerHTML = chips.map(function (c) {
      return "<button type=\"button\" class=\"chip\" data-quitar=\"" + c[0] + "\">" + esc(c[1]) + " ✕</button>";
    }).join("");
    el.chipsActivos.querySelectorAll("[data-quitar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-quitar");
        if (k === "orden") f.orden = "puntaje";
        if (k === "club") f.club = "";
        if (k === "precio") { f.min = ""; f.max = ""; }
        if (k === "presupuesto") f.presupuesto = false;
        pintarLista();
      });
    });
  }

  function pintarLista() {
    pintarChips();
    var lista = filtrar(estado.filtros);
    el.lista.innerHTML = "";
    lista.slice(0, 150).forEach(function (j) {
      el.lista.appendChild(filaJugador(j, function () { estado.seleccion = j; pintarFicha(); pintarLista(); el.mercado.scrollTop = 0; }));
    });
    var p = document.createElement("p");
    p.className = "ayuda";
    p.textContent = lista.length > 150 ? "Mostrando 150 de " + lista.length + ". Usá el buscador o los filtros." : lista.length + " jugadores";
    el.lista.appendChild(p);
  }

  function poblarSelects() {
    var equipos = [];
    POOL.forEach(function (j) { if (equipos.indexOf(j.equipo) === -1) equipos.push(j.equipo); });
    equipos.sort();
    el.fClub.innerHTML = "<option value=\"\">Todos los clubes</option>" + equipos.map(function (e) { return "<option>" + esc(e) + "</option>"; }).join("");
    el.formacion.innerHTML = Object.keys(FORMACIONES).map(function (k) { return "<option>" + k + "</option>"; }).join("");
    el.formacion.value = estado.formacion;
  }

  function abrirFiltros() {
    var f = estado.filtros;
    el.fOrden.value = f.orden; el.fClub.value = f.club; el.fMin.value = f.min; el.fMax.value = f.max; el.fPres.checked = f.presupuesto;
    mostrarVista("filtros");
  }
  function aplicarFiltros() {
    var f = estado.filtros;
    f.orden = el.fOrden.value; f.club = el.fClub.value; f.min = el.fMin.value; f.max = el.fMax.value; f.presupuesto = el.fPres.checked;
    mostrarVista("lista");
    pintarLista();
  }
  function borrarFiltros() {
    estado.filtros = { pos: "", texto: "", orden: "puntaje", club: "", min: "", max: "", presupuesto: false };
    el.buscar.value = "";
    abrirFiltros();
  }

  // ---------- Recomendador ----------
  function abrirRecomendador() { estado.rec = { paso: 1, pos: null, criterio: null }; el.rec.hidden = false; pintarRecomendador(); }
  function cerrarRecomendador() { el.rec.hidden = true; }

  function pintarRecomendador() {
    var r = estado.rec, html = "";
    el.recAtras.hidden = r.paso === 1;
    if (r.paso === 1) {
      el.recTitulo.textContent = "¿Qué estás necesitando?";
      el.recAyuda.textContent = "El recomendador te ayuda a completar tu equipo.";
      html = M.POSICIONES.map(function (p) {
        var libres = todosLosCasilleros().filter(function (c) { return c.pos === p && !c.jugador; }).length;
        return "<button type=\"button\" class=\"rec-opcion\" data-pos=\"" + p + "\">" + PLURAL_POS[p].charAt(0).toUpperCase() + PLURAL_POS[p].slice(1) +
          "<small>" + libres + " lugares libres</small></button>";
      }).join("");
    } else if (r.paso === 2) {
      el.recTitulo.textContent = "¿Qué tipo de " + PLURAL_POS[r.pos] + " buscás?";
      el.recAyuda.textContent = "Te mostramos los 5 mejores que entran en tu presupuesto.";
      html = CRITERIOS[r.pos].map(function (c) {
        return "<button type=\"button\" class=\"rec-opcion\" data-criterio=\"" + c[0] + "\">" + c[1] + "</button>";
      }).join("");
    } else {
      var nombre = CRITERIOS[r.pos].filter(function (c) { return c[0] === r.criterio; })[0][1];
      el.recTitulo.textContent = nombre;
      var dest = destinoPara({ pos: r.pos });
      if (!dest) {
        el.recAyuda.textContent = "No te quedan lugares libres de " + ETIQUETA_POS[r.pos].toLowerCase() + ". Vendé uno para fichar otro.";
        el.recOpciones.innerHTML = "";
        return;
      }
      var lista = filtrar({ pos: r.pos, texto: "", orden: r.criterio, club: "", min: "", max: "", presupuesto: true }).slice(0, 5);
      el.recAyuda.textContent = lista.length ? "Tocá uno para ver su ficha y ficharlo." : "No hay jugadores que entren en tu presupuesto.";
      el.recOpciones.innerHTML = "";
      lista.forEach(function (j) {
        el.recOpciones.appendChild(filaJugador(j, function () {
          cerrarRecomendador();
          estado.casilleroMercado = null;
          estado.filtros.pos = j.pos;
          estado.seleccion = j;
          mostrarVista("lista");
          abrirMercadoMovil();
          pintarFicha();
          pintarLista();
          el.mercado.scrollTop = 0;
        }));
      });
      return;
    }
    el.recOpciones.innerHTML = html;
    el.recOpciones.querySelectorAll("[data-pos]").forEach(function (b) {
      b.addEventListener("click", function () { r.pos = b.getAttribute("data-pos"); r.paso = 2; pintarRecomendador(); });
    });
    el.recOpciones.querySelectorAll("[data-criterio]").forEach(function (b) {
      b.addEventListener("click", function () { r.criterio = b.getAttribute("data-criterio"); r.paso = 3; pintarRecomendador(); });
    });
  }

  // ---------- Equipo al azar dentro del presupuesto ----------
  function armarAlAzar() {
    var slots = todosLosCasilleros();
    slots.forEach(function (c) { c.jugador = null; });
    var usados = {}, restante = estado.presupuestoTotal;
    function costoMinimo(pos) {
      var min = Infinity;
      POOL.forEach(function (j) { if (j.pos === pos && !usados[j.jugador] && (j.valor || 0) < min) min = j.valor || 0; });
      return min === Infinity ? 0 : min;
    }
    for (var i = 0; i < slots.length; i++) {
      var c = slots[i], reserva = 0;
      for (var k = i + 1; k < slots.length; k++) reserva += costoMinimo(slots[k].pos);
      var tope = restante - reserva;
      var cand = POOL.filter(function (j) { return j.pos === c.pos && !usados[j.jugador] && (j.valor || 0) <= tope; });
      if (!cand.length) cand = POOL.filter(function (j) { return j.pos === c.pos && !usados[j.jugador]; })
        .sort(function (a, b) { return (a.valor || 0) - (b.valor || 0); }).slice(0, 1);
      if (!cand.length) continue;
      var e = cand[Math.floor(Math.random() * cand.length)];
      c.jugador = e; usados[e.jugador] = true; restante -= e.valor || 0;
    }
    estado.casilleroMercado = null; estado.seleccion = null;
    render(); pintarFicha();
  }

  function vaciarEquipo() {
    todosLosCasilleros().forEach(function (c) { c.jugador = null; });
    estado.casilleroMercado = null; estado.seleccion = null;
    render(); pintarFicha();
  }

  // ---------- Simulacion ----------
  function simular() {
    var titulares = estado.titulares.map(function (c) { return c.jugador; });
    if (titulares.some(function (j) { return !j; })) return;
    var excluidos = {};
    todosLosCasilleros().forEach(function (c) { if (c.jugador) excluidos[c.jugador.jugador] = true; });
    var clubes = M.construirClubes(JUG, TORNEO, excluidos);
    var banco = estado.suplentes.map(function (c) { return c.jugador; }).filter(Boolean);
    var nuestro = { nombre: "Nosotros", esNuestro: true, once: titulares, banco: banco, puntaje: M.puntajeOnce(titulares) };
    detenerReloj();
    estado.res = M.simularTorneo({ clubes: clubes, nuestro: nuestro, rng: M.crearRng((Date.now() ^ 0x9e3779b9) >>> 0) });
    estado.modo = "rapida";
    estado.lenta = { indice: 0, minuto: 0, velocidad: "x4", timer: null, pausado: false, pestana: "relato" };
    el.resultado.hidden = false;
    pintarResultado();
    el.resultado.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pintarResultado() {
    detenerReloj();
    var barra = "<div class=\"modos\">" +
      "<button type=\"button\" class=\"boton " + (estado.modo === "rapida" ? "principal" : "secundario") + "\" data-modo=\"rapida\">Simulación rápida</button>" +
      "<button type=\"button\" class=\"boton " + (estado.modo === "lenta" ? "principal" : "secundario") + "\" data-modo=\"lenta\">Simulación lenta</button></div>";
    el.resultado.innerHTML = barra + (estado.modo === "rapida" ? renderRapida(estado.res) : renderLenta());
    el.resultado.querySelectorAll("[data-modo]").forEach(function (b) {
      b.addEventListener("click", function () { estado.modo = b.getAttribute("data-modo"); pintarResultado(); });
    });
    if (estado.modo === "lenta") prepararLenta();
    else {
      var lista = partidosNuestros(estado.res);
      el.resultado.querySelectorAll("[data-partido]").forEach(function (b) {
        b.addEventListener("click", function () { abrirFicha(lista[+b.getAttribute("data-partido")]); });
      });
    }
  }

  function renderRapida(res) {
    var html = "<div class=\"resumen\"><div class=\"grande\">Puesto " + res.nuestraPosicion + " de " + res.tabla.length + "</div>" +
      "<div class=\"sub\">" + esc(res.nuestroResultado.charAt(0).toUpperCase() + res.nuestroResultado.slice(1)) + "</div>";
    if (res.campeon) html += "<div class=\"sub\">Campeón: " + esc(res.campeon) + " · Subcampeón: " + esc(res.subcampeon) + " · Tercero: " + esc(res.tercero) + "</div>";
    html += "</div><h3>Tabla final</h3><div class=\"tabla-wrap\"><table><thead><tr>" +
      "<th>Pos</th><th class=\"equipo\">Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>Pts</th><th>Puntaje</th></tr></thead><tbody>";
    res.tabla.forEach(function (f, i) {
      var clases = [f.equipo.esNuestro ? "nosotros" : "", i < M.CONFIG.clasificados ? "clasifica" : "no-clasifica"].join(" ");
      html += "<tr class=\"" + clases + "\"><td class=\"pos\">" + (i + 1) + "</td><td class=\"equipo\">" + esc(f.equipo.nombre) + "</td>" +
        "<td>" + f.pj + "</td><td>" + f.pg + "</td><td>" + f.pe + "</td><td>" + f.pp + "</td><td><strong>" + f.pts + "</strong></td><td>" + Math.round(f.equipo.puntaje) + "</td></tr>";
    });
    html += "</tbody></table></div><h3>Nuestros partidos</h3><p class=\"ayuda\">Tocá un partido para ver el relato, las estadísticas y las formaciones.</p><div class=\"nuestros-partidos\">";
    partidosNuestros(res).forEach(function (item, i) {
      var p = item.partido, dif = p.local === "Nosotros" ? p.golesL - p.golesV : p.golesV - p.golesL;
      var r = dif > 0 ? ["G", "gana"] : dif < 0 ? ["P", "pierde"] : ["E", "empata"];
      html += "<button type=\"button\" class=\"fila-partido\" data-partido=\"" + i + "\"><span class=\"res-letra " + r[1] + "\">" + r[0] + "</span>" +
        "<span class=\"fila-partido-titulo\">" + esc(item.titulo) + "</span><span class=\"fila-partido-marcador\">" + esc(p.local) + " <strong>" + p.golesL +
        " - " + p.golesV + "</strong> " + esc(p.visitante) + "</span><span class=\"fila-partido-ir\" aria-hidden=\"true\">›</span></button>";
    });
    html += "</div><h3>Cuadro final</h3><div class=\"cuadro\">";
    if (!res.clasificamos) html += "<p class=\"ayuda\">No clasificamos al cuadro (quedamos fuera de los 16 mejores).</p>";
    res.rondas.forEach(function (ronda) {
      html += "<h3>" + esc(ronda.nombre) + "</h3>";
      ronda.llaves.forEach(function (l) {
        html += "<div class=\"llave" + (l.equipos.indexOf("Nosotros") !== -1 ? " nosotros" : "") + "\"><div>" + esc(l.equipos[0]) + " vs " + esc(l.equipos[1]) + "</div>";
        (l.ida ? [l.ida, l.vuelta] : [l.partido]).forEach(function (p) {
          if (p) html += "<div class=\"detalle\">" + esc(p.local) + " " + p.golesL + " - " + p.golesV + " " + esc(p.visitante) + "</div>";
        });
        html += "<div class=\"gana\">Pasa: " + esc(l.ganador) + "</div></div>";
      });
    });
    return html + "</div>";
  }

  // ---------- Simulacion lenta: partido a partido con relato ----------
  function partidosNuestros(res) {
    var lista = [];
    res.partidos.forEach(function (p) {
      if (p.local === "Nosotros" || p.visitante === "Nosotros") lista.push({ titulo: "Fecha " + p.fecha, partido: p, fecha: p.fecha });
    });
    res.rondas.forEach(function (r) {
      r.llaves.forEach(function (l) {
        if (l.equipos.indexOf("Nosotros") === -1) return;
        if (l.ida) {
          lista.push({ titulo: r.nombre + " · Ida", partido: l.ida });
          lista.push({ titulo: r.nombre + " · Vuelta", partido: l.vuelta, ganadorLlave: l.ganador });
        } else lista.push({ titulo: r.nombre, partido: l.partido, ganadorLlave: l.ganador });
      });
    });
    return lista;
  }

  // ---------- Relato, estadisticas y formaciones de un partido ----------
  var R = window.RelatoOnceIdeal;
  var ICONO = { gol: "⚽", atajada: "🧤", palo: "🥅", afuera: "↗", corner: "⛳", offside: "🚩", baja: "🚫", amarilla: "🟨", roja: "🟥", inicio: "▶", pausa: "⏸", final: "🏁" };
  var PESTANAS = [["relato", "Relato"], ["estadisticas", "Estadísticas"], ["formaciones", "Formaciones"]];
  var FILAS_STATS = [
    ["remates", "Remates"], ["alArco", "Remates al arco"], ["atajadas", "Atajadas"], ["corners", "Córners"],
    ["faltas", "Faltas"], ["offsides", "Offsides"], ["amarillas", "Amarillas"], ["rojas", "Rojas"]
  ];

  function relatoDe(p) {
    if (!p._relato) {
      var aL = p.alineacionL || estado.res.equipos[p.local], aV = p.alineacionV || estado.res.equipos[p.visitante];
      p._relato = R.generar(p, aL, aV);
      p._relato.alineaciones = {};
      p._relato.alineaciones[p.local] = aL;
      p._relato.alineaciones[p.visitante] = aV;
    }
    return p._relato;
  }
  // El relato hasta un minuto dado (para el partido en vivo).
  function recorte(rel, minuto) {
    return { lineas: rel.lineas.filter(function (l) { return l.minuto <= minuto; }), local: rel.local, visitante: rel.visitante, posesionL: rel.posesionL, alineaciones: rel.alineaciones };
  }
  function colorEquipo(nombre) {
    if (nombre === "Nosotros") return ["#2ecc71", "#0e0f12"];
    return COLORES[nombre] || ["#4a505a", "#ffffff"];
  }
  function etiquetaEquipo(nombre) {
    var c = colorEquipo(nombre);
    var claro = /^#(f|e|d|7|2e)/i.test(c[0]);
    return "<span class=\"tag-equipo\" style=\"background:" + c[0] + ";color:" + (claro ? "#111" : "#fff") + "\">" + esc(nombre) + "</span>";
  }

  function pestanasHTML(activa) {
    return "<div class=\"pestanas\" role=\"tablist\">" + PESTANAS.map(function (t) {
      return "<button type=\"button\" role=\"tab\" class=\"pestana" + (t[0] === activa ? " activa" : "") + "\" data-pestana=\"" + t[0] +
        "\" aria-selected=\"" + (t[0] === activa) + "\">" + t[1] + "</button>";
    }).join("") + "</div>";
  }

  function relatoHTML(rel, extras) {
    var lineas = rel.lineas.filter(function (l) { return !l.silencioso; }).concat(extras || []);
    lineas.sort(function (a, b) { return a.minuto - b.minuto || a.orden - b.orden; });
    return "<div class=\"relato-lista\">" + lineas.reverse().map(function (l) {
      return "<div class=\"evento " + l.tipo + "\"><span class=\"ev-min\">" + l.minuto + "'</span><span class=\"ev-ico\">" + (ICONO[l.tipo] || "") + "</span>" +
        "<span class=\"ev-texto\">" + (l.equipo ? etiquetaEquipo(l.equipo) + " " : "") + esc(l.texto) + "</span></div>";
    }).join("") + "</div>";
  }

  function filaStat(nombre, tL, tV, vL, vV) {
    var tot = vL + vV, pL = tot ? vL / tot * 100 : 50;
    var gL = vL > vV ? " gana" : "", gV = vV > vL ? " gana" : "";
    return "<div class=\"stat\"><div class=\"stat-nums\"><span class=\"" + gL + "\">" + tL + "</span><span class=\"stat-nombre\">" + nombre +
      "</span><span class=\"" + gV + "\">" + tV + "</span></div><div class=\"stat-barra\"><span class=\"l" + gL + "\" style=\"width:" + pL.toFixed(1) +
      "%\"></span><span class=\"v" + gV + "\" style=\"width:" + (100 - pL).toFixed(1) + "%\"></span></div></div>";
  }
  function estadisticasHTML(rel) {
    var e = R.estadisticas(rel);
    var html = "<div class=\"stats\"><div class=\"stats-cabecera\">" + etiquetaEquipo(rel.local) + etiquetaEquipo(rel.visitante) + "</div>";
    html += filaStat("Posesión", e.L.posesion + "%", e.V.posesion + "%", e.L.posesion, e.V.posesion);
    FILAS_STATS.forEach(function (f) { html += filaStat(f[1], e.L[f[0]], e.V[f[0]], e.L[f[0]], e.V[f[0]]); });
    return html + "</div>";
  }

  // 11 vs 11: los dos onces con su puntaje FIFA y lo que hizo cada uno en el partido.
  function formacionesHTML(rel) {
    var part = R.participacion(rel), fig = R.figura(rel);
    function columna(nombre) {
      var eq = (rel.alineaciones && rel.alineaciones[nombre]) || estado.res.equipos[nombre];
      var html = "<div class=\"once-col\"><div class=\"once-cabecera\">" + etiquetaEquipo(nombre) +
        "<span class=\"once-total\" title=\"Puntaje del equipo\">" + Math.round(eq.puntaje) + "</span></div>";
      ["ARQ", "DEF", "VOL", "DEL"].forEach(function (pos) {
        eq.once.filter(function (j) { return j.pos === pos; }).forEach(function (j) {
          var x = part[nombre + "|" + j.jugador] || {}, ic = "", g;
          for (g = 0; g < (x.goles || 0); g++) ic += "⚽";
          for (g = 0; g < (x.asistencias || 0); g++) ic += "👟";
          if (x.amarillas) ic += "🟨";
          if (x.rojas) ic += "🟥";
          if (x.atajadas) ic += "🧤" + x.atajadas;
          var esFig = fig && fig.equipo === nombre && fig.jugador === j.jugador;
          html += "<div class=\"once-fila" + (esFig ? " figura" : "") + (x.rojas ? " expulsado" : "") + "\"><span class=\"once-pos\">" + pos + "</span>" +
            "<span class=\"once-nombre\">" + esc(j.jugador) + (esFig ? " ⭐" : "") + "</span><span class=\"once-ic\">" + ic + "</span><span class=\"once-pts\">" + puntaje(j) + "</span></div>";
        });
      });
      (eq.bajas || []).forEach(function (b) {
        html += "<div class=\"once-baja\">🚫 " + esc(b.sale) + " (suspendido) · entra " + esc(b.entra) + "</div>";
      });
      return html + "</div>";
    }
    var html = "";
    if (fig) {
      var d = fig.datos, logros = [];
      if (d.goles) logros.push(d.goles + (d.goles > 1 ? " goles" : " gol"));
      if (d.asistencias) logros.push(d.asistencias + (d.asistencias > 1 ? " asistencias" : " asistencia"));
      if (d.atajadas) logros.push(d.atajadas + (d.atajadas > 1 ? " atajadas" : " atajada"));
      html += "<div class=\"figura-partido\">⭐ Figura del partido: <strong>" + esc(fig.jugador) + "</strong> " + etiquetaEquipo(fig.equipo) +
        (logros.length ? " <span class=\"gris\">(" + logros.join(", ") + ")</span>" : "") + "</div>";
    }
    return html + "<div class=\"once-vs\">" + columna(rel.local) + columna(rel.visitante) + "</div>" +
      "<p class=\"ayuda\">El número es el puntaje FIFA de cada jugador. ⚽ gol · 👟 asistencia · 🧤 atajadas.</p>";
  }

  function contenidoFicha(pestana, rel, extras) {
    if (pestana === "estadisticas") return estadisticasHTML(rel);
    if (pestana === "formaciones") return formacionesHTML(rel);
    return relatoHTML(rel, extras);
  }
  function extrasLlave(item, minuto) {
    return item.ganadorLlave && minuto >= 90 ? [{ minuto: 90, orden: 4, tipo: "final", texto: "Pasa de ronda: " + item.ganadorLlave }] : [];
  }

  // Ficha completa de un partido ya jugado (desde la simulacion rapida).
  function abrirFicha(item, pestana) {
    var p = item.partido, rel = relatoDe(p), caja = $("ficha-contenido");
    estado.ficha = { item: item, pestana: pestana || "relato" };
    $("ficha-titulo").textContent = item.titulo;
    caja.innerHTML = "<div class=\"vivo-marcador\"><span class=\"vivo-equipo" + (p.local === "Nosotros" ? " nuestro" : "") + "\">" + esc(p.local) + "</span>" +
      "<span class=\"vivo-goles\">" + p.golesL + " - " + p.golesV + "</span><span class=\"vivo-equipo" + (p.visitante === "Nosotros" ? " nuestro" : "") + "\">" + esc(p.visitante) + "</span></div>" +
      pestanasHTML(estado.ficha.pestana) + "<div class=\"ficha-cuerpo\">" + contenidoFicha(estado.ficha.pestana, rel, extrasLlave(item, 90)) + "</div>";
    caja.querySelectorAll("[data-pestana]").forEach(function (b) {
      b.addEventListener("click", function () { abrirFicha(item, b.getAttribute("data-pestana")); });
    });
    $("ficha-partido").hidden = false;
  }
  function cerrarFicha() { $("ficha-partido").hidden = true; }

  function renderLenta() {
    var lista = partidosNuestros(estado.res), L = estado.lenta;
    if (!lista.length) return "<p class=\"ayuda\">No hay partidos para mostrar.</p>";
    var i = Math.min(L.indice, lista.length - 1), item = lista[i], p = item.partido;
    var vel = Object.keys(VELOCIDADES).map(function (k) {
      return "<button type=\"button\" class=\"boton " + (L.velocidad === k ? "principal" : "secundario") + "\" data-vel=\"" + k + "\">" + NOMBRE_VEL[k] + "</button>";
    }).join("");
    return "<div class=\"vivo\"><div class=\"vivo-cabecera\"><span>Partido " + (i + 1) + " de " + lista.length + "</span><strong>" + esc(item.titulo) + "</strong></div>" +
      "<div class=\"vivo-marcador\"><span class=\"vivo-equipo" + (p.local === "Nosotros" ? " nuestro" : "") + "\">" + esc(p.local) + "</span>" +
      "<span class=\"vivo-goles\" id=\"vivo-goles\">0 - 0</span><span class=\"vivo-equipo" + (p.visitante === "Nosotros" ? " nuestro" : "") + "\">" + esc(p.visitante) + "</span></div>" +
      "<div class=\"vivo-reloj\" id=\"vivo-reloj\">0'</div><div class=\"vivo-velocidad\">" + vel + "</div>" +
      "<div class=\"vivo-acciones\"><button type=\"button\" class=\"boton secundario\" data-accion=\"pausa\">Pausa</button>" +
      "<button type=\"button\" class=\"boton secundario\" data-accion=\"final\">Ver final</button>" +
      "<button type=\"button\" class=\"boton principal\" data-accion=\"siguiente\" id=\"vivo-siguiente\" hidden>Siguiente partido ›</button></div>" +
      pestanasHTML(L.pestana) + "<div class=\"vivo-relato\" id=\"vivo-relato\"></div><div id=\"vivo-otros\"></div></div>";
  }

  function prepararLenta() {
    var L = estado.lenta;
    el.resultado.querySelectorAll("[data-vel]").forEach(function (b) {
      b.addEventListener("click", function () {
        L.velocidad = b.getAttribute("data-vel");
        el.resultado.querySelectorAll("[data-vel]").forEach(function (x) {
          x.className = "boton " + (x.getAttribute("data-vel") === L.velocidad ? "principal" : "secundario");
        });
        if (!L.pausado && L.minuto < 90) iniciarReloj();
      });
    });
    var pausa = el.resultado.querySelector("[data-accion=pausa]");
    pausa.addEventListener("click", function () {
      L.pausado = !L.pausado;
      pausa.textContent = L.pausado ? "Reanudar" : "Pausa";
      if (L.pausado) detenerReloj(); else iniciarReloj();
    });
    el.resultado.querySelectorAll(".vivo [data-pestana]").forEach(function (b) {
      b.addEventListener("click", function () {
        L.pestana = b.getAttribute("data-pestana");
        el.resultado.querySelectorAll(".vivo [data-pestana]").forEach(function (x) {
          var on = x.getAttribute("data-pestana") === L.pestana;
          x.classList.toggle("activa", on);
          x.setAttribute("aria-selected", String(on));
        });
        actualizarVivo();
      });
    });
    el.resultado.querySelector("[data-accion=final]").addEventListener("click", function () { avanzarHasta(90); });
    el.resultado.querySelector("[data-accion=siguiente]").addEventListener("click", function () {
      L.indice++; L.minuto = 0; L.pausado = false; pintarResultado();
    });
    L.minuto = 0;
    actualizarVivo();
    iniciarReloj();
  }

  function iniciarReloj() {
    detenerReloj();
    var L = estado.lenta;
    L.timer = setInterval(function () { avanzarHasta(L.minuto + 1); }, VELOCIDADES[L.velocidad]);
  }
  function detenerReloj() { if (estado.lenta && estado.lenta.timer) { clearInterval(estado.lenta.timer); estado.lenta.timer = null; } }
  function avanzarHasta(m) { var L = estado.lenta; L.minuto = Math.min(90, m); actualizarVivo(); if (L.minuto >= 90) detenerReloj(); }

  function actualizarVivo() {
    var lista = partidosNuestros(estado.res), L = estado.lenta;
    if (!lista.length) return;
    var item = lista[Math.min(L.indice, lista.length - 1)], p = item.partido;
    var vistos = p.eventos.filter(function (e) { return e.minuto <= L.minuto; });
    var gl = vistos.filter(function (e) { return e.tipo === "gol" && e.equipo === p.local; }).length;
    var gv = vistos.filter(function (e) { return e.tipo === "gol" && e.equipo === p.visitante; }).length;
    var goles = $("vivo-goles"), reloj = $("vivo-reloj"), relato = $("vivo-relato");
    if (!goles || !reloj || !relato) return;
    goles.textContent = gl + " - " + gv;
    reloj.textContent = L.minuto >= 90 ? "Final" : L.minuto + "'";
    relato.innerHTML = contenidoFicha(L.pestana, recorte(relatoDe(p), L.minuto), extrasLlave(item, L.minuto));
    var terminado = L.minuto >= 90;
    var sig = $("vivo-siguiente");
    if (sig) sig.hidden = !terminado || L.indice >= lista.length - 1;
    var otros = $("vivo-otros");
    if (otros) {
      otros.innerHTML = terminado && item.fecha
        ? "<h3>Otros resultados de la fecha " + item.fecha + "</h3>" + estado.res.partidos.filter(function (x) { return x.fecha === item.fecha && x !== p; }).map(function (x) {
            return "<div class=\"partido\"><div class=\"marcador\">" + esc(x.local) + " <strong>" + x.golesL + " - " + x.golesV + "</strong> " + esc(x.visitante) + "</div></div>";
          }).join("")
        : "";
    }
  }

  // ---------- Arranque ----------
  function iniciar() {
    estado.presupuestoTotal = calcularPresupuesto();
    poblarSelects();
    crearCasilleros();
    render();
    pintarFicha();
    el.formacion.addEventListener("change", function () { cambiarFormacion(el.formacion.value); });
    el.buscar.addEventListener("input", function () { estado.filtros.texto = el.buscar.value; pintarLista(); });
    el.chipsPos.querySelectorAll("[data-pos]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.getAttribute("data-pos");
        estado.filtros.pos = estado.filtros.pos === p ? "" : p;
        pintarLista();
      });
    });
    $("mercado-filtros-btn").addEventListener("click", function () { if (el.vistaFiltros.hidden) abrirFiltros(); else mostrarVista("lista"); });
    $("filtros-aplicar").addEventListener("click", aplicarFiltros);
    $("filtros-borrar").addEventListener("click", borrarFiltros);
    $("mercado-cerrar").addEventListener("click", cerrarMercadoMovil);
    $("abrir-mercado").addEventListener("click", abrirMercadoMovil);
    $("abrir-recomendador").addEventListener("click", abrirRecomendador);
    $("rec-cerrar").addEventListener("click", cerrarRecomendador);
    el.recAtras.addEventListener("click", function () { estado.rec.paso = Math.max(1, estado.rec.paso - 1); pintarRecomendador(); });
    el.rec.addEventListener("click", function (e) { if (e.target === el.rec) cerrarRecomendador(); });
    $("armar-azar").addEventListener("click", armarAlAzar);
    $("vaciar").addEventListener("click", vaciarEquipo);
    el.simular.addEventListener("click", simular);
    $("ficha-cerrar").addEventListener("click", cerrarFicha);
    $("ficha-partido").addEventListener("click", function (e) { if (e.target === $("ficha-partido")) cerrarFicha(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarFicha(); });
  }

  iniciar();
})();
