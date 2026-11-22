import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Plus, Search } from 'lucide-react';
import type { Task } from '../types';
import { fmtDate, localDate } from '../api';
import { TaskCard } from '../components/TaskCard';

export function Tasks({ tasks, onNewTask, onToggleTask, onToggleStep, onDelete }: {
  tasks: Task[]; onNewTask: () => void; onToggleTask: (id: string, done: boolean) => void;
  onToggleStep: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [search, setSearch] = useState('');
  const [monthOffset, setMonthOffset] = useState(0);
  const filtered = tasks.filter(t => (filter === 'all' || (filter === 'done' ? t.done : !t.done)) && t.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const upcoming = tasks.filter(t => t.dueDate && !t.done).sort((a,b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0,6);
  const month = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1), [monthOffset]);
  const first = (month.getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dates = Array.from({ length: first + total }, (_, i) => i < first ? null : i - first + 1);
  const dueSet = new Set(tasks.map(t => t.dueDate).filter(Boolean));
  return <div className="page-content">
    <div className="page-title-row"><div><div className="eyebrow">ORGANIZA TU CAMINO</div><h1>Mis tareas <span className="title-accent">✳</span></h1><p>Las cosas grandes se hacen con pequeños pasos.</p></div><button className="primary-btn" onClick={onNewTask}><Plus size={18}/> Nueva tarea</button></div>
    <div className="task-layout"><section className="task-main-column">
      <div className="content-panel task-list-panel"><div className="task-toolbar"><div className="tab-switch" role="group" aria-label="Filtrar tareas">{([['pending','Pendientes'],['all','Todas'],['done','Completadas']] as const).map(([value,label]) => <button key={value} className={filter===value?'active':''} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="searchbox"><Search size={17}/><input aria-label="Buscar tareas" placeholder="Buscar tarea..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
      <div className="task-count">{filtered.length} {filtered.length===1?'tarea':'tareas'} {filter==='pending'?'por hacer':filter==='done'?'completadas':''}</div>
      <div className="task-card-list">{filtered.map(t => <TaskCard key={t.id} task={t} onToggleStep={onToggleStep} onToggleTask={onToggleTask} onDelete={onDelete}/>)}</div>
      {!filtered.length && <div className="empty-illustrated tall"><div className="empty-emoji">{filter==='done'?'✨':'📝'}</div><h3>{search ? 'No encontramos coincidencias' : filter==='done'?'Tus logros aparecerán aquí':'Un espacio para comenzar'}</h3><p>{search?'Intenta con otra palabra.':filter==='done'?'Completa tus primeros pasos y celebra tu avance.':'Crea una tarea y la dividiremos en pasos fáciles de empezar.'}</p>{!search && filter!=='done' && <button className="small-solid" onClick={onNewTask}><Plus size={16}/> Crear tarea</button>}</div>}
      </div>
    </section><aside className="task-side-column">
      <div className="content-panel calendar-panel"><div className="panel-mini-title"><CalendarDays size={18}/> Mi calendario</div><div className="calendar-head"><button className="icon-btn" aria-label="Mes anterior" onClick={()=>setMonthOffset(n=>n-1)}><ChevronLeft size={18}/></button><strong>{month.toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</strong><button className="icon-btn" aria-label="Mes siguiente" onClick={()=>setMonthOffset(n=>n+1)}><ChevronRight size={18}/></button></div><div className="calendar-grid">{['L','M','X','J','V','S','D'].map(d=><span className="calendar-day-name" key={d}>{d}</span>)}{dates.map((d,i)=>{ const iso=d?localDate(new Date(month.getFullYear(),month.getMonth(),d)):null; return <span key={i} className={`calendar-day ${iso===localDate()?'today-calendar':''} ${iso&&dueSet.has(iso)?'has-event':''}`}>{d??''}</span> })}</div><div className="calendar-legend"><span/> Exámenes y entregas programados</div></div>
      <div className="content-panel due-panel"><div className="panel-mini-title"><ClipboardCheck size={18}/> Próximas fechas</div>{upcoming.length? <div className="due-list">{upcoming.map(t => <div className="due-item" key={t.id}><div className="due-date"><strong>{fmtDate(t.dueDate!,{day:'numeric'})}</strong><small>{fmtDate(t.dueDate!,{month:'short'})}</small></div><div><strong>{t.title}</strong><small>{t.kind === 'exam' ? 'Examen' : t.kind === 'delivery' ? 'Entrega' : 'Tarea'}</small></div></div>)}</div> : <p className="muted empty-due">Aún no tienes fechas pendientes. Puedes agregar una al crear una tarea.</p>}</div>
    </aside></div>
  </div>;
}
