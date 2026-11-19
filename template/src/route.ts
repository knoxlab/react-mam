export type Route =
  | { name: 'dashboard' }
  | { name: 'library'; kind?: string }
  | { name: 'detail'; id: string }
  | { name: 'review' }
  | { name: 'ai' };
