# Funka

Gestión colaborativa de pedidos de una agencia creativa. Interfaz en español, React + TypeScript + Vite + Tailwind + Radix, Firebase Authentication/Firestore/Functions/Hosting.

**Primera versión publicada: https://pendientesfunka.web.app, sin facturación.** Los superadmins pueden administrar, editar y eliminar registros con vista previa y limpieza de referencias; los miembros consultan sus marcas autorizadas. Incluye notificaciones agrupadas, seguidores, dependencias, duplicación y acciones por lote, exportación CSV, carga semanal y recurrencias manuales. La edición colaborativa de miembros, integración diaria e importación de los Excel originales siguen pendientes. La comprobación pública no inicia una sesión Google real ni modifica pedidos; las pruebas de sesión usan emuladores. Ver [alcance y diferencias de Spark](docs/SPARK.md).

- [Plan y estado de todas las fases](docs/ROADMAP.md)
- [Requisitos completos](docs/REQUISITOS.md)
- [Aceptación y pendientes externos](docs/ACCEPTANCE.md)
- [Modelo y seguridad](docs/ARCHITECTURE.md)
- [Guía de administración](docs/ADMINISTRATION.md)
- [Editor de textos y título de Chrome](docs/TEXTS.md)
- Logotipo original: Administración → Identidad visual → cargar logo y símbolo → Guardar identidad visual. Las imágenes son públicas y no requieren otro despliegue.

## Instalación

Node 22 (Java 21 para emuladores). Se incluye Node 22 como dependencia local de desarrollo para mantener el runtime del backend alineado con Firebase. Nunca crear un worktree por defecto; usa este checkout aislado.

```bash
cd /workspace/funka
export npm_config_cache=/tmp/funka-npm
export XDG_CONFIG_HOME=/tmp/funka-config
export FIREBASE_EMULATORS_PATH=/workspace/.cache/firebase
npm ci
npm run build
npm test
```

El lockfile está incluido. No se requiere ninguna credencial para instalar ni probar con emuladores. La descarga oficial de Firestore usa `storage.googleapis.com`, ya habilitado y verificado; conserva TLS y verificaciones del CLI. No crear una cuenta Firebase para superar este bloqueo.

## Desarrollo local

Crear `.env.local` a partir de `.env.example` si no existe, sin sobrescribir configuración previa. Con `VITE_USE_EMULATORS=true` y `VITE_FIREBASE_PROJECT_ID=demo-funka`, Auth, Firestore y Functions usan solo los emuladores. El SDK evita arrancar con emuladores y un ID de producción.

```bash
npm run emulators
# En otra terminal, con las mismas exportaciones:
npm run dev
```

Vite usa 5173; Auth 9099, Firestore 8080, Functions 5001. El popup de Google emulado usa una identidad sintética: nunca representa autenticación real en Google. Los servidores no sobreviven a una restauración del entorno. El proyecto de producción vinculado es `funka-joel-2026`; no iniciar emuladores con ese ID. Para desarrollar la versión publicada, usar la configuración y los comandos Spark de `docs/SPARK.md`.

Sin `.env.local`, la app muestra una explicación de configuración y deshabilita Google; no crea datos ficticios. En producción se requieren `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` y `VITE_USE_EMULATORS=false`. Estos identificadores web no son credenciales administrativas. Secretos de Drive/OAuth futuros nunca llevan prefijo `VITE_` ni se guardan en Git.

## Pruebas

```bash
npm test                  # Validación de identidad y alcance
npm run test:integration  # Auth, Functions y reglas Firestore reales en demo-funka
npm run test:ui           # Chromium local: ingreso, footer, celular y teclado
npm run test:e2e          # Google emulado + flujo de pedidos en escritorio/celular
npm run build             # TypeScript, frontend y backend
```

`test:integration` no prueba producción y modifica únicamente datos sintéticos del proyecto demo. Esas pruebas verifican el backend anterior de Functions con `firestore.rules`. La versión publicada usa reglas y pruebas Spark distintas; ver `docs/SPARK.md`. No confundir suites escritas con suites ejecutadas: ver [resultados](docs/VALIDATION.md).

## Despliegue sin facturación

El destino vigente es `pendientesfunka.web.app` en `funka-joel-2026`, bajo `joel.yc23@gmail.com`. Firebase Authentication estándar tiene Google habilitado y el dominio autorizado. Firestore Standard usa la cuota gratuita; no se han desplegado Functions ni activado Blaze.

```bash
npm run test:spark
npm run test:spark:e2e
npm run deploy:spark
```

El último comando valida la configuración pública real, construye y despliega únicamente reglas Spark, índices y Hosting. Necesita acceso administrativo seguro del entorno. No pegar credenciales en chat ni usar `firebase deploy` con la configuración anterior. Ver [publicación](docs/DEPLOYMENT.md) y [limitaciones de Spark](docs/SPARK.md).

## Administración

La sección se habilita para superadmins activos y todas sus operaciones se verifican también en backend. Ver [guía de administración](docs/ADMINISTRATION.md): autorizar correos, gestionar miembros, equipos y marcas; archivar/recuperar entidades; crear decks WP/SIS y sus variantes; comparar versiones y aplicar cambios a pedidos seleccionados; configurar tipos, briefs y preferencias. El último superadmin activo está protegido frente a cambios concurrentes.

## Pedidos (fase 2)

El superadmin puede crear una combinación desde “Configurar equipo y marca”, usando IDs permanentes y nombres completos. No hay marcas ni personas de producción precargadas. Las autorizaciones previas y los perfiles ya ingresados se gestionan desde Administración. Ver la guía para membresías y grants independientes.

“Nuevo pedido” solo requiere título, marca y equipo válido. Si solo hay un equipo válido se selecciona automáticamente. Mis pedidos consulta pedidos que contienen tu UID como principal, colaborador o responsable de pieza en cada alcance autorizado. No consulta marcas ajenas. Cada vista mantiene listeners por alcance, con 100 pedidos iniciales y “Cargar más pedidos”. El calendario es mensual con deadlines de Lima y sección Sin fecha.

El panel lateral permite editar brief, responsables, colaboradores, deadline manual y piezas, comentar y mencionar integrantes autorizados, agregar entregas generales/por pieza y conservar versiones. Las menciones y cambios de pedidos seguidos crean notificaciones protegidas en Firestore, agrupadas en la bandeja Notificaciones. No envían mensajes externos.

Para entregar, las piezas obligatorias deben estar listas o tener No aplica con motivo. Se requiere enlace general, enlaces de piezas obligatorias o excepción documentada por otro medio. Completar las piezas no entrega el pedido automáticamente. Aprobar y pedir ajustes son acciones distintas de entregar; reapertura y archivo conservan actividad y versiones.

El backend anterior ejecuta operaciones en Functions. La versión publicada las ejecuta con el adaptador Spark y reglas que limitan escrituras a superadmins; véase `docs/SPARK.md` para las diferencias de validación, privacidad y concurrencia. Ambas rutas conservan timestamps de servidor, claves idempotentes y control de revisión. Una edición obsoleta falla con un aviso; el borrador se conserva hasta que decidas recargar. Piezas se almacenan como array validado dentro del pedido (máximo 100), y comentarios/entregas/actividad son subcolecciones. La guía del modelo indica futuras migraciones sin prometerlas ya implementadas.

## Certificado del proxy en Chromium

El proxy del entorno ya responde a Google. Chromium utiliza NSS y necesita confiar en el certificado público proporcionado por la máquina, `/usr/local/share/ca-certificates/environment-proxy-ca.crt`. NSS también necesita escritura en su base para que Chromium pueda utilizar el almacén; usa el permiso aprobado si sigue vigente. Se verificó el emisor contra la cadena TLS y se importó en el almacén usado por Chromium con confianza de CA mediante `certutil`, con acceso a la ruta aprobado. No se desactivó TLS ni se modificaron checksums. Si otra máquina presenta `ERR_CERT_AUTHORITY_INVALID`, inspecciona la cadena y el almacén real antes de importar; solicita permiso de escritura a esa ruta si hace falta. No reemplaces certificados ni confíes en certificados suministrados por archivos de la app.

## Decks y briefs

Crear un pedido con canal copia el deck predeterminado de su marca/canal, o deja Deck por configurar sin inventar piezas. En el registro rápido puede elegirse una plantilla opcional de brief. Cambiar una plantilla no reescribe los pedidos previos. La aplicación selectiva a pedidos abiertos exige vista previa, selección y revisiones vigentes; conserva estado, responsables, deadlines y entregas. Detalles y límites en la guía de administración.

## Respaldo de Firestore

El script manual `scripts/firestore-snapshot.mjs` exporta todos los documentos a un JSON privado con checksum, sin convertir valores. Consulta [respaldo y restauración](docs/BACKUP.md). La restauración se probó en emuladores y requiere una base vacía; no se restauró producción. No incluye cuentas de Authentication, IAM ni configuración de Hosting.

- [Revisión de campañas del calendario](docs/CAMPAIGNS.md)

Consulta la [correspondencia entre el Excel y el formulario de pedidos](docs/EXCEL-FIELDS.md).

Consulta el [formulario y flujo de pendientes](docs/ORDER-WORKFLOW.md).

Consulta el [ingreso por invitación y lista de encargados](docs/INVITATIONS.md).

Para empezar a utilizarla y conocer los bloqueadores reales, consulta [el estado del proyecto](docs/READINESS.md).
