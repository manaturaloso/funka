"""Convert an inspected preview to an auditable import plan; no network writes."""
import argparse,hashlib,json
from datetime import datetime,timezone
from pathlib import Path
from zoneinfo import ZoneInfo

def iso(v):
 try:
  if not isinstance(v,str):return None
  d=datetime.fromisoformat(v)
  if not 2000<=d.year<=2100:return None
  return d.replace(tzinfo=ZoneInfo('America/Lima')).astimezone(timezone.utc).isoformat().replace('+00:00','Z')
 except ValueError:return None

def plan(preview,actor,team='eq-andrea',brand='converse-pe'):
 if preview.get('format')!='funka-converse-preview-v1':raise ValueError('Unsupported preview')
 rank={s['name']:i for i,s in enumerate(preview['sheets'])};groups={}
 for row in preview['rows']:groups.setdefault(row['id'],[]).append(row)
 orders=[]
 for key,versions in groups.items():
  versions=sorted(versions,key=lambda r:(rank[r['sheet']],r['row']));row=versions[-1];f=row['fields'];state=f['estado'];status=state if state in ('Pendiente','En proceso','En revisión','Entregado') else 'Por asignar'
  channel={'wp':'WP','sis':'SIS'}.get(str(f['tipo'] or '').strip().lower())
  notes=[str(f['comentarios'] or '').strip(),f"Importado de Excel: {row['sheet']} · fila {row['row']}"]
  if f['responsable']:notes.append('Responsable original: '+str(f['responsable'])+' (pendiente de vincular a un usuario autorizado).')
  issues=[i for i in row['issues'] if not i.startswith('identidad repetida')]
  if issues:notes.append('Revisar datos de origen: '+'; '.join(issues))
  if len(versions)>1:notes.append(f'{len(versions)} registros del origen consolidados; se conserva el de la pestaña más reciente y todas sus versiones.')
  source={'kind':'converse-xlsx','sha256':preview['sourceSha256'],'selectedSheet':row['sheet'],'selectedRow':row['row'],'originalAssignee':f['responsable'],'issues':issues,'versions':[{k:r[k] for k in ('sheet','row','fields','links')} for r in versions]}
  order={'id':key,'teamId':team,'brandId':brand,'title':f['tarea'].strip(),'description':'\n\n'.join(n for n in notes if n),'type':f['tipo'] or 'Otro','channel':channel,'priority':{'Alta':'Alta','Baja':'Baja','Urgente':'Urgente'}.get(f['prioridad'],'Normal'),'assigneeUid':None,'collaborators':[],'deadline':iso(f['deadline']),'status':status,'pieces':[],'assignedUids':[],'createdBy':actor,'revision':1,'archived':False,'deadlineMode':'manual','review':'Pendiente','deliveryUrl':row['links'][0] if row['links'] else None,'deckWarning':bool(channel and status!='Entregado'),'block':None,'dependencies':[],'importSource':source,'sourceAssignedAt':iso(f['fecha']),'sourceDeliveredAt':iso(f['entregado'])}
  # Keep source dates separate from the operational import timestamps.
  orders.append({'order':order,'createdAt':iso(f['fecha']),'deliveredAt':iso(f['entregado']),'comments':str(f['comentarios'] or ''),'links':row['links']})
 return {'format':'funka-converse-plan-v1','sourceSha256':preview['sourceSha256'],'actorUid':actor,'teamId':team,'brandId':brand,'sourceRows':len(preview['rows']),'orders':orders}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('preview');p.add_argument('--actor',required=True);p.add_argument('--output',required=True);a=p.parse_args();result=plan(json.loads(Path(a.preview).read_text()),a.actor);out=Path(a.output);out.write_text(json.dumps(result,ensure_ascii=False,indent=2));out.chmod(0o600);print(json.dumps({'orders':len(result['orders']),'sourceRows':result['sourceRows'],'sourceSha256':result['sourceSha256']}))
