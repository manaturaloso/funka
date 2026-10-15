# Respaldo y restauración de Firestore

El respaldo es manual mediante `scripts/firestore-snapshot.mjs`, usando la autenticación administrativa segura del entorno. No requiere Blaze ni el servicio de exportaciones administradas. Su destino de producción está fijado a funka-joel-2026; nunca se imprimen credenciales.

```bash
cd /workspace/funka
XDG_CONFIG_HOME=/tmp/funka-config node scripts/firestore-snapshot.mjs
```

El JSON queda en `.local-backups/`, ignorado por Git y fuera de Hosting, con permisos 0600, checksum SHA-256 y fecha consistente de lectura del servidor. Incluye documentos y subcolecciones, también subcolecciones bajo padres ausentes. Conserva valores Firestore originales (timestamps, enteros de 64 bits, referencias, arrays y enlaces completos). Límite: 10000 documentos o 32 MiB; superar el límite aborta sin guardar un archivo parcial. No contiene cuentas de Authentication, IAM, secretos del entorno ni configuración de Hosting.

Se ejecutó un respaldo real el 13 de octubre de 2026, con 100 documentos. Archivo local: `.local-backups/funka-joel-2026-2026-10-13T13-48-01.572Z.json`. Lectura consistente: `2026-10-13T13:46:03.695992Z`. SHA-256: `b5ac061302867568bd041a6dfe2e17e95f45b937c4cc0e04ffec25c08b2dc3c5`. Contiene datos privados: conservar una copia en almacenamiento privado autorizado; el archivo local no sobrevive necesariamente a la eliminación del entorno. No existe copia periódica automática.

## Restauración

Por defecto solo se previsualiza, sin escribir:

```bash
XDG_CONFIG_HOME=/tmp/funka-config node scripts/firestore-snapshot.mjs --mode restore --file .local-backups/ARCHIVO.json
```

Aplicar exige `--apply --confirm CHECKSUM_COMPLETO` y una base completamente vacía. El script nunca vacía ni sobrescribe una base existente. Valida proyecto, formato, conteo, rutas y checksum; crea lotes de hasta 200 documentos con precondición de inexistencia y verifica al final todos sus campos. En una interrupción o error parcial, revisar el destino antes de seguir; no reintentar ciegamente ni borrar producción para que el script pase. Los createTime/updateTime intrínsecos cambian al restaurar, pero los timestamps almacenados como campos se conservan.

La restauración se probó solo en demo-funka local. Las cuatro comprobaciones abarcan round-trip con enteros de 64 bits, timestamps, Mega, documento vacío y subcolección huérfana; rechazo de base no vacía y de checksum adulterado. No se restauró ni borró la base real.

```bash
XDG_CONFIG_HOME=/tmp/funka-config FIREBASE_EMULATORS_PATH=/workspace/.cache/firebase \
  npx firebase emulators:exec --config firebase.spark.json --project demo-funka --only firestore \
  'node tests/snapshot-roundtrip.mjs'
```

El test borra únicamente su emulador demo-funka local. No ejecutar con otros datos de desarrollo que se quieran conservar. Antes de cualquier intervención destructiva real, producir un respaldo nuevo y verificar su checksum; el historial de actividad no sustituye este archivo.

Antes de importar Converse se guardó otra copia consistente: 124 documentos; archivo .local-backups/funka-joel-2026-2026-10-14T03-17-54.200Z.json, lectura UTC 2026-10-14T03:15:57.992864Z (13 de octubre en Lima), SHA256 ccd8b4327a8da649a3468c303a741011fc210589bddb0666549cdb62be340a0e. Esta copia precede a los 1207 pedidos importados y permite inspeccionar el estado previo. No se ejecutó restauración ni borrado.
