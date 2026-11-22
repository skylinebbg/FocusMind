# ✳ Paso a Paso — App de estudio (frontend + backend)

Aplicación web de estudio **local-first**, en español, construida a partir de los cinco módulos solicitados: **Inicio, Tareas, Tiempo, Métodos y Focus**.

## Tecnologías

- **Frontend:** React 19 + Vite + TypeScript + CSS adaptable.
- **Backend:** Node.js (22.16+; recomendado 24) + Express 5 + TypeScript, validación con Zod.
- **Base de datos:** SQLite local con el módulo nativo `node:sqlite` de Node.js. Sin servicios cloud.
- **IA:** Ollama ejecutándose localmente (modelo configurable), usando su API HTTP. No AWS y no requiere cuenta de un proveedor de IA.
- **Pruebas:** `node:test` y `tsx` para lógica del dominio y persistencia.

## Requisitos

- Node.js **24** y npm (en 22.16+ también es compatible; Node 22 puede mostrar un aviso experimental de SQLite).
- Para **Focus IA**: [Ollama](https://ollama.com/) y un modelo descargado. El resto funciona sin Ollama.

## Ejecutar en macOS / Windows / Linux

```bash
# 1. Abre la carpeta paso-a-paso en VS Code
cp .env.example .env

# 2. Instala paquetes del monorepo
npm install

# 3. Levanta frontend + backend simultáneamente
npm run dev
```

Abre **http://127.0.0.1:5173**. El backend queda en **http://127.0.0.1:3001**.

Para probar Focus IA, instala Ollama (en macOS puedes descargar la app) y ejecuta:

```bash
ollama pull llama3.2:3b
ollama serve
```

> Si la app Ollama ya está ejecutando su servidor en segundo plano, **no** lances otro `ollama serve`. Configura `OLLAMA_MODEL` en `.env` si prefieres otro modelo disponible.

**No inventamos respuestas de IA:** si Ollama no está disponible, Focus explica cómo activarlo. Tareas, tiempo, progreso y métodos siguen funcionando.

## Comandos útiles

```bash
npm run dev          # Desarrollo, dos servidores con hot reload
npm run typecheck    # Comprobar tipos TS
npm test             # Pruebas backend
npm run build        # Compilar API y frontend
npm start            # Iniciar API y servir frontend compilado
```

Tras `npm run build`, abre **http://127.0.0.1:3001** con `npm start` para usar la aplicación sin Vite.

## Funcionalidades implementadas

| Pantalla | Funcionalidades |
|---|---|
| Inicio | Saludo con nombre opcional, 3 accesos de estudio, tareas prioritarias, mini pasos, gráfico de minutos últimos 7 días, puntos semanales y método recomendado |
| Tareas | Crear tareas de estudio/exámenes/entregas, establecer fecha y prioridad, descomposición automática en pasos de 2–5 min, marcar pasos/tareas, eliminar, filtrar, buscar, calendario mensual y próximas fechas |
| Tiempo | Temporizador 5/10/15/25 min, pausa/reanudación, descanso de 3 min, detener sin penalización, guardar sesiones completas o parciales, asociar tarea y ver historial |
| Métodos | 8 técnicas documentadas con pasos prácticos, ejemplo y enlace al temporizador |
| Focus | Chat de tutoría con Ollama real, historial local, mensajes persistidos, generación de tarjetas desde apuntes, mostrar respuestas, marcar repasadas y eliminar |

Los datos se conservan en `data/paso-a-paso.sqlite` (generada al primer uso). El fichero `.env` permite modificar las rutas y puertos.

## Arquitectura

```text
paso-a-paso/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts    # API REST, validación y servidor web de producción
│   │   │   ├── db.ts        # Esquema y repositorio SQLite
│   │   │   ├── ai.ts        # Integración con Ollama /api/chat
│   │   │   └── study.ts     # 8 métodos y algoritmo de microtareas
│   │   └── tests/
│   └── web/
│       ├── src/
│       │   ├── App.tsx      # Navegación y acciones
│       │   ├── views/       # 5 pantallas
│       │   ├── components/  # Tareas y formulario
│       │   ├── api.ts       # Cliente HTTP tipado
│       │   └── styles.css   # Sistema visual y responsive
│       └── vite.config.ts
├── .env.example
└── package.json
```

## Endpoints de la API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/health` | Comprobar estado |
| GET | `/api/bootstrap?date=YYYY-MM-DD` | Estado inicial y estadísticas |
| PATCH | `/api/profile` | Actualizar nombre opcional |
| POST | `/api/tasks` | Crear tarea y micro-pasos |
| PATCH / DELETE | `/api/tasks/:id` | Actualizar o borrar |
| POST | `/api/steps/:id/toggle` | Marcar/desmarcar un paso |
| POST | `/api/sessions` | Guardar sesión |
| GET | `/api/ai/status` | Comprobar Ollama y modelo |
| POST / DELETE | `/api/chat` | Conversar / vaciar historial |
| POST | `/api/flashcards/generate` | Crear tarjetas a partir de apuntes |
| PATCH / DELETE | `/api/flashcards/:id` | Marcar repasada / borrar |

## Decisiones y límites

- **Una persona por instalación**, sin autenticación de usuario ni sincronización multiusuario. Úsala localmente; el servidor se enlaza a `127.0.0.1` por defecto.
- La división de tareas usa un **algoritmo determinista**; no depende de la IA. Genera pasos base de 2 a 5 minutos, que puedes marcar, pero no editar individualmente todavía.
- Los minutos del gráfico representan los últimos siete días; el contador de pasos y puntos es acumulado (no solo de los últimos siete días).
- Los puntos semanales equivalen a 10 por paso completado durante los últimos siete días + 20 por sesión completa en esos mismos días; **no se descuentan puntos por interrupciones**.
- **No hay notificaciones push**, pagos ni conexión a calendario externo; el calendario es interno.
- El contenido del chat y las notas enviados al modelo se procesan en Ollama, configurado en tu propio equipo. No expongas tu servidor de Ollama ni esta API a Internet sin antes añadir autenticación y controles de acceso.

## Próximas mejoras sugeridas

Autenticación y múltiples perfiles, edición de pasos, repasos espaciados con planificación, recordatorios, respaldos y sincronización opcional.
