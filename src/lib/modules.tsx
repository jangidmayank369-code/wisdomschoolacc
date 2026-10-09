import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { db, type Role } from "./app-context";
import { fmtDate, fmtMonth, inr, salaryInr } from "./format";
import type { RefKind } from "./refs";

/* =========================================================
 * Single source of truth for every CRUD / import / export module.
 * Pages, the Import Engine, Export and Reports all read from here.
 * ========================================================= */

export type FieldType = "text" | "number" | "date" | "month" | "select" | "textarea" | "ref";
export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  ref?: RefKind;
  default?: string;
  /** Not a column of the table; consumed by afterSave (e.g. class for enrollment) */
  virtual?: boolean;
  /** Only shown when creating */
  createOnly?: boolean;
  adminOnly?: boolean;
  /** Load options from a master list (Settings → Masters) */
  master?: MasterKind;
};
export type MasterKind = "maintenance_category" | "staff_category" | "designation";
export type Column = { key: string; label: string; render?: (r: Row) => ReactNode; value?: (r: Row) => unknown; money?: boolean };
export type ImportCol = { header: string; field: string; type?: "text" | "number" | "date" | "month" | RefKind | "session"; required?: boolean; example: string; note?: string };
export type Row = Record<string, any>;
export type SaveCtx = { sessionId: string | null; record: Row; values: Row };

export type ModuleDef = {
  customView?: "stationery";
  key: string;
  title: string;
  table: string;
  select: string;
  sessionScoped: boolean;
  orderBy: string;
  dateField?: string;
  searchCols?: string[];
  filters?: { name: string; label: string; options: string[] }[];
  defaultFilters?: Row;
  /** Staff list: filter people by active employment in a session (defaults to selected session) */
  employmentFilter?: boolean;
  /** Master list shown per session through a linked session table (inner join on session_id). */
  sessionJoin?: { table: string; select: string };
  fixed?: Row;
  insertDefaults?: Row;
  columns: Column[];
  fields: Field[];
  writeRoles: Role[];
  /** Has is_reversed: no edit/delete; admin reverses or corrects date */
  financial?: boolean;
  noAdd?: boolean;
  /** Label for the Add button */
  addLabel?: string;
  /** Locked after save: no Edit; admin can only correct with reason */
  noEdit?: boolean;
  /** Ask confirmation before saving a new record */
  confirmSave?: boolean;
  rowLink?: (r: Row) => string | null;
  importCols?: ImportCol[];
  /** Use deterministic client_token for duplicate-safe imports */
  tokenized?: boolean;
  afterSave?: (ctx: SaveCtx) => Promise<void>;
  extraActions?: (r: Row) => ReactNode;
  /** Admin "Import from Other Session" (new enrollment/employment only). */
  sessionImport?: "student" | "staff";
};

const MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card"];
const STATUS = ["active", "inactive", "left"];
const s = (r: Row) => r.students ? `${r.students.name} (${r.students.admission_no})` : "";
const st = (r: Row) => r.staff ? `${r.staff.name} (${r.staff.employee_id})` : "";
const sessCol: ImportCol = { header: "session", field: "session_id", type: "session", example: "2025-26", note: "Blank = currently selected session" };
const payFields = (partyLabel: string, partyName: string): Field[] => [
  { name: "mode", label: "Payment mode", type: "select", options: MODES, required: true, default: "Cash" },
  { name: "reference", label: "Reference", type: "text" },
  { name: partyName, label: partyLabel, type: "text" },
  { name: "remarks", label: "Remarks", type: "textarea" },
];
const payImport = (partyName: string): ImportCol[] => [
  { header: "mode", field: "mode", example: "Cash", note: "Cash/UPI/Bank Transfer/Cheque/Card" },
  { header: "reference", field: "reference", example: "" },
  { header: partyName, field: partyName, example: "Office" },
  { header: "remarks", field: "remarks", example: "" },
];

const ensureStudentSession = async ({ sessionId, record, values }: SaveCtx) => {
  if (!values.class || !sessionId) return;
  const { error } = await db.from("student_sessions").insert({
    student_id: record.id, session_id: sessionId, class: values.class, section: values.section || null, roll_no: values.roll_no || null,
  });
  if (error && error.code !== "23505") throw error;
};
const ensureStaffSession = async ({ sessionId, record, values }: SaveCtx) => {
  const designation = values.designation || values.category;
  if (!designation || !sessionId) return;
  const { error } = await db.from("staff_sessions").insert({
    staff_id: record.id, session_id: sessionId, designation, category: values.category || null,
    monthly_salary: Number(values.monthly_salary || 0), joining_date: values.joining_date || null,
  });
  if (error && error.code !== "23505") throw error;
};

const txnCols: Column[] = [
  { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "amount", label: "Amount", money: true },
  { key: "mode", label: "Mode" },
  { key: "party", label: "Paid/Received by" },
  { key: "source_module", label: "Source" },
  { key: "reference", label: "Ref" },
];
const txnFields = (type?: "income" | "expense"): Field[] => [
  ...(type ? [] : [{ name: "type", label: "Type", type: "select", options: ["income", "expense"], required: true } as Field]),
  { name: "date", label: "Date", type: "date", required: true },
  { name: "category", label: "Category", type: "select", required: true,
    options: type === "income" ? ["Other Income"] : type === "expense" ? ["Other", "Staff Salary", "Fuel", "Transport", "Maintenance"] : ["Other Income", "Other", "Fuel", "Transport", "Maintenance"] },
  { name: "amount", label: "Amount (₹)", type: "number", required: true },
  ...payFields(type === "income" ? "Received by" : "Paid by", "party"),
];
const txnImport = (withType: boolean): ImportCol[] => [
  ...(withType ? [{ header: "type", field: "type", required: true, example: "expense", note: "income or expense" } as ImportCol] : []),
  sessCol,
  { header: "date", field: "date", type: "date", required: true, example: "05-04-2025" },
  { header: "category", field: "category", required: true, example: withType ? "Other" : "Other Income" },
  { header: "amount", field: "amount", type: "number", required: true, example: "1500" },
  ...payImport("party"),
];

export const MODULES: ModuleDef[] = [
  { key: "stationery", title: "Stationery Issue", customView: "stationery", table: "student_charges", select: "*", sessionScoped: true, orderBy: "created_at", writeRoles: ["admin"], noAdd: true, columns: [], fields: [] },
  {
    key: "students", title: "Students", table: "students", select: "*", sessionScoped: false, orderBy: "admission_no",
    sessionJoin: { table: "student_sessions", select: "session_id, class, section, status" }, addLabel: "Add Student (this session)", sessionImport: "student",
    searchCols: ["name", "admission_no", "father_name", "phone"], filters: [{ name: "status", label: "Status", options: ["active", "left", "passed"] }],
    writeRoles: ["admin", "accountant"], rowLink: (r) => `/students/${r.id}`,
    columns: [
      { key: "admission_no", label: "Adm/SR No" }, { key: "name", label: "Name" }, { key: "father_name", label: "Father" },
      { key: "phone", label: "Phone" },
      { key: "cls", label: "Class (session)", value: (r) => r.student_sessions?.[0] ? `${r.student_sessions[0].class}${r.student_sessions[0].section ? "-" + r.student_sessions[0].section : ""}` : "" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { name: "admission_no", label: "Admission / SR No", type: "text", required: true },
      { name: "name", label: "Student name", type: "text", required: true },
      { name: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"] },
      { name: "dob", label: "Date of birth", type: "date" },
      { name: "father_name", label: "Father's name", type: "text" },
      { name: "mother_name", label: "Mother's name", type: "text" },
      { name: "phone", label: "Parent phone", type: "text" },
      { name: "address", label: "Address", type: "textarea" },
      { name: "admission_date", label: "Admission date", type: "date" },
      { name: "status", label: "Status", type: "select", options: ["active", "left", "passed"], default: "active" },
      { name: "class", label: "Class (selected session)", type: "text", virtual: true, createOnly: true },
      { name: "section", label: "Section", type: "text", virtual: true, createOnly: true },
      { name: "roll_no", label: "Roll no", type: "text", virtual: true, createOnly: true },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    afterSave: ensureStudentSession,
    importCols: [
      { header: "admission_no", field: "admission_no", required: true, example: "1001", note: "Unique; used to match the student" },
      { header: "name", field: "name", required: true, example: "Rahul Kumar" },
      { header: "gender", field: "gender", example: "Male" },
      { header: "dob", field: "dob", type: "date", example: "15-08-2015", note: "dd-mm-yyyy" },
      { header: "father_name", field: "father_name", example: "Suresh Kumar" },
      { header: "mother_name", field: "mother_name", example: "" },
      { header: "phone", field: "phone", example: "9876543210" },
      { header: "address", field: "address", example: "Doomra" },
      { header: "admission_date", field: "admission_date", type: "date", example: "01-04-2025" },
      { header: "status", field: "status", example: "active" },
      { header: "class", field: "class", example: "4", note: "Optional: enrolls into selected session" },
      { header: "section", field: "section", example: "A" },
      { header: "roll_no", field: "roll_no", example: "12" },
      { header: "remarks", field: "remarks", example: "" },
    ],
  },
  {
    key: "student_sessions", title: "Student Sessions (Classes)", table: "student_sessions", select: "*, students(admission_no, name)",
    sessionScoped: true, orderBy: "class", filters: [
      { name: "class", label: "Class", options: ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] },
      { name: "section", label: "Section", options: ["A", "B", "C", "D"] },
      { name: "status", label: "Status", options: ["active", "promoted", "left"] },
    ], writeRoles: ["admin", "accountant"], rowLink: (r) => `/students/${r.student_id}`,
    columns: [
      { key: "student", label: "Student", value: s }, { key: "class", label: "Class" }, { key: "section", label: "Section" },
      { key: "roll_no", label: "Roll" }, { key: "status", label: "Status" }, { key: "transport_route", label: "Transport" },
    ],
    fields: [
      { name: "student_id", label: "Student", type: "ref", ref: "student", required: true, createOnly: true },
      { name: "class", label: "Class", type: "text", required: true },
      { name: "section", label: "Section", type: "text" },
      { name: "roll_no", label: "Roll no", type: "text" },
      { name: "enrollment_date", label: "Enrollment date", type: "date" },
      { name: "status", label: "Status", type: "select", options: ["active", "promoted", "left"], default: "active" },
      { name: "transport_route", label: "Transport route", type: "text" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    importCols: [
      { header: "admission_no", field: "student_id", type: "student", required: true, example: "1001" }, sessCol,
      { header: "class", field: "class", required: true, example: "5" }, { header: "section", field: "section", example: "A" },
      { header: "roll_no", field: "roll_no", example: "7" }, { header: "status", field: "status", example: "active" },
      { header: "transport_route", field: "transport_route", example: "" }, { header: "remarks", field: "remarks", example: "" },
    ],
  },
  {
    key: "student_charges", title: "Student Charges", table: "student_charges", select: "*, students(admission_no, name), fee_categories(name)",
    sessionScoped: true, orderBy: "created_at", dateField: "due_date", writeRoles: ["admin", "accountant"], rowLink: (r) => `/students/${r.student_id}`,
    addLabel: "Add Manual Fee/Charge", confirmSave: true,
    columns: [
      { key: "student", label: "Student", value: s }, { key: "category", label: "Category", value: (r) => r.category_name ?? r.fee_categories?.name },
      { key: "installment", label: "Month/Inst." },
      { key: "amount", label: "Amount", money: true }, { key: "due_date", label: "Due", render: (r) => fmtDate(r.due_date) }, { key: "remarks", label: "Description" },
    ],
    fields: [
      { name: "student_id", label: "Student", type: "ref", ref: "student", required: true },
      { name: "category_id", label: "Fee category", type: "ref", ref: "fee_category", required: true },
      { name: "amount", label: "Amount (₹)", type: "number", required: true },
      { name: "due_date", label: "Due date", type: "date" },
      { name: "installment", label: "Month / installment (optional)", type: "text" },
      { name: "remarks", label: "Description / remarks", type: "textarea" },
    ],
    importCols: [
      { header: "admission_no", field: "student_id", type: "student", required: true, example: "1001" }, sessCol,
      { header: "category", field: "category_id", type: "fee_category", required: true, example: "Tuition", note: "Tuition/Admission/Exam/Annual/Transport/Books/Stationery/Other" },
      { header: "amount", field: "amount", type: "number", required: true, example: "12000" },
      { header: "due_date", field: "due_date", type: "date", example: "10-04-2025" }, { header: "remarks", field: "remarks", example: "" },
    ],
  },
  {
    key: "fee_payments", title: "Fee Payments", table: "fee_payments", select: "*, students(admission_no, name), fee_categories(name)",
    sessionScoped: true, orderBy: "payment_date", dateField: "payment_date", searchCols: ["receipt_no", "reference"],
    writeRoles: ["admin", "accountant"], financial: true, tokenized: true,
    columns: [
      { key: "receipt_no", label: "Receipt" }, { key: "payment_date", label: "Date", render: (r) => fmtDate(r.payment_date) },
      { key: "student", label: "Student", value: s }, { key: "amount", label: "Amount", money: true },
      { key: "mode", label: "Mode" }, { key: "received_by", label: "Received by" },
    ],
    fields: [
      { name: "student_id", label: "Student", type: "ref", ref: "student", required: true },
      { name: "category_id", label: "Fee category", type: "ref", ref: "fee_category" },
      { name: "amount", label: "Amount (₹)", type: "number", required: true },
      { name: "payment_date", label: "Date", type: "date", required: true },
      ...payFields("Received by", "received_by"),
    ],
    extraActions: (r) => <Link to="/receipt/$id" params={{ id: r.id }} className="text-primary text-sm underline">Receipt</Link>,
    importCols: [
      { header: "admission_no", field: "student_id", type: "student", required: true, example: "1001" }, sessCol,
      { header: "category", field: "category_id", type: "fee_category", example: "Tuition" },
      { header: "amount", field: "amount", type: "number", required: true, example: "5000" },
      { header: "payment_date", field: "payment_date", type: "date", required: true, example: "05-04-2025" },
      ...payImport("received_by"),
    ],
  },
  {
    key: "staff", title: "Staff", table: "staff", select: "*, staff_sessions(session_id, status, designation, academic_sessions(name, start_date))", sessionScoped: false, orderBy: "employee_id",
    searchCols: ["name", "employee_id", "mobile"], filters: [{ name: "status", label: "Status", options: STATUS }], employmentFilter: true,
    writeRoles: ["admin"], rowLink: (r) => `/staff/${r.id}`, addLabel: "Add Staff", sessionImport: "staff",
    columns: [{ key: "employee_id", label: "Emp ID" }, { key: "name", label: "Name" }, { key: "mobile", label: "Mobile" },
      { key: "sessions", label: "Sessions", value: (r) => ((r.staff_sessions ?? []) as Row[]).slice().sort((a, b) => String(a.academic_sessions?.start_date).localeCompare(String(b.academic_sessions?.start_date))).map((x) => x.academic_sessions?.name + (x.status === "active" ? "" : ` (${x.status})`)).join(", ") },
      { key: "status", label: "Status" }],
    fields: [
      { name: "employee_id", label: "Employee ID", type: "text", required: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "mobile", label: "Mobile", type: "text" },
      { name: "email", label: "Email", type: "text" },
      { name: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"] },
      { name: "address", label: "Address", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: STATUS, default: "active" },
      { name: "category", label: "Staff category (selected session)", type: "select", master: "staff_category", virtual: true, createOnly: true },
      { name: "designation", label: "Designation (selected session)", type: "select", master: "designation", virtual: true, createOnly: true },
      { name: "monthly_salary", label: "Monthly salary (₹)", type: "number", virtual: true, createOnly: true },
      { name: "joining_date", label: "Joining date", type: "date", virtual: true, createOnly: true },
    ],
    afterSave: ensureStaffSession,
    importCols: [
      { header: "employee_id", field: "employee_id", required: true, example: "101", note: "Unique; used to match staff" },
      { header: "name", field: "name", required: true, example: "Mohan Singh" },
      { header: "mobile", field: "mobile", example: "9876500000" }, { header: "email", field: "email", example: "" },
      { header: "gender", field: "gender", example: "Male" }, { header: "address", field: "address", example: "" },
      { header: "status", field: "status", example: "active" },
      { header: "designation", field: "designation", example: "Teacher", note: "Optional: creates employment in selected session" },
      { header: "monthly_salary", field: "monthly_salary", type: "number", example: "15000" },
      { header: "joining_date", field: "joining_date", type: "date", example: "01-04-2025" },
    ],
  },
  {
    key: "staff_sessions", title: "Employment", table: "staff_sessions", select: "*, staff(employee_id, name), academic_sessions(name)",
    sessionScoped: true, orderBy: "created_at", filters: [{ name: "status", label: "Status", options: STATUS }], defaultFilters: { status: "active" },
    writeRoles: ["admin"], rowLink: (r) => `/staff/${r.staff_id}`, addLabel: "Add Employment (this session)",
    columns: [
      { key: "session", label: "Session", value: (r) => r.academic_sessions?.name },
      { key: "emp", label: "Staff ID", value: (r) => r.staff?.employee_id }, { key: "sname", label: "Staff Name", value: (r) => r.staff?.name },
      { key: "category", label: "Category" }, { key: "designation", label: "Designation" }, { key: "optional_role", label: "Optional Role" },
      { key: "joining_date", label: "Joining", render: (r) => fmtDate(r.joining_date) },
      { key: "exit_date", label: "Exit", render: (r) => fmtDate(r.exit_date) },
       { key: "monthly_salary", label: "Monthly Salary", render: (r) => salaryInr(r.monthly_salary) },
      { key: "status", label: "Status" },
    ],
    fields: [
      { name: "staff_id", label: "Staff", type: "ref", ref: "staff", required: true, createOnly: true },
      { name: "joining_date", label: "Joining date", type: "date" },
      { name: "exit_date", label: "Exit date (required when Left)", type: "date" },
      { name: "category", label: "Staff category", type: "select", master: "staff_category" },
      { name: "designation", label: "Primary designation", type: "select", master: "designation", required: true },
      { name: "optional_role", label: "Optional role (e.g. Driver)", type: "select", options: ["Driver", "Accountant", "Teacher", "Peon", "Other"] },
      { name: "monthly_salary", label: "Monthly salary (₹)", type: "number", required: true },
      { name: "status", label: "Status", type: "select", options: STATUS, default: "active" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    importCols: [
      { header: "employee_id", field: "staff_id", type: "staff", required: true, example: "101" }, sessCol,
      { header: "joining_date", field: "joining_date", type: "date", example: "01-04-2025" },
      { header: "exit_date", field: "exit_date", type: "date", example: "" },
      { header: "designation", field: "designation", required: true, example: "Driver" },
      { header: "optional_role", field: "optional_role", example: "" },
      { header: "monthly_salary", field: "monthly_salary", type: "number", required: true, example: "12000" },
      { header: "status", field: "status", example: "active" }, { header: "remarks", field: "remarks", example: "" },
    ],
  },
  {
    key: "staff_payments", title: "Salary Payments", table: "staff_payments", select: "*, staff(employee_id, name)",
    sessionScoped: true, orderBy: "payment_date", dateField: "payment_date", writeRoles: ["admin"], financial: true, tokenized: true,
    rowLink: (r) => `/staff/${r.staff_id}`,
    columns: [
      { key: "payment_date", label: "Date", render: (r) => fmtDate(r.payment_date) }, { key: "staff", label: "Staff", value: st },
       { key: "payroll_month", label: "Month", render: (r) => fmtMonth(r.payroll_month) }, { key: "amount", label: "Amount", render: (r) => salaryInr(r.amount) },
       { key: "salary_days", label: "Days" }, { key: "calculated_amount", label: "Calculated", render: (r) => salaryInr(r.calculated_amount) },
      { key: "mode", label: "Mode" }, { key: "paid_by", label: "Paid by" }, { key: "reference", label: "Ref" }, { key: "change_reason", label: "Correction" },
    ],
    fields: [
      { name: "staff_id", label: "Staff", type: "ref", ref: "staff", required: true },
      { name: "payroll_month", label: "Salary month", type: "month", required: true },
      { name: "amount", label: "Amount (₹)", type: "number", required: true },
      { name: "payment_date", label: "Payment date", type: "date", required: true },
      ...payFields("Paid by", "paid_by"),
    ],
    importCols: [
      { header: "employee_id", field: "staff_id", type: "staff", required: true, example: "101" }, sessCol,
      { header: "payroll_month", field: "payroll_month", type: "month", required: true, example: "04-2025", note: "mm-yyyy" },
      { header: "amount", field: "amount", type: "number", required: true, example: "5000" },
      { header: "payment_date", field: "payment_date", type: "date", required: true, example: "05-04-2025" },
      ...payImport("paid_by"),
    ],
  },
  {
    key: "staff_attendance", title: "Attendance", table: "staff_attendance", select: "*, staff(employee_id, name)",
    sessionScoped: true, orderBy: "date", dateField: "date", filters: [{ name: "status", label: "Status", options: ["present", "absent", "half_day", "leave"] }],
    writeRoles: ["admin"], rowLink: (r) => `/staff/${r.staff_id}`, noEdit: true, noAdd: true,
    columns: [{ key: "date", label: "Date", render: (r) => fmtDate(r.date) }, { key: "staff", label: "Staff", value: st }, { key: "status", label: "Status" }, { key: "remarks", label: "Remarks" }],
    fields: [
      { name: "staff_id", label: "Staff", type: "ref", ref: "staff", required: true },
      { name: "date", label: "Date", type: "date", required: true },
      { name: "status", label: "Status", type: "select", options: ["present", "absent", "half_day", "leave"], required: true, default: "present" },
      { name: "remarks", label: "Remarks", type: "text" },
    ],
    importCols: [
      { header: "employee_id", field: "staff_id", type: "staff", required: true, example: "101" }, sessCol,
      { header: "date", field: "date", type: "date", required: true, example: "01-04-2025" },
      { header: "status", field: "status", required: true, example: "present", note: "present/absent/half_day/leave" },
      { header: "remarks", field: "remarks", example: "" },
    ],
  },
  {
    key: "leave_requests", title: "Leave Requests", table: "leave_requests", select: "*, staff(employee_id, name)",
    sessionScoped: true, orderBy: "created_at", dateField: "from_date", filters: [{ name: "status", label: "Status", options: ["pending", "approved", "rejected"] }],
    writeRoles: ["admin", "staff"],
    columns: [
      { key: "staff", label: "Staff", value: st }, { key: "from_date", label: "From", render: (r) => fmtDate(r.from_date) },
      { key: "to_date", label: "To", render: (r) => fmtDate(r.to_date) }, { key: "reason", label: "Reason" }, { key: "status", label: "Status" },
    ],
    fields: [
      { name: "staff_id", label: "Staff", type: "ref", ref: "staff", required: true, adminOnly: true },
      { name: "from_date", label: "From", type: "date", required: true },
      { name: "to_date", label: "To", type: "date", required: true },
      { name: "reason", label: "Reason", type: "text", required: true },
      { name: "remarks", label: "Remarks", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: ["pending", "approved", "rejected"], default: "pending", adminOnly: true },
    ],
    importCols: [
      { header: "employee_id", field: "staff_id", type: "staff", required: true, example: "101" }, sessCol,
      { header: "from_date", field: "from_date", type: "date", required: true, example: "10-04-2025" },
      { header: "to_date", field: "to_date", type: "date", required: true, example: "11-04-2025" },
      { header: "reason", field: "reason", required: true, example: "Family function" },
      { header: "status", field: "status", example: "approved", note: "pending/approved/rejected" },
      { header: "remarks", field: "remarks", example: "" },
    ],
  },
  {
    key: "vehicles", title: "Vehicles", table: "vehicles", select: "*", sessionScoped: false, addLabel: "Add Vehicle (then assign in this session)",
    sessionJoin: { table: "vehicle_assignments", select: "session_id, route, status, staff(name)" }, orderBy: "vehicle_no", searchCols: ["vehicle_no", "model", "registration"],
    writeRoles: ["admin"],
    columns: [{ key: "vehicle_no", label: "Vehicle No" }, { key: "registration", label: "Registration" }, { key: "drv", label: "Driver (session)", value: (r) => r.vehicle_assignments?.[0]?.staff?.name }, { key: "rt", label: "Route", value: (r) => r.vehicle_assignments?.[0]?.route }, { key: "avg", label: "Average", value: (r) => (r.fuel_average_kmpl ? `${r.fuel_average_kmpl} KM/L` : "—") }, { key: "type", label: "Type" }, { key: "model", label: "Model" }, { key: "capacity", label: "Capacity" }, { key: "status", label: "Status" }],
    fields: [
      { name: "vehicle_no", label: "Vehicle number", type: "text", required: true },
      { name: "type", label: "Type", type: "select", options: ["Bus", "Van", "Auto", "Car", "Other"] },
      { name: "model", label: "Model", type: "text" },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "fuel_average_kmpl", label: "Fuel average (KM/L)", type: "number" },
      { name: "registration", label: "Registration details", type: "text" },
      { name: "status", label: "Status", type: "select", options: ["active", "inactive"], default: "active" },
    ],
    importCols: [
      { header: "vehicle_no", field: "vehicle_no", required: true, example: "HR-01-AB-1234" }, { header: "type", field: "type", example: "Bus" },
      { header: "model", field: "model", example: "Tata Starbus" }, { header: "capacity", field: "capacity", type: "number", example: "40" },
      { header: "registration", field: "registration", example: "" }, { header: "status", field: "status", example: "active" },
    ],
  },
  {
    key: "vehicle_assignments", title: "Vehicle Assignments", table: "vehicle_assignments", select: "*, staff(employee_id, name), vehicles(vehicle_no)",
    sessionScoped: true, orderBy: "created_at", writeRoles: ["admin"], rowLink: (r) => `/drivers/${r.staff_id}`,
    columns: [
      { key: "vehicle", label: "Vehicle", value: (r) => r.vehicles?.vehicle_no }, { key: "staff", label: "Driver", value: st },
      { key: "route", label: "Route" },
      { key: "effective_from", label: "From", render: (r) => fmtDate(r.effective_from) }, { key: "status", label: "Status" },
    ],
    fields: [
      { name: "vehicle_id", label: "Vehicle", type: "ref", ref: "vehicle", required: true },
      { name: "staff_id", label: "Driver", type: "ref", ref: "driver", required: true },
      { name: "route", label: "Route", type: "text" },
      { name: "effective_from", label: "Effective from", type: "date" },
      { name: "status", label: "Status", type: "select", options: ["active", "inactive"], default: "active" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    importCols: [
      { header: "vehicle_no", field: "vehicle_id", type: "vehicle", required: true, example: "HR-01-AB-1234" },
      { header: "driver_employee_id", field: "staff_id", type: "staff", required: true, example: "105" }, sessCol,
      { header: "route", field: "route", example: "Doomra - City" },
      { header: "remarks", field: "remarks", example: "" },
    ],
  },
  {
    key: "monthly_vehicle_km", title: "Monthly KM", table: "monthly_vehicle_km", select: "*, staff(employee_id, name), vehicles(vehicle_no)",
    sessionScoped: true, orderBy: "month", dateField: "month", writeRoles: ["admin"], addLabel: "Add Monthly KM", rowLink: (r) => `/drivers/${r.staff_id}`,
    columns: [
      { key: "month", label: "Month", render: (r) => fmtMonth(r.month) },
      { key: "vehicle", label: "Vehicle", value: (r) => r.vehicles?.vehicle_no }, { key: "staff", label: "Driver", value: st },
      { key: "total_km", label: "Total KM", value: (r) => `${Math.round(Number(r.total_km))} KM` },
      { key: "change_reason", label: "Edit reason" },
    ],
    fields: [
      { name: "month", label: "Month", type: "month", required: true },
      { name: "vehicle_id", label: "Vehicle", type: "ref", ref: "vehicle", required: true },
      { name: "staff_id", label: "Driver", type: "ref", ref: "driver", required: true },
      { name: "total_km", label: "Total KM", type: "number", required: true },
      { name: "remarks", label: "Remarks", type: "text" },
      { name: "change_reason", label: "Edit reason (required when updating)", type: "text" },
    ],
    importCols: [
      { header: "vehicle_no", field: "vehicle_id", type: "vehicle", required: true, example: "HR-01-AB-1234" }, sessCol,
      { header: "driver_employee_id", field: "staff_id", type: "staff", required: true, example: "105" },
      { header: "month", field: "month", type: "month", required: true, example: "04-2025" },
      { header: "total_km", field: "total_km", type: "number", required: true, example: "1085" }, { header: "remarks", field: "remarks", example: "" },
    ],
  },
  {
    key: "transport_expenses", title: "Fuel / Transport Expenses", table: "transport_expenses", select: "*, staff(employee_id, name), vehicles(vehicle_no)",
    sessionScoped: true, orderBy: "date", dateField: "date", filters: [{ name: "expense_type", label: "Type", options: ["Fuel", "Repair", "Insurance", "Other"] }],
    writeRoles: ["admin"], financial: true, tokenized: true,
    columns: [
      { key: "date", label: "Payment Date", render: (r) => fmtDate(r.date) }, { key: "for_month", label: "For Month", render: (r) => r.for_month ? fmtMonth(r.for_month) : "—" }, { key: "expense_type", label: "Type" },
      { key: "staff", label: "Driver", value: st }, { key: "vehicle", label: "Vehicle", value: (r) => r.vehicles?.vehicle_no },
      { key: "amount", label: "Amount", money: true }, { key: "mode", label: "Mode" }, { key: "paid_by", label: "Paid by" },
    ],
    fields: [
      { name: "expense_type", label: "Type", type: "select", options: ["Fuel", "Repair", "Insurance", "Other"], required: true, default: "Fuel" },
      { name: "staff_id", label: "Driver", type: "ref", ref: "driver" },
      { name: "vehicle_id", label: "Vehicle", type: "ref", ref: "vehicle" },
      { name: "date", label: "Payment Date", type: "date", required: true },
      { name: "for_month", label: "For Month (payment is against)", type: "month", required: true, createOnly: true },
      { name: "amount", label: "Amount (₹)", type: "number", required: true },
      ...payFields("Paid by", "paid_by"),
    ],
    importCols: [
      { header: "expense_type", field: "expense_type", required: true, example: "Fuel" },
      { header: "driver_employee_id", field: "staff_id", type: "staff", example: "105" },
      { header: "vehicle_no", field: "vehicle_id", type: "vehicle", example: "HR-01-AB-1234" }, sessCol,
      { header: "date", field: "date", type: "date", required: true, example: "06-10-2026" },
      { header: "for_month", field: "for_month", type: "month", example: "09-2026", note: "mm-yyyy; month the payment is against" },
      { header: "amount", field: "amount", type: "number", required: true, example: "3200" }, ...payImport("paid_by"),
    ],
  },
  {
    key: "maintenance_expenses", title: "Maintenance", table: "maintenance_expenses", select: "*", sessionScoped: true, orderBy: "date", dateField: "date",
    searchCols: ["work", "vendor", "bill_no", "location"], writeRoles: ["admin"], financial: true, tokenized: true,
    addLabel: "Add Maintenance Expense", confirmSave: true,
    columns: [
      { key: "date", label: "Date", render: (r) => fmtDate(r.date) }, { key: "work", label: "Work" }, { key: "location", label: "Location" },
      { key: "vendor", label: "Vendor" }, { key: "amount", label: "Amount", money: true }, { key: "mode", label: "Mode" }, { key: "bill_no", label: "Bill" },
    ],
    fields: [
      { name: "date", label: "Date", type: "date", required: true },
      { name: "work", label: "Work done", type: "text", required: true },
      { name: "location", label: "Location", type: "text" },
      { name: "category", label: "Category", type: "select", master: "maintenance_category" },
      { name: "vendor", label: "Vendor", type: "text" },
      { name: "bill_no", label: "Bill number", type: "text" },
      { name: "amount", label: "Amount (₹)", type: "number", required: true },
      ...payFields("Paid by", "paid_by"),
    ],
    importCols: [
      sessCol, { header: "date", field: "date", type: "date", required: true, example: "12-04-2025" },
      { header: "work", field: "work", required: true, example: "Classroom fan repair" }, { header: "location", field: "location", example: "Room 4" },
      { header: "category", field: "category", example: "Electrical" }, { header: "vendor", field: "vendor", example: "Sharma Electricals" },
      { header: "bill_no", field: "bill_no", example: "B-221" }, { header: "amount", field: "amount", type: "number", required: true, example: "850" },
      ...payImport("paid_by"),
    ],
  },
  {
    key: "income", title: "Other Income", table: "transactions", select: "*", sessionScoped: true, orderBy: "date", dateField: "date",
    fixed: { type: "income", source_module: "manual" }, writeRoles: ["admin", "accountant"], financial: true, tokenized: true,
    columns: txnCols.filter((c) => c.key !== "type" && c.key !== "source_module"), fields: txnFields("income"), importCols: txnImport(false),
  },
  {
    key: "expenses", title: "Other Expenses", table: "transactions", select: "*", sessionScoped: true, orderBy: "date", dateField: "date",
    fixed: { type: "expense", source_module: "manual" }, writeRoles: ["admin", "accountant"], financial: true, tokenized: true,
    columns: txnCols.filter((c) => c.key !== "type" && c.key !== "source_module"), fields: txnFields("expense"), importCols: txnImport(false),
  },
  {
    key: "accounts", title: "Accounts Ledger", table: "transactions", select: "*", sessionScoped: true, orderBy: "date", dateField: "date",
    filters: [{ name: "type", label: "Type", options: ["income", "expense"] }, { name: "source_module", label: "Source", options: ["manual", "fee_payments", "staff_payments", "transport_expenses", "maintenance_expenses"] }],
    insertDefaults: { source_module: "manual" }, writeRoles: ["admin", "accountant"], financial: true, tokenized: true,
    columns: txnCols, fields: txnFields(), importCols: txnImport(true),
  },
];

MODULES.push({
  key: "fuel_rates", title: "Fuel Rates", table: "fuel_rates", select: "*",
  sessionScoped: true, orderBy: "month", writeRoles: ["admin"], addLabel: "Add Fuel Rate (this session)",
  columns: [
    { key: "month", label: "Month", render: (r) => fmtMonth(r.month) }, { key: "fuel_type", label: "Fuel" },
    { key: "rate_per_litre", label: "Rate / L", money: true },
    { key: "effective_date", label: "Effective", render: (r) => fmtDate(r.effective_date) },
    { key: "status", label: "Status" }, { key: "change_reason", label: "Change reason" },
  ],
  fields: [
    { name: "month", label: "Month", type: "month", required: true },
    { name: "fuel_type", label: "Fuel type", type: "select", options: ["Diesel", "Petrol", "CNG"], required: true, default: "Diesel" },
    { name: "rate_per_litre", label: "Rate per litre (₹)", type: "number", required: true },
    { name: "effective_date", label: "Effective date", type: "date" },
    { name: "status", label: "Status", type: "select", options: ["active", "inactive"], default: "active" },
    { name: "change_reason", label: "Reason (required when changing a saved rate)", type: "text" },
  ],
});

export const getModule = (key: string) => MODULES.find((m) => m.key === key);
export const IMPORT_MODULES = MODULES.filter((m) => m.importCols);
