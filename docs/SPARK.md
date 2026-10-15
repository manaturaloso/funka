# Primera versión sin facturación

Proyecto: `funka-joel-2026`. Sitio: `pendientesfunka`. Firestore Standard en `southamerica-east1`, con cuota gratuita, protección contra borrado y PITR desactivado. Firebase Authentication estándar con Google; no actualizar a Identity Platform ni Blaze.

## Alcance

Solo Joel (Google verificado joel.yc23@gmail.com vinculado a bootstrap) puede configurar equipos, marcas, accesos, decks, briefs y tipos, y editar pedidos con sus piezas, comentarios, entregas y revisiones. Los miembros activos crean y editan pedidos, piezas, comentarios, entregas y revisiones dentro de sus combinaciones autorizadas. Pueden archivar y recuperar; el borrado definitivo y la Administración siguen reservados a Joel. «Mis pedidos» muestra todos los pedidos de esos alcances, con filtro opcional por encargado. La selección de varios encargados usa casillas y preserva compatibilidad con el responsable y los colaboradores existentes.

Una invitación activa por correo se aplica automáticamente en el primer ingreso Google verificado, incluyendo equipos, marcas y directorio de encargados. Los perfiles pendientes anteriores también pueden canjearla; los miembros ya autorizados conservan las decisiones del administrador, incluida su desactivación. Sin invitación se registra un perfil pendiente. Véase INVITATIONS.md. En la vista de miembros se devuelve el perfil propio y los nombres de personas autorizadas al alcance; no se expone el directorio global ni correos ajenos.

La sincronización diaria, el lector del calendario real y la importación de los Excel originales están pendientes. CSV y respaldo manual de Firestore están disponibles; no hay automatización diaria. Los registros de actividad no sustituyen a un respaldo.

## Seguridad y diferencias con Functions

`VITE_FIREBASE_BACKEND=spark` selecciona `src/spark`; las llamadas a Functions no se usan. El adaptador conserva los esquemas, reglas de negocio, revisiones, idempotencia y copias de decks del backend anterior. Las reglas `firestore.spark.rules` autorizan escrituras colaborativas acotadas al equipo y marca, con identidad Google, revisiones crecientes y auditoría inmutable antes/después en la misma transacción. La Administración continúa exclusiva de Joel; las preferencias personales tienen su permiso propio limitado. Además de los controles de tipos, campos permitidos y operaciones en reglas, el adaptador valida reglas de negocio (por ejemplo ciclos/dependencias y completitud de piezas) en el navegador, no en un servidor dedicado: el acceso directo a Firestore no equivale a ejecutar todas las validaciones semánticas del adaptador. No afirmar que esta versión cumple la validación de negocio del servidor original.

El primer ingreso Google verificado de Joel fija un UID en `system/bootstrap` con la creación atómica de su perfil. Ese documento no admite actualización ni borrado; el propietario inicial tampoco puede perder el rol ni desactivarse. Los correos, UIDs y marcas de identidad de perfiles registrados no se pueden cambiar. Los miembros no pueden promoverse ni modificar grants. La actividad fija autor y hora de solicitud y no admite sobrescritura; la auditoría global no se puede borrar ni sobrescribir desde la aplicación; el borrado de un pedido por Joel puede retirar su historial local, conservando el registro global de la eliminación. Los borrados desde la interfaz crean un nuevo registro de eliminación con su alcance; el contenido de sus cambios sigue siendo declarado por el administrador.

Firestore en navegador no permite consultas dentro de transacciones. El adaptador consulta al servidor, lee cada documento retornado dentro de la transacción y utiliza `system/sparkGuard` en todas sus escrituras para detectar cambios concurrentes de pertenencia a consultas. Si las reglas rechazan una revisión concurrente antes de que Firestore evalúe sus precondiciones, el adaptador solo reintenta tras comprobar que el guard cambió, con un máximo de cinco intentos. Esto serializa las escrituras del adaptador, aumenta contención y consume lecturas; es apropiado para esta primera versión de baja concurrencia. No garantiza consultas atómicas ante escrituras administrativas externas que omitan ese guard. Es una diferencia respecto a Functions que deberá revisarse al ampliar colaboración.

Los módulos de `src/spark` derivan de `functions/src`; mantener ambos alineados al corregir validaciones. El backend anterior y sus pruebas siguen disponibles para desarrollo, pero no se despliegan con la configuración Spark.

## Desarrollo y publicación

Usar emuladores con `VITE_FIREBASE_BACKEND=spark`, `VITE_USE_EMULATORS=true` y proyecto `demo-funka`; arrancar Auth y Firestore con `firebase emulators:start --config firebase.spark.json --project demo-funka --only auth,firestore`. Nunca ejecutar fixtures contra producción.

```bash
npm run test:spark        # 15 pruebas de reglas
npm run test:spark:e2e    # 16 pruebas de navegador
npm test                 # 8 pruebas de dominio
```

El SDK público real se obtiene de la app `1:357365313775:web:75d0e12bc63f1ce747ab1a` y se guarda en `.env.production.local` (ignorado). Configurar sus cuatro identificadores `VITE_FIREBASE_*`, `VITE_USE_EMULATORS=false` y `VITE_FIREBASE_BACKEND=spark`. No incluir credenciales administrativas con prefijo `VITE_`.

`npm run deploy:spark` valida proyecto, sitio, configuración web y ausencia de Functions; compila y publica exclusivamente reglas, índices y Hosting mediante `firebase.spark.json`. No usar `firebase deploy` con la configuración anterior para esta versión. Para revertir, restaurar un commit anterior, compilarlo con su configuración compatible y desplegar; nunca revertir Hosting suponiendo que también revierte reglas o datos.

Las cuotas gratuitas pueden impedir operaciones cuando se agoten; mantener facturación desactivada evita pasar automáticamente a cargos. Las pruebas de navegador usan identidades sintéticas exclusivamente en emuladores; el ingreso Google real de Joel debe comprobarse en el sitio publicado.

## Eliminación definitiva por superadmin

Administración permite eliminar equipos, marcas, vínculos, decks, plantillas, autorizaciones, perfiles e historial administrativo. Configuración puede restablecerse a sus valores predeterminados; cada pedido tiene su propia acción Eliminar pedido. Archivar y recuperar siguen disponibles como alternativas.

Antes del borrado, la interfaz calcula la cantidad de documentos que se borrarán y las referencias que se actualizarán. Se exige escribir el nombre exacto. Confirmar reconstruye el plan y compara una huella de los documentos: cualquier cambio relevante obliga a revisar otra vista previa. La operación es una transacción atómica de hasta 400 documentos afectados, más su registro de auditoría y guard. Si supera ese límite, se bloquea sin cambios; los volúmenes mayores requieren reducir el alcance o una migración por lotes aún no implementada. Las consultas de planificación también están limitadas a 400 documentos por colección.

Borrar un equipo elimina sus vínculos y pedidos con comentarios, entregas y actividad; retira membresías, accesos, referencias en perfiles/invitaciones, notificaciones y vistas previas afectadas, y despeja cualquier equipo automático de marcas globales. Las marcas globales y otros equipos permanecen. Borrar una marca elimina sus vínculos y pedidos en todos los equipos y sus decks/versiones, con la misma limpieza de referencias. Borrar un vínculo elimina solo esa combinación y sus pedidos. Borrar un deck despeja sus punteros predeterminados y vistas previas, pero conserva las copias históricas que ya tienen los pedidos. Borrar un perfil retira permisos, notificaciones y autorizaciones asociadas y limpia asignaciones actuales; los UIDs de autor históricos se conservan.

Eliminar un perfil no borra la cuenta Google ni su registro en Firebase Authentication. Si vuelve a ingresar, se crea un perfil pendiente. El propietario inicial y los documentos de identidad/guard siguen protegidos para conservar acceso al espacio. Los administradores pueden eliminar datos directamente según las reglas; las garantías de cascada, confirmación y auditoría corresponden a la ruta de la aplicación, no a escrituras administrativas externas.

Añadir la función y desplegarla no ejecuta borrados de datos reales. Las pruebas de eliminación usan únicamente emuladores.

## Identidad visual

Administración → Identidad visual permite cargar el logotipo completo y el símbolo desde el dispositivo del superadmin. PNG/JPG/WebP, máximo 250 KB por archivo y 7000 píxeles por lado. Los bytes se conservan; no se redibuja, recorta ni comprime automáticamente. La vista previa no publica nada: Guardar identidad visual aplica ambos archivos. Quitar y guardar retira una imagen.

Las imágenes se guardan en `branding/public`, con límite total inferior a 1 MiB; no se usa Firebase Storage ni se habilita facturación. El documento es público para mostrar el ingreso y el favicon antes de autenticarse. Las reglas aceptan exclusivamente los campos de imágenes, revisión y fecha; no guardar datos privados allí. Solo un superadmin Google activo puede escribirlo. SVG, URL externas y campos adicionales se rechazan. Los nombres y contenido de archivos no se insertan como HTML. La auditoría registra presencia de imágenes, sin duplicar los datos de imagen.

El logo completo aparece en el ingreso, el símbolo en la cabecera y el favicon. La actualización se recibe en tiempo real y persiste al recargar. Los originales compartidos como imágenes del chat no aparecieron como archivos descargables; el superadmin debe cargarlos aquí. No afirmar que el logotipo oficial ya está incorporado mientras ese documento siga vacío. Los fixtures de imagen de las pruebas son sintéticos y permanecen en emuladores.

## Vistas personales

Cada integrante activo puede guardar, aplicar, actualizar y eliminar sus propias combinaciones de filtros, búsqueda, audiencia, archivo y modo tablero/lista/calendario. Se conservan al volver a entrar; los períodos relativos se evalúan al aplicar la vista. La interfaz permite hasta 20 vistas; este límite de cantidad no se impone en las reglas. Guardar una vista no amplía los accesos a marcas ni habilita edición de pedidos.

Los documentos viven en users/{uid}/views. Las reglas exigen una actualización atómica de preferencesRevision y preferencesUpdatedAt del perfil, sin permitir cambiar roles ni accesos. Otros miembros no pueden leerlos; superadmins pueden leerlos para limpiar la eliminación del perfil. La eliminación de un perfil incluye sus vistas.

## Configuración de formularios y textos

Administración → Gestionar → Tipos y configuración permite exigir brief, responsable, fecha y canal y ocultar etiquetas o ayudas. Los obligatorios se verifican en la creación y al guardar detalles, con lectura transaccional de la configuración vigente; en Spark se ejecuta en la aplicación y no impide escrituras administrativas externas. La política no reescribe pedidos antiguos. Las etiquetas están ocultas por defecto. El tablero conserva las columnas por estado, con filtros avanzados y vistas personales plegados.


## Productividad disponible

La bandeja agrupa avisos por pedido y permite marcar los propios como leídos. Los miembros activos pueden seguir/dejar de seguir pedidos autorizados mediante escrituras atómicas de su suscripción, contador del pedido y metadatos personales. Estas excepciones no permiten editar el pedido, cambiar roles ni generar notificaciones. Las reglas validan identidad Google, propiedad, alcance, campos permitidos y timestamps. El directorio people comparte UID y nombre por alcance, sin correos ajenos.

Solo el superadmin modifica dependencias, ejecuta lotes y administra/genera recurrencias. La aplicación rechaza ciclos, avance con dependencias incompletas, revisiones obsoletas y copias con responsables revocados; las operaciones usan transacciones e identificadores estables. Como las otras reglas Spark, no garantizan por sí solas todas las validaciones de negocio contra un administrador que escriba fuera de la aplicación.

Recurrencias no usa Functions ni Scheduler en producción: Generar fecha seleccionada es manual. Los historiales de generación y lotes son inmutables desde la aplicación/reglas. No se activó Blaze. Exportación CSV y carga semanal están limitadas a alcances autorizados. Los límites de paginación y selección están en ADMINISTRATION.md.

El respaldo manual JSON sí está implementado y ejecutado sobre la base real; la restauración se comprobó solo en demo-funka. Véase BACKUP.md. No hay backup periódico automático ni copia de Authentication/IAM/Hosting.


## Estado público verificado · 13 de octubre

Los siete índices están READY. Logo completo y símbolo oficiales ya están guardados en branding/public (revisión 1) y se verificaron visualmente y en el sitio público; las notas anteriores sobre originales no disponibles son históricas. Se completaron 13 entradas de directorio en 11 alcances a partir de perfiles reales, sin cuentas ni pedidos de prueba. El sitio usa el bundle y las reglas vigentes y mantiene billingEnabled=false.


## Editor de textos

672 textos registrados y título del navegador editables por superadmin, sin nuevo despliegue ni Functions. Solo siteContent/public y su colección texts son legibles públicamente; sus escrituras exigen Google verificado, rol activo, claves conocidas, campos restringidos, timestamp y revisión global atómicos. La actualización de cada texto compara su versión y conserva el borrador en conflictos. Los textos se renderizan como strings de React, nunca como HTML. Véase TEXTS.md.

Las campañas revisadas ya pueden generar/vincular pedidos por canal con vista previa e idempotencia. La generación inicial funciona en Spark; no requiere Functions. La sincronización continua y diaria sigue pendiente. Véase CAMPAIGNS.md.

## Administración e historial

La administración general queda exclusivamente en joel.yc23@gmail.com y su UID de propietario. La pantalla Personas y accesos combina perfiles e invitaciones y se actualiza al registrarse una persona; no duplica una fila por correo. El tamaño del logo del encabezado es configurable (100–280 px, 180 por defecto) sin cambiar el ingreso. El historial global registra acciones de la aplicación y no se elimina ni modifica desde el cliente. Véase READINESS.md para cobertura y pendientes.

## Preparación de colaboración

`node scripts/prepare-collaboration.mjs` presenta los índices derivados que faltan. `--apply` los guarda con respaldo privado previo y precondiciones sobre permisos/fecha de actualización; no crea usuarios ni asigna pedidos. Los directorios scoped `collaboration/directory` permiten validar asignaciones sin exponer perfiles privados. `brandAccess` habilita consultar únicamente los catálogos de marcas autorizadas. Las invitaciones y cambios administrativos mantienen estos índices en sus mismas transacciones.

Los miembros escriben un recibo determinista `collab-equipo__marca__pedido__revision`: reglas verifican actor, tiempo de servidor, revisión y snapshots de los campos editables contra los documentos anterior/posterior. Las imágenes se registran por nombre/ID sin duplicar bytes; cambios cuyo historial excede 900 KB se rechazan con una indicación de dividir el pedido. Los recibos y actividad local son inseparables de la escritura de pedidos.
