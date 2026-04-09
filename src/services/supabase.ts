import { getSupabase } from '../lib/supabaseClient';

export interface PaymentHistory {
  id: string;
  date: string;
  amount: number;
  method: string;
  note?: string;
}

export interface Grade {
  id: string;
  subject: string;
  score: number;
  total: number;
  term: string;
  date: string;
}

export interface ParentInfo {
  fatherName: string;
  motherName: string;
  phone: string;
  email: string;
  address: string;
}

export interface Student {
  id: string;
  studentId: string;
  name: string;
  class: string;
  academicYear: string;
  feeStatus: "Paid" | "Unpaid" | "Overdue";
  feeAmount: number;
  paidAmount: number;
  dueDate: string; // ISO date
  attendance: number; // percentage
  lastAttendance: string; // ISO date
  enrollmentDate: string; // ISO date
  paymentHistory: PaymentHistory[];
  parentInfo?: ParentInfo;
  grades?: Grade[];
  feeStructureId?: string;
  componentPayments?: { [componentName: string]: number };
}

export const getStudents = async (): Promise<Student[]> => {
  try {
    const { data, error } = await getSupabase()
      .from('students')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching students:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Supabase error:', error);
    return [];
  }
};

export const saveStudent = async (student: Student) => {
  const { error } = await getSupabase()
    .from('students')
    .upsert(student);
  
  if (error) {
    console.error('Error saving student:', error);
    throw error;
  }
};

export const deleteStudent = async (id: string) => {
  const { error } = await getSupabase()
    .from('students')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
};

export interface FeeStructure {
  id: string;
  className: string;
  academicYear: string;
  totalFee: number;
  components: { name: string; amount: number }[];
}

export const getFeeStructures = async (): Promise<FeeStructure[]> => {
  try {
    const { data, error } = await getSupabase()
      .from('fee_structures')
      .select('*');
    
    if (error) {
      console.error('Error fetching fee structures:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Supabase error:', error);
    return [];
  }
};

export const saveFeeStructure = async (structure: FeeStructure) => {
  const { error } = await getSupabase()
    .from('fee_structures')
    .upsert(structure);
  
  if (error) {
    console.error('Error saving fee structure:', error);
    throw error;
  }
};

export const deleteFeeStructure = async (id: string) => {
  const { error } = await getSupabase()
    .from('fee_structures')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting fee structure:', error);
    throw error;
  }
};

export interface AttendanceRecord {
  id?: string;
  date: string; // ISO date YYYY-MM-DD
  records: { [studentId: string]: 'Present' | 'Absent' };
}

export const getAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  try {
    const { data, error } = await getSupabase()
      .from('attendance_records')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching attendance records:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Supabase error:', error);
    return [];
  }
};

export const saveAttendanceRecord = async (record: AttendanceRecord) => {
  const { error } = await getSupabase()
    .from('attendance_records')
    .upsert(record, { onConflict: 'date' });
  
  if (error) {
    console.error('Error saving attendance record:', error);
    throw error;
  }
  
  // Update student attendance percentages
  await updateStudentAttendanceStats();
};

const updateStudentAttendanceStats = async () => {
  const students = await getStudents();
  const attendanceData = await getAttendanceRecords();
  
  const updatedStudents = students.map(student => {
    const studentRecords = attendanceData.filter(r => r.records[student.id] !== undefined);
    const presentCount = studentRecords.filter(r => r.records[student.id] === 'Present').length;
    const totalDays = studentRecords.length;
    
    return {
      ...student,
      attendance: totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 100,
      lastAttendance: attendanceData.length > 0 ? attendanceData[0].date : student.lastAttendance
    };
  });
  
  for (const student of updatedStudents) {
    await saveStudent(student);
  }
};

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export const getNotifications = async (): Promise<Notification[]> => {
  try {
    const { data, error } = await getSupabase()
      .from('notifications')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Supabase error:', error);
    return [];
  }
};

export const saveNotification = async (notification: Notification) => {
  const { error } = await getSupabase()
    .from('notifications')
    .insert(notification);
  
  if (error) {
    console.error('Error saving notification:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (id: string) => {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  
  if (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const deleteNotification = async (id: string) => {
  const { error } = await getSupabase()
    .from('notifications')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

export const clearNotifications = async () => {
  const { error } = await getSupabase()
    .from('notifications')
    .delete()
    .neq('id', '0'); // Delete all
  
  if (error) {
    console.error('Error clearing notifications:', error);
    throw error;
  }
};

// Settings
export interface SchoolSettings {
  id: string;
  name: string;
  academic_year: string;
  logo: string;
  start_time: string;
  end_time: string;
  global_fee_due_date: string;
}

export const getSettings = async (): Promise<SchoolSettings | null> => {
  try {
    const { data, error } = await getSupabase()
      .from('settings')
      .select('*')
      .eq('id', 'default')
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Supabase error:', error);
    return null;
  }
};

export const saveSettings = async (settings: Partial<SchoolSettings>) => {
  const { error } = await getSupabase()
    .from('settings')
    .upsert({ id: 'default', ...settings });
  
  if (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

// Auth Functions
export type UserRole = 'admin' | 'teacher' | 'parent';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  student_id?: string; // For parents to link to their child
}

export const signIn = async (email: string, password: string) => {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string, role: UserRole = 'admin', studentId?: string) => {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  
  if (data.user) {
    // Create profile
    const { error: profileError } = await getSupabase()
      .from('profiles')
      .insert({
        id: data.user.id,
        email,
        role,
        student_id: studentId
      });
    if (profileError) console.error('Error creating profile:', profileError);
  }
  
  return data;
};

export const signOut = async () => {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await getSupabase().auth.getUser();
    return user;
  } catch (error) {
    console.error('Supabase auth error:', error);
    return null;
  }
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Supabase error:', error);
    return null;
  }
};

// Email Integration Placeholder
export const sendEmailReminder = async (toEmail: string, studentName: string, amount: number) => {
  console.log(`[Email Simulation] Sending overdue reminder to ${toEmail} for ${studentName}. Amount: $${amount}`);
  // In a real app, you would use EmailJS or Resend here:
  /*
  await resend.emails.send({
    from: 'EduAssist <noreply@eduassist.com>',
    to: [toEmail],
    subject: 'Fee Overdue Reminder',
    text: `Dear Parent, this is a reminder that ${studentName} has an overdue fee of $${amount}. Please clear it at your earliest convenience.`
  });
  */
  return true;
};

// Validation Helpers
export const validateStudent = (student: Partial<Student>) => {
  if (!student.name?.trim()) throw new Error("Student name is required");
  if (!student.class?.trim()) throw new Error("Class is required");
  if (!student.studentId?.trim()) throw new Error("Student ID is required");
  return true;
};

export const validateFeeStructure = (structure: Partial<FeeStructure>) => {
  if (!structure.className?.trim()) throw new Error("Class name is required");
  if (!structure.academicYear?.trim()) throw new Error("Academic year is required");
  if (structure.totalFee === undefined || structure.totalFee < 0) throw new Error("Valid total fee is required");
  return true;
};
