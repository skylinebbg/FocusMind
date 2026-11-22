import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSmallSteps, isoLocalDays, studyMethods } from '../src/study.ts';
import { createStore } from '../src/db.ts';

test('hay ocho métodos, cada uno con instrucciones y ejemplo', () => {
  assert.equal(studyMethods.length, 8);
  studyMethods.forEach(m => { assert.ok(m.instructions.length > 0); assert.ok(m.example); });
});
test('descompone cada tarea en pasos de dos a cinco minutos', () => {
  for (const kind of ['study', 'exam', 'delivery'] as const) {
    const steps = generateSmallSteps('Estudiar química', kind);
    assert.ok(steps.length >= 2);
    assert.ok(steps.every(s => s.minutes >= 2 && s.minutes <= 5));
  }
});
test('genera correctamente la semana, incluso en cambio de mes', () => {
  assert.deepEqual(isoLocalDays('2026-11-02').slice(0, 2), ['2026-10-27', '2026-10-28']);
});
test('tareas, pasos y progreso se guardan y actualizan en SQLite', () => {
  const store = createStore(':memory:');
  try {
    const task = store.createTask({ title: 'Preparar examen', kind: 'exam', priority: 3, dueDate: '2026-11-20' });
    assert.equal(store.tasks().length, 1);
    task.steps.forEach(step => store.toggleStep(step.id, '2026-11-18'));
    assert.equal(store.getTask(task.id)?.done, true);
    const old = store.getTask(task.id)?.steps[0];
    assert.ok(old);
    store.toggleStep(old!.id, '2026-11-18');
    assert.equal(store.getTask(task.id)?.done, false);
    store.addSession({ taskId: task.id, minutes: 5, elapsedSeconds: 300, completed: true, localDate: '2026-11-18' });
    assert.equal(store.stats('2026-11-18').minutes, 5);
    assert.equal(store.deleteTask(task.id), true);
    assert.equal(store.tasks().length, 0);
    assert.equal(store.sessions()[0].taskId, null);
  } finally { store.close(); }
});
