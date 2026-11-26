const M = require('../motor.js');
const fs = require('fs');
const datos = JSON.parse(fs.readFileSync(__dirname + '/../data/jugadores.json', 'utf8'));
const torneo = '2026 TORNEO APERTURA';
const pool = M.jugadoresDeTorneo(datos, torneo);
const rng = M.crearRng(12345);

// 1) Armar nuestro equipo con la ruleta (sin repetir)
const usados = {}; const once = []; const excluidos = {};
for (const pos of M.POSICIONES) {
  for (let i = 0; i < M.FORMACION[pos]; i++) {
    const j = M.ruletaPick(pool, pos, usados, rng);
    usados[j.jugador] = true; excluidos[j.jugador] = true; once.push(j);
  }
}
const nuestro = { nombre: 'Nosotros', esNuestro: true, once, puntaje: M.puntajeOnce(once) };
console.log('Nuestro once:', once.map(j => j.pos + ':' + j.jugador + '(' + j.promedio + ')').join(' | '));
console.log('Puntaje nuestro:', nuestro.puntaje.toFixed(2));

// 2) Clubes (excluyendo a nuestros jugadores)
const clubes = M.construirClubes(datos, torneo, excluidos);
console.log('Clubes armados:', clubes.length, '| todos con 11:', clubes.every(c => c.once.length === 11));
const repetidos = clubes.filter(c => c.once.some(j => excluidos[j.jugador])).length;
console.log('Clubes con jugador nuestro repetido:', repetidos);

// 3) Calendario: cada par juega 2 veces, 60 fechas por equipo
const equipos = clubes.concat([nuestro]);
const cal = M.calendario(equipos);
const pares = {}; cal.forEach(f => f.forEach(([a, b]) => { const k = a.nombre + '>' + b.nombre; pares[k] = (pares[k] || 0) + 1; }));
const todosDos = Object.values(pares).every(v => v === 1) && Object.keys(pares).length === equipos.length * (equipos.length - 1);
console.log('Partidos:', Object.values(pares).reduce((a, b) => a + b, 0), '| cada par una vez por sentido:', todosDos);

// 4) Simular torneo completo, varias veces
const estadisticas = {};
let clasifico = 0;
for (let s = 1; s <= 200; s++) {
  const r = M.simularTorneo({ clubes, nuestro, rng: M.crearRng(s) });
  estadisticas[r.nuestroResultado] = (estadisticas[r.nuestroResultado] || 0) + 1;
  if (r.clasificamos) clasifico++;
  if (s === 1) {
    console.log('Tabla top 5:', r.tabla.slice(0, 5).map(f => f.equipo.nombre + ' ' + f.pts + 'pts').join(', '));
    console.log('Campeon:', r.campeon, '| Subcampeon:', r.subcampeon, '| Tercero:', r.tercero, '| nuestra pos:', r.nuestraPosicion);
    r.rondas.forEach(rd => console.log(' ', rd.nombre, rd.llaves.length, 'llaves'));
  }
}
console.log('Simulaciones:', 200, '| clasificamos en', clasifico);
console.log('Resultados nuestros:', estadisticas);
// 5) Ronda de prueba de partido
const pr = { L: 0, E: 0, V: 0 }; const rr = M.crearRng(7);
for (let i = 0; i < 1000; i++) pr[M.partido(clubes[0], clubes[1], rr)]++;
console.log('Partido club0 vs club1 (1000):', pr);
