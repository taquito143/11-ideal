/* 11 Ideal Argentina: relato minuto a minuto y estadisticas de cada partido.
 *
 * El resultado, los goleadores y las tarjetas los decide el motor (motor.js).
 * Este modulo solo agrega el color: remates, atajadas, corners, faltas, offsides,
 * asistencias y los textos del relato. Usa su propio generador aleatorio, sembrado
 * con los datos del partido, asi no altera la simulacion del torneo y el mismo
 * partido siempre se relata igual.
 */
(function (raiz) {
  "use strict";

  // Promedios por equipo y por partido (referencia: Primera Division argentina).
  var BASE = {
    alArcoSinGol: 2.6,   // remates al arco que no terminan en gol (atajadas del arquero rival)
    afuera: 6.2,         // remates desviados o bloqueados
    corners: 4.6,
    faltas: 13.5,
    offsides: 1.8,
    probAsistencia: 0.72,
    probPalo: 0.09,
    probPenal: 0.09
  };

  function crearRng(semilla) {
    var s = semilla >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(texto) {
    var h = 2166136261;
    for (var i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function poisson(lambda, rng) {
    var L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L && k < 40);
    return k - 1;
  }

  function elegir(lista, rng) { return lista[Math.floor(rng() * lista.length)]; }

  function ponderado(candidatos, peso, rng) {
    if (!candidatos.length) return null;
    var pesos = candidatos.map(peso);
    var total = pesos.reduce(function (a, b) { return a + b; }, 0);
    var u = rng() * total;
    for (var i = 0; i < candidatos.length; i++) {
      u -= pesos[i];
      if (u <= 0) return candidatos[i];
    }
    return candidatos[candidatos.length - 1];
  }

  function apellido(nombre) {
    var partes = String(nombre || "").trim().split(/\s+/);
    return partes.length > 1 ? partes.slice(1).join(" ") : partes[0];
  }

  function rellenar(plantilla, datos) {
    return plantilla.replace(/\{(\w+)\}/g, function (_, k) { return datos[k] != null ? datos[k] : ""; });
  }

  // ---------- Textos ----------
  var FRASES = {
    inicio: [
      "¡Rueda la pelota! Arranca {local} - {visitante}.",
      "Pitazo inicial: ya se juega {local} - {visitante}.",
      "Comienza el partido entre {local} y {visitante}."
    ],
    gol: [
      "¡GOOOL de {equipo}! {j} definió cruzado ante la salida de {arq}.",
      "¡GOOOL! {j} la clavó en el ángulo y {arq} no llegó.",
      "¡GOOOL de {j}! Remate seco desde el borde del área para {equipo}.",
      "¡GOOOL! Apareció {j} en el segundo palo y empujó la pelota a la red.",
      "¡GOOOL de {equipo}! {j} le pegó de primera y la mandó a guardar.",
      "¡GOOOL! {j} se sacó de encima a dos defensores y la tocó suave por abajo de {arq}."
    ],
    golCabeza: [
      "¡GOOOL de cabeza de {j}! Se elevó más que todos y la puso contra el palo.",
      "¡GOOOL! Cabezazo letal de {j} y {arq} quedó parado."
    ],
    golPenal: [
      "¡GOOOL de penal! {j} cambió por gol la pena máxima y engañó a {arq}.",
      "¡GOOOL! {j} no perdonó desde los doce pasos."
    ],
    asistencia: [
      "Gran pase de {a}.",
      "La asistencia fue de {a}.",
      "Centro preciso de {a}.",
      "Habilitación perfecta de {a}."
    ],
    atajada: [
      "¡Qué atajada de {arq}! Le sacó el remate a {j} sobre la línea.",
      "{j} probó de media distancia y {arq} la mandó al córner.",
      "Remate de {j} al arco, bien parado {arq} para contener.",
      "¡Se salvó {rival}! {arq} achicó y le tapó el mano a mano a {j}.",
      "Tiro libre de {j}, vuela {arq} y la saca."
    ],
    afuera: [
      "{j} sacó un remate que se fue apenas desviado.",
      "¡Se lo perdió {j}! La tiró por arriba del travesaño.",
      "Disparo de {j} que se fue lejos del arco de {arq}.",
      "Cabezazo de {j} que se va afuera por poco.",
      "Remate de {j} que rebota en un defensor."
    ],
    palo: [
      "¡PALO! El remate de {j} se estrelló en el poste.",
      "¡En el travesaño! Casi el gol de {j} para {equipo}."
    ],
    corner: [
      "Tiro de esquina para {equipo}.",
      "Córner para {equipo}, van todos al área."
    ],
    offside: [
      "Bandera en alto: {j} estaba adelantado.",
      "Fuera de juego de {j}, se anula el avance de {equipo}."
    ],
    amarilla: [
      "Amarilla para {j} por una falta táctica.",
      "El árbitro le muestra la amarilla a {j} por protestar.",
      "Tarjeta amarilla para {j} tras una entrada fuerte.",
      "Amonestado {j} por cortar un contragolpe."
    ],
    roja: [
      "¡Roja directa para {j}! {equipo} se queda con uno menos.",
      "¡Expulsado {j}! Entrada desmedida y {equipo} con diez."
    ],
    segundaAmarilla: [
      "¡Segunda amarilla para {j} y se va a las duchas! {equipo} con diez."
    ],
    entretiempo: ["Final del primer tiempo: {local} {gl} - {gv} {visitante}."],
    segundoTiempo: ["Comienza el segundo tiempo."],
    final: ["¡Final del partido! {local} {gl} - {gv} {visitante}."]
  };

  // ---------- Generacion ----------
  // p: partido del motor ({local, visitante, golesL, golesV, eventos}).
  // equipos: { nombreLocal: {once, puntaje}, nombreVisitante: {...} }.
  function generar(p, local, visitante) {
    var clave = [p.local, p.visitante, p.golesL, p.golesV, p.fecha || ""].concat(
      (p.eventos || []).map(function (e) { return e.minuto + e.tipo + e.jugador; })
    ).join("|");
    var rng = crearRng(hash(clave));
    var lineas = [];
    var datosBase = { local: p.local, visitante: p.visitante };

    function arquero(eq) {
      return eq.once.filter(function (j) { return j.pos === "ARQ"; })[0] || eq.once[0];
    }
    var lados = [
      { nombre: p.local, eq: local, rival: visitante, rivalNombre: p.visitante, goles: p.golesL, lado: "L" },
      { nombre: p.visitante, eq: visitante, rival: local, rivalNombre: p.local, goles: p.golesV, lado: "V" }
    ];

    // Expulsiones: el jugador no participa despues de su roja.
    var expulsion = {};
    (p.eventos || []).forEach(function (e) { if (e.tipo === "roja") expulsion[e.equipo + "|" + e.jugador] = e.minuto; });
    function disponible(lado, j, m) {
      var r = expulsion[lado.nombre + "|" + j.jugador];
      return r == null || m <= r;
    }
    function campo(lado, m) {
      return lado.eq.once.filter(function (j) { return j.pos !== "ARQ" && disponible(lado, j, m); });
    }
    function rematador(lado, m) {
      return ponderado(campo(lado, m), function (j) {
        var base = { DEL: 3, VOL: 1.6, DEF: 0.5 }[j.pos] || 1;
        return base + 4 * ((j.goles || 0) + 0.3) / ((j.partidos || 0) + 5);
      }, rng) || lado.eq.once[0];
    }
    function asistidor(lado, m, goleador) {
      return ponderado(campo(lado, m).filter(function (j) { return j !== goleador; }), function (j) {
        var base = { VOL: 2, DEL: 1.4, DEF: 0.8 }[j.pos] || 1;
        return base + 5 * ((j.asistencias || 0) + 0.2) / ((j.partidos || 0) + 5);
      }, rng);
    }
    function minutoAzar() { return Math.floor(rng() * 90) + 1; }
    function agregar(minuto, tipo, lado, texto, extra) {
      var l = { minuto: minuto, tipo: tipo, equipo: lado ? lado.nombre : null, texto: texto, orden: 1 };
      for (var k in extra) l[k] = extra[k];
      lineas.push(l);
      return l;
    }

    // Partes del partido.
    var gl45 = 0, gv45 = 0;
    (p.eventos || []).forEach(function (e) {
      if (e.tipo === "gol" && e.minuto <= 45) { if (e.equipo === p.local) gl45++; else gv45++; }
    });
    lineas.push({ minuto: 0, orden: 0, tipo: "inicio", texto: rellenar(elegir(FRASES.inicio, rng), datosBase) });
    lineas.push({ minuto: 45, orden: 2, tipo: "pausa", texto: rellenar(FRASES.entretiempo[0], { local: p.local, visitante: p.visitante, gl: gl45, gv: gv45 }) });
    lineas.push({ minuto: 46, orden: 0, tipo: "pausa", texto: FRASES.segundoTiempo[0] });
    lineas.push({ minuto: 90, orden: 3, tipo: "final", texto: rellenar(FRASES.final[0], { local: p.local, visitante: p.visitante, gl: p.golesL, gv: p.golesV }) });

    // Bajas por suspension (las decide el motor antes del partido).
    lados.forEach(function (lado) {
      (lado.eq.bajas || []).forEach(function (b) {
        lineas.push({ minuto: 0, orden: -1, tipo: "baja", equipo: lado.nombre,
          texto: "Baja por suspensión: " + b.sale + ". En su lugar juega " + b.entra + "." });
      });
    });

    // Planteo de cada equipo (si no es el equilibrado).
    var PLANTEO = { defensiva: "Sale a cerrarse atrás con un planteo defensivo", ofensiva: "Sale a buscar el partido con un planteo ofensivo" };
    lados.forEach(function (lado) {
      if (PLANTEO[lado.eq.mentalidad]) {
        lineas.push({ minuto: 0, orden: 0.5, tipo: "planteo", equipo: lado.nombre, texto: PLANTEO[lado.eq.mentalidad] + "." });
      }
    });

    // Eventos del motor: goles y tarjetas.
    var amarillas = {};
    (p.eventos || []).forEach(function (e) {
      var lado = e.equipo === p.local ? lados[0] : lados[1];
      var jug = lado.eq.once.filter(function (j) { return j.jugador === e.jugador; })[0] || { jugador: e.jugador, pos: "DEL" };
      var d = { j: jug.jugador, equipo: lado.nombre, rival: lado.rivalNombre, arq: apellido(arquero(lado.rival).jugador) };
      if (e.tipo === "gol") {
        var u = rng(), tipoGol = "normal", plantillas = FRASES.gol;
        if (u < BASE.probPenal) { tipoGol = "penal"; plantillas = FRASES.golPenal; }
        else if (u < BASE.probPenal + 0.2 && jug.pos !== "VOL") { tipoGol = "cabeza"; plantillas = FRASES.golCabeza; }
        var asis = null;
        if (tipoGol !== "penal" && rng() < BASE.probAsistencia) asis = asistidor(lado, e.minuto, jug);
        var texto = rellenar(elegir(plantillas, rng), d);
        if (asis) texto += " " + rellenar(elegir(FRASES.asistencia, rng), { a: asis.jugador });
        agregar(e.minuto, "gol", lado, texto, { jugador: jug.jugador, asistencia: asis ? asis.jugador : null, alArco: true, remate: true });
      } else if (e.tipo === "amarilla") {
        amarillas[lado.nombre + "|" + jug.jugador] = true;
        agregar(e.minuto, "amarilla", lado, rellenar(elegir(FRASES.amarilla, rng), d), { jugador: jug.jugador, falta: true });
      } else if (e.tipo === "roja") {
        var segunda = amarillas[lado.nombre + "|" + jug.jugador];
        agregar(e.minuto, "roja", lado, rellenar(elegir(segunda ? FRASES.segundaAmarilla : FRASES.roja, rng), d), { jugador: jug.jugador, falta: true });
      }
    });

    // Color del partido segun la diferencia de puntaje de los equipos.
    var cuotaL = local.puntaje * 1.03 / (local.puntaje * 1.03 + visitante.puntaje);
    var posesionL = Math.round(50 + (cuotaL - 0.5) * 180 + (rng() * 2 - 1) * 5);
    var CORRE = { defensiva: -4, ofensiva: 4 };
    posesionL += (CORRE[local.mentalidad] || 0) - (CORRE[visitante.mentalidad] || 0);
    posesionL = Math.max(32, Math.min(68, posesionL));

    lados.forEach(function (lado) {
      var cuota = lado.lado === "L" ? cuotaL : 1 - cuotaL;
      var factor = 0.55 + cuota * 0.9;           // ~1 cuando estan parejos
      var arqRival = arquero(lado.rival);
      var dRival = function (j) {
        return { j: j.jugador, equipo: lado.nombre, rival: lado.rivalNombre, arq: apellido(arqRival.jugador) };
      };
      var i, m, j;
      var atajadas = poisson(BASE.alArcoSinGol * factor, rng);
      for (i = 0; i < atajadas; i++) {
        m = minutoAzar(); j = rematador(lado, m);
        agregar(m, "atajada", lado, rellenar(elegir(FRASES.atajada, rng), dRival(j)), { jugador: j.jugador, alArco: true, remate: true, ataja: arqRival.jugador });
      }
      var afuera = poisson(BASE.afuera * factor, rng);
      for (i = 0; i < afuera; i++) {
        m = minutoAzar(); j = rematador(lado, m);
        var palo = rng() < BASE.probPalo;
        agregar(m, palo ? "palo" : "afuera", lado, rellenar(elegir(palo ? FRASES.palo : FRASES.afuera, rng), dRival(j)), { jugador: j.jugador, remate: true, silencioso: !palo && rng() < 0.35 });
      }
      var corners = poisson(BASE.corners * factor, rng);
      for (i = 0; i < corners; i++) {
        agregar(minutoAzar(), "corner", lado, rellenar(elegir(FRASES.corner, rng), { equipo: lado.nombre }), { silencioso: rng() < 0.6 });
      }
      var tarjetasPropias = (p.eventos || []).filter(function (e) { return e.equipo === lado.nombre && e.tipo !== "gol"; }).length;
      var faltas = Math.max(0, poisson(BASE.faltas * (1.45 - factor * 0.45), rng) - tarjetasPropias);
      for (i = 0; i < faltas; i++) {
        agregar(minutoAzar(), "falta", lado, "Falta de " + lado.nombre + ".", { falta: true, silencioso: true });
      }
      var offsides = poisson(BASE.offsides * factor, rng);
      for (i = 0; i < offsides; i++) {
        m = minutoAzar(); j = rematador(lado, m);
        agregar(m, "offside", lado, rellenar(elegir(FRASES.offside, rng), dRival(j)), { jugador: j.jugador, silencioso: rng() < 0.5 });
      }
    });

    lineas.sort(function (a, b) { return a.minuto - b.minuto || a.orden - b.orden; });
    return { lineas: lineas, posesionL: posesionL, local: p.local, visitante: p.visitante };
  }

  // Estadisticas acumuladas hasta un minuto (para el partido en vivo y la ficha final).
  function estadisticas(relato, hasta) {
    var limite = hasta == null ? 90 : hasta;
    var e = { L: nuevo(), V: nuevo() };
    function nuevo() { return { goles: 0, remates: 0, alArco: 0, corners: 0, faltas: 0, amarillas: 0, rojas: 0, offsides: 0, atajadas: 0 }; }
    relato.lineas.forEach(function (l) {
      if (l.minuto > limite || !l.equipo) return;
      var s = l.equipo === relato.local ? e.L : e.V;
      var rival = s === e.L ? e.V : e.L;
      if (l.remate) s.remates++;
      if (l.alArco) s.alArco++;
      if (l.tipo === "gol") s.goles++;
      if (l.tipo === "atajada") rival.atajadas++;
      if (l.tipo === "corner") s.corners++;
      if (l.falta) s.faltas++;
      if (l.tipo === "amarilla") s.amarillas++;
      if (l.tipo === "roja") s.rojas++;
      if (l.tipo === "offside") s.offsides++;
    });
    e.L.posesion = relato.posesionL;
    e.V.posesion = 100 - relato.posesionL;
    return e;
  }

  // Lo que hizo cada jugador en el partido (goles, asistencias, tarjetas, atajadas).
  function participacion(relato) {
    var porJugador = {};
    function de(equipo, nombre) {
      var k = equipo + "|" + nombre;
      return (porJugador[k] = porJugador[k] || { goles: 0, asistencias: 0, amarillas: 0, rojas: 0, atajadas: 0, remates: 0 });
    }
    relato.lineas.forEach(function (l) {
      if (!l.equipo) return;
      var rival = l.equipo === relato.local ? relato.visitante : relato.local;
      if (l.jugador) {
        var j = de(l.equipo, l.jugador);
        if (l.remate) j.remates++;
        if (l.tipo === "gol") j.goles++;
        if (l.tipo === "amarilla") j.amarillas++;
        if (l.tipo === "roja") j.rojas++;
      }
      if (l.asistencia) de(l.equipo, l.asistencia).asistencias++;
      if (l.ataja) de(rival, l.ataja).atajadas++;
    });
    return porJugador;
  }

  // Figura del partido: el de mayor participacion en goles (sin inventar notas).
  function figura(relato) {
    var part = participacion(relato), mejor = null, mejorValor = 0;
    Object.keys(part).forEach(function (k) {
      var x = part[k];
      var valor = x.goles * 3 + x.asistencias * 2 + x.atajadas * 0.6 + x.remates * 0.1 - x.rojas * 3;
      if (valor > mejorValor) { mejorValor = valor; mejor = { clave: k, datos: x }; }
    });
    if (!mejor) return null;
    var partes = mejor.clave.split("|");
    return { equipo: partes[0], jugador: partes[1], datos: mejor.datos };
  }

  var API = { generar: generar, estadisticas: estadisticas, participacion: participacion, figura: figura };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.RelatoOnceIdeal = API;
})(typeof window !== "undefined" ? window : globalThis);
