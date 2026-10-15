Actúa como ingeniero senior full stack, diseñador de producto y responsable de implementación. Construye una aplicación web de producción llamada **Funka**, para gestionar los pedidos de una agencia creativa.

No te limites a elaborar un plan, una maqueta o recomendaciones. Implementa el proyecto, verifica su funcionamiento y avanza hasta el despliegue, solicitando mi intervención únicamente cuando necesites autenticación, acceso externo o autorizar un costo.

## 1. Objetivo

Actualmente registramos pendientes en Excel, pero necesitamos una experiencia mucho más dinámica y fácil de actualizar.

Funka debe combinar:

- La claridad visual de un KDS de restaurante.
- El flujo de tarjetas y tableros de Trello.
- Las interacciones de asignación, subtareas, comentarios, fechas, notificaciones y organización de Asana.

La prioridad es que registrar y actualizar pedidos sea tan rápido que las personas dejen de guardar sus pendientes “en la mente”.

Todos trabajamos como equipo. Dentro de las marcas que tienen autorizadas, todos pueden colaborar en los pedidos.

## 2. Cómo debes trabajar

1. Inspecciona el workspace, los archivos adjuntos y cualquier instrucción del repositorio.
2. Si existe código, revísalo antes de modificarlo. Si el workspace está vacío, crea el proyecto.
3. Presenta un plan breve de implementación y empieza a trabajar inmediatamente.
4. Mantén actualizaciones breves sobre avances, decisiones y bloqueos.
5. No me preguntes otra vez las decisiones resueltas en este prompt.
6. Para detalles menores, usa tu criterio y deja la configuración editable.
7. Implementa por etapas funcionales, conservando todo el alcance.
8. Usa documentación oficial vigente cuando sea necesario para Firebase, Google y las dependencias.
9. No presentes funciones simuladas como terminadas.
10. No declares la app lista mientras autenticación, permisos, persistencia o sincronización estén pendientes.
11. Si una integración necesita acceso, continúa con el trabajo independiente mientras preparo ese acceso.
12. No publiques con reglas de base de datos abiertas.
13. No actives facturación ni servicios de pago sin explicarme el requisito y obtener autorización.
14. No reemplaces recursos externos existentes sin verificar su identidad y alcance.

## 3. Stack y estructura

Usa como base:

- React + TypeScript.
- Vite.
- Tailwind CSS.
- Una biblioteca coherente de componentes accesibles, como shadcn/ui.
- Lucide para iconos.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Hosting.
- Cloud Functions con TypeScript para operaciones privilegiadas y sincronización.
- Cloud Scheduler para procesos diarios.
- Google Sheets API o Drive API según el formato real del calendario.
- Firebase Emulator Suite para verificar autenticación, reglas y backend.
- Pruebas unitarias para lógica crítica y pruebas de integración para permisos y sincronización.

Puedes ajustar una dependencia si encuentras una razón técnica concreta, pero conserva la arquitectura Firebase y el destino de publicación.

Organiza el código por módulos:

- Autenticación y acceso.
- Equipos y marcas.
- Pedidos y piezas.
- Decks y plantillas.
- Campañas e integración.
- Notificaciones.
- Administración.
- Importación y exportación.

Separa componentes visuales, servicios de datos, validación, permisos y lógica de negocio. Usa tipos compartidos y validación de entradas.

## 4. Firebase y despliegue

El proyecto Firebase debe crearse desde cero bajo:

**joel.yc23@gmail.com**

El destino deseado es:

**funka.web.app**

Ya revisé la disponibilidad del nombre. Verifica su asignación efectiva al configurar Firebase Hosting.

Tengo la cuenta de Joel en otro perfil de Chrome. Avísame cuando necesites autenticarte o crear el proyecto. Explícame el paso exacto que debo realizar.

No asumas que puedes controlar mi perfil local de Chrome. Usa el mecanismo de autenticación que realmente permita tu entorno.

Nunca me pidas contraseñas, códigos de recuperación o tokens privados por el chat.

Prepara el proyecto y los emuladores antes de necesitar acceso a producción. No cambies el destino final por un dominio de otra plataforma sin consultarme.

## 5. Login y permisos

Todos ingresan mediante:

**Continuar con Google**

El superadmin inicial es:

**joel.yc23@gmail.com**

El rol debe asignarse de forma protegida en el servidor, verificando la identidad Google y vinculándolo al UID. No basta con comparar el correo en la interfaz.

Un usuario sin autorización debe ver “Acceso pendiente” y no puede consultar datos de la agencia.

El superadmin puede:

- Autorizar usuarios por correo.
- Activar y desactivar usuarios.
- Crear y administrar equipos.
- Crear y administrar marcas.
- Asignar usuarios a equipos.
- Dar acceso a marcas dentro de cada equipo.
- Administrar decks, integraciones y configuración global.

Una persona puede pertenecer a varios equipos. En cada equipo puede tener acceso a diferentes marcas.

Modela permisos por la combinación:

**Usuario + Equipo + Marca**

Pertenecer a un equipo no habilita automáticamente todas sus marcas.

Cada pedido pertenece a un equipo y una marca.

Todos los usuarios autorizados para esa combinación pueden:

- Crear y editar pedidos.
- Asignar responsables.
- Modificar prioridades y fechas.
- Completar piezas.
- Comentar y mencionar personas.
- Registrar entregas.
- Solicitar revisión.
- Aprobar o pedir ajustes.
- Reabrir y archivar pedidos.

La asignación personal organiza el trabajo; no impide la colaboración.

Los permisos se aplican en Firestore y backend, incluyendo comentarios, entregas, enlaces, notificaciones, búsquedas y exportaciones. Nunca descargues todos los datos para luego ocultarlos en la interfaz.

## 6. Equipos y marcas

No debe existir un campo separado de país.

Usaremos nombres completos, por ejemplo:

- Converse.
- Converse Bolivia.
- Umbro Perú.
- Umbro Colombia.
- FILA.
- CAT.
- Merrell.
- New Balance.
- HI-TEC.
- Steve Madden.
- Coliseum.

El catálogo será editable.

Todas las marcas tienen disponibles ambos canales:

- **WP:** web propia de la marca.
- **SIS:** web multimarca Coliseum, coliseum.com.

Ejemplo para entender los permisos:

Joel trabaja con Omar, Renato, Andrés, Belén y Natalia. Su equipo ve Umbro Perú, Umbro Colombia, FILA y CAT.

- Renato accede a Umbro Perú y CAT.
- Omar accede a Umbro Perú y Umbro Colombia.
- Andrés accede a Umbro Colombia.

Estas personas son ejemplos. No inventes sus correos ni crees cuentas reales sin información verificada.

Una marca puede estar vinculada a varios equipos. La administración debe definir qué equipo recibe los pedidos automáticos para evitar duplicarlos.

## 7. Diseño e interacción

Diseña una interfaz profesional, moderna y compacta, en español.

Prioriza:

- Lectura rápida.
- Tarjetas claras.
- Tipografía legible.
- Espaciado consistente.
- Jerarquía visual.
- Acciones rápidas.
- Uso cómodo en escritorio y celular.

Evita llenar la pantalla de estadísticas decorativas o textos explicativos innecesarios.

Usa iconos pequeños y consistentes para:

- Asignar responsable.
- Completar.
- Comentar.
- Ver checklist.
- Editar fecha.
- Abrir entrega.
- Abrir menú de acciones.

Todos los iconos deben tener etiquetas accesibles y tooltips. En celular, mantén áreas táctiles cómodas.

Incluye panel lateral de detalle del pedido para consultar y editar sin perder el contexto del tablero.

## 8. Vistas principales

La vista inicial será:

**Mis pedidos**

Debe reunir los pedidos y piezas asignados a la persona en todos sus equipos.

También debe existir:

**Pedidos de mis marcas**

Para consultar todos los pedidos dentro de sus combinaciones autorizadas de equipo y marca.

Incluye:

- Hoy.
- Atrasados.
- Próximos.
- Bloqueados.
- En revisión.
- Cambios de campañas.
- Entregados e historial.

Vistas disponibles:

- Tablero KDS por estado.
- Lista.
- Calendario.

Las tres utilizan los mismos registros.

Filtros:

- Equipo.
- Marca.
- Canal WP/SIS.
- Responsable.
- Tipo.
- Prioridad.
- Estado.
- Fechas.

Añade búsqueda y vistas personales guardadas.

El tablero permite arrastrar tarjetas entre estados y ofrece una alternativa accesible mediante menú.

Actualiza los datos colaborativos en tiempo real.

## 9. Registro rápido

Registrar un pendiente debe requerir únicamente:

- Título.
- Marca.
- Equipo válido.

Si solo existe un equipo válido para esa marca, selecciónalo automáticamente. Si hay varios, usa el equipo activo o pide elegirlo.

Permite completar descripción, responsables, fecha y piezas después.

No obligues a elegir WP/SIS para trabajos que no pertenecen a esos canales.

Tipos iniciales editables:

- Campaña.
- Orgánico.
- Ecommerce.
- Reporte.
- Creatividad.
- Otro.

## 10. Pedidos

Cada pedido tendrá:

- ID estable.
- Título.
- Descripción o brief.
- Equipo.
- Marca.
- Tipo.
- Canal, cuando corresponda.
- Prioridad.
- Estado.
- Creador.
- Fecha de creación.
- Responsable principal opcional.
- Colaboradores.
- Deadline con fecha y hora.
- Deadline automático o manual.
- Campaña vinculada, si corresponde.
- Checklist.
- Comentarios.
- Entregas.
- Historial de actividad.

Estados iniciales:

- Por asignar.
- Pendiente.
- En proceso.
- En revisión.
- Entregado.
- Bloqueado.

El atraso es una condición calculada, no un estado que sustituye el flujo.

Archivar es independiente del estado productivo.

Bloqueado debe mostrar motivo, persona que puede resolverlo y estado previo.

## 11. Responsables, colaboración y piezas

Un pedido puede tener:

- Un responsable principal.
- Varios colaboradores.
- Responsables diferentes por pieza.

Solo se puede asignar a personas autorizadas para el equipo y marca del pedido.

Cada pieza del checklist tendrá:

- Nombre.
- Cantidad esperada.
- Medidas.
- Formato.
- Especificaciones.
- Referencias.
- Grupo y orden.
- Obligatoria u opcional.
- Responsable opcional.
- Fecha propia opcional.
- Estado.
- Comentarios.
- Enlaces de entrega.

Muestra progreso como “3 de 5 piezas listas”.

Permite excluir piezas opcionales. Para marcar un requisito obligatorio como “No aplica”, solicita motivo y registra la acción.

Completar todas las piezas no marca automáticamente el pedido como entregado.

## 12. Entregas y revisión

Usamos Mega para entregar archivos.

Permite:

- Enlace general de entrega.
- Enlaces por pieza.
- Varias entregas y versiones.
- Fecha y autor de cada entrega.

Preserva las URLs Mega completas, incluido el fragmento que empieza con #.

No implementes subida automática a Mega en esta versión.

Valida protocolos de enlaces y evita exponerlos en logs públicos.

Marcar Entregado es una acción explícita. Comprueba piezas obligatorias y enlace de entrega. Permite una excepción documentada si la entrega se hizo por otro medio.

Diferencia:

- **Entregado:** el trabajo se compartió.
- **Aprobado:** el trabajo fue aceptado.

La revisión puede dar:

- Aprobado.
- Requiere ajustes.

Los ajustes y reaperturas conservan versiones, enlaces, comentarios y actividad anterior.

## 13. Administración completa

Implementa pantallas funcionales para:

1. Usuarios y accesos.
2. Equipos y membresías.
3. Marcas y asignaciones.
4. Decks y piezas.
5. Tipos y plantillas de pedidos.
6. Pedidos recurrentes.
7. Integraciones.
8. Sincronización e historial de ejecuciones.
9. Importación y exportación.
10. Archivo y recuperación.
11. Historial de cambios.
12. Configuración general.

Protege al último superadmin activo.

Archiva entidades utilizadas en lugar de eliminarlas y romper registros.

## 14. Administración de decks

Esta sección es fundamental.

Cada marca debe tener configuración independiente de decks para:

- WP.
- SIS.

Yo completaré el listado correcto de piezas desde Administración.

Permite configurar:

- Nombre del deck.
- Marca.
- Canal.
- Descripción.
- Piezas.
- Cantidades.
- Medidas.
- Formatos.
- Especificaciones.
- Referencias.
- Obligatoriedad.
- Grupos.
- Orden.

Permite varias variantes por marca/canal y un deck predeterminado.

Incluye duplicación de plantillas y vista previa.

Al generar un pedido, copia la versión correspondiente del deck a su checklist.

Cambiar una plantilla no modifica pedidos existentes automáticamente.

Ofrece aplicar cambios a pedidos abiertos con vista previa y selección, preservando progreso, responsables, comentarios y entregas.

Si no existe un deck configurado, crea el pedido con aviso:

**Deck por configurar**

No inventes piezas.

## 15. Campañas y canales

Una campaña genera un pedido general con checklist por canal correspondiente.

Si existe en ambos canales, debe generar:

- Pedido WP con deck WP.
- Pedido SIS con deck SIS.

Ambos estarán vinculados a la misma campaña.

No supongas que todas las entradas del calendario aplican a ambos canales. Determina el canal desde la fuente o reglas configuradas.

Si hay ambigüedad, lleva la campaña a revisión sin crear pedidos arbitrarios.

## 16. Calendario de campañas

Adjuntaré:

**2026 Calendario de Campañas PAUTA - OFICIAL.xlsx**

El original en Drive tiene este identificador:

**1SaoG7PHCmVmKB7llxu2OFbYSVT6m25kWfNAU5I27hiQ**

Usa el archivo exacto. El identificador no sustituye la autorización de acceso.

Inspecciona el formato real del original:

- Si es Google Sheets, usa Sheets API.
- Si es XLSX almacenado en Drive, lee el archivo original mediante Drive y analízalo en backend.

No conviertas ni modifiques el original silenciosamente.

La copia adjunta sirve para desarrollar y probar el lector; no es la fuente de actualizaciones diarias.

El calendario tiene:

- Pestañas por marca.
- Meses y días en columnas.
- Categorías en filas.
- Bloques con celdas combinadas.

Las fechas se deducen de la posición y extensión de los bloques.

No implementes un lector que dependa únicamente de texto, filas fijas o coordenadas constantes.

Pestañas observadas:

- COLISEUM.
- CONVERSE.
- MERRELL.
- NEW BALANCE.
- CATERPILLAR.
- UMBRO.
- HITEC.
- FILA.
- STEVE MADDEN.

Mapeos iniciales:

- CATERPILLAR → CAT.
- HITEC → HI-TEC.
- UMBRO → Umbro Perú.

Umbro Colombia se gestiona aparte. Converse Bolivia tampoco debe importarse desde CONVERSE sin una fuente o regla explícita.

## 17. Sincronización automática

Ejecuta una sincronización una vez al día en backend, aunque nadie abra la aplicación.

Zona horaria:

**America/Lima**

La hora será configurable.

Incluye “Sincronizar ahora” para usuarios autorizados, con límites de frecuencia y protección contra ejecuciones simultáneas.

Configura acceso persistente de lectura al calendario mediante cuenta de servicio compartida o OAuth con renovación protegida en backend.

El login Google de los integrantes no concede acceso automático al calendario.

Guarda:

- Última lectura exitosa.
- Estado de sincronización.
- Errores.
- Snapshot normalizado.
- Historial de ejecuciones.
- Cambios detectados.
- Casos pendientes de revisión.

Detecta:

- Nueva campaña.
- Cambio de fechas.
- Cambio de nombre.
- Cambio de canal o información relevante.
- Campaña retirada de la fuente.

Ejemplo de aviso:

“CAT: la campaña pasó del 13–16 al 12–17 de octubre.”

Muestra valores anteriores y nuevos.

No confundas momento de detección con momento exacto de modificación de la fuente.

## 18. Anticipación y deadlines

Crea el pedido cuando detectes la campaña, aunque falte más de una semana.

- Más de siete días: Próximos.
- Siete días o menos: destacar en el tablero.
- Incorporación con menos de siete días: Poca anticipación.
- Inicio hoy: Inicio inmediato.

Deadline predeterminado:

**Dos días calendario antes del inicio de campaña.**

Debe poder editarse manualmente.

La hora de entrega será configurable y visible.

Si la campaña cambia:

- Recalcula deadlines automáticos de pedidos abiertos.
- Conserva deadlines manuales.
- Avisa sobre el impacto.
- No reabre pedidos entregados automáticamente.

Si el deadline calculado ya pasó, conserva la fecha y señala que debe reprogramarse. No ocultes la incorporación tardía.

No prometas detectar cambios instantáneamente con una lectura diaria.

## 19. Integridad de sincronización

La fuente puede no tener IDs únicos de campañas.

Usa IDs internos estables y conserva relaciones de origen.

No identifiques una campaña únicamente por:

- Su nombre.
- Su fecha.
- Su número de fila.

Los cambios de fechas o desplazamientos de filas no deben duplicar pedidos.

Compara marca, contexto, canal, nombre y rangos temporales. Cuando el resultado sea ambiguo, solicita revisión dentro de la aplicación.

Permite vincular manualmente una entrada detectada con una campaña existente.

La sincronización y sus reintentos deben ser idempotentes.

No sobrescribas:

- Responsables.
- Comentarios.
- Checklist.
- Entregas.
- Deadlines manuales.

No borres pedidos porque una campaña desaparezca.

Una lectura fallida no significa que se eliminaron campañas.

La primera importación debe tener vista previa y fecha inicial configurable para evitar importar todo el historial.

## 20. Funcionalidades inspiradas en Asana y Trello

Implementa:

- Comentarios y menciones.
- Seguidores de pedidos.
- Historial de actividad.
- Dependencias simples entre pedidos.
- Motivos de bloqueo.
- Bandeja de notificaciones internas.
- Filtros y vistas guardadas.
- Duplicación de pedidos.
- Acciones en lote.
- Pedidos recurrentes.
- Formulario interno de brief.
- Vista de carga por persona y semana.

Evita ciclos en dependencias.

Agrupa notificaciones para no saturar a las personas.

Las notificaciones deben respetar los permisos de equipo y marca.

No envíes correos o mensajes externos sin configuración y autorización específica.

En recurrencias, evita duplicados por reintentos y permite pausar.

La carga de trabajo mostrará pedidos y piezas pendientes. Las horas estimadas serán opcionales. No presentes el número de pedidos como una medición exacta del esfuerzo.

No necesitas conectar Asana o Trello: son referencias funcionales y de interacción.

## 21. Importación del Excel de pedidos

Adjuntaré:

**Converse_Funka to-do list.xlsx**

Inspecciona sus pestañas y diferencias de estructura.

Mapea:

- Fecha.
- Tarea.
- Tipo.
- Asignado a.
- Prioridad.
- Deadline.
- Estado.
- Comentarios.
- Entregado el.
- Enlace.

La marca de esos registros será Converse.

Ofrece vista previa, selección de pestañas/período y resolución de responsables.

No importes encabezados o separadores como “PENDIENTES JUEVES” como pedidos.

No inventes correos para nombres existentes en el Excel.

Evita duplicados entre pestañas e importaciones repetidas.

Conserva enlaces de entrega y fechas.

No modifiques el archivo adjunto ni el original.

## 22. Footer obligatorio

El footer público debe mostrar exactamente:

**A project by Joel Yañez @manaturaloso**

Solo el texto **@manaturaloso** debe enlazar a:

**https://www.instagram.com/manaturaloso**

Preserva el texto, el acento, las mayúsculas y los espacios.

Inclúyelo en la pantalla de ingreso y en las vistas principales. Debe ser discreto y legible.

## 23. Modelo de datos y seguridad

Diseña un modelo documentado para:

- Usuarios.
- Equipos.
- Membresías y accesos por marca.
- Marcas.
- Decks y versiones.
- Campañas.
- Pedidos.
- Piezas.
- Comentarios.
- Entregas.
- Actividad.
- Notificaciones.
- Recurrencias.
- Configuración de integración.
- Ejecuciones y snapshots de sincronización.

Usa índices acordes con las consultas.

Los secretos permanecen en servidor y fuera del repositorio.

Las operaciones privilegiadas verifican identidad y alcance.

Utiliza timestamps de servidor y transacciones donde sean necesarias.

La edición concurrente no debe perder datos silenciosamente.

El historial no debe poder reescribirse desde el cliente.

Implementa archivo y recuperación, y documenta una estrategia real de respaldo. No llames “respaldo” únicamente al historial de actividad.

## 24. Pruebas de aceptación

Verifica al menos:

1. Un usuario sin autorización no puede leer datos.
2. Nadie puede autoasignarse el rol superadmin.
3. Una persona en dos equipos reúne sus pedidos correctamente.
4. Los permisos protegen también accesos directos por URL y API.
5. Todos los miembros autorizados colaboran en sus pedidos.
6. Decks WP y SIS generan checklists distintos.
7. Cambiar una plantilla no altera pedidos existentes.
8. Responsables por pieza, comentarios y entregas persisten.
9. Las URLs Mega conservan su fragmento completo.
10. Repetir una sincronización no duplica pedidos.
11. Un cambio de fechas genera un aviso correcto.
12. Deadline manual se conserva y automático se recalcula.
13. Un pedido entregado no se reabre solo.
14. Una lectura fallida no elimina campañas.
15. Canal ambiguo y deck faltante generan estados explícitos.
16. El lector tolera desplazamientos razonables de filas y columnas.
17. Recurrencias no generan duplicados.
18. Acciones en lote respetan acceso.
19. La importación excluye separadores y encabezados.
20. El footer y el enlace son exactos.
21. Las vistas funcionan en celular y con teclado.
22. No quedan botones que simulen operaciones no implementadas.

Usa fixtures sintéticos o copias de prueba. No contamines producción con usuarios o pedidos ficticios.

## 25. Entrega y criterio de finalización

Entrega:

- Código fuente completo.
- README con instalación y desarrollo.
- Configuración de Firebase y emuladores.
- Variables de entorno documentadas sin secretos.
- Reglas e índices de Firestore.
- Backend de sincronización.
- Pruebas y resultados.
- Instrucciones de despliegue.
- Guía breve de administración.
- Limitaciones o pasos externos pendientes.
- URL de producción cuando el despliegue esté verificado.

Empieza ahora inspeccionando los adjuntos y el workspace, define el plan de implementación y construye la aplicación.

Cuando necesites mi cuenta para crear o configurar Firebase, avísame claramente que debo ingresar con **joel.yc23@gmail.com** y explícame qué acción requiere mi intervención.