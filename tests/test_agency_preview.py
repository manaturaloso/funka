import importlib.util,tempfile,unittest
from pathlib import Path
from datetime import datetime
import openpyxl
spec=importlib.util.spec_from_file_location('agency_reader',Path(__file__).parents[1]/'scripts/preview-agency.py');reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
class AgencyPreviewTests(unittest.TestCase):
 def workbook(self):
  w=openpyxl.Workbook();s=w.active;s.title='NB DISEÑO';s.append(['MARCA','ENCARGADO','ASIGNADA EL','DEADLINE','PRIORIDAD','TIEMPO APROX.','CAMPAÑA','TIPO','DETALLE PEDIDO','ESTADO','ENLACE DE ENTREGA']);s.append(['NB','Ana / Luis',datetime(2026,10,15),datetime(2026,10,20),'Alta','1h 30min','Cyber','Mail','Preparar correo','Entregado','https://mega.nz/folder/prueba#CLAVE-completa']);return w
 def extract(self,w):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'source.xlsx';w.save(p);before=p.read_bytes();result=reader.preview(p);self.assertEqual(p.read_bytes(),before);return result
 def test_columns_dates_multiple_people_and_complete_mega_link(self):
  r=self.extract(self.workbook())['rows'][0];v=r['normalized'];self.assertEqual(v['brand'],'New Balance');self.assertEqual(v['assigneeNames'],['Ana','Luis']);self.assertEqual(v['assignedOn'],'2026-10-15');self.assertEqual(v['deadlineDate'],'2026-10-20');self.assertEqual(v['estimatedMinutes'],90);self.assertEqual(v['deliveryLinks'],['https://mega.nz/folder/prueba#CLAVE-completa']);self.assertTrue(r['requiresReview'])
 def test_copied_sheets_and_conflicting_brand_not_reassigned(self):
  w=self.workbook();w.copy_worksheet(w.active).title='UMBRO';r=self.extract(w);self.assertEqual(r['summary']['rows'],2);self.assertEqual(r['summary']['distinctRecords'],1);self.assertEqual(r['summary']['brandConflicts'],1);self.assertEqual(r['duplicateSheets'][0]['sheets'],['NB DISEÑO','UMBRO']);self.assertEqual(r['rows'][1]['normalized']['brand'],'New Balance')
 def test_posting_date_is_not_a_deadline(self):
  w=openpyxl.Workbook();s=w.active;s.title='COLISEUM CM';s.append(['RRSS','DÍA DE POSTEO','DETALLE PEDIDO','ESTADO','PRIORIDAD','TIPO DE PEDIDO']);s.append(['INSTAGRAM',datetime(2026,10,20),'Post campaña','Pendiente','Media','Video']);v=self.extract(w)['rows'][0]['normalized'];self.assertEqual(v['brand'],'Coliseum');self.assertEqual(v['postingDate'],'2026-10-20');self.assertIsNone(v['deadlineDate']);self.assertEqual(v['socialNetwork'],'INSTAGRAM')
 def test_listo_is_not_silently_converted_to_priority(self):
  w=self.workbook();w.active['E2']='LISTO';w.active['D2']='fecha desconocida';w.active['F2']='dos días';r=self.extract(w)['rows'][0];self.assertIsNone(r['normalized']['priority']);self.assertIsNone(r['normalized']['deadlineDate']);self.assertIsNone(r['normalized']['estimatedMinutes']);self.assertIn('priority:requiere-equivalencia',r['issues']);self.assertEqual(r['raw']['priority'],'LISTO')
 def test_malformed_concatenated_links_preserved_for_review(self):
  w=self.workbook();w.active['K2']='https://mega.nz/a#CLAVEhttps://mega.nz/b#OTRA';r=self.extract(w)['rows'][0];self.assertEqual(r['normalized']['deliveryLinks'],[]);self.assertIn('deliveryUrl:enlace-no-valido',r['issues']);self.assertIn('#CLAVE',r['raw']['deliveryUrl'])
 def test_optional_detail_is_not_discarded_and_formulas_are_not_executed(self):
  w=self.workbook();w.active['I2']=None;w.active['G2']=None;self.assertEqual(len(self.extract(w)['rows']),1)
  w.active['I2']='=WEBSERVICE("https://example.invalid")';r=self.extract(w)['rows'][0];self.assertIn('formulas:revisar-valores-cache',r['issues']);self.assertTrue(r['sourceFormulas']['I2'].startswith('=WEBSERVICE'))
 def test_conflicting_versions_keep_both_rows(self):
  w=self.workbook();values=[c.value for c in w.active[2]];values[9]='En proceso';w.active.append(values);r=self.extract(w);self.assertEqual(r['summary']['identityConflicts'],1);self.assertEqual(r['summary']['distinctRecords'],2)
if __name__=='__main__':unittest.main()
