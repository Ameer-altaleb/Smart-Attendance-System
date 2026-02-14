/**
 * أدوات تحسين الأداء للنظام
 * Performance utilities for handling 250+ concurrent users
 */

/**
 * Debounce function - تأخير تنفيذ الدالة حتى انتهاء الكتابة
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func.apply(this, args);
            timeoutId = null;
        }, wait);
    };
}

/**
 * Throttle function - تنفيذ الدالة مرة واحدة كل فترة زمنية
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    let lastArgs: Parameters<T> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastArgs) {
                    func.apply(this, lastArgs);
                    lastArgs = null;
                }
            }, limit);
        } else {
            lastArgs = args;
        }
    };
}

/**
 * Request Queue - إدارة الطلبات المتزامنة لمنع الضغط على الخادم
 */
export class RequestQueue {
    private queue: Array<() => Promise<any>> = [];
    private processing = false;
    private concurrency: number;
    private activeRequests = 0;

    constructor(concurrency: number = 3) {
        this.concurrency = concurrency;
    }

    async add<T>(request: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await request();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0 && this.activeRequests < this.concurrency) {
            const request = this.queue.shift();
            if (request) {
                this.activeRequests++;
                request().finally(() => {
                    this.activeRequests--;
                    this.processQueue();
                });
            }
        }

        this.processing = false;
    }

    get pending(): number {
        return this.queue.length;
    }

    get active(): number {
        return this.activeRequests;
    }
}

/**
 * Retry with exponential backoff - إعادة المحاولة مع تأخير متزايد
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        baseDelay?: number;
        maxDelay?: number;
        onRetry?: (attempt: number, error: any) => void;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        onRetry
    } = options;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

                if (onRetry) {
                    onRetry(attempt + 1, error);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

/**
 * Batch operations - تجميع العمليات للتنفيذ دفعة واحدة
 */
export class BatchProcessor<T, R> {
    private batch: T[] = [];
    private timer: ReturnType<typeof setTimeout> | null = null;
    private readonly processor: (items: T[]) => Promise<R[]>;
    private readonly maxSize: number;
    private readonly maxWait: number;
    private resolvers: Array<(result: R) => void> = [];
    private rejecters: Array<(error: any) => void> = [];

    constructor(
        processor: (items: T[]) => Promise<R[]>,
        options: { maxSize?: number; maxWait?: number } = {}
    ) {
        this.processor = processor;
        this.maxSize = options.maxSize || 10;
        this.maxWait = options.maxWait || 100;
    }

    add(item: T): Promise<R> {
        return new Promise((resolve, reject) => {
            this.batch.push(item);
            this.resolvers.push(resolve);
            this.rejecters.push(reject);

            if (this.batch.length >= this.maxSize) {
                this.flush();
            } else if (!this.timer) {
                this.timer = setTimeout(() => this.flush(), this.maxWait);
            }
        });
    }

    private async flush(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.batch.length === 0) return;

        const items = [...this.batch];
        const resolvers = [...this.resolvers];
        const rejecters = [...this.rejecters];

        this.batch = [];
        this.resolvers = [];
        this.rejecters = [];

        try {
            const results = await this.processor(items);
            results.forEach((result, index) => {
                resolvers[index](result);
            });
        } catch (error) {
            rejecters.forEach(reject => reject(error));
        }
    }
}

/**
 * LocalStorage Manager with debounced saves - مدير التخزين المحلي مع حفظ مؤجل
 */
export class StorageManager {
    private pendingSaves: Map<string, any> = new Map();
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly saveDelay: number;

    constructor(saveDelay: number = 500) {
        this.saveDelay = saveDelay;
    }

    scheduleSave(key: string, value: any): void {
        this.pendingSaves.set(key, value);

        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        this.saveTimer = setTimeout(() => this.flushSaves(), this.saveDelay);
    }

    private flushSaves(): void {
        this.saveTimer = null;

        this.pendingSaves.forEach((value, key) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.error(`Failed to save ${key} to localStorage:`, error);
            }
        });

        this.pendingSaves.clear();
    }

    load<T>(key: string, fallback: T): T {
        try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : fallback;
        } catch {
            return fallback;
        }
    }

    // Force immediate save (useful before page unload)
    forceFlush(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.flushSaves();
    }
}

/**
 * Memoization helper for expensive computations
 */
export function memoize<T extends (...args: any[]) => any>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string
): T {
    const cache = new Map<string, ReturnType<T>>();

    return ((...args: Parameters<T>): ReturnType<T> => {
        const key = keyGenerator
            ? keyGenerator(...args)
            : JSON.stringify(args);

        if (cache.has(key)) {
            return cache.get(key)!;
        }

        const result = fn(...args);
        cache.set(key, result);
        return result;
    }) as T;
}

/**
 * Connection health checker
 */
export class ConnectionMonitor {
    private isOnline = navigator.onLine;
    private listeners: Set<(online: boolean) => void> = new Set();

    constructor() {
        window.addEventListener('online', () => this.setOnline(true));
        window.addEventListener('offline', () => this.setOnline(false));
    }

    private setOnline(online: boolean): void {
        if (this.isOnline !== online) {
            this.isOnline = online;
            this.listeners.forEach(listener => listener(online));
        }
    }

    get online(): boolean {
        return this.isOnline;
    }

    subscribe(listener: (online: boolean) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

// Global instances
export const storageManager = new StorageManager(500);
export const requestQueue = new RequestQueue(3);
export const connectionMonitor = new ConnectionMonitor();
