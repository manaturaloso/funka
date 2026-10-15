import { describe, expect, it } from 'vitest';
import { canBootstrap, invitationSchema, scopeKey } from '../shared/access';
describe('Identidad y alcance', () => {
  it('requiere Google, correo verificado y el correo inicial exacto', () => {
    expect(canBootstrap({email:'joel.yc23@gmail.com',emailVerified:true,provider:'google.com'})).toBe(true);
    expect(canBootstrap({email:'joel.yc23@gmail.com',emailVerified:false,provider:'google.com'})).toBe(false);
    expect(canBootstrap({email:'joel.yc23@gmail.com',emailVerified:true,provider:'password'})).toBe(false);
    expect(canBootstrap({email:'intruso@example.test',emailVerified:true,provider:'google.com'})).toBe(false);
  });
  it('evita colisiones y segmentos de ruta en identificadores de acceso', () => {
    expect(scopeKey('equipo-1','cat')).not.toBe(scopeKey('equipo-2','cat'));
    expect(invitationSchema.safeParse({email:'member@example.test', scopes:[{teamId:'x/y',brandId:'cat'}]}).success).toBe(false);
    expect(invitationSchema.safeParse({email:'member@example.test', scopes:[{teamId:'x__y',brandId:'cat'}]}).success).toBe(false);
  });
});

import { assignedUids, readyForDelivery, linkSchema, pieceSchema, type Piece } from '../shared/orders';
const requiredPiece:Piece={id:'piece-1',name:'Banner',quantity:1,measures:'1200x600',format:'PNG',specs:'',references:[],group:'',order:0,required:true,assigneeUid:'member',deadline:null,state:'Pendiente',reason:'',deliveryUrl:null};
describe('Reglas de entrega y piezas',()=>{
  it('completar las piezas y entregar son acciones separadas con requisitos',()=>{
    expect(readyForDelivery({pieces:[requiredPiece],deliveryUrl:'https://mega.nz/file/a#key'})).not.toBeNull();
    expect(readyForDelivery({pieces:[{...requiredPiece,state:'Lista'}],deliveryUrl:null})).toBeNull();
    expect(readyForDelivery({pieces:[{...requiredPiece,state:'Lista'}],deliveryUrl:null},'Se entregó en reunión')).toBeNull();
    expect(readyForDelivery({pieces:[{...requiredPiece,state:'Lista',deliveryUrl:'https://mega.nz/file/a#key'}],deliveryUrl:null})).toBeNull();
    expect(readyForDelivery({pieces:[{...requiredPiece,state:'No aplica',reason:'No incluido en el brief'}],deliveryUrl:null})).toBeNull();
  });
  it('No aplica en pieza obligatoria exige motivo y la asignación agrega responsables por pieza',()=>{
    expect(pieceSchema.safeParse({...requiredPiece,state:'No aplica'}).success).toBe(false);
    expect(pieceSchema.safeParse({...requiredPiece,state:'No aplica',reason:'No incluido en el brief'}).success).toBe(true);
    expect(assignedUids({assigneeUid:'owner',collaborators:['owner','collaborator'],pieces:[requiredPiece]})).toEqual(['owner','collaborator','member']);
  });
  it('preserva fragmentos Mega y rechaza protocolos activos',()=>{
    expect(linkSchema.parse('https://mega.nz/file/example#FULL-key')).toBe('https://mega.nz/file/example#FULL-key');
    expect(linkSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(linkSchema.safeParse('data:text/html,foo').success).toBe(false);
  });
});


import { missingRequired,mergeDeck,copyDeckPiece,settingsSchema,type Deck } from '../shared/admin';
describe('Copias y conciliación de decks',()=>{
  const deck:Deck={id:'deck-test',revision:2,brandId:'cat',channel:'WP',name:'Deck',description:'',archived:false,isDefault:true,pieces:[{id:'template-1',name:'Banner actualizado',quantity:2,measures:'1600x900',format:'PNG',specs:'Nuevo brief',references:[],group:'Web',order:0,required:true}]};
  it('no comparte referencias de progreso y preserva identidad, responsables y entregas al actualizar',()=>{
    const original={...copyDeckPiece({...deck.pieces[0],name:'Original'}, {...deck,revision:1},'order-piece'),state:'Lista' as const,assigneeUid:'member',deadline:'2026-10-14T22:00:00.000Z',deliveryUrl:'https://mega.nz/file/test#key'};
    expect(original.references).not.toBe(deck.pieces[0].references);const merged=mergeDeck({pieces:[original]},deck,()=> 'new-piece');expect(original.name).toBe('Original');expect(merged.pieces[0]).toMatchObject({id:'order-piece',name:'Banner actualizado',quantity:2,state:'Lista',assigneeUid:'member',deadline:original.deadline,deliveryUrl:original.deliveryUrl,source:{revision:2}});
  });
  it('conserva piezas retiradas y manuales sin asociarlas por nombre',()=>{
    const retired=copyDeckPiece({...deck.pieces[0],id:'retired-template'},deck,'retired-piece');const manual={...requiredPiece,name:'Banner actualizado'};const merged=mergeDeck({pieces:[retired,manual]},deck,()=> 'new-piece');expect(merged.pieces).toHaveLength(3);expect(merged.pieces[0].retired).toBe(true);expect(merged.pieces[1]).toEqual(manual);expect(merged.added).toEqual(['new-piece']);
  });
  it('rechaza tipos duplicados y horas inválidas',()=>{
    expect(settingsSchema.safeParse({requestTypes:['Otro','otro'],deliveryHour:'17:00',syncHour:'07:00',autoDeadlineDays:2}).success).toBe(false);expect(settingsSchema.safeParse({requestTypes:['Otro'],deliveryHour:'25:00',syncHour:'07:00',autoDeadlineDays:2}).success).toBe(false);
  });
});

it('mantiene configuración antigua y detecta obligatorios vacíos sin exigir opcionales',()=>{
 const legacy=settingsSchema.parse({requestTypes:['Otro'],deliveryHour:'17:00',syncHour:'07:00',autoDeadlineDays:2});expect(legacy.requiredFields).toEqual([]);expect(legacy.display).toEqual({sectionLabels:false,helpTexts:true});
 expect(missingRequired({description:'   ',assigneeUid:null,deadline:null,channel:null},['description','assigneeUid','deadline','channel'])).toEqual(['Brief','Responsable principal','Fecha de entrega','Canal']);
 expect(missingRequired({description:'Brief'},[])).toEqual([]);expect(missingRequired({description:'Brief',assigneeUid:'member',deadline:'2026-12-01T22:00:00Z',channel:'WP'},['description','assigneeUid','deadline','channel'])).toEqual([]);
 expect(settingsSchema.safeParse({...legacy,requiredFields:['title']}).success).toBe(false);expect(settingsSchema.safeParse({...legacy,display:{sectionLabels:'false',helpTexts:true}}).success).toBe(false);
});
it('exportación CSV conserva Mega y evita fórmulas de hoja de cálculo',async()=>{const {csvCell}=await import('../shared/productivity');expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');expect(csvCell('https://mega.nz/file/x#FULL')).toBe('"https://mega.nz/file/x#FULL"');});
it('dependencias rechazan ciclos y permiten cadenas y ramas compartidas',async()=>{const {dependencyCycle}=await import('../shared/dependencies');expect(dependencyCycle({a:['b'],b:['c'],c:[]})).toBe(false);expect(dependencyCycle({a:['b','c'],b:['d'],c:['d'],d:[]})).toBe(false);expect(dependencyCycle({a:['a']})).toBe(true);expect(dependencyCycle({a:['b'],b:['c'],c:['a']})).toBe(true);});
it('recurrencias respetan pausas, intervalos, semanas y deadlines de Lima',async()=>{const {recurrenceSchema,recurrenceDue,occurrenceDeadline}=await import('../shared/recurrences');const r=recurrenceSchema.parse({id:'rec',teamId:'team',brandId:'brand',revision:0,enabled:true,title:'Recurrente',description:'',channel:null,priority:'Normal',assigneeUid:null,startDate:'2026-10-12',endDate:null,frequency:'weekly',interval:2,weekdays:[1],monthDay:1,deadlineDays:1,hour:'17:00'});expect(recurrenceDue(r,'2026-10-12')).toBe(true);expect(recurrenceDue(r,'2026-10-19')).toBe(false);expect(recurrenceDue(r,'2026-10-26')).toBe(true);expect(recurrenceDue({...r,enabled:false},'2026-10-26')).toBe(false);expect(occurrenceDeadline('2026-10-31',1,'17:00')).toBe('2026-11-01T22:00:00.000Z');expect(recurrenceSchema.safeParse({...r,startDate:'2026-02-31'}).success).toBe(false);});

import {createOrderSchema,planningFieldsSchema} from '../shared/orders';
describe('Campos de planificación del Excel',()=>{
 it('acepta pedidos anteriores y valida fechas reales y minutos positivos',()=>{
  expect(createOrderSchema.parse({teamId:'a',brandId:'b',requestId:'new',title:'Pedido'}).title).toBe('Pedido');
  expect(planningFieldsSchema.parse({campaignName:' Cyber ',estimatedMinutes:90,assignedOn:'2026-10-15',socialNetwork:'Instagram',postingDate:'2026-10-20'}).campaignName).toBe('Cyber');
  for(const value of [{postingDate:'2026-02-30'},{assignedOn:'2026-13-01'},{estimatedMinutes:0},{estimatedMinutes:1.5}])expect(planningFieldsSchema.safeParse(value).success).toBe(false);
 });
});

import {statuses,statusSchema,visibleStatus,visiblePriority,detailImageSchema} from '../shared/orders';
describe('Flujo de pendientes solicitado',()=>{
 it('ofrece estados nuevos y mantiene lectura de datos anteriores',()=>{
  expect(statuses).toEqual(['Por asignar','Pendiente','En proceso','Esperando material','Por validar','En pausa','Por subir','Entregado']);
  expect(statusSchema.parse('En revisión')).toBe('En revisión');expect(visibleStatus('En revisión')).toBe('Por validar');expect(visibleStatus('Bloqueado')).toBe('En pausa');expect(visiblePriority('Normal')).toBe('Media');expect(visiblePriority('Urgente')).toBe('Alta');
 });
 it('valida imágenes raster acotadas y no admite SVG ni direcciones activas',()=>{
  const value={id:'00000000-0000-4000-8000-000000000001',name:'brief.png',dataUrl:'data:image/png;base64,aGVsbG8='};expect(detailImageSchema.safeParse(value).success).toBe(true);
  expect(detailImageSchema.safeParse({...value,dataUrl:'data:image/svg+xml;base64,aGVsbG8='}).success).toBe(false);
  expect(detailImageSchema.safeParse({...value,dataUrl:'javascript:alert(1)'}).success).toBe(false);
  expect(planningFieldsSchema.safeParse({detailImages:[value,{...value,id:'00000000-0000-4000-8000-000000000002'},{...value,id:'00000000-0000-4000-8000-000000000003'}]}).success).toBe(false);
 });
});
