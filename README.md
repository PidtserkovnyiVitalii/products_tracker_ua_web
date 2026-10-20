# 🌐 Products Tracker UA Web

Modern, high-performance web dashboard for the **Products Tracker UA** platform, designed for inventory, hierarchical product taxonomy, store locations, and sales operations.

---

## 🛠 Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite 8](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Routing**: [TanStack Router](https://tanstack.com/router) (file-based routing)
- **Data Fetching & Cache**: [TanStack Query v5](https://tanstack.com/query)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Form Validation**: [Zod](https://zod.dev/)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v22+`
- **npm**: `v10+`

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set the backend API endpoint (`http://localhost:3000` by default):

```env
VITE_API_URL=http://localhost:3000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

### 4. Build for Production

```bash
npm run build
```

---

## 📁 Project Structure

```text
src/
├── api/             # Axios instance with JWT bearer token interceptors
├── assets/          # Static assets & icons
├── components/      # Shared reusable UI components
├── routes/          # TanStack Router file-based pages
│   ├── __root.tsx   # App shell, navigation header & footer
│   ├── index.tsx    # Dashboard overview
│   ├── login.tsx    # Sign-in page (JWT authentication)
│   ├── categories.tsx # Hierarchical category tree view & creation
│   └── locations.tsx  # Store & warehouse locations list
├── store/           # Zustand stores (e.g. authStore for JWT and user state)
├── routeTree.gen.ts # Auto-generated TanStack route tree
└── index.css        # Global CSS & Tailwind CSS import
```
