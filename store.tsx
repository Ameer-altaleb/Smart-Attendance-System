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
  INITIAL_PROJECTS
} from './constants.tsx';
import { supabase, checkSupabaseConnection } from './lib/supabase.ts';
import { storageManager, requestQueue, withRetry, debounce, connectionMonitor } from './utils/performance.ts';

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

  const isMounted = useRef(true);
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
        const { error } = await withRetry(async () => await operation());
        success = !error;
        if (error) console.error(`Database error in ${tableName}:`, error);
      }
      onComplete?.(success);
      updatePendingOps(tableName, -1);
      return success;
    } catch (error) {
      console.error(`Execution error in ${tableName}:`, error);
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
      setDbStatus(prev => ({ ...prev, [tableName]: 'online' }));
      return;
    }
    try {
      setDbStatus(prev => ({ ...prev, [tableName]: 'checking' }));
      const { data, error } = await withRetry(async () => {
        let query = supabase.from(tableName).select('*');
        if (['employees', 'projects'].includes(tableName)) query = query.is('deleted_at', null);
        // Attendance: only fetch last 60 days to avoid loading thousands of old records
        if (tableName === 'attendance') {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - 60);
          query = query.gte('date', cutoffDate.toISOString().split('T')[0]);
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
            data.forEach((newItem: any) => {
              existingMap.set(newItem.id, { ...newItem, syncStatus: 'synced' });
            });
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
    // Sync pending notifications
    const pendingNotifs = notifications.filter(n => n.syncStatus === 'pending' || n.syncStatus === 'failed');
    for (const n of pendingNotifs) {
      const { syncStatus, ...dbRecord } = n;
      executeDbOperation('notifications',
        () => supabase!.from('notifications').insert(dbRecord),
        (success) => {
          if (success) {
            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, syncStatus: 'synced' } : item));
          }
        }
      );
    }
  }, [notifications, executeDbOperation]);

  // Deep recovery: scan localStorage for old attendance records and push to DB
  const recoverLocalAttendance = useCallback(async () => {
    if (!checkSupabaseConnection() || !supabase) return;
    
    try {
      const raw = localStorage.getItem('attendance');
      if (!raw) return;
      
      const localRecords: AttendanceRecord[] = JSON.parse(raw);
      if (!Array.isArray(localRecords) || localRecords.length === 0) return;

      console.log(`[Recovery] Found ${localRecords.length} records in localStorage, scanning for unsynced...`);

      // Filter records that are not marked as synced or have no sync status
      const unsyncedRecords = localRecords.filter(
        r => !r.syncStatus || r.syncStatus !== 'synced'
      );

      if (unsyncedRecords.length === 0) {
        // All records are synced, clean up localStorage
        localStorage.removeItem('attendance');
        console.log('[Recovery] All local records already synced. Cleaned up localStorage.');
        return;
      }

      console.log(`[Recovery] Found ${unsyncedRecords.length} unsynced records. Pushing to database...`);
      let successCount = 0;

      for (const record of unsyncedRecords) {
        const { syncStatus, ...dbRecord } = record;
        try {
          const { error } = await supabase.from('attendance').upsert(dbRecord);
          if (!error) {
            successCount++;
            // Update local state with the synced record
            setAttendance(prev => {
              const exists = prev.some(a => a.id === record.id);
              if (exists) {
                return prev.map(a => a.id === record.id ? { ...record, syncStatus: 'synced' } : a);
              } else {
                return [...prev, { ...record, syncStatus: 'synced' }];
              }
            });
          } else {
            console.error(`[Recovery] Failed to sync record ${record.id}:`, error);
          }
        } catch (err) {
          console.error(`[Recovery] Error syncing record ${record.id}:`, err);
        }
      }

      console.log(`[Recovery] Successfully synced ${successCount}/${unsyncedRecords.length} records.`);

      // Clean up localStorage after recovery
      if (successCount > 0) {
        // Update localStorage to mark all recovered records as synced
        const updatedLocal = localRecords.map(r => {
          const wasSynced = unsyncedRecords.find(u => u.id === r.id);
          return wasSynced ? { ...r, syncStatus: 'synced' as const } : r;
        });
        localStorage.setItem('attendance', JSON.stringify(updatedLocal));
      }

      // If all records are now synced, remove from localStorage entirely
      if (successCount === unsyncedRecords.length) {
        localStorage.removeItem('attendance');
        console.log('[Recovery] All records synced. Cleaned up localStorage completely.');
      }
    } catch (err) {
      console.error('[Recovery] Failed to parse localStorage attendance:', err);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { syncStatus, ...dbRecord } = r;

    // Start DB operation first (direct sync)
    const success = await executeDbOperation('attendance',
      () => supabase!.from('attendance').upsert(dbRecord)
    );

    if (success) {
      setAttendance(prev => {
        const next = [...prev, { ...r, syncStatus: 'synced' }];
        return next;
      });
      return true;
    }
    
    return false;
  }, [executeDbOperation]);

  const updateAttendance = useCallback(async (r: AttendanceRecord): Promise<boolean> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { syncStatus, ...dbRecord } = r;

    // Direct sync to DB
    const success = await executeDbOperation('attendance',
      () => supabase!.from('attendance').upsert(dbRecord)
    );

    if (success) {
      setAttendance(prev => {
        const next = prev.map(item => item.id === r.id ? { ...r, syncStatus: 'synced' } : item);
        return next;
      });
      return true;
    }
    
    return false;
  }, [executeDbOperation]);

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
    const channel = supabase.channel('system-commands');
    await channel.subscribe();
    channel.send({
      type: 'broadcast',
      event: 'force-refresh',
      payload: { timestamp: new Date().toISOString(), sender: currentUser?.name || 'System' }
    });
  }, [currentUser]);

  const requestDataRecovery = useCallback(async () => {
    if (!supabase) return;
    const channel = supabase.channel('system-commands');
    await channel.subscribe();
    channel.send({
      type: 'broadcast',
      event: 'sync-local-records',
      payload: { timestamp: new Date().toISOString(), sender: currentUser?.name || 'Admin' }
    });
  }, [currentUser]);

  const testConnection = async () => {
    setIsLoading(true);
    await refreshData();
    setIsLoading(false);
  };

  // --- 5. Side Effects ---
  useEffect(() => {
    const init = async () => {
      if (checkSupabaseConnection()) {
        await refreshData();
        await retrySync();
        await recoverLocalAttendance();
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
    const interval = setInterval(() => { if (navigator.onLine) { retrySync(); recoverLocalAttendance(); } }, 300000);
    return () => clearInterval(interval);
  }, [refreshData, retrySync]);

  useEffect(() => {
    if (!checkSupabaseConnection() || !supabase) return;
    const channel = supabase.channel('schema-db-changes')
      .on('broadcast', { event: 'force-refresh' }, () => { window.location.reload(); })
      .on('broadcast', { event: 'sync-local-records' }, () => { recoverLocalAttendance(); })
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        if (!isMounted.current) return;
        switch (table) {
          case 'attendance':
            if (eventType === 'INSERT') {
              setAttendance(prev => prev.some(r => r.id === (newRecord as AttendanceRecord).id) ? prev : [...prev, { ...newRecord as AttendanceRecord, syncStatus: 'synced' }]);
            } else if (eventType === 'UPDATE') {
              setAttendance(prev => prev.map(r => r.id === (newRecord as AttendanceRecord).id ? { ...newRecord as AttendanceRecord, syncStatus: 'synced' } : r));
            } else if (eventType === 'DELETE') {
              setAttendance(prev => prev.filter(r => r.id !== (oldRecord as any).id));
            }
            break;
          case 'employees':
            if (eventType === 'INSERT') {
              setEmployees(prev => prev.some(e => e.id === (newRecord as Employee).id) ? prev : [...prev, newRecord as Employee]);
            } else if (eventType === 'UPDATE') {
              const updated = newRecord as Employee;
              if (updated.deleted_at) setEmployees(prev => prev.filter(e => e.id !== updated.id));
              else setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
            } else if (eventType === 'DELETE') {
              setEmployees(prev => prev.filter(e => e.id !== (oldRecord as any).id));
            }
            break;
          case 'projects':
            if (eventType === 'INSERT') {
              setProjects(prev => prev.some(p => p.id === (newRecord as Project).id) ? prev : [...prev, newRecord as Project]);
            } else if (eventType === 'UPDATE') {
              const updated = newRecord as Project;
              if (updated.deleted_at) setProjects(prev => prev.filter(p => p.id !== updated.id));
              else setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
            } else if (eventType === 'DELETE') {
              setProjects(prev => prev.filter(p => p.id !== (oldRecord as any).id));
            }
            break;
          case 'centers':
            if (eventType === 'INSERT') {
              setCenters(prev => prev.some(c => c.id === (newRecord as Center).id) ? prev : [...prev, newRecord as Center]);
            } else if (eventType === 'UPDATE') {
              setCenters(prev => prev.map(c => c.id === (newRecord as Center).id ? (newRecord as Center) : c));
            } else if (eventType === 'DELETE') {
              setCenters(prev => prev.filter(c => c.id !== (oldRecord as any).id));
            }
            break;
          case 'admins':
            if (eventType === 'INSERT') {
              setAdmins(prev => prev.some(a => a.id === (newRecord as Admin).id) ? prev : [...prev, newRecord as Admin]);
            } else if (eventType === 'UPDATE') {
              setAdmins(prev => prev.map(a => a.id === (newRecord as Admin).id ? (newRecord as Admin) : a));
            } else if (eventType === 'DELETE') {
              setAdmins(prev => prev.filter(a => a.id !== (oldRecord as any).id));
            }
            break;
          case 'holidays':
            if (eventType === 'INSERT') {
              setHolidays(prev => prev.some(h => h.id === (newRecord as Holiday).id) ? prev : [...prev, newRecord as Holiday]);
            } else if (eventType === 'DELETE') {
              setHolidays(prev => prev.filter(h => h.id !== (oldRecord as any).id));
            }
            break;
          case 'settings':
            if (eventType === 'UPDATE' || eventType === 'INSERT') setSettings(newRecord as SystemSettings);
            break;
          case 'notifications':
            if (eventType === 'INSERT') {
              setNotifications(prev => prev.some(n => n.id === (newRecord as Notification).id) ? prev : [...prev, { ...newRecord as Notification, syncStatus: 'synced' }]);
            } else if (eventType === 'DELETE') {
              setNotifications(prev => prev.filter(n => n.id !== (oldRecord as any).id));
            }
            break;
          case 'templates':
            if (eventType === 'UPDATE' || eventType === 'INSERT') {
              setTemplates(prev => {
                const updated = newRecord as MessageTemplate;
                return prev.some(t => t.id === updated.id) ? prev.map(t => t.id === updated.id ? updated : t) : [...prev, updated];
              });
            }
            break;
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsRealtimeConnected(true);
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsRealtimeConnected(false);
      });
    return () => { supabase.removeChannel(channel); };
  }, [retrySync]);

  useEffect(() => {
    const unsubscribe = connectionMonitor.subscribe((online) => { if (online) retrySync(); });
    return unsubscribe;
  }, [retrySync]);

  const contextValue = useMemo(() => ({
    centers, employees, admins, attendance, holidays, projects, notifications, templates, settings,
    currentUser, isLoading, isRealtimeConnected, dbStatus, pendingOperations,
    setCurrentUser, addCenter, updateCenter, deleteCenter, addEmployee, updateEmployee,
    deleteEmployee, addAttendance, updateAttendance, addNotification, deleteNotification,
    updateTemplate, updateSettings, addAdmin, updateAdmin, deleteAdmin, addHoliday,
    deleteHoliday, addProject, updateProject, deleteProject, refreshData, testConnection,
    retrySync, sendRemoteRefresh, requestDataRecovery
  }), [
    centers, employees, admins, attendance, holidays, projects, notifications, templates, settings,
    currentUser, isLoading, isRealtimeConnected, dbStatus, pendingOperations, refreshData,
    addCenter, updateCenter, deleteCenter, addEmployee, updateEmployee, deleteEmployee,
    addAttendance, updateAttendance, addNotification, deleteNotification, updateTemplate,
    updateSettings, addAdmin, updateAdmin, deleteAdmin, addHoliday, deleteHoliday,
    addProject, updateProject, deleteProject, executeDbOperation, retrySync, sendRemoteRefresh, requestDataRecovery
  ]);

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};