# Funka · Fases de implementación

El alcance completo está en [REQUISITOS.md](REQUISITOS.md). Cada fase entrega código ejecutable y pruebas; ningún prototipo o integración pendiente se presenta como terminado.

| Fase | Entrega | Criterio de salida | Estado |
| --- | --- | --- | --- |
| 1 | React/TypeScript, Tailwind, componentes Radix, Google Auth, acceso pendiente, bootstrap del superadmin, reglas y emuladores | Build, identidad de servidor, acceso por equipo/marca y pruebas negativas en emuladores | Validada: permisos/backend e ingreso completo en navegador con emuladores |
| 2 | Registro rápido, responsables, piezas, comentarios/menciones, entregas/versiones, revisión, bloqueo, archivo; Mis pedidos y Pedidos de mis marcas; tablero/lista/calendario, búsqueda/filtros, panel lateral, drag y alternativa accesible; sincronización realtime | Datos persistentes, edición concurrente, permisos en todos los recursos, Mega completo, entrega explícita | Flujo principal implementado y probado; vistas personales implementadas en Spark; falta vinculación de campañas (fase 4); decks ya conectados en fase 3 |
| 3 | Usuarios y accesos, equipos/membresías, marcas WP/SIS, tipos/briefs, decks/versiones/variantes/predeterminados; duplicación, preview y aplicación selectiva preservando progreso; configuración, actividad, recuperación | No autoescalamiento, protección del último superadmin, asignación solo a autorizados, decks independientes | Implementada y validada: gestión de accesos, equipos/marcas, decks/versiones/aplicación selectiva, tipos/briefs, configuración e historial |
| 4 | Inspección del archivo real en Drive, lector geométrico XLSX o Sheets, mapeos, preview inicial, snapshots, detección/reconciliación y revisión de ambigüedades; órdenes por canal, deadlines; cron Lima, bloqueo y límites | Idempotencia, errores no retiran campañas, fechas y desplazamientos no duplican, manual conserva, entregado no reabre | Pendiente; falta archivo y acceso a Drive |
| 5 | Notificaciones internas agrupadas, seguidores, dependencias acíclicas, vistas guardadas, duplicación/lotes, recurrencias pausables idempotentes, brief, carga semanal; Excel Converse con preview/resolución/deduplicación, exportación autorizada | Permisos en cada lectura/exportación, sin correos inventados, separadores excluidos, reintentos sin duplicación | Implementadas vistas, bandeja, seguidores, dependencias, duplicación/lotes, brief, exportación CSV, carga y recurrencias manuales; pendientes ejecución diaria e importación del Excel original |
| 6 | Todos los criterios de aceptación, revisión responsive/teclado, respaldo real, guías administración y despliegue; Firebase bajo Joel y Hosting pendientesfunka.web.app | Proyecto/identidad verificados, reglas cerradas, sincronización persistente, costo autorizado, URL verificada | Primera versión Spark publicada; respaldo manual real y restauración en emuladores implementados; faltan colaboración de miembros, integración diaria y aceptación completa |

## Orden de construcción

Primero los límites de seguridad y el modelo compartido. Luego el flujo colaborativo y administración. La importación y sincronización solo escriben mediante servicios con el mismo control de acceso y auditoría. No se agregan cuentas, correos, piezas de decks ni campañas ficticias en producción. Los fixtures de pruebas solo usan `demo-funka`.

## Dependencias externas

- Red del entorno: `storage.googleapis.com` habilitado; descarga oficial de Firestore y Emulator Suite verificadas. Para popup Google emulado se habilitaron dominios `apis.google.com`, `www.gstatic.com`, `unpkg.com`, `fonts.googleapis.com`, `fonts.gstatic.com`. El navegador de pruebas usa el proxy del entorno y su CA pública en NSS; el ingreso Google emulado ya pasó sin desactivar TLS.
- Adjuntar los archivos `2026 Calendario de Campañas PAUTA - OFICIAL.xlsx` y `Converse_Funka to-do list.xlsx` antes de validar lectores contra sus estructuras reales.
- En fase 4: acceso persistente de lectura al archivo Drive `1SaoG7PHCmVmKB7llxu2OFbYSVT6m25kWfNAU5I27hiQ`; determinar MIME real sin convertir ni editar fuente. Login de integrantes no sustituye este acceso.
- En fase 6: usuario ingresa con `joel.yc23@gmail.com` en un mecanismo de autenticación soportado. Proyecto `funka-joel-2026` y sitio `pendientesfunka.web.app` verificados. Cloud Functions/Scheduler requieren revisar facturación antes de activarlos. Nunca solicitar tokens o contraseñas por chat.

## Versión pública sin facturación

El usuario eligió Spark y cambió el destino a `pendientesfunka.web.app`. Se publicó una primera versión con administración y edición por superadmins, y consulta por alcance para miembros. No considerar completados todos los criterios de fases 1–3 para Spark: la edición de miembros y las garantías de validación del servidor están pendientes. Véase SPARK.md. Las 45 pruebas históricas corresponden al backend Functions; Los resultados vigentes se registran en VALIDATION.md; no equivalen a validar la sincronización ni la colaboración de miembros.
