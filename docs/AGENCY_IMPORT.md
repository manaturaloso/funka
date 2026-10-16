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

Las copias de pestañas se comparan incluyendo datos, enlaces y fórmulas. Los registros repetidos y las identidades parecidas con datos diferentes se presentan para revisión, sin fusionar ni borrar filas. Los identificadores de vista previa no son IDs de pedidos; el futuro importador debe comparar con los pedidos ya existentes y generar recibos idempotentes antes de escribir.

## Archivo revisado el 15 de octubre de 2026 (Lima)

11 pestañas, 1421 filas con información y 566 registros exactamente distintos. Nueve pestañas son copias de NB DISEÑO: CAT, UMBRO, UMBRO COL, FILA, HI-TEC, MERRELL, STEVE MADDEN y CONVERSE, además de la original. Cada una contiene 106 filas con información y otras 46 filas de solo marca. Las ocho copias aportan 848 filas que contradicen el nombre de su pestaña, pues la columna Marca dice NB.

Si Joel confirma excluir las ocho copias, quedan 573 filas por revisar: NB DISEÑO 106, COLISEUM DISEÑO 455 y COLISEUM CM 12. Esa proyección todavía incluye repeticiones que no se deben fusionar por suposición. Hay 154 prioridades y 511 tipos que necesitan equivalencias o una política explícita de valores faltantes, 3 enlaces mal formados y nombres de encargados pendientes de vincular con sus cuentas reales.

No se importó nada. Falta confirmar si las copias son plantillas y completar las correspondencias de personas/equipos/marcas. La comprobación contra datos reales requiere recuperar cuota en Firebase; la sincronización continúa respetando su espera programada.
