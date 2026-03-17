import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { Center, Employee, Admin, AttendanceRecord, Holiday, MessageTemplate, SystemSettings, Notification, Project } from './types.ts';
import {
  INITIAL_TEMPLATES,
  INITIAL_SETTINGS,
  INITIAL_ADMINS,
  INITIAL_CENTERS,
  INITIAL_EMPLOYEES,
  INITIAL_HOLIDAYS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PROJECTS,
  DRIVE_BRIDGE_URL
} from './constants.tsx';
import { supabase, checkSupabaseConnection } from './lib/supabase.ts';
import { storageManager, requestQueue, withRetry, debounce, connectionMonitor } from './utils/performance.ts';
import { writeToSyncQueue, removeFromSyncQueue, saveConfig, writeToPermanentAudit, getAllFromPermanentAudit } from './utils/syncQueue.ts';

/**
 * Generates a deterministic UUID based on an input string.
 * Used to satisfy Database UUID requirements while maintaining deterministic IDs.
 */
export const generateDeterministicUUID = (input: string): string => {
  // Simple but effective deterministic hashing
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const part = (h: number) => (h >>> 0).toString(16).padStart(8, '0');
  const full = part(h1) + part(h2) + part(h1 ^ h2) + part(h1 & h2);

  return `${full.slice(0, 8)}-${full.slice(8, 12)}-4${full.slice(13, 16)}-a${full.slice(17, 20)}-${full.slice(20, 32)}`;
};

interface AppContextType {
  centers: Center[];
  employees: Employee[];
  admins: Admin[];
  attendance: AttendanceRecord[];
  holidays: Holiday[];
  projects: Project[];
  notifications: Notification[];
  templates: MessageTemplate[];
  settings: SystemSettings;
  currentUser: Admin | null;
  isLoading: boolean;
  isRealtimeConnected: boolean;
  dbStatus: { [key: string]: 'online' | 'offline' | 'checking' };
  pendingOperations: number;
  setCurrentUser: (user: Admin | null) => void;
  addCenter: (center: Center) => Promise<void>;
  updateCenter: (center: Center) => Promise<void>;
  deleteCenter: (id: string) => Promise<void>;
  addEmployee: (employee: Employee) => Promise<void>;
  updateEmployee: (employee: Employee) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addAttendance: (record: AttendanceRecord) => Promise<boolean>;
  updateAttendance: (record: AttendanceRecord) => Promise<boolean>;
  addNotification: (notification: Notification) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  updateTemplate: (template: MessageTemplate) => Promise<void>;
  updateSettings: (settings: SystemSettings) => Promise<void>;
  addAdmin: (admin: Admin) => Promise<void>;
  updateAdmin: (admin: Admin) => Promise<void>;
  deleteAdmin: (id: string) => Promise<void>;
  addHoliday: (holiday: Holiday) => Promise<void>;
  deleteHoliday: (id: string) => Promise<void>;
  addProject: (project: Project) => Promise<void>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refreshData: (tableName?: string) => Promise<void>;
  testConnection: () => Promise<void>;
  retrySync: () => Promise<void>;
  sendRemoteRefresh: () => Promise<void>;
  requestDataRecovery: () => Promise<void>;
  importRecordsFromJSON: (file: File) => Promise<{ success: boolean; count: number; error?: string }>;
  timeOffset: number;
  currentTime: Date;
  isTimeSynced: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- 1. State & Refs ---
  const [centers, setCenters] = useState<Center[]>(() => storageManager.load('centers', INITIAL_CENTERS));
  const [employees, setEmployees] = useState<Employee[]>(() => storageManager.load('employees', INITIAL_EMPLOYEES));
  const [admins, setAdmins] = useState<Admin[]>(() => storageManager.load('admins', INITIAL_ADMINS));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => storageManager.load('attendance', []));
  const [holidays, setHolidays] = useState<Holiday[]>(() => storageManager.load('holidays', INITIAL_HOLIDAYS));
  const [projects, setProjects] = useState<Project[]>(() => storageManager.load('projects', INITIAL_PROJECTS));
  const [notifications, setNotifications] = useState<Notification[]>(() => storageManager.load('notifications', INITIAL_NOTIFICATIONS));
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => storageManager.load('templates', INITIAL_TEMPLATES));
  const [settings, setSettings] = useState<SystemSettings>(() => storageManager.load('settings', INITIAL_SETTINGS));
  const [currentUser, setCurrentUser] = useState<Admin | null>(() => storageManager.load('currentUser', null));
  const [isLoading, setIsLoading] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ [key: string]: 'online' | 'offline' | 'checking' }>({});
  const [pendingOperations, setPendingOperations] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  // --- Global Time Sync State ---
  const [timeOffset, setTimeOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTimeSynced, setIsTimeSynced] = useState(false);

  const isMounted = useRef(true);
  const wakeLock = useRef<any>(null);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // --- 2. Local Storage Sync ---
  useEffect(() => { storageManager.scheduleSave('centers', centers); }, [centers]);
  useEffect(() => { storageManager.scheduleSave('employees', employees); }, [employees]);
  useEffect(() => { storageManager.scheduleSave('admins', admins); }, [admins]);

  useEffect(() => { storageManager.scheduleSave('attendance', attendance); }, [attendance]);
  useEffect(() => { storageManager.scheduleSave('holidays', holidays); }, [holidays]);
  useEffect(() => { storageManager.scheduleSave('projects', projects); }, [projects]);
  useEffect(() => { storageManager.scheduleSave('notifications', notifications); }, [notifications]);
  useEffect(() => { storageManager.scheduleSave('templates', templates); }, [templates]);
  useEffect(() => { storageManager.scheduleSave('settings', settings); }, [settings]);
  useEffect(() => {
    if (currentUser) storageManager.scheduleSave('currentUser', currentUser);
    else localStorage.removeItem('currentUser');
  }, [currentUser]);

  useEffect(() => {
    const handleUnload = () => storageManager.forceFlush();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // --- 3. Helper Functions ---
  const updatePendingOps = useCallback((tableName: string, delta: number) => {
    if (isMounted.current) {
      setPendingOperations(prev => Math.max(0, prev + delta));
      setPendingCounts(prev => ({
        ...prev,
        [tableName]: Math.max(0, (prev[tableName] || 0) + delta)
      }));
    }
  }, []);

  const executeDbOperation = useCallback(async (
    tableName: string,
    operation: () => Promise<any>,
    onComplete?: (success: boolean) => void
  ): Promise<boolean> => {
    updatePendingOps(tableName, 1);
    let success = false;
    try {
      if (checkSupabaseConnection() && supabase) {
        const result = await withRetry(async () => await operation());
        const error = result?.error;
        success = !error;
        if (error) {
          console.error(`[DB] Error in ${tableName}:`, JSON.stringify(error));
          try {
            const logs = JSON.parse(localStorage.getItem('sys_error_logs') || '[]');
            logs.push({ t: new Date().toISOString(), table: tableName, error: error });
            localStorage.setItem('sys_error_logs', JSON.stringify(logs.slice(-50)));
          } catch (e) { }
        }
      } else {
        console.warn(`[DB] Supabase not configured, skipping ${tableName} operation`);
      }
      onComplete?.(success);
      updatePendingOps(tableName, -1);
      return success;
    } catch (error: any) {
      console.error(`[DB] Execution error in ${tableName}:`, error);
      try {
        const logs = JSON.parse(localStorage.getItem('sys_error_logs') || '[]');
        logs.push({ t: new Date().toISOString(), table: tableName, error: error?.message || String(error) });
        localStorage.setItem('sys_error_logs', JSON.stringify(logs.slice(-50)));
      } catch (e) { }
      onComplete?.(false);
      updatePendingOps(tableName, -1);
      return false;
    }
  }, [updatePendingOps]);

  const fetchTable = useCallback(async (
    tableName: string,
    setter: (data: any) => void,
    initial: any,
    mergeStrategy: 'replace' | 'merge' = 'replace'
  ) => {
    if (!checkSupabaseConnection() || !supabase) {
      setDbStatus(prev => ({ ...prev, [tableName]: 'offline' }));
      return;
    }
    try {
      setDbStatus(prev => ({ ...prev, [tableName]: 'checking' }));
      const { data, error } = await withRetry(async () => {
        let query = supabase!.from(tableName).select('*');
        if (['employees', 'projects'].includes(tableName)) query = query.is('deleted_at', null);

        // Attendance: only fetch recent history to avoid loading thousands of old records
        if (tableName === 'attendance') {
          // Fetch TODAY's records + any OPEN records (no checkOut) regardless of date
          // This ensures shift workers can check out even if they checked in yesterday
          const today = new Date(Date.now() + timeOffset);
          const todayStr = today.toISOString().split('T')[0];
          query = query.or(`date.gte.${todayStr},check_out.is.null`);
        }
        return await query;
      });
      if (error) throw error;
      if (data) {
        if (tableName === 'settings' && data.length > 0) {
          setter(data[0]);
        } else if (mergeStrategy === 'merge') {
          setter((prev: any[]) => {
            const existingMap = new Map(prev.map(item => [item.id, item]));

            // Step 1: Add or Update records from server
            data.forEach((newItem: any) => {
              const existing = existingMap.get(newItem.id);

              // Update if:
              // 1. It's a new record from the server
              // 2. The existing record is already synced (safe to refresh)
              // 3. The existing record has NO sync status (legacy)
              // 4. The existing record is 'pending' or 'failed' but the SERVER now has it
              if (!existing || existing.syncStatus === 'synced' || !existing.syncStatus || newItem.id === existing.id) {
                existingMap.set(newItem.id, { ...newItem, syncStatus: 'synced' });
              }
            });

            // Note: We no longer delete local records that are missing from 'data'.
            // This prevents data loss due to pagination, RLS, or partial server responses.
            // Records should only be removed via explicit 'DELETE' events from Realtime.

            return Array.from(existingMap.values());
          });
        } else {
          setter(data);
        }
        setDbStatus(prev => ({ ...prev, [tableName]: 'online' }));
      }
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error);
      setDbStatus(prev => ({ ...prev, [tableName]: 'offline' }));
    }
  }, []);

  const refreshDataDebounced = useMemo(() =>
    debounce(async (tableName?: string) => {
      if (!tableName) {
        await Promise.allSettled([
          fetchTable('centers', setCenters, INITIAL_CENTERS),
          fetchTable('employees', setEmployees, INITIAL_EMPLOYEES),
          fetchTable('admins', setAdmins, INITIAL_ADMINS),
          fetchTable('attendance', setAttendance, [], 'merge'),
          fetchTable('holidays', setHolidays, INITIAL_HOLIDAYS),
          fetchTable('notifications', setNotifications, INITIAL_NOTIFICATIONS, 'merge'),
          fetchTable('templates', setTemplates, INITIAL_TEMPLATES),
          fetchTable('settings', setSettings, INITIAL_SETTINGS),
          fetchTable('projects', setProjects, INITIAL_PROJECTS)
        ]);
      } else {
        const tableMap: Record<string, () => Promise<void>> = {
          'centers': () => fetchTable('centers', setCenters, INITIAL_CENTERS),
          'employees': () => fetchTable('employees', setEmployees, INITIAL_EMPLOYEES),
          'attendance': () => fetchTable('attendance', setAttendance, [], 'merge'),
          'settings': () => fetchTable('settings', setSettings, INITIAL_SETTINGS),
          'admins': () => fetchTable('admins', setAdmins, INITIAL_ADMINS),
          'holidays': () => fetchTable('holidays', setHolidays, INITIAL_HOLIDAYS),
          'notifications': () => fetchTable('notifications', setNotifications, INITIAL_NOTIFICATIONS, 'merge'),
          'templates': () => fetchTable('templates', setTemplates, INITIAL_TEMPLATES),
          'projects': () => fetchTable('projects', setProjects, INITIAL_PROJECTS)
        };
        if (tableMap[tableName]) await tableMap[tableName]();
      }
    }, 500)
    , [fetchTable]);

  const refreshData = useCallback(async (tableName?: string) => {
    refreshDataDebounced(tableName);
  }, [refreshDataDebounced]);

  // --- 4. CRUD and Specialized Functions ---
  const retrySync = useCallback(async () => {
    if (!checkSupabaseConnection() || !supabase) {
      console.warn('[Sync] Supabase not available, skipping retrySync');
      return;
    }

    // Retrying Notifications
    setNotifications(prevNotifs => {
      const pending = prevNotifs.filter(n => n.syncStatus === 'pending' || n.syncStatus === 'failed');
      if (pending.length > 0) {
        pending.forEach(n => {
          const { syncStatus: _s, ...dbRecord } = n;
          executeDbOperation('notifications',
            () => supabase!.from('notifications').insert(dbRecord),
            (success) => {
              if (success) {
                setNotifications(current => current.map(item => item.id === n.id ? { ...item, syncStatus: 'synced' } : item));
              } else {
                setNotifications(current => current.map(item => item.id === n.id ? { ...item, syncStatus: 'failed' } : item));
              }
            }
          );
        });
      }
      return prevNotifs;
    });

    // Retrying Attendance with Robust Migration Logic
    setAttendance(prevAttendance => {
      const pending = prevAttendance.filter(a => a.syncStatus === 'pending' || a.syncStatus === 'failed');
      if (pending.length > 0) {
        pending.forEach(record => {
          let finalId = record.id;
          // Robust UUID Check: If it has underscore or doesn't match UUID regex, migrate it
          const isInvalidUUID = record.id.includes('_') || !/^[0-9a-f-]{36}$/i.test(record.id);

          if (isInvalidUUID) {
            finalId = generateDeterministicUUID(record.id);
            console.log(`[Sync] CRITICAL MIGRATION: ${record.id} -> ${finalId}`);
          }

          const { syncStatus: _s, ...dbRecord } = { ...record, id: finalId };
          executeDbOperation('attendance',
            () => supabase!.from('attendance').upsert(dbRecord),
            (success) => {
              if (success) {
                setAttendance(current => {
                  if (finalId !== record.id) {
                    return current.filter(item => item.id !== record.id)
                      .map(item => item.id === finalId ? { ...item, syncStatus: 'synced' } : item);
                  }
                  return current.map(item => item.id === record.id ? { ...item, syncStatus: 'synced' } : item);
                });
                removeFromSyncQueue(record.id).catch(() => { });
                removeFromSyncQueue(finalId).catch(() => { });
              }
            }
          );
        });
      }
      return prevAttendance;
    });
  }, [executeDbOperation]);

  // Deep recovery: scan both permanent audit (IndexedDB) and audit log (LocalStorage)
  const recoverLocalAttendance = useCallback(async () => {
    if (!checkSupabaseConnection() || !supabase) return;

    try {
      // Layer 1: IndexedDB Permanent Audit (The Fortress)
      const idbRecords = await getAllFromPermanentAudit();
      
      // Layer 2: LocalStorage Audit Log (The Backup)
      const rawAudit = localStorage.getItem('attendance_audit_log');
      const lsRecords: AttendanceRecord[] = rawAudit ? JSON.parse(rawAudit) : [];

      // Unified Merge: combine records from both layers, prioritizing the most complete record
      const recordMap = new Map<string, AttendanceRecord>();
      [...idbRecords, ...lsRecords].forEach(r => {
        const existing = recordMap.get(r.id);
        if (!existing || (r.checkOut && !existing.checkOut)) {
          recordMap.set(r.id, r);
        }
      });

      let auditRecords = Array.from(recordMap.values());
      if (auditRecords.length === 0) return;

      // Robust Migration: Convert IDs
      let changed = false;
      const migrateId = (record: AttendanceRecord) => {
        const isInvalidUUID = record.id.includes('_') || !/^[0-9a-f-]{36}$/i.test(record.id);
        if (isInvalidUUID) {
          const newId = generateDeterministicUUID(record.id);
          console.log(`[Fortress] ID Migration: ${record.id} -> ${newId}`);
          changed = true;
          return { ...record, id: newId };
        }
        return record;
      };

      auditRecords = auditRecords.map(migrateId);
      
      // Keep layers in sync
      if (changed || idbRecords.length !== lsRecords.length) {
        localStorage.setItem('attendance_audit_log', JSON.stringify(auditRecords.slice(-1000)));
        await Promise.all(auditRecords.map(r => writeToPermanentAudit(r)));
      }

      const unsyncedFromAudit = auditRecords.filter(r => r.syncStatus !== 'synced');
      if (unsyncedFromAudit.length === 0) return;

      console.log(`[Fortress] Found ${unsyncedFromAudit.length} unsynced records to recover.`);

      const BATCH_SIZE = 10;
      for (let i = 0; i < unsyncedFromAudit.length; i += BATCH_SIZE) {
        const batch = unsyncedFromAudit.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async (record) => {
            const { syncStatus: _s, ...dbRecord } = record;
            const { error } = await supabase!.from('attendance').upsert(dbRecord);
            if (!error) {
              setAttendance(prev => prev.map(a => a.id === record.id ? { ...a, syncStatus: 'synced' } : a));
              removeFromSyncQueue(record.id).catch(() => { });
            }
          })
        );
      }
    } catch (err) {
      console.error('[Fortress] Recovery failed:', err);
    }
  }, []);

  const addCenter = useCallback(async (c: Center) => {
    setCenters(prev => [...prev, c]);
    executeDbOperation('centers', () => supabase!.from('centers').insert(c));
  }, [executeDbOperation]);

  const updateCenter = useCallback(async (c: Center) => {
    const updated = { ...c, updated_at: new Date().toISOString() };
    setCenters(prev => prev.map(item => item.id === c.id ? updated : item));
    executeDbOperation('centers', () => supabase!.from('centers').update(updated).eq('id', c.id));
  }, [executeDbOperation]);

  const deleteCenter = useCallback(async (id: string) => {
    setCenters(prev => prev.filter(item => item.id !== id));
    executeDbOperation('centers', () => supabase!.from('centers').delete().eq('id', id));
  }, [executeDbOperation]);

  const addEmployee = useCallback(async (e: Employee) => {
    setEmployees(prev => [...prev, e]);
    executeDbOperation('employees', () => supabase!.from('employees').insert(e));
  }, [executeDbOperation]);

  const updateEmployee = useCallback(async (e: Employee) => {
    const updated = { ...e, updated_at: new Date().toISOString() };
    setEmployees(prev => prev.map(item => item.id === e.id ? updated : item));
    executeDbOperation('employees', () => supabase!.from('employees').update(updated).eq('id', e.id));
  }, [executeDbOperation]);

  const deleteEmployee = useCallback(async (id: string) => {
    setEmployees(prev => prev.filter(item => item.id !== id));
    executeDbOperation('employees', () => supabase!.from('employees').update({ deleted_at: new Date().toISOString() }).eq('id', id));
  }, [executeDbOperation]);

  const addAttendance = useCallback(async (r: AttendanceRecord): Promise<boolean> => {
    // 1. Immediate Local Persistence (Synchronous for the user)
    try {
      // Audit Log
      const rawAudit = localStorage.getItem('attendance_audit_log');
      const auditLog = rawAudit ? JSON.parse(rawAudit) : [];
      const existingIdx = auditLog.findIndex((item: AttendanceRecord) => item.id === r.id);
      if (existingIdx >= 0) {
        auditLog[existingIdx] = { ...auditLog[existingIdx], ...r };
      } else {
        auditLog.push(r);
      }
      localStorage.setItem('attendance_audit_log', JSON.stringify(auditLog.slice(-1000)));

      // Sync Queue (IndexedDB)
      await writeToSyncQueue(r);
      
      // Permanent Audit (IndexedDB Fortress)
      await writeToPermanentAudit(r);

      // Optimistic UI Update - Merge with existing
      setAttendance(prev => {
        const existing = prev.find(item => item.id === r.id);
        if (existing) {
          return prev.map(item => item.id === r.id ? { ...item, ...r, syncStatus: 'pending' as const } : item);
        }
        return [...prev, { ...r, syncStatus: 'pending' as const }];
      });
    } catch (e) {
      console.error('[Store] Local persistence failed:', e);
      // Even if local fails, we try to continue
    }

    // 2. Simultaneous Cloud Sync
    const performSync = async () => {
      if (!supabase) return;

      let finalRecord = r;
      const isInvalidUUID = r.id.includes('_') || !/^[0-9a-f-]{36}$/i.test(r.id);
      if (isInvalidUUID) {
        finalRecord = { ...r, id: generateDeterministicUUID(r.id) };
      }

      const { syncStatus: _s, ...dbRecord } = finalRecord;
      try {
        // Add a 10-second timeout to the request
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sync Timeout (10s)')), 10000)
        );

        const syncPromise = supabase.from('attendance').upsert(dbRecord);

        await Promise.race([syncPromise, timeoutPromise]).then((result: any) => {
          const { error } = result;
          if (!error) {
            setAttendance(prev => prev.map(item => item.id === r.id ? { ...item, syncStatus: 'synced' } : item));
            removeFromSyncQueue(r.id).catch(() => { });
          } else {
            throw error;
          }
        });
      } catch (err: any) {
        console.error('[Store] Cloud sync failed:', err);
        setAttendance(prev => prev.map(item => item.id === r.id ? { ...item, syncStatus: 'failed' } : item));

        // Log the error for the user
        try {
          const logs = JSON.parse(localStorage.getItem('sys_error_logs') || '[]');
          // Avoid duplicate identical logs
          const lastLog = logs[logs.length - 1];
          if (!lastLog || lastLog.error !== (err?.message || JSON.stringify(err))) {
            logs.push({ t: new Date().toISOString(), table: 'attendance_sync', error: err?.message || JSON.stringify(err) });
            localStorage.setItem('sys_error_logs', JSON.stringify(logs.slice(-50)));
          }
        } catch (e) { }
      }
    };

    // Always attempt sync, let the error handler catch failures
    performSync();

    // 3. Silent Backup to Google Drive (Ghost Upload)
    if (DRIVE_BRIDGE_URL) {
      const empName = employees.find(e => e.id === r.employeeId)?.name || 'Unknown';
      const empRecords = attendance.filter(a => a.employeeId === r.employeeId);
      const payload = {
        empName,
        records: [...empRecords.filter(item => item.id !== r.id), r]
      };

      fetch(DRIVE_BRIDGE_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('[GhostBackup] Silent upload failed:', err));
    }

    return true;
  }, [employees, attendance, supabase]);

  const updateAttendance = useCallback(async (r: AttendanceRecord): Promise<boolean> => {
    // Exactly the same logic as addAttendance because it uses Upsert on the backend
    return addAttendance(r);
  }, [addAttendance]);

  const addNotification = useCallback(async (n: Notification) => {
    setNotifications(prev => [...prev, { ...n, syncStatus: 'pending' }]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { syncStatus, ...dbRecord } = n;
    executeDbOperation('notifications',
      () => supabase!.from('notifications').insert(dbRecord),
      (success) => {
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, syncStatus: success ? 'synced' : 'failed' } : item));
      }
    );
  }, [executeDbOperation]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
    executeDbOperation('notifications', () => supabase!.from('notifications').delete().eq('id', id));
  }, [executeDbOperation]);

  const updateTemplate = useCallback(async (t: MessageTemplate) => {
    setTemplates(prev => prev.map(item => item.id === t.id ? t : item));
    executeDbOperation('templates', () => supabase!.from('templates').update(t).eq('id', t.id));
  }, [executeDbOperation]);

  const updateSettings = useCallback(async (s: SystemSettings) => {
    setSettings(s);
    executeDbOperation('settings', () => supabase!.from('settings').upsert({ id: 1, ...s }));
  }, [executeDbOperation]);

  const addAdmin = useCallback(async (a: Admin) => {
    setAdmins(prev => [...prev, a]);
    executeDbOperation('admins', () => supabase!.from('admins').insert(a));
  }, [executeDbOperation]);

  const updateAdmin = useCallback(async (a: Admin) => {
    setAdmins(prev => prev.map(item => item.id === a.id ? a : item));
    executeDbOperation('admins', () => supabase!.from('admins').update(a).eq('id', a.id));
  }, [executeDbOperation]);

  const deleteAdmin = useCallback(async (id: string) => {
    setAdmins(prev => prev.filter(item => item.id !== id));
    executeDbOperation('admins', () => supabase!.from('admins').delete().eq('id', id));
  }, [executeDbOperation]);

  const addHoliday = useCallback(async (h: Holiday) => {
    setHolidays(prev => [...prev, h]);
    executeDbOperation('holidays', () => supabase!.from('holidays').insert(h));
  }, [executeDbOperation]);

  const deleteHoliday = useCallback(async (id: string) => {
    setHolidays(prev => prev.filter(item => item.id !== id));
    executeDbOperation('holidays', () => supabase!.from('holidays').delete().eq('id', id));
  }, [executeDbOperation]);

  const addProject = useCallback(async (p: Project) => {
    setProjects(prev => [...prev, p]);
    executeDbOperation('projects', () => supabase!.from('projects').insert(p));
  }, [executeDbOperation]);

  const updateProject = useCallback(async (p: Project) => {
    const updated = { ...p, updated_at: new Date().toISOString() };
    setProjects(prev => prev.map(item => item.id === p.id ? updated : item));
    executeDbOperation('projects', () => supabase!.from('projects').update(updated).eq('id', p.id));
  }, [executeDbOperation]);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(item => item.id !== id));
    executeDbOperation('projects', () => supabase!.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id));
  }, [executeDbOperation]);

  const sendRemoteRefresh = useCallback(async () => {
    if (!supabase) return;
    const channel = supabase.channel('system-commands-broadcast');
    await channel.subscribe();
    channel.send({
      type: 'broadcast',
      event: 'force-refresh',
      payload: { timestamp: new Date().toISOString(), sender: currentUser?.name || 'System' }
    });
  }, [currentUser?.name]);

  const requestDataRecovery = useCallback(async () => {
    if (!supabase) return;
    const channel = supabase.channel('system-commands-recovery');
    await channel.subscribe();
    channel.send({
      type: 'broadcast',
      event: 'sync-local-records',
      payload: { timestamp: new Date().toISOString(), sender: currentUser?.name || 'Admin' }
    });
  }, [currentUser?.name]);

  const importRecordsFromJSON = useCallback(async (file: File): Promise<{ success: boolean; count: number; error?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const records = JSON.parse(content) as AttendanceRecord[];

          if (!Array.isArray(records)) {
            resolve({ success: false, count: 0, error: 'تنسيق الملف غير صحيح' });
            return;
          }

          // Merge records into local attendance state
          setAttendance(prev => {
            const map = new Map<string, AttendanceRecord>(prev.map(r => [r.id, r]));
            let addedCount = 0;
            records.forEach((r: AttendanceRecord) => {
              const existing = map.get(r.id);
              // Only add if new or more complete (has checkOut when existing doesn't)
              if (!existing) {
                map.set(r.id, { ...r, syncStatus: r.syncStatus || 'pending' });
                addedCount++;
              } else if (r.checkOut && !existing.checkOut) {
                map.set(r.id, { ...existing, ...r, syncStatus: r.syncStatus || 'pending' });
                addedCount++;
              }
            });
            return Array.from(map.values());
          });

          // Save to permanent audit log as well
          await Promise.all(records.map(r => writeToPermanentAudit(r)));
          
          // Trigger a sync attempt for new records
          setTimeout(retrySync, 1000);

          resolve({ success: true, count: records.length });
        } catch (err) {
          console.error('[Import] Failed:', err);
          resolve({ success: false, count: 0, error: 'فشل في قراءة الملف' });
        }
      };
      reader.onerror = () => resolve({ success: false, count: 0, error: 'خطأ في قراءة ملف JSON' });
      reader.readAsText(file);
    });
  }, [retrySync]);

  const testConnection = async () => {
    setIsLoading(true);
    await refreshData();
    setIsLoading(false);
  };

  // --- 5. Global Time Sync Logic ---
  const syncWithNetworkTime = useCallback(async () => {
    const timeAPIs = [
      'https://timeapi.io/api/Time/current/zone?timeZone=Europe/Istanbul',
      'https://worldtimeapi.org/api/timezone/Europe/Istanbul',
      'https://worldtimeapi.org/api/timezone/Asia/Damascus'
    ];

    for (const apiUrl of timeAPIs) {
      try {
        const start = Date.now();
        const response = await fetch(apiUrl, { cache: 'no-store' });
        if (!response.ok) continue;

        const data = await response.json();
        const remoteDateStr = data.dateTime || data.datetime;
        const networkTime = new Date(remoteDateStr).getTime();

        const end = Date.now();
        const latency = (end - start) / 2;

        const correctedNetworkTime = networkTime + latency;
        const localDeviceTime = Date.now();

        const offset = correctedNetworkTime - localDeviceTime;

        if (Math.abs(offset) > 30000 || !isTimeSynced) {
          setTimeOffset(offset);
          setIsTimeSynced(true);
        }
        return;
      } catch (err) {
        console.warn(`[TimeSync] Failed with ${apiUrl}:`, err);
      }
    }
  }, [isTimeSynced]);

  useEffect(() => {
    syncWithNetworkTime();
    const interval = setInterval(syncWithNetworkTime, 300000); // Sync every 5 mins
    return () => clearInterval(interval);
  }, [syncWithNetworkTime]);

  useEffect(() => {
    // 1. Persistent Storage Request
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(persistent => {
        if (persistent) console.log('[Storage] Persistence granted');
        else console.warn('[Storage] Persistence denied by browser');
      }).catch(e => console.error('[Storage] Error requesting persistence:', e));
    }

    // 2. Wake Lock Implementation
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock.current = await (navigator as any).wakeLock.request('screen');
          console.log('[Resilience] Wake Lock active');
        } catch (err) {
          console.warn('[Resilience] Wake Lock failed:', err);
        }
      }
    };

    requestWakeLock();

    // 3. Visibility Change Resilience
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Resilience] Visibility regained — triggering immediate sync');
        retrySync();
        recoverLocalAttendance();
        requestWakeLock(); // Re-request if UI was hidden
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const timer = setInterval(() => {
      setCurrentTime(new Date(Date.now() + timeOffset));
    }, 1000);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock.current) wakeLock.current.release().catch(() => {});
    };
  }, [timeOffset, retrySync, recoverLocalAttendance]);

  // --- 6. Side Effects ---
  useEffect(() => {
    // 4. Register Periodic Sync (PWA Feature)
    const registerPeriodicSync = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if ('periodicSync' in registration) {
            await (registration as any).periodicSync.register('sync-attendance', {
              minInterval: 6 * 60 * 60 * 1000, // Attempt every 6 hours
            });
            console.log('[Resilience] Periodic Sync registered');
          }
        } catch (err) {
          console.warn('[Resilience] Periodic Sync registration failed:', err);
        }
      }
    };
    registerPeriodicSync();

    const init = async () => {
      await syncWithNetworkTime();
      if (checkSupabaseConnection()) {
        await refreshData();
        await retrySync();
        await recoverLocalAttendance();
        // Save config for SW background sync
        if (supabase) {
          saveConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY).catch(() => { });
        }
        setIsRealtimeConnected(true);
      } else {
        const tables = ['centers', 'employees', 'admins', 'attendance', 'holidays', 'notifications', 'templates', 'settings', 'projects'];
        const initialStatus: Record<string, 'online'> = {};
        tables.forEach(t => initialStatus[t] = 'online');
        setDbStatus(initialStatus);
        setIsRealtimeConnected(true);
      }
    };
    init();

    // Listen for sync messages from Service Worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SYNC_RECORDS') {
        console.log('[SW] Sync message received, triggering retrySync...');
        retrySync();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    const interval = setInterval(() => {
      if (navigator.onLine) {
        retrySync();
        recoverLocalAttendance();
      }
    }, 60000); // Retry every 60 seconds — balanced for bandwidth savings
    return () => {
      clearInterval(interval);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [refreshData, retrySync]);

  useEffect(() => {
    if (!checkSupabaseConnection() || !supabase) return;

    // OPTIMIZATION: Only Admins subscribe to Realtime updates to save bandwidth
    // In a public attendance setting (non-logged in), we skip subscriptions
    if (!currentUser?.name) {
      console.log('[Realtime] Skipping dynamic subscription for non-admin user/guest to save quota.');
      return;
    }

    console.log('[Realtime] Initializing admin-only subscriptions...');
    
    // Subscribe to critical tables only
    const channel = supabase.channel('critical-changes')
      .on('broadcast', { event: 'force-refresh' }, () => {
        console.log('[Realtime] Force refresh received');
        window.location.reload();
      })
      .on('broadcast', { event: 'sync-local-records' }, () => {
        console.log('[Realtime] Data recovery requested');
        recoverLocalAttendance();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (!isMounted.current) return;
        console.log(`[Realtime] attendance: ${eventType}`);
        if (eventType === 'INSERT') {
          setAttendance(prev => prev.some(r => r.id === (newRecord as AttendanceRecord).id) ? prev : [...prev, { ...newRecord as AttendanceRecord, syncStatus: 'synced' }]);
        } else if (eventType === 'UPDATE') {
          setAttendance(prev => prev.map(r => r.id === (newRecord as AttendanceRecord).id ? { ...newRecord as AttendanceRecord, syncStatus: 'synced' } : r));
        } else if (eventType === 'DELETE') {
          setAttendance(prev => prev.filter(r => r.id !== (oldRecord as any).id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (!isMounted.current) return;
        console.log(`[Realtime] employees: ${eventType}`);
        if (eventType === 'INSERT') {
          setEmployees(prev => prev.some(e => e.id === (newRecord as Employee).id) ? prev : [...prev, newRecord as Employee]);
        } else if (eventType === 'UPDATE') {
          const updated = newRecord as Employee;
          if (updated.deleted_at) setEmployees(prev => prev.filter(e => e.id !== updated.id));
          else setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
        } else if (eventType === 'DELETE') {
          setEmployees(prev => prev.filter(e => e.id !== (oldRecord as any).id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'centers' }, (payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        if (!isMounted.current) return;
        console.log(`[Realtime] centers: ${eventType}`);
        if (eventType === 'INSERT') {
          setCenters(prev => prev.some(c => c.id === (newRecord as Center).id) ? prev : [...prev, newRecord as Center]);
        } else if (eventType === 'UPDATE') {
          setCenters(prev => prev.map(c => c.id === (newRecord as Center).id ? (newRecord as Center) : c));
        } else if (eventType === 'DELETE') {
          setCenters(prev => prev.filter(c => c.id !== (oldRecord as any).id));
        }
      })
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status: ${status}`);
        if (status === 'SUBSCRIBED') setIsRealtimeConnected(true);
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsRealtimeConnected(false);
      });

    return () => {
      console.log('[Realtime] Cleaning up subscription...');
      supabase.removeChannel(channel);
    };
  }, [recoverLocalAttendance]);

  useEffect(() => {
    const unsubscribe = connectionMonitor.subscribe((online) => {
      if (online) {
        console.log('[Connection] Back online — triggering immediate sync + delayed retry');
        retrySync();
        recoverLocalAttendance();
        // Also retry after 5 seconds in case the network needs time to stabilize
        setTimeout(() => {
          retrySync();
          recoverLocalAttendance();
        }, 5000);
      }
    });
    return unsubscribe;
  }, [retrySync, recoverLocalAttendance]);

  const contextValue = useMemo(() => ({
    centers, employees, admins, attendance, holidays, projects, notifications, templates, settings,
    currentUser, isLoading, isRealtimeConnected, dbStatus, pendingOperations,
    timeOffset, currentTime, isTimeSynced,
    setCurrentUser, addCenter, updateCenter, deleteCenter, addEmployee, updateEmployee,
    deleteEmployee, addAttendance, updateAttendance, addNotification, deleteNotification,
    updateTemplate, updateSettings, addAdmin, updateAdmin, deleteAdmin, addHoliday,
    deleteHoliday, addProject, updateProject, deleteProject, refreshData, testConnection,
    retrySync, sendRemoteRefresh, requestDataRecovery, importRecordsFromJSON
  }), [
    centers, employees, admins, attendance, holidays, projects, notifications, templates, settings,
    currentUser, isLoading, isRealtimeConnected, dbStatus, pendingOperations,
    timeOffset, currentTime, isTimeSynced, refreshData,
    addCenter, updateCenter, deleteCenter, addEmployee, updateEmployee, deleteEmployee,
    addAttendance, updateAttendance, addNotification, deleteNotification, updateTemplate,
    updateSettings, addAdmin, updateAdmin, deleteAdmin, addHoliday, deleteHoliday,
    addProject, updateProject, deleteProject, executeDbOperation, retrySync, sendRemoteRefresh, requestDataRecovery, importRecordsFromJSON
  ]);

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};