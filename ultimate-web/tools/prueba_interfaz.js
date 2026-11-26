// Ejecuta app.js en Node con un DOM falso y dispara los eventos de los botones.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');

class El {
  constructor(tag, id) {
    this.tag = tag; this.id = id || ''; this.children = []; this.listeners = {};
    this.attrs = {}; this.classList = { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, contains(c){return this._s.has(c);} };
    this.className = ''; this.textContent = ''; this._html = ''; this.disabled = false; this.hidden = false; this.value = '';
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; this._cache = {}; if (v === '') this.children = []; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  click() { (this.listeners.click || []).forEach(f => f({ target: this })); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  scrollIntoView() {}
  querySelectorAll(sel) {
    // Simula los botones con data-modo / data-jornada que estan dentro del HTML renderizado.
    const attr = sel.match(/data-(modo|jornada)/);
    if (!attr) return [];
    const nombre = attr[1];
    const re = new RegExp('data-' + nombre + '="([^"]*)"', 'g');
    this._cache = this._cache || {};
    const out = []; let m;
    while ((m = re.exec(this._html))) {
      const clave = nombre + '=' + m[1] + '@' + m.index;
      if (!this._cache[clave]) { const e = new El('button'); e.attrs['data-' + nombre] = m[1]; this._cache[clave] = e; }
      out.push(this._cache[clave]);
    }
    return out;
  }
  get dataset() { return {}; }
}
const elementos = {};
global.document = {
  getElementById(id) { return elementos[id] || (elementos[id] = new El('div', id)); },
  createElement(tag) { const e = new El(tag); return e; },
  querySelectorAll() { return []; },
};
global.window = global;
global.MotorUltimate = require(path.join(raiz, 'motor.js'));
global.setInterval = (fn, ms) => { for (let i = 0; i < 40; i++) fn(); return 0; }; // gira de inmediato
global.clearInterval = () => {};
eval(fs.readFileSync(path.join(raiz, 'data/jugadores.js'), 'utf8'));
global.JUGADORES = window.JUGADORES;
eval(fs.readFileSync(path.join(raiz, 'app.js'), 'utf8'));

// Boton de cada casillero: el primero de la cancha es un ARQ; buscamos los botones .casillero
function casilleros() {
  const out = [];
  (function buscar(e) { if (e.className === 'casillero' || (e.className || '').startsWith('casillero')) out.push(e); e.children.forEach(buscar); })(elementos.cancha);
  (function buscar(e) { if ((e.className || '').startsWith('casillero')) out.push(e); e.children.forEach(buscar); })(elementos.banco);
  return out;
}
const pick = (id) => elementos[id];
const cont = casilleros();
console.log('casilleros renderizados:', cont.length);
const titulares = cont.slice(0, 11), suplentes = cont.slice(11);
console.log('plantilla inicial: simular deshabilitado =', pick('simular').disabled);

// 1) Llenar 11 titulares y 5 suplentes con la ruleta
function llenar(boton) {
  boton.click();                    // abre ruleta
  pick('ruleta-girar').click();     // gira
  pick('ruleta-elegir').click();    // elige
}
// Los botones se re-renderizan al elegir: reobtenemos la lista cada vez
for (let i = 0; i < 11; i++) { const lista = casilleros(); llenar(lista.slice(0, 11)[i]); }
for (let i = 0; i < 5; i++) { const lista = casilleros(); llenar(lista.slice(11)[i]); }
console.log('progreso:', pick('progreso').textContent);
console.log('simular habilitado =', !pick('simular').disabled);

// 2) Simulacion rapida
pick('simular').click();
const rap = pick('resultado').innerHTML;
console.log('resultado visible =', !pick('resultado').hidden);
console.log('modo rapida: tabla =', rap.includes('Tabla final'), '| cuadro =', rap.includes('Cuadro final'), '| resumen =', rap.includes('class="resumen"'));
console.log('modo rapida sin eventos:', !rap.includes('evento'));

// 3) Cambiar a simulacion lenta
// Cambiar a lenta: el handler de cada boton queda registrado en pintarResultado()
const botones = pick('resultado').querySelectorAll('[data-modo]');
console.log('botones de modo:', botones.map(b => b.attrs['data-modo']).join(','));
const lentaBtn = botones.find(b => b.attrs['data-modo'] === 'lenta');
lentaBtn.click();
const lentaHtml = pick('resultado').innerHTML;
console.log('modo lenta: titulo =', lentaHtml.includes('Simulación lenta'), '| partidos =', (lentaHtml.match(/class="partido/g)||[]).length, '| eventos =', (lentaHtml.match(/class="evento /g)||[]).length, '| navegacion =', lentaHtml.includes('Siguiente'));
const sig = pick('resultado').querySelectorAll('[data-jornada]').find(b => b.attrs['data-jornada'] === '1');
sig.click();
console.log('siguiente jornada =', pick('resultado').innerHTML.match(/<strong>([^<]+)<\/strong>/)[1]);
console.log('eventos con minuto:', (pick('resultado').innerHTML.match(/\d+' /g)||[]).length);
// los listeners reales se registraron sobre elementos temporales; los re-disparamos desde el handler real
// (app.js registra sobre los elementos devueltos por querySelectorAll, asi que los llamamos por su tipo)
// -> ejecucion directa de la rama 'lenta':
const lenta = (() => {
  // reconstruye: cambia modo y vuelve a pintar usando el mismo codigo de app.js
  return null;
})();
// Prueba indirecta: el HTML de lenta se genera al cambiar estado.modo; probamos con un segundo render
console.log('boton lenta presente en HTML =', !!lentaBtn);
