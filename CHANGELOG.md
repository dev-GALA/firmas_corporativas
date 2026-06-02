# Changelog

Todos los cambios relevantes de este proyecto se documentan en este fichero.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Las fechas usan el formato `AAAA-MM-DD`.

## [No publicado] — 2026-06-02

Repunto del repositorio a la organización `dev-GALA`, filtros de generación por
columna y primera producción de firmas por tandas.

### Añadido
- Filtros de tanda por valor de columna en `script/generar-firmas.js`:
  `--marca` (Autoescuela / Formacion) y `--tipo` (Personal / Local / Servicios).
  Combinables entre sí y con `--only` (AND); match insensible a mayúsculas; si
  un valor no existe en el CSV, avisa y no genera (sin degradar en silencio).
- El modo interactivo acepta también filtros de columna en el prompt
  (`marca:autoescuela`, `tipo:personal`), mezclables con números de fila.
- `buildOutName`: desambiguación del nombre de fichero por la parte local del
  email cuando dos filas comparten el mismo `nombre` (centros `Local` con varios
  buzones), con `Set` de control para garantizar unicidad absoluta.
- Documentación de las columnas `fecha_generacion` y `firma_generada` (metadatos
  internos del Sheet que el script ignora) en `README.md` y `CLAUDE.md`.
- Lecciones aprendidas sobre el caché del CSV publicado y los ficheros huérfanos
  al renombrar, en `CLAUDE.md` y `README.md` (Troubleshooting).
- Este `CHANGELOG.md`.

### Cambiado
- **Repositorio movido del perfil personal `grupo-gala` a la organización
  `dev-GALA`.** Actualizado el dominio de GitHub Pages de `grupo-gala.github.io`
  a `dev-gala.github.io` en las 4 plantillas (34 enlaces: logos, iconos, QR) y en
  la documentación. Actualizada la URL del repo y la org en `CLAUDE.md`.
- `CSV_URL` del Sheet publicado guardada en `.env` (no versionado).

### Corregido
- `renderTemplate`: la sustitución de placeholders usaba el valor como cadena de
  reemplazo de `String.replace`, de modo que un `$` en `direccion`/`maps_url`
  activaba los patrones especiales (`$&`, `$1`…). Ahora se sustituye con una
  función `() => v`, conservando los `$` literales.
- Colisión de nombres de fichero: las firmas de centros `Local` con el mismo
  nombre y distinto buzón se sobrescribían entre sí (en la primera tanda real,
  137 generadas pero solo 127 ficheros). Resuelto con `buildOutName`.

### Producción (operación, no código)
- Primera generación por tandas en `firmas_out/` (no versionado):
  62 Personal + 73 Local + 4 Servicios = **139 firmas**.
- Informes de filas incompletas: `_personal-incompletas.csv` (2 filas) y
  `_local-incompletas.csv` (41 filas; 40 sin `maps_url`, 1 sin `telefono`).
- Pendiente: completar datos en el Sheet de las filas incompletas y validar el
  render real en Gmail/Outlook (requiere Pages publicado en `dev-GALA`).

## [Base inicial] — 2026-05-21

Estado de partida del proyecto antes de la actividad documentada arriba.

### Añadido
- Generador `script/generar-firmas.js` (Node.js puro, sin dependencias npm):
  descarga del CSV con redirects, parser CSV propio, render condicional de campos
  vacíos, normalización de `qr` con URL completa, detección de Sheet despublicado,
  modo interactivo y flags `--only` / `--all` / `--csv-file`.
- 4 plantillas HTML normalizadas (`autoescuela`/`formacion` × `con-qr`/`sin-qr`)
  con estructura compacta y placeholders `{{...}}`.
- Assets: logos, iconos de redes (50px) y 16 QRs pre-generados, servidos por
  GitHub Pages.
- `README.md` con instrucciones para IT/RRHH, `CLAUDE.md` con el contexto del
  proyecto, `.env.example` y `.gitignore`.
