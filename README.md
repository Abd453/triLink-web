# 🎓 TriLink Web — Smart School Management System

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)

> **Learn smarter, grow faster.**  
> TriLink Web is a modern, comprehensive, role-tailored school management web platform designed to streamline administrative workflows, empower teachers, support interactive student learning, and keep parents connected in real time.

---

## 🌟 Key Features & Role Portals

TriLink provides personalized, high-performance dashboards and toolsets tailored to four distinct user roles:

### 🛠️ 1. Administrator Portal (`/admin`)
* **School Configuration & Setup:** Manage terms, grading systems, and institutional settings.
* **User & Staff Management:** Comprehensive registration and directory for students, teachers, and parents.
* **Class & Section Assignment:** Flexible allocation of students and teachers to subjects and sections.
* **Attendance & Homeroom Oversight:** Institution-wide tracking and automated reporting.
* **Academic Reports & Auditing:** Generate PDF report cards, monitor audit logs, and gather feedback.

### 👩‍🏫 2. Teacher Portal (`/teacher`)
* **Gradebook & Assessment Management:** Record, calculate, and publish student grades and report cards.
* **Exam Creation & Monitoring:** Design assessments and utilize live proctoring features.
* **Assignment Hub:** Post homework, monitor submissions, and provide direct student feedback.
* **Classroom & Attendance Tools:** Daily attendance logging, homeroom tracking, and class calendars.
* **Communication Center:** Send announcements and communicate directly via real-time chat.

### 🎓 3. Student Portal (`/student`)
* **Interactive Learning Dashboard:** View schedules, active courses, announcements, and upcoming tasks.
* **AI Tutor Integration:** On-demand, AI-powered learning assistance (`AiTutorChat`).
* **Online Exams & Results:** Take proctored online examinations with real-time feedback and detailed score analysis.
* **Academic Progress:** Track grades, attendance, and assignment history.

### 👨‍👩‍👧 4. Parent Portal (`/parent`)
* **Child Overview:** Unified view of academic progress, grade distributions, and attendance for all enrolled children.
* **Direct Communication:** Seamless messaging channel with teachers and school administration.
* **Announcements & Alerts:** Instant notifications regarding school events, schedules, and official notices.

---

## 🤖 Advanced Capabilities

* 🤖 **AI Core Assistance:** Built-in integration with the TriLink AI Core service for intelligent tutoring, automated feedback, and student support.
* 🛡️ **Live Exam Proctoring & Monitoring:** Built-in safeguards and live exam monitoring tools (`ExamMonitor`) to uphold academic integrity.
* 💬 **Real-time Messaging & Socket Operations:** Powered by WebSocket and Socket.io for instant chat and notification toasts.
* 📄 **Automated PDF Generation:** Instant generation of official report cards and transcripts using `jsPDF` and `jspdf-autotable`.
* 📐 **Math & Rich Text Rendering:** Full support for LaTeX math expressions powered by KaTeX.

---

## 🛠️ Technology Stack

| Category | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Server Actions) |
| **UI & Styling** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [React Icons](https://react-icons.github.io/react-icons/) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) |
| **Real-time Communications** | [Socket.io Client](https://socket.io/) |
| **Document & Math Processing** | `jsPDF`, `jspdf-autotable`, `KaTeX` |
| **Analytics & Data Viz** | [Recharts](https://recharts.org/) |
| **Testing** | [Vitest](https://vitest.dev/), Testing Library, Fast-check |
| **Deployment & Containers** | Docker, Docker Compose, Vercel, Google Cloud Build |

---

## 📁 Repository Structure

```text
triLink-web/
├── vercel.json                 # Root Vercel build configuration
└── web/                        # Main Next.js application workspace
    ├── src/
    │   ├── app/                # Next.js App Router (Admin, Teacher, Student, Parent routes)
    │   ├── components/         # Reusable UI components & feature modules
    │   ├── hooks/              # Custom React hooks
    │   ├── lib/                # API clients, utility functions, & services
    │   └── store/              # Global state stores (Zustand)
    ├── public/                 # Static assets & media
    ├── Dockerfile              # Multi-stage production container build
    ├── docker-compose.yml      # Local containerized orchestration
    ├── next.config.ts          # Next.js build settings
    └── vitest.config.ts        # Vitest configuration
```

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: `v20.x` or `v22.x` (recommended)
* **npm** / **pnpm** / **yarn**

### 1. Installation

Clone the repository and install dependencies in the `web/` workspace:

```bash
git clone https://github.com/your-org/triLink-web.git
cd triLink-web/web
npm install
```

### 2. Environment Setup

Create a `.env.local` file inside the `web/` folder based on `.env.example`:

```bash
cp .env.example .env.local
```

Configure your environment variables:

```env
# Backend API Base URL
NEXT_PUBLIC_API_BASE_URL=https://your-backend-api.com

# AI Core Configuration
NEXT_PUBLIC_AI_CORE_URL=https://your-ai-core-url
NEXT_PUBLIC_AI_INTERNAL_KEY=your-internal-ai-key

# Frontend URL
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# SMTP / Email Configuration (Server-side)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🐳 Docker Deployment

Run the web frontend in a production-ready container:

### Using Docker Compose

```bash
cd web
docker compose up --build -d
```

### Manual Docker Build

```bash
cd web
docker build -t trilink-web .
docker run -p 3000:3000 --env-file .env.local trilink-web
```

---

## 🧪 Testing & Linting

Run unit and integration tests using Vitest:

```bash
# Run tests
npm run test

# Run linter
npm run lint
```

---

## 🌐 Deployment

### Vercel
The repository includes a root `vercel.json` and workspace settings configured for zero-downtime continuous deployment via Vercel. Simply connect your GitHub repository to Vercel and configure the environment variables.

### Google Cloud Build / Cloud Run
Use `cloudbuild.yaml` and `Dockerfile` to build and deploy to Google Cloud Run.

---

## 📄 License

This project is proprietary software belonging to the **TriLink Platform**. All rights reserved.
