# Sincronización del calendario sin Blaze

Fuente autorizada: el Google Sheet enlazado por Joel, ID `1SaoG7PHCmVmKB7llxu2OFbYSVT6m25kWfNAU5I27hiQ`. El proceso descarga su exportación pública XLSX por HTTPS, valida año/eje temporal/pestañas y un máximo de 2000 campañas. No modifica la hoja. Una fuente inválida conserva lo confirmado y registra un error; no elimina campañas ni pedidos.

## Ejecución

`.github/workflows/calendar-sync.yml` usa un runner Linux estándar del repositorio público. Comprueba cada 30 minutos si ya pasó la hora diaria de Lima configurada en Administración; realiza una sincronización correcta por día, atiende solicitudes manuales pendientes y reintenta errores. GitHub puede retrasar sus cron: no se promete el minuto exacto. Solicitar actualización no es ejecución instantánea. La hora de entrega y los días de anticipación se toman de la configuración existente.

Administración → Campañas muestra último éxito, resultados, errores, coincidencias y una solicitud de actualización. Permite pausar/activar la comprobación diaria y abrir las ejecuciones. Una pausa no impide procesar solicitudes manuales explícitas. Una ejecución `workflow_dispatch` también fuerza una comprobación.

GitHub puede desactivar programaciones de repositorios públicos después de 60 días sin actividad; el panel señala si pasan más de 36 horas sin éxito. El propietario puede reactivar el workflow desde GitHub. Esto no activa Cloud Functions, Scheduler, Identity Platform ni facturación en Firebase. No hay garantías de disponibilidad superiores a las de GitHub y Firebase Spark.

## Identidad y privacidad

Workload Identity Federation acepta únicamente el ID de `manaturaloso/funka`, la rama `main`, este workflow y eventos `push`, `schedule` o `workflow_dispatch`. Acciones externas fijadas por SHA. No se guarda FIREBASE_TOKEN, una clave privada ni una contraseña en GitHub.

La cuenta técnica `funka-calendar` solo puede firmar su propio token; no tiene roles de proyecto ni de Firestore. Se autentica en Firebase como UID técnico `calendar-sync`, proveedor custom y claim calendarSync. Las reglas conceden permisos concretos para fuentes, estado, coincidencias y fechas automáticas. Esa identidad no es un integrante ni aparece en encargados; no puede leer/modificar usuarios, autorizaciones, administración o futuras credenciales de cuentas. No puede convertirse en Google ni usar la Administración de Joel.

El XLSX temporal se elimina; los logs contienen recuentos y estados, no campañas, imágenes ni tokens. No se publican los Excel ni las copias de Firestore. La configuración web reservada de Hosting aporta la clave pública del SDK y se comprueba el proyecto antes de usarla.

## Identidad y cambios

Se conservan los IDs de campañas existentes. Una coincidencia exacta sobrevive a filas desplazadas; un nombre único dentro de su pestaña permite detectar cambios de fecha. La fuente original sigue inmutable y se conserva una última observación separada. Una vuelta a la fuente original conserva su identidad. Duplicados, reemplazos y coincidencias dudosas se apartan para decisión de Joel; no se vincula por parecido ni se elige un duplicado arbitrario.

Nombre y fechas del borrador siguen al origen solo si aún coincidían con la observación anterior. Ajustes manuales se conservan y se señalan. No se cambian destinos ni canales revisados. Las altas no revisadas necesitan revisión y preparación de pedidos. Las ausencias se marcan; no se borran pedidos ni vínculos. Las decisiones de identidad quedan registradas y se atienden en la siguiente comprobación.

Solo se actualizan pedidos creados desde esa campaña y canal, en su destino vigente, abiertos, no archivados y con deadlineMode automatic. Se preservan campos creativos, responsables, piezas y entregas. Se omiten históricos enlazados, entregados y fechas manuales. Aceptar nuevas fechas en la revisión también actualiza esos pedidos inmediatamente. Cada actualización conserva antes/después, revisiones e historial; el proceso diario avisa a encargados/seguidores activos autorizados.

El guard de Spark y las precondiciones de versión impiden sobrescribir cambios concurrentes. Cada grupo de campaña/pedidos/historial/avisos es atómico. Una ejecución de varias campañas puede quedar parcialmente confirmada: lo confirmado se conserva, y el reintento idempotente continúa sin duplicarlo. El hash semántico evita escrituras y lecturas completas por cambios irrelevantes de empaquetado del XLSX.

## Operación y pruebas

- `node scripts/configure-calendar-identity.mjs`: previsualiza recursos IAM; `--apply` configura la identidad sin otorgarle IAM de Firestore. Requiere autenticación administrativa existente.
- `node scripts/sync-calendar.mjs --owner --file <preview.json>`: vista previa de solo lectura con la identidad administrativa; `--apply --force` aplica manualmente con versiones e historial. No es el mecanismo del workflow.
- `node scripts/sync-calendar.mjs --apply`: ejecución autónoma con credenciales federadas. `--force` fuerza una comprobación.
- Pruebas del proceso completo usan `--emulator` y proyecto demo-funka; ninguna fixture se envía a producción.

Las reparaciones de asociaciones campaña/canal/pedido se mantienen en la Fase 3. Esta fase no reasigna vínculos rotos ni crea sustitutos arbitrarios.
