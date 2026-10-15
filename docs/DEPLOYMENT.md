# Publicación en Firebase

**Primera versión publicada en https://pendientesfunka.web.app.**

Proyecto `funka-joel-2026` (`357365313775`), cuenta Google verificada `joel.yc23@gmail.com`, sitio Hosting `pendientesfunka`. El usuario eligió este nombre después de que Firebase rechazara `funka` por estar reservado por otro proyecto. No se modificó ni desplegó el proyecto alternativo `funka-f2204`.

## Decisión de costos

El usuario eligió mantener la facturación desactivada. No vincular cuentas de facturación, actualizar a Blaze ni habilitar servicios que requieran pago sin nueva autorización. Firestore Standard usa su cuota gratuita, con protección contra borrado y PITR desactivado. Firebase Authentication es estándar con Google habilitado. No hay Functions, Scheduler ni respaldos programados desplegados.

## Configuración y alcance

`.firebaserc` apunta al proyecto verificado y `firebase.spark.json` al sitio `pendientesfunka`, las reglas `firestore.spark.rules` y los índices. El SDK web público de la app registrada está en `.env.production.local`, ignorado por Git; los emuladores están desactivados en producción y el backend es `spark`.

Los superadmins administran, editan y eliminan registros con vista previa y cascada; los miembros solo consultan sus alcances. Las autorizaciones anteriores al primer ingreso necesitan activar el perfil después. Las garantías y limitaciones se describen en [SPARK.md](SPARK.md). No presentar esta versión como cumplimiento completo de todos los requisitos.

## Publicación comprobada

`npm run deploy:spark` completó la publicación de reglas, índices y Hosting. El sitio real respondió HTTP 200, cargó sin errores JavaScript, mostró el ingreso habilitado y abrió el popup Google real. A 390 px no hubo desborde horizontal. Firestore rechazó la lectura anónima con 403. El primer ingreso real de Joel y la creación de su perfil propietario aún deben comprobarse con su cuenta; las identidades de pruebas solo existen en emuladores.

## Acceso seguro

`FIREBASE_TOKEN` está vinculado como secreto del entorno y funciona para el CLI. Nunca registrar su valor, guardarlo en Git ni pegarlo en el chat. El mecanismo `login:ci` está obsoleto; sustituirlo por autenticación mantenida cuando esté disponible y revocarlo al finalizar su uso.

Para nuevas versiones, configurar el SDK público real y ejecutar `npm run deploy:spark`; su preflight valida proyecto, sitio, modo Spark, emuladores desactivados y ausencia de Functions. No usar la configuración antigua para desplegar esta versión. El historial de Hosting no revierte reglas ni datos. No se crearon marcas, equipos ni campañas ficticias en producción.
