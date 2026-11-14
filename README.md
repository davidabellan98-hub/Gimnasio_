# GymLog 🏋️

App web instalable (PWA) para el iPhone que sirve para:

- **Constancia**: objetivo de días por semana, racha de semanas cumplidas, mapa de las últimas 16 semanas y gráfico de días por semana.
- **Rutinas**: crea rutinas con ejercicios, series, repeticiones, peso, descanso y notas.
- **Entrenar**: registra cada serie (kg y repeticiones). Muestra lo que hiciste la última vez, tiene un temporizador de descanso y un cronómetro de la sesión. Si la app se cierra a mitad de entreno, no se pierde nada.
- **Progreso**: gráficas de evolución por ejercicio (1RM estimado, peso máximo, reps máximas o volumen), volumen y series por semana (últimas 12) y tabla de récords personales.
- **Historial**: entrenos agrupados por semana, que puedes editar o borrar. También puedes registrar un entreno pasado cambiando la fecha.
- **Informe semanal**: genera un `.md` con constancia, carga, sesiones, progresión por ejercicio, tabla de evolución de las últimas 8 semanas, tus rutinas y tus comentarios, listo para subirlo a tu proyecto de entrenador en Claude (ver [PROMPT_ENTRENADOR.md](PROMPT_ENTRENADOR.md)).
- **Copia de seguridad**: exporta e importa todos los datos en un `.json`.

Todo funciona sin conexión y los datos se quedan **solo en tu iPhone**: no hay servidor ni cuentas.

## Cómo tenerla en el iPhone

1. Publícala con GitHub Pages: en GitHub, *Settings → Pages → Source: **GitHub Actions***. El flujo `.github/workflows/pages.yml` la publica en cada push.
   La dirección será `https://<tu-usuario>.github.io/<repositorio>/`.
2. Abre esa dirección en **Safari** del iPhone.
3. Pulsa **Compartir → Añadir a pantalla de inicio**.
4. Ábrela desde el icono: se verá a pantalla completa, como una app.

> GitHub Pages es gratis en repositorios públicos. Si el repositorio es privado y no tienes GitHub Pro, puedes hacerlo público (tus datos no están en el repositorio, solo el código) o arrastrar la carpeta a [Netlify Drop](https://app.netlify.com/drop).

## Flujo semanal con el entrenador

1. El domingo, abre **Informe**, escribe tus comentarios (molestias, sueño, objetivos) y pulsa **Compartir / Guardar → Guardar en Archivos**.
2. Sube ese `.md` a tu proyecto «Entrenador personal» en Claude.
3. Aplica los cambios que te proponga en **Rutinas**.

## Probar en el ordenador

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Si cambias archivos, sube `VERSION` en `sw.js` para que el iPhone descargue la versión nueva.
