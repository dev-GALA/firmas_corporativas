# firmas_corporativas

Recursos y generador de firmas de correo corporativas del Grupo GALA (GALA Formación y Autoescuela GALA).

A partir de un Google Sheet con los datos de los empleados y 4 plantillas HTML, el script genera la firma HTML personalizada de cada empleado, lista para que IT/RRHH se la envíe y el empleado la pegue en Gmail/Outlook.

## Estructura

```
firmas_corporativas/
├── logos/               Logos de marca (PNG)
├── iconos/              Iconos de redes sociales (50px)
├── plantillas/          4 plantillas HTML con placeholders {{...}}
│   ├── formacion-con-qr.html
│   ├── formacion-sin-qr.html
│   ├── autoescuela-con-qr.html
│   └── autoescuela-sin-qr.html
├── qr/                  QRs personales por empleado (qr-{slug}.png)
├── script/
│   └── generar-firmas.js   generador (Node.js puro, sin npm)
├── firmas_out/          salida HTML (ignorada por git, se regenera bajo demanda)
├── .env                 contiene CSV_URL (NO se commitea)
└── .env.example         plantilla con CSV_URL= vacío
```

Los assets (logos, iconos, QRs) se sirven vía GitHub Pages en `https://dev-gala.github.io/firmas_corporativas/`, por eso las firmas funcionan al pegarse en Gmail/Outlook sin adjuntar imágenes.

## Requisitos

- Node.js 18 o superior. No hay `npm install`; el script no usa dependencias externas.
- Acceso al Google Sheet de empleados (publicado como CSV).
- El fichero `.env` con la línea `CSV_URL=...` apuntando al CSV publicado del Sheet. Copiar de `.env.example` y rellenar.

## Modelo del Google Sheet

Una fila por firma, en este orden de columnas:

| Columna | Valores | Notas |
|---|---|---|
| `fecha_generacion` | texto/fecha | Metadato interno de gestión. El script lo ignora. |
| `firma_generada` | texto/check | Metadato interno de gestión. El script lo ignora. |
| `marca` | `Autoescuela` o `Formacion` | Determina la plantilla (marca + qr). |
| `tipo firma` | `Personal`, `Local` o `Servicios` | Solo clasificación interna; no afecta al render. |
| `nombre` | texto | Nombre y apellidos (o nombre del centro / buzón). |
| `cargo` | texto | "Cargo · Departamento". Vacío para `Local`/`Servicios`. |
| `telefono` | texto | Visible en la firma. |
| `email` | texto | Visible y usado en el `mailto:`. |
| `qr` | texto | Nombre del PNG en `qr/` (ej. `qr-sara-casillas.png`). Vacío si no lleva QR. |
| `direccion` | texto | Dirección postal (sin tilde en la cabecera, sí en el contenido). |
| `maps_url` | URL | URL de Google Maps. |

**Campo vacío = se omite.** Si `cargo` está vacío (típico en `Local`), la línea desaparece de la firma; si `maps_url` está vacío, no aparece el icono de Maps. Etc.

## Uso

### Generar una sola firma o un bloque (interactivo)

```bash
node script/generar-firmas.js
```

El script:
1. Descarga el CSV del Sheet.
2. Lista los empleados disponibles, numerados según la fila del Sheet (fila 2 = primer empleado).
3. Pregunta qué filas generar.
4. Genera los HTML en `firmas_out/`.

Aceptado en el prompt: números sueltos (`5`), listas (`2,4,7`), rangos (`10-15`), mezclas (`2,5,10-15`), `todas`, o filtros por columna (`marca:autoescuela`, `tipo:personal`).

### Generar filas concretas sin prompt

```bash
node script/generar-firmas.js --only "2,5,10-15"
```

### Generar una tanda por valor de columna

```bash
node script/generar-firmas.js --marca Autoescuela      # todas las de esa marca
node script/generar-firmas.js --tipo Personal          # todas las de ese tipo firma
node script/generar-firmas.js --marca Formacion --tipo Personal   # las que cumplen ambos
```

Los filtros se combinan con **AND**: `--marca Formacion --tipo Personal` genera solo las firmas Personales de Formación. `--only` y los filtros de columna también se pueden combinar (`--only "2-40" --marca Autoescuela`). El match de marca/tipo es insensible a mayúsculas; si un valor no existe en el Sheet, avisa y no genera nada.

### Generar todas las firmas de golpe

```bash
node script/generar-firmas.js --all
```

### Ayuda

```bash
node script/generar-firmas.js --help
```

## Flujo para añadir un nuevo empleado

1. Añadir una fila al Google Sheet con sus datos.
2. Si lleva QR: subir el PNG a `qr/` con el patrón `qr-{nombre}-{apellido}.png` y hacer `git push` para que GitHub Pages lo sirva. Poner ese filename exacto en la columna `qr` del Sheet.
3. Ejecutar `node script/generar-firmas.js` y seleccionar la fila del nuevo empleado.
4. Coger el `firmas_out/{slug-nombre}.html` y enviárselo al empleado por chat con la instrucción: "abre Gmail → Configuración → Firma → pega esto".

## Flujo para modificar una firma existente

1. Editar la fila correspondiente en el Sheet.
2. Ejecutar `node script/generar-firmas.js --only "{número de la fila}"`.
3. Reenviar el HTML actualizado al empleado.

## Troubleshooting

- **"La URL devolvió HTML en vez de CSV"**: el Sheet se ha despublicado. Volver a publicarlo: `Archivo → Compartir → Publicar en la web → en el desplegable izquierdo elegir la pestaña de empleados (no "Todo el documento") → CSV → Publicar`.
- **Regeneré una firma pero sale con datos viejos**: el CSV publicado va con **caché de unos minutos**, así que justo después de editar el Sheet puede seguir sirviendo la versión anterior. Espera unos minutos y vuelve a generar, o exporta el CSV a mano (`Archivo → Descargar → CSV`) y úsalo con `--csv-file`.
- **Cambié el nombre de alguien y ahora hay dos HTML suyos**: el fichero se nombra a partir del nombre, así que al corregirlo se crea uno nuevo y queda el antiguo con datos obsoletos. Borra el HTML viejo de `firmas_out/`.
- **"qr/qr-xxx.png NO existe en el repo"**: la columna `qr` del Sheet apunta a un PNG que no está en `qr/`. O subir el PNG y commitear, o vaciar la columna `qr` de esa fila.
- **El QR aparece roto en la firma del empleado**: comprobar que el PNG esté commiteado y pusheado al repo (GitHub Pages sirve solo lo que está en `main`).
- **`firmas_out/` no aparece en el commit**: es normal, está en `.gitignore`. Las firmas se regeneran bajo demanda; el repo solo guarda fuentes (plantillas, assets, script).
