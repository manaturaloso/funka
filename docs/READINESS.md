# Qué falta para utilizar Funka como equipo

Revisión del pedido original y de las mejoras posteriores, 15 de octubre de 2026 (Lima). Producción: https://pendientesfunka.web.app. Se mantiene Firebase Spark sin facturación.

La herramienta de Fase 3 permite corregir asociaciones por campaña con vista previa e historial; falta revisar datos reales al recuperar cuota. El límite de Firebase del 15 de octubre puede impedir temporalmente leer datos, aunque Hosting siga disponible.

## Ya utilizable

Los integrantes activos pueden registrar, asignar y editar pedidos de sus equipos y marcas autorizados; usar tablero, lista y calendario; guardar piezas, imágenes de referencia, comentarios y entregas Mega. Joel administra personas, accesos, tipos, decks y textos. El formulario incluye las columnas solicitadas del Excel y los nuevos estados. Las imágenes son referencias optimizadas, no archivos originales de entrega.

Los pedidos aparecen en «Mis pedidos» de todas las personas autorizadas para la combinación de equipo y marca, aunque no estén asignadas. Los encargados finales se eligen con casillas y pueden ser varios; el filtro por encargado permite consultar sus asignaciones. El enlace Mega se pide al entregar y es opcional, manteniendo la comprobación de piezas obligatorias.

Los invitados reciben los accesos al primer ingreso Google verificado y consultan sus combinaciones autorizadas. Personas y accesos reúne registrados y autorizaciones por correo en una sola lista con estado de registro. Administración está reservada al propietario Google joel.yc23@gmail.com vinculado al UID de bootstrap, en interfaz, servicios y reglas.

Identidad visual permite ajustar el ancho del logo del encabezado entre 100 y 280 px; por defecto 180 px, con límite responsive. El tamaño del logo del ingreso es independiente.

El historial de la aplicación incluye cambios de pedidos y acciones administrativas, ingresos, vistas guardadas, seguimientos, notificaciones leídas y exportaciones preparadas, con actor y fecha del servidor. Los cambios ordinarios guardan antes/después; adjuntos se representan por metadatos, y los eventos demasiado grandes se resumen explícitamente. No se registran clics de navegación ni se reconstruyen acciones antiguas que nunca tuvieron evento. La auditoría global no se modifica ni borra desde el cliente. Las operaciones fuera de la aplicación (consola Firebase/IAM) requieren auditoría de infraestructura y no están cubiertas por este historial de aplicación.

## Cinco fases acordadas

Véase [PHASES.md](PHASES.md). La Fase 1 habilita edición colaborativa con historial atómico, acciones por persona simplificadas, encargados múltiples y entrega con enlace opcional. Las siguientes fases siguen pendientes:

2. **Calendario continuo.** Implementado en esta fase: identidades estables, diferencias, revisión de coincidencias, fechas automáticas protegidas e historial/avisos. Ejecución diaria mediante GitHub Actions, manteniendo Spark. La validación y activación de producción se registran en VALIDATION.md.
3. **Corrección de vínculos de campañas.** Reparación y reasignación con vista previa e historial, conservando pedidos existentes.
4. **Importaciones y responsables.** 1207 pedidos Converse ya importados; vincular responsables históricos a cuentas reales. Revisar duplicados y destinos del Excel multimarcas antes de incorporarlo.
5. **Cuentas y accesos de clientes.** Pestañas de consulta y edición administrativa; falta implementar almacenamiento y permisos. Definir visibilidad de clientes antes de construir esta fase.

Además del alcance de las fases, falta el piloto de aceptación con Joel y dos personas reales. Las pruebas con Google emulado no sustituyen esa comprobación. No hay respaldo periódico automático configurado.
