<div align="right">
  <a href="README.md">🇬🇧 English</a> | <a href="README.vi.md">🇻🇳 Tiếng Việt</a>
</div>

# TechFlow — Factory Drawing & Document Management

![TechFlow](https://img.shields.io/badge/TechFlow-Internal%20App-blue)
![.NET 8](https://img.shields.io/badge/.NET-8.0-purple)
![Next.js 16](https://img.shields.io/badge/Next.js-16.2-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)

**TechFlow** is an internal web application designed to manage, version, and distribute technical drawings across different departments in a manufacturing company.

## 🚀 Key Features

- **Upload & Version Control**: Manage technical drawings (.png, .jpg, .pdf, .dwg) with strict versioning.
- **Review Workflow (Drafts)**: Staff members can upload drafts which must be approved or rejected by a Tech Leader before being published.
- **Targeted Distribution**: Distribute approved drawings to specific production departments (e.g., cutting, assembly).
- **Confirmation & Deadlines**: Production departments must confirm receipt of drawings. A background job automatically checks and flags overdue confirmations.
- **Emergency Stops**: Tech Leaders can immediately halt the distribution of a flawed drawing to specific departments.
- **Revision Requests**: Leaders can request staff to revise a drawing, tracking the workflow from request to new upload and approval.
- **Real-time Notifications**: Instant alerts (powered by SignalR) for new uploads, draft approvals, overdue deadlines, etc.

## 🏗️ Tech Stack

**Backend**
- C# / .NET 8 (Minimal APIs)
- Entity Framework Core 8
- PostgreSQL (Npgsql)
- JWT Bearer Authentication & BCrypt Password Hashing
- SignalR for real-time WebSocket communication
- Swashbuckle (Swagger UI)

**Frontend**
- Next.js 16 (App Router)
- React 19 & TypeScript
- Tailwind CSS v4 & shadcn/ui components
- Lucide React for icons
- Microsoft SignalR Client
- Recharts for dashboard analytics

## 👥 User Roles

1. **`Admin`**: Full system access. Manages users, categories, departments, and views system-wide dashboard statistics.
2. **`TechLeader`**: Approves/rejects drafts from staff, uploads files directly, requests revisions, and manages emergency stops/rollbacks for their assigned category.
3. **`Staff`**: Uploads draft drawings (requires Leader approval) and submits corrected files for revision requests.
4. **`Production`**: Views distributed drawings for their specific department and confirms receipt.
5. **`Planning`**: Read-only access to view the status of all drawings and distributions across departments.

## 📡 API Endpoints Overview

| Group | Endpoint | Description |
|---|---|---|
| **Auth** | `POST /api/auth/login` | Authenticate and get JWT |
| | `POST /api/auth/register` | Register new user (Admin only) |
| **Files** | `POST /api/files/upload` | Upload a new drawing (Staff creates draft, Leader publishes directly) |
| | `GET /api/files/{id}/history` | Get version history of a file |
| | `POST /api/files/{id}/stop` | Stop a drawing distribution |
| | `POST /api/files/{id}/resume` | Resume a stopped drawing |
| | `POST /api/files/{fileId}/versions/{versionId}/rollback` | Rollback to a previous version |
| | `GET /api/files/drafts` | List pending drafts |
| | `POST /api/files/drafts/{id}/approve` | Approve a draft (Leader) |
| | `POST /api/files/drafts/{id}/reject` | Reject a draft (Leader) |
| | `GET /api/files/revision-requests` | List revision requests |
| | `POST /api/files/revision-requests` | Create a revision request |
| | `POST /api/files/revision-requests/{id}/submit` | Submit a revised file (Staff) |
| | `POST /api/files/revision-requests/{id}/approve-revision`| Approve a revised file (Leader) |
| **Folders**| `GET /api/folders` | Get folder tree for a category |
| | `POST /api/folders` | Create a new folder |
| | `DELETE /api/folders/{id}` | Delete a folder |
| | `GET /api/folders/{id}/files` | Get files in a folder |
| **Workspaces**| `GET /api/workspaces/pending-files` | Get pending drawing confirmations for a department |
| **Distributions**| `POST /api/distributions/{id}/confirm` | Confirm receipt of a drawing |
| **Notifications**| `GET /api/notifications` | Get user/department notifications |
| | `PUT /api/notifications/{id}/read` | Mark as read |
| | `PUT /api/notifications/read-all` | Mark all as read |
| **Admin** | Various `/api/admin/*` | Manage users, categories, view stats and system history |

## ⚙️ Configuration & Setup

### 1. Database Setup
Ensure you have PostgreSQL installed and running. Create a new database named `TechFlowDB`.

### 2. Backend Setup (.NET)
1. Navigate to `techflow_be/MinimalAPIs/`.
2. Copy the example configuration files:
   - Rename `appsettings.example.json` to `appsettings.json`.
   - Rename `appsettings.Development.example.json` to `appsettings.Development.json`.
3. Update `appsettings.json` with your database credentials and a secure JWT key.
4. Note on **CORS**: The backend currently configures CORS specifically for a VPS deployment environment (e.g., `technical.vfr.net.vn:10115`, `172.29.127.250:10115`). If you are running locally on a different port, you may need to update the `NextJsDev` policy in `Program.cs`.
5. Apply database migrations:
   ```bash
   dotnet ef database update
   ```
6. Run the API:
   ```bash
   dotnet run
   ```
   The API will start on `http://localhost:10114`.

### 3. Frontend Setup (Next.js)
1. Navigate to `techflow_fe/`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file:
   - Rename `.env.example` to `.env`.
   - Ensure `NEXT_PUBLIC_API_BASE_URL` points to your backend URL (e.g., `http://localhost:10114`).
4. Run the development server:
   ```bash
   npm run dev
   ```
   The frontend will start on `http://localhost:10115`.
