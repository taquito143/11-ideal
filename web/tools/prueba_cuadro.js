const M = require('../motor.js');
const datos = JSON.parse(require('fs').readFileSync(__dirname + '/../data/jugadores.json', 'utf8'));
const torneo = '2026 TORNEO APERTURA';
const pool = M.jugadoresDeTorneo(datos, torneo);
// Equipo fuerte: los mejores PrT por posicion (equipo de prueba para forzar clasificacion)
const once = []; const excl = {};
for (const pos of M.POSICIONES) {
  const top = pool.filter(j => j.pos === pos && j.partidos >= 10).sort((a, b) => b.promedio - a.promedio).slice(0, M.FORMACION[pos]);
  top.forEach(j => { once.push(j); excl[j.jugador] = true; });
}
const nuestro = { nombre: 'Nosotros', esNuestro: true, once, puntaje: M.puntajeOnce(once) };
const clubes = M.construirClubes(datos, torneo, excl);
console.log('Puntaje nuestro:', nuestro.puntaje.toFixed(1), '| 11 titulares:', once.length);
const cont = {}; let clasif = 0;
for (let s = 1; s <= 300; s++) {
  const r = M.simularTorneo({ clubes, nuestro, rng: M.crearRng(s) });
  cont[r.nuestroResultado] = (cont[r.nuestroResultado] || 0) + 1;
  if (r.clasificamos) clasif++;
  if (s === 1) {
    console.log('Pos nuestra:', r.nuestraPosicion, '| campeón:', r.campeon, '| sub:', r.subcampeon, '| tercero:', r.tercero);
    r.rondas.forEach(rd => console.log('  ', rd.nombre, '-', rd.llaves.length, 'llaves; ej:', JSON.stringify(rd.llaves[0]).slice(0, 160)));
  }
}
console.log('Clasificamos:', clasif, '/ 300');
console.log(cont);
