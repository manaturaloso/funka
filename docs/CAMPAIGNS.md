# Revisión del calendario

Disponible para superadmins en **Administración → Gestionar → Campañas**. El calendario 2026 enlazado se cargó como 1561 borradores de sus nueve pestañas, con fechas y rangos originales. Esto no crea pedidos ni activa una sincronización diaria.

Buscar por nombre, filtrar Marca del calendario, Mes de campaña o Revisión. Se muestran 50 resultados a la vez; Ver más campañas amplía la lista. El filtro mensual incluye campañas que cruzan de mes.

**Revisar campaña** permite corregir nombre y fechas, elegir una combinación existente de equipo/marca y seleccionar WP, SIS o ambos. Puede guardarse una revisión parcial. **Revisión completada** exige destino y al menos un canal. Los datos originales siguen disponibles en el formulario y no se reescriben. La clasificación no se deduce de colores ni de la categoría de enero aplicada a otros meses.

Una revisión guarda su versión y un evento administrativo. Si la versión cambió, no sobrescribe la modificación ajena y conserva los campos locales en el formulario. Cerrar y volver a abrir parte del dato vigente. La edición es exclusiva de superadmins Google activos; los miembros y visitantes no leen estos borradores. No se permite crear, borrar ni reescribir su origen desde el cliente. La implementación de revisión usa Spark.

Los textos de la pantalla están en Textos de la web → Campañas. El catálogo total ahora tiene 645 entradas; los valores de negocio WP/SIS, identificadores y contenido del calendario siguen siendo datos.

## Carga del origen

`scripts/import-calendar-drafts.mjs --file .local-imports/calendar-preview.json` previsualiza; añadir `--apply` importa. Usa la autenticación administrativa segura existente y verifica al propietario activo, año 2026, límites y origen. Solo crea documentos nuevos, con precondiciones de inexistencia; protege el guard de Spark y registra una carga completa en el historial. Conserva una revisión existente al repetir la misma copia y rechaza coincidencias con otro checksum. Cada borrador guarda la fuente inmutable con nombre, fechas, pestaña, rango y observaciones. No sobrescribe pedidos, usuarios o configuración. Los IDs incluyen el rango del archivo: no afirmar aún deduplicación entre versiones con filas desplazadas.

Producción: 1561 creados y verificados, cero pedidos generados. La generación de pedidos y la vinculación con el historial Converse son la siguiente fase, después de resolver destino/canal y comprobar duplicados entre fuentes. La automatización diaria continúa sin desplegarse; no se activó facturación.

## Preparar pedidos

En el filtro Revisadas, abrir **Preparar pedidos**. La vista previa muestra una fecha automática y, para cada canal, permite **Crear un pedido nuevo** o vincular un pedido existente del mismo equipo/marca. Puede buscarse el pedido por nombre; las opciones incluyen estado, fecha y año. WP y SIS no pueden vincularse al mismo pedido. La creación exige confirmar que se comprobaron los existentes y respeta los campos obligatorios; elegir un responsable autorizado si es obligatorio. No se inventan usuarios.

**Aplicar decisiones** crea solo los pedidos elegidos como nuevos. Calcula su deadline según Inicio, Días de anticipación y Hora de entrega configurados en Lima; copia el deck predeterminado específico de WP/SIS y su versión. Sin deck, muestra Deck por configurar, sin piezas inventadas. Un título largo se conserva completo en el brief y se limita a 200 caracteres para el pedido. Los pedidos vinculados no se modifican: conservan estado, fechas manuales, piezas, comentarios y entregas, incluso si ya estaban entregados.

La operación guarda el vínculo por campaña/canal y un evento administrativo, de forma atómica. Repetir devuelve los pedidos asociados sin duplicarlos ni cambiar sus datos. Si cambia el destino de una campaña ya vinculada o se elimina un pedido asociado, se bloquea la generación para evitar crear un reemplazo arbitrario; la corrección de esos vínculos requiere una fase adicional. Cambiar fechas en la campaña no actualiza todavía los pedidos existentes: esta es generación/vinculación inicial, no sincronización continua.

Se comprueba toda la colección del alcance (máximo 2000 pedidos) en una consulta, sin omitir históricos por el límite del tablero. La revisión de datos, decks, configuración y versiones se asocia al guard de Spark. Si hay cambios desde la vista previa, se pide actualizarla. No se vincula automáticamente por parecido de nombre: los alias y fechas del Excel pueden corresponder a trabajos distintos. El usuario confirma cada vínculo o creación.

## Fase 2: actualización continua

La implementación vigente está en [CALENDAR_AUTOMATION.md](CALENDAR_AUTOMATION.md). Sustituye las limitaciones históricas anteriores sobre ausencia de sincronización: conserva identidades entre versiones, aparta coincidencias dudosas, preserva ajustes manuales y actualiza fechas automáticas de pedidos compatibles con historial y avisos. Las reparaciones de vínculos siguen en la Fase 3.
