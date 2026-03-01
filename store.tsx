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
import { storageManager, requestQueue, withRetry, debounce } from './utils/performance.ts';

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
        if (tableName === 'settings' && data.length > 0) {
          setter(data[0]);
        } else {
          if (mergeStrategy === 'merge') {
            setter((prev: any[]) => {
              const prevItems = Array.isArray(prev) ? prev : [];
              // Logic: keep local items that are not in the server data (optimistic/unseen)
              // or items that are newer in the server
              const serverIds = new Set(data.map((item: any) => item.id));
              const localOnly = prevItems.filter(item => !serverIds.has(item.id));
              return [...data, ...localOnly];
            });
          } else {
            // For general tables, if data is empty but we are in public view,
            // we might want to avoid wiping local state if it's important (like attendance)
            if (data.length === 0 && tableName === 'attendance') {
              // Don't overwrite if we got empty response (could be RLS or connection hiccup)
              console.log('Skipping attendance overwrite with empty server response');
            } else {
              setter(data);
            }
          }
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
          fetchTable('attendance', setAttendance, [], 'merge'), // Use merge for attendance
          fetchTable('holidays', setHolidays, INITIAL_HOLIDAYS),
          fetchTable('notifications', setNotifications, INITIAL_NOTIFICATIONS),
          fetchTable('templates', setTemplates, INITIAL_TEMPLATES),
          fetchTable('settings', setSettings, INITIAL_SETTINGS),
          fetchTable('projects', setProjects, INITIAL_PROJECTS)
        ]);
      } else {
        const fetchTableMap: Record<string, () => Promise<void>> = {
          'centers': () => fetchTable('centers', setCenters, INITIAL_CENTERS),
          'employees': () => fetchTable('employees', setEmployees, INITIAL_EMPLOYEES),
          'attendance': () => fetchTable('attendance', setAttendance, [], 'merge'),
          'settings': () => fetchTable('settings', setSettings, INITIAL_SETTINGS),
          'admins': () => fetchTable('admins', setAdmins, INITIAL_ADMINS),
          'holidays': () => fetchTable('holidays', setHolidays, INITIAL_HOLIDAYS),
          'notifications': () => fetchTable('notifications', setNotifications, INITIAL_NOTIFICATIONS),
          'templates': () => fetchTable('templates', setTemplates, INITIAL_TEMPLATES),
          'projects': () => fetchTable('projects', setProjects, INITIAL_PROJECTS),
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
        const tables = ['centers', 'employees', 'admins', 'attendance', 'holidays', 'notifications', 'templates', 'settings'];
        const initialStatus: Record<string, 'online'> = {};
        tables.forEach(t => initialStatus[t] = 'online');
        setDbStatus(initialStatus);
        setIsRealtimeConnected(true);
      }
    };
    init();
  }, [refreshData]);

  // Real-time Database Subscriptions for the Entire System
  useEffect(() => {
    if (!checkSupabaseConnection() || !supabase) return;

    const channel = supabase.channel('system-wide-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAttendance(prev => prev.some(a => a.id === payload.new.id) ? prev : [...prev, payload.new as AttendanceRecord]);
          } else if (payload.eventType === 'UPDATE') {
            setAttendance(prev => prev.map(a => a.id === payload.new.id ? payload.new as AttendanceRecord : a));
          } else if (payload.eventType === 'DELETE') {
            setAttendance(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employees' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEmployees(prev => prev.some(e => e.id === payload.new.id) ? prev : [...prev, payload.new as Employee]);
          } else if (payload.eventType === 'UPDATE') {
            setEmployees(prev => prev.map(e => e.id === payload.new.id ? payload.new as Employee : e));
          } else if (payload.eventType === 'DELETE') {
            setEmployees(prev => prev.filter(e => e.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'centers' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCenters(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new as Center]);
          } else if (payload.eventType === 'UPDATE') {
            setCenters(prev => prev.map(c => c.id === payload.new.id ? payload.new as Center : c));
          } else if (payload.eventType === 'DELETE') {
            setCenters(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProjects(prev => prev.some(p => p.id === payload.new.id) ? prev : [...prev, payload.new as Project]);
          } else if (payload.eventType === 'UPDATE') {
            setProjects(prev => prev.map(p => p.id === payload.new.id ? payload.new as Project : p));
          } else if (payload.eventType === 'DELETE') {
            setProjects(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admins' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAdmins(prev => prev.some(a => a.id === payload.new.id) ? prev : [...prev, payload.new as Admin]);
          } else if (payload.eventType === 'UPDATE') {
            setAdmins(prev => prev.map(a => a.id === payload.new.id ? payload.new as Admin : a));
          } else if (payload.eventType === 'DELETE') {
            setAdmins(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'holidays' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setHolidays(prev => prev.some(h => h.id === payload.new.id) ? prev : [...prev, payload.new as Holiday]);
          } else if (payload.eventType === 'UPDATE') {
            setHolidays(prev => prev.map(h => h.id === payload.new.id ? payload.new as Holiday : h));
          } else if (payload.eventType === 'DELETE') {
            setHolidays(prev => prev.filter(h => h.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => prev.some(n => n.id === payload.new.id) ? prev : [...prev, payload.new as Notification]);
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n));
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'templates' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTemplates(prev => prev.some(t => t.id === payload.new.id) ? prev : [...prev, payload.new as MessageTemplate]);
          } else if (payload.eventType === 'UPDATE') {
            setTemplates(prev => prev.map(t => t.id === payload.new.id ? payload.new as MessageTemplate : t));
          } else if (payload.eventType === 'DELETE') {
            setTemplates(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setSettings(payload.new as SystemSettings);
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  // Data Sanitizer to prevent DB errors
  const sanitize = (obj: any) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    const cleaned = { ...obj };
    for (const key in cleaned) {
      if (cleaned[key] === '') cleaned[key] = null;
    }
    return cleaned;
  };

  // Optimized database operations (Enhanced with error notifications)
  const executeDbOperation = useCallback(async <T,>(
    tableName: string,
    operation: () => Promise<any>,
    onSuccess?: () => void
  ): Promise<void> => {
    updatePendingOps(tableName, 1);

    try {
      // Execute the actual operation if supabase is configured
      if (checkSupabaseConnection() && supabase) {
        const { error } = await withRetry(async () => await operation());
        if (error) {
          console.error(`Database error in ${tableName}:`, error);
          // Show visible error notification
          setNotifications(prev => [...prev, {
            id: crypto.randomUUID(),
            title: 'خطأ في مزامنة البيانات',
            message: `فشل الحفظ في جدول ${tableName}: ${error.message}`,
            targetType: 'all',
            senderName: 'النظام التقني',
            sentAt: new Date().toISOString()
          }]);
        } else {
          onSuccess?.();
        }
      } else {
        // Fallback for local mode
        onSuccess?.();
      }

      // Always clear pending status
      setTimeout(() => {
        updatePendingOps(tableName, -1);
      }, 500);
    } catch (error: any) {
      console.error(`Execution error in ${tableName}:`, error);
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
    setAttendance(prev => [...prev, r]);
    executeDbOperation('attendance', () => supabase!.from('attendance').insert(r));
  }, [executeDbOperation]);

  const updateAttendance = useCallback(async (r: AttendanceRecord) => {
    setAttendance(prev => prev.map(item => item.id === r.id ? r : item));
    executeDbOperation('attendance', () => supabase!.from('attendance').update(r).eq('id', r.id));
  }, [executeDbOperation]);

  // Notifications CRUD
  const addNotification = useCallback(async (n: Notification) => {
    setNotifications(prev => [...prev, n]);
    return executeDbOperation('notifications', () => supabase!.from('notifications').insert(sanitize(n)));
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

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    centers, employees, admins, attendance, holidays, projects, notifications, templates, settings,
    currentUser, isLoading, isRealtimeConnected, dbStatus, pendingOperations,
    setCurrentUser, addCenter, updateCenter, deleteCenter, addEmployee, updateEmployee,
    deleteEmployee, addAttendance, updateAttendance, addNotification, deleteNotification,
    updateTemplate, updateSettings, addAdmin, updateAdmin, deleteAdmin, addHoliday,
    deleteHoliday, addProject, updateProject, deleteProject, refreshData, testConnection
  }), [
    centers, employees, admins, attendance, holidays, projects, notifications, templates, settings,
    currentUser, isLoading, isRealtimeConnected, dbStatus, pendingOperations, refreshData,
    addCenter, updateCenter, deleteCenter, addEmployee, updateEmployee, deleteEmployee,
    addAttendance, updateAttendance, addNotification, deleteNotification, updateTemplate,
    updateSettings, addAdmin, updateAdmin, deleteAdmin, addHoliday, deleteHoliday,
    addProject, updateProject, deleteProject
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