import { ArrowRight, CalendarCheck2, Check, ChevronRight, Clock3, Flame, Plus, Sparkles, Star, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import type { Bootstrap, Page } from '../types';
import { fmtDate, localDate } from '../api';
import { TaskCard } from '../components/TaskCard';

export function Home({ data, go, onNewTask, onName, onToggleStep, onToggleTask }: {
  data: Bootstrap; go: (p: Page) => void; onNewTask: () => void; onName: (name: string) => Promise<void>;
  onToggleStep: (id: string) => void; onToggleTask: (id: string, done: boolean) => void;
}) {
  const [editing, setEditing] = useState(false); const [name, setName] = useState(data.name);
  const activeTasks = data.tasks.filter(t => !t.done);
  const next = activeTasks[0];
  const today = new Date();
  const completed = data.stats.totalTasks ? Math.round(data.stats.tasksCompleted / data.stats.totalTasks * 100) : 0;
  const max = Math.max(15, ...data.stats.weekly.map(d => d.minutes));
  const recommended = data.methods.find(m => m.id === 'pomodoro')!;
  return <div className="page-content home-page">
    <div className="welcome-line"><span>MI ESPACIO DE ESTUDIO</span><span className="today"><CalendarCheck2 size={15}/>{today.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}</span></div>
    <section className="welcome-banner">
      <div className="hero-decoration hero-decoration-one"/><div className="hero-decoration hero-decoration-two"/>
      <div className="welcome-text">
        <div className="hero-pill"><Sparkles size={14}/> Hoy cuenta, a tu ritmo</div>
        <h1>¡Hola{data.name ? `, ${data.name}` : ''}! <span className="wave">✦</span></h1>
        <p className="hero-question">¿Qué pequeño paso puedes dar hoy?</p>
        <p className="hero-support">No necesitas hacerlo todo. Solo empezar por algo pequeño.</p>
        <div className="hero-buttons">
          <button className="primary-btn white-btn" onClick={() => go('tiempo')}><Clock3 size={17}/> Empezar a estudiar <ArrowRight size={16}/></button>
          <button className="outline-btn hero-secondary" onClick={() => go('tiempo')}>Sesión rápida de 5 min</button><button className="hero-help" onClick={() => go('metodos')}>No sé por dónde empezar <ArrowRight size={14}/></button>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="art-sun">✳</div><div className="art-card art-card-back"><span>✦</span><i/><i/><i/></div><div className="art-card art-card-front"><div className="art-pink-dot">✓</div><i/><i/><div className="art-mini-note">un paso a la vez <span>♥</span></div></div><div className="art-sparkle a">✧</div><div className="art-sparkle b">✦</div></div>
    </section>
    {!data.name && <div className="name-prompt"><span>¿Cómo quieres que te llamemos? <span className="muted">(opcional)</span></span>{editing ? <form onSubmit={async e => { e.preventDefault(); await onName(name); setEditing(false); }} className="inline-name"><input value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Tu nombre" autoFocus /><button className="small-solid" type="submit">Guardar</button><button type="button" className="text-button" onClick={() => setEditing(false)}>Cancelar</button></form> : <button className="link-btn" onClick={() => setEditing(true)}>Agregar mi nombre <ArrowRight size={14}/></button>}</div>}
    <div className="section-title-row home-section-title"><div><h2>Tu avance de esta semana</h2><p>Todo progreso, por pequeño que sea, merece contarse.</p></div><span className="muted tiny">Últimos 7 días</span></div>
    <div className="metric-grid">
      <div className="metric-card"><div className="metric-icon lavender"><Clock3 size={20}/></div><div><div className="metric-value">{data.stats.minutes}<span> min</span></div><p>Tiempo de estudio</p></div></div>
      <div className="metric-card"><div className="metric-icon mint"><Check size={20}/></div><div><div className="metric-value">{data.stats.stepsCompleted}<span> pasos</span></div><p>Pequeñas victorias</p></div></div>
      <div className="metric-card"><div className="metric-icon peach"><Star size={20}/></div><div><div className="metric-value">{data.stats.points}<span> pts</span></div><p>Puntos esta semana</p></div></div>
      <div className="metric-card"><div className="metric-icon yellow"><Flame size={20}/></div><div><div className="metric-value">{completed}<span>%</span></div><p>Tareas completadas</p></div></div>
    </div>
    <div className="home-bottom-grid">
      <section className="content-panel chart-panel"><div className="section-title-row"><div><h2>Tu ritmo es único <span className="small-heart">♡</span></h2><p>Minutos dedicados en los últimos siete días</p></div></div><div className="bar-chart">
        {data.stats.weekly.map(day => <div className="bar-item" key={day.date}><span className="bar-tooltip">{day.minutes} min</span><div className="bar-column"><div className={`bar-bar ${day.date === localDate() ? 'bar-current' : ''}`} style={{height:`${Math.max(4,day.minutes/max*100)}%`}}/></div><span className="bar-label">{fmtDate(day.date,{weekday:'short'}).replace('.','')}</span></div>)}
      </div><div className="chart-footnote"><span className="chart-dot"/> Cada minuto cuenta</div></section>
      <section className="content-panel next-panel"><div className="section-title-row"><div><h2>Tu próximo pequeño paso</h2><p>Una cosa a la vez está bien.</p></div><button className="icon-btn" title="Ver todas" aria-label="Ver todas las tareas" onClick={() => go('tareas')}><ArrowRight size={19}/></button></div>
        {next ? <><div className="next-task-label">TU PRIORIDAD AHORA</div><TaskCard task={next} compact onToggleStep={onToggleStep} onToggleTask={onToggleTask}/><button className="link-btn block-link" onClick={() => go('tareas')}>Ver mis tareas <ChevronRight size={17}/></button></> : <div className="empty-illustrated"><div className="empty-emoji">🌱</div><h3>Todo comienza con un paso</h3><p>Crea una tarea y la dividiremos en partes pequeñas.</p><button className="small-solid" onClick={onNewTask}><Plus size={15}/> Agregar tarea</button></div>}
      </section>
    </div>
    <div className="home-bottom-grid secondary-grid"><section className="recommend-card"><div className="recommend-icon"><WandSparkles size={24}/></div><div><div className="eyebrow">IDEA PARA HOY</div><h3>¿No sabes por dónde empezar?</h3><p>Prueba una sesión de 5 minutos. Dar el primer paso ya es avanzar.</p><button className="link-btn" onClick={() => go('tiempo')}>Lo voy a intentar <ArrowRight size={15}/></button></div></section><section className="recommend-card method-recommend"><div className="recommend-icon green"><Sparkles size={24}/></div><div><div className="eyebrow">MÉTODO RECOMENDADO</div><h3>{recommended.title}</h3><p>{recommended.tagline}</p><button className="link-btn" onClick={() => go('metodos')}>Conocer el método <ArrowRight size={15}/></button></div></section></div>
    {activeTasks.length > 1 && <div className="extra-tasks"><div className="section-title-row"><h2>Otras tareas pendientes</h2><button className="link-btn" onClick={() => go('tareas')}>Ver todas <ArrowRight size={15}/></button></div><div className="small-task-row">{activeTasks.slice(1,4).map(t => <button key={t.id} className="small-task-pill" onClick={() => go('tareas')}><span className="small-task-spot"/>{t.title}<ChevronRight size={16}/></button>)}</div></div>}
  </div>;
}
