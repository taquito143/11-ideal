/*
 * Motor de simulacion de 11 Ideal Argentina.
 * Sin dependencias: funciona en el navegador (window.MotorOnceIdeal) y en Node (module.exports).
 *
 * Reglas (ver analisis_y_roadmap.md):
 *  - Puntaje de jugador = PrT (promedio por partido) de la planilla.
 *  - Puntaje de equipo = suma de los 11 titulares.
 *  - Partido: se compara el puntaje efectivo de cada equipo (con azar y localia).
 *    proporcion = propio / (propio + rival) * 100
 *      < 45  -> pierde
 *      45-55 -> empata
 *      > 55  -> gana
 *  - Liga: 31 equipos (30 clubes + nosotros), ida y vuelta. Pasan los 16 mejores.
 *  - Cuadro: llaves A-H con siembra 1-16, cuartos, semis (ida y vuelta), final y tercer puesto.
 *  - Empate en una llave: penales con los 5 mejores pateadores; la probabilidad de gol depende
 *    del PrT del pateador frente al PrT del arquero rival.
 */
(function (raiz) {
  "use strict";

  var FORMACION = { ARQ: 1, DEF: 4, VOL: 3, DEL: 3 };   // 11 titulares (4-3-3)
  var BANCO = { ARQ: 1, DEF: 2, VOL: 2, DEL: 2 };        // 7 suplentes (reglamento LPF)
  var POSICIONES = ["ARQ", "DEF", "VOL", "DEL"];

  var CONFIG = {
    azarPorPartido: 0.14,   // +-14% sobre el puntaje efectivo (calibrado contra la Clausura 2026, datos FIFA finales)
    bonusLocalia: 0.03,     // +3% para el equipo que juega de local
    empateMin: 48.75,       // proporcion minima para empatar (calibrado: real 43,7 / 27,5 / 28,7)
    empateMax: 51.25,       // proporcion maxima para empatar
    clasificados: 16,
    golesPromedio: 1.15,       // goles esperados por equipo con puntaje de referencia (calibrado: real Clausura 2026 = 2,34 por partido)
    multiplicadorAmarillas: 1.35, // calibrado: ~4,7 amarillas por partido (real Clausura 2026 = 4,71)
    multiplicadorRojas: 1.4,      // calibrado: ~0,30 rojas por partido (real Clausura 2026 = 0,30)
    puntajeReferencia: 724,    // puntaje promedio de un club (suma de 11 puntajes por atributos, escala FIFA)
    bonusCapitan: 0.10         // el capitan en cancha suma un 10% extra de su propio puntaje
  };

  // Mentalidad: no cambia la fuerza del equipo, cambia el riesgo.
  //  ganar / perder: cuanto se achica o agranda la franja de empate del lado de ganar o de perder
  //    (defensiva: cuesta mas perder y un poco mas ganar; ofensiva: menos empates hacia los dos lados)
  //  goles: goles esperados del partido (para los dos equipos)
  //  azar:  cuanto puede variar el rendimiento en el partido
  var MENTALIDADES = {
    // Calibrado (tools/prueba_mentalidad.js): al favorito le conviene apenas la ofensiva,
    // al que es menos le conviene la defensiva, y entre parejos las tres rinden parecido.
    defensiva: { nombre: "Defensiva", ganar: 2, perder: 3, goles: 0.8, azar: 0.9, fuerza: 1, posesion: -4 },
    equilibrada: { nombre: "Equilibrada", ganar: 1, perder: 1, goles: 1, azar: 1, fuerza: 1, posesion: 0 },
    ofensiva: { nombre: "Ofensiva", ganar: 0.4, perder: 0.6, goles: 1.2, azar: 1.05, fuerza: 0.995, posesion: 4 }
  };
  function mentalidadDe(equipo) { return MENTALIDADES[equipo.mentalidad] || MENTALIDADES.equilibrada; }

  // Puntaje con el que juega el equipo: suma de los 11 + el plus del capitan si esta en cancha.
  function capitanEnCancha(equipo) {
    if (!equipo.capitan) return null;
    return equipo.once.filter(function (j) { return j.jugador === equipo.capitan; })[0] || null;
  }
  function fuerza(equipo) {
    var c = capitanEnCancha(equipo);
    return equipo.puntaje + (c ? CONFIG.bonusCapitan * (c.promedio || 0) : 0);
  }

  // ---------- Azar reproducible (mulberry32) ----------
  function crearRng(semilla) {
    var s = (semilla === undefined ? Date.now() : semilla) >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Datos ----------
  function jugadoresDeTorneo(todos, torneo) {
    return todos.filter(function (j) {
      return j.torneo === torneo && j.promedio !== null && j.promedio !== undefined;
    });
  }

  function torneosDisponibles(todos) {
    var set = {};
    todos.forEach(function (j) { set[j.torneo] = true; });
    return Object.keys(set);
  }

  function ordenar(lista) {
    // Mas titularidades primero (datos AFA); luego mas partidos; a igualdad, mejor promedio.
    return lista.slice().sort(function (a, b) {
      if ((b.titulares || 0) !== (a.titulares || 0)) return (b.titulares || 0) - (a.titulares || 0);
      if ((b.partidos || 0) !== (a.partidos || 0)) return (b.partidos || 0) - (a.partidos || 0);
      return (b.promedio || 0) - (a.promedio || 0);
    });
  }

  // ---------- Ruleta y armado de nuestro equipo ----------
  // Devuelve un jugador al azar de la posicion pedida, sin repetir los ya elegidos.
  function ruletaPick(pool, pos, usados, rng) {
    var candidatos = pool.filter(function (j) {
      return j.pos === pos && !usados[j.jugador];
    });
    if (!candidatos.length) return null;
    return candidatos[Math.floor(rng() * candidatos.length)];
  }

  // Candidatos para la ruleta de una posicion (lista completa, para mostrarla girando).
  function candidatosRuleta(pool, pos, usados) {
    return pool.filter(function (j) { return j.pos === pos && !usados[j.jugador]; });
  }

  // ---------- Once de cada club ----------
  // excluidos: nombres de jugadores que elegimos (salen de su club para toda la temporada).
  function construirClubes(todos, torneo, excluidos) {
    var jugadores = jugadoresDeTorneo(todos, torneo);
    var porEquipo = {};
    jugadores.forEach(function (j) {
      if (!j.equipo) return;
      if (excluidos && excluidos[j.jugador]) return;
      (porEquipo[j.equipo] = porEquipo[j.equipo] || []).push(j);
    });

    var clubes = [];
    Object.keys(porEquipo).forEach(function (equipo) {
      var plantel = porEquipo[equipo];
      var titulares = [];
      var sobrantes = [];
      var banco = [];
      POSICIONES.forEach(function (pos) {
        var lista = ordenar(plantel.filter(function (j) { return j.pos === pos; }));
        var n = FORMACION[pos];
        titulares = titulares.concat(lista.slice(0, n));
        sobrantes = sobrantes.concat(lista.slice(n));
        banco = banco.concat(lista.slice(n, n + BANCO[pos]));
      });
      // Si una posicion no alcanza, se completa con los jugadores de mas partidos.
      var faltan = 11 - titulares.length;
      if (faltan > 0) {
        var extra = ordenar(sobrantes).slice(0, faltan);
        titulares = titulares.concat(extra);
        banco = banco.filter(function (j) { return extra.indexOf(j) === -1; });
      }
      if (titulares.length === 11) {
        var capitan = titulares.slice().sort(function (a, b) { return (b.promedio || 0) - (a.promedio || 0); })[0];
        clubes.push({ nombre: equipo, esNuestro: false, once: titulares, banco: banco, puntaje: puntajeOnce(titulares),
          capitan: capitan.jugador, mentalidad: "equilibrada" });
      }
    });
    return clubes;
  }

  function puntajeOnce(lista) {
    return lista.reduce(function (suma, j) { return suma + (j.promedio || 0); }, 0);
  }

  // ---------- Partidos ----------
  // Resultado de un partido: "L" gana local, "E" empate, "V" gana visitante.
  function resultadoPartido(local, visitante, rng) {
    var mL = mentalidadDe(local), mV = mentalidadDe(visitante);
    var azarL = 1 + (rng() * 2 - 1) * CONFIG.azarPorPartido * mL.azar;
    var azarV = 1 + (rng() * 2 - 1) * CONFIG.azarPorPartido * mV.azar;
    var efectivoL = fuerza(local) * (mL.fuerza || 1) * (1 + CONFIG.bonusLocalia) * azarL;
    var efectivoV = fuerza(visitante) * (mV.fuerza || 1) * azarV;
    var proporcion = efectivoL / (efectivoL + efectivoV) * 100;
    var base = (CONFIG.empateMax - CONFIG.empateMin) / 2;
    var limiteL = 50 + base * (mL.ganar + mV.perder) / 2;   // por encima gana el local
    var limiteV = 50 - base * (mV.ganar + mL.perder) / 2;   // por debajo gana el visitante
    if (proporcion > limiteL) return "L";
    if (proporcion < limiteV) return "V";
    return "E";
  }

  // ---------- Goles y eventos ----------
  // Poisson por el metodo de Knuth.
  function poisson(lambda, rng) {
    var L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L && k < 20);
    return k - 1;
  }

  // Elige un jugador de campo con probabilidad proporcional a su rendimiento goleador.
  function elegirGoleador(once, rng) {
    var candidatos = once.filter(function (j) { return j.pos !== "ARQ"; });
    var pesos = candidatos.map(function (j) {
      return ((j.goles || 0) + 0.3) / ((j.partidos || 0) + 5);
    });
    var total = pesos.reduce(function (a, b) { return a + b; }, 0);
    var u = rng() * total;
    for (var i = 0; i < candidatos.length; i++) {
      u -= pesos[i];
      if (u <= 0) return candidatos[i];
    }
    return candidatos[candidatos.length - 1];
  }

  function minuto(rng) {
    return Math.floor(rng() * 90) + 1;
  }

  // Partido completo: resultado, goles y eventos (goles y tarjetas por minuto).
  // Primero se decide el resultado (igual que antes) y despues se generan los detalles,
  // asi la vista rapida y la lenta muestran exactamente lo mismo.
  function jugarPartido(local, visitante, rng) {
    var res = resultadoPartido(local, visitante, rng);
    var factorGoles = (mentalidadDe(local).goles + mentalidadDe(visitante).goles) / 2;
    var lambdaL = CONFIG.golesPromedio * factorGoles * local.puntaje / CONFIG.puntajeReferencia;
    var lambdaV = CONFIG.golesPromedio * factorGoles * visitante.puntaje / CONFIG.puntajeReferencia;
    // Se sortean goles hasta que el marcador coincida con el resultado (muestreo condicional),
    // asi no se inflan los goles con un ajuste posterior.
    function coincide(a, b) {
      if (res === "L") return a > b;
      if (res === "V") return b > a;
      return a === b;
    }
    var gL = 0, gV = 0;
    for (var intento = 0; intento < 40; intento++) {
      gL = poisson(lambdaL, rng);
      gV = poisson(lambdaV, rng);
      if (coincide(gL, gV)) break;
    }
    // Ajuste de respaldo si no se logro coincidir.
    if (res === "L" && gL <= gV) gL = gV + 1;
    else if (res === "V" && gV <= gL) gV = gL + 1;
    else if (res === "E") gV = gL;

    var eventos = [];
    function agregar(equipo, goles) {
      for (var g = 0; g < goles; g++) {
        var j = elegirGoleador(equipo.once, rng);
        eventos.push({ minuto: minuto(rng), tipo: "gol", equipo: equipo.nombre, jugador: j.jugador });
      }
    }
    agregar(local, gL);
    agregar(visitante, gV);

    [local, visitante].forEach(function (equipo) {
      equipo.once.forEach(function (j) {
        var partidos = Math.max(j.partidos || 0, 1);
        if (rng() < CONFIG.multiplicadorAmarillas * (j.amarillas || 0) / partidos) {
          eventos.push({ minuto: minuto(rng), tipo: "amarilla", equipo: equipo.nombre, jugador: j.jugador });
        }
        if (rng() < CONFIG.multiplicadorRojas * (j.rojas || 0) / partidos) {
          eventos.push({ minuto: minuto(rng), tipo: "roja", equipo: equipo.nombre, jugador: j.jugador });
        }
      });
    });
    // Coherencia: un expulsado no puede hacer goles ni ver amarillas despues de su roja.
    eventos.forEach(function (r) {
      if (r.tipo !== "roja") return;
      eventos.forEach(function (e) {
        if (e !== r && e.equipo === r.equipo && e.jugador === r.jugador && e.minuto >= r.minuto) r.minuto = Math.min(90, e.minuto + 1);
      });
    });
    eventos.sort(function (a, b) { return a.minuto - b.minuto; });

    return { resultado: res, golesL: gL, golesV: gV, eventos: eventos };
  }

  // ---------- Sanciones ----------
  // 4 amarillas acumuladas o una roja = 1 partido de suspension (liga y cuadro).
  // El suspendido lo reemplaza el primer suplente libre de su puesto (o de cualquier puesto).
  function crearSanciones() { return {}; }
  function sancionesDe(sanc, equipo) {
    return (sanc[equipo.nombre] = sanc[equipo.nombre] || { amarillas: {}, suspendidos: {} });
  }
  function alinear(equipo, sanc) {
    if (!sanc) return equipo;
    var s = sancionesDe(sanc, equipo);
    if (!equipo.once.some(function (j) { return s.suspendidos[j.jugador]; })) return equipo;
    var usados = {};
    equipo.once.forEach(function (j) { usados[j.jugador] = true; });
    var banco = (equipo.banco || []).filter(function (j) { return !s.suspendidos[j.jugador]; });
    var bajas = [];
    var once = equipo.once.map(function (j) {
      if (!s.suspendidos[j.jugador]) return j;
      var libres = banco.filter(function (b) { return !usados[b.jugador]; });
      var entra = libres.filter(function (b) { return b.pos === j.pos; })[0] || libres[0];
      if (!entra) return j;
      usados[entra.jugador] = true;
      bajas.push({ sale: j.jugador, entra: entra.jugador, pos: j.pos });
      return entra;
    });
    if (!bajas.length) return equipo;
    return { nombre: equipo.nombre, esNuestro: equipo.esNuestro, once: once, banco: equipo.banco, puntaje: puntajeOnce(once), bajas: bajas,
      capitan: equipo.capitan, mentalidad: equipo.mentalidad };
  }
  function registrarSanciones(sanc, equipo, eventos) {
    if (!sanc) return;
    var s = sancionesDe(sanc, equipo);
    // Todas las suspensiones duran un partido del equipo: con este quedan cumplidas.
    s.suspendidos = {};
    eventos.forEach(function (e) {
      if (e.equipo !== equipo.nombre) return;
      if (e.tipo === "amarilla") {
        s.amarillas[e.jugador] = (s.amarillas[e.jugador] || 0) + 1;
        if (s.amarillas[e.jugador] >= 4) { s.amarillas[e.jugador] = 0; s.suspendidos[e.jugador] = true; }
      } else if (e.tipo === "roja") {
        s.suspendidos[e.jugador] = true;
      }
    });
  }
  // Partido oficial: aplica suspensiones antes y las actualiza despues.
  function jugarOficial(local, visitante, rng, sanc) {
    var alL = alinear(local, sanc), alV = alinear(visitante, sanc);
    var pr = jugarPartido(alL, alV, rng);
    registrarSanciones(sanc, local, pr.eventos);
    registrarSanciones(sanc, visitante, pr.eventos);
    pr.alL = alL; pr.alV = alV;
    return pr;
  }
  function registroPartido(local, visitante, pr) {
    return { local: local.nombre, visitante: visitante.nombre, golesL: pr.golesL, golesV: pr.golesV, resultado: pr.resultado,
      eventos: pr.eventos, alineacionL: pr.alL || local, alineacionV: pr.alV || visitante };
  }

  function partido(local, visitante, rng) {
    return jugarPartido(local, visitante, rng).resultado;
  }

  function arqueroTitular(equipo) {
    return equipo.once.filter(function (j) { return j.pos === "ARQ"; })[0] || { promedio: 0 };
  }

  // Penales: los 5 mejores pateadores de cada equipo. Devuelve "L" o "V".
  function penales(local, visitante, rng) {
    var pateadoresL = ordenar(local.once).sort(function (a, b) { return b.promedio - a.promedio; }).slice(0, 5);
    var pateadoresV = ordenar(visitante.once).sort(function (a, b) { return b.promedio - a.promedio; }).slice(0, 5);
    var arqL = arqueroTitular(local);
    var arqV = arqueroTitular(visitante);
    var golesL = 0, golesV = 0;

    function probabilidad(pateador, arquero) {
      var p = 0.6 + (pateador.promedio - arquero.promedio) / 40;
      return Math.min(0.9, Math.max(0.4, p));
    }
    function tanda(pateadores, arquero) {
      var goles = 0;
      for (var i = 0; i < pateadores.length; i++) {
        if (rng() < probabilidad(pateadores[i], arquero)) goles++;
      }
      return goles;
    }
    golesL = tanda(pateadoresL, arqV);
    golesV = tanda(pateadoresV, arqL);
    // Desempate: muerte subita con un tiro por equipo hasta que se rompa la igualdad.
    var rondas = 0;
    while (golesL === golesV && rondas < 50) {
      var pL = probabilidad(pateadoresL[rondas % pateadoresL.length], arqV);
      var pV = probabilidad(pateadoresV[rondas % pateadoresV.length], arqL);
      if (rng() < pL) golesL++;
      if (rng() < pV) golesV++;
      rondas++;
    }
    if (golesL === golesV) return rng() < 0.5 ? "L" : "V";
    return golesL > golesV ? "L" : "V";
  }

  // Partido unico. Si empata, se define por penales. Devuelve el ganador (objeto equipo).
  function partidoUnico(a, b, rng, sanc) {
    var pr = jugarOficial(a, b, rng, sanc);
    var ganador;
    if (pr.resultado === "L") ganador = a;
    else if (pr.resultado === "V") ganador = b;
    else ganador = penales(pr.alL, pr.alV, rng) === "L" ? a : b;
    return {
      ganador: ganador,
      perdedor: ganador === a ? b : a,
      partido: registroPartido(a, b, pr)
    };
  }

  // Ida y vuelta: a juega de local en la ida y b en la vuelta.
  // Gana quien gane mas partidos; si quedan 1-1 (o dos empates), penales.
  function llaveIdaVuelta(a, b, rng, sanc) {
    var idaPr = jugarOficial(a, b, rng, sanc);    // a local
    var vueltaPr = jugarOficial(b, a, rng, sanc); // b local
    var ida = idaPr.resultado;
    var vuelta = vueltaPr.resultado;
    var victoriasA = (ida === "L" ? 1 : 0) + (vuelta === "V" ? 1 : 0);
    var victoriasB = (ida === "V" ? 1 : 0) + (vuelta === "L" ? 1 : 0);
    var ganador;
    if (victoriasA > victoriasB) ganador = a;
    else if (victoriasB > victoriasA) ganador = b;
    else ganador = penales(vueltaPr.alV, vueltaPr.alL, rng) === "L" ? a : b;
    return {
      ganador: ganador,
      perdedor: ganador === a ? b : a,
      ida: registroPartido(a, b, idaPr),
      vuelta: registroPartido(b, a, vueltaPr)
    };
  }

  // ---------- Liga ----------
  // Calendario ida y vuelta con el metodo del circulo (31 equipos -> 62 fechas).
  function calendario(equipos) {
    var lista = equipos.slice();
    if (lista.length % 2 === 1) lista.push(null);   // descanso
    var n = lista.length;
    var fechas = [];
    for (var r = 0; r < n - 1; r++) {
      var fecha = [];
      for (var i = 0; i < n / 2; i++) {
        var x = lista[i], y = lista[n - 1 - i];
        if (x && y) fecha.push(r % 2 === 0 ? [x, y] : [y, x]);
      }
      fechas.push(fecha);
      // rota todos menos el primero
      lista.splice(1, 0, lista.pop());
    }
    // vuelta: se invierte local/visitante
    var vuelta = fechas.map(function (f) {
      return f.map(function (p) { return [p[1], p[0]]; });
    });
    return fechas.concat(vuelta);
  }

  function jugarLiga(equipos, rng, registro, sanc) {
    var tabla = {};
    equipos.forEach(function (e) {
      tabla[e.nombre] = { equipo: e, pj: 0, pg: 0, pe: 0, pp: 0, pts: 0, puntajeTotal: 0 };
    });
    var fechas = calendario(equipos);
    fechas.forEach(function (fecha, indiceFecha) {
      fecha.forEach(function (p) {
        var local = p[0], visitante = p[1];
        var pr = jugarOficial(local, visitante, rng, sanc);
        var r = pr.resultado;
        if (registro) {
          var reg = registroPartido(local, visitante, pr);
          reg.fecha = indiceFecha + 1;
          registro.push(reg);
        }
        var tl = tabla[local.nombre], tv = tabla[visitante.nombre];
        tl.pj++; tv.pj++;
        if (r === "L") { tl.pg++; tv.pp++; tl.pts += 3; }
        else if (r === "V") { tv.pg++; tl.pp++; tv.pts += 3; }
        else { tl.pe++; tv.pe++; tl.pts++; tv.pts++; }
      });
    });
    var filas = Object.keys(tabla).map(function (k) { return tabla[k]; });
    filas.forEach(function (f) { f.puntajeTotal = f.equipo.puntaje; });
    filas.sort(function (a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      return b.puntajeTotal - a.puntajeTotal;
    });
    return filas;
  }

  // ---------- Torneo completo ----------
  // Nombres de la ronda segun la cantidad de equipos que quedan.
  function nombreRonda(cantidad) {
    if (cantidad === 16) return "16avos";
    if (cantidad === 8) return "Cuartos de final";
    if (cantidad === 4) return "Semifinales";
    return "Ronda";
  }

  // Siembra segun la tabla: llave A = 1 vs 16, B = 2 vs 15, ..., H = 8 vs 9.
  function sembrarCuadro(top16) {
    var pares = [[0, 15], [1, 14], [2, 13], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]];
    return pares.map(function (p) { return [top16[p[0]].equipo, top16[p[1]].equipo]; });
  }

  function simularTorneo(opciones) {
    var rng = opciones.rng || crearRng();
    var equipos = opciones.clubes.concat([opciones.nuestro]);
    var partidosLiga = [];
    var sanc = opciones.sinSanciones ? null : crearSanciones();
    var tabla = jugarLiga(equipos, rng, partidosLiga, sanc);
    var nuestraPosicion = tabla.findIndex(function (f) { return f.equipo.esNuestro; }) + 1;
    var resultado = {
      tabla: tabla,
      partidos: partidosLiga,
      equipos: equipos.reduce(function (m, e) { m[e.nombre] = e; return m; }, {}),
      nuestraPosicion: nuestraPosicion,
      clasificamos: nuestraPosicion <= CONFIG.clasificados,
      rondas: [],
      campeon: null,
      subcampeon: null,
      tercero: null,
      nuestroResultado: "no clasificó"
    };
    if (!resultado.clasificamos) return resultado;

    var top16 = tabla.slice(0, CONFIG.clasificados);
    var llaves = sembrarCuadro(top16);
    var ganadores = [];
    var ronda = { nombre: nombreRonda(16), llaves: [] };
    llaves.forEach(function (p) {
      var r = llaveIdaVuelta(p[0], p[1], rng, sanc);
      ronda.llaves.push(detalleLlave(p, r));
      ganadores.push(r.ganador);
    });
    resultado.rondas.push(ronda);

    // Octavos del cuadro: cuartos A-B, C-D, E-F, G-H (8 -> 4)
    var cuartos = [];
    ronda = { nombre: "Cuartos de final", llaves: [] };
    for (var i = 0; i < 8; i += 2) {
      var r2 = llaveIdaVuelta(ganadores[i], ganadores[i + 1], rng, sanc);
      ronda.llaves.push(detalleLlave([ganadores[i], ganadores[i + 1]], r2));
      cuartos.push(r2.ganador);
    }
    resultado.rondas.push(ronda);

    // Semifinales: X = ganador(AB) vs ganador(CD); Y = ganador(EF) vs ganador(GH)
    var rX = llaveIdaVuelta(cuartos[0], cuartos[1], rng, sanc);
    var rY = llaveIdaVuelta(cuartos[2], cuartos[3], rng, sanc);
    resultado.rondas.push({
      nombre: "Semifinales",
      llaves: [detalleLlave([cuartos[0], cuartos[1]], rX), detalleLlave([cuartos[2], cuartos[3]], rY)]
    });

    // Final (partido unico) y tercer puesto (partido unico)
    var final = partidoUnico(rX.ganador, rY.ganador, rng, sanc);
    var tercerPuesto = partidoUnico(rX.perdedor, rY.perdedor, rng, sanc);
    var campeon = final.ganador;
    var subcampeon = final.perdedor;
    var tercero = tercerPuesto.ganador;
    resultado.campeon = campeon.nombre;
    resultado.subcampeon = subcampeon.nombre;
    resultado.tercero = tercero.nombre;
    resultado.rondas.push({
      nombre: "Final",
      llaves: [{ equipos: [rX.ganador.nombre, rY.ganador.nombre], ganador: campeon.nombre, partido: final.partido }]
    });
    resultado.rondas.push({
      nombre: "Tercer puesto",
      llaves: [{ equipos: [rX.perdedor.nombre, rY.perdedor.nombre], ganador: tercero.nombre, partido: tercerPuesto.partido }]
    });

    resultado.nuestroResultado = resultadoNuestro(resultado, opciones.nuestro);
    return resultado;
  }

  function detalleLlave(p, r) {
    return {
      equipos: [p[0].nombre, p[1].nombre],
      ida: r.ida,
      vuelta: r.vuelta,
      ganador: r.ganador.nombre
    };
  }

  function resultadoNuestro(res, nuestro) {
    var n = nuestro.nombre;
    if (res.campeon === n) return "campeón";
    if (res.subcampeon === n) return "subcampeón (perdió la final)";
    if (res.tercero === n) return "tercer puesto";
    var etapas = res.rondas;
    for (var i = 0; i < etapas.length; i++) {
      var ronda = etapas[i];
      var participo = ronda.llaves.some(function (l) {
        return (l.equipos || []).indexOf(n) !== -1;
      });
      if (!participo) continue;
      if (ronda.nombre === "16avos") return "eliminado en 16avos";
      if (ronda.nombre === "Cuartos de final") return "eliminado en cuartos de final";
      if (ronda.nombre === "Semifinales") return "eliminado en semifinales";
    }
    return "clasificó al cuadro";
  }

  // ---------- Exportacion ----------
  var API = {
    CONFIG: CONFIG,
    MENTALIDADES: MENTALIDADES,
    fuerza: fuerza,
    capitanEnCancha: capitanEnCancha,
    FORMACION: FORMACION,
    BANCO: BANCO,
    POSICIONES: POSICIONES,
    crearRng: crearRng,
    torneosDisponibles: torneosDisponibles,
    jugadoresDeTorneo: jugadoresDeTorneo,
    ruletaPick: ruletaPick,
    candidatosRuleta: candidatosRuleta,
    construirClubes: construirClubes,
    puntajeOnce: puntajeOnce,
    partido: partido,
    jugarPartido: jugarPartido,
    jugarOficial: jugarOficial,
    crearSanciones: crearSanciones,
    penales: penales,
    llaveIdaVuelta: llaveIdaVuelta,
    calendario: calendario,
    jugarLiga: jugarLiga,
    sembrarCuadro: sembrarCuadro,
    simularTorneo: simularTorneo
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.MotorOnceIdeal = API;
})(typeof window !== "undefined" ? window : globalThis);
