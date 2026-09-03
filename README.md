# Guía Comandos

Apuntes que armé para clase: CMD, PowerShell, un poco de Bash y sobre todo Git.

La idea empezó como una hoja de comandos para no estar buscando siempre lo mismo. Después le fui sumando cosas: botón para copiar, un gráfico que se actualiza al scrollear, y un simulador para practicar sin romper ningún proyecto real.

## Qué hay adentro

- **CMD / PowerShell / Bash** — comandos que usamos en clase, con explicación corta
- **Git y GitHub** — referencia + una guía visual de commits y ramas
- **Errores comunes** — los que más aparecen cuando alguien se traba
- **Flujos de clase** — subir un TP, clonar el repo del profe, pelearse con un conflicto
- **Simulador** — terminal inventada: carpetas, commits, ramas, merge, reset, revert

Sitio: https://ovejero92.github.io/GuiaComandos/

## Cómo abrirlo

Si solo querés mirarlo, andá al link de arriba.

Si querés tocarlo en tu PC:

```bash
git clone https://github.com/ovejero92/GuiaComandos.git
cd GuiaComandos
```

Abrí `index.html` en el navegador (con Live Server o haciendo doble click).

No necesita npm ni build. Es HTML, CSS y JS a mano.

## Carpetas

```
GuiaComandos/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── icons.js
│   ├── index.js
│   ├── features.js
│   └── simulator.js
├── assets/
│   └── icon.svg
├── manifest.webmanifest
└── sw.js
```

## Notas

- El simulador **no** toca tu disco. Todo vive en el navegador.
- Si algo se rompe en el simulador, hay botón de reiniciar.
- En el celu se puede agregar a la pantalla de inicio y se usa casi como una app.
- Si la guía te sirve, hay un cafecito en el menú (Ko-fi).

## Contacto

Si ves un error o querés que agregue un comando, mandame mail desde la sección Recursos de la página o abrí un issue acá.

---

Hecho para mis estudiantes (y para quien le sirva).
