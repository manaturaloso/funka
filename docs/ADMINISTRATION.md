# Administración de Funka

## Cargar el logotipo original

En Identidad visual selecciona el logotipo completo y el símbolo circular desde tu dispositivo, revisa la vista previa y pulsa Guardar identidad visual. Admite PNG, JPG y WebP hasta 250 KB por archivo. Se actualizarán ingreso, cabecera y favicon sin otro despliegue. Las imágenes serán públicas; los originales no se redibujan ni recortan. Para retirarlas, pulsa Quitar y guarda.


## Eliminar registros en la versión pública

Los superadmins disponen de Eliminar en equipos, marcas, vínculos, decks, plantillas, autorizaciones, perfiles e historial. Los pedidos se eliminan desde su detalle y la configuración puede restablecerse. El diálogo muestra el alcance, exige escribir el nombre exacto y rechaza una vista previa si los datos vinculados cambiaron. Las eliminaciones son definitivas; los planes de más de 400 documentos se bloquean sin borrar nada. El propietario inicial conserva su cuenta y acceso. Véase [SPARK.md](SPARK.md) para la cascada y las limitaciones.


> La versión pública usa Spark: superadmins editan; miembros solo consultan sus alcances. El propietario inicial no puede desactivarse ni perder su rol. Las autorizaciones anteriores al primer ingreso requieren activar el perfil posteriormente. Los detalles de Functions descritos abajo corresponden al backend anterior; véase [SPARK.md](SPARK.md) para la arquitectura y las diferencias vigentes.


Estas funciones están implementadas y probadas en emuladores. Producción y sincronización diaria aún no están configuradas.

## Usuarios y accesos

Ingresar con Google crea un perfil pendiente cuando no existe autorización. El superadmin inicial se verifica en servidor y se vincula a su UID.

En **Autorizaciones por correo**, registra el correo real de la persona antes de su primer ingreso, o autoriza un perfil que todavía esté pendiente. No se crean cuentas Google ni se inventan correos. Una autorización previa puede desactivarse sin borrar su registro.

En **Usuarios y accesos**, edita perfiles que ya ingresaron: activar/desactivar, rol, equipos y marcas. Seleccionar un equipo no selecciona automáticamente sus marcas. Una persona puede pertenecer a un equipo sin consultar ninguna marca. Cada permiso depende de equipo + marca; la misma marca en otro equipo necesita otro acceso. Superadmin tiene acceso global a las marcas activas.

La revocación elimina los grants correspondientes. Iniciar sesión no reactiva perfiles desactivados. Promover a superadmin requiere identidad Google verificada. No se puede desactivar o degradar al último superadmin activo, incluso cuando dos administradores intentan hacerlo simultáneamente. Los cambios usan revisión y transacción: un formulario obsoleto debe actualizarse antes de guardar.

## Equipos, marcas y archivo

Crear equipos y marcas con nombres completos. Los IDs son permanentes; usa letras, números y guiones. No hay campo separado de país. Cada marca dispone de WP y SIS.

**Marcas por equipo** vincula una marca a uno o varios equipos. Archivar la vinculación evita acceso de sus miembros a pedidos de esa combinación, aunque se conserven sus grants para recuperación. Archivar una marca o equipo archiva efectivamente sus vinculaciones sin borrar pedidos, actividad, comentarios o entregas. Recuperar la entidad restablece las vinculaciones que no estaban archivadas por separado.

En una marca se puede configurar un único **Equipo para pedidos automáticos**, que debe estar vinculado y activo. Esta opción queda guardada para la fase de sincronización; aún no genera pedidos automáticamente.

## Decks y piezas

Crear un deck por marca/canal, con nombre, descripción y al menos una pieza definida por el administrador. No se precargan piezas ficticias. Configurar cantidad, medidas, formato, especificaciones, referencias, grupo, orden y obligatoriedad. Puede haber varias variantes y un único predeterminado por marca/canal.

**Duplicar** abre una nueva copia editable. Puedes cambiar marca/canal en la copia, pero no en un deck existente: esa identidad debe permanecer estable.

Guardar crea una versión inmutable. **Versiones y vista previa** muestra las definiciones anteriores y permite cargar versiones más antiguas. Archivar un deck retira su uso como predeterminado, pero no elimina copias ya creadas en pedidos.

Al crear un pedido con canal, o al elegir un canal en un pedido todavía sin piezas ni deck, se copia el predeterminado correspondiente. Si falta configuración, aparece **Deck por configurar** y no se inventa un checklist. Cambiar canal en un pedido con trabajo existente conserva sus piezas; un administrador puede aplicar el deck adecuado mediante vista previa.

**Aplicar a pedidos**:

1. Seleccionar hasta 20 pedidos abiertos de la misma marca/canal.
2. Generar la vista previa y comparar definiciones anteriores/nuevas.
3. Seleccionar cuáles actualizar; los no seleccionados siguen intactos.
4. Confirmar la aplicación.

Se conservan IDs de piezas ya copiadas, progreso, responsables, fechas propias, motivos, enlaces y registros de comentarios/entregas. Las piezas retiradas de la nueva plantilla se conservan y marcan como retiradas; no se borran. Una pieza obligatoria que ya no aplica exige motivo. Las piezas manuales no se asocian por coincidencia de nombre.

La vista previa vence a los 30 minutos. Si el pedido, su alcance o el deck cambian después de revisarla, la aplicación se rechaza y debe generarse otra. Reintentar una aplicación ya completada no agrega piezas duplicadas. La copia admite 100 piezas por pedido y un límite de contenido; una actualización que exceda el límite no se aplica.

## Tipos y plantillas de pedidos

**Tipos y configuración** administra la lista de tipos activos. Retirar un nombre de la lista no reescribe pedidos existentes; los registros históricos siguen siendo consultables y editables conservando ese tipo.

**Plantillas de pedidos** define nombre, título inicial, brief, tipo, prioridad y canal. Crear un pedido con una plantilla copia su versión; editar la plantilla no cambia briefs anteriores. Si incluye WP/SIS, el checklist se genera desde el deck predeterminado de la marca elegida. La plantilla es opcional; el registro rápido conserva título + marca + equipo como requisitos mínimos.

Las horas de entrega y sincronización se guardan en America/Lima. Dos días calendario antes del inicio de campaña sigue siendo el valor inicial. Guardar estas preferencias no activa Scheduler ni concede acceso al calendario.

## Historial

Las operaciones de administración y sus valores anteriores/nuevos quedan registradas en actividad inmutable desde el cliente. El historial se consulta desde la sección correspondiente, con registros recientes primero y paginación. Las versiones de decks y plantillas permanecen guardadas. Este historial no sustituye un respaldo: existe un respaldo manual de Firestore y restauración probada en emuladores, descritos en BACKUP.md.

## Campos obligatorios y textos de la interfaz

En **Tipos y configuración**, el superadmin puede exigir Brief, Responsable principal, Fecha de entrega y Canal. Título, marca y equipo siempre son obligatorios. Guardar aplica la política a nuevas creaciones y al guardar detalles; no modifica pedidos existentes ni bloquea la consulta de pedidos antiguos incompletos. Los formularios muestran los campos exigidos. La ruta de creación/edición vuelve a leer la configuración vigente en su transacción, aunque el formulario se haya abierto antes del cambio. En Spark esto es validación de la aplicación administrativa, no una garantía contra escrituras administrativas externas a ella.

En la misma pantalla se puede mostrar u ocultar etiquetas sobre los títulos y textos de ayuda en Pedidos y Administración. Las etiquetas están ocultas por defecto; «MI ESPACIO» se retiró. Títulos, controles, advertencias de acceso, mensajes de error y confirmaciones de borrado siguen visibles.

El tablero conserva sus columnas por estado. «Más filtros» abre canal, equipo, marca, tipo, responsable y fechas precisas. «Vistas personales» despliega la gestión de filtros guardados. Los contadores del resumen corresponden a los pedidos cargados de la audiencia y archivo actuales, antes de los filtros locales; no son totales globales de la agencia.

## Acciones de cada registro

Editar permanece visible. Más acciones despliega eliminar y, en decks, duplicar, consultar versiones o aplicar a pedidos. La eliminación conserva su vista previa, validación de datos vigentes y confirmación por nombre. El menú se puede abrir con teclado mediante el control nativo details/summary. Los botones de creación indican Nuevo equipo, Nueva marca o Nueva plantilla, según la sección.

## Encontrar registros

La búsqueda de Administración compara nombre, correo, ID y resumen legible, sin distinguir mayúsculas ni tildes. Varias palabras pueden coincidir en partes diferentes del registro. Estado del registro permite elegir activos o archivados; en usuarios y autorizaciones muestra desactivados y pendientes. El historial solo usa búsqueda. La búsqueda se conserva al editar o actualizar y se limpia al cambiar de sección.

La búsqueda y el filtro operan sobre las páginas ya cargadas. El contador indica coincidencias y cantidad cargada, y avisa si hay más páginas. Cargar más registros amplía la lista manteniendo los filtros. No se trata de búsqueda global del servidor ni se consulta Firebase por cada tecla.


## Notificaciones y seguidores

En el detalle, Seguir pedido activa avisos internos de cambios; Dejar de seguir los detiene. También funciona para miembros con acceso de consulta. Notificaciones agrupa los últimos 50 avisos por alcance y pedido, permite mostrar solo pendientes de leer, marcar el grupo leído y abrir su detalle. Revocar acceso retira los grupos correspondientes. No se envían mensajes externos. El límite de generación es 100 seguidores por pedido; si se supera, la operación se rechaza con aviso.

## Copiar, seleccionar y exportar pedidos

El superadmin puede seleccionar hasta 20 tarjetas y archivar, recuperar, cambiar prioridad o duplicar en una sola transacción. Una revisión obsoleta rechaza todo el lote. La copia empieza Por asignar, sin entregas ni progreso, comentarios, dependencias o vínculo de campaña/recurrencia; conservar responsables es opcional y exige que sigan autorizados. Las fechas se copian como manuales. Un reintento con la misma operación no duplica pedidos. Tras un conflicto, cancela la selección y selecciona los datos actualizados.

Exportar CSV descarga únicamente los pedidos cargados que coinciden con los filtros visibles, conserva los enlaces Mega completos y protege contra fórmulas de hojas de cálculo. Cargar más pedidos amplía esa selección; no se exportan marcas ajenas.

## Dependencias

En el detalle se eligen hasta 20 pedidos previos del mismo equipo y marca. Se rechazan ciclos. Para pasar a En proceso, En revisión o Entregado, los previos deben estar Entregados. Borrar un pedido limpia las referencias de los dependientes, conservando su estado. El selector consulta hasta 500 pedidos y el grafo admite 500 nodos por alcance.

## Carga semanal

Carga semanal cuenta pedidos y piezas pendientes por persona durante siete días desde la fecha elegida; separa trabajo sin fecha y sin responsable. Excluye entregados y archivados. Son conteos, no horas ni estimaciones de esfuerzo. Consulta solo alcances autorizados, con paginación y límite de 5000 pedidos; se actualiza al volver a la pantalla.

## Recurrencias

Recurrencias permite definir título, alcance, brief, canal, responsable, prioridad, fechas y frecuencia diaria, semanal o mensual (días 1–28); el deadline usa hora de Lima. Puede pausarse, reanudarse, editarse o eliminarse con confirmación. Generar fecha seleccionada crea un único pedido por definición y fecha, con el deck vigente y los campos obligatorios configurados. Reintentar devuelve el pedido existente; editar la definición no reescribe pedidos anteriores. Eliminarla conserva los pedidos y el historial de generación.

En Spark la generación es manual. El código de ejecución diaria está preparado en Functions, pero no desplegado: requiere el plan de facturación que el usuario decidió mantener desactivado. Las últimas 50 generaciones se consultan en esta pantalla.

Los nombres de los integrantes se publican únicamente en sus alcances autorizados, sin correos globales. El mantenimiento de accesos actualiza este directorio. El script rebuild-people.mjs permite previsualizar y completar directorios antiguos bajo control de concurrencia, sin crear cuentas ni pedidos.


El logo completo y el símbolo oficiales ya están guardados en el documento público y verificados en el sitio el 13 de octubre de 2026. No hace falta volver a cargarlos para esta versión.


## Textos de la web

En Gestionar → Textos de la web, General permite editar el título de Chrome. Elegir pantalla o buscar la frase para modificar las otras copias de la interfaz. Guardar y publicar aplica los cambios en tiempo real; Restaurar original recupera el valor inicial. La vista previa conserva el borrador hasta guardar. Los estados internos, permisos y datos de pedidos no cambian al editar etiquetas. Guía completa en TEXTS.md.

## Campañas del calendario

Gestionar → Campañas reúne los borradores de las nueve marcas. Filtrar mes/marca/revisión y abrir Revisar campaña para corregir fechas y definir equipo, marca y WP/SIS. Revisión completada requiere destino y canal; todavía no genera pedidos. Detalles en CAMPAIGNS.md.
