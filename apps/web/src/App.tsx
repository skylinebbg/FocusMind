import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarCheck2, ChevronRight, CircleHelp, Clock3, Heart, Home as HomeIcon, Layers3, Menu, Plus, Sparkles, X } from 'lucide-react';
import { getAIStatus, getBootstrap, json, request, localDate } from './api';
import type { AIStatus, Bootstrap, Page, TaskKind } from './types';
import { Home } from './views/Home';
import { Tasks } from './views/Tasks';
import { Timer } from './views/Timer';
import { Methods } from './views/Methods';
import { Focus } from './views/Focus';
import { NewTaskModal } from './components/NewTaskModal';

const nav = [
  { key: 'inicio', text: 'Inicio', Icon: HomeIcon },
  { key: 'tareas', text: 'Mis tareas', Icon: CalendarCheck2 },
  { key: 'tiempo', text: 'Tiempo de enfoque', Icon: Clock3 },
  { key: 'metodos', text: 'Métodos de estudio', Icon: BookOpen },
  { key: 'focus', text: 'Focus IA', Icon: Sparkles }
] as const;

export default function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [page, setPage] = useState<Page>('inicio');
  const [modal, setModal] = useState<TaskKind | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [ai, setAI] = useState<AIStatus | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [timerInitial, setTimerInitial] = useState(5);

  const reload = useCallback(async () => { setData(await getBootstrap()); }, []);
  useEffect(() => { reload().catch(e => setError((e as Error).message)); void getAIStatus().then(setAI).catch(() => {}); }, [reload]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(''), 4000); return () => clearTimeout(t); }, [toast]);
  const mutation = useCallback(async <T,>(method: 'POST'|'PATCH'|'DELETE', path: string, body?: unknown): Promise<T> => {
    try { const result = await request<T>(path, json(method, body)); await reload(); return result; }
    catch (e) { setToast((e as Error).message); throw e; }
  }, [reload]);
  const safe = (action: Promise<unknown>) => { void action.catch(() => {}); };
  function go(next: Page) { setPage(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  const toggleStep = (id: string) => safe(mutation('POST', `/steps/${id}/toggle`, {localDate: localDate()}));
  const toggleTask = (id: string, done: boolean) => safe(mutation('PATCH', `/tasks/${id}`, { done, completedDate: localDate() }));
  const deleteTask = (id: string) => safe(mutation('DELETE', `/tasks/${id}`).then(() => setToast('Tarea eliminada')));
  const saveSession = useCallback(async (s: { taskId: string|null; minutes: number; elapsedSeconds: number; completed: boolean; localDate: string }) => {
    await mutation('POST', '/sessions', s);
  }, [mutation]);

  if (error) return <div className="fatal-screen"><div className="fatal-icon"><CircleHelp size={35}/></div><h1>No pudimos abrir Paso a Paso</h1><p>{error}</p><p>Verifica que el backend esté activo en el puerto 3001 y recarga esta página.</p><button className="primary-btn" onClick={() => window.location.reload()}>Reintentar <ChevronRight size={17}/></button></div>;
  if (!data) return <div className="loading-screen"><div className="brand-mark large"><Sparkles size={30}/></div><h2>Preparando tu espacio...</h2><p>Un paso a la vez ♡</p></div>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="sidebar-logo"><div className="brand-mark"><Sparkles size={25} strokeWidth={2.1}/></div><div><strong>paso a paso<span>.</span></strong><small>tu espacio para avanzar</small></div><button className="icon-btn mobile-close" aria-label="Cerrar menú" onClick={()=>setMobileMenu(false)}><X size={20}/></button></div>
      <div className="sidebar-menu-label">TU ESPACIO</div>
      <nav className="sidebar-nav" aria-label="Navegación principal">{nav.map(({key,text,Icon})=><button key={key} onClick={()=>go(key)} aria-current={page===key?'page':undefined} className={`nav-item ${page===key?'nav-active':''}`}><Icon size={20} strokeWidth={page===key?2.4:1.9}/><span>{text}</span>{page===key&&<span className="active-mark"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-icon"><Heart size={20}/></div><strong>Un día a la vez.</strong><p>No tienes que ser perfecto para seguir avanzando.</p><span>✳ · ✧ · ✳</span></div><div className="sidebar-footer">Hecho para aprender con calma <Heart size={13} fill="currentColor"/></div></div>
    </aside>
    {mobileMenu && <button className="sidebar-shade" aria-label="Cerrar menú" onClick={()=>setMobileMenu(false)}/>}
    <div className="main-shell"><header className="topbar"><div className="topbar-leading"><button className="icon-btn hamburger" aria-label="Abrir menú" onClick={()=>setMobileMenu(true)}><Menu size={22}/></button><span>Tu lugar para dar el siguiente paso <span>✦</span></span></div><div className="topbar-actions"><span className="topbar-greeting">Hazlo a tu ritmo <span>♡</span></span><div className="user-avatar">{data.name ? data.name[0].toUpperCase() : '✳'}</div></div></header>
      <main>
        {page==='inicio'&&<Home data={data} go={go} onNewTask={()=>setModal('study')} onName={name=>mutation('PATCH','/profile',{name}).then(()=>{})} onToggleStep={toggleStep} onToggleTask={toggleTask}/>}
        {page==='tareas'&&<Tasks tasks={data.tasks} onNewTask={()=>setModal('study')} onToggleStep={toggleStep} onToggleTask={toggleTask} onDelete={deleteTask}/>}
        {page==='tiempo'&&<Timer tasks={data.tasks} sessions={data.sessions} onSave={saveSession} initialMinutes={timerInitial}/>}
        {page==='metodos'&&<Methods methods={data.methods} go={go}/>}
        {page==='focus'&&<Focus messages={data.messages} flashcards={data.flashcards} status={ai} onRetry={async()=>{setAI(await getAIStatus());}} onSend={message=>mutation('POST','/chat',{message}).then(()=>{})} onClear={()=>mutation('DELETE','/chat').then(()=>{})} onGenerate={notes=>mutation('POST','/flashcards/generate',{notes}).then(()=>{})} onReview={(id,reviewed)=>mutation('PATCH',`/flashcards/${id}`,{reviewed}).then(()=>{})} onDelete={id=>mutation('DELETE',`/flashcards/${id}`).then(()=>{})}/>}
      </main><footer className="main-footer">Paso a Paso © 2026 <span>·</span> Los avances pequeños también son avances <Heart size={13}/></footer>
    </div>
    {modal && <NewTaskModal defaultKind={modal} onClose={()=>setModal(null)} onSave={async draft=>{ await mutation('POST','/tasks',draft); setToast('¡Tu tarea ya tiene pequeños pasos!'); }}/>} 
    {toast&&<div role="status" className="toast"><Sparkles size={17}/>{toast}<button aria-label="Cerrar notificación" onClick={()=>setToast('')}><X size={15}/></button></div>}
  </div>;
}
