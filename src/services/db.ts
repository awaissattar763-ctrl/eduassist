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

const INITIAL_STUDENTS: Student[] = [
  { 
    id: "1", 
    studentId: "STU-001", 
    name: "Alice Johnson", 
    class: "10-A", 
    academicYear: "2025-2026",
    feeStatus: "Paid", 
    feeAmount: 1200, 
    paidAmount: 1200, 
    dueDate: "2026-04-01", 
    attendance: 95, 
    lastAttendance: "2026-04-05", 
    enrollmentDate: "2025-09-01", 
    paymentHistory: [{ id: "h1", date: "2026-03-28", amount: 1200, method: "Cash", note: "Full payment" }],
    feeStructureId: "1",
    componentPayments: { "Tuition": 1000, "Sports": 200 },
    parentInfo: {
      fatherName: "Mark Johnson",
      motherName: "Sarah Johnson",
      phone: "+1 555-0101",
      email: "johnson.family@example.com",
      address: "123 Maple St, Springfield"
    },
    grades: [
      { id: "g1", subject: "Mathematics", score: 92, total: 100, term: "Mid-Term", date: "2025-12-15" },
      { id: "g2", subject: "Science", score: 88, total: 100, term: "Mid-Term", date: "2025-12-16" },
      { id: "g3", subject: "English", score: 95, total: 100, term: "Mid-Term", date: "2025-12-17" }
    ]
  },
  { 
    id: "2", 
    studentId: "STU-002", 
    name: "Bob Smith", 
    class: "10-B", 
    academicYear: "2025-2026",
    feeStatus: "Unpaid", 
    feeAmount: 1200, 
    paidAmount: 600, 
    dueDate: "2026-04-10", 
    attendance: 88, 
    lastAttendance: "2026-04-05", 
    enrollmentDate: "2025-09-05", 
    paymentHistory: [{ id: "h2", date: "2026-04-02", amount: 600, method: "Online" }],
    feeStructureId: "2",
    componentPayments: { "Tuition": 600, "Sports": 0 },
    parentInfo: {
      fatherName: "Robert Smith",
      motherName: "Linda Smith",
      phone: "+1 555-0102",
      email: "smith.house@example.com",
      address: "456 Oak Ave, Springfield"
    },
    grades: [
      { id: "g4", subject: "Mathematics", score: 75, total: 100, term: "Mid-Term", date: "2025-12-15" },
      { id: "g5", subject: "Science", score: 82, total: 100, term: "Mid-Term", date: "2025-12-16" }
    ]
  },
  { 
    id: "3", 
    studentId: "STU-003", 
    name: "Charlie Brown", 
    class: "9-A", 
    academicYear: "2025-2026",
    feeStatus: "Overdue", 
    feeAmount: 1000, 
    paidAmount: 0, 
    dueDate: "2026-03-15", 
    attendance: 75, 
    lastAttendance: "2026-04-04", 
    enrollmentDate: "2025-09-10", 
    paymentHistory: [],
    feeStructureId: "3",
    componentPayments: { "Tuition": 0, "Sports": 0 },
    parentInfo: {
      fatherName: "Charles Brown Sr.",
      motherName: "Mary Brown",
      phone: "+1 555-0103",
      email: "browns@example.com",
      address: "789 Pine Rd, Springfield"
    },
    grades: [
      { id: "g6", subject: "Mathematics", score: 65, total: 100, term: "Mid-Term", date: "2025-12-15" }
    ]
  },
  { 
    id: "4", 
    studentId: "STU-004", 
    name: "Diana Prince", 
    class: "11-C", 
    academicYear: "2025-2026",
    feeStatus: "Paid", 
    feeAmount: 1500, 
    paidAmount: 1500, 
    dueDate: "2026-03-30", 
    attendance: 98, 
    lastAttendance: "2026-04-05", 
    enrollmentDate: "2025-08-25", 
    paymentHistory: [{ id: "h3", date: "2026-03-25", amount: 1500, method: "Bank Transfer" }],
    feeStructureId: "4",
    componentPayments: { "Tuition": 1200, "Lab": 300 },
    parentInfo: {
      fatherName: "Hippolyta Prince",
      motherName: "Antiope Prince",
      phone: "+1 555-0104",
      email: "themyscira@example.com",
      address: "1 Paradise Island, Springfield"
    },
    grades: [
      { id: "g7", subject: "History", score: 100, total: 100, term: "Mid-Term", date: "2025-12-15" },
      { id: "g8", subject: "Physical Education", score: 100, total: 100, term: "Mid-Term", date: "2025-12-16" }
    ]
  },
];

export const getStudents = (): Student[] => {
  const data = localStorage.getItem("edu_students");
  if (!data) {
    localStorage.setItem("edu_students", JSON.stringify(INITIAL_STUDENTS));
    return INITIAL_STUDENTS;
  }
  return JSON.parse(data);
};

export const saveStudent = (student: Student) => {
  const students = getStudents();
  const index = students.findIndex((s) => s.id === student.id);
  if (index >= 0) {
    students[index] = student;
  } else {
    students.push(student);
  }
  localStorage.setItem("edu_students", JSON.stringify(students));
};

export const deleteStudent = (id: string) => {
  const students = getStudents().filter((s) => s.id !== id);
  localStorage.setItem("edu_students", JSON.stringify(students));
};

export interface FeeStructure {
  id: string;
  className: string;
  academicYear: string;
  totalFee: number;
  components: { name: string; amount: number }[];
}

const INITIAL_FEE_STRUCTURES: FeeStructure[] = [
  { id: "1", className: "10-A", academicYear: "2025-2026", totalFee: 1200, components: [{ name: "Tuition", amount: 1000 }, { name: "Sports", amount: 200 }] },
  { id: "2", className: "10-B", academicYear: "2025-2026", totalFee: 1200, components: [{ name: "Tuition", amount: 1000 }, { name: "Sports", amount: 200 }] },
  { id: "3", className: "9-A", academicYear: "2025-2026", totalFee: 1000, components: [{ name: "Tuition", amount: 800 }, { name: "Sports", amount: 200 }] },
  { id: "4", className: "11-C", academicYear: "2025-2026", totalFee: 1500, components: [{ name: "Tuition", amount: 1200 }, { name: "Lab", amount: 300 }] },
];

export const getFeeStructures = (): FeeStructure[] => {
  const data = localStorage.getItem("edu_fee_structures");
  if (!data) {
    localStorage.setItem("edu_fee_structures", JSON.stringify(INITIAL_FEE_STRUCTURES));
    return INITIAL_FEE_STRUCTURES;
  }
  return JSON.parse(data);
};

export const saveFeeStructure = (structure: FeeStructure) => {
  const structures = getFeeStructures();
  const index = structures.findIndex((s) => s.id === structure.id);
  if (index >= 0) {
    structures[index] = structure;
  } else {
    structures.push(structure);
  }
  localStorage.setItem("edu_fee_structures", JSON.stringify(structures));
};

export const deleteFeeStructure = (id: string) => {
  const structures = getFeeStructures().filter((s) => s.id !== id);
  localStorage.setItem("edu_fee_structures", JSON.stringify(structures));
};

export interface AttendanceRecord {
  date: string; // ISO date YYYY-MM-DD
  records: { [studentId: string]: 'Present' | 'Absent' };
}

export const getAttendanceRecords = (): AttendanceRecord[] => {
  const data = localStorage.getItem("edu_attendance");
  return data ? JSON.parse(data) : [];
};

export const saveAttendanceRecord = (record: AttendanceRecord) => {
  const records = getAttendanceRecords();
  const index = records.findIndex((r) => r.date === record.date);
  if (index >= 0) {
    records[index] = record;
  } else {
    records.push(record);
  }
  localStorage.setItem("edu_attendance", JSON.stringify(records));
  
  // Update student attendance percentages
  updateStudentAttendanceStats();
};

const updateStudentAttendanceStats = () => {
  const students = getStudents();
  const attendanceData = getAttendanceRecords();
  
  const updatedStudents = students.map(student => {
    const studentRecords = attendanceData.filter(r => r.records[student.id] !== undefined);
    const presentCount = studentRecords.filter(r => r.records[student.id] === 'Present').length;
    const totalDays = studentRecords.length;
    
    return {
      ...student,
      attendance: totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 100,
      lastAttendance: attendanceData.length > 0 ? attendanceData[attendanceData.length - 1].date : student.lastAttendance
    };
  });
  
  localStorage.setItem("edu_students", JSON.stringify(updatedStudents));
};

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export const getNotifications = (): Notification[] => {
  const data = localStorage.getItem("edu_notifications");
  return data ? JSON.parse(data) : [];
};

export const saveNotification = (notification: Notification) => {
  const notifications = getNotifications();
  notifications.unshift(notification);
  // Keep only last 50 notifications
  const limited = notifications.slice(0, 50);
  localStorage.setItem("edu_notifications", JSON.stringify(limited));
};

export const markNotificationAsRead = (id: string) => {
  const notifications = getNotifications();
  const index = notifications.findIndex(n => n.id === id);
  if (index >= 0) {
    notifications[index].read = true;
    localStorage.setItem("edu_notifications", JSON.stringify(notifications));
  }
};

export const deleteNotification = (id: string) => {
  const notifications = getNotifications().filter(n => n.id !== id);
  localStorage.setItem("edu_notifications", JSON.stringify(notifications));
};

export const clearNotifications = () => {
  localStorage.setItem("edu_notifications", JSON.stringify([]));
};
