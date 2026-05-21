# Proyecto: Generador de firmas HTML corporativas — Grupo GALA

Este fichero es contexto persistente para Claude Code. Al abrir el repositorio en VS Code, Claude lo carga automáticamente.

---

## Objetivo

Script Node.js que, a partir de un Google Sheet con los datos de los empleados y 4 plantillas HTML, genera la firma personalizada de cada empleado lista para que IT/RRHH se la envíe y el empleado la pegue en Gmail/Outlook.

## Decisiones cerradas (no re-discutir, ya validadas con el usuario)

- **Lenguaje del script:** Node.js.
- **Fuente de datos:** Google Sheet publicado como CSV (sin Google API ni credenciales).
- **Plantillas:** 4 HTMLs combinando marca × QR.
- **Recursos (assets):** este mismo repo, https://github.com/Grupo-Gala/firmas_corporativas, servido vía GitHub Pages en `grupo-gala.github.io/firmas_corporativas/`. Ya tiene `logos/`, `iconos/` y 16 QRs pre-generados en `qr/` con patrón `qr-{nombre}-{apellido}.png`.
- **Entrega:** copy-paste por el empleado en Gmail/Outlook (lo genera y envía IT/RRHH).
- **Estructura HTML de las plantillas:** las 4 plantillas comparten la estructura compacta tipo "autoescuela" (una sola tabla con `<tr><td colspan>` para el aviso legal, sin tabla externa envolvente, sin `<div>` separado para el aviso legal). `font-family` unificado a `Montserrat, Arial, sans-serif`. Aviso legal: el largo (incluye la frase sobre derechos de acceso, rectificación y supresión).
- **QR explícito en el Sheet:** existe columna `qr` con el nombre exacto del PNG (o vacío). El script **no** deriva el nombre del QR slugificando `nombre`. Decisión tomada para evitar desincronizaciones silenciosas Sheet ↔ filenames.
- **URL del CSV en `.env`, no en el repo.** Publicar solo la pestaña concreta de empleados (no "Todo el documento") al exportar como CSV.
- **Sin dependencias npm.** El script usa solo Node.js estándar (`https`, `fs`, `path`, `readline`). No hay `package.json` ni `node_modules/`. CSV parser implementado a mano (~30 líneas, maneja comillas y CRLF correctamente).
- **Render condicional de campos vacíos.** Si un placeholder (`{{cargo}}`, `{{telefono}}`, `{{maps_url}}`, etc.) recibe valor vacío, se elimina la línea entera de la plantilla que lo contiene (y el `<div>` envolvente si queda sin contenido). Necesario porque las filas `Local` no llevan cargo, y algún `Personal` puede no tener teléfono. Decisión tomada para no dejar huecos visibles en la firma.
- **Tolerancia: columna `qr` con URL completa.** Si la celda lleva la URL completa en vez del filename (`https://grupo-gala.github.io/firmas_corporativas/qr/qr-xxx.png` en vez de `qr-xxx.png`), el script extrae el filename automáticamente y avisa por consola. La fuente de verdad sigue siendo el filename limpio en el Sheet; la tolerancia es solo red de seguridad.
- **Numeración de filas según Google Sheets.** El script muestra y acepta números de fila tal cual aparecen en Sheets (fila 1 = cabecera, fila 2 = primer empleado). Decisión tomada para que IT/RRHH pueda mirar el Sheet, ver la fila que quiere regenerar, y teclear ese mismo número sin re-indexar.
- **Modo interactivo + flags CLI.** Sin argumentos → el script lista los empleados y pregunta cuáles generar (uso normal por IT/RRHH). Con `--only "2,4,10-15"` no pregunta; con `--all` procesa todos. Ambos modos son first-class.

## Estado actual del repo

```
firmas_corporativas/
├── CLAUDE.md            ← este fichero
├── README.md            ← instrucciones de uso para IT/RRHH
├── .env.example         ← plantilla con CSV_URL= vacío (commiteable)
├── .env                 ← URL real del Sheet (NO se commitea, está en .gitignore)
├── .gitignore           ← ignora .env y firmas_out/
├── logos/               ← 3 logos
├── iconos/              ← 7 redes sociales 50px
├── plantillas/          ← 4 plantillas normalizadas y armonizadas con placeholders {{...}}
├── qr/                  ← 16 QRs ya generados
├── script/
│   └── generar-firmas.js ← generador (Node.js puro, sin npm)
└── firmas_out/          ← salida HTML, ignorada por git (se regenera bajo demanda)
```

Las 4 plantillas originales (pre-normalización) viven fuera del repo en la máquina del trabajo: `C:\Users\Usuario\Downloads\v{1,3}-Plantilla_Firma_Email_Corporativo-{Formacion,Autoescuela}-2026-{con,sin}-qr.html`. Ya no se necesitan; conservar como histórico si se quiere, no commitear.

## Modelo del Google Sheet (1 fila por empleado)

Orden de columnas en el CSV (en este orden exacto):

| Columna | Tipo | Notas |
|---|---|---|
| `marca` | enum | `Autoescuela` o `Formacion` (capitalizado tal cual en el Sheet). El script normaliza a minúsculas internamente para hacer match con los nombres de plantilla. |
| `tipo firma` | enum | `Personal`, `Local` o `Servicios`. **Solo gestión interna del Sheet** — clasificación para que IT/RRHH agrupe filas. **No afecta a la selección de plantilla** ni al render. El script la lee solo para validar (warning si valor inesperado) pero no la usa para decidir nada. |
| `nombre` | texto | Nombre y apellidos tal cual se mostrarán en la firma (capitalización normal, ej. `Sara Casillas`). |
| `cargo` | texto | Formato "Cargo · Departamento" |
| `telefono` | texto | Visible y usado en la firma |
| `email` | texto | Visible y usado en el `mailto:` |
| `qr` | texto | Nombre exacto del fichero PNG dentro de `qr/` (ej. `qr-sara-casillas.png`). Vacío si el empleado no lleva QR. |
| `direccion` | texto | Dirección postal (sede central si compartida, propia si no). **Sin tilde en la cabecera** (el contenido sí lleva tildes). |
| `maps_url` | texto | URL a Google Maps de esa dirección |

**Columna `qr` explícita** (fuente de verdad para el QR). El script lee esa columna directamente — no slugifica `nombre` para localizar el QR. Si la celda está rellena, plantilla con QR; si está vacía, plantilla sin QR. Si la celda apunta a un fichero que **no existe** en `qr/`, el script debe avisar (warning visible / error) en vez de degradar silenciosamente a sin-qr.

> *Nota de cambio:* una versión anterior de este documento decidía derivar el nombre del QR slugificando `nombre`. Se revirtió porque convención implícita basada en filenames es propensa a desincronizaciones silenciosas (PNG renombrado, nombre con tilde inesperada, espacios raros) que dejarían empleados sin QR sin que nadie lo notase. Dato explícito en el Sheet > convención.

> *Nota de cambio (2026-05-21):* se reordenan las columnas (`marca` y `tipo firma` primero, `direccion`/`maps_url` al final). Se capitalizan los valores de `marca` (`Autoescuela`/`Formacion` en vez de minúsculas). Se añade columna `tipo firma` solo como metadato de gestión interna (Personal/Local/Servicios), sin efecto sobre la selección de plantilla. `dirección` pasa a `direccion` (sin tilde en la cabecera) para evitar fragilidad de encoding.

## Reglas de selección de plantilla

Se mantiene el matriz original 2×2 (marca × qr presente o no). `tipo firma` **no entra** en la decisión. Match de `marca` insensible a mayúsculas/minúsculas (`Formacion` y `formacion` valen igual).

- `marca = Formacion` + columna `qr` rellena → `plantillas/formacion-con-qr.html`
- `marca = Formacion` + columna `qr` vacía → `plantillas/formacion-sin-qr.html`
- `marca = Autoescuela` + columna `qr` rellena → `plantillas/autoescuela-con-qr.html`
- `marca = Autoescuela` + columna `qr` vacía → `plantillas/autoescuela-sin-qr.html`

## Placeholders a usar al normalizar las plantillas

`{{nombre}}`, `{{cargo}}`, `{{telefono}}`, `{{email}}`, `{{direccion}}`, `{{maps_url}}`, `{{qr_filename}}`

(`{{qr_filename}}` sólo aparece en las plantillas "con-qr". Se sustituye por el nombre del fichero PNG, ej. `qr-sara-casillas.png`. La URL completa la monta la plantilla con `https://grupo-gala.github.io/firmas_corporativas/qr/{{qr_filename}}`.)

## Cambios obligatorios al normalizar las plantillas originales

1. **QR siempre por empleado en ambas marcas.** En Formación el QR original era fijo (`qr-gala-formacion.png`); ese fichero no existe y el caso se elimina — todas las firmas usan QR personal o ninguno.
2. **Mailto = `{{email}}`**, no genérico. La plantilla original de Formación apuntaba a `info@galaformacion.com`; cambiar.
3. **Dirección y maps_url siempre desde el Sheet** (`{{direccion}}`, `{{maps_url}}`). La plantilla de Formación traía la dirección a fuego; cambiar.
4. **Logo Autoescuela:** usar `64px-logo-gala-autoescuela.png` (no la `.jpg`). PNG soporta transparencia y se ve mejor en clientes con fondos no-blancos.

## Funcionamiento del script `script/generar-firmas.js`

Resumen de cómo está implementado, para no tener que releerlo:

- **Sin dependencias externas.** Node.js puro. No requiere `npm install`. Funciona con cualquier Node moderno (probado con Node ≥ 18).
- **Carga `CSV_URL` de `.env`** (parser propio mínimo). Si falta y no se pasa `--csv-file`, error claro.
- **Descarga el CSV** siguiendo redirects (`https.get` + manejo de 3xx hasta 5 saltos). Si la respuesta empieza por `<` (HTML) lanza error explícito sugiriendo re-publicar el Sheet (`Archivo → Compartir → Publicar en la web → CSV`).
- **Parser CSV propio** (~30 líneas). Maneja campos entre comillas con comas dentro (necesario, las direcciones tienen comas) y comillas escapadas (`""`). Tolera CRLF y archivos sin newline final.
- **Numeración:** cada fila lleva `_sheetRow = i + 2` para alinearse con Google Sheets (fila 1 = cabecera).
- **Filtra filas sin `marca`** (no procesables) y avisa del recuento total vs procesable.
- **Selección de filas:**
  - `--only "2,4,43-44"` o `"todas"` desde el prompt interactivo. Acepta números sueltos, listas y rangos.
  - `--all` salta el prompt y procesa todas.
  - Sin flags → modo interactivo: lista numerada (marca, tipo, nombre, indicador QR) + `readline` pidiendo la selección.
- **Para cada fila procesada:**
  - Normaliza `qr` (si es URL completa, extrae filename y avisa).
  - Elige plantilla por `marca` + (qr presente o no). Match insensible a mayúsculas (`Autoescuela`/`autoescuela`).
  - Si `qr` apunta a un PNG que no existe en `qr/`, avisa (no aborta — genera la firma igual, el navegador mostrará imagen rota y el usuario sabrá por qué).
  - **Render condicional:** elimina las líneas que contengan placeholders con valor vacío. Luego una pasada extra elimina `<div>...</div>` que hayan quedado completamente vacíos. Después sustituye los placeholders restantes.
  - Genera `firmas_out/{slug-del-nombre}.html`. El slug solo se usa para nombrar el fichero de salida; no se usa para localizar el QR (que viene literal de la columna `qr`).
- **Resumen final:** cuenta de firmas generadas + lista de avisos.

## Lecciones aprendidas (mantener presente)

- **El Sheet se "despublica" silenciosamente.** Durante esta sesión la URL CSV pasó a devolver una página de `accounts.google.com/ServiceLogin` (HTML interstitial). El usuario tuvo que re-publicar el Sheet para restaurarla. El script detecta este caso (respuesta que empieza por `<`) y devuelve mensaje claro. No intentar parsear interstitials de Google con curl/cookies — no funciona sin un navegador real; lo correcto es decirle al usuario que re-publique.
- **El CSV puede no terminar en `\n`** (Google a veces sirve así). El parser maneja ese caso.
- **El usuario numera las filas como en Sheets** (fila 2 = primer empleado). Respetarlo en el prompt y los flags.

## Próximos pasos en orden

1. ~~**Normalizar las 4 plantillas**~~ ✅
2. ~~**Crear y publicar el Google Sheet**~~ ✅ (CSV en `.env`, columnas según el modelo).
3. ~~**Escribir `script/generar-firmas.js`**~~ ✅ (Node.js puro, modo interactivo + flags, render condicional, normalización de qr-URL, detección de Sheet despublicado).
4. ~~**Actualizar `README.md`** con instrucciones para IT/RRHH~~ ✅
5. **Validar render visual en clientes de correo reales** (Gmail web, Gmail iOS/Android, Outlook desktop, Outlook web). Pegar las 3 firmas generadas en borradores y revisar.
6. **Iterar plantillas según hallazgos del paso 5** (espaciados, tamaños, fallback de fuente, lo que aparezca).
7. **Generar el resto de firmas en bloque** (`node script/generar-firmas.js --all`) una vez validado.
8. **Limpieza opcional del Sheet** (no bloqueante): typos detectados durante la primera revisión (`parla.este@autoescuelagala.como`, `carabanchelalto@autoescuelgala.com`), `maps_url` con sufijos placeholder `WpsNuBcKSsrijVXM7..42` que parecen incrementales falsos, y empleados con QR generado en `qr/` cuya columna `qr` está vacía (`francisco-canete`, `jose-manuel-santiago`).

**Punto de retomada (próxima sesión, oficina):**
- 3 firmas de prueba ya generadas en `firmas_out/` (Beatriz Massagué, Chueca, Puente de Vallecas).
- Empezar pegando esos HTML en borradores de Gmail/Outlook para validar render real en cliente de correo.
- Una vez OK, ejecutar `node script/generar-firmas.js --all` para el resto del Sheet, o iterar plantillas si algo no encaja.

## Cosas a tener en cuenta al colaborar

- Hablar **siempre en castellano** con el usuario.
- Prefiere **conversación en texto plano**, evitar menús de opciones múltiples salvo decisiones genuinamente binarias.
- Maneja **dos marcas**: GALA Formación (galaformacion.com) y Autoescuela GALA (autoescuelagala.com).
- Org GitHub: `Grupo-Gala` (mayúsculas en URL), pero github.io es lowercase `grupo-gala`.
