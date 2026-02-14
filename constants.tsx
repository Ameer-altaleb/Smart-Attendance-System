
import { UserRole, Center, Employee, Admin, MessageTemplate, SystemSettings, Holiday, Notification, Project } from './types.ts';

export const INITIAL_CENTERS: Center[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_ADMINS: Admin[] = [];

export const INITIAL_HOLIDAYS: Holiday[] = [];

export const INITIAL_NOTIFICATIONS: Notification[] = [];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_TEMPLATES: MessageTemplate[] = [
  { id: 't1', type: 'check_in', content: 'تم تسجيل دخولك بنجاح في الوقت المحدد. نتمنى لك يوماً سعيداً!' },
  { id: 't2', type: 'late_check_in', content: 'تم تسجيل دخولك. نلاحظ تأخراً عن الموعد المحدد بـ {minutes} دقيقة.' },
  { id: 't3', type: 'check_out', content: 'تم تسجيل خروجك بنجاح. شكراً لجهودك اليوم.' },
  { id: 't4', type: 'early_check_out', content: 'تم تسجيل خروجك قبل الموعد بـ {minutes} دقيقة.' },
];

export const INITIAL_SETTINGS: SystemSettings = {
  systemName: 'Relief Experts Management',
  logoUrl: '',
  language: 'Arabic',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH:mm',
};
