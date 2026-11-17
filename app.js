/**
 * CronoMatriz — Aplicación Vanilla JS ES6+
 * Arquitectura modular:
 * 1. TaskStore: Persistencia en localStorage, CRUD y datos Demo.
 * 2. ScheduleEngine: Cálculos de agenda (08:00-21:00), métricas de 13h, detección de traslapes y exportación CSV/JSON.
 * 3. PomodoroTimer: Temporizador preciso basado en Date.now() con alertas sonoras Web Audio API.
 * 4. UIAndChartRenderer: Renderizado del DOM, HTML5 Drag & Drop y gráfico de dona en <canvas>.
 */

const STORAGE_KEY = 'cronomatriz_tasks_v1';
const POMODORO_COUNT_KEY = 'cronomatriz_pomodoros_v1';

const QUADRANT_META = {
  Q1: { label: 'Q1: Urgente e Importante', short: 'Q1 Hacer', color: '#ef4444' },
  Q2: { label: 'Q2: No Urgente e Importante', short: 'Q2 Planificar', color: '#10b981' },
  Q3: { label: 'Q3: Urgente y No Importante', short: 'Q3 Delegar', color: '#f59e0b' },
  Q4: { label: 'Q4: Ni Urgente ni Importante', short: 'Q4 Eliminar', color: '#6366f1' },
};

/* ==========================================================================
   1. TASK STORE (Gestión de estado y persistencia en localStorage)
   ========================================================================== */
class TaskStore {
  constructor() {
    this.tasks = this.loadFromStorage();
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.saveToStorage();
    this.listeners.forEach((fn) => fn(this.tasks));
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Error leyendo localStorage:', err);
      return [];
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    } catch (err) {
      console.error('Error guardando en localStorage:', err);
    }
  }

  getAll() {
    return [...this.tasks];
  }

  getById(id) {
    return this.tasks.find((t) => t.id === id) || null;
  }

  addTask({ title, quadrant, duration, startTime = '' }) {
    const newTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      quadrant,
      duration: Number(duration),
      startTime: startTime || '',
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.tasks.push(newTask);
    this.notify();
    return newTask;
  }

  updateTask(id, updates) {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    this.tasks[index] = {
      ...this.tasks[index],
      ...updates,
      duration: updates.duration !== undefined ? Number(updates.duration) : this.tasks[index].duration,
    };
    this.notify();
    return this.tasks[index];
  }

  toggleComplete(id) {
    const task = this.getById(id);
    if (!task) return;
    this.updateTask(id, { completed: !task.completed });
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.notify();
  }

  clearAll() {
    this.tasks = [];
    this.notify();
  }

  loadDemoDay() {
    // Conjunto determinista de 10 tareas para pruebas verificables
    const demoTasks = [
      { title: 'Resolver incidente crítico en producción', quadrant: 'Q1', duration: 90, startTime: '08:00', completed: false },
      { title: 'Preparar presentación trimestral de resultados', quadrant: 'Q1', duration: 60, startTime: '10:00', completed: false },
      { title: 'Revisar aprobación de presupuesto urgente', quadrant: 'Q1', duration: 30, startTime: '11:00', completed: true },
      { title: 'Diseñar arquitectura del módulo de pagos', quadrant: 'Q2', duration: 120, startTime: '12:00', completed: false },
      { title: 'Estudiar patrones avanzados de rendimiento web', quadrant: 'Q2', duration: 60, startTime: '15:00', completed: false },
      { title: 'Planificar objetivos técnicos del próximo mes', quadrant: 'Q2', duration: 45, startTime: '', completed: false },
      { title: 'Responder correos administrativos y soporte', quadrant: 'Q3', duration: 45, startTime: '16:00', completed: false },
      { title: 'Coordinar logística de sala para reunión', quadrant: 'Q3', duration: 30, startTime: '17:00', completed: false },
      { title: 'Ordenar carpetas antiguas de descargas', quadrant: 'Q4', duration: 30, startTime: '18:00', completed: false },
      { title: 'Revisar feeds de noticias tecnológicas', quadrant: 'Q4', duration: 15, startTime: '', completed: false },
    ];

    this.tasks = demoTasks.map((item, idx) => ({
      id: `demo_task_${idx + 1}`,
      ...item,
      createdAt: new Date().toISOString(),
    }));
    this.notify();
  }
}

/* ==========================================================================
   2. SCHEDULE ENGINE (Motor de bloqueo horario, conflictos y exportación)
   ========================================================================== */
class ScheduleEngine {
  static START_HOUR = 8; // 08:00
  static END_HOUR = 21; // 21:00 (última franja empieza a las 20:00 o termina a las 21:00)
  static BASE_WORKDAY_HOURS = 13; // 21 - 8 = 13 horas

  static getHourSlots() {
    const slots = [];
    for (let h = this.START_HOUR; h < this.END_HOUR; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
    }
    return slots;
  }

  static timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  static minutesToTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  static formatEndTime(startTime, durationMin) {
    const startMin = this.timeToMinutes(startTime);
    if (startMin === null) return '';
    return this.minutesToTime(startMin + durationMin);
  }

  static analyze(tasks) {
    const quadrantMinutes = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    tasks.forEach((t) => {
      if (quadrantMinutes[t.quadrant] !== undefined) {
        quadrantMinutes[t.quadrant] += t.duration;
      }
    });

    const scheduledTasks = tasks
      .filter((t) => Boolean(t.startTime))
      .map((t) => {
        const startMin = this.timeToMinutes(t.startTime);
        const endMin = startMin + t.duration;
        return { ...t, startMin, endMin };
      })
      .sort((a, b) => a.startMin - b.startMin);

    const plannedMinutes = scheduledTasks.reduce((acc, t) => acc + t.duration, 0);
    const plannedHours = plannedMinutes / 60;
    const freeHours = Math.max(0, this.BASE_WORKDAY_HOURS - plannedHours);
    const occupancyPercent = Math.round((plannedHours / this.BASE_WORKDAY_HOURS) * 100);
    const isOverloaded = plannedHours > this.BASE_WORKDAY_HOURS;

    // Detectar traslapes entre tareas agendadas y desbordamiento más allá de las 21:00
    const conflicts = [];
    const conflictingTaskIds = new Set();
    const dayEndMin = this.END_HOUR * 60;

    for (let i = 0; i < scheduledTasks.length; i++) {
      const current = scheduledTasks[i];
      if (current.endMin > dayEndMin) {
        conflictingTaskIds.add(current.id);
        conflicts.push(
          `"${current.title}" excede el límite de las 21:00 (termina a las ${this.minutesToTime(current.endMin)}).`
        );
      }

      for (let j = i + 1; j < scheduledTasks.length; j++) {
        const next = scheduledTasks[j];
        if (current.startMin < next.endMin && current.endMin > next.startMin) {
          conflictingTaskIds.add(current.id);
          conflictingTaskIds.add(next.id);
          conflicts.push(
            `Traslape detectado entre "${current.title}" (${current.startTime}–${this.minutesToTime(current.endMin)}) y "${next.title}" (${next.startTime}–${this.minutesToTime(next.endMin)}).`
          );
        }
      }
    }

    return {
      quadrantMinutes,
      scheduledTasks,
      plannedMinutes,
      plannedHours,
      freeHours,
      occupancyPercent,
      isOverloaded,
      conflicts,
      conflictingTaskIds,
    };
  }

  static exportCSV(tasks) {
    const headers = ['ID', 'Titulo', 'Cuadrante', 'Duracion_Min', 'Hora_Inicio', 'Hora_Fin', 'Completada'];
    const rows = tasks.map((t) => {
      const endTime = t.startTime ? this.formatEndTime(t.startTime, t.duration) : '';
      return [
        t.id,
        `"${t.title.replace(/"/g, '""')}"`,
        t.quadrant,
        t.duration,
        t.startTime || 'Sin agendar',
        endTime || '-',
        t.completed ? 'Si' : 'No',
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    this.triggerDownload(csvContent, 'cronomatriz_agenda.csv', 'text/csv;charset=utf-8;');
  }

  static exportJSON(tasks) {
    const analysis = this.analyze(tasks);
    const payload = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalTasks: tasks.length,
        plannedHours: Number(analysis.plannedHours.toFixed(2)),
        freeHours: Number(analysis.freeHours.toFixed(2)),
        quadrantMinutes: analysis.quadrantMinutes,
      },
      tasks,
    };
    const jsonContent = JSON.stringify(payload, null, 2);
    this.triggerDownload(jsonContent, 'cronomatriz_respaldo.json', 'application/json');
  }

  static triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/* ==========================================================================
   3. POMODORO TIMER (Precisión por timestamps + Web Audio API)
   ========================================================================== */
class PomodoroTimer {
  static MODES = {
    focus: { label: 'Enfoque', seconds: 25 * 60 },
    short: { label: 'Descanso Corto', seconds: 5 * 60 },
    long: { label: 'Descanso Largo', seconds: 15 * 60 },
  };

  constructor({ onTick, onComplete, onStateChange }) {
    this.mode = 'focus';
    this.remainingSeconds = PomodoroTimer.MODES.focus.seconds;
    this.endTimestamp = null;
    this.intervalId = null;
    this.isRunning = false;
    this.completedPomodoros = Number(localStorage.getItem(POMODORO_COUNT_KEY) || 0);

    this.onTick = onTick;
    this.onComplete = onComplete;
    this.onStateChange = onStateChange;
  }

  setMode(modeKey) {
    if (!PomodoroTimer.MODES[modeKey]) return;
    this.pause();
    this.mode = modeKey;
    this.remainingSeconds = PomodoroTimer.MODES[modeKey].seconds;
    this.onTick(this.formatTime(this.remainingSeconds));
    this.onStateChange({ isRunning: false, status: `Modo ${PomodoroTimer.MODES[modeKey].label} listo` });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.endTimestamp = Date.now() + this.remainingSeconds * 1000;

    this.onStateChange({ isRunning: true, status: `${PomodoroTimer.MODES[this.mode].label} en curso...` });

    this.intervalId = setInterval(() => {
      const diffMs = this.endTimestamp - Date.now();
      const nextRemaining = Math.max(0, Math.ceil(diffMs / 1000));

      if (nextRemaining !== this.remainingSeconds) {
        this.remainingSeconds = nextRemaining;
        this.onTick(this.formatTime(this.remainingSeconds));
      }

      if (this.remainingSeconds <= 0) {
        this.handleFinish();
      }
    }, 250);
  }

  pause() {
    if (!this.isRunning) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    this.endTimestamp = null;
    this.onStateChange({ isRunning: false, status: 'Temporizador en pausa' });
  }

  reset() {
    this.pause();
    this.remainingSeconds = PomodoroTimer.MODES[this.mode].seconds;
    this.onTick(this.formatTime(this.remainingSeconds));
    this.onStateChange({ isRunning: false, status: 'Listo para comenzar' });
  }

  handleFinish() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    this.endTimestamp = null;

    this.playSoftChime();

    if (this.mode === 'focus') {
      this.completedPomodoros += 1;
      localStorage.setItem(POMODORO_COUNT_KEY, String(this.completedPomodoros));
    }

    this.remainingSeconds = PomodoroTimer.MODES[this.mode].seconds;
    this.onTick(this.formatTime(this.remainingSeconds));
    this.onComplete(this.completedPomodoros, this.mode);
    this.onStateChange({ isRunning: false, status: '¡Sesión completada!' });
  }

  formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  playSoftChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99]; // Acorde C5 - E5 - G5

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.16);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + idx * 0.16 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.16 + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.16);
        osc.stop(ctx.currentTime + idx * 0.16 + 0.7);
      });
    } catch (e) {
      console.warn('Web Audio API no disponible:', e);
    }
  }
}

/* ==========================================================================
   4. UI AND CHART RENDERER (DOM, Drag & Drop, y gráfico <canvas>)
   ========================================================================== */
class UIAndChartRenderer {
  constructor(store, timer) {
    this.store = store;
    this.timer = timer;
    this.draggedTaskId = null;

    this.cacheDOM();
    this.populateTimeOptions();
    this.bindEvents();
  }

  cacheDOM() {
    // Formulario
    this.form = document.getElementById('task-form');
    this.formHeading = document.getElementById('form-heading');
    this.inputId = document.getElementById('task-id');
    this.inputTitle = document.getElementById('task-title');
    this.inputQuadrant = document.getElementById('task-quadrant');
    this.inputDuration = document.getElementById('task-duration');
    this.inputTime = document.getElementById('task-time');
    this.btnSubmit = document.getElementById('btn-submit-task');
    this.btnCancelEdit = document.getElementById('btn-cancel-edit');

    // Acciones globales
    this.btnDemo = document.getElementById('btn-demo');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnExportJson = document.getElementById('btn-export-json');
    this.btnClearAll = document.getElementById('btn-clear-all');

    // Agenda
    this.timelineContainer = document.getElementById('timeline-slots');
    this.metricPlanned = document.getElementById('metric-planned');
    this.metricFree = document.getElementById('metric-free');
    this.metricCount = document.getElementById('metric-count');
    this.capacityBadge = document.getElementById('capacity-badge');
    this.alertsContainer = document.getElementById('schedule-alerts');

    // Pomodoro
    this.focusSelect = document.getElementById('focus-task-select');
    this.timerDisplay = document.getElementById('timer-display');
    this.timerStatus = document.getElementById('timer-status');
    this.pomodoroCountEl = document.getElementById('pomodoro-count');
    this.btnStart = document.getElementById('btn-timer-start');
    this.btnPause = document.getElementById('btn-timer-pause');
    this.btnReset = document.getElementById('btn-timer-reset');
    this.modeButtons = document.querySelectorAll('.mode-btn');

    // Canvas
    this.canvas = document.getElementById('balance-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.chartLegend = document.getElementById('chart-legend');
  }

  populateTimeOptions() {
    const slots = ScheduleEngine.getHourSlots();
    slots.forEach((slot) => {
      const opt = document.createElement('option');
      opt.value = slot;
      opt.textContent = slot;
      this.inputTime.appendChild(opt);
    });
  }

  bindEvents() {
    // CRUD Formulario
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = this.inputId.value;
      const payload = {
        title: this.inputTitle.value,
        quadrant: this.inputQuadrant.value,
        duration: Number(this.inputDuration.value),
        startTime: this.inputTime.value,
      };

      if (!payload.title.trim()) return;

      if (id) {
        this.store.updateTask(id, payload);
        this.resetFormMode();
      } else {
        this.store.addTask(payload);
        this.form.reset();
        this.inputDuration.value = '30';
      }
    });

    this.btnCancelEdit.addEventListener('click', () => this.resetFormMode());

    // Botones Header
    this.btnDemo.addEventListener('click', () => {
      this.resetFormMode();
      this.store.loadDemoDay();
    });

    this.btnExportCsv.addEventListener('click', () => {
      ScheduleEngine.exportCSV(this.store.getAll());
    });

    this.btnExportJson.addEventListener('click', () => {
      ScheduleEngine.exportJSON(this.store.getAll());
    });

    this.btnClearAll.addEventListener('click', () => {
      if (this.store.getAll().length === 0) return;
      if (confirm('¿Deseas eliminar todas las tareas actuales?')) {
        this.resetFormMode();
        this.store.clearAll();
      }
    });

    // Drag & Drop en Cuadrantes
    document.querySelectorAll('.quadrant').forEach((quadEl) => {
      quadEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        quadEl.classList.add('drag-over');
      });

      quadEl.addEventListener('dragleave', () => {
        quadEl.classList.remove('drag-over');
      });

      quadEl.addEventListener('drop', (e) => {
        e.preventDefault();
        quadEl.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain') || this.draggedTaskId;
        const targetQuadrant = quadEl.dataset.quadrant;
        if (taskId && targetQuadrant) {
          this.store.updateTask(taskId, { quadrant: targetQuadrant });
        }
      });
    });

    // Controles Pomodoro
    this.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.modeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.timer.setMode(btn.dataset.mode);
      });
    });

    this.btnStart.addEventListener('click', () => this.timer.start());
    this.btnPause.addEventListener('click', () => this.timer.pause());
    this.btnReset.addEventListener('click', () => this.timer.reset());

    this.pomodoroCountEl.textContent = `🍅 ${this.timer.completedPomodoros}`;
  }

  startEditTask(task) {
    this.inputId.value = task.id;
    this.inputTitle.value = task.title;
    this.inputQuadrant.value = task.quadrant;
    this.inputDuration.value = String(task.duration);
    this.inputTime.value = task.startTime || '';

    this.formHeading.textContent = 'Editar Tarea';
    this.btnSubmit.textContent = 'Guardar Cambios';
    this.btnCancelEdit.classList.remove('hidden');
    this.inputTitle.focus();
  }

  resetFormMode() {
    this.form.reset();
    this.inputId.value = '';
    this.inputDuration.value = '30';
    this.formHeading.textContent = 'Nueva Tarea';
    this.btnSubmit.textContent = '+ Agregar Tarea';
    this.btnCancelEdit.classList.add('hidden');
  }

  renderAll(tasks) {
    const analysis = ScheduleEngine.analyze(tasks);
    this.renderMatrix(tasks, analysis.quadrantMinutes);
    this.renderTimeline(tasks, analysis);
    this.renderFocusSelector(tasks);
    this.renderChart(analysis.quadrantMinutes);
  }

  renderMatrix(tasks, quadrantMinutes) {
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((qKey) => {
      const container = document.getElementById(`list-${qKey}`);
      const totalBadge = document.getElementById(`total-${qKey}`);
      const mins = quadrantMinutes[qKey];
      totalBadge.textContent = mins >= 60 ? `${(mins / 60).toFixed(1)}h (${mins}m)` : `${mins} min`;

      container.innerHTML = '';
      const qTasks = tasks.filter((t) => t.quadrant === qKey);

      if (qTasks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-placeholder';
        empty.textContent = 'Sin tareas. Arrastra o crea una arriba.';
        container.appendChild(empty);
        return;
      }

      qTasks.forEach((task) => {
        container.appendChild(this.createTaskCard(task));
      });
    });
  }

  createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'completed' : ''}`;
    card.draggable = true;
    card.dataset.id = task.id;
    card.dataset.q = task.quadrant;

    card.addEventListener('dragstart', (e) => {
      this.draggedTaskId = task.id;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', task.id);
    });

    card.addEventListener('dragend', () => {
      this.draggedTaskId = null;
      card.classList.remove('dragging');
    });

    // Top row: checkbox + título
    const top = document.createElement('div');
    top.className = 'task-top';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.title = 'Marcar como completada';
    checkbox.addEventListener('change', () => this.store.toggleComplete(task.id));

    const titleEl = document.createElement('span');
    titleEl.className = 'task-title-text';
    titleEl.textContent = task.title;

    top.append(checkbox, titleEl);

    // Meta row: duración + selector rápido de hora + botones editar/borrar
    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const tags = document.createElement('div');
    tags.className = 'task-tags';

    const durBadge = document.createElement('span');
    durBadge.className = 'tag-duration';
    durBadge.textContent = `${task.duration}m`;

    const quickSelect = document.createElement('select');
    quickSelect.className = 'quick-time-select';
    quickSelect.title = 'Asignar hora rápida';

    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '🕒 Sin hora';
    quickSelect.appendChild(noneOpt);

    ScheduleEngine.getHourSlots().forEach((slot) => {
      const opt = document.createElement('option');
      opt.value = slot;
      opt.textContent = `🕒 ${slot}`;
      if (task.startTime === slot) opt.selected = true;
      quickSelect.appendChild(opt);
    });

    quickSelect.addEventListener('change', (e) => {
      this.store.updateTask(task.id, { startTime: e.target.value });
    });

    tags.append(durBadge, quickSelect);

    const actions = document.createElement('div');
    actions.className = 'task-card-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn';
    editBtn.title = 'Editar tarea';
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => this.startEditTask(task));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-btn';
    delBtn.title = 'Eliminar tarea';
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', () => this.store.deleteTask(task.id));

    actions.append(editBtn, delBtn);
    meta.append(tags, actions);

    card.append(top, meta);
    return card;
  }

  renderTimeline(tasks, analysis) {
    // Actualizar métricas
    this.metricPlanned.textContent = `${analysis.plannedHours.toFixed(2)} h`;
    this.metricFree.textContent = `${analysis.freeHours.toFixed(2)} h`;
    this.metricCount.textContent = String(tasks.length);

    this.capacityBadge.textContent = `${analysis.occupancyPercent}% ocupado`;
    this.capacityBadge.classList.toggle('overload', analysis.isOverloaded);

    // Alertas de sobrecarga y traslapes
    this.alertsContainer.innerHTML = '';
    if (analysis.isOverloaded) {
      const overloadDiv = document.createElement('div');
      overloadDiv.className = 'alert-banner alert-overload';
      overloadDiv.textContent = `⚠️ Sobrecarga horaria: Has planificado ${analysis.plannedHours.toFixed(2)}h de una jornada base de 13.0h (${analysis.occupancyPercent}%).`;
      this.alertsContainer.appendChild(overloadDiv);
    }

    analysis.conflicts.forEach((msg) => {
      const conflictDiv = document.createElement('div');
      conflictDiv.className = 'alert-banner alert-overlap';
      conflictDiv.textContent = `⚡ ${msg}`;
      this.alertsContainer.appendChild(conflictDiv);
    });

    // Renderizar franjas horarias (08:00 a 20:00 -> cubre hasta 21:00)
    this.timelineContainer.innerHTML = '';
    const slots = ScheduleEngine.getHourSlots();

    slots.forEach((slot) => {
      const row = document.createElement('div');
      row.className = 'time-slot';

      const label = document.createElement('div');
      label.className = 'time-label';
      label.textContent = slot;

      const dropzone = document.createElement('div');
      dropzone.className = 'slot-dropzone';
      dropzone.dataset.slot = slot;

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain') || this.draggedTaskId;
        if (taskId) {
          this.store.updateTask(taskId, { startTime: slot });
        }
      });

      const tasksInSlot = analysis.scheduledTasks.filter((t) => t.startTime === slot);
      if (tasksInSlot.length > 0) {
        dropzone.classList.add('has-tasks');
      }

      tasksInSlot.forEach((task) => {
        if (analysis.conflictingTaskIds.has(task.id)) {
          dropzone.classList.add('has-conflict');
        }

        const block = document.createElement('div');
        block.className = `scheduled-block ${task.quadrant.toLowerCase()} ${task.completed ? 'completed-block' : ''}`;
        block.draggable = true;

        block.addEventListener('dragstart', (e) => {
          this.draggedTaskId = task.id;
          e.dataTransfer.setData('text/plain', task.id);
        });

        const info = document.createElement('div');
        info.className = 'block-info';

        const title = document.createElement('span');
        title.textContent = `[${task.quadrant}] ${task.title}`;

        const range = document.createElement('span');
        range.className = 'block-range';
        const endStr = ScheduleEngine.formatEndTime(task.startTime, task.duration);
        range.textContent = `${task.startTime} – ${endStr} (${task.duration} min)`;

        info.append(title, range);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-unschedule';
        removeBtn.title = 'Quitar de la agenda';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', () => {
          this.store.updateTask(task.id, { startTime: '' });
        });

        block.append(info, removeBtn);
        dropzone.appendChild(block);
      });

      row.append(label, dropzone);
      this.timelineContainer.appendChild(row);
    });
  }

  renderFocusSelector(tasks) {
    const previousSelection = this.focusSelect.value;
    this.focusSelect.innerHTML = '<option value="">-- Ninguna tarea seleccionada --</option>';

    tasks.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.completed ? '✓ ' : ''}[${t.quadrant}] ${t.title} (${t.duration}m)`;
      this.focusSelect.appendChild(opt);
    });

    if (tasks.some((t) => t.id === previousSelection)) {
      this.focusSelect.value = previousSelection;
    }
  }

  renderChart(quadrantMinutes) {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) * 0.4;
    const innerRadius = outerRadius * 0.56;

    ctx.clearRect(0, 0, width, height);

    const keys = ['Q1', 'Q2', 'Q3', 'Q4'];
    const totalMinutes = keys.reduce((acc, k) => acc + quadrantMinutes[k], 0);

    // Actualizar leyenda HTML
    this.chartLegend.innerHTML = '';
    keys.forEach((k) => {
      const mins = quadrantMinutes[k];
      const pct = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0;
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-dot" style="background:${QUADRANT_META[k].color}"></span>
        <span><strong>${k}:</strong> ${mins}m (${pct}%)</span>
      `;
      this.chartLegend.appendChild(item);
    });

    if (totalMinutes === 0) {
      // Aro vacío de estado inicial
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sin datos aún', centerX, centerY);
      return;
    }

    let startAngle = -Math.PI / 2;

    keys.forEach((k) => {
      const value = quadrantMinutes[k];
      if (value <= 0) return;

      const sliceAngle = (value / totalMinutes) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = QUADRANT_META[k].color;
      ctx.fill();

      // Separador blanco sutil
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      startAngle = endAngle;
    });

    // Texto central en la dona
    const totalHours = (totalMinutes / 60).toFixed(1);
    ctx.fillStyle = '#1e293b';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${totalHours} h`, centerX, centerY - 8);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillText(`${totalMinutes} min total`, centerX, centerY + 11);
  }
}

/* ==========================================================================
   INICIALIZACIÓN DE LA APLICACIÓN
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const store = new TaskStore();

  const timer = new PomodoroTimer({
    onTick: (formatted) => {
      document.getElementById('timer-display').textContent = formatted;
    },
    onComplete: (count) => {
      document.getElementById('pomodoro-count').textContent = `🍅 ${count}`;
    },
    onStateChange: ({ isRunning, status }) => {
      document.getElementById('btn-timer-start').disabled = isRunning;
      document.getElementById('btn-timer-pause').disabled = !isRunning;
      document.getElementById('timer-status').textContent = status;
    },
  });

  const ui = new UIAndChartRenderer(store, timer);
  store.subscribe((tasks) => ui.renderAll(tasks));

  // Render inicial con los datos guardados en localStorage
  ui.renderAll(store.getAll());
});
