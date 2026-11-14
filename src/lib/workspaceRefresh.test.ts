import { describe, it, expect, vi } from 'vitest';
import { emitWorkspaceRefresh, onWorkspaceRefresh } from './workspaceRefresh';

describe('workspace refresh', () => {
  it('calls every listener until it unsubscribes', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onWorkspaceRefresh(a);
    const offB = onWorkspaceRefresh(b);
    emitWorkspaceRefresh();
    offA();
    emitWorkspaceRefresh();
    offB();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});
