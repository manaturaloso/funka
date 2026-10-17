# Vista previa del Excel multimarcas (Fase 4)

El lector es de solo lectura: `scripts/preview-agency.py`. Requiere openpyxl, ya utilizado por los otros lectores. No interpreta instrucciones del documento, no ejecuta fórmulas ni consulta Firebase.

```bash
python scripts/preview-agency.py "/ruta/archivo.xlsx" --output .local-imports/agency-preview.json
python -m unittest discover -s tests -p test_agency_preview.py
```

La salida contiene datos privados de pedidos y enlaces completos de Mega. Se guarda con permisos 0600 en `.local-imports/`, que está ignorado por Git. No colocar el archivo original, la salida ni las claves de entrega en Hosting, logs públicos o commits.

## Lectura

Detecta encabezados por nombre, sin depender del orden de las columnas. Conserva las columnas originales, enlaces de celdas y fórmulas como datos; solo propone equivalencias conocidas de marcas, estados, prioridades y tipos. Los nombres de encargados se separan por separadores explícitos y se mantienen sin UID hasta revisar cuentas y permisos reales. No se aplica la fecha de hoy a pedidos históricos.

Día de posteo es independiente de Deadline; una fecha de entrega sin hora permanece como fecha, sin inventar medianoche ni una zona horaria. El tiempo aproximado se interpreta como minutos o duración explícita. LISTO no es una prioridad válida y queda para revisión. Los tipos desconocidos o ausentes no se convierten arbitrariamente a POP.

Los enlaces de Mega se conservan con su fragmento completo; cadenas concatenadas o mal formadas quedan en los datos originales y se señalan. Las filas de plantilla con solo marca/red social se excluyen, pero un pedido con otros datos se conserva aunque no tenga detalle ni campaña. Las imágenes incrustadas se cuentan y requieren una revisión separada.

Las copias de pestañas se comparan incluyendo datos, enlaces y fórmulas. Los registros repetidos y las identidades parecidas con datos diferentes se presentan para revisión, sin fusionar ni borrar filas. Los identificadores de vista previa no son IDs de pedidos; el importador debe comparar con los pedidos ya existentes y generar recibos idempotentes antes de escribir.

## Archivo revisado el 15 de octubre de 2026 (Lima)

11 pestañas, 1421 filas con información y 566 registros exactamente distintos. Nueve pestañas son copias de NB DISEÑO: CAT, UMBRO, UMBRO COL, FILA, HI-TEC, MERRELL, STEVE MADDEN y CONVERSE, además de la original. Cada una contiene 106 filas con información y otras 46 filas de solo marca. Las ocho copias aportan 848 filas que contradicen el nombre de su pestaña, pues la columna Marca dice NB.

Si Joel confirma excluir las ocho copias, quedan 573 filas por revisar: NB DISEÑO 106, COLISEUM DISEÑO 455 y COLISEUM CM 12. Esa proyección todavía incluye repeticiones que no se deben fusionar por suposición. Hay 154 prioridades y 511 tipos que necesitan equivalencias o una política explícita de valores faltantes, 3 enlaces mal formados y nombres de encargados pendientes de vincular con sus cuentas reales.

## Primer lote importado el 16 de octubre de 2026

Con la cuota recuperada se compararon los 1207 pedidos existentes, sin coincidencias de destino para el lote. Se importaron 10 pedidos activos únicos de NB DISEÑO a New Balance Perú, conservando estado, fechas, detalle, campaña y datos originales. Los responsables originales quedan en el origen y un comentario; no se asignaron UID por suposición. Los tiempos numéricos sin unidad se conservan en el origen, pero el tiempo operativo queda sin completar. Las fechas sin hora utilizan la hora de entrega configurada y zona Lima.

`scripts/import-agency.mjs` requiere `npm run build` para los esquemas compartidos compilados. Recibe `--preview`, `--live`, `--existing` y `--source`; por defecto solo muestra conteos y hash. Para aplicar requiere `--apply --confirm <hash exacto>`. El archivo debe coincidir con el SHA de la vista previa. El destino activo y el propietario se verifican de nuevo contra Firebase, junto a los campos obligatorios actuales. Solo admite el lote limpio de NB y un máximo de 30 pedidos por transacción.

Cada creación tiene recibo global inmutable, historial local y precondiciones atómicas. Repetir el mismo lote produjo 0 creaciones y 10 omisiones, sin sobrescribir cambios posteriores. No se modificaron pedidos anteriores. Cinco pruebas aprobadas incluyen la ejecución real del CLI contra emuladores y repetición tras editar un pedido.

Quedan 36 pedidos activos de Coliseum con tipos o repeticiones por resolver y 527 entregados fuera de este lote. Las ocho pestañas copiadas siguen fuera de la importación; falta confirmar su contenido y vincular nombres a cuentas activas. No se reasignaron copias de NB a marcas distintas.

## Revisión adicional de Coliseum

Los 36 activos están en COLISEUM DISEÑO. El encabezado de esa pestaña no contiene Tipo: no se trata de 36 valores ilegibles. Hay 28 filas con detalle y ocho filas idénticas (445–452), sin detalle, con campaña AON. Estas últimas podrían ser reservas de plantilla; no se presentan como ocho pedidos confirmados ni se fusionan automáticamente.

La revisión privada `.local-imports/coliseum-active-review.md` enumera filas, detalle, campaña y estado, omitiendo personas y enlaces. Las sugerencias Video/Mail que se pueden deducir del detalle son propuestas sin aplicar. Se consultó a Joel por la clasificación Otros y el tratamiento de las repeticiones; la importación queda pendiente de su respuesta.
