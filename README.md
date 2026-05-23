# School ERP System

A modern, full-stack School Enterprise Resource Planning (ERP) system designed to streamline academic operations, manage student records, and facilitate communication between administrators, teachers, and students.

## 🌟 Overview

The School ERP provides a centralized platform for managing the complete academic lifecycle. It features role-based access control, real-time dashboards, and comprehensive tools for marksheet management, attendance tracking, and class assignments. The system is built with a focus on data integrity, security, and a premium user experience.

## ✨ Features

- **Role-Based Access Control**: Distinct portals for Administrators, Teachers, and Students with strict authorization rules.
- **Academic Lifecycle Management**: Full support for academic sessions, terms, and automated student promotion.
- **Marksheet Management**: Robust grading system with support for DRAFT and PUBLISHED states, automated calculations, and secure finalization.
- **Class & Subject Management**: Flexible assignment of teachers to homerooms and specific subjects.
- **Real-time Dashboards**: Dynamic analytics and activity feeds tailored for each role.
- **Responsive UI/UX**: A modern, mobile-friendly interface built with Tailwind CSS and Shadcn UI components.

## 💻 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (Development/Demo) / PostgreSQL (Production)
- **ORM**: Prisma
- **Styling**: Tailwind CSS, class-variance-authority
- **Components**: Radix UI, Lucide Icons, Recharts
- **Validation**: Zod
- **Authentication**: Custom Role-based Auth (Extensible to NextAuth/Clerk)

## 📸 Screenshots

*(Add screenshots of the Admin Dashboard, Teacher Grading Portal, and Student View here)*
- `[Screenshot 1 Placeholder]`
- `[Screenshot 2 Placeholder]`
- `[Screenshot 3 Placeholder]`

## 🚀 Local Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd school-erp-marksheet
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Database Configuration:**
   The project uses SQLite for local development. Ensure your `.env` file contains the correct database URL:
   ```env
   DATABASE_URL="file:./dev.db"
   ```

4. **Initialize the Database:**
   Apply migrations and seed the database with initial mock data:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

5. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌐 Deployment Instructions

The application is optimized for deployment on Vercel. For a demo or showcase deployment, the local SQLite database (`dev.db`) can be committed and deployed alongside the application.

1. **Deploy to Vercel:**
   - Push your code to a GitHub repository.
   - Import the project into your Vercel dashboard.
   - Vercel will automatically detect the Next.js framework and configure the build settings.

2. **Build Configuration:**
   - **Build Command**: `npm run build`
   - **Install Command**: `npm install`
   - **Output Directory**: `.next`

3. **Production Database (Optional):**
   If deploying for production, replace the SQLite `DATABASE_URL` with a PostgreSQL connection string and run migrations during the build phase.

---
*Developed with a focus on secure, efficient, and scalable educational management.*
