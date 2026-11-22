import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Coffee, Clock3, Pause, Play, RotateCcw, Sparkles, Square } from 'lucide-react';
import type { Session, Task } from '../types';
import { fmtDate, localDate } from '../api';

type SaveSession = (session: { taskId: string | null; minutes: number; elapsedSeconds: number; completed: boolean; localDate: string }) => Promise<void>;
export function Timer({ tasks, sessions, onSave, initialMinutes }: { tasks: Task[]; sessions: Session[]; onSave: SaveSession; initialMinutes: number }) {
  const [minutes, setMinutes] = useState(initialMinutes);
  const [remaining, setRemaining] = useState(initialMinutes * 60);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<'focus' | 'break'>('focus');
  const [taskId, setTaskId] = useState<string>('');
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const deadline = useRef<number | null>(null);
  const savingRef = useRef(false);
  const stateRef = useRef({ phase, minutes, taskId });
  stateRef.current = { phase, minutes, taskId };

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      const end = deadline.current;
      if (end === null) return;
      const seconds = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds !== 0 || savingRef.current) return;
      setRunning(false); deadline.current = null;
      if (stateRef.current.phase === 'focus') {
        savingRef.current = true; setSaving(true);
        const m = stateRef.current.minutes; const t = stateRef.current.taskId || null;
        void onSave({ taskId: t, minutes: m, elapsedSeconds: m * 60, completed: true, localDate: localDate() })
          .then(() => { setBanner('¡Bien hecho! Cada minuto cuenta. Ahora disfruta un descanso.'); setPhase('break'); setRemaining(3 * 60); })
          .catch(() => { setBanner('No pudimos guardar la sesión. Puedes comenzar otra cuando quieras.'); setRemaining(m * 60); })
          .finally(() => { savingRef.current = false; setSaving(false); });
      } else { setPhase('focus'); setRemaining(stateRef.current.minutes * 60); setBanner('Descanso terminado. Puedes empezar otro bloque cuando quieras.'); }
    }, 250);
    return () => clearInterval(interval);
  }, [running, onSave]);

  function startPause() {
    setBanner('');
    if (running) { setRemaining(Math.max(0, Math.ceil(((deadline.current || Date.now()) - Date.now()) / 1000))); deadline.current = null; setRunning(false); }
    else { deadline.current = Date.now() + remaining * 1000; setRunning(true); }
  }
  async function stop() {
    if (saving) return;
    setRunning(false); deadline.current = null;
    const elapsed = minutes * 60 - remaining;
    if (phase === 'focus' && elapsed > 0) {
      setSaving(true);
      try { await onSave({ taskId: taskId || null, minutes, elapsedSeconds: Math.min(elapsed, minutes * 60), completed: false, localDate: localDate() }); setBanner('Sesión guardada. Una interrupción no borra tu esfuerzo. 💜'); }
      finally { setSaving(false); }
    } else setBanner('Puedes retomarlo cuando quieras.');
    setPhase('focus'); setRemaining(minutes * 60);
  }
  function changeMinutes(n: number) { if (running || saving) return; setMinutes(n); setRemaining(n * 60); setPhase('focus'); setBanner(''); }
  const total = phase === 'focus' ? minutes * 60 : 180;
  const progress = (total - remaining) / total;
  const todaySeconds = sessions.filter(s => s.localDate === localDate()).reduce((sum, s) => sum + s.elapsedSeconds, 0);
  return <div className="page-content">
    <div className="page-title-row"><div><div className="eyebrow">UN MOMENTO PARA TI</div><h1>Tiempo de enfoque <span className="title-accent">✳</span></h1><p>Tu tiempo, tus reglas. No hay prisa, solo progreso.</p></div></div>
    <div className="timer-layout"><section className="content-panel timer-main">
      <div className="timer-top"><div className="timer-phase"><span className={`phase-dot ${phase==='break'?'green-dot':''}`}/>{phase==='focus'?'ENFOQUE':'DESCANSO'}</div><span className="timer-hint"><Sparkles size={16}/> Aquí no hay penalizaciones</span></div>
      <h2>{phase==='focus'?'Un poquito de enfoque hace la diferencia':'Te mereces este descanso'}</h2><p className="timer-subtitle">{phase==='focus'?'Elige un tiempo cómodo para ti. Puedes parar cuando lo necesites.':'Respira, toma agua y vuelve solo si quieres.'}</p>
      <div className="time-options">{[5,10,15,25].map(n=><button className={minutes===n?'active':''} disabled={running||saving||phase==='break'} key={n} onClick={()=>changeMinutes(n)}>{n} min</button>)}</div>
      <div className="clock-wrap"><div className="clock-circle" style={{background:`conic-gradient(${phase==='break'?'#52b59c':'#7763d9'} ${progress*360}deg, #eae8f6 0deg)`}}><div className="clock-inner"><div className="clock-mini">{phase==='focus'?'TIEMPO RESTANTE':'TU DESCANSO'}</div><div className="clock-digits">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</div><span className="clock-message">{running?'Lo estás haciendo genial ✨':'A tu propio ritmo ♡'}</span></div></div></div>
      <div className="timer-task-picker"><label htmlFor="session-task">¿En qué vas a trabajar? <span className="muted">(opcional)</span></label><select id="session-task" disabled={running||phase==='break'} value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">Estudio libre, sin tarea específica</option>{tasks.filter(t=>!t.done).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
      <div className="timer-controls"><button className="primary-btn timer-play" disabled={saving} onClick={startPause}>{running?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}{running?'Pausar sesión':remaining<total?'Continuar':'¡Comenzar!'}</button><button className="outline-btn" disabled={saving} onClick={()=>void stop()}><Square size={16}/> Terminar</button><button className="icon-btn" disabled={running||saving} title="Reiniciar temporizador" aria-label="Reiniciar temporizador" onClick={()=>{setPhase('focus');setRemaining(minutes*60);setBanner('');}}><RotateCcw size={18}/></button></div>
      {banner && <div className="timer-feedback"><CheckCircle2 size={18}/>{banner}</div>}
    </section>
    <aside className="timer-side"><div className="content-panel gentle-note"><div className="gentle-icon"><Coffee size={24}/></div><h3>Tu descanso también importa.</h3><p>El temporizador tiene un descanso de 3 minutos después de cada bloque. Interrumpir una sesión nunca te quita puntos.</p><div className="note-decoration">✳ ✧ ✳</div></div>
    <div className="content-panel today-stats"><div className="panel-mini-title"><Clock3 size={17}/> Hoy has avanzado</div><div className="today-stat-num">{Math.floor(todaySeconds/60)} <span>minutos</span></div><p>Tiempo registrado hoy</p><div className="light-divider"/><div className="panel-mini-title">Sesiones recientes</div>{sessions.slice(0,5).length ? <div className="session-list">{sessions.slice(0,5).map(s=><div key={s.id} className="session-row"><span className="session-dot"/><span>{fmtDate(s.localDate)} · {Math.floor(s.elapsedSeconds/60)} min</span><span className={`session-status ${s.completed?'':'interrupted'}`}>{s.completed?'Completa':'Parcial'}</span></div>)}</div> : <p className="muted">Tus primeras sesiones aparecerán aquí.</p>}</div>
    <div className="soft-side-banner"><span>🌱</span><strong>Empezar también es avanzar.</strong><ArrowRight size={18}/></div></aside></div>
  </div>;
}
