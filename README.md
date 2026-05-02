# DOK CRM - Sales Funnel Management System

A modern CRM & Sales Funnel web application built with React, TypeScript, and Firebase.

## Features

- **Role-Based Authentication**: Admin and Sales user roles with Firebase Auth
- **Dashboard**: KPIs, charts, and real-time data visualization
- **Sales Pipeline**: Drag-and-drop Kanban board for deal management
- **Leads Management**: Create, edit, and track leads with full CRUD operations
- **Rep Comparison**: Admin-only page to compare sales rep performance
- **Analytics**: Funnel charts, bubble charts, and detailed statistics
- **Reports**: Generate and export reports in CSV and PDF formats
- **Real-Time Updates**: Live data synchronization with Firestore

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Charts**: Recharts
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Drag & Drop**: @dnd-kit
- **Backend**: Firebase (Auth, Firestore)
- **Export**: jsPDF, PapaParse

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Firebase account

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable **Email/Password** authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
4. Create **Firestore Database**:
   - Go to Firestore Database > Create database
   - Start in production mode
5. Get your web app config:
   - Go to Project Settings > General > Your apps
   - Click "Add app" > Web
   - Copy the config values

### 2. Environment Setup

```bash
# Copy environment example
cp .env.example .env.local

# Edit .env.local with your Firebase config
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Deploy Firestore Security Rules

```bash
# Install Firebase CLI if not installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init

# Deploy rules and indexes
firebase deploy --only firestore
```

### 5. Seed Initial Users

1. Download your Firebase service account key:
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save as `scripts/service-account.json`

2. Run the seed script:
```bash
npm run seed-users
```

This creates the following users:
| Email | Password | Role |
|-------|----------|------|
| dokadmin@gmail.com | dokadmin@123 | admin |
| salesA@gmail.com | sales@@123 | sales |
| salesB@gmail.com | SalesB@123 | sales |

### 6. Migrate Existing Data (Optional)

If you have existing data in Google Sheets:

1. Copy your Google credentials file to `scripts/credentials.json`
2. Update `SPREADSHEET_ID` in `scripts/migrate-data.ts`
3. Run:
```bash
npm run migrate-data
```

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
dok-crm-firebase/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── auth/         # Authentication components
│   │   ├── charts/       # Chart components
│   │   ├── dashboard/    # Dashboard widgets
│   │   ├── kanban/       # Kanban board components
│   │   ├── layout/       # Layout components
│   │   ├── leads/        # Lead management components
│   │   ├── reports/      # Report components
│   │   └── ui/           # shadcn/ui base components
│   ├── config/           # Configuration files
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and helpers
│   ├── pages/            # Page components
│   ├── store/            # Zustand stores
│   └── types/            # TypeScript types
├── scripts/              # Migration and seed scripts
├── firestore.rules       # Firestore security rules
└── firestore.indexes.json # Firestore indexes
```

## User Roles

### Admin
- View all leads from all sales reps
- Access Rep Comparison page
- Delete leads
- Full dashboard with global statistics

### Sales
- View only their own leads
- Cannot access Rep Comparison
- Cannot delete leads
- Personal dashboard with their statistics

## Firestore Collections

### `users`
Stores user profiles with roles.

### `leads`
Main CRM data with fields:
- companyName, solution, contactName, contactNumber
- salesStage, imageCount, boxCount
- estimatedRevenue, probability
- remarks, hoUpdate
- ownerId, ownerEmail
- createdAt, updatedAt

### `tasks`
User tasks related to leads.

### `activities`
Activity log for tracking changes.

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Firebase Hosting

```bash
firebase deploy
```

## Security

- Firestore rules enforce role-based access control
- Sales users can only read/write their own documents
- Admin has full access to all documents
- Activities are immutable (no update/delete)

## License

MIT
