# Invitaciones y encargados en Spark

El administrador autoriza un correo en Invitaciones, con activo, equipos y marcas. Al ingresar por primera vez con ese mismo correo de Google verificado, la aplicación aplica exactamente la invitación vigente: perfil member activo, memberships, access y directorio people por alcance. Todo se confirma en una transacción con control global de concurrencia y recibo de auditoría. No hace falta activar el perfil ni repetir los accesos.

También se permite canjear una invitación activa desde un perfil pending creado con una versión anterior. Los perfiles que ya son member o superadmin conservan las decisiones del administrador al volver a ingresar. Una invitación antigua no reactiva un miembro desactivado ni reemplaza permisos editados en Usuarios.

Las reglas permiten consultar exclusivamente la propia invitación mediante consulta por correo exacto y verificado. No se abre el listado general. El canje no acepta roles superiores, otros equipos, otras marcas, UID ajeno, invitación revocada ni una revisión antigua. Las escrituras de directorio son únicamente para la identidad que ingresa y los alcances aprobados. Las marcas archivadas siguen protegidas por las reglas de acceso. Un acceso histórico extra no autoriza marcas fuera del perfil de invitación.

En Nuevo pedido, se selecciona primero marca y, cuando corresponde, equipo. Encargado queda deshabilitado con una explicación mientras falte esa selección o se cargue la lista. Los invitados aparecen como personas asignables después de su primer ingreso: la aplicación necesita su identidad Google real, no crea UID ficticios para correos que todavía no ingresaron.

No se habilitaron Functions, Storage ni Blaze. La aplicación conserva el alcance actual: miembros consultan sus marcas; la edición de pedidos en Spark continúa reservada al superadministrador.
