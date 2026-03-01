
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  GENERAL_MANAGER = 'GENERAL_MANAGER',
  CENTER_MANAGER = 'CENTER_MANAGER'
}

export interface Center {
  id: string;
  name: string;
  defaultStartTime: string; // HH:mm
  defaultEndTime: string;   // HH:mm
  checkInGracePeriod: number; // دقائق السماحية للدخول
  checkOutGracePeriod: number; // دقائق السماحية للخروج
  authorizedIP?: string;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number; // نطاق السماحية الجغرافي (مثلاً 50 متر)
  workingDays: number[]; // [0, 1, 2, 3, 4, 5, 6] حيث 0 هو الأحد
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  centerId: string;
  workingHours: number;
  joinedDate: string;
  deviceId?: string | null;
  lastDeviceIdUpdate?: string | null;
  isActive: boolean;
  workType: 'administrative' | 'shifts';
  projectId?: string;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description?: string;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Admin {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  managedCenterIds: string[];
  isBlocked?: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  centerId: string;
  date: string; // وقت الدخول الفعلي (تاريخ البداية)
  checkIn?: string;
  checkOut?: string;
  checkOutDate?: string; // تاريخ الخروج (قد يختلف عن تاريخ الدخول)
  status: 'present' | 'late' | 'absent' | 'holiday' | 'not_logged_out';
  delayMinutes: number;
  earlyDepartureMinutes: number;
  workingHours: number;
  ipAddress?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  targetType: 'all' | 'center' | 'employee';
  targetId?: string;
  senderName: string;
  sentAt: string;
}

export interface MessageTemplate {
  id: string;
  type: 'check_in' | 'late_check_in' | 'check_out' | 'early_check_out';
  content: string;
}

export interface SystemSettings {
  id?: number;
  systemName: string;
  logoUrl?: string; // شعار المنظمة المخصص
  language: string;
  dateFormat: string;
  timeFormat: string;
  metadata?: any;
  schema_version?: string;
}
