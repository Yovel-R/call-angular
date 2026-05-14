import { Injectable } from '@angular/core';

interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

@Injectable({ providedIn: 'root' })
export class FastCacheService {
  private readonly prefix = 'dealvoice_fast_cache:';
  private readonly ttlMs = 5 * 60 * 1000;
  private memory = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.getEntry<T>(key);
    return entry?.value ?? null;
  }

  getFresh<T>(key: string): T | null {
    const entry = this.getEntry<T>(key);
    if (!entry || this.isExpired(entry.savedAt)) return null;
    return entry.value;
  }

  hasFresh(key: string): boolean {
    const entry = this.getEntry(key);
    return !!entry && !this.isExpired(entry.savedAt);
  }

  set<T>(key: string, value: T): void {
    const entry: CacheEntry<T> = { savedAt: Date.now(), value };
    this.memory.set(key, entry);
    try {
      localStorage.setItem(this.storageKey(key), JSON.stringify(entry));
    } catch {
      // Storage can be unavailable or full; memory cache still helps within the session.
    }
  }

  removeWhere(match: (key: string) => boolean): void {
    Array.from(this.memory.keys()).forEach((key) => {
      if (match(key)) this.memory.delete(key);
    });

    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(this.prefix))
        .forEach((storageKey) => {
          const rawKey = storageKey.slice(this.prefix.length);
          if (match(rawKey)) localStorage.removeItem(storageKey);
        });
    } catch {}
  }

  key(parts: Array<string | number | boolean | null | undefined>): string {
    return parts
      .map((part) => encodeURIComponent(String(part ?? '')))
      .join('|');
  }

  private getEntry<T>(key: string): CacheEntry<T> | null {
    const memoryEntry = this.memory.get(key) as CacheEntry<T> | undefined;
    if (memoryEntry) return memoryEntry;

    try {
      const raw = localStorage.getItem(this.storageKey(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (!parsed || typeof parsed.savedAt !== 'number') return null;
      this.memory.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  private isExpired(savedAt: number): boolean {
    return Date.now() - savedAt > this.ttlMs;
  }

  private storageKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}
