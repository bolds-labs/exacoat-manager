type Listener = () => void;
const listeners = new Set<Listener>();

/** Screens that load their own data subscribe here so the header Refresh reloads them. */
export function onWorkspaceRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fired by the app-wide (header) Refresh. */
export function emitWorkspaceRefresh(): void {
  listeners.forEach((l) => l());
}
