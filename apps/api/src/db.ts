import { createClient, type Client, type InValue } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { generateSmallSteps, isoLocalDays, studyMethods, type TaskKind } from './study.js';

export type Step = { id: string; taskId: string; title: string; minutes: number; done: boolean; position: number };
export type Task = { id: string; title: string; kind: TaskKind; priority: number; dueDate: string | null; done: boolean; createdAt: string; steps: Step[] };
export type Session = { id: string; minutes: number; elapsedSeconds: number; completed: boolean; localDate: string; taskId: string | null; createdAt: string };
export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
export type Flashcard = { id: string; front: string; back: string; reviewed: boolean; createdAt: string };

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

export async function createStore(
  url = process.env.TURSO_DATABASE_URL || 'file:./data/focusmind.sqlite',
  authToken = process.env.TURSO_AUTH_TOKEN
) {
  const db: Client = createClient({ url, authToken });

  await db.batch([
    "CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '')",
    "CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'study', priority INTEGER NOT NULL DEFAULT 2, due_date TEXT, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS steps (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, title TEXT NOT NULL, minutes INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, completed_date TEXT, position INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL, minutes INTEGER NOT NULL, elapsed_seconds INTEGER NOT NULL, completed INTEGER NOT NULL, local_date TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS flashcards (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, front TEXT NOT NULL, back TEXT NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)"
  ], 'write');

  const ensureProfile = async (userId: string) => {
    await db.execute({
      sql: "INSERT OR IGNORE INTO profiles (user_id, name) VALUES (?, '')",
      args: [userId]
    });
  };

  const readTask = async (r: Row): Promise<Task> => {
    const stepsRes = await db.execute({
      sql: "SELECT * FROM steps WHERE task_id = ? ORDER BY position",
      args: [String(r.id)]
    });

    return {
      id: String(r.id),
      title: String(r.title),
      kind: r.kind as TaskKind,
      priority: Number(r.priority),
      dueDate: r.due_date === null ? null : String(r.due_date),
      done: Boolean(r.done),
      createdAt: String(r.created_at),
      steps: stepsRes.rows.map(s => ({
        id: String(s.id),
        taskId: String(s.task_id),
        title: String(s.title),
        minutes: Number(s.minutes),
        done: Boolean(s.done),
        position: Number(s.position)
      }))
    };
  };

  const tasks = async (userId: string): Promise<Task[]> => {
    const res = await db.execute({
      sql: "SELECT * FROM tasks WHERE user_id = ? ORDER BY done ASC, priority DESC, due_date IS NULL, due_date ASC, created_at DESC",
      args: [userId]
    });
    return Promise.all(res.rows.map(r => readTask(r as Row)));
  };

  const getTask = async (userId: string, id: string): Promise<Task | null> => {
    const res = await db.execute({
      sql: "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
      args: [id, userId]
    });
    const row = res.rows[0] as Row | undefined;
    return row ? readTask(row) : null;
  };

  const stepCount = async (taskId: string): Promise<number> => {
    const res = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM steps WHERE task_id = ? AND done = 0",
      args: [taskId]
    });
    return Number(res.rows[0].n);
  };

  const sessions = async (userId: string): Promise<Session[]> => {
    const res = await db.execute({
      sql: "SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
      args: [userId]
    });
    return res.rows.map(s => ({
      id: String(s.id),
      taskId: s.task_id === null ? null : String(s.task_id),
      minutes: Number(s.minutes),
      elapsedSeconds: Number(s.elapsed_seconds),
      completed: Boolean(s.completed),
      localDate: String(s.local_date),
      createdAt: String(s.created_at)
    }));
  };

  const messages = async (userId: string): Promise<ChatMessage[]> => {
    const res = await db.execute({
      sql: "SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 100",
      args: [userId]
    });
    return res.rows.map(m => ({
      id: String(m.id),
      role: m.role as ChatMessage['role'],
      content: String(m.content),
      createdAt: String(m.created_at)
    }));
  };

  const flashcards = async (userId: string): Promise<Flashcard[]> => {
    const res = await db.execute({
      sql: "SELECT * FROM flashcards WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
      args: [userId]
    });
    return res.rows.map(f => ({
      id: String(f.id),
      front: String(f.front),
      back: String(f.back),
      reviewed: Boolean(f.reviewed),
      createdAt: String(f.created_at)
    }));
  };
  const stats = async (userId: string, localDate: string) => {
    const days = isoLocalDays(localDate);
    const rowsRes = await db.execute({
      sql: "SELECT local_date, SUM(elapsed_seconds) AS seconds, SUM(completed) AS complete_count FROM sessions WHERE user_id = ? AND local_date BETWEEN ? AND ? GROUP BY local_date",
      args: [userId, days[0], days[days.length - 1]]
    });

    const summaries = new Map(
      rowsRes.rows.map(r => [
        String(r.local_date),
        { seconds: Number(r.seconds), completed: Number(r.complete_count) }
      ])
    );

    const weekly = days.map(date => {
      const count = summaries.get(date);
      return {
        date,
        minutes: Math.floor((count?.seconds || 0) / 60),
        sessions: count?.completed || 0
      };
    });

    const stepsRes = await db.execute({
      sql: "SELECT COUNT(*) AS count FROM steps s JOIN tasks t ON s.task_id = t.id WHERE t.user_id = ? AND s.done = 1 AND s.completed_date BETWEEN ? AND ?",
      args: [userId, days[0], days[days.length - 1]]
    });
    const stepsCompleted = Number(stepsRes.rows[0].count);
    const allTasks = await tasks(userId);

    return {
      weekly,
      minutes: weekly.reduce((total, d) => total + d.minutes, 0),
      stepsCompleted,
      points: stepsCompleted * 10 + weekly.reduce((total, d) => total + d.sessions, 0) * 20,
      tasksCompleted: allTasks.filter(t => t.done).length,
      totalTasks: allTasks.length
    };
  };

  return {
    close: () => db.close(),

    setProfile: async (userId: string, name: string) => {
      await ensureProfile(userId);
      await db.execute({
        sql: "UPDATE profiles SET name = ? WHERE user_id = ?",
        args: [name, userId]
      });
      return name;
    },

    tasks,
    getTask,
    sessions,
    messages,
    flashcards,

    createTask: async (userId: string, input: { title: string; kind: TaskKind; priority: number; dueDate: string | null }) => {
      const id = randomUUID();
      const createdAt = now();
      const steps = generateSmallSteps(input.title, input.kind);

      const statements: { sql: string; args: InValue[] }[] = [
        {
          sql: "INSERT INTO tasks (id, user_id, title, kind, priority, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [id, userId, input.title, input.kind, input.priority, input.dueDate, createdAt]
        },
        ...steps.map((s, index) => ({
          sql: "INSERT INTO steps (id, task_id, title, minutes, position) VALUES (?, ?, ?, ?, ?)",
          args: [randomUUID(), id, s.title, s.minutes, index]
        }))
      ];

      await db.batch(statements, 'write');
      return (await getTask(userId, id))!;
    },

    updateTask: async (
      userId: string,
      id: string,
      input: { title?: string; kind?: TaskKind; priority?: number; dueDate?: string | null; done?: boolean; completedDate?: string }
    ) => {
      const old = await getTask(userId, id);
      if (!old) return null;

      const statements: { sql: string; args: InValue[] }[] = [
        {
          sql: "UPDATE tasks SET title=?, kind=?, priority=?, due_date=?, done=? WHERE id=? AND user_id=?",
          args: [
            input.title ?? old.title,
            input.kind ?? old.kind,
            input.priority ?? old.priority,
            input.dueDate === undefined ? old.dueDate : input.dueDate,
            input.done === undefined ? Number(old.done) : Number(input.done),
            id,
            userId
          ]
        }
      ];

      if (input.done !== undefined) {
        statements.push({
          sql: "UPDATE steps SET done=?, completed_date=? WHERE task_id=?",
          args: [Number(input.done), input.done ? (input.completedDate || now().slice(0, 10)) : null, id]
        });
      }

      await db.batch(statements, 'write');
      return getTask(userId, id);
    },

    deleteTask: async (userId: string, id: string) => {
      const res = await db.execute({ sql: "DELETE FROM tasks WHERE id=? AND user_id=?", args: [id, userId] });
      return res.rowsAffected > 0;
    },

    toggleStep: async (userId: string, id: string, completedDate = now().slice(0, 10)) => {
      const stepRes = await db.execute({
        sql: "SELECT s.* FROM steps s JOIN tasks t ON s.task_id = t.id WHERE s.id = ? AND t.user_id = ?",
        args: [id, userId]
      });
      const step = stepRes.rows[0] as Row | undefined;
      if (!step) return null;

      const taskId = String(step.task_id);
      await db.execute({
        sql: "UPDATE steps SET done=?, completed_date=? WHERE id=?",
        args: [Number(!step.done), step.done ? null : completedDate, id]
      });

      const remaining = await stepCount(taskId);
      await db.execute({
        sql: "UPDATE tasks SET done=? WHERE id=? AND user_id=?",
        args: [Number(remaining === 0), taskId, userId]
      });

      return getTask(userId, taskId);
    },

    addSession: async (userId: string, input: { taskId: string | null; minutes: number; elapsedSeconds: number; completed: boolean; localDate: string }) => {
      const id = randomUUID();
      await db.execute({
        sql: "INSERT INTO sessions (id, user_id, task_id, minutes, elapsed_seconds, completed, local_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [id, userId, input.taskId, input.minutes, input.elapsedSeconds, Number(input.completed), input.localDate, now()]
      });
      return id;
    },

    addChatPair: async (userId: string, user: string, assistant: string) => {
      const ts = now();
      await db.batch([
        {
          sql: "INSERT INTO chat_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
          args: [randomUUID(), userId, 'user', user, ts]
        },
        {
          sql: "INSERT INTO chat_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
          args: [randomUUID(), userId, 'assistant', assistant, ts]
        }
      ], 'write');
    },

    clearChat: async (userId: string) => {
      await db.execute({ sql: "DELETE FROM chat_messages WHERE user_id = ?", args: [userId] });
    },

    addFlashcards: async (userId: string, items: { front: string; back: string }[]) => {
      const ts = now();
      await db.batch(
        items.map(f => ({
          sql: "INSERT INTO flashcards (id, user_id, front, back, created_at) VALUES (?, ?, ?, ?, ?)",
          args: [randomUUID(), userId, f.front, f.back, ts]
        })),
        'write'
      );
    },

    reviewFlashcard: async (userId: string, id: string, reviewed: boolean) => {
      const res = await db.execute({
        sql: "UPDATE flashcards SET reviewed=? WHERE id=? AND user_id=?",
        args: [Number(reviewed), id, userId]
      });
      return res.rowsAffected > 0;
    },

    deleteFlashcard: async (userId: string, id: string) => {
      const res = await db.execute({
        sql: "DELETE FROM flashcards WHERE id=? AND user_id=?",
        args: [id, userId]
      });
      return res.rowsAffected > 0;
    },

    stats,

    bootstrap: async (userId: string, localDate: string) => {
      await ensureProfile(userId);
      const [profileRes, tasksList, sessionsList, messagesList, flashcardsList, statsData] = await Promise.all([
        db.execute({ sql: "SELECT name FROM profiles WHERE user_id=?", args: [userId] }),
        tasks(userId),
        sessions(userId),
        messages(userId),
        flashcards(userId),
        stats(userId, localDate)
      ]);

      return {
        name: String(profileRes.rows[0]?.name ?? ''),
        tasks: tasksList,
        sessions: sessionsList,
        messages: messagesList,
        flashcards: flashcardsList,
        methods: studyMethods,
        stats: statsData
      };
    }
  };
}

export type Store = Awaited<ReturnType<typeof createStore>>;
