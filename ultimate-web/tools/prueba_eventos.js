const M = require('../motor.js');
const datos = JSON.parse(require('fs').readFileSync(__dirname + '/../data/jugadores.json', 'utf8'));
const torneo = '2026 TORNEO APERTURA';
const pool = M.jugadoresDeTorneo(datos, torneo);
const once = []; const excl = {};
const rng0 = M.crearRng(5);
const usados = {};
for (const pos of M.POSICIONES) for (let i = 0; i < M.FORMACION[pos]; i++) {
  const j = M.ruletaPick(pool, pos, usados, rng0); usados[j.jugador] = true; excl[j.jugador] = true; once.push(j);
}
const nuestro = { nombre: 'Nosotros', esNuestro: true, once, puntaje: M.puntajeOnce(once) };
const clubes = M.construirClubes(datos, torneo, excl);
const r1 = M.simularTorneo({ clubes, nuestro, rng: M.crearRng(42) });
const r2 = M.simularTorneo({ clubes, nuestro, rng: M.crearRng(42) });
console.log('Determinista (misma semilla):', JSON.stringify(r1.tabla.map(f=>f.pts)) === JSON.stringify(r2.tabla.map(f=>f.pts)), '| campeón', r1.campeon, '=', r2.campeon);
console.log('Partidos de liga registrados:', r1.partidos.length, '| fechas', Math.min(...r1.partidos.map(p=>p.fecha)), '-', Math.max(...r1.partidos.map(p=>p.fecha)));

// Coherencia: goles por evento == marcador; resultado coherente con goles
let malGoles = 0, malRes = 0, goles = 0, amar = 0, rojas = 0;
for (const p of r1.partidos) {
  const gL = p.eventos.filter(e => e.tipo === 'gol' && e.equipo === p.local).length;
  const gV = p.eventos.filter(e => e.tipo === 'gol' && e.equipo === p.visitante).length;
  if (gL !== p.golesL || gV !== p.golesV) malGoles++;
  const r = p.golesL > p.golesV ? 'L' : p.golesL < p.golesV ? 'V' : 'E';
  if (r !== p.resultado) malRes++;
  goles += gL + gV; amar += p.eventos.filter(e => e.tipo === 'amarilla').length; rojas += p.eventos.filter(e => e.tipo === 'roja').length;
}
console.log('Partidos con goles que no cuadran:', malGoles, '| resultado que no cuadra con goles:', malRes);
console.log('Promedio goles por partido:', (goles / r1.partidos.length).toFixed(2), '| amarillas por partido:', (amar / r1.partidos.length).toFixed(2), '| rojas totales:', rojas);
// Nuestros partidos: primeros eventos
const nuestros = r1.partidos.filter(p => p.local === 'Nosotros' || p.visitante === 'Nosotros');
console.log('Nuestros partidos de liga:', nuestros.length);
const f3 = nuestros.find(p => p.fecha === 3);
console.log('Fecha 3:', f3 && (f3.local + ' ' + f3.golesL + '-' + f3.golesV + ' ' + f3.visitante), JSON.stringify(f3 && f3.eventos));
