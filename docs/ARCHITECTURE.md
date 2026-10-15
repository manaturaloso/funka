# Arquitectura y seguridad · fases 1–3

> La versión pública usa Spark: superadmins editan; miembros solo consultan sus alcances. El propietario inicial no puede desactivarse ni perder su rol. Las autorizaciones anteriores al primer ingreso requieren activar el perfil posteriormente. Los detalles de Functions descritos abajo corresponden al backend anterior; véase [SPARK.md](SPARK.md) para la arquitectura y las diferencias vigentes.


React + Vite + TypeScript + Tailwind, componentes accesibles Radix y Lucide. Auth identifica a la persona mediante Google, Firestore almacena las decisiones de acceso y Functions v2 realiza todas las escrituras. El proyecto de pruebas es `demo-funka`; la versión Spark de producción está vinculada a `funka-joel-2026`.

## Identidad y roles

`establishAccess` exige token Google con correo verificado. El correo inicial exacto `joel.yc23@gmail.com` se vincula al UID en `system/bootstrap` mediante transacción. El frontend no asigna roles. Perfiles existentes desactivados no se reactivan por login.

`saveInvitation` autoriza correos antes del ingreso o perfiles pendientes; `saveMember` gestiona usuarios identificados. Membresías de equipo y grants de marca son independientes. Promover a superadmin exige el marcador de identidad Google escrito solo por el servidor. Desactivar/degradar un superadmin consulta el conjunto activo y escribe `system/adminGuard`; esa escritura serializa operaciones concurrentes y evita que dos administradores eliminen el último acceso privilegiado.

`authorizeEmail` se conserva para compatibilidad con la base inicial, pero la interfaz usa las APIs versionadas nuevas. No usar ese método como editor de usuarios existentes.

## Modelo implementado

| Ruta | Datos y control |
| --- | --- |
| `users/{uid}` | Identidad verificada, activación, rol, revisión, equipos y scopes; escritura servidor |
| `users/{uid}/memberships/{teamId}` | Pertenencia a equipo; no concede marcas |
| `users/{uid}/access/{teamId}__{brandId}` | Grant específico; IDs sin `_` ni `/` evitan colisiones |
| `invitations/{sha256(email)}` | Autorización previa, revisión y scopes; acceso por backend superadmin |
| `system/bootstrap`, `system/adminGuard` | UID inicial y serialización de cambios de superadmins; ningún acceso cliente |
| `teams/{id}`, `brands/{id}` | Catálogos editables con archivo; marcas con WP/SIS y destino automático único |
| `scopes/{teamId}__{brandId}` | Índice de servidor para enumerar alcances del superadmin |
| `teams/{teamId}/brands/{brandId}` | Vinculación; archivo propio y archivo efectivo derivado de equipo/marca |
| `…/orders/{orderId}` | Pedido, piezas, revisión, responsables agregados, snapshots de deck/plantilla, estado, archivo y deadline |
| `…/orders/{orderId}/comments/{id}` | Comentarios, menciones y referencia opcional a pieza |
| `…/orders/{orderId}/deliveries/{id}` | Versiones de enlaces generales/por pieza, autor y timestamp; fragmentos Mega completos |
| `…/orders/{orderId}/activity/{id}` | Actividad inmutable, actor, revisiones y cambios |
| `decks/{id}`, `decks/{id}/versions/{revision}` | Plantilla global de marca/canal y versiones inmutables |
| `brands/{id}.defaultDecks` | Un puntero predeterminado por canal, actualizado en transacción |
| `deckPreviews/{id}/targets/{index}` | Snapshot de aplicación por pedido y actor; se aplica solo con revisión vigente y antes de vencer |
| `orderTemplates/{id}`, `…/versions/{revision}` | Brief/tipo/canal/prioridad versionados; copia al crear pedido |
| `settings/general` | Preferencias no secretas; el API de usuarios devuelve solo campos conocidos |
| `adminActivity/{id}` | Historial de operaciones administrativas con lecturas protegidas y paginación |
| `notifications/{uid}/items/{id}` | Menciones con scope; lectura condicionada al acceso actual |

Piezas son un array validado dentro del pedido, para verificar entrega y revisión en una transacción. Máximo 100 piezas y 700 kB serializados por pedido; no hay escritura de piezas en subcolecciones en esta versión. Un deck se limita a 400 kB para permitir snapshots y vistas previas seguras. La aplicación selectiva procesa hasta 20 pedidos por operación y almacena cada target por separado.

## Permisos y consultas

Firestore niega toda escritura cliente, incluso para superadmin. Lecturas de pedidos y registros hijos requieren perfil activo y grant de la combinación; las vinculaciones archivadas se deniegan a miembros. Superadmin conserva acceso global de lectura para administración. APIs de escritura verifican además que el alcance esté activo. Notificaciones se protegen con el mismo scope. Las APIs administrativas requieren superadmin activo y no se habilitan por ocultar o mostrar botones.

Mis pedidos consulta por cada alcance autorizado y `assignedUids`, que reúne principal, colaboradores y responsables por pieza. Tablero, lista y calendario usan los mismos listeners. No se descargan marcas ajenas para ocultarlas después. Hay 100 registros iniciales por scope y carga explícita de más resultados. Los índices de las consultas de pedidos, miembros, decks y superadmins están declarados.

Editar exige revisión vigente; un borrador obsoleto se conserva en interfaz y falla al guardar. Comentarios, entregas y actividad usan IDs de operación para evitar duplicados por reintento. Las APIs administrativas también usan revisión. El perfil escucha cambios para retirar UI privilegiada al desactivar o degradar un usuario.

## Copias y reconciliación de decks

Crear con canal copia el predeterminado, sin referencias mutables al documento del deck. Elegir canal en un pedido vacío puede generar su primera copia; un pedido con piezas conserva todo hasta una aplicación explícita.

Las piezas copiadas guardan `{deckId, pieceId, revision}`. La conciliación usa esa procedencia, nunca nombre o posición como identidad. Actualiza definiciones de piezas reconocidas preservando ID, estado, responsables, deadline, motivo y enlace. Piezas retiradas y manuales se conservan. El servidor impide falsificar procedencia desde el editor de piezas.

La vista previa fija deck y revisiones de pedidos durante 30 minutos. Aplicar verifica actor propietario, permiso administrativo vigente, revisiones, estado abierto, canal, alcance y selección. Si cualquiera cambió, no se sobreescribe el trabajo. El registro de targets aplicados hace idempotente el reintento.

## Integración pendiente y respaldo manual

Campañas, snapshots diarios, reconciliación de origen, integración diaria del calendario y la importación de los Excel reales aún no están implementados. Recurrencias manuales, dependencias, bandeja agrupada, CSV y carga semanal sí están implementados. Las rutas no definidas siguen denegadas. Las horas/configuración guardadas no demuestran un proceso diario activo.

Los dos Excel reales y la autorización del archivo Drive no están disponibles. No se inspeccionó ni convirtió la fuente. El historial no es respaldo. El respaldo manual JSON de Firestore se ejecutó en producción y su restauración se probó en emuladores; no usa bucket ni servicios de pago. Véase BACKUP.md para alcance, retención privada y límites.

La primera versión pública Spark conserva un bundle grande; queda pendiente dividir módulos. La corrección gRPC 1.14.6 sigue fijada en el lockfile. Proyecto, Google y sitio `pendientesfunka.web.app` están configurados; la facturación permanece desactivada por decisión del usuario. Falta verificar el primer ingreso real de Joel. Véase SPARK.md para las diferencias de seguridad y alcance.


## Modelo de productividad

| Ruta | Función |
| --- | --- |
| `…/orders/{id}/followers/{uid}` | Suscripción propia, identidad y alcance validados; no permite editar el pedido |
| `…/orders/{id}/followerGuard/global` | Revisión para que nuevas suscripciones invaliden transacciones de notificación/borrado |
| `teams/{team}/brands/{brand}/people/{uid}` | UID y nombre por alcance; mantenimiento administrativo, lectura autorizada sin correos globales |
| `teams/{team}/brands/{brand}/dependencies/graph` | Grafo acíclico y revisión; lista de previos también en cada pedido |
| `batchOperations/{operationId}` | Journal inmutable de lotes y creaciones administrativas, firma de payload/actor y resultado idempotente |
| `recurrences/{id}` | Definición editable/pausable por superadmin |
| `recurrenceRuns/{sha256(id:date)}` | Generación inmutable por fecha; el pedido usa el mismo ID estable |
| `recurrenceExecutions/{id}` | Historial del cron preparado en Functions; no se escribe en producción Spark |
| `users/{uid}/views/{id}` | Preferencias privadas versionadas, junto a metadatos del perfil |

La bandeja usa el índice compuesto items por teamId/brandId/createdAt, escucha por alcance y agrupa por pedido. El servidor/adaptador generan avisos para menciones y seguidores activos autorizados; no hay mensajes externos. La consulta paginada listScopedOrders permite lecturas de carga y dependencias sin descargar scopes ajenos. Lotes exigen todas las revisiones y validaciones antes de escribir. El script de directorio mantiene precondiciones sobre los documentos escritos y verificaciones sobre el resto del snapshot; no verifica y escribe el mismo documento en una petición Commit.

Functions requiere token Google verificado también en handlers de escritura/administración; el cron usa el propietario inicial activo. El código dailyRecurrences preparado registra resultados y rechaza definiciones inválidas, pero no está desplegado ni se comprobó una ejecución programada real.
