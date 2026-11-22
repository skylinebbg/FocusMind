import { useState, type FormEvent } from 'react';
import { X, Sparkles } from 'lucide-react';
import type { TaskKind } from '../types';
import { localDate } from '../api';

type TaskDraft = { title: string; kind: TaskKind; priority: number; dueDate: string | null };
export function NewTaskModal({ onClose, onSave, defaultKind = 'study' }: { onClose: () => void; onSave: (task: TaskDraft) => Promise<void>; defaultKind?: TaskKind }) {
  const [title, setTitle] = useState(''); const [kind, setKind] = useState<TaskKind>(defaultKind);
  const [priority, setPriority] = useState(2); const [dueDate, setDueDate] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); if (title.trim().length < 3 || saving) return;
    setSaving(true);
    try { setError(''); await onSave({ title: title.trim(), kind, priority, dueDate: dueDate || null }); onClose(); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-task-heading">
      <div className="modal-header"><div><div className="eyebrow">UN PASO A LA VEZ</div><h2 id="new-task-heading">Nueva tarea</h2></div><button className="icon-btn" aria-label="Cerrar" onClick={onClose}><X size={21}/></button></div>
      <p className="muted">Solo escribe qué necesitas hacer. Nosotros lo convertimos en pasos pequeños.</p>
      <form onSubmit={submit} className="form-stack">
        <label className="field-label" htmlFor="task-title">¿Qué quieres lograr?</label>
        <input autoFocus id="task-title" maxLength={180} required minLength={3} placeholder="Ej. Preparar el examen de matemáticas" value={title} onChange={e => setTitle(e.target.value)} />
        <label className="field-label" htmlFor="kind">Tipo de tarea</label>
        <select id="kind" value={kind} onChange={e => setKind(e.target.value as TaskKind)}><option value="study">Estudiar o practicar</option><option value="exam">Preparar examen</option><option value="delivery">Trabajo o entrega</option></select>
        <div className="two-fields"><div><label className="field-label" htmlFor="date">Fecha límite (opcional)</label><input id="date" type="date" min={localDate()} value={dueDate} onChange={e => setDueDate(e.target.value)} /></div><div><label className="field-label" htmlFor="priority">Prioridad</label><select id="priority" value={priority} onChange={e => setPriority(Number(e.target.value))}><option value={1}>Baja</option><option value={2}>Normal</option><option value={3}>Alta</option></select></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}<div className="helper-note"><Sparkles size={16} /> Generaremos pasos cortos de 2 a 5 minutos automáticamente.</div>
        <button className="primary-btn full" type="submit" disabled={saving || title.trim().length < 3}>{saving ? 'Creando...' : 'Crear mis pequeños pasos'}</button>
      </form>
    </div>
  </div>;
}
