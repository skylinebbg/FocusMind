import { Check, CalendarDays, Trash2, Clock3, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Task } from '../types';
import { fmtDate } from '../api';
import { kindColors, typeLabels } from './Icons';

type Props = { task: Task; onToggleStep: (id: string) => void; onToggleTask: (id: string, done: boolean) => void; onDelete?: (id: string) => void; compact?: boolean };
export function TaskCard({ task, onToggleStep, onToggleTask, onDelete, compact = false }: Props) {
  const [expanded, setExpanded] = useState(!compact);
  const done = task.steps.filter(s => s.done).length;
  const ratio = Math.round(done / Math.max(1, task.steps.length) * 100);
  return <article className={`task-card ${task.done ? 'task-complete' : ''}`}>
    <div className="task-main">
      <button className={`check-round ${task.done ? 'checked' : ''}`} aria-label={task.done ? 'Reabrir tarea' : 'Completar tarea'} title={task.done ? 'Reabrir' : 'Marcar completa'} onClick={() => onToggleTask(task.id, !task.done)}>{task.done && <Check size={14} strokeWidth={3} />}</button>
      <div className="task-info">
        <div className="task-eyebrow"><span className={`mini-tag ${kindColors[task.kind]}`}>{typeLabels[task.kind]}</span>{task.priority === 3 && <span className="mini-tag orange">Prioritaria</span>}</div>
        <h3>{task.title}</h3>
        <div className="task-meta"><span><Check size={13} /> {done}/{task.steps.length} pasos</span>{task.dueDate && <span><CalendarDays size={13} /> {fmtDate(task.dueDate)}</span>}{!task.done && <span><Clock3 size={13} /> {task.steps.filter(s => !s.done).reduce((n, s) => n + s.minutes, 0)} min aprox.</span>}</div>
      </div>
      <div className="task-actions">
        <button className="icon-btn" aria-label={expanded ? 'Ocultar pasos' : 'Ver pasos'} onClick={() => setExpanded(v => !v)}>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
        {onDelete && <button className="icon-btn danger-hover" aria-label="Eliminar tarea" title="Eliminar tarea" onClick={() => { if (window.confirm(`¿Eliminar "${task.title}"?`)) onDelete(task.id); }}><Trash2 size={17} /></button>}
      </div>
    </div>
    <div className="progress-track"><div className="progress-fill" style={{ width: `${ratio}%` }} /></div>
    {expanded && <div className="steps-list">{task.steps.map(s => <label className={`step-row ${s.done ? 'step-done' : ''}`} key={s.id}>
      <input type="checkbox" checked={s.done} onChange={() => onToggleStep(s.id)} /><span className="step-checkbox">{s.done && <Check size={12} strokeWidth={3} />}</span><span className="step-text">{s.title}</span><span className="step-min">{s.minutes} min</span>
    </label>)}</div>}
  </article>;
}
