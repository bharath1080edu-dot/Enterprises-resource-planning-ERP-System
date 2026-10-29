# UPVC Factory ERP System

An integrated Enterprise Resource Planning (ERP) platform purpose-built for UPVC window and door manufacturing units.

---

## 🚀 Features

- **Dashboard & Analytics**: Real-time overview of revenue, active orders, factory production metrics, and stock alerts.
- **Orders & Quotations**: Comprehensive order management lifecycle from quotation generation to invoicing.
- **Profile Cut Optimizer**: Smart cutting optimization algorithms to minimize UPVC profile wastage.
- **Inventory Management**: Stock tracking for profiles, hardware, glass, gaskets, and consumables.
- **Production Tracking**: Real-time status stages (Cutting, Welding, Corner Cleaning, Hardware Fitting, Glazing, QC, Dispatch).
- **Payments & Accounting**: Track customer balances, milestone payments, and transaction history.
- **Staff & Attendance**: Manage employees, daily attendance, shifts, and payroll records.
- **WhatsApp Integration**: Automated alerts and order status updates sent directly to clients via WhatsApp.
- **Customer Order Tracking**: Dedicated tracking portal for clients to check their order progress.

---

## 🛠️ Tech Stack

- **Frontend**: React.js, TailwindCSS, Lucide Icons, Axios
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Integrations**: WhatsApp Web API / Baileys

---

## 📂 Project Structure

```
upvc-factory-erp/
├── backend/               # Node.js Express API & WhatsApp service
│   ├── config/            # Database and app configuration
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Authentication & error handling
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic & WhatsApp service
│   ├── .env.example       # Template for backend environment variables
│   └── server.js          # Express entrypoint
├── database/              # SQL schema and migration scripts
│   ├── schema.sql         # Initial database schema
│   └── add_quotations.sql # Migration scripts
├── frontend/              # React frontend application
│   ├── public/            # Public static assets
│   └── src/               # React components, pages, context, and styles
├── .gitignore             # Root gitignore protecting secrets & dependencies
└── README.md
```

---

## ⚙️ Getting Started

### 1. Prerequisites
- Node.js (v16 or higher)
- MySQL Server

### 2. Database Setup
1. Create a MySQL database named `upvc_erp`.
2. Import the schema:
   ```bash
   mysql -u root -p upvc_erp < database/schema.sql
   mysql -u root -p upvc_erp < database/add_quotations.sql
   ```

### 3. Backend Setup
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your database credentials:
   ```bash
   cp .env.example .env
   ```
4. Start the backend server:
   ```bash
   npm run dev   # or: node server.js
   ```

### 4. Frontend Setup
1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React development server:
   ```bash
   npm start
   ```
4. Access the web app at `http://localhost:3000`.

---

## 🔒 Security & Best Practices
- Never commit the `.env` file containing database passwords and secret keys.
- WhatsApp session data is isolated and excluded from version control via `.gitignore`.
