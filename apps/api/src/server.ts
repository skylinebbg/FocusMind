import dotenv from 'dotenv';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z, ZodError } from 'zod';
import { createStore } from './db.js';
import { AIUnavailableError, aiStatus, chatAI, generateFlashcardsAI } from './ai.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
dotenv.config({ path: resolve(projectRoot, '.env') });

const dbUrl = process.env.TURSO_DATABASE_URL || `file:${resolve(projectRoot, process.env.DATABASE_PATH || 'data/focusmind.sqlite')}`;
const store = await createStore(dbUrl, process.env.TURSO_AUTH_TOKEN);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '150kb' }));
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1):(5173|4173)$/ }));

const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d, 'Fecha inválida');
const id = z.string().uuid();
const taskInput = z.object({ title: z.string().trim().min(3).max(180), kind: z.enum(['study', 'exam', 'delivery']).default('study'), priority: z.number().int().min(1).max(3).default(2), dueDate: localDate.nullable().default(null) });
const taskPatch = taskInput.partial().extend({ done: z.boolean().optional(), completedDate: localDate.optional() }).refine(o => Object.keys(o).length > 0, 'Debes enviar un cambio');

app.get('/api/health', (_req, res) => { res.json({ ok: true, app: 'paso-a-paso', timestamp: new Date().toISOString() }); });

app.get('/api/bootstrap', async (req, res) => {
  const date = localDate.parse(req.query.date);
  res.json(await store.bootstrap(date));
});

app.patch('/api/profile', async (req, res) => {
  const { name } = z.object({ name: z.string().trim().max(60) }).parse(req.body);
  res.json({ name: await store.setProfile(name) });
});

app.post('/api/tasks', async (req, res) => {
  const input = taskInput.parse(req.body);
  res.status(201).json(await store.createTask(input));
});

app.patch('/api/tasks/:id', async (req, res) => {
  const task = await store.updateTask(id.parse(req.params.id), taskPatch.parse(req.body));
  if (!task) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  res.json(task);
});

app.delete('/api/tasks/:id', async (req, res) => {
  const removed = await store.deleteTask(id.parse(req.params.id));
  if (!removed) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  res.status(204).send();
});

app.post('/api/steps/:id/toggle', async (req, res) => {
  const parsed = z.object({ localDate: localDate.optional() }).parse(req.body || {});
  const task = await store.toggleStep(id.parse(req.params.id), parsed.localDate);
  if (!task) { res.status(404).json({ error: 'Paso no encontrado' }); return; }
  res.json(task);
});

app.post('/api/sessions', async (req, res) => {
  const input = z.object({
    taskId: id.nullable(), minutes: z.number().int().min(5).max(25), elapsedSeconds: z.number().int().min(0).max(1500),
    completed: z.boolean(), localDate
  }).parse(req.body);
  if (input.taskId && !(await store.getTask(input.taskId))) { res.status(400).json({ error: 'La tarea seleccionada no existe' }); return; }
  if (input.elapsedSeconds > input.minutes * 60) { res.status(400).json({ error: 'El tiempo transcurrido supera la duración elegida' }); return; }
  const sessionId = await store.addSession(input);
  res.status(201).json({ id: sessionId });
});

app.get('/api/ai/status', async (_req, res) => { res.json(await aiStatus()); });

app.post('/api/chat', async (req, res) => {
  const { message } = z.object({ message: z.string().trim().min(1).max(3000) }).parse(req.body);
  const rawMessages = await store.messages();
  const history = rawMessages.map(({ role, content }) => ({ role, content }));
  const answer = await chatAI(history, message);
  await store.addChatPair(message, answer);
  res.status(201).json({ answer });
});

app.delete('/api/chat', async (_req, res) => {
  await store.clearChat();
  res.status(204).send();
});

app.post('/api/flashcards/generate', async (req, res) => {
  const { notes } = z.object({ notes: z.string().trim().min(20, 'Escribe al menos 20 caracteres').max(8000) }).parse(req.body);
  const cards = await generateFlashcardsAI(notes);
  await store.addFlashcards(cards);
  res.status(201).json({ cards });
});

app.patch('/api/flashcards/:id', async (req, res) => {
  const { reviewed } = z.object({ reviewed: z.boolean() }).parse(req.body);
  if (!(await store.reviewFlashcard(id.parse(req.params.id), reviewed))) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return; }
  res.json({ reviewed });
});

app.delete('/api/flashcards/:id', async (req, res) => {
  if (!(await store.deleteFlashcard(id.parse(req.params.id)))) { res.status(404).json({ error: 'Tarjeta no encontrada' }); return; }
  res.status(204).send();
});

const webDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/')) { next(); return; }
    res.sendFile(resolve(webDist, 'index.html'));
  });
}
app.use('/api/{*path}', (_req, res) => { res.status(404).json({ error: 'Ruta no encontrada' }); });

const onError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) { res.status(400).json({ error: error.issues.map(i => `${i.path.join('.') || 'Datos'}: ${i.message}`).join('; ') }); return; }
  if (error instanceof AIUnavailableError) { res.status(503).json({ error: error.message }); return; }
  if (error instanceof SyntaxError && 'body' in error) { res.status(400).json({ error: 'JSON inválido' }); return; }
  console.error('[API]', error);
  res.status(500).json({ error: 'Ocurrió un error inesperado' });
};
app.use(onError);

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => console.log(`\n  ✨ Paso a Paso — API lista en http://${host}:${port}\n`));
process.on('SIGINT', () => { store.close(); process.exit(0); });
