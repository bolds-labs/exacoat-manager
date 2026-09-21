/**
 * Exacoat Manager Client-Side Audit & AI Diagnostics Logger
 * Captures all live Manager events, AI LLM generations, Photo Studio calls, and WordPress REST actions.
 */

export interface ManagerAuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  formattedTime: string; // HH:mm:ss.SSS
  category: 'ai_persona' | 'ai_bio' | 'ai_avatar' | 'ai_artwork' | 'wp_bridge' | 'system' | 'user_action';
  level: 'info' | 'success' | 'warn' | 'error';
  title: string;
  message: string;
  provider?: 'OpenAI' | 'Gemini' | 'WordPress REST' | 'Flux AI Studio' | 'System';
  model?: string;
  latencyMs?: number;
  statusCode?: number | string;
  requestData?: any;
  responseData?: any;
  error?: string;
}

type LogListener = (logs: ManagerAuditLogEntry[]) => void;

class ManagerAuditLogger {
  private logs: ManagerAuditLogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 300;
  private storageKey = 'exacoat_manager_audit_logs';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined') {
        const raw = sessionStorage.getItem(this.storageKey);
        if (raw) {
          this.logs = JSON.parse(raw);
        }
      }
    } catch {
      this.logs = [];
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(this.storageKey, JSON.stringify(this.logs.slice(0, 100)));
      }
    } catch {
      // Ignore storage errors
    }
  }

  private formatTime(d: Date): string {
    const pad = (n: number, z = 2) => ('00' + n).slice(-z);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  public log(entry: Omit<ManagerAuditLogEntry, 'id' | 'timestamp' | 'formattedTime'>): ManagerAuditLogEntry {
    const now = new Date();
    const newEntry: ManagerAuditLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now.toISOString(),
      formattedTime: this.formatTime(now),
    };

    this.logs.unshift(newEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.saveToStorage();
    this.notify();
    return newEntry;
  }

  public getLogs(): ManagerAuditLogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    this.saveToStorage();
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getLogs();
    this.listeners.forEach(fn => {
      try {
        fn(current);
      } catch (err) {
        console.error('[AUDIT LOGGER] Listener error:', err);
      }
    });
  }
}

export const auditLogger = new ManagerAuditLogger();
