# CronoMatriz — Priorizador Eisenhower con Bloqueo de Tiempo

> **Enlaces del proyecto**

**Link:** ` `

**Repositorio en GitHub:** ` `

> 📝 **Nota:** este proyecto tiene los **mismos archivos** que el repositorio de GitLab
> (`index.html`, `styles.css`, `app.js`, `README.md`). Solo cambia la plataforma de alojamiento.

---

## Descripción del Proyecto

**CronoMatriz** es una aplicación web de productividad personal construida íntegramente con **HTML5, CSS3 y JavaScript ES6+ Vanilla**, sin dependencias ni librerías externas. Integra en un solo panel tres metodologías de gestión del tiempo:

1. **Matriz de Eisenhower (2x2):** Clasificación visual de tareas según urgencia e importancia con soporte nativo de *HTML5 Drag & Drop* y operaciones CRUD completas.
2. **Agenda Diaria de Bloqueo de Tiempo (Time-Blocking):** Planificación por franjas horarias de **08:00 a 21:00** (jornada base de 13 horas) con detección automática de traslapes y alertas de sobrecarga (>100%).
3. **Temporizador Pomodoro Integrado:** Reloj de enfoque y descansos basado en marcas de tiempo reales (`Date.now()`) para evitar desfases cuando la pestaña pierde el foco, acompañado de síntesis sonora mediante **Web Audio API** y visualización en `<canvas>`.

---

## Fundamentos Metodológicos

### Matriz de Eisenhower
Permite combatir la "trampa de la mera urgencia" dividiendo el trabajo en cuatro cuadrantes:
* **Q1 — Urgente e Importante (Hacer Ahora):** Crisis, entregas inminentes e incidentes críticos.
* **Q2 — No Urgente e Importante (Planificar):** Trabajo profundo, arquitectura, aprendizaje y estrategia a largo plazo.
* **Q3 — Urgente y No Importante (Delegar):** Interrupciones, correos rutinarios y coordinaciones operativas.
* **Q4 — Ni Urgente ni Importante (Eliminar):** Distracciones y tareas de bajo impacto.

### Bloqueo Horario (Time-Blocking)
En lugar de trabajar desde una lista interminable sin noción de capacidad, cada tarea con duración estimada (`15`, `30`, `45`, `60`, `90` o `120` minutos) se asigna a un bloque específico entre las **08:00 y las 21:00**. El motor calcula en tiempo real las horas ocupadas, las horas disponibles sobre la base de **13.0 horas** y resalta en rojo cualquier colisión entre horarios.

---

## Instrucciones de Ejecución

1. Descarga o guarda los 4 archivos (`index.html`, `styles.css`, `app.js`, `README.md`) dentro de una misma carpeta local.
2. Haz doble clic sobre **`index.html`** para abrirlo en cualquier navegador web moderno (Chrome, Firefox, Edge, Safari).
3. No requiere servidor backend, compilación ni conexión a internet. Toda la información se persiste automáticamente en `localStorage`.

---

## Pruebas Verificables (Día Demo)

Al hacer clic en el botón **"✨ Cargar Día Demo (10 tareas)"**, la aplicación carga un conjunto determinista de 10 tareas que permite verificar matemáticamente los cálculos del motor y del gráfico `<canvas>`:

### 1. Desglose exacto por Cuadrante (10 tareas totales)
* **Q1 (Urgente e Importante):** `90m + 60m + 30m` = **180 minutos (3.0 horas)** — *32% del total*
* **Q2 (No Urgente e Importante):** `120m + 60m + 45m` = **225 minutos (3.8 horas / 3.75h)** — *40% del total*
* **Q3 (Urgente y No Importante):** `45m + 30m` = **75 minutos (1.3 horas / 1.25h)** — *13% del total*
* **Q4 (Ni Urgente ni Importante):** `30m + 15m` = **45 minutos (0.8 horas / 0.75h)** — *8% del total*
* **Total general inventariado:** **525 minutos (8.8 horas / 8.75h)** en el centro del gráfico de dona.

### 2. Métricas de la Agenda Horaria (08:00 – 21:00)
De las 10 tareas del Día Demo, **8 tareas tienen hora asignada** y **2 tareas quedan sin agendar** (`Planificar objetivos técnicos` de 45m y `Revisar feeds` de 15m):
* **Horas Planificadas:** `90 + 60 + 30 + 120 + 60 + 45 + 30 + 30` = `465 minutos` = **7.75 h**
* **Horas Libres (sobre 13.0h base):** `13.00 - 7.75` = **5.25 h**
* **Porcentaje de Ocupación:** `7.75 / 13.00` = **60% ocupado**
* **Estado de Conflictos:** **0 traslapes** (bloque libre intencional de 14:00 a 15:00 para comida). Arrastrar cualquier tarea sin agendar hacia las `12:00` o `15:00` disparará inmediatamente la alerta visual de traslape.
