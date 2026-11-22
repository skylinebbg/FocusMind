export type StudyMethod = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  instructions: string[];
  example: string;
  color: string;
  icon: string;
  bestFor: string;
};

export const studyMethods: StudyMethod[] = [
  { id: 'pomodoro', title: 'Pomodoro flexible', tagline: 'Estudia un poquito, descansa un poquito.', description: 'Alterna bloques cortos de concentración y descansos sin exigirte perfección.', instructions: ['Elige una sola tarea.', 'Pon un temporizador entre 5 y 25 minutos.', 'Concéntrate solo en ese paso.', 'Al terminar, descansa de 2 a 5 minutos.'], example: 'Lee dos páginas de biología durante 10 minutos y descansa 3.', color: '#ef8a77', icon: 'timer', bestFor: 'Cuando cuesta empezar' },
  { id: 'feynman', title: 'Técnica Feynman', tagline: 'Si puedes explicarlo, lo estás entendiendo.', description: 'Convierte los conceptos difíciles en explicaciones sencillas.', instructions: ['Elige un concepto.', 'Explícalo como a alguien de 10 años.', 'Detecta lo que no sabes explicar.', 'Revisa esa parte y vuelve a explicarla.'], example: 'Explica la fotosíntesis sin usar palabras técnicas.', color: '#8a7be6', icon: 'lightbulb', bestFor: 'Para comprender temas' },
  { id: 'active-recall', title: 'Recuerdo activo', tagline: 'Pregunta primero, mira después.', description: 'Recordar sin mirar fortalece lo aprendido más que releer.', instructions: ['Cierra tus apuntes.', 'Hazte tres preguntas sobre el tema.', 'Responde de memoria.', 'Comprueba y corrige solo lo necesario.'], example: 'Sin mirar: ¿cuáles son las tres leyes de Newton?', color: '#54a78b', icon: 'brain', bestFor: 'Preparar exámenes' },
  { id: 'spaced-repetition', title: 'Repetición espaciada', tagline: 'Vuelve justo antes de olvidarlo.', description: 'Revisa información en diferentes días para recordarla por más tiempo.', instructions: ['Crea tarjetas pregunta-respuesta.', 'Repásalas hoy.', 'Repite mañana, luego a los 3 y 7 días.', 'Da más atención a las tarjetas difíciles.'], example: 'Repasa vocabulario de inglés hoy, mañana y la próxima semana.', color: '#dbad60', icon: 'layers', bestFor: 'Memorizar conceptos' },
  { id: 'blurting', title: 'Volcado de memoria', tagline: 'Escribe todo lo que recuerdes.', description: 'Comprueba qué sabes sin necesitar un examen formal.', instructions: ['Estudia un tema durante unos minutos.', 'Guarda el material.', 'Escribe lo que recuerdas sin corregirte.', 'Compara con los apuntes y completa vacíos.'], example: 'Después de leer historia, anota fechas y hechos sin mirar.', color: '#6d9fc7', icon: 'pencil', bestFor: 'Repasos rápidos' },
  { id: 'cornell', title: 'Notas Cornell', tagline: 'Tus apuntes también te pueden preguntar.', description: 'Organiza tus apuntes en ideas, preguntas y resumen.', instructions: ['Divide la hoja en columna de notas y preguntas.', 'Registra conceptos en la columna grande.', 'Escribe preguntas en la columna izquierda.', 'Cierra con un resumen de 3 líneas.'], example: 'Notas: mitosis. Pregunta: ¿qué ocurre en la metafase?', color: '#d184b0', icon: 'notebook', bestFor: 'Clases y lecturas' },
  { id: 'interleaving', title: 'Práctica intercalada', tagline: 'Mezcla para aprender a elegir.', description: 'Alterna tipos de problemas para reconocer qué estrategia aplicar.', instructions: ['Elige dos o tres tipos de ejercicios relacionados.', 'Resuelve uno de cada tipo.', 'Repite el ciclo.', 'Explica por qué elegiste cada estrategia.'], example: 'Alterna ecuaciones, fracciones y porcentajes.', color: '#7caaa8', icon: 'shuffle', bestFor: 'Matemáticas y ejercicios' },
  { id: 'sq3r', title: 'SQ3R: lectura activa', tagline: 'Leer con una misión.', description: 'Explora, pregunta, lee, recita y repasa para comprender textos.', instructions: ['Explora títulos e imágenes.', 'Haz preguntas sobre el contenido.', 'Lee buscando respuestas.', 'Explica con tus palabras.', 'Repasa lo importante.'], example: 'Antes de leer un capítulo pregunta: ¿qué explica este título?', color: '#aa92cf', icon: 'book-open', bestFor: 'Textos largos' }
];

export type TaskKind = 'study' | 'exam' | 'delivery';
export type GeneratedStep = { title: string; minutes: number };

export function generateSmallSteps(title: string, kind: TaskKind): GeneratedStep[] {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  const short = clean.charAt(0).toLowerCase() + clean.slice(1);
  const pieces = clean.split(/\s+(?:y|e|luego)\s+|[,;]/i).map(x => x.trim()).filter(Boolean);
  if (pieces.length >= 2 && pieces.length <= 4) {
    return [
      { title: `Preparar lo necesario para ${short}`, minutes: 2 },
      ...pieces.map((part, i) => ({ title: `${i === 0 ? 'Empezar con' : 'Continuar con'}: ${part.charAt(0).toLowerCase() + part.slice(1)}`, minutes: i % 2 === 0 ? 5 : 4 })),
      { title: 'Revisar lo avanzado y anotar el siguiente paso', minutes: 3 }
    ].slice(0, 6);
  }
  if (kind === 'exam') return [
    { title: `Elegir un tema del examen: ${short}`, minutes: 2 },
    { title: 'Repasar un concepto importante', minutes: 5 },
    { title: 'Responder dos preguntas sin mirar apuntes', minutes: 5 },
    { title: 'Anotar qué necesito repasar después', minutes: 3 }
  ];
  if (kind === 'delivery') return [
    { title: `Leer los requisitos de ${short}`, minutes: 3 },
    { title: 'Escribir un esquema pequeño', minutes: 4 },
    { title: 'Hacer una primera parte de la entrega', minutes: 5 },
    { title: 'Revisar qué falta y guardar los avances', minutes: 3 }
  ];
  return [
    { title: `Preparar materiales para ${short}`, minutes: 2 },
    { title: 'Trabajar en una parte pequeña', minutes: 5 },
    { title: 'Practicar o escribir una idea clave', minutes: 5 },
    { title: 'Anotar lo aprendido', minutes: 3 }
  ];
}

export function isoLocalDays(endingDate: string, count = 7): string[] {
  const date = new Date(`${endingDate}T12:00:00Z`);
  if (!Number.isFinite(date.valueOf())) throw new Error('Fecha no válida');
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(date);
    day.setUTCDate(day.getUTCDate() - (count - 1 - i));
    return day.toISOString().slice(0, 10);
  });
}
