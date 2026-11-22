import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { generateSmallSteps, isoLocalDays, studyMethods, type TaskKind } from './study.js';

export type Step = { id: string; taskId: string; title: string; minutes: number; done: boolean; position: number };
export type Task = { id: string; title: string; kind: TaskKind; priority: number; dueDate: string | null; done: boolean; createdAt: string; steps: Step[] };
export type Session = { id: string; minutes: number; elapsedSeconds: number; completed: boolean; localDate: string; taskId: string | null; createdAt: string };
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
export type Flashcard = { id: string; front: string; back: string; reviewed: boolean; createdAt: string };

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

export function createStore(path = process.env.DATABASE_PATH || './data/paso-a-paso.sqlite') {
  const location = path === ':memory:' ? path : resolve(path);
  if (location !== ':memory:') mkdirSync(dirname(location), { recursive: true });
  const db = new DatabaseSync(location);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK(id = 1), name TEXT NOT NULL DEFAULT '');
    INSERT OR IGNORE INTO profile(id, name) VALUES (1, '');
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'study',
      priority INTEGER NOT NULL DEFAULT 2, due_date TEXT, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL, minutes INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, completed_date TEXT, position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      minutes INTEGER NOT NULL, elapsed_seconds INTEGER NOT NULL,
      completed INTEGER NOT NULL, local_date TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY, front TEXT NOT NULL, back TEXT NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
  `);

  // Migración simple para bases creadas antes de registrar las fechas de los pasos.
  const columns = db.prepare("PRAGMA table_info(steps)").all() as Row[];
  if (!columns.some(c => c.name === 'completed_date')) db.exec("ALTER TABLE steps ADD COLUMN completed_date TEXT");

  const readTask = (r: Row): Task => ({
    id: String(r.id), title: String(r.title), kind: r.kind as TaskKind, priority: Number(r.priority),
    dueDate: r.due_date === null ? null : String(r.due_date), done: Boolean(r.done), createdAt: String(r.created_at),
    steps: (db.prepare('SELECT * FROM steps WHERE task_id = ? ORDER BY position').all(String(r.id)) as Row[]).map(s => ({
      id: String(s.id), taskId: String(s.task_id), title: String(s.title), minutes: Number(s.minutes),
      done: Boolean(s.done), position: Number(s.position)
    }))
  });
  const tasks = (): Task[] => (db.prepare('SELECT * FROM tasks ORDER BY done ASC, priority DESC, due_date IS NULL, due_date ASC, created_at DESC').all() as Row[]).map(readTask);
  const getTask = (id: string) => {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined;
    return row ? readTask(row) : null;
  };
  const stepCount = (taskId: string) => (db.prepare('SELECT COUNT(*) AS n FROM steps WHERE task_id = ? AND done = 0').get(taskId) as Row).n as number;
  const sessions = () => (db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 100').all() as Row[]).map(s => ({
    id: String(s.id), taskId: s.task_id === null ? null : String(s.task_id), minutes: Number(s.minutes),
    elapsedSeconds: Number(s.elapsed_seconds), completed: Boolean(s.completed), localDate: String(s.local_date), createdAt: String(s.created_at)
  })) satisfies Session[];
  const messages = () => (db.prepare('SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT 100').all() as Row[]).map(m => ({
    id: String(m.id), role: m.role as ChatMessage['role'], content: String(m.content), createdAt: String(m.created_at)
  })) satisfies ChatMessage[];
  const flashcards = () => (db.prepare('SELECT * FROM flashcards ORDER BY created_at DESC LIMIT 200').all() as Row[]).map(f => ({
    id: String(f.id), front: String(f.front), back: String(f.back), reviewed: Boolean(f.reviewed), createdAt: String(f.created_at)
  })) satisfies Flashcard[];
  const stats = (localDate: string) => {
    const days = isoLocalDays(localDate);
    const rows = db.prepare('SELECT local_date, SUM(elapsed_seconds) AS seconds, SUM(completed) AS complete_count FROM sessions WHERE local_date BETWEEN ? AND ? GROUP BY local_date').all(days[0], days[days.length-1]) as Row[];
    const summaries = new Map(rows.map(r => [String(r.local_date), { seconds: Number(r.seconds), completed: Number(r.complete_count) }]));
    const weekly = days.map(date => {
      const count = summaries.get(date);
      return { date, minutes: Math.floor((count?.seconds || 0) / 60), sessions: count?.completed || 0 };
    });
    const stepsCompleted = Number((db.prepare('SELECT COUNT(*) AS count FROM steps WHERE done=1 AND completed_date BETWEEN ? AND ?').get(days[0], days[days.length-1]) as Row).count);
    const allTasks = tasks();
    return {
      weekly, minutes: weekly.reduce((total, d) => total + d.minutes, 0), stepsCompleted,
      points: stepsCompleted * 10 + weekly.reduce((total, d) => total + d.sessions, 0) * 20,
      tasksCompleted: allTasks.filter(t => t.done).length, totalTasks: allTasks.length
    };
  };
  const transaction = <T>(f: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = f(); db.exec('COMMIT'); return result; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  return {
    close: () => db.close(),
    getProfile: () => String((db.prepare('SELECT name FROM profile WHERE id=1').get() as Row).name),
    setProfile: (name: string) => { db.prepare('UPDATE profile SET name = ? WHERE id = 1').run(name); return name; },
    tasks, getTask, sessions, messages, flashcards,
    createTask: (input: { title: string; kind: TaskKind; priority: number; dueDate: string | null }) => {
      const id = randomUUID();
      transaction(() => {
        db.prepare('INSERT INTO tasks (id, title, kind, priority, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, input.title, input.kind, input.priority, input.dueDate, now());
        const insert = db.prepare('INSERT INTO steps (id, task_id, title, minutes, position) VALUES (?, ?, ?, ?, ?)');
        generateSmallSteps(input.title, input.kind).forEach((s, index) => insert.run(randomUUID(), id, s.title, s.minutes, index));
      });
      return getTask(id)!;
    },
    updateTask: (id: string, input: { title?: string; kind?: TaskKind; priority?: number; dueDate?: string | null; done?: boolean; completedDate?: string }) => {
      const old = getTask(id);
      if (!old) return null;
      transaction(() => {
        db.prepare('UPDATE tasks SET title=?, kind=?, priority=?, due_date=?, done=? WHERE id=?').run(
          input.title ?? old.title, input.kind ?? old.kind, input.priority ?? old.priority,
          input.dueDate === undefined ? old.dueDate : input.dueDate, input.done === undefined ? Number(old.done) : Number(input.done), id
        );
        if (input.done !== undefined) db.prepare('UPDATE steps SET done=?, completed_date=? WHERE task_id=?').run(Number(input.done), input.done ? (input.completedDate || now().slice(0,10)) : null, id);
      });
      return getTask(id);
    },
    deleteTask: (id: string) => db.prepare('DELETE FROM tasks WHERE id=?').run(id).changes > 0,
    toggleStep: (id: string, completedDate = now().slice(0, 10)) => {
      const step = db.prepare('SELECT * FROM steps WHERE id=?').get(id) as Row | undefined;
      if (!step) return null;
      const taskId = String(step.task_id);
      transaction(() => {
        db.prepare('UPDATE steps SET done=?, completed_date=? WHERE id=?').run(Number(!step.done), step.done ? null : completedDate, id);
        db.prepare('UPDATE tasks SET done=? WHERE id=?').run(Number(stepCount(taskId) === 0), taskId);
      });
      return getTask(taskId);
    },
    addSession: (input: { taskId: string | null; minutes: number; elapsedSeconds: number; completed: boolean; localDate: string }) => {
      const id = randomUUID();
      db.prepare('INSERT INTO sessions (id, task_id, minutes, elapsed_seconds, completed, local_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id, input.taskId, input.minutes, input.elapsedSeconds, Number(input.completed), input.localDate, now()
      );
      return id;
    },
    addChatPair: (user: string, assistant: string) => transaction(() => {
      const save = db.prepare('INSERT INTO chat_messages (id, role, content, created_at) VALUES (?, ?, ?, ?)');
      save.run(randomUUID(), 'user', user, now());
      save.run(randomUUID(), 'assistant', assistant, now());
    }),
    clearChat: () => db.prepare('DELETE FROM chat_messages').run(),
    addFlashcards: (items: { front: string; back: string }[]) => transaction(() => {
      const save = db.prepare('INSERT INTO flashcards (id, front, back, created_at) VALUES (?, ?, ?, ?)');
      items.forEach(f => save.run(randomUUID(), f.front, f.back, now()));
    }),
    reviewFlashcard: (id: string, reviewed: boolean) => db.prepare('UPDATE flashcards SET reviewed=? WHERE id=?').run(Number(reviewed), id).changes > 0,
    deleteFlashcard: (id: string) => db.prepare('DELETE FROM flashcards WHERE id=?').run(id).changes > 0,
    stats,
    bootstrap: (localDate: string) => ({
      name: String((db.prepare('SELECT name FROM profile WHERE id=1').get() as Row).name),
      tasks: tasks(), sessions: sessions(), messages: messages(), flashcards: flashcards(), methods: studyMethods,
      stats: stats(localDate)
    })
  };
}
export type Store = ReturnType<typeof createStore>;
