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
  addAttendance: (record: AttendanceRecord) => Promise<void>;
  updateAttendance: (record: AttendanceRecord) => Promise<void>;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State initialization with localStorage fallback
  const [centers, setCenters] = useState<Center[]>(() => storageManager.load('centers', INITIAL_CENTERS));
  const [employees, setEmployees] = useState<Employee[]>(() => storageManager.load('employees', INITIAL_EMPLOYEES));
  const [admins, setAdmins] = useState<Admin[]>(() => storageManager.load('admins', INITIAL_ADMINS));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => storageManager.load('attendance', []));
  const [holidays, setHolidays] = useState<Holiday[]>(() => storageManager.load('holidays', INITIAL_HOLIDAYS));
  const [projects, setProjects] = useState<Project[]>(() => storageManager.load('projects', INITIAL_PROJECTS));
  const [notifications, setNotifications] = useState<Notification[]>(() => storageManager.load('notifications', INITIAL_NOTIFICATIONS));
  const [templates, setTemplates] = useState<MessageTemplate[]>(() => storageManager.load('templates', INITIAL_TEMPLATES));
  const [settings, setSettings] = useState<SystemSettings>(() => storageManager.load('settings', INITIAL_SETTINGS));

  // Auth Persistence
  const [currentUser, setCurrentUser] = useState<Admin | null>(() => storageManager.load('currentUser', null));
  const [isLoading, setIsLoading] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ [key: string]: 'online' | 'offline' | 'checking' }>({});
  const [pendingOperations, setPendingOperations] = useState(0);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  // Track if component is mounted to prevent memory leaks
  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // Debounced localStorage saves - saves are batched to reduce writes
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

  // Force save on page unload
  useEffect(() => {
    const handleUnload = () => storageManager.forceFlush();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // Optimized fetch from Supabase
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
        // Filter out soft deleted items for relevant tables
        if (['employees', 'projects'].includes(tableName)) {
          query = query.is('deleted_at', null);
        }
        return await query;
      });

      if (error) throw error;

      if (data) {
        // Special case for settings which is a single object
        if (tableName === 'settings' && data.length > 0) {
          setter(data[0]);
        } else if (mergeStrategy === 'merge') {
          setter((prev: any[]) => {
            // Create a map of existing items for quick lookup
            const existingMap = new Map(prev.map(item => [item.id, item]));

            // Update with new data from server
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

  // Stabilize refresh functions by removing state dependencies
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
          fetchTable('settings', setSettings, INITIAL_SETTINGS)
        ]);
      } else {
        const fetchTableMap: Record<string, () => Promise<void>> = {
          'centers': () => fetchTable('centers', setCenters, INITIAL_CENTERS),
          'employees': () => fetchTable('employees', setEmployees, INITIAL_EMPLOYEES),
          'attendance': () => fetchTable('attendance', setAttendance, [], 'merge'),
          'settings': () => fetchTable('settings', setSettings, INITIAL_SETTINGS),
          'admins': () => fetchTable('admins', setAdmins, INITIAL_ADMINS),
          'holidays': () => fetchTable('holidays', setHolidays, INITIAL_HOLIDAYS),
          'notifications': () => fetchTable('notifications', setNotifications, INITIAL_NOTIFICATIONS, 'merge'),
          'templates': () => fetchTable('templates', setTemplates, INITIAL_TEMPLATES),
        };
        if (fetchTableMap[tableName]) await fetchTableMap[tableName]();
      }
    }, 500)
    , [fetchTable]);

  const refreshData = useCallback(async (tableName?: string) => {
    refreshDataDebounced(tableName);
  }, [refreshDataDebounced]);

  const testConnection = async () => {
    setIsLoading(true);
    await refreshData();
    setIsLoading(false);
  };

  // Initial data loading and connection setup
  useEffect(() => {
    const init = async () => {
      if (checkSupabaseConnection()) {
        await refreshData();
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
  }, [refreshData]);

  // Real-time synchronization
  useEffect(() => {
    if (!checkSupabaseConnection() || !supabase) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'broadcast',
        { event: 'force-refresh' },
        () => {
          console.log('Remote refresh command received');
          window.location.reload();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
        },
        (payload) => {
          const { table, eventType, new: newRecord, old: oldRecord } = payload;

          if (!isMounted.current) return;

          switch (table) {
            case 'attendance':
              if (eventType === 'INSERT') {
                setAttendance(prev => {
                  if (prev.some(r => r.id === (newRecord as AttendanceRecord).id)) return prev;
                  return [...prev, { ...newRecord as AttendanceRecord, syncStatus: 'synced' }];
                });
              } else if (eventType === 'UPDATE') {
                setAttendance(prev => prev.map(r => r.id === (newRecord as AttendanceRecord).id ? { ...newRecord as AttendanceRecord, syncStatus: 'synced' } : r));
              } else if (eventType === 'DELETE') {
                setAttendance(prev => prev.filter(r => r.id === (oldRecord as any).id));
              }
              break;

            case 'employees':
              if (eventType === 'INSERT') {
                setEmployees(prev => {
                  if (prev.some(e => e.id === (newRecord as Employee).id)) return prev;
                  return [...prev, newRecord as Employee];
                });
              } else if (eventType === 'UPDATE') {
                const updated = newRecord as Employee;
                if (updated.deleted_at) {
                  setEmployees(prev => prev.filter(e => e.id !== updated.id));
                } else {
                  setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
                }
              } else if (eventType === 'DELETE') {
                setEmployees(prev => prev.filter(e => e.id !== (oldRecord as any).id));
              }
              break;

            case 'projects':
              if (eventType === 'INSERT') {
                setProjects(prev => {
                  if (prev.some(p => p.id === (newRecord as Project).id)) return prev;
                  return [...prev, newRecord as Project];
                });
              } else if (eventType === 'UPDATE') {
                const updated = newRecord as Project;
                if (updated.deleted_at) {
                  setProjects(prev => prev.filter(p => p.id !== updated.id));
                } else {
                  setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
                }
              } else if (eventType === 'DELETE') {
                setProjects(prev => prev.filter(p => p.id !== (oldRecord as any).id));
              }
              break;

            case 'centers':
              if (eventType === 'INSERT') {
                setCenters(prev => {
                  if (prev.some(c => c.id === (newRecord as Center).id)) return prev;
                  return [...prev, newRecord as Center];
                });
              } else if (eventType === 'UPDATE') {
                setCenters(prev => prev.map(c => c.id === (newRecord as Center).id ? (newRecord as Center) : c));
              } else if (eventType === 'DELETE') {
                setCenters(prev => prev.filter(c => c.id !== (oldRecord as any).id));
              }
              break;

            case 'admins':
              if (eventType === 'INSERT') {
                setAdmins(prev => {
                  if (prev.some(a => a.id === (newRecord as Admin).id)) return prev;
                  return [...prev, newRecord as Admin];
                });
              } else if (eventType === 'UPDATE') {
                setAdmins(prev => prev.map(a => a.id === (newRecord as Admin).id ? (newRecord as Admin) : a));
              } else if (eventType === 'DELETE') {
                setAdmins(prev => prev.filter(a => a.id !== (oldRecord as any).id));
              }
              break;

            case 'holidays':
              if (eventType === 'INSERT') {
                setHolidays(prev => {
                  if (prev.some(h => h.id === (newRecord as Holiday).id)) return prev;
                  return [...prev, newRecord as Holiday];
                });
              } else if (eventType === 'DELETE') {
                setHolidays(prev => prev.filter(h => h.id !== (oldRecord as any).id));
              }
              break;

            case 'settings':
              if (eventType === 'UPDATE' || eventType === 'INSERT') {
                setSettings(newRecord as SystemSettings);
              }
              break;

            case 'notifications':
              if (eventType === 'INSERT') {
                setNotifications(prev => {
                  if (prev.some(n => n.id === (newRecord as Notification).id)) return prev;
                  return [...prev, { ...newRecord as Notification, syncStatus: 'synced' }];
                });
              } else if (eventType === 'DELETE') {
                setNotifications(prev => prev.filter(n => n.id !== (oldRecord as any).id));
              }
              break;

            case 'templates':
              if (eventType === 'UPDATE' || eventType === 'INSERT') {
                setTemplates(prev => {
                  const updated = newRecord as MessageTemplate;
                  if (prev.some(t => t.id === updated.id)) {
                    return prev.map(t => t.id === updated.id ? updated : t);
                  }
                  return [...prev, updated];
                });
              }
              break;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime subscription established successfully');
          setIsRealtimeConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.log('Realtime subscription lost, status:', status);
          setIsRealtimeConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Track pending operations
  const updatePendingOps = useCallback((tableName: string, delta: number) => {
    if (isMounted.current) {
      setPendingOperations(prev => Math.max(0, prev + delta));
      setPendingCounts(prev => ({
        ...prev,
        [tableName]: Math.max(0, (prev[tableName] || 0) + delta)
      }));
    }
  }, []);

  // Optimized database operations (Mocked for Local-Only mode)
  const executeDbOperation = useCallback(async <T,>(
    tableName: string,
    operation: () => Promise<any>,
    onComplete?: (success: boolean) => void
  ): Promise<void> => {
    updatePendingOps(tableName, 1);
    let success = false;

    try {
      if (checkSupabaseConnection() && supabase) {
        const { error } = await withRetry(async () => await operation());
        if (error) {
          console.error(`Database error in ${tableName}:`, error);
          success = false;
        } else {
          success = true;
        }
      } else {
        // If no connection, we consider it a "local success" but pending sync
        success = false;
      }

      onComplete?.(success);
      updatePendingOps(tableName, -1);
    } catch (error) {
      console.error(`Execution error in ${tableName}:`, error);
      onComplete?.(false);
      updatePendingOps(tableName, -1);
    }
  }, [updatePendingOps]);

  // Centers CRUD with optimistic updates
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
    // Centers don't have soft delete in current requirements, but keep it clean
    executeDbOperation('centers', () => supabase!.from('centers').delete().eq('id', id));
  }, [executeDbOperation]);

  // Employees CRUD with optimistic updates
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

  // Attendance CRUD with optimistic updates
  const addAttendance = useCallback(async (r: AttendanceRecord) => {
    const record = { ...r, syncStatus: 'pending' as const };
    setAttendance(prev => [...prev, record]);

    // إزالة الحقل المحلي قبل الإرسال لقاعدة البيانات
    const { syncStatus, ...dbRecord } = r;

    executeDbOperation('attendance',
      () => supabase!.from('attendance').insert(dbRecord),
      (success) => {
        if (success) {
          setAttendance(prev => prev.map(item => item.id === r.id ? { ...item, syncStatus: 'synced' } : item));
        } else {
          setAttendance(prev => prev.map(item => item.id === r.id ? { ...item, syncStatus: 'failed' } : item));
        }
      }
    );
  }, [executeDbOperation]);

  const updateAttendance = useCallback(async (r: AttendanceRecord) => {
    const record = { ...r, syncStatus: 'pending' as const };
    setAttendance(prev => prev.map(item => item.id === r.id ? record : item));

    // إزالة الحقل المحلي قبل الإرسال لقاعدة البيانات
    const { syncStatus, ...dbRecord } = r;

    executeDbOperation('attendance',
      () => supabase!.from('attendance').update(dbRecord).eq('id', r.id),
      (success) => {
        if (success) {
          setAttendance(prev => prev.map(item => item.id === r.id ? { ...item, syncStatus: 'synced' } : item));
        } else {
          setAttendance(prev => prev.map(item => item.id === r.id ? { ...item, syncStatus: 'failed' } : item));
        }
      }
    );
  }, [executeDbOperation]);

  // Notifications CRUD
  const addNotification = useCallback(async (n: Notification) => {
    const record = { ...n, syncStatus: 'pending' as const };
    setNotifications(prev => [...prev, record]);

    // إزالة الحقل المحلي قبل الإرسال لقاعدة البيانات
    const { syncStatus, ...dbRecord } = n;

    executeDbOperation('notifications',
      () => supabase!.from('notifications').insert(dbRecord),
      (success) => {
        if (success) {
          setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, syncStatus: 'synced' } : item));
        } else {
          setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, syncStatus: 'failed' } : item));
        }
      }
    );
  }, [executeDbOperation]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
    executeDbOperation('notifications', () => supabase!.from('notifications').delete().eq('id', id));
  }, [executeDbOperation]);

  // Templates and Settings
  const updateTemplate = useCallback(async (t: MessageTemplate) => {
    setTemplates(prev => prev.map(item => item.id === t.id ? t : item));
    executeDbOperation('templates', () => supabase!.from('templates').update(t).eq('id', t.id));
  }, [executeDbOperation]);

  const updateSettings = useCallback(async (s: SystemSettings) => {
    setSettings(s);
    executeDbOperation('settings', () => supabase!.from('settings').upsert({ id: 1, ...s }));
  }, [executeDbOperation]);

  // Admins CRUD
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

  // Holidays CRUD
  const addHoliday = useCallback(async (h: Holiday) => {
    setHolidays(prev => [...prev, h]);
    executeDbOperation('holidays', () => supabase!.from('holidays').insert(h));
  }, [executeDbOperation]);

  const deleteHoliday = useCallback(async (id: string) => {
    setHolidays(prev => prev.filter(item => item.id !== id));
    executeDbOperation('holidays', () => supabase!.from('holidays').delete().eq('id', id));
  }, [executeDbOperation]);

  // Retry sync for pending items
  const retrySync = useCallback(async () => {
    const pending = attendance.filter(a => a.syncStatus === 'pending' || a.syncStatus === 'failed');
    if (pending.length === 0) return;

    for (const record of pending) {
      // إزالة الحقل المحلي قبل المعالجة
      const { syncStatus, ...dbRecord } = record;

      executeDbOperation('attendance',
        () => supabase!.from('attendance').upsert(dbRecord),
        (success) => {
          if (success) {
            setAttendance(prev => prev.map(item => item.id === record.id ? { ...item, syncStatus: 'synced' } : item));
          }
        }
      );
    }
  }, [attendance, executeDbOperation]);

  // Automatic retry on connection restore
  useEffect(() => {
    const unsubscribe = connectionMonitor.subscribe((online) => {
      if (online) {
        retrySync();
      }
    });
    return unsubscribe;
  }, [retrySync]);

  // Projects CRUD
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
      payload: {
        timestamp: new Date().toISOString(),
        sender: currentUser?.name || 'System'
      }
    });
  }, [currentUser]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    centers, employees, admins, attendance, holidays, projects, notifications, templates, settings,
    currentUser, isLoading, isRealtimeConnected, dbStatus, pendingOperations,
    setCurrentUser, addCenter, updateCenter, deleteCenter, addEmployee, updateEmployee,
    deleteEmployee, addAttendance, updateAttendance, addNotification, deleteNotification,
    updateTemplate, updateSettings, addAdmin, updateAdmin, deleteAdmin, addHoliday,
    deleteHoliday, addProject, updateProject, deleteProject, refreshData, testConnection,
    retrySync, sendRemoteRefresh
  }), [
    centers, employees, admins, attendance, holidays, projects, notifications, templates, settings,
    currentUser, isLoading, isRealtimeConnected, dbStatus, pendingOperations, refreshData,
    addCenter, updateCenter, deleteCenter, addEmployee, updateEmployee, deleteEmployee,
    addAttendance, updateAttendance, addNotification, deleteNotification, updateTemplate,
    updateSettings, addAdmin, updateAdmin, deleteAdmin, addHoliday, deleteHoliday,
    addProject, updateProject, deleteProject, executeDbOperation, sendRemoteRefresh
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};