import { BookOpen, Brain, CircleHelp, Clock3, Layers3, Lightbulb, NotebookPen, PencilLine, Shuffle, Timer, type LucideIcon } from 'lucide-react';
export const methodIcons: Record<string, LucideIcon> = {
  pomodoro: Timer, feynman: Lightbulb, 'active-recall': Brain, 'spaced-repetition': Layers3,
  blurting: PencilLine, cornell: NotebookPen, interleaving: Shuffle, sq3r: BookOpen
};
export const typeLabels = { study: 'Estudio', exam: 'Examen', delivery: 'Entrega' } as const;
export const kindColors = { study: 'purple', exam: 'coral', delivery: 'blue' } as const;
export const unusedIcons = { CircleHelp, Clock3 };
