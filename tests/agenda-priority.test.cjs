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

// Weighted weekly allocation: higher priority earns more slots, but low priority is not starved.
const allocationTitles = [
  {id:'high',agendaPriority:'high',agendaContinuity:true,watched:18,episodes:20},
  {id:'normal',agendaPriority:'normal',agendaContinuity:true,watched:10,episodes:20},
  {id:'low',agendaPriority:'low',agendaContinuity:true,watched:2,episodes:20}
];
const counts = Object.fromEntries(allocationTitles.map(a=>[a.id,0]));
const lastDay = {};
for(let day=0;day<7;day++){
  const usedToday=new Set();
  for(let slot=0;slot<2;slot++){
    const candidates=allocationTitles.filter(a=>!usedToday.has(a.id)).map(a=>({a,score:engine.calculateAllocationScore(a,counts[a.id],lastDay[a.id]===day-1,a.agendaContinuity)}));
    candidates.sort((x,y)=>y.score.allocationScore-x.score.allocationScore||y.score.priorityScore-x.score.priorityScore);
    const chosen=candidates[0].a;usedToday.add(chosen.id);counts[chosen.id]++;lastDay[chosen.id]=day;
  }
}
assert.ok(counts.high>counts.normal && counts.normal>counts.low, 'La prioridad alta debe recibir más espacios que normal y baja, sin excluirlas');
assert.equal(Object.values(counts).reduce((sum,n)=>sum+n,0),14, 'La distribución debe llenar exactamente los espacios disponibles');

const continuityOn=engine.calculateAllocationScore({agendaPriority:'normal',watched:10,episodes:20,agendaContinuity:true},0,true,true);
const continuityOff=engine.calculateAllocationScore({agendaPriority:'normal',watched:10,episodes:20,agendaContinuity:false},0,true,false);
assert.ok(continuityOff.allocationScore>continuityOn.allocationScore, 'Desactivar continuidad elimina la penalización por días consecutivos');
assert.equal(engine.calculateAllocationScore({agendaPriority:'normal',watched:10,episodes:20},0,true,false).allocationScore,
  engine.calculateAllocationScore({agendaPriority:'normal',watched:10,episodes:20},0,false,false).allocationScore,
  'Sin continuidad, la consecutividad no afecta el reparto');
console.log('OK: distribución ponderada, continuidad y ausencia de exclusión de prioridad baja.');
