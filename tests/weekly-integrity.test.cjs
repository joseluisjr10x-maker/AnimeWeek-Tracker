const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'web', 'index.html'), 'utf8');
function sliceBetween(start, end) {
  const a = html.indexOf(start); const b = html.indexOf(end, a);
  assert(a >= 0 && b > a, `No se encontró bloque ${start}`);
  return html.slice(a, b);
}
const helperCode = sliceBetween('function aniListConfirmedDay(a){', 'async function previewWeeklyRenewal(manual=false){');
const anchorCode = sliceBetween('function prepareAiringAnchor(proposal,id,targetDay,nextEpisode,latestAired,capacities,days){', 'function normalizeNonAiringSlots(proposal, sourceIds, days){');
const scheduledCode = sliceBetween('function isScheduled(id){', 'function queueEntry(id,reason){');
const applyCode = sliceBetween('function applyWeeklyRenewal(){', '// Reorganización manual de la semana ACTUAL.');
const library = {
  existing: {id:'existing', title:'Anime existente', status:'airing', watched:2, nextLabel:'Episodio 3'},
  blocker: {id:'blocker', title:'Anime que ocupa el día', status:'watching', watched:1},
  waiting: {id:'waiting', title:'Anime en espera', status:'planned', watched:0},
  airingWait: {id:'airingWait', title:'Emisión en espera', status:'airing', watched:0},
  completed: {id:'completed', title:'Anime terminado', status:'completed', watched:12, episodes:12},
  paused: {id:'paused', title:'Anime pausado', status:'paused', watched:3, episodes:24},
  unknown: {id:'unknown', title:'Datos incompletos', status:'watching', watched:0}
};
const context = {
  data: {},
  anime: id => library[id],
  calendarEntryForAnime: a => (a && (a.id === 'existing' || a.id === 'airingWait')) ? {airingAt: 99} : null,
  airingDayFromTimestamp: () => 'miércoles',
  getAgendaCapacities: () => ({lunes:1,martes:1,miércoles:1,jueves:0,viernes:0,sábado:0,domingo:0}),
  isoWeekKey: () => '2026-W45',
  shuffleNonAiringSlots: schedule => ({schedule,moves:[]}),
  isWeeklyFixedAnime: () => false,
  isSpecialExtra: () => false,
  scheduleCount: (schedule, day) => (schedule[day] || []).length,
  structuredClone: value => structuredClone(value),
  isEmptyAgendaSlot: slot => !slot || !slot.id,
  WEEK_DAYS: ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'],
  console,
  window: {},
  alert: message => { context.lastAlert = message; },
  confirm: () => true,
  closeModal: () => {},
  save: () => { context.saved = true; },
  document: {getElementById: () => null}
};
vm.createContext(context);
vm.runInContext(helperCode + '\n' + anchorCode + '\n' + scheduledCode + '\n' + applyCode, context);
const run = (code) => vm.runInContext(code, context);
const days = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
const capacities = {lunes:1,martes:0,miércoles:1,jueves:0,viernes:0,sábado:0,domingo:0};

// A09/A10: queued title must not take the old slot while an airing anchor is recalculated.
context.data = {
  schedule: {lunes:[{id:'existing',ep:'Episodio 3'}], martes:[{id:'existing',ep:'Episodio 4'}], miércoles:[{id:'blocker',ep:'Episodio 2'}]},
  doneSlots: {}, waitlist: [{id:'waiting',reason:'random'}], settings: {}
};
let proposal = context.makeWeeklyProposal();
assert.strictEqual(proposal.promoted.length, 0, 'La promoción debe diferirse durante la preparación');
context.prepareAiringAnchor(proposal, 'existing', 'miércoles', 4, 3, capacities, days);
context.restoreMissingWeeklyAssignments(proposal, proposal.protectedAssignments);
context.promoteWaitlistIntoProposal(proposal, context.data.waitlist, capacities);
assert((proposal.schedule.lunes||[]).some(x=>x.id==='existing'), 'El anime existente debe conservar el lunes');
assert((proposal.schedule.martes||[]).some(x=>x.id==='existing'), 'Las asignaciones previas de otros días también se conservan cuando no cabe el anclaje');
assert(!(proposal.schedule.lunes||[]).some(x=>x.id==='waiting'), 'El anime en espera no puede reemplazar al existente');
assert.strictEqual(proposal.waitlist.length, 1, 'Si no hay espacio libre, el título permanece en espera');
assert.deepStrictEqual(Array.from(context.validateWeeklyProposal(proposal, proposal.protectedAssignments)), []);

// Si hay un hueco real, la promoción se hace en el hueco y no desplaza la agenda previa.
context.getAgendaCapacities = () => ({lunes:1,martes:1,miércoles:1,jueves:1,viernes:0,sábado:0,domingo:0});
proposal = context.makeWeeklyProposal();
context.prepareAiringAnchor(proposal, 'existing', 'miércoles', 4, 3, {lunes:1,martes:1,miércoles:1,jueves:0,viernes:0,sábado:0,domingo:0}, days);
context.restoreMissingWeeklyAssignments(proposal, proposal.protectedAssignments);
context.promoteWaitlistIntoProposal(proposal, context.data.waitlist, {lunes:1,martes:1,miércoles:1,jueves:1,viernes:0,sábado:0,domingo:0});
assert((proposal.schedule.lunes||[]).some(x=>x.id==='existing'), 'La asignación previa se conserva');
assert((proposal.schedule.jueves||[]).some(x=>x.id==='waiting'), 'La lista de espera solo usa el día libre');
assert.strictEqual(proposal.waitlist.length, 0);
assert.deepStrictEqual(Array.from(context.validateWeeklyProposal(proposal, proposal.protectedAssignments)), []);

// A12: recuperar una asignación desaparecida y bloquear una propuesta inconsistente.
const missing = {schedule:{lunes:[]}, waitlist:[], protectedAssignments:[{id:'existing',day:'lunes',slot:{id:'existing',ep:'Episodio 3'}}]};
context.restoreMissingWeeklyAssignments(missing, missing.protectedAssignments);
assert((missing.schedule.lunes||[]).some(x=>x.id==='existing'));
const invalid = {schedule:{lunes:[]},waitlist:[]};
assert(context.validateWeeklyProposal(invalid,[{id:'existing'}]).length > 0);
context.window.__weeklyProposal = {...invalid, weekKey:'2026-W45', protectedAssignments:[{id:'existing'}]};
context.saved = false;
context.applyWeeklyRenewal();
assert.strictEqual(context.saved, false, 'La renovación inválida debe abortarse sin guardar datos');
assert(String(context.lastAlert||'').includes('No se modificó ningún dato'), 'Debe explicar que no se modificaron datos');

// A09: la etiqueta "En agenda" solo se deriva de los siete días visibles, no de claves obsoletas.
context.data = {schedule:{legacy:[{id:'existing'}], lunes:[]}};
assert.strictEqual(context.isScheduled('existing'), false);
context.data.schedule.lunes=[{id:'existing'}];
assert.strictEqual(context.isScheduled('existing'), true);

// A13: el snapshot de agenda incluye todos los títulos, aunque estén completados, pausados o tengan datos incompletos.
context.data = {schedule:{lunes:[{id:'completed',ep:'Episodio 12'}],martes:[{id:'paused',ep:'Episodio 4'}],miércoles:[{id:'unknown',ep:'Episodio 1'}],jueves:[],viernes:[],sábado:[],domingo:[]}};
const required = context.captureRequiredAgendaAssignments(context.data.schedule);
assert.deepStrictEqual(Array.from(required.map(x=>x.id)), ['completed','paused','unknown']);
const proposalAll = {schedule:{lunes:[],martes:[],miércoles:[],jueves:[],viernes:[],sábado:[],domingo:[]},requiredAgendaAssignments:required};
context.restoreRequiredAgendaAssignments(proposalAll,required);
assert.deepStrictEqual(Array.from(context.validateAgendaInvariant(proposalAll,required)), []);
assert.deepStrictEqual(Array.from(['lunes','martes','miércoles'].map(day=>proposalAll.schedule[day][0].id)), ['completed','paused','unknown']);

// A14: si falta un título o ya no existe en biblioteca, la validación impide aplicar la propuesta.
proposalAll.schedule.martes=[];
assert(context.validateAgendaInvariant(proposalAll,required).some(x=>x.includes('pausado')));
proposalAll.schedule.martes=[{id:'paused',ep:'Episodio 4'}];
const missingLibrary = [...required,{id:'deleted',day:'jueves',slot:{id:'deleted',ep:'Episodio 1'}}];
assert(context.validateAgendaInvariant(proposalAll,missingLibrary).some(x=>x.includes('deleted')));

// A15: el reset conserva solo títulos protegidos, sin depender del estado de progreso de la biblioteca.
assert(html.includes("isWeeklyFixedAnime(a)||agendaAiringIsConfirmed(a)"));
assert(html.includes("data.schedule[day]=protectedSlots[day]||[]"));
assert(html.includes("doneEpisodes.add"));

// A15b: restablecer libera asignaciones hacia la cola sin borrar títulos ni alterar sus estados.
assert(html.includes("const freedIds=[...new Set(Object.values(previous).flat().filter(slot=>slot?.id&&!protectedIds.has(slot.id)).map(slot=>slot.id))]"));
assert(html.includes("freedIds.forEach(id=>queueEntry(id,'reset-agenda'))"));
assert(html.includes("data.waitlist=(data.waitlist||[]).filter(entry=>entry?.id&&anime(entry.id)&&!stillScheduled.has(entry.id))"));
assert(html.includes("estados, progreso y extras intactos"));

// A16: las prioridades manuales y el control de continuidad participan en el motor de selección.
assert(html.includes("a.agendaPriority==='high'?42"));
assert(html.includes("a.agendaPriority==='low'?-42"));
assert(html.includes("t.a?.agendaContinuity!==false&&tokens.some(other=>other.id===t.id&&Number(other.ep)<Number(t.ep))"));
assert(html.includes("validateAgendaInvariant(p,p.requiredAgendaAssignments||[])"));

console.log('OK: pruebas de regresión de integridad semanal aprobadas (incluye bloqueo transaccional).');
