export function presentationMenu(): string;
export function bindPresentation(): () => void;
export function countVisual(value: string, total?: number | null, totalLabel?: string): string;


export function normalizePresentation(saved?: Record<string, unknown>): Record<string, string>;
