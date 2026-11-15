# GymLog 🏋️

App web instalable (PWA) para el iPhone que sirve para:

- **Ciclos**: la constancia se mide por ciclos (una vuelta a tu rotación de sesiones en un máximo de 7 días, empiece cuando empiece), con racha de ciclos completos, «te toca» la siguiente sesión y avisos de descanso (3 días seguidos, Pierna sin descanso).
- **Sesiones**: crea sesiones (Torso, Pierna…) con ejercicios, series, repeticiones, peso, descanso y notas.
- **Entrenar**: registra cada serie (kg y repeticiones). Muestra lo que hiciste la última vez, tiene un temporizador de descanso y un cronómetro de la sesión. Si la app se cierra a mitad de entreno, no se pierde nada.
- **Progreso**: gráficas de evolución por ejercicio (1RM estimado, peso máximo, reps máximas o volumen), volumen y series por ciclo (últimos 12) y tabla de récords personales.
- **Historial**: entrenos agrupados por ciclo, que puedes editar o borrar. También puedes registrar un entreno pasado cambiando la fecha.
- **Informe del ciclo**: al cerrar cada ciclo genera un `.md` con constancia, carga, entrenos, progresión por ejercicio, tabla de evolución de los últimos 8 ciclos, tus sesiones planificadas y tus comentarios, listo para subirlo a tu proyecto de entrenador en Claude (ver [PROMPT_ENTRENADOR.md](PROMPT_ENTRENADOR.md)).
- **Copia de seguridad**: exporta e importa todos los datos en un `.json`.

Todo funciona sin conexión y los datos se quedan **solo en tu iPhone**: no hay servidor ni cuentas.

## Cómo tenerla en el iPhone

1. Publícala con GitHub Pages: en GitHub, *Settings → Pages → Source: **GitHub Actions***. El flujo `.github/workflows/pages.yml` la publica en cada push.
   La dirección será `https://<tu-usuario>.github.io/<repositorio>/`.
2. Abre esa dirección en **Safari** del iPhone.
3. Pulsa **Compartir → Añadir a pantalla de inicio**.
4. Ábrela desde el icono: se verá a pantalla completa, como una app.

> GitHub Pages es gratis en repositorios públicos. Si el repositorio es privado y no tienes GitHub Pro, puedes hacerlo público (tus datos no están en el repositorio, solo el código) o arrastrar la carpeta a [Netlify Drop](https://app.netlify.com/drop).

## Flujo con el entrenador (cada ciclo)

1. Cuando se cierre un ciclo (la app te avisa en Actividad), abre **Informe**, escribe tus comentarios (molestias, sueño, objetivos) y pulsa **Compartir / Guardar → Guardar en Archivos**.
2. Sube ese `.md` a tu proyecto «Entrenador personal» en Claude.
3. Copia el bloque de sesiones que pone al final de su respuesta y pégalo en **Sesiones → Importar del entrenador**. Las sesiones con el mismo nombre se actualizan (conservan su historial) y las nuevas se añaden.

## Probar en el ordenador

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Si cambias archivos, sube `VERSION` en `sw.js` para que el iPhone descargue la versión nueva.
