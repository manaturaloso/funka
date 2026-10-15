# Edición de textos de la web

El superadmin dispone de **Administración → Gestionar → Textos de la web**. En **General**, Título de la pestaña del navegador cambia el título que muestra Chrome. Para otros textos, elegir la pantalla o Todas las pantallas y buscar la frase visible; la búsqueda compara el original y el texto publicado.

El editor registra 672 entradas de texto de la interfaz: ingreso, navegación, pedidos, administración, notificaciones, carga, recurrencias, campañas, vistas, confirmaciones, identidad y pie de página. Los datos de pedidos, nombres de equipos/marcas/personas y mensajes de validación de servicios se gestionan en sus pantallas y servicios habituales; no se convierten en contenido editorial.

Modificar el campo deja un borrador local en la sesión de la pestaña, separado por usuario. Se conserva al cambiar de sección o recargar, y el navegador avisa antes de abandonar la página con cambios. No se publica automáticamente ni se comparte con otros visitantes; no se sincroniza entre dispositivos. Si el navegador bloquea almacenamiento, la edición sigue disponible sin esta recuperación. **Texto original y vista previa** muestra ambos. **Guardar y publicar** aplica los campos modificados en Firebase y los visitantes reciben los cambios en tiempo real, sin otro despliegue. **Descartar cambios** abandona el borrador y muestra el contenido vigente. **Restaurar original**, seguido de Guardar y publicar, elimina la personalización del campo y vuelve al valor inicial.

Se admiten hasta 100 cambios por publicación y 2000 caracteres por campo. No se admiten campos vacíos. Para ocultar las etiquetas y ayudas ya configurables, usar Tipos y configuración. Los marcadores como `{{1}}` representan datos variables: conservarlos cuando el original los contenga. El editor rechaza su eliminación o la introducción de marcadores desconocidos.

Las etiquetas de estados pueden personalizarse, pero sus valores internos y sus acciones siguen siendo los mismos: cambiar Por asignar por Sin responsable no cambia el estado guardado ni las reglas de entrega. También se conservan los valores de los selectores y destinos de los enlaces. HTML se muestra como texto; no se ejecuta ni se inserta como marcado.

Cada publicación compara las versiones de los campos editados antes de escribir. Si otra persona modificó uno, no se sobrescribe y el borrador permanece; Descartar cambios permite partir del contenido actualizado. Recargar conserva el borrador y sus versiones originales, de modo que no evita la comprobación de conflicto. Los cambios de otros campos no se sobrescriben. El contador global monotónico evita que borrar y recrear un texto con el mismo contenido invalide esta protección.

## Modelo y permisos

- `shared/site-text-catalog.ts` mantiene IDs estables, originales y grupos; `useSiteText` resuelve personalizaciones conservando datos variables.
- `siteContent/public/texts/{key}` contiene solamente texto, revisión y timestamp de servidor. Solo las claves del catálogo pueden escribirse.
- `siteContent/public` conserva la revisión global y timestamp. No se permite borrar este contador.
- Lectura pública de estas copias para el ingreso y el título; ninguna colección privada se abre. Solo superadmins Google verificados y activos pueden guardar/restaurar.
- La publicación exige actualización atómica del contador y registra la acción en el historial administrativo. Borrar un campo requiere la misma protección.

La implementación usa Firestore/Hosting existentes y mantiene Spark sin Functions ni facturación nueva. El respaldo genérico de Firestore incluye estas colecciones al producir una nueva copia. Al añadir un texto en código, registrar su ID estable en el catálogo y en las listas de claves permitidas de ambas reglas. No cambiar IDs, valores de negocio ni convertir datos de usuarios en textos editoriales.
