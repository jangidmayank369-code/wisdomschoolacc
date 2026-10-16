# Wisdom School Hub

BUILD A NEW PRODUCTION-READY SCHOOL ERP.



Project:

Wisdom Public School – Doomra ERP



IMPORTANT:

This is a fresh application. Do NOT import or restore old data.

Start with an empty database.



I will import real school data later.



The application must be designed correctly from the beginning so that importing real data later does not require rebuilding the system.



====================================================

CORE PRINCIPLES

====================================================



Build a SIMPLE, FAST, MOBILE-FIRST school ERP.



Priorities:



1. Correct database architecture

2. Academic-session isolation

3. Data safety

4. Working CRUD

5. Import/export

6. Correct financial calculations

7. Role/RLS security

8. Simple professional UI

9. Reusable components

10. Minimal code duplication



Do NOT build unnecessary fancy animations or complex UI.



Do NOT create demo/fake school records.



Do NOT create duplicate functionality.



Do NOT repeatedly rebuild components.



Use reusable components and utilities everywhere.



====================================================

TECH STACK

====================================================



Use the standard Lovable-supported stack with:



- React

- TypeScript

- Supabase/PostgreSQL

- Supabase Auth

- PostgreSQL RLS



Use a clean modular architecture.



Create reusable components for:



- tables

- forms

- dialogs

- filters

- search

- pagination

- import

- export

- print

- stat cards

- loading/error/empty states

- session selector



Build these shared systems ONCE and reuse them throughout the ERP.



====================================================

DESIGN

====================================================



Brand:

Wisdom Public School – Doomra



Theme:

Blue + White



UI:

- modern

- clean

- professional

- simple

- mobile-first

- touch-friendly



Desktop:

Sidebar + Header



Mobile:

Bottom/compact navigation + responsive cards



Avoid:

- unnecessary animations

- crowded dashboards

- huge forms

- horizontal page overflow



Tables may scroll horizontally when absolutely necessary.



Forms must work comfortably on mobile.



====================================================

ACADEMIC SESSION ARCHITECTURE

====================================================



THIS IS THE MOST IMPORTANT DATABASE RULE.



Create:



academic_sessions



Example:

2025-26

2026-27



All session-specific data MUST contain session_id.



However, master people/entities must NOT be duplicated between sessions.



----------------------------------------------------

STUDENTS

----------------------------------------------------



ONE student master record.



Use a student_session relation for:



- session

- class

- section

- roll number

- session status

- session-specific transport

- session-specific academic information



Example:



Student Rahul



2025-26 → Class 4

2026-27 → Class 5



ONE student, TWO session records.



Fees/charges/payments must always be session-specific.



----------------------------------------------------

STAFF

----------------------------------------------------



ONE staff master record.



Create/use staff_session/employment_session:



- staff_id

- session_id

- joining_date

- designation

- monthly_salary

- status

- remarks



Example:



Employee 101



2025-26:

Joining: 01-04-2025

Salary: ₹12,000



2026-27:

Joining: 01-04-2026

Salary: ₹15,000



ONE staff member, TWO session employment records.



Never show salary/payroll from another session when a session is selected.



====================================================

SALARY RULE

====================================================



EVERY MONTH = EXACTLY 30 DAYS.



Daily salary:



Monthly Salary / 30



Example:



₹15,000 / 30 = ₹500/day



NEVER use actual calendar days.



If absent days > 4:

show a WARNING only.



Do NOT automatically deduct salary.



====================================================

STAFF PAYROLL + COMPLETE HISTORY

====================================================



For selected session and month show:



- monthly salary

- daily salary

- working days

- present

- absent

- half day

- approved leave

- paid days

- salary due

- salary paid

- salary balance



Allow partial salary payments.



Example:



April salary ₹15,000



05-Apr → ₹5,000

20-Apr → ₹5,000



Paid = ₹10,000

Balance = ₹5,000



NEVER overwrite previous payments.



Every salary payment stores:



- staff

- session

- payroll month

- amount

- date

- payment mode

- reference

- paid by

- remarks

- created timestamp



Staff profile must show a complete history:



SESSION

MONTH

DUE

PAID

BALANCE



and detailed payment history:



DATE | MONTH | AMOUNT | MODE | PAID BY | REFERENCE



====================================================

STAFF PROFILE

====================================================



Staff profile should have:



Personal:

- name

- employee ID

- mobile

- email

- address



Session history:

- session

- joining date

- designation

- salary

- daily salary

- status



Financial summary:

- total due

- total paid

- total balance



Monthly salary history.



Attendance.



Leave.



Payment history.



Do NOT mix sessions.



====================================================

SALARY PAYMENT SECURITY

====================================================



After saving a salary payment:



Normal users cannot silently edit/delete historical payment amounts.



Admin can perform controlled correction/reversal.



If Admin changes payment date, record:



- original date

- new date

- changed by

- changed at

- reason



Use audit logs.



====================================================

STUDENTS

====================================================



Student management:



- Add

- Edit

- View

- Search

- Class filter

- Section filter

- Session filter

- Status filter

- Import

- Export



Student profile:



- basic information

- parent information

- academic information

- charges

- payments

- balance



Financial:



Total Charges

Total Paid

Total Balance



Balance:



Total Charges - Total Paid



Prevent overpayment by default.



====================================================

FEES

====================================================



Fee categories:



- Tuition

- Admission

- Exam

- Annual

- Transport

- Books

- Stationery

- Other



Student charges:



- student

- session

- category

- amount

- due date

- remarks



Payments:



- student

- session

- amount

- date

- payment mode

- reference

- received by

- remarks



Support:



- full payment

- partial payment

- multiple installments



After payment:



- paid updates

- balance updates

- dashboard updates

- transaction updates



====================================================

FEE RECEIPT

====================================================



Professional printable receipt:



- school name/logo

- receipt number

- date

- student

- admission/SR number

- class

- fee details

- amount

- payment mode

- received by

- balance



Support:



- A4

- A5

- 80mm



====================================================

ATTENDANCE

====================================================



Staff attendance:



- Present

- Absent

- Half Day

- Leave



Fields:



- staff

- session

- date

- status

- remarks

- marked by



Admin can mark attendance.



Staff can only view own attendance.



Approved leave must be correctly reflected in payroll calculations.



====================================================

LEAVE

====================================================



Staff can request:



- from

- to

- reason

- remarks



Statuses:



Pending

Approved

Rejected



Admin approves/rejects.



Staff sees only own requests.



====================================================

TRANSPORT

====================================================



Drivers are STAFF with designation = Driver.



Do NOT create duplicate person records.



Vehicles:



- vehicle number

- type

- model

- capacity

- registration

- status



Vehicle assignment MUST be session-specific.



Example:



2025-26:

Vehicle A → Driver Rahul



2026-27:

Vehicle A → Driver Mohan



Historical assignment must remain intact.



====================================================

DRIVER PROFILE

====================================================



Create a dedicated driver profile that combines:



STAFF

+

VEHICLE

+

SALARY

+

KM

+

FUEL

+

PAYMENTS



Show in one place:



Driver details

Current session

Joining date

Monthly salary

Daily salary



Assigned vehicle

Vehicle number

Route



Salary due

Salary paid

Salary balance



Salary payment history



Daily KM

Monthly KM

Total session KM



Fuel rate/KM

Estimated fuel

Actual fuel

Variance



Fuel payment history



This should work like the Staff profile.



====================================================

DRIVER KM

====================================================



Daily KM:



- driver

- vehicle

- session

- date

- KM

- remarks

- recorded by



Monthly:



Total KM

Days driven

Average KM/day



====================================================

FUEL

====================================================



Estimated fuel:



Total KM × Fuel Rate Per KM



Keep estimated and actual fuel separately.



Show:



Estimated

Actual Paid

Difference



Every actual payment stores:



- date

- driver

- vehicle

- session

- amount

- mode

- paid by

- reference

- remarks



====================================================

TRANSPORT LEDGER

====================================================



Driver profile must show a complete chronological ledger.



Example:



SALARY

April Due ₹15,000

Paid ₹10,000

Balance ₹5,000



KM

01-Apr 40 KM

02-Apr 55 KM

03-Apr 48 KM



FUEL

Estimated ₹10,000

Actual ₹9,600

Variance ₹400



PAYMENTS

05-Apr ₹5,000

20-Apr ₹5,000



All linked to driver + vehicle + session.



====================================================

MAINTENANCE

====================================================



Separate module:



- date

- session

- location

- work

- category

- vendor

- bill number

- amount

- payment mode

- paid by

- remarks



====================================================

ACCOUNTS

====================================================



Central transaction ledger.



Income:

- Student Fees

- Other Income



Expenses:

- Staff Salary

- Driver Salary

- Fuel

- Maintenance

- Other



Every transaction:



- date

- session

- type

- category

- amount

- mode

- reference

- source module

- source record

- paid/received by

- remarks



Avoid duplicate ledger entries.



====================================================

DASHBOARD

====================================================



Admin dashboard:



- students

- staff

- fees received

- fees pending

- other income

- total income

- salaries paid

- transport expense

- maintenance

- other expenses

- total expense

- net balance



Filters:



- session

- today

- 7 days

- month

- year

- custom date



Use REAL database data only.



If database is empty:



show zeros and useful empty states.



Never fake numbers.



====================================================

STAFF DASHBOARD

====================================================



Staff sees ONLY own:



- today's attendance

- monthly attendance

- salary

- paid

- balance

- recent payments

- leave requests



====================================================

IMPORT / EXPORT SYSTEM

====================================================



THIS IS A CORE FEATURE.



Build ONE reusable Import Engine and ONE reusable Export Engine.



Do NOT build separate import logic from scratch for every page.



Every major module must have:



[Import]

[Download Sample]

[Export]



Modules:



Students

Student Sessions

Student Charges

Fee Payments

Staff

Staff Sessions

Salary Payments

Attendance

Leave

Vehicles

Vehicle Assignments

Driver KM

Fuel/Transport Expenses

Maintenance

Income

Expenses

Accounts



Import workflow:



UPLOAD

→ PREVIEW

→ VALIDATE

→ SHOW ERRORS

→ CONFIRM

→ IMPORT

→ RESULT



Show:



Total rows

Valid

Invalid

Duplicates

Imported



Never silently overwrite records.



====================================================

SAMPLE FILES

====================================================



Every importable module has a downloadable Sample CSV.



Sample contains:



- exact column headers

- 1–2 example rows

- correct date format

- field instructions where useful



IMPORTANT:

Sample data must NEVER be inserted into the database.



====================================================

IMPORT MATCHING

====================================================



For future real-data imports:



Students:

match using stable admission/SR identifier where appropriate.



Staff:

match using employee_id.



Do NOT create duplicate people when the same person exists.



For session data:

create the appropriate session relation.



Example:



Staff 101 exists.



Import 2025-26 salary → create/update only 2025-26 staff-session data.



Import 2026-27 salary → create/update only 2026-27 staff-session data.



Historical session data must remain untouched.



====================================================

GLOBAL IMPORT CENTER

====================================================



Create:



/imports



with cards for all modules.



Each card:



Download Sample

Import

Export



Show import history:



- file

- module

- rows

- successful

- failed

- user

- date

- status



====================================================

SECURITY

====================================================



Roles:



Admin

Accountant

Staff



Use Supabase RLS.



Admin:

full access.



Accountant:

appropriate student/fee/accounts access.



Staff:

own profile, attendance, leave, salary, payments only.



Do NOT rely only on frontend hiding.



No public signup.



Do not expose service-role keys in frontend.



====================================================

DATABASE

====================================================



Use normalized PostgreSQL.



Core:



profiles

user_roles

academic_sessions

school_settings



Students:



students

student_sessions

student_charges

fee_categories

fee_payments



Staff:



staff

staff_sessions

staff_attendance

leave_requests

payroll_periods

staff_payments



Transport:



vehicles

vehicle_assignments

driver_km_logs

transport_expenses



Finance:



income_categories

expense_categories

maintenance_expenses

transactions



System:



import_logs

audit_logs



Use:



UUID

foreign keys

indexes

timestamps

constraints



Use session_id everywhere session isolation is required.



====================================================

DATA INTEGRITY / BUG PREVENTION

====================================================



Before saving:



validate forms.



Prevent:



- duplicate submissions

- double-click payments

- duplicate employee IDs

- duplicate admission numbers

- duplicate attendance

- duplicate imports

- overpayments

- negative balances

- duplicate vehicle assignment

- cross-session records

- incorrect salary month

- wrong session totals



Use database constraints where appropriate.



Financial history should not be silently edited.



Use reversal/correction + audit for historical financial changes.



====================================================

MOBILE UX

====================================================



The app must feel good on Android phones.



Use:



- compact cards

- simple navigation

- sticky primary actions where useful

- responsive forms

- readable tables

- collapsible sections

- no page overflow



Make frequent tasks quick:



Add Student

Collect Fee

Add Staff

Record Salary

Mark Attendance

Add KM

Add Expense



====================================================

EMPTY STATES

====================================================



Because real data will be imported later:



Every module starts with:



"No data available"



and actions:



Add

Import

Sample



Do NOT insert demo data.



====================================================

REPORTS

====================================================



Provide simple reports with session/date filters:



Students

Fees

Pending Fees

Fee Collection

Staff

Salary

Payroll

Attendance

Leave

Drivers

Vehicles

KM

Fuel

Maintenance

Income

Expenses

Accounts



All reports should support CSV export.



Print where useful.



====================================================

PERFORMANCE + LOW CREDIT REQUIREMENT

====================================================



I have VERY LIMITED Lovable credits.



Therefore optimize implementation for minimal future changes.



CRITICAL:



- Create shared DataTable once.

- Create shared form/dialog system once.

- Create shared ImportDialog once.

- Create shared Export utility once.

- Create shared session filter once.

- Create shared validation utilities once.

- Create shared financial calculation utilities once.

- Reuse all of them.



Do NOT duplicate components.



Do NOT create unnecessary dependencies.



Do NOT spend credits on animations.



Do NOT create unnecessary advanced analytics.



Do NOT repeatedly redesign completed pages.



Do NOT create fake/demo data.



Prefer a smaller number of well-designed reusable components over many custom components.



====================================================

BUILD QUALITY

====================================================



The application should be production-oriented.



Handle:



- loading states

- empty states

- error states

- validation errors

- successful actions

- duplicate errors

- permission errors



Use clear messages.



Do not leave placeholder buttons that don't work.



Do not create fake functionality.



If a feature is visible, make it functional.



====================================================

TEST BEFORE FINISHING

====================================================



Before finalizing:



Check:



Authentication

Roles

RLS

Session switching

Student CRUD

Student session separation

Staff CRUD

Staff session separation

Salary history

30-day salary

Salary payments

Attendance

Leave

Payroll

Driver profile

Vehicle assignment

KM

Fuel

Maintenance

Accounts

Import

Sample CSV

Export

Dashboard

Mobile UI



Run TypeScript check and production build.



Fix errors caused by implementation.



====================================================

FINAL RULE

====================================================



BUILD THE ACTUAL APPLICATION.



Do NOT only provide a plan.



Do NOT ask me to manually create database tables.



Do NOT create old-data imports now.



Do NOT create demo school records.



Do NOT destroy or reset anything.



Build the clean foundation so that I can later import the real school data safely.



The final application must be:



SIMPLE

FAST

MOBILE-FRIENDLY

SESSION-SAFE

DATA-SAFE

EASY TO USE

PRODUCTION-READY



START BUILDING NOW.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wisdomschoolacc.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3f47ca7c-37cb-4220-a8ce-48feac744bb6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
