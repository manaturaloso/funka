# Vista previa de importación

El Excel Converse original ya está recibido. El calendario original enlazado permite exportación pública XLSX; se descargó una copia sin modificar el Google Sheet. La disponibilidad pública observada no garantiza un OAuth persistente ni equivale a sincronización diaria funcionando.

`scripts/preview-converse.py` usa openpyxl y produce un JSON de revisión, sin escribir Firebase. Compara encabezados normalizados, tolera columnas/pestañas históricas distintas, descarta separadores y conserva fechas ISO sin inventar zona horaria, responsables originales y enlaces completos. Señala fechas inválidas y estados desconocidos. Los grupos con misma tarea/tipo/fecha y versiones diferentes requieren resolución; los IDs estables son candidatos, no una importación ya aplicada. Sin fecha se agrupan solo datos completos idénticos.

Uso: `python3 scripts/preview-converse.py RUTA.xlsx --output .local-imports/preview.json`. `--sheet NOMBRE` puede repetirse. Pruebas: `python3 tests/test_converse_preview.py`.

Las copias y vistas previas reales quedan en `.local-imports/`, ignorado por Git. La copia analizada tiene 21 pestañas y 1224 candidatos, 1207 identidades propuestas, 17 grupos repetidos y 24 filas para revisar. Septiembre–octubre de 2026 contiene 23 pedidos: 13 entregados y 10 sin entregar. En producción, el alcance existente Converse corresponde al Equipo Andrea; no se crearon equipos ni marcas nuevos. Falta seleccionar período, resolver nombres contra personas reales y aplicar con validación e idempotencia. No hay todavía pantalla de importación publicada.

El calendario tiene nueve pestañas de marcas, filas de meses/días y campañas en rangos combinados. Debe analizarse su geometría real antes de generar fechas o canales. Branding/conversión/always-on no implica automáticamente WP o SIS. Las campañas ambiguas necesitan revisión; no crear pedidos arbitrarios.

## Importación aplicada

Se aplicó todo el historial al alcance existente Equipo Andrea → Converse: 1224 filas consolidadas en 1207 pedidos. Para repeticiones se eligió la pestaña más reciente (y luego la fila más reciente), guardando todas las versiones en importSource. Estados resultantes: 957 Entregado, 218 En revisión, 17 En proceso, 11 Pendiente y 4 Por asignar (sin estado utilizable en origen). Media se representa como Normal; el valor original se conserva. No se archivaron históricos ni se asignaron cuentas por semejanza de nombre. Los responsables originales quedan en el brief y la fuente; solo existe el superadmin en el directorio de Converse.

Comentarios y enlaces completos se copiaron también a sus subcolecciones. Fechas válidas se interpretan en America/Lima; errores de fecha permanecen en la fuente y se marcan para revisar, sin inventar fechas. Se preservó el estado Entregado incluso si el archivo no contiene una fecha/enlace válido. No se copiaron decks actuales a trabajos históricos ni se inventaron piezas. Cuatro pedidos consolidados requieren revisión de datos del origen.

Plan: .local-imports/converse-plan.json. Aplicador: scripts/apply-converse.mjs, después de compilar los tipos compartidos mediante npm run build. El modo por defecto compara y previsualiza; --apply exige --confirm con el hash exacto del plan. Valida el UID del propietario, superadmin activo verificado y el alcance. Cada lote crea padres y subcolecciones de forma atómica con precondiciones de inexistencia, comprueba la organización y avanza sparkGuard. Mantiene un registro único en adminActivity. Si hay un ID existente con otra fuente, aborta; con la misma fuente lo omite aunque el usuario haya editado el pedido. No sobrescribe ni elimina datos. Una interrupción permite repetir para completar los pedidos restantes. Las nuevas escrituras se verifican campo por campo después de decodificar Firestore.

La segunda vista previa encontró 0 pedidos nuevos y 1207 existentes. No es una sincronización del calendario ni una pantalla de carga de archivos; el importador se ejecutó desde el entorno autorizado. Para verlos en la app, elegir Pedidos de mis marcas y filtrar Equipo Andrea/Converse; Mis pedidos sigue mostrando solo asignaciones a tu UID.

## Calendario: extracción comprobada

scripts/preview-calendar.py identifica el año explícito del libro, filas de meses/días y rangos combinados sin fijar coordenadas. Descarta filas de días de la semana, excluye celdas de formato vacías y marca discontinuidades. El libro real produce 1561 bloques en nueve pestañas, con 365 columnas temporales válidas por pestaña. Existe un bloque con advertencia de extensión; cuatro títulos contienen evidencia explícita WP/SIS. No se convirtió la categoría inicial de enero en canal de todos los meses, porque la geometría cambia entre meses. Los 1561 bloques quedan para revisión; no se han creado pedidos de campaña ni se ha activado sincronización/cron. Converse tiene 26 bloques que se cruzan con octubre. .local-imports/calendar-review.md y calendar-preview.json conservan fechas/rangos para revisión y futura vinculación con pedidos existentes.

Pruebas: python3 tests/test_converse_preview.py; python3 tests/test_calendar_preview.py. Aplicador: firebase emulators:exec --config firebase.spark.json --project demo-funka --only firestore 'node tests/import-converse.mjs --emulator'. Nunca ejecutar los fixtures de integración fuera de demo-funka.

El calendario se cargó después como 1561 borradores privados en Administración → Campañas. Guardar revisiones conserva el origen y no genera pedidos. Véase CAMPAIGNS.md.
