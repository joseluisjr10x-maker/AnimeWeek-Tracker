const assert = require('node:assert/strict');
const engine = require('../web/agenda-priority.js');

const highNew = engine.calculatePriorityScore({id:'high-new',agendaPriority:'high',watched:0,episodes:24});
const normalNearEnd = engine.calculatePriorityScore({id:'normal-end',agendaPriority:'normal',watched:23,episodes:24});
const normalEarly = engine.calculatePriorityScore({id:'normal-early',agendaPriority:'normal',watched:2,episodes:24});
const lowComplete = engine.calculatePriorityScore({id:'low-complete',agendaPriority:'low',watched:12,episodes:12});

assert.equal(highNew.score, 70, 'La prioridad alta debe empezar en 70');
assert.equal(normalNearEnd.score, 63.75, 'El progreso aporta hasta 30 puntos');
assert.ok(highNew.score > normalNearEnd.score, 'La prioridad manual debe prevalecer sobre una prioridad inferior');
assert.ok(normalNearEnd.score > normalEarly.score, 'Entre prioridades iguales, avanza primero el anime más próximo al final');
assert.equal(lowComplete.score, 30, 'Un anime de prioridad baja conserva su peso manual aunque esté completo');
assert.equal(engine.calculatePriorityScore({agendaPriority:'unknown'}).priority, 'normal', 'Una prioridad ausente o inválida usa normal');
assert.equal(engine.calculatePriorityScore({agendaPriority:'normal',watched:8,episodes:0}).progressKnown, false, 'Los episodios desconocidos no inventan progreso');
assert.equal(engine.calculatePriorityScore({agendaPriority:'normal',watched:40,episodes:12}).progressPercent, 100, 'El progreso se limita al 100%');
assert.equal(engine.calculatePriorityScore({agendaPriority:'normal',watched:-2,episodes:12}).progressPercent, 0, 'El progreso negativo se limita a cero');

const ranked = engine.rankAnime([
  {id:'normal-early',agendaPriority:'normal',watched:2,episodes:24},
  {id:'high-new',agendaPriority:'high',watched:0,episodes:24},
  {id:'normal-end',agendaPriority:'normal',watched:23,episodes:24}
]);
assert.deepEqual(ranked.map(item => item.id), ['high-new','normal-end','normal-early']);
assert.deepEqual(engine.rankAnime([{id:'a'},{id:'b'}]).map(item=>item.id), ['a','b'], 'Los empates conservan el orden original');

console.log('OK: pruebas del motor aislado de prioridades aprobadas.');
