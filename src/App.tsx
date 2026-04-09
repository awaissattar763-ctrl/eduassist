/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, GraduationCap, Users, CreditCard, Calendar, Bot, User, 
  Loader2, Sparkles, Menu, X, LogOut, Plus, Trash2, Edit2, 
  CheckCircle2, AlertCircle, Clock, MessageSquare, MessageCircle, LayoutDashboard,
  Bell, Search, ChevronRight, Settings, HelpCircle, MoreVertical, Download,
  Phone, Mail, MapPin, TrendingUp, BarChart3, BookOpen, ShieldCheck, PieChart,
  FileText, Receipt, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import Fuse from 'fuse.js';
import Markdown from 'react-markdown';
import { Toaster, toast } from 'sonner';
import { getGeminiResponse, generateDailyInsights } from './services/gemini';
import { cn } from './lib/utils';
import { getSupabase } from './lib/supabaseClient';
import { generateReportCard, generateFeeReceipt } from './services/pdfService';
import { 
  getStudents, saveStudent, deleteStudent, Student, Grade,
  getAttendanceRecords, saveAttendanceRecord, AttendanceRecord,
  getFeeStructures, saveFeeStructure, deleteFeeStructure, FeeStructure,
  getNotifications, saveNotification, markNotificationAsRead, deleteNotification, clearNotifications, Notification, PaymentHistory,
  getSettings, saveSettings, SchoolSettings,
  signIn, signUp, signOut, getCurrentUser, getUserProfile, UserProfile, UserRole, validateStudent, validateFeeStructure, sendEmailReminder
} from './services/supabase';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

type View = 'dashboard' | 'chat' | 'students' | 'fees' | 'attendance' | 'notifications';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupRole, setSignupRole] = useState<UserRole>('admin');
  const [signupStudentId, setSignupStudentId] = useState('');
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [feeSubView, setFeeSubView] = useState<'records' | 'structures'>('records');
  const [isFeeStructureModalOpen, setIsFeeStructureModalOpen] = useState(false);
  const [editingFeeStructure, setEditingFeeStructure] = useState<Partial<FeeStructure> | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  
  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Payment History State
  const [isPaymentHistoryModalOpen, setIsPaymentHistoryModalOpen] = useState(false);
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<Student | null>(null);
  const [isEditFeeModalOpen, setIsEditFeeModalOpen] = useState(false);
  const [editingFeeStudent, setEditingFeeStudent] = useState<Student | null>(null);
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      content: "Hello! I'm EduAssist AI. I'm connected to your school database. How can I help you with student records, fees, or attendance today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Student Form State
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Partial<Student> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [feeFilter, setFeeFilter] = useState<string>('All');
  const [attendanceFilter, setAttendanceFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');
  const [classFilter, setClassFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [feeStructureSearchQuery, setFeeStructureSearchQuery] = useState('');

  const resetFilters = () => {
    setSearchQuery('');
    setFeeFilter('All');
    setAttendanceFilter('All');
    setDateFilter('All');
    setClassFilter('All');
    setSortBy('name-asc');
  };

  // School Branding State
  const [schoolName, setSchoolName] = useState('Greenwood International');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [schoolStartTime, setSchoolStartTime] = useState('08:00');
  const [schoolEndTime, setSchoolEndTime] = useState('14:00');
  const [globalFeeDueDate, setGlobalFeeDueDate] = useState('10'); // Day of month
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    name: schoolName,
    year: academicYear,
    logo: schoolLogo,
    start: schoolStartTime,
    end: schoolEndTime,
    dueDate: globalFeeDueDate
  });

  useEffect(() => {
    // Check current session
    const checkUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setIsLoggedIn(true);
        setUserEmail(user.email || '');
        const profile = await getUserProfile(user.id);
        setUserProfile(profile);
      }
    };
    checkUser();

    // Listen for auth changes
    let subscription: any = null;
    try {
      const sb = getSupabase();
      const { data } = sb.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          setIsLoggedIn(true);
          setUserEmail(session.user.email || '');
          const profile = await getUserProfile(session.user.id);
          setUserProfile(profile);
        } else {
          setIsLoggedIn(false);
          setUserEmail('');
          setUserProfile(null);
        }
      });
      subscription = data.subscription;
    } catch (error) {
      console.error('Supabase auth listener error:', error);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await saveSettings({
        name: settingsForm.name,
        academic_year: settingsForm.year,
        logo: settingsForm.logo,
        start_time: settingsForm.start,
        end_time: settingsForm.end,
        global_fee_due_date: settingsForm.dueDate
      });
      
      setSchoolName(settingsForm.name);
      setAcademicYear(settingsForm.year);
      setSchoolLogo(settingsForm.logo);
      setSchoolStartTime(settingsForm.start);
      setSchoolEndTime(settingsForm.end);
      setGlobalFeeDueDate(settingsForm.dueDate);
      setIsSettingsModalOpen(false);
      
      toast.success('School settings updated successfully');

      const notification: Notification = {
        id: Date.now().toString(),
        title: 'Settings Updated',
        message: 'School settings have been successfully updated.',
        type: 'success',
        timestamp: new Date().toISOString(),
        read: false
      };
      await saveNotification(notification);
      const updatedNotifications = await getNotifications();
      setNotifications(updatedNotifications);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  const getAttendanceTrends = (studentId: string) => {
    const today = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        name: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        present: 0,
        total: 0
      });
    }

    const studentRecords = attendanceHistory.filter(r => r.records[studentId] !== undefined);

    studentRecords.forEach(r => {
      const recordDate = new Date(r.date);
      const recordMonth = recordDate.getMonth();
      const recordYear = recordDate.getFullYear();

      const monthData = months.find(m => m.monthIndex === recordMonth && m.year === recordYear);
      if (monthData) {
        monthData.total++;
        if (r.records[studentId] === 'Present') monthData.present++;
      }
    });

    return months.map(m => ({
      name: m.name,
      percentage: m.total > 0 ? Math.round((m.present / m.total) * 100) : 100
    }));
  };

  // Individual Student Attendance History State
  const [isStudentAttendanceModalOpen, setIsStudentAttendanceModalOpen] = useState(false);
  const [selectedStudentForAttendance, setSelectedStudentForAttendance] = useState<Student | null>(null);
  const [studentAttendanceStartDate, setStudentAttendanceStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [studentAttendanceEndDate, setStudentAttendanceEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Student Profile State
  const [isStudentProfileModalOpen, setIsStudentProfileModalOpen] = useState(false);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [isAddGradeFormOpen, setIsAddGradeFormOpen] = useState(false);
  const [newGrade, setNewGrade] = useState({ subject: '', term: '', score: 0, total: 100 });

  // Attendance State
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentAttendance, setCurrentAttendance] = useState<{ [id: string]: 'Present' | 'Absent' }>({});
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [attendanceSubView, setAttendanceSubView] = useState<'daily' | 'reports'>('daily');
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportClassFilter, setReportClassFilter] = useState('All');
  const [reportStatusFilter, setReportStatusFilter] = useState('All');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [reportMonthFilter, setReportMonthFilter] = useState('All');
  const [reportYearFilter, setReportYearFilter] = useState('All');

  const filteredAttendanceReport = React.useMemo(() => {
    const rows: { date: string; student: Student; status: 'Present' | 'Absent' }[] = [];
    
    [...attendanceHistory]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(record => {
        const recordDate = new Date(record.date);
        const matchesDateRange = record.date >= reportStartDate && record.date <= reportEndDate;
        const matchesMonth = reportMonthFilter === 'All' || (recordDate.getMonth() + 1).toString() === reportMonthFilter;
        const matchesYear = reportYearFilter === 'All' || recordDate.getFullYear().toString() === reportYearFilter;
        return matchesDateRange && matchesMonth && matchesYear;
      })
      .forEach(record => {
        Object.entries(record.records).forEach(([studentId, status]) => {
          const student = students.find(s => s.id === studentId);
          if (!student) return;
          
          const matchesClass = reportClassFilter === 'All' || student.class === reportClassFilter;
          const matchesStatus = reportStatusFilter === 'All' || status === reportStatusFilter;
          const matchesSearch = reportSearchQuery === '' || 
                               student.name.toLowerCase().includes(reportSearchQuery.toLowerCase()) || 
                               student.studentId.toLowerCase().includes(reportSearchQuery.toLowerCase());
          
          if (matchesClass && matchesStatus && matchesSearch) {
            rows.push({ date: record.date, student, status });
          }
        });
      });
    return rows;
  }, [attendanceHistory, reportStartDate, reportEndDate, reportClassFilter, reportStatusFilter, reportSearchQuery, reportMonthFilter, reportYearFilter, students]);

  const handleGenerateInsights = async () => {
    setIsGeneratingInsights(true);
    try {
      const insights = await generateDailyInsights();
      setAiInsights(insights);
      toast.success('Daily insights generated');
    } catch (error) {
      toast.error('Failed to generate insights');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const checkOverdueFees = async () => {
    const allStudents = await getStudents();
    const today = new Date().toISOString().split('T')[0];
    let updated = false;
    
    for (const s of allStudents) {
      if (s.feeStatus !== 'Paid' && s.dueDate < today && s.feeStatus !== 'Overdue') {
        updated = true;
        const newNotification: Notification = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          title: 'Fee Overdue',
          message: `${s.name}'s fee is now overdue (Due: ${s.dueDate})`,
          type: 'warning',
          timestamp: new Date().toISOString(),
          read: false
        };
        await saveNotification(newNotification);
        
        // Email Simulation
        if (s.parentInfo?.email) {
          await sendEmailReminder(s.parentInfo.email, s.name, s.feeAmount - s.paidAmount);
        }

        await saveStudent({ ...s, feeStatus: 'Overdue' });
      }
    }

    // Check for low attendance
    const lowAttendanceStudents = allStudents.filter(s => s.attendance < 75);
    for (const student of lowAttendanceStudents) {
      const notificationId = `attendance-${student.id}`;
      const existing = notifications.find(n => n.id === notificationId);
      if (!existing) {
        const notification: Notification = {
          id: notificationId,
          title: 'Low Attendance Alert',
          message: `${student.name} has low attendance: ${student.attendance}%`,
          type: 'error',
          timestamp: new Date().toISOString(),
          read: false
        };
        await saveNotification(notification);
        updated = true;
      }
    }

    if (updated) {
      const finalStudents = await getStudents();
      setStudents(finalStudents);
      const finalNotifications = await getNotifications();
      setNotifications(finalNotifications);
      return true;
    }
    return false;
  };

  const exportStudentsToCSV = async () => {
    const headers = ['Student ID', 'Name', 'Class', 'Fee Status', 'Fee Amount', 'Paid Amount', 'Due Date', 'Attendance Percentage', 'Enrollment Date'];
    const rows = filteredStudents.map(s => [
      s.studentId,
      s.name,
      s.class,
      s.feeStatus,
      s.feeAmount,
      s.paidAmount,
      s.dueDate,
      `${s.attendance}%`,
      s.enrollmentDate
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const newNotification: Notification = {
      id: Date.now().toString(),
      title: 'Export Successful',
      message: `Student data has been exported to CSV.`,
      type: 'success',
      timestamp: new Date().toISOString(),
      read: false
    };
    await saveNotification(newNotification);
    const updatedNotifications = await getNotifications();
    setNotifications(updatedNotifications);
  };

  const handleDownloadReportCard = async (student: Student) => {
    setIsPdfGenerating(true);
    try {
      const settings: SchoolSettings = {
        id: 'default',
        name: schoolName,
        academic_year: academicYear,
        logo: schoolLogo,
        start_time: schoolStartTime,
        end_time: schoolEndTime,
        global_fee_due_date: globalFeeDueDate
      };
      await generateReportCard(student, settings);
      toast.success('Report card generated successfully');
    } catch (error) {
      console.error('PDF Error:', error);
      toast.error('Failed to generate report card');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleDownloadFeeReceipt = async (student: Student) => {
    setIsPdfGenerating(true);
    try {
      const settings: SchoolSettings = {
        id: 'default',
        name: schoolName,
        academic_year: academicYear,
        logo: schoolLogo,
        start_time: schoolStartTime,
        end_time: schoolEndTime,
        global_fee_due_date: globalFeeDueDate
      };
      await generateFeeReceipt(student, settings);
      toast.success('Fee receipt generated successfully');
    } catch (error) {
      console.error('PDF Error:', error);
      toast.error('Failed to generate fee receipt');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsAppReminder = (student: Student) => {
    if (!student.parentInfo?.phone) {
      toast.error("Parent's phone number not found");
      return;
    }

    const amountDue = student.feeAmount - student.paidAmount;
    const message = `Dear Parent, this is a reminder from ${schoolName} that your child ${student.name}'s fee of $${amountDue.toFixed(2)} is overdue. Please pay as soon as possible. - EduAssist`;
    
    // Clean phone number: remove non-digits
    const cleanPhone = student.parentInfo.phone.replace(/\D/g, '');
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    toast.success('Redirecting to WhatsApp...');
    window.open(whatsappUrl, '_blank');
  };

  const exportAttendanceToCSV = async () => {
    const headers = ['Date', 'Student ID', 'Student Name', 'Class', 'Status'];
    
    const rows = filteredAttendanceReport.map(item => [
      item.date,
      item.student.studentId,
      item.student.name,
      item.student.class,
      item.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_report_${reportStartDate}_to_${reportEndDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const newNotification: Notification = {
      id: Date.now().toString(),
      title: 'Attendance Export Successful',
      message: `Attendance report has been exported to CSV.`,
      type: 'success',
      timestamp: new Date().toISOString(),
      read: false
    };
    await saveNotification(newNotification);
    const updatedNotifications = await getNotifications();
    setNotifications(updatedNotifications);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (isLoggedIn) {
        setIsDataLoading(true);
        try {
          const [allStudents, allFeeStructures, allAttendance, allNotifications, settingsData] = await Promise.all([
            getStudents(),
            getFeeStructures(),
            getAttendanceRecords(),
            getNotifications(),
            getSettings()
          ]);
          
          setStudents(allStudents);
          setFeeStructures(allFeeStructures);
          setAttendanceHistory(allAttendance);
          setNotifications(allNotifications);

          if (settingsData) {
            setSchoolName(settingsData.name);
            setAcademicYear(settingsData.academic_year);
            setSchoolLogo(settingsData.logo);
            setSchoolStartTime(settingsData.start_time);
            setSchoolEndTime(settingsData.end_time);
            setGlobalFeeDueDate(settingsData.global_fee_due_date);
          }
          
          // Check overdue fees after loading students
          await checkOverdueFees();
        } catch (error) {
          console.error('Error fetching initial data:', error);
        } finally {
          setIsDataLoading(false);
        }
      }
    };

    fetchData();

    if (isLoggedIn) {
      // Background process: Check every 5 minutes
      const interval = setInterval(() => {
        checkOverdueFees();
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // Real-time sync setup
  useEffect(() => {
    if (!isLoggedIn) return;

    let studentsSubscription: any;
    let feeStructuresSubscription: any;
    let attendanceSubscription: any;
    let notificationsSubscription: any;
    let settingsSubscription: any;

    try {
      const sb = getSupabase();
      
      studentsSubscription = sb
        .channel('students-changes')
        .on('postgres_changes' as any, { event: '*', table: 'students' }, async () => {
          const updatedStudents = await getStudents();
          setStudents(updatedStudents);
        })
        .subscribe();

      feeStructuresSubscription = sb
        .channel('fee-structures-changes')
        .on('postgres_changes' as any, { event: '*', table: 'fee_structures' }, async () => {
          const updatedStructures = await getFeeStructures();
          setFeeStructures(updatedStructures);
        })
        .subscribe();

      attendanceSubscription = sb
        .channel('attendance-changes')
        .on('postgres_changes' as any, { event: '*', table: 'attendance_records' }, async () => {
          const updatedAttendance = await getAttendanceRecords();
          setAttendanceHistory(updatedAttendance);
        })
        .subscribe();

      notificationsSubscription = sb
        .channel('notifications-changes')
        .on('postgres_changes' as any, { event: '*', table: 'notifications' }, async () => {
          const updatedNotifications = await getNotifications();
          setNotifications(updatedNotifications);
        })
        .subscribe();

      settingsSubscription = sb
        .channel('settings-changes')
        .on('postgres_changes' as any, { event: '*', table: 'settings' }, async () => {
          const settingsData = await getSettings();
          if (settingsData) {
            setSchoolName(settingsData.name);
            setAcademicYear(settingsData.academic_year);
            setSchoolLogo(settingsData.logo);
            setSchoolStartTime(settingsData.start_time);
            setSchoolEndTime(settingsData.end_time);
            setGlobalFeeDueDate(settingsData.global_fee_due_date);
          }
        })
        .subscribe();
    } catch (error) {
      console.error('Supabase real-time sync error:', error);
    }

    return () => {
      try {
        const sb = getSupabase();
        if (studentsSubscription) sb.removeChannel(studentsSubscription);
        if (feeStructuresSubscription) sb.removeChannel(feeStructuresSubscription);
        if (attendanceSubscription) sb.removeChannel(attendanceSubscription);
        if (notificationsSubscription) sb.removeChannel(notificationsSubscription);
        if (settingsSubscription) sb.removeChannel(settingsSubscription);
      } catch (e) {
        // Ignore errors on cleanup if supabase is not available
      }
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const record = attendanceHistory.find(r => r.date === attendanceDate);
    if (record) {
      setCurrentAttendance(record.records);
    } else {
      // Default all to present if no record exists for this date
      const defaultAttendance: { [id: string]: 'Present' | 'Absent' } = {};
      students.forEach(s => {
        defaultAttendance[s.id] = 'Present';
      });
      setCurrentAttendance(defaultAttendance);
    }
  }, [attendanceDate, attendanceHistory, students]);

  const handleSaveAttendance = async () => {
    setIsLoading(true);
    try {
      await saveAttendanceRecord({
        date: attendanceDate,
        records: currentAttendance
      });
      toast.success('Attendance saved successfully');
      const [updatedHistory, updatedStudents] = await Promise.all([getAttendanceRecords(), getStudents()]);
      setAttendanceHistory(updatedHistory);
      setStudents(updatedStudents); // Refresh to get updated percentages
    } catch (error: any) {
      toast.error(error.message || 'Failed to save attendance');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAttendance = (id: string) => {
    setCurrentAttendance(prev => ({
      ...prev,
      [id]: prev[id] === 'Present' ? 'Absent' : 'Present'
    }));
  };

  const filteredStudents = students.filter(s => {
    // Role-based filtering
    if (userProfile?.role === 'parent' && userProfile.student_id) {
      if (s.studentId !== userProfile.student_id) return false;
    }

    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.class.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesClass = classFilter === 'All' || s.class === classFilter;
    
    const matchesFee = feeFilter === 'All' || s.feeStatus === feeFilter;
    
    const matchesAttendance = attendanceFilter === 'All' || (() => {
      if (attendanceFilter === '> 90%') return (s.attendance || 0) >= 90;
      if (attendanceFilter === '> 75%') return (s.attendance || 0) >= 75;
      if (attendanceFilter === '< 75%') return (s.attendance || 0) < 75;
      return true;
    })();

    const matchesDate = dateFilter === 'All' || (() => {
      if (!s.enrollmentDate) return false;
      const enrollmentDate = new Date(s.enrollmentDate);
      const now = new Date();
      if (dateFilter === 'This Month') {
        return enrollmentDate.getMonth() === now.getMonth() && enrollmentDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'This Year') {
        return enrollmentDate.getFullYear() === now.getFullYear();
      }
      return true;
    })();

    return matchesSearch && matchesClass && matchesFee && matchesAttendance && matchesDate;
  }).sort((a, b) => {
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    if (sortBy === 'attendance-desc') return (b.attendance || 0) - (a.attendance || 0);
    if (sortBy === 'attendance-asc') return (a.attendance || 0) - (b.attendance || 0);
    if (sortBy === 'date-desc') return new Date(b.enrollmentDate || 0).getTime() - new Date(a.enrollmentDate || 0).getTime();
    if (sortBy === 'date-asc') return new Date(a.enrollmentDate || 0).getTime() - new Date(b.enrollmentDate || 0).getTime();
    return 0;
  });

  const filteredFeeStructures = React.useMemo(() => {
    if (!feeStructureSearchQuery.trim()) return feeStructures;
    const fuse = new Fuse(feeStructures, {
      keys: ['className', 'academicYear'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    return fuse.search(feeStructureSearchQuery).map(result => result.item);
  }, [feeStructures, feeStructureSearchQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [isSignUp, setIsSignUp] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('Please enter both email and password.');
      return;
    }
    
    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUp(loginEmail, loginPassword, signupRole, signupStudentId);
        toast.success('Account created! Please check your email for verification.');
      } else {
        await signIn(loginEmail, loginPassword);
        toast.success('Signed in successfully');
        setActiveView('dashboard');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      setActiveView('dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign out');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      const responseText = await getGeminiResponse(input, history);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        content: "Error connecting to AI. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const totalCollectedFees = students.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const totalPendingFees = students.reduce((sum, s) => sum + ((s.feeAmount || 0) - (s.paidAmount || 0)), 0);
  const paidStudentsCount = students.filter(s => s.feeStatus === 'Paid').length;
  const avgAttendance = students.length > 0 
    ? (students.reduce((sum, s) => sum + s.attendance, 0) / students.length).toFixed(1) 
    : "0";

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      validateStudent(editingStudent);
      
      setIsLoading(true);
      // Find fee structure for this class and current academic year
      const structure = feeStructures.find(fs => 
        fs.className === editingStudent.class && 
        fs.academicYear === academicYear
      );
      const feeAmount = editingStudent.feeAmount || structure?.totalFee || 1000;
      const today = new Date().toISOString().split('T')[0];
      const dueDate = editingStudent.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let feeStatus: "Paid" | "Unpaid" | "Overdue" = editingStudent.feeStatus as any || 'Unpaid';
      if (feeStatus !== 'Paid') {
        feeStatus = dueDate < today ? 'Overdue' : 'Unpaid';
      }

      const newStudent: Student = {
        id: editingStudent.id || crypto.randomUUID(),
        studentId: editingStudent.studentId || `STU-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`,
        name: editingStudent.name!,
        class: editingStudent.class!,
        academicYear: editingStudent.academicYear || academicYear,
        feeStatus: feeStatus,
        feeAmount: feeAmount,
        paidAmount: editingStudent.paidAmount || 0,
        dueDate: dueDate,
        attendance: editingStudent.attendance || 100,
        lastAttendance: editingStudent.lastAttendance || today,
        enrollmentDate: editingStudent.enrollmentDate || today,
        paymentHistory: editingStudent.paymentHistory || [],
        parentInfo: editingStudent.parentInfo,
        grades: editingStudent.grades,
        feeStructureId: structure?.id,
        componentPayments: editingStudent.componentPayments || {},
      };
      
      await saveStudent(newStudent);
      toast.success(editingStudent.id ? 'Student updated successfully' : 'Student added successfully');
      
      const updatedStudents = await getStudents();
      setStudents(updatedStudents);
      setIsStudentModalOpen(false);
      setEditingStudent(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save student');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateFeeStatus = async (studentId: string, status: 'Paid' | 'Unpaid') => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setIsLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        let newStatus: 'Paid' | 'Unpaid' | 'Overdue' = status;
        if (status === 'Unpaid' && student.dueDate < today) {
          newStatus = 'Overdue';
        }
        
        const structure = feeStructures.find(fs => fs.id === student.feeStructureId);
        const componentPayments = status === 'Paid' && structure 
          ? Object.fromEntries(structure.components.map(c => [c.name, c.amount]))
          : student.componentPayments || {};

        const updatedStudent: Student = { 
          ...student, 
          feeStatus: newStatus,
          paidAmount: status === 'Paid' ? student.feeAmount : 0,
          componentPayments,
          paymentHistory: status === 'Paid' 
            ? [...student.paymentHistory, { id: Date.now().toString(), date: today, amount: student.feeAmount - student.paidAmount, method: 'Manual Update' }]
            : student.paymentHistory
        };

        await saveStudent(updatedStudent);
        toast.success(`Fee status updated to ${newStatus}`);
        
        const updatedStudents = await getStudents();
        setStudents(updatedStudents);

        // Notification
        const notification: Notification = {
          id: Date.now().toString(),
          title: newStatus === 'Paid' ? 'Fee Fully Paid' : newStatus === 'Overdue' ? 'Fee Overdue' : 'Fee Status Updated',
          message: newStatus === 'Paid' 
            ? `${student.name} has paid the full fee of $${student.feeAmount}`
            : newStatus === 'Overdue'
              ? `${student.name}'s fee is now overdue (Due: ${student.dueDate})`
              : `${student.name}'s status changed to ${newStatus}`,
          type: newStatus === 'Paid' ? 'success' : newStatus === 'Overdue' ? 'warning' : 'info',
          timestamp: new Date().toISOString(),
          read: false
        };
        await saveNotification(notification);
        const updatedNotifications = await getNotifications();
        setNotifications(updatedNotifications);
      } catch (error: any) {
        toast.error(error.message || 'Failed to update fee status');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAddPayment = async (studentId: string, amount: number, method: string, note?: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setIsLoading(true);
      try {
        const newPaidAmount = (student.paidAmount || 0) + amount;
        const today = new Date().toISOString().split('T')[0];
        let status: 'Paid' | 'Unpaid' | 'Overdue' = newPaidAmount >= student.feeAmount ? 'Paid' : 'Unpaid';
        if (status === 'Unpaid' && student.dueDate < today) {
          status = 'Overdue';
        }

        const structure = feeStructures.find(fs => fs.id === student.feeStructureId);
        let newComponentPayments = { ...(student.componentPayments || {}) };
        
        if (structure) {
          let remainingAmount = amount;
          structure.components.forEach(comp => {
            const currentPaid = newComponentPayments[comp.name] || 0;
            const stillOwed = comp.amount - currentPaid;
            if (remainingAmount > 0 && stillOwed > 0) {
              const paymentToComp = Math.min(remainingAmount, stillOwed);
              newComponentPayments[comp.name] = currentPaid + paymentToComp;
              remainingAmount -= paymentToComp;
            }
          });
        }

        const updatedStudent: Student = {
          ...student,
          paidAmount: newPaidAmount,
          feeStatus: status,
          componentPayments: newComponentPayments,
          paymentHistory: [
            ...student.paymentHistory,
            { id: Date.now().toString(), date: today, amount, method, note }
          ]
        };

        await saveStudent(updatedStudent);
        toast.success(`Payment of $${amount} recorded successfully`);
        
        const allStudents = await getStudents();
        setStudents(allStudents);

        if (status === 'Paid') {
          const notification: Notification = {
            id: Date.now().toString(),
            title: 'Fee Fully Paid',
            message: `${student.name} has paid the full fee of $${student.feeAmount}`,
            type: 'success',
            timestamp: new Date().toISOString(),
            read: false
          };
          await saveNotification(notification);
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to add payment');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRemovePayment = async (studentId: string, paymentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setIsLoading(true);
      try {
        const updatedHistory = student.paymentHistory.filter(p => p.id !== paymentId);
        const newPaidAmount = updatedHistory.reduce((sum, p) => sum + p.amount, 0);
        const today = new Date().toISOString().split('T')[0];
        let status: 'Paid' | 'Unpaid' | 'Overdue' = newPaidAmount >= student.feeAmount ? 'Paid' : 'Unpaid';
        if (status === 'Unpaid' && student.dueDate < today) {
          status = 'Overdue';
        }

        const structure = feeStructures.find(fs => fs.id === student.feeStructureId);
        let newComponentPayments: { [key: string]: number } = {};
        
        if (structure) {
          let remainingAmount = newPaidAmount;
          structure.components.forEach(comp => {
            if (remainingAmount > 0) {
              const paymentToComp = Math.min(remainingAmount, comp.amount);
              newComponentPayments[comp.name] = paymentToComp;
              remainingAmount -= paymentToComp;
            } else {
              newComponentPayments[comp.name] = 0;
            }
          });
        }

        const updatedStudent: Student = {
          ...student,
          paidAmount: newPaidAmount,
          feeStatus: status,
          componentPayments: newComponentPayments,
          paymentHistory: updatedHistory
        };

        await saveStudent(updatedStudent);
        toast.success('Payment entry removed');
        
        const allStudents = await getStudents();
        setStudents(allStudents);
        
        // Update selected student for profile if it's the same student
        if (selectedStudentForProfile?.id === studentId) {
          setSelectedStudentForProfile(allStudents.find(s => s.id === studentId) || null);
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to remove payment');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAddGrade = async (studentId: string) => {
    if (!newGrade.subject || !newGrade.term) {
      toast.error('Subject and term are required');
      return;
    }

    const student = students.find(s => s.id === studentId);
    if (student) {
      setIsLoading(true);
      try {
        const grade: Grade = {
          id: Date.now().toString(),
          subject: newGrade.subject,
          term: newGrade.term,
          score: newGrade.score,
          total: newGrade.total,
          date: new Date().toISOString().split('T')[0]
        };

        const updatedStudent: Student = {
          ...student,
          grades: [...(student.grades || []), grade]
        };

        await saveStudent(updatedStudent);
        toast.success('Grade added successfully');
        
        const allStudents = await getStudents();
        setStudents(allStudents);
        
        if (selectedStudentForProfile?.id === studentId) {
          setSelectedStudentForProfile(allStudents.find(s => s.id === studentId) || null);
        }

        setIsAddGradeFormOpen(false);
        setNewGrade({ subject: '', term: '', score: 0, total: 100 });
      } catch (error: any) {
        toast.error(error.message || 'Failed to add grade');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRemoveGrade = async (studentId: string, gradeId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setIsLoading(true);
      try {
        const updatedGrades = (student.grades || []).filter(g => g.id !== gradeId);

        const updatedStudent: Student = {
          ...student,
          grades: updatedGrades
        };

        await saveStudent(updatedStudent);
        toast.success('Grade entry removed');
        
        const allStudents = await getStudents();
        setStudents(allStudents);
        
        if (selectedStudentForProfile?.id === studentId) {
          setSelectedStudentForProfile(allStudents.find(s => s.id === studentId) || null);
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to remove grade');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const confirmDelete = async () => {
    if (studentToDelete) {
      setIsLoading(true);
      try {
        await deleteStudent(studentToDelete);
        toast.success('Student deleted successfully');
        const updatedStudents = await getStudents();
        setStudents(updatedStudents);
        setIsDeleteModalOpen(false);
        setStudentToDelete(null);
      } catch (error: any) {
        toast.error(error.message || 'Failed to delete student');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSaveFeeStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeeStructure) return;

    try {
      validateFeeStructure(editingFeeStructure);
      
      setIsLoading(true);
      const newStructure: FeeStructure = {
        id: editingFeeStructure.id || crypto.randomUUID(),
        className: editingFeeStructure.className!,
        academicYear: editingFeeStructure.academicYear || academicYear,
        totalFee: editingFeeStructure.totalFee || 0,
        components: editingFeeStructure.components || [],
      };
      await saveFeeStructure(newStructure);
      toast.success(editingFeeStructure.id ? 'Fee structure updated successfully' : 'Fee structure added successfully');
      
      const updatedStructures = await getFeeStructures();
      setFeeStructures(updatedStructures);
      setIsFeeStructureModalOpen(false);
      setEditingFeeStructure(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save fee structure');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFeeStructure = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteFeeStructure(id);
      toast.success('Fee structure deleted successfully');
      const updatedStructures = await getFeeStructures();
      setFeeStructures(updatedStructures);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete fee structure');
    } finally {
      setIsLoading(false);
    }
  };

  if (isDataLoading && isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-xl animate-bounce">
            <GraduationCap size={32} />
          </div>
          <p className="text-slate-500 font-bold animate-pulse">Loading school data...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-brand-600 flex items-center justify-center p-4">
        <Toaster position="top-right" richColors />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-8 text-center bg-white">
            <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-slate-900">EduAssist {isSignUp ? 'Register' : 'Admin'}</h2>
            <p className="text-slate-500 mt-1">{isSignUp ? 'Create an account to start' : 'Sign in to manage your school'}</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 pt-0 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <input 
                type="email" 
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@school.edu"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <input 
                type="password" 
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
              />
            </div>

            {isSignUp && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700">Role</label>
                  <select 
                    value={signupRole}
                    onChange={(e) => setSignupRole(e.target.value as UserRole)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all bg-white"
                  >
                    <option value="admin">Administrator</option>
                    <option value="teacher">Teacher</option>
                    <option value="parent">Parent</option>
                  </select>
                </div>
                {signupRole === 'parent' && (
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700">Student ID (to link child)</label>
                    <input 
                      type="text" 
                      value={signupStudentId}
                      onChange={(e) => setSignupStudentId(e.target.value)}
                      placeholder="e.g. STU001"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    />
                  </div>
                )}
              </>
            )}
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 mt-4 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading && <Loader2 size={18} className="animate-spin" />}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
            
            <div className="text-center mt-6">
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm font-bold text-brand-600 hover:text-brand-700 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Register here'}
              </button>
            </div>

            {!isSignUp && (
              <p className="text-center text-xs text-slate-400 mt-4">
                Demo: admin@school.edu / admin123
              </p>
            )}
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans selection:bg-brand-100 selection:text-brand-900">
      <Toaster position="top-right" richColors />
      
      {/* Global Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-[2px] flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={40} className="text-brand-600 animate-spin" />
              <p className="text-sm font-bold text-slate-600 animate-pulse">Processing...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => setIsSidebarOpen(false)} 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Fixed on Large Screens */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[70] w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:z-auto flex flex-col h-full",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
          <div className="p-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-200 rotate-3 group hover:rotate-0 transition-transform relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
              <GraduationCap size={24} className="relative z-10" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl leading-tight text-slate-900 tracking-tight">EduAssist <span className="text-brand-600">Pro</span></h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-[0.1em] uppercase truncate max-w-[140px]">{schoolName}</p>
            </div>
          </div>

          <div className="px-4 mb-4">
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Main Menu</p>
            <nav className="space-y-1">
              <NavItem active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} icon={LayoutDashboard} label="Overview" />
              {(userProfile?.role === 'admin' || userProfile?.role === 'teacher') && (
                <NavItem active={activeView === 'chat'} onClick={() => setActiveView('chat')} icon={MessageSquare} label="AI Assistant" badge="New" />
              )}
              <NavItem active={activeView === 'notifications'} onClick={() => setActiveView('notifications')} icon={Bell} label="Notifications" badge={notifications.filter(n => !n.read).length > 0 ? notifications.filter(n => !n.read).length.toString() : undefined} />
            </nav>
          </div>

          <div className="px-4 mb-4">
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Management</p>
            <nav className="space-y-1">
              {(userProfile?.role === 'admin' || userProfile?.role === 'teacher') && (
                <NavItem active={activeView === 'students'} onClick={() => setActiveView('students')} icon={Users} label="Students" />
              )}
              {(userProfile?.role === 'admin' || userProfile?.role === 'parent') && (
                <NavItem active={activeView === 'fees'} onClick={() => setActiveView('fees')} icon={CreditCard} label="Finances" />
              )}
              <NavItem active={activeView === 'attendance'} onClick={() => setActiveView('attendance')} icon={Calendar} label="Attendance" />
            </nav>
          </div>

          <div className="mt-auto p-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                  <HelpCircle size={16} />
                </div>
                <p className="text-xs font-bold text-slate-700">Need help?</p>
              </div>
              <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">Check our documentation or contact support for assistance.</p>
              <button className="w-full py-2 text-[10px] font-bold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Documentation</button>
            </div>
            
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 mt-4 text-sm font-bold text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all group"
            >
              <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Navigation - Fixed at top of main area */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-30">
          <div className="flex items-center gap-6 flex-1">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <Menu size={20} />
            </button>
            
            <div className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-400">
              <span className="flex items-center gap-2">
                {schoolLogo ? (
                  <img src={schoolLogo} alt="Logo" className="w-6 h-6 rounded-md object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <GraduationCap size={16} className="text-brand-600" />
                )}
                EduAssist Pro
              </span>
              <ChevronRight size={14} />
              <button 
                onClick={() => {
                  setSettingsForm({
                    name: schoolName,
                    year: academicYear,
                    logo: schoolLogo,
                    start: schoolStartTime,
                    end: schoolEndTime,
                    dueDate: globalFeeDueDate
                  });
                  setIsSettingsModalOpen(true);
                }}
                className="text-slate-900 font-bold hover:text-brand-600 transition-colors flex items-center gap-2 group"
              >
                {schoolName}
                <Settings size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <ChevronRight size={14} />
              <span className="text-slate-400 font-medium capitalize">{activeView}</span>
            </div>

            <div className="hidden lg:flex items-center relative max-w-md w-full ml-4">
              <Search className="absolute left-4 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/10 focus:bg-white focus:border-brand-500/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all relative"
              >
                <Bell size={20} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>
              
              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Notifications</h4>
                        <button 
                          onClick={() => { clearNotifications(); setNotifications([]); }}
                          className="text-[10px] font-bold text-brand-600 hover:text-brand-700"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="mx-auto text-slate-200 mb-2" size={32} />
                            <p className="text-xs font-bold text-slate-400">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div 
                              key={n.id} 
                              onClick={async () => { await markNotificationAsRead(n.id); setNotifications(await getNotifications()); }}
                              className={cn(
                                "p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer relative",
                                !n.read && "bg-brand-50/30"
                              )}
                            >
                              {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-600" />}
                              <div className="flex gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                  n.type === 'success' ? "bg-emerald-50 text-emerald-600" :
                                  n.type === 'warning' ? "bg-amber-50 text-amber-600" :
                                  n.type === 'error' ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
                                )}>
                                  {n.type === 'success' ? <CheckCircle2 size={16} /> : 
                                   n.type === 'warning' ? <AlertCircle size={16} /> : 
                                   n.type === 'error' ? <X size={16} /> : <Bell size={16} />}
                                </div>
                                <div>
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-slate-900">{n.title}</p>
                                    <button 
                                      onClick={async (e) => { e.stopPropagation(); await deleteNotification(n.id); setNotifications(await getNotifications()); }}
                                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                                  <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <button 
                          onClick={() => { setActiveView('notifications'); setIsNotificationsOpen(false); }}
                          className="w-full py-3 text-[10px] font-bold text-brand-600 hover:bg-slate-50 border-t border-slate-50 transition-colors uppercase tracking-widest"
                        >
                          View All Notifications
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <button className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all">
              <Settings size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200 mx-2" />
            <div className="flex items-center gap-3 pl-2 group cursor-pointer">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900 leading-none">{userEmail.split('@')[0]}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{userProfile?.role || 'User'}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-100 group-hover:scale-105 transition-transform">
                {userEmail[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area - This is the flexible container */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex-1 overflow-y-auto custom-scrollbar"
              >
                <div className="p-8 space-y-10 max-w-7xl mx-auto w-full">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-wider">Dashboard</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                      </div>
                      <p className="text-sm font-bold text-brand-600 mb-1">Welcome back, {userEmail.split('@')[0]}!</p>
                      <h2 className="text-4xl font-display font-black text-slate-900 tracking-tight">School Overview</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">Export Report</button>
                      <button 
                        onClick={handleGenerateInsights}
                        disabled={isGeneratingInsights}
                        className="px-6 py-3 rounded-2xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center gap-2 disabled:opacity-70"
                      >
                        {isGeneratingInsights ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        Generate Insights
                      </button>
                    </div>
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard icon={Users} label="Total Students" value={students.length.toString()} trend="+2.4%" trendUp={true} />
                  <StatCard icon={CreditCard} label="Revenue" value={`$${totalCollectedFees.toLocaleString()}`} trend="+12.5%" trendUp={true} color="emerald" />
                  <StatCard icon={Calendar} label="Attendance" value={`${avgAttendance}%`} trend="-0.8%" trendUp={false} color="brand" />
                  <StatCard icon={AlertCircle} label="Outstanding" value={`$${totalPendingFees.toLocaleString()}`} trend="+4.2%" trendUp={false} color="amber" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
                          <p className="text-sm text-slate-500">Track latest updates across the school</p>
                        </div>
                        <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><MoreVertical size={20} className="text-slate-400" /></button>
                      </div>
                      <div className="space-y-6">
                        {[
                          { icon: Plus, text: "New student 'John Doe' enrolled in Class 10-A", time: "2 hours ago", color: "bg-brand-50 text-brand-600" },
                          { icon: CreditCard, text: "Fee payment received from Alice Johnson", time: "5 hours ago", color: "bg-emerald-50 text-emerald-600" },
                          { icon: AlertCircle, text: "Attendance alert: Bob Smith absent for 3 days", time: "Yesterday", color: "bg-amber-50 text-amber-600" },
                        ].map((activity, i) => (
                          <div key={i} className="flex items-center gap-5 group cursor-pointer">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", activity.color)}>
                              <activity.icon size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 group-hover:text-brand-600 transition-colors">{activity.text}</p>
                              <p className="text-xs font-medium text-slate-400 mt-0.5">{activity.time}</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-400 transition-colors" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                      <div className="relative z-10">
                        <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-6">
                          <Sparkles className="text-brand-400" size={28} />
                        </div>
                        <h3 className="text-2xl font-bold mb-3 tracking-tight">AI Insights</h3>
                        <div className="text-slate-400 text-sm mb-8 leading-relaxed">
                          {aiInsights ? (
                            <div className="markdown-body text-slate-300">
                              <Markdown>{aiInsights}</Markdown>
                            </div>
                          ) : (
                            <p>Our AI has analyzed your data. Click "Generate Insights" to see the latest trends and urgent actions.</p>
                          )}
                        </div>
                        <button 
                          onClick={() => setActiveView('chat')}
                          className="w-full bg-brand-600 text-white py-4 rounded-2xl font-bold hover:bg-brand-500 transition-all shadow-lg shadow-brand-900/50 flex items-center justify-center gap-2"
                        >
                          View Full Report <ChevronRight size={18} />
                        </button>
                      </div>
                      <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-brand-600/20 rounded-full blur-[80px] group-hover:bg-brand-600/30 transition-colors" />
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-900 mb-6">Quick Actions</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <QuickAction icon={Plus} label="Add Student" onClick={() => { setEditingStudent({}); setIsStudentModalOpen(true); }} color="bg-brand-50 text-brand-600" />
                        <QuickAction icon={Calendar} label="Attendance" onClick={() => setActiveView('attendance')} color="bg-emerald-50 text-emerald-600" />
                        <QuickAction icon={CreditCard} label="Record Fee" onClick={() => setActiveView('fees')} color="bg-amber-50 text-amber-600" />
                        <QuickAction icon={Settings} label="Settings" onClick={() => {
                          setSettingsForm({
                            name: schoolName,
                            year: academicYear,
                            logo: schoolLogo,
                            start: schoolStartTime,
                            end: schoolEndTime,
                            dueDate: globalFeeDueDate
                          });
                          setIsSettingsModalOpen(true);
                        }} color="bg-slate-50 text-slate-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

            {activeView === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8 space-y-6">
                  <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((m) => (
                      <div key={m.id} className={cn("flex gap-4", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", m.role === 'user' ? "bg-brand-600 text-white" : "bg-white border text-brand-600")}>
                          {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 shadow-sm", m.role === 'user' ? "bg-brand-600 text-white" : "bg-white border text-slate-700")}>
                          <div className="prose prose-sm max-w-none markdown-body">
                            <Markdown>{m.content}</Markdown>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLoading && <div className="flex gap-4"><Loader2 size={16} className="animate-spin text-brand-500" /></div>}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                <div className="p-4 lg:p-8 bg-white border-t">
                  <div className="max-w-3xl mx-auto relative">
                    <input 
                      type="text" value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Ask about your school data..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-14 py-4 outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                    <button onClick={handleSend} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-brand-600 text-white rounded-lg flex items-center justify-center">
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === 'students' && (
              <motion.div 
                key="students"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8"
              >
                <div className="max-w-7xl mx-auto w-full space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-wider">Management</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Student Directory</span>
                    </div>
                    <h2 className="text-4xl font-display font-black text-slate-900 tracking-tight">Students</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={exportStudentsToCSV}
                      className="px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                    >
                      <Download size={20} /> Export CSV
                    </button>
                    <button 
                      onClick={() => { setEditingStudent({}); setIsStudentModalOpen(true); }}
                      className="px-8 py-4 rounded-2xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center gap-2"
                    >
                      <Plus size={20} /> Add New Student
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search students by name or class..." 
                        className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500/20 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <select 
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/10"
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                      >
                        <option value="All">All Classes</option>
                        {Array.from(new Set(students.map(s => s.class))).sort().map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select 
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/10"
                        value={feeFilter}
                        onChange={(e) => setFeeFilter(e.target.value)}
                      >
                        <option value="All">All Fees</option>
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                      <select 
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/10"
                        value={attendanceFilter}
                        onChange={(e) => setAttendanceFilter(e.target.value)}
                      >
                        <option value="All">All Attendance</option>
                        <option value="> 90%">{"> 90%"}</option>
                        <option value="> 75%">{"> 75%"}</option>
                        <option value="< 75%">{"< 75%"}</option>
                      </select>
                      <select 
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/10"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                      >
                        <option value="All">All Time</option>
                        <option value="This Month">This Month</option>
                        <option value="This Year">This Year</option>
                      </select>
                      <select 
                        className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/10"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                      >
                        <option value="name-asc">Name (A-Z)</option>
                        <option value="name-desc">Name (Z-A)</option>
                        <option value="attendance-desc">Attendance (High-Low)</option>
                        <option value="attendance-asc">Attendance (Low-High)</option>
                        <option value="date-desc">Newest Enrolled</option>
                        <option value="date-asc">Oldest Enrolled</option>
                      </select>
                      <button 
                        onClick={resetFilters}
                        className="p-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        title="Reset Filters"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Class</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attendance</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fee Status</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enrolled</th>
                          <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((student) => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold">
                                  {student.name[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{student.name}</p>
                                  <p className="text-xs text-slate-400">{student.studentId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                                {student.class}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full",
                                      (student.attendance || 0) > 85 ? "bg-emerald-500" : (student.attendance || 0) > 70 ? "bg-amber-500" : "bg-red-500"
                                    )}
                                    style={{ width: `${student.attendance || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-slate-600">{student.attendance || 0}%</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                                student.feeStatus === 'Paid' ? "bg-emerald-50 text-emerald-600" : 
                                student.feeStatus === 'Unpaid' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                              )}>
                                {student.feeStatus}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <span className="text-xs font-bold text-slate-500">
                                {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => { setSelectedStudentForProfile(student); setIsStudentProfileModalOpen(true); }}
                                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                  title="View Profile"
                                >
                                  <User size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDownloadReportCard(student)}
                                  disabled={isPdfGenerating}
                                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all disabled:opacity-50"
                                  title="Download Report Card"
                                >
                                  {isPdfGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                </button>
                                <button 
                                  onClick={() => handleDownloadFeeReceipt(student)}
                                  disabled={isPdfGenerating}
                                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all disabled:opacity-50"
                                  title="Download Fee Receipt"
                                >
                                  {isPdfGenerating ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
                                </button>
                                <button 
                                  onClick={handlePrint}
                                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                  title="Print"
                                >
                                  <Printer size={16} />
                                </button>
                                <button 
                                  onClick={() => { setSelectedStudentForAttendance(student); setIsStudentAttendanceModalOpen(true); }}
                                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                  title="Attendance History"
                                >
                                  <Calendar size={16} />
                                </button>
                                <button 
                                  onClick={() => { setEditingStudent(student); setIsStudentModalOpen(true); }}
                                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => { setStudentToDelete(student.id); setIsDeleteModalOpen(true); }}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

            {activeView === 'fees' && (
              <motion.div 
                key="fees"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8"
              >
                <div className="max-w-7xl mx-auto w-full space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-wider">Finances</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fee Management</span>
                    </div>
                    <h2 className="text-4xl font-display font-black text-slate-900 tracking-tight">
                      {feeSubView === 'records' ? 'Fee Records' : 'Fee Structures'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
                      <button 
                        onClick={() => setFeeSubView('records')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          feeSubView === 'records' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Records
                      </button>
                      <button 
                        onClick={() => setFeeSubView('structures')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          feeSubView === 'structures' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Structures
                      </button>
                    </div>
                    {feeSubView === 'records' ? (
                      <>
                        <button className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">Download Invoice</button>
                        <button className="px-6 py-3 rounded-2xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200">Send Reminders</button>
                      </>
                    ) : (
                      <button 
                        onClick={() => { setEditingFeeStructure({}); setIsFeeStructureModalOpen(true); }}
                        className="px-6 py-3 rounded-2xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center gap-2"
                      >
                        <Plus size={20} /> Add Structure
                      </button>
                    )}
                  </div>
                </div>

                {feeSubView === 'records' ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Collected</p>
                        <h4 className="text-3xl font-display font-black text-slate-900">${totalCollectedFees.toLocaleString()}</h4>
                        <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: '75%' }} />
                        </div>
                      </div>
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Outstanding Dues</p>
                        <h4 className="text-3xl font-display font-black text-slate-900">${totalPendingFees.toLocaleString()}</h4>
                        <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: '25%' }} />
                        </div>
                      </div>
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Completion Rate</p>
                        <h4 className="text-3xl font-display font-black text-slate-900">
                          {students.length > 0 ? Math.round((paidStudentsCount / students.length) * 100) : 0}%
                        </h4>
                        <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${students.length > 0 ? (paidStudentsCount / students.length) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Fee</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paid</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {students.map((student) => (
                              <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold">
                                      {student.name[0]}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">{student.name}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{student.studentId}</p>
                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{student.class}</p>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-sm font-bold text-slate-600">${student.feeAmount || 0}</td>
                                <td className="px-8 py-5 text-sm font-bold text-emerald-600">${student.paidAmount || 0}</td>
                                <td className="px-8 py-5 text-sm font-bold text-slate-500">{student.dueDate || 'N/A'}</td>
                                <td className="px-8 py-5">
                                  <span className={cn(
                                    "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                                    student.feeStatus === 'Paid' ? "bg-emerald-50 text-emerald-600" : 
                                    student.feeStatus === 'Unpaid' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                                  )}>
                                    {student.feeStatus}
                                  </span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={() => { setSelectedStudentForProfile(student); setIsStudentProfileModalOpen(true); }}
                                      className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                      title="View Profile"
                                    >
                                      <User size={16} />
                                    </button>
                                    <button 
                                      onClick={() => { setSelectedStudentForHistory(student); setIsPaymentHistoryModalOpen(true); }}
                                      className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                      title="Payment History"
                                    >
                                      <Clock size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDownloadFeeReceipt(student)}
                                      disabled={isPdfGenerating}
                                      className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all disabled:opacity-50"
                                      title="Download Fee Receipt"
                                    >
                                      {isPdfGenerating ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
                                    </button>
                                    <button 
                                      onClick={() => handleSendWhatsAppReminder(student)}
                                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                      title="Send WhatsApp Reminder"
                                    >
                                      <MessageCircle size={16} />
                                    </button>
                                    <button 
                                      onClick={() => { setEditingFeeStudent(student); setIsEditFeeModalOpen(true); }}
                                      className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                      title="Edit Fee"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    {student.feeStatus === 'Paid' ? (
                                      <button 
                                        onClick={() => handleUpdateFeeStatus(student.id, 'Unpaid')}
                                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all"
                                      >
                                        Mark Unpaid
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={() => handleUpdateFeeStatus(student.id, 'Paid')}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-all"
                                      >
                                        Mark Paid
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                      <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="Search structures by class or year..." 
                          className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500/20 transition-all"
                          value={feeStructureSearchQuery}
                          onChange={(e) => setFeeStructureSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50">
                            <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Class</th>
                            <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Academic Year</th>
                            <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Fee</th>
                            <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Components</th>
                            <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredFeeStructures.map((structure) => (
                            <tr key={structure.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-8 py-5">
                                <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                                  {structure.className}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-sm font-bold text-slate-600">{structure.academicYear}</td>
                              <td className="px-8 py-5 text-sm font-bold text-brand-600">${structure.totalFee}</td>
                              <td className="px-8 py-5">
                                <div className="flex flex-wrap gap-2">
                                  {structure.components.map((comp, idx) => (
                                    <span key={idx} className="px-2 py-1 rounded-md bg-brand-50 text-brand-600 text-[10px] font-bold">
                                      {comp.name}: ${comp.amount}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={async () => { setEditingFeeStructure(structure); setIsFeeStructureModalOpen(true); }}
                                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteFeeStructure(structure.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

            {activeView === 'attendance' && (
              <motion.div 
                key="attendance"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8"
              >
                <div className="max-w-7xl mx-auto w-full space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-wider">Management</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {attendanceSubView === 'daily' ? 'Daily Tracking' : 'Attendance Reports'}
                      </span>
                    </div>
                    <h2 className="text-4xl font-display font-black text-slate-900 tracking-tight">Attendance</h2>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-100 p-1 rounded-xl flex">
                      <button 
                        onClick={() => setAttendanceSubView('daily')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          attendanceSubView === 'daily' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Daily
                      </button>
                      <button 
                        onClick={() => setAttendanceSubView('reports')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          attendanceSubView === 'reports' ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Reports
                      </button>
                    </div>

                    {attendanceSubView === 'daily' ? (
                      <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                        <Calendar className="ml-3 text-brand-600" size={20} />
                        <input 
                          type="date" 
                          className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 pr-4 py-2"
                          value={attendanceDate}
                          onChange={(e) => setAttendanceDate(e.target.value)}
                        />
                      </div>
                    ) : (
                      <button 
                        onClick={exportAttendanceToCSV}
                        className="px-6 py-3 rounded-2xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center gap-2"
                      >
                        <Download size={20} /> Export Report
                      </button>
                    )}
                  </div>
                </div>

                {attendanceSubView === 'daily' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="text-lg font-bold text-slate-900">Student List</h3>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Present</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Absent</span>
                          </div>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {students.map((student) => (
                          <div key={student.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold">
                                {student.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">{student.name}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{student.studentId}</p>
                                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{student.class}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => toggleAttendance(student.id)}
                                className={cn(
                                  "px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                                  currentAttendance[student.id] === 'Present' 
                                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                                    : "bg-red-600 text-white shadow-lg shadow-red-200"
                                )}
                              >
                                {currentAttendance[student.id] || 'Present'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button 
                          onClick={handleSaveAttendance}
                          className="px-10 py-4 rounded-2xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center gap-2"
                        >
                          <CheckCircle2 size={20} /> Save Attendance Records
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-900 mb-6">Summary</h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-500">Total Students</p>
                          <p className="text-lg font-black text-slate-900">{students.length}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-500">Present</p>
                          <p className="text-lg font-black text-emerald-600">{Object.values(currentAttendance).filter(v => v === 'Present').length}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-500">Absent</p>
                          <p className="text-lg font-black text-red-600">{Object.values(currentAttendance).filter(v => v === 'Absent').length}</p>
                        </div>
                        <div className="pt-6 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Daily Rate</p>
                            <p className="text-xs font-black text-brand-600">
                              {students.length > 0 ? Math.round((Object.values(currentAttendance).filter(v => v === 'Present').length / students.length) * 100) : 0}%
                            </p>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-brand-500 rounded-full" 
                              style={{ width: `${students.length > 0 ? (Object.values(currentAttendance).filter(v => v === 'Present').length / students.length) * 100 : 0}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-900 mb-6">Recent History</h3>
                      <div className="space-y-4">
                        {attendanceHistory.slice(0, 5).map((record, i) => {
                          const presentCount = Object.values(record.records).filter(v => v === 'Present').length;
                          return (
                            <div 
                              key={i} 
                              onClick={() => setAttendanceDate(record.date)}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group",
                                attendanceDate === record.date ? "bg-brand-50 border-brand-200" : "bg-white border-transparent hover:bg-slate-50"
                              )}
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-800">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{presentCount} Present</p>
                              </div>
                              <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-400 transition-colors" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                  <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Start Date</label>
                          <input 
                            type="date" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/10"
                            value={reportStartDate}
                            onChange={(e) => setReportStartDate(e.target.value)}
                            max={reportEndDate}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">End Date</label>
                          <input 
                            type="date" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/10"
                            value={reportEndDate}
                            onChange={(e) => setReportEndDate(e.target.value)}
                            min={reportStartDate}
                            max={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Month</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/10"
                            value={reportMonthFilter}
                            onChange={(e) => setReportMonthFilter(e.target.value)}
                          >
                            <option value="All">All Months</option>
                            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                              <option key={m} value={(i + 1).toString()}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Year</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/10"
                            value={reportYearFilter}
                            onChange={(e) => setReportYearFilter(e.target.value)}
                          >
                            <option value="All">All Years</option>
                            {[2024, 2025, 2026].map(y => (
                              <option key={y} value={y.toString()}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Class</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/10"
                            value={reportClassFilter}
                            onChange={(e) => setReportClassFilter(e.target.value)}
                          >
                            <option value="All">All Classes</option>
                            {Array.from(new Set(students.map(s => s.class))).sort().map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/10"
                            value={reportStatusFilter}
                            onChange={(e) => setReportStatusFilter(e.target.value)}
                          >
                            <option value="All">All Status</option>
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Search Student</label>
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                              type="text" 
                              placeholder="Name or ID..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/10"
                              value={reportSearchQuery}
                              onChange={(e) => setReportSearchQuery(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end mt-6">
                        <button 
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 30);
                            setReportStartDate(d.toISOString().split('T')[0]);
                            setReportEndDate(new Date().toISOString().split('T')[0]);
                            setReportClassFilter('All');
                            setReportStatusFilter('All');
                            setReportSearchQuery('');
                            setReportMonthFilter('All');
                            setReportYearFilter('All');
                          }}
                          className="text-xs font-bold text-slate-400 hover:text-brand-600 transition-colors uppercase tracking-widest"
                        >
                          Reset Filters
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Class</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredAttendanceReport.length > 0 ? (
                              filteredAttendanceReport.map((item) => (
                                <tr key={`${item.date}-${item.student.id}`} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-8 py-5 text-xs font-bold text-slate-600">
                                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </td>
                                  <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-xs">
                                        {item.student.name[0]}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-slate-900">{item.student.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.student.studentId}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-5">
                                    <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                                      {item.student.class}
                                    </span>
                                  </td>
                                  <td className="px-8 py-5">
                                    <span className={cn(
                                      "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                      item.status === 'Present' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                    )}>
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="px-8 py-12 text-center">
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                                      <Search size={24} />
                                    </div>
                                    <p className="text-sm font-bold text-slate-400 italic">No attendance records found for the selected filters</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                </div>
            </motion.div>
          )}

          {activeView === 'notifications' && (
            <motion.div 
              key="notifications"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex-1 overflow-y-auto custom-scrollbar"
            >
              <div className="p-8 space-y-10 max-w-7xl mx-auto w-full">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-wider">System</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activity Log</span>
                    </div>
                    <h2 className="text-4xl font-display font-black text-slate-900 tracking-tight">Notifications</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => { clearNotifications(); setNotifications([]); }}
                      className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-bold text-red-600 hover:bg-red-50 transition-all shadow-sm flex items-center gap-2"
                    >
                      <Trash2 size={18} /> Clear All
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Bell size={40} className="text-slate-200" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">All caught up!</h3>
                        <p className="text-slate-500 max-w-xs mx-auto">You don't have any notifications at the moment. Check back later for system updates.</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          className={cn(
                            "p-8 flex items-start gap-6 hover:bg-slate-50/50 transition-colors group relative",
                            !n.read && "bg-brand-50/20"
                          )}
                        >
                          {!n.read && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand-600" />}
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                            n.type === 'success' ? "bg-emerald-50 text-emerald-600" :
                            n.type === 'warning' ? "bg-amber-50 text-amber-600" :
                            n.type === 'error' ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
                          )}>
                            {n.type === 'success' ? <CheckCircle2 size={24} /> : 
                             n.type === 'warning' ? <AlertCircle size={24} /> : 
                             n.type === 'error' ? <X size={24} /> : <Bell size={24} />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-lg font-bold text-slate-900">{n.title}</h4>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {new Date(n.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-slate-600 leading-relaxed max-w-2xl">{n.message}</p>
                            <div className="mt-4 flex items-center gap-4">
                              {!n.read && (
                                <button 
                                  onClick={async () => { await markNotificationAsRead(n.id); setNotifications(await getNotifications()); }}
                                  className="text-xs font-bold text-brand-600 hover:text-brand-700 uppercase tracking-widest"
                                >
                                  Mark as read
                                </button>
                              )}
                              <button 
                                onClick={async () => { await deleteNotification(n.id); setNotifications(await getNotifications()); }}
                                className="text-xs font-bold text-slate-400 hover:text-red-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </main>
      </div>

      {/* Student Modal */}
      <AnimatePresence>
        {isStudentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsStudentModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden">
              <form onSubmit={handleSaveStudent} className="p-8 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900">{editingStudent?.id ? 'Edit Student' : 'Add New Student'}</h3>
                  {editingStudent?.studentId && (
                    <span className="px-3 py-1 rounded-lg bg-brand-50 text-brand-600 text-[10px] font-bold uppercase tracking-wider">
                      {editingStudent.studentId}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Student ID</label>
                    <div className="w-full px-4 py-2 rounded-lg border border-slate-100 bg-slate-50 text-slate-500 font-mono text-sm">
                      {editingStudent?.studentId || 'Auto-generated'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                    <input required value={editingStudent?.name || ''} onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Class</label>
                    <select 
                      required 
                      value={editingStudent?.class || ''} 
                      onChange={(e) => {
                        const newClass = e.target.value;
                        const matchingStructure = feeStructures.find(fs => 
                          fs.className === newClass && fs.academicYear === (editingStudent?.academicYear || academicYear)
                        );
                        setEditingStudent({
                          ...editingStudent, 
                          class: newClass,
                          feeAmount: matchingStructure ? matchingStructure.totalFee : (editingStudent?.feeAmount || 0)
                        });
                      }} 
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500"
                    >
                      <option value="" disabled>Select Class</option>
                      {Array.from(new Set(feeStructures.map(fs => fs.className))).sort().map(className => (
                        <option key={className} value={className}>{className}</option>
                      ))}
                      {editingStudent?.class && !feeStructures.some(fs => fs.className === editingStudent.class) && (
                        <option value={editingStudent.class}>{editingStudent.class}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Academic Year</label>
                    <select 
                      required 
                      value={editingStudent?.academicYear || academicYear} 
                      onChange={(e) => {
                        const newYear = e.target.value;
                        const matchingStructure = feeStructures.find(fs => 
                          fs.className === editingStudent?.class && fs.academicYear === newYear
                        );
                        setEditingStudent({
                          ...editingStudent, 
                          academicYear: newYear,
                          feeAmount: matchingStructure ? matchingStructure.totalFee : (editingStudent?.feeAmount || 0)
                        });
                      }} 
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500"
                    >
                      {Array.from(new Set(feeStructures.map(fs => fs.academicYear))).sort().map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                      {!feeStructures.some(fs => fs.academicYear === academicYear) && (
                        <option value={academicYear}>{academicYear}</option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 uppercase">Fee Amount ($)</label>
                      {editingStudent?.class && feeStructures.find(fs => fs.className === editingStudent.class && fs.academicYear === (editingStudent?.academicYear || academicYear)) && (
                        <button 
                          type="button"
                          onClick={() => {
                            const structure = feeStructures.find(fs => fs.className === editingStudent.class && fs.academicYear === (editingStudent?.academicYear || academicYear));
                            setEditingStudent({
                              ...editingStudent, 
                              feeAmount: structure?.totalFee
                            });
                          }}
                          className="text-[10px] font-bold text-brand-600 hover:text-brand-700"
                        >
                          Apply Structure: ${feeStructures.find(fs => fs.className === editingStudent.class && fs.academicYear === (editingStudent?.academicYear || academicYear))?.totalFee}
                        </button>
                      )}
                    </div>
                    <input type="number" required value={editingStudent?.feeAmount || ''} onChange={(e) => setEditingStudent({...editingStudent, feeAmount: parseInt(e.target.value)})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Paid Amount ($)</label>
                    <input type="number" required value={editingStudent?.paidAmount ?? ''} onChange={(e) => setEditingStudent({...editingStudent, paidAmount: parseInt(e.target.value)})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Fee Status</label>
                    <select value={editingStudent?.feeStatus || 'Unpaid'} onChange={(e) => setEditingStudent({...editingStudent, feeStatus: e.target.value as any})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500">
                      <option>Paid</option><option>Unpaid</option><option>Overdue</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Due Date</label>
                    <input type="date" required value={editingStudent?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} onChange={(e) => setEditingStudent({...editingStudent, dueDate: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Attendance %</label>
                    <input type="number" value={editingStudent?.attendance || 100} onChange={(e) => setEditingStudent({...editingStudent, attendance: parseInt(e.target.value)})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Enrollment Date</label>
                    <input type="date" required value={editingStudent?.enrollmentDate || new Date().toISOString().split('T')[0]} onChange={(e) => setEditingStudent({...editingStudent, enrollmentDate: e.target.value})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Parent Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Father's Name</label>
                      <input value={editingStudent?.parentInfo?.fatherName || ''} onChange={(e) => setEditingStudent({...editingStudent, parentInfo: {...(editingStudent?.parentInfo || { motherName: '', phone: '', email: '', address: '' }), fatherName: e.target.value}})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Mother's Name</label>
                      <input value={editingStudent?.parentInfo?.motherName || ''} onChange={(e) => setEditingStudent({...editingStudent, parentInfo: {...(editingStudent?.parentInfo || { fatherName: '', phone: '', email: '', address: '' }), motherName: e.target.value}})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
                      <input value={editingStudent?.parentInfo?.phone || ''} onChange={(e) => setEditingStudent({...editingStudent, parentInfo: {...(editingStudent?.parentInfo || { fatherName: '', motherName: '', email: '', address: '' }), phone: e.target.value}})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                      <input type="email" value={editingStudent?.parentInfo?.email || ''} onChange={(e) => setEditingStudent({...editingStudent, parentInfo: {...(editingStudent?.parentInfo || { fatherName: '', motherName: '', phone: '', address: '' }), email: e.target.value}})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Address</label>
                    <textarea rows={2} value={editingStudent?.parentInfo?.address || ''} onChange={(e) => setEditingStudent({...editingStudent, parentInfo: {...(editingStudent?.parentInfo || { fatherName: '', motherName: '', phone: '', email: '' }), address: e.target.value}})} className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 resize-none" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsStudentModalOpen(false)} className="flex-1 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                  <button type="submit" className="flex-1 bg-brand-600 text-white py-2 rounded-lg font-bold hover:bg-brand-700">Save Student</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-sm rounded-3xl shadow-2xl relative z-10 overflow-hidden">
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Delete Student?</h3>
                <p className="text-slate-500 mt-2">This action cannot be undone. Are you sure you want to remove this student from the database?</p>
                <div className="flex gap-3 mt-8">
                  <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
                  <button onClick={confirmDelete} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200">Delete</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fee Structure Modal */}
      <AnimatePresence>
        {isFeeStructureModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFeeStructureModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden">
              <form onSubmit={handleSaveFeeStructure} className="p-8 space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-display font-black text-slate-900 tracking-tight">
                    {editingFeeStructure?.id ? 'Edit Structure' : 'Add Fee Structure'}
                  </h3>
                  <button type="button" onClick={() => setIsFeeStructureModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} className="text-slate-400" /></button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Class Name</label>
                    <input 
                      required 
                      placeholder="e.g. 10-A"
                      value={editingFeeStructure?.className || ''} 
                      onChange={(e) => setEditingFeeStructure({...editingFeeStructure, className: e.target.value})} 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500/20 transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Academic Year</label>
                    <input 
                      required 
                      placeholder="e.g. 2025-2026"
                      value={editingFeeStructure?.academicYear || academicYear} 
                      onChange={(e) => setEditingFeeStructure({...editingFeeStructure, academicYear: e.target.value})} 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500/20 transition-all" 
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fee Components</label>
                      <button 
                        type="button"
                        onClick={() => {
                          const comps = [...(editingFeeStructure?.components || []), { name: '', amount: 0 }];
                          setEditingFeeStructure({...editingFeeStructure, components: comps});
                        }}
                        className="text-xs font-bold text-brand-600 hover:text-brand-700"
                      >
                        + Add Component
                      </button>
                    </div>
                    <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                      {(editingFeeStructure?.components || []).map((comp, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            required
                            placeholder="Name"
                            value={comp.name}
                            onChange={(e) => {
                              const comps = [...(editingFeeStructure?.components || [])];
                              comps[idx].name = e.target.value;
                              setEditingFeeStructure({...editingFeeStructure, components: comps});
                            }}
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                          />
                          <input 
                            required
                            type="number"
                            placeholder="Amount"
                            value={comp.amount || ''}
                            onChange={(e) => {
                              const comps = [...(editingFeeStructure?.components || [])];
                              comps[idx].amount = parseInt(e.target.value) || 0;
                              const total = comps.reduce((sum, c) => sum + c.amount, 0);
                              setEditingFeeStructure({...editingFeeStructure, components: comps, totalFee: total});
                            }}
                            className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const comps = (editingFeeStructure?.components || []).filter((_, i) => i !== idx);
                              const total = comps.reduce((sum, c) => sum + c.amount, 0);
                              setEditingFeeStructure({...editingFeeStructure, components: comps, totalFee: total});
                            }}
                            className="p-2 text-red-400 hover:text-red-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Fee:</span>
                    <span className="text-2xl font-display font-black text-brand-600">${editingFeeStructure?.totalFee || 0}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsFeeStructureModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200">Save Structure</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Payment History Modal */}
      <AnimatePresence>
        {isPaymentHistoryModalOpen && selectedStudentForHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPaymentHistoryModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-display font-black text-slate-900 tracking-tight">Payment History</h3>
                    <p className="text-sm text-slate-500">Student: {selectedStudentForHistory.name}</p>
                  </div>
                  <button onClick={() => setIsPaymentHistoryModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} className="text-slate-400" /></button>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Fee</p>
                      <p className="text-lg font-black text-slate-900">${selectedStudentForHistory.feeAmount}</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Total Paid</p>
                      <p className="text-lg font-black text-emerald-600">${selectedStudentForHistory.paidAmount}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Balance</p>
                      <p className="text-lg font-black text-red-600">${selectedStudentForHistory.feeAmount - selectedStudentForHistory.paidAmount}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Method</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedStudentForHistory.paymentHistory.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm font-bold">No payment records found</td>
                          </tr>
                        ) : (
                          selectedStudentForHistory.paymentHistory.map((history) => (
                            <tr key={history.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 text-sm font-bold text-slate-600">{history.date}</td>
                              <td className="px-6 py-4 text-sm font-bold text-emerald-600">${history.amount}</td>
                              <td className="px-6 py-4 text-sm font-bold text-slate-500">{history.method}</td>
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={async () => {
                                    const newHistory = selectedStudentForHistory.paymentHistory.filter(h => h.id !== history.id);
                                    const newPaidAmount = newHistory.reduce((sum, h) => sum + h.amount, 0);
                                    const today = new Date().toISOString().split('T')[0];
                                    let status: 'Paid' | 'Unpaid' | 'Overdue' = newPaidAmount >= selectedStudentForHistory.feeAmount ? 'Paid' : 'Unpaid';
                                    if (status === 'Unpaid' && selectedStudentForHistory.dueDate < today) {
                                      status = 'Overdue';
                                    }

                                    const structure = feeStructures.find(fs => fs.id === selectedStudentForHistory.feeStructureId);
                                    let newComponentPayments: { [key: string]: number } = {};
                                    if (structure) {
                                      let remainingAmount = newPaidAmount;
                                      structure.components.forEach(comp => {
                                        if (remainingAmount > 0) {
                                          const paymentToComp = Math.min(remainingAmount, comp.amount);
                                          newComponentPayments[comp.name] = paymentToComp;
                                          remainingAmount -= paymentToComp;
                                        } else {
                                          newComponentPayments[comp.name] = 0;
                                        }
                                      });
                                    }

                                    const updatedStudent = { 
                                      ...selectedStudentForHistory, 
                                      paidAmount: newPaidAmount, 
                                      feeStatus: status, 
                                      paymentHistory: newHistory,
                                      componentPayments: newComponentPayments
                                    };
                                    await saveStudent(updatedStudent);
                                    const allStudents = await getStudents();
                                    setStudents(allStudents);
                                    setSelectedStudentForHistory(updatedStudent);
                                  }}
                                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Remove Entry"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Add New Payment</h4>
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const amount = parseInt((form.elements.namedItem('amount') as HTMLInputElement).value);
                        const method = (form.elements.namedItem('method') as HTMLSelectElement).value;
                        const note = (form.elements.namedItem('note') as HTMLInputElement).value;
                        await handleAddPayment(selectedStudentForHistory.id, amount, method, note);
                        form.reset();
                        const allStudents = await getStudents();
                        setSelectedStudentForHistory(allStudents.find(s => s.id === selectedStudentForHistory.id) || null);
                      }}
                      className="grid grid-cols-4 gap-3"
                    >
                      <input name="amount" type="number" required placeholder="Amount" className="px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-500" />
                      <select name="method" className="px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-500">
                        <option>Cash</option>
                        <option>Online</option>
                        <option>Bank Transfer</option>
                        <option>Cheque</option>
                      </select>
                      <input name="note" placeholder="Note (optional)" className="px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-500" />
                      <button type="submit" className="bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-all">Add</button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Fee Modal */}
      <AnimatePresence>
        {isEditFeeModalOpen && editingFeeStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditFeeModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden">
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const newTotal = parseInt((form.elements.namedItem('totalFee') as HTMLInputElement).value);
                  const newDueDate = (form.elements.namedItem('dueDate') as HTMLInputElement).value;
                  const today = new Date().toISOString().split('T')[0];
                  let status: 'Paid' | 'Unpaid' | 'Overdue' = editingFeeStudent.paidAmount >= newTotal ? 'Paid' : 'Unpaid';
                  if (status === 'Unpaid' && newDueDate < today) {
                    status = 'Overdue';
                  }

                  const structure = feeStructures.find(fs => fs.id === editingFeeStudent.feeStructureId);
                  let newComponentPayments: { [key: string]: number } = {};
                  if (structure) {
                    let remainingAmount = editingFeeStudent.paidAmount;
                    structure.components.forEach(comp => {
                      if (remainingAmount > 0) {
                        const paymentToComp = Math.min(remainingAmount, comp.amount);
                        newComponentPayments[comp.name] = paymentToComp;
                        remainingAmount -= paymentToComp;
                      } else {
                        newComponentPayments[comp.name] = 0;
                      }
                    });
                  }

                  const updatedStudent = { 
                    ...editingFeeStudent, 
                    feeAmount: newTotal, 
                    dueDate: newDueDate, 
                    feeStatus: status,
                    componentPayments: newComponentPayments
                  };
                  await saveStudent(updatedStudent);
                  const allStudents = await getStudents();
                  setStudents(allStudents);
                  setIsEditFeeModalOpen(false);
                }}
                className="p-8 space-y-6"
              >
                <h3 className="text-2xl font-display font-black text-slate-900 tracking-tight">Edit Fee Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Total Fee Amount ($)</label>
                    <input name="totalFee" type="number" required defaultValue={editingFeeStudent.feeAmount} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Due Date</label>
                    <input name="dueDate" type="date" required defaultValue={editingFeeStudent.dueDate} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditFeeModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-bold hover:bg-brand-700 transition-all">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Profile Modal */}
      <AnimatePresence>
        {isStudentProfileModalOpen && selectedStudentForProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsStudentProfileModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-[2rem] bg-brand-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-brand-200">
                      {selectedStudentForProfile.name[0]}
                    </div>
                    <div>
                      <h3 className="text-3xl font-display font-black text-slate-900 tracking-tight">{selectedStudentForProfile.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="px-3 py-1 rounded-lg bg-brand-50 text-brand-600 text-xs font-bold uppercase tracking-wider">{selectedStudentForProfile.studentId}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-sm font-bold text-slate-500">Class {selectedStudentForProfile.class}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setIsStudentProfileModalOpen(false)} className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all"><X size={24} className="text-slate-400" /></button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Basic Info */}
                  <div className="space-y-8">
                    <section className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <User size={14} className="text-brand-500" /> Basic Information
                      </h4>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500">Enrollment Date</span>
                          <span className="text-xs font-black text-slate-900">{selectedStudentForProfile.enrollmentDate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500">Current Status</span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase">Active</span>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Middle Column: Attendance & Academic */}
                  <div className="lg:col-span-2 space-y-8">
                    {/* Attendance Trends */}
                    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <TrendingUp size={14} className="text-brand-500" /> Attendance Trends
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-slate-900">{selectedStudentForProfile.attendance}%</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average</span>
                        </div>
                      </div>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getAttendanceTrends(selectedStudentForProfile.id)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px 12px' }}
                              labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}
                            />
                            <Line type="monotone" dataKey="percentage" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </section>

                    {/* Parent/Guardian Information */}
                    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <ShieldCheck size={14} className="text-brand-500" /> Parent/Guardian Information
                        </h4>
                      </div>
                      
                      {selectedStudentForProfile.parentInfo ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Father's Name</p>
                                <p className="text-sm font-black text-slate-900">{selectedStudentForProfile.parentInfo.fatherName}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mother's Name</p>
                                <p className="text-sm font-black text-slate-900">{selectedStudentForProfile.parentInfo.motherName}</p>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Home Address</p>
                              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <MapPin size={14} className="text-brand-500 mt-0.5" />
                                <p className="text-xs font-bold text-slate-700 leading-relaxed">{selectedStudentForProfile.parentInfo.address}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Details</p>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-brand-600 shadow-sm">
                                    <Phone size={14} />
                                  </div>
                                  <span className="text-xs font-bold text-slate-700">{selectedStudentForProfile.parentInfo.phone}</span>
                                </div>
                                <button className="text-[10px] font-black text-brand-600 uppercase tracking-wider hover:underline">Call</button>
                              </div>
                              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-brand-600 shadow-sm">
                                    <Mail size={14} />
                                  </div>
                                  <span className="text-xs font-bold text-slate-700">{selectedStudentForProfile.parentInfo.email}</span>
                                </div>
                                <button className="text-[10px] font-black text-brand-600 uppercase tracking-wider hover:underline">Email</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-xs font-bold text-slate-400 italic">No parent or guardian information has been recorded for this student.</p>
                        </div>
                      )}
                    </section>

                    {/* Academic Performance */}
                    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <BookOpen size={14} className="text-brand-500" /> Academic Performance
                        </h4>
                        <button 
                          onClick={() => setIsAddGradeFormOpen(!isAddGradeFormOpen)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 text-brand-600 text-[10px] font-black uppercase tracking-wider hover:bg-brand-100 transition-all"
                        >
                          <Plus size={12} />
                          {isAddGradeFormOpen ? 'Cancel' : 'Add Grade'}
                        </button>
                      </div>

                      <AnimatePresence>
                        {isAddGradeFormOpen && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mb-6"
                          >
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Subject</label>
                                  <input 
                                    placeholder="e.g. Mathematics"
                                    value={newGrade.subject}
                                    onChange={(e) => setNewGrade({ ...newGrade, subject: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-brand-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Term</label>
                                  <input 
                                    placeholder="e.g. Final Exam"
                                    value={newGrade.term}
                                    onChange={(e) => setNewGrade({ ...newGrade, term: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-brand-500"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Score</label>
                                  <input 
                                    type="number"
                                    value={newGrade.score}
                                    onChange={(e) => setNewGrade({ ...newGrade, score: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-brand-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Score</label>
                                  <input 
                                    type="number"
                                    value={newGrade.total}
                                    onChange={(e) => setNewGrade({ ...newGrade, total: parseInt(e.target.value) || 100 })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-brand-500"
                                  />
                                </div>
                              </div>
                              <button 
                                onClick={() => handleAddGrade(selectedStudentForProfile.id)}
                                className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-100"
                              >
                                Save Grade Entry
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subject</th>
                              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Term</th>
                              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</th>
                              <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {selectedStudentForProfile.grades && selectedStudentForProfile.grades.length > 0 ? (
                              selectedStudentForProfile.grades.map((grade) => {
                                const percentage = (grade.score / grade.total) * 100;
                                let letterGrade = 'F';
                                if (percentage >= 90) letterGrade = 'A+';
                                else if (percentage >= 80) letterGrade = 'A';
                                else if (percentage >= 70) letterGrade = 'B';
                                else if (percentage >= 60) letterGrade = 'C';
                                else if (percentage >= 50) letterGrade = 'D';

                                return (
                                  <tr key={grade.id} className="group/grade">
                                    <td className="py-4 text-sm font-bold text-slate-900">{grade.subject}</td>
                                    <td className="py-4 text-xs font-bold text-slate-500">{grade.term}</td>
                                    <td className="py-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-slate-900">{grade.score}</span>
                                        <span className="text-[10px] font-bold text-slate-400">/ {grade.total}</span>
                                      </div>
                                    </td>
                                    <td className="py-4">
                                      <div className="flex items-center justify-between">
                                        <span className={cn(
                                          "px-2 py-1 rounded-md text-[10px] font-black uppercase",
                                          percentage >= 80 ? "bg-emerald-50 text-emerald-600" : percentage >= 60 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                                        )}>
                                          {letterGrade}
                                        </span>
                                        <button 
                                          onClick={async () => {
                                            if (window.confirm('Are you sure you want to remove this grade entry?')) {
                                              handleRemoveGrade(selectedStudentForProfile.id, grade.id);
                                            }
                                          }}
                                          className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover/grade:opacity-100"
                                          title="Remove Grade"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-xs font-bold text-slate-400 italic">No academic records available</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* Fee Breakdown */}
                    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <PieChart size={14} className="text-brand-500" /> Fee Breakdown
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">Academic Year:</span>
                          <span className="text-xs font-black text-slate-900">{selectedStudentForProfile.academicYear}</span>
                        </div>
                      </div>
                      
                      {feeStructures.find(fs => fs.id === selectedStudentForProfile.feeStructureId) ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {feeStructures.find(fs => fs.id === selectedStudentForProfile.feeStructureId)?.components.map((comp) => {
                              const paid = selectedStudentForProfile.componentPayments?.[comp.name] || 0;
                              const percentage = (paid / comp.amount) * 100;
                              
                              return (
                                <div key={comp.name} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <p className="text-xs font-bold text-slate-900">{comp.name}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target: ${comp.amount}</p>
                                    </div>
                                    <span className={cn(
                                      "text-[10px] font-black px-2 py-0.5 rounded-md uppercase",
                                      percentage >= 100 ? "bg-emerald-50 text-emerald-600" : percentage > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-200 text-slate-500"
                                    )}>
                                      {percentage >= 100 ? 'Paid' : percentage > 0 ? 'Partial' : 'Unpaid'}
                                    </span>
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold">
                                      <span className="text-slate-500">Paid: ${paid}</span>
                                      <span className="text-slate-900">{Math.round(percentage)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        className={cn(
                                          "h-full rounded-full",
                                          percentage >= 100 ? "bg-emerald-500" : "bg-brand-500"
                                        )}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-xs font-bold text-slate-400 italic">No fee structure assigned to this student</p>
                        </div>
                      )}
                    </section>

                    {/* Fee Payment History */}
                    <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <CreditCard size={14} className="text-brand-500" /> Fee Payment History
                        </h4>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Paid</p>
                            <p className="text-sm font-black text-emerald-600">${selectedStudentForProfile.paidAmount}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balance</p>
                            <p className="text-sm font-black text-red-600">${selectedStudentForProfile.feeAmount - selectedStudentForProfile.paidAmount}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {selectedStudentForProfile.paymentHistory && selectedStudentForProfile.paymentHistory.length > 0 ? (
                          selectedStudentForProfile.paymentHistory.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group/payment">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                                  <CheckCircle2 size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{payment.method}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{payment.date}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-sm font-black text-slate-900">${payment.amount}</p>
                                  {payment.note && <p className="text-[10px] font-bold text-slate-400">{payment.note}</p>}
                                </div>
                                <button 
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to remove this payment entry? This will update the student\'s total paid amount and fee status.')) {
                                      handleRemovePayment(selectedStudentForProfile.id, payment.id);
                                    }
                                  }}
                                  className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/payment:opacity-100"
                                  title="Remove Entry"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-xs font-bold text-slate-400 italic">No payment history found</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Attendance History Modal */}
      <AnimatePresence>
        {isStudentAttendanceModalOpen && selectedStudentForAttendance && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsStudentAttendanceModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-display font-black text-slate-900 tracking-tight">Attendance History</h3>
                    <p className="text-sm text-slate-500 font-medium">{selectedStudentForAttendance.name} ({selectedStudentForAttendance.studentId})</p>
                  </div>
                  <button onClick={() => setIsStudentAttendanceModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} className="text-slate-400" /></button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Date</label>
                    <input 
                      type="date" 
                      value={studentAttendanceStartDate}
                      onChange={(e) => setStudentAttendanceStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End Date</label>
                    <input 
                      type="date" 
                      value={studentAttendanceEndDate}
                      onChange={(e) => setStudentAttendanceEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/10"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/50">
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const filteredRecords = attendanceHistory
                            .filter(record => record.date >= studentAttendanceStartDate && record.date <= studentAttendanceEndDate)
                            .sort((a, b) => b.date.localeCompare(a.date))
                            .map(record => ({
                              date: record.date,
                              status: record.records[selectedStudentForAttendance.id]
                            }))
                            .filter(item => item.status);

                          if (filteredRecords.length === 0) {
                            return (
                              <tr>
                                <td colSpan={2} className="px-6 py-12 text-center">
                                  <Calendar className="mx-auto text-slate-200 mb-2" size={32} />
                                  <p className="text-xs font-bold text-slate-400">No attendance records found for this period</p>
                                </td>
                              </tr>
                            );
                          }

                          return filteredRecords.map((item) => (
                            <tr key={item.date} className="hover:bg-white transition-colors">
                              <td className="px-6 py-4 text-sm font-bold text-slate-600">
                                {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                                  item.status === 'Present' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                )}>
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button onClick={() => setIsStudentAttendanceModalOpen(false)} className="px-8 py-4 rounded-2xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsModalOpen(false)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-display font-black text-slate-900 tracking-tight">School Configuration</h3>
                    <p className="text-sm text-slate-500 font-medium">Manage your school's identity and global settings</p>
                  </div>
                  <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} className="text-slate-400" /></button>
                </div>
                
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">School Name</label>
                      <input 
                        type="text" 
                        value={settingsForm.name}
                        onChange={(e) => setSettingsForm({...settingsForm, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-brand-500/10 focus:bg-white focus:border-brand-500/20 transition-all"
                        placeholder="School Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Academic Year</label>
                      <input 
                        type="text" 
                        value={settingsForm.year}
                        onChange={(e) => setSettingsForm({...settingsForm, year: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-brand-500/10 focus:bg-white focus:border-brand-500/20 transition-all"
                        placeholder="2025-2026"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">School Logo</label>
                    <div className="flex gap-4 items-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-200 shrink-0">
                        {settingsForm.logo ? (
                          <img src={settingsForm.logo} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <GraduationCap className="text-slate-300" size={24} />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input 
                          type="text" 
                          value={settingsForm.logo}
                          onChange={(e) => setSettingsForm({...settingsForm, logo: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-brand-500/10 focus:bg-white focus:border-brand-500/20 transition-all"
                          placeholder="Logo URL or upload below"
                        />
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setSettingsForm({ ...settingsForm, logo: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">School Starts</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="time" 
                          value={settingsForm.start}
                          onChange={(e) => setSettingsForm({...settingsForm, start: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-brand-500/10 focus:bg-white focus:border-brand-500/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">School Ends</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="time" 
                          value={settingsForm.end}
                          onChange={(e) => setSettingsForm({...settingsForm, end: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-slate-900 font-bold outline-none focus:ring-4 focus:ring-brand-500/10 focus:bg-white focus:border-brand-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Monthly Fee Due Day</label>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" min="1" max="28" 
                        value={settingsForm.dueDate}
                        onChange={(e) => setSettingsForm({...settingsForm, dueDate: e.target.value})}
                        className="flex-1 accent-brand-600"
                      />
                      <span className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm border border-brand-100">
                        {settingsForm.dueDate}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fees will be marked overdue after the {settingsForm.dueDate}th of each month</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-8 mt-4 border-t border-slate-100">
                  <button onClick={() => setIsSettingsModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
                  <button onClick={handleSaveSettings} className="flex-1 bg-brand-600 text-white py-4 rounded-2xl font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} /> Save Settings
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ active, onClick, icon: Icon, label, badge }: { active: boolean, onClick: () => void, icon: any, label: string, badge?: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 text-sm font-bold rounded-2xl transition-all group",
        active 
          ? "bg-brand-600 text-white shadow-lg shadow-brand-200 translate-x-1" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} className={cn("transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-brand-600")} />
        {label}
      </div>
      {badge && (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
          active ? "bg-white/20 text-white" : "bg-brand-100 text-brand-600"
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ icon: Icon, label, value, trend, trendUp, color = 'brand' }: { icon: any, label: string, value: string, trend: string, trendUp: boolean, color?: string }) {
  const colors: any = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", colors[color])}>
        <Icon size={28} />
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <h4 className="text-3xl font-display font-black text-slate-900 mt-2 tracking-tight">{value}</h4>
      <div className="flex items-center gap-2 mt-4">
        <span className={cn(
          "px-2 py-1 rounded-lg text-[10px] font-bold",
          trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        )}>
          {trend}
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">vs last month</span>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, color }: { icon: any, label: string, onClick: () => void, color: string }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all group"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", color)}>
        <Icon size={20} />
      </div>
      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{label}</span>
    </button>
  );
}
