<div align="right">
  <a href="README.md">🇬🇧 English</a> | <a href="README.vi.md">🇻🇳 Tiếng Việt</a>
</div>

# TechFlow — Quản lý Bản vẽ & Tài liệu Nhà máy

![TechFlow](https://img.shields.io/badge/TechFlow-Internal%20App-blue)
![.NET 8](https://img.shields.io/badge/.NET-8.0-purple)
![Next.js 16](https://img.shields.io/badge/Next.js-16.2-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)

**TechFlow** là ứng dụng web nội bộ được thiết kế để quản lý, lưu trữ phiên bản và phân phối các bản vẽ kỹ thuật giữa các bộ phận trong công ty sản xuất.

## 🚀 Tính năng chính

- **Upload & Quản lý Phiên bản**: Quản lý bản vẽ kỹ thuật (.png, .jpg, .pdf, .dwg) với cơ chế versioning chặt chẽ.
- **Luồng duyệt Draft**: Nhân viên (Staff) upload bản nháp (draft), cần được Trưởng nhóm Kỹ thuật (Tech Leader) duyệt trước khi phát hành chính thức.
- **Phân phối Bản vẽ**: Gửi bản vẽ đã duyệt đến các bộ phận sản xuất cụ thể (vd: Cắt, Lắp ráp).
- **Xác nhận & Quản lý Deadline**: Các bộ phận sản xuất phải xác nhận đã nhận bản vẽ. Hệ thống tự động quét và cảnh báo các bản vẽ quá hạn xác nhận (24h).
- **Dừng Khẩn cấp (Stop)**: Tech Leader có thể ngay lập tức dừng phân phối một bản vẽ lỗi đến các bộ phận.
- **Yêu cầu Chỉnh sửa (Revision)**: Leader có thể yêu cầu Staff sửa bản vẽ, theo dõi toàn bộ luồng từ lúc yêu cầu đến khi upload file mới và được duyệt.
- **Thông báo Real-time**: Cảnh báo tức thì (thông qua SignalR) khi có bản vẽ mới, draft được duyệt, hoặc quá hạn xác nhận.

## 🏗️ Tech Stack

**Backend**
- C# / .NET 8 (Minimal APIs)
- Entity Framework Core 8
- PostgreSQL (Npgsql)
- JWT Bearer Authentication & mã hoá mật khẩu BCrypt
- SignalR (Giao tiếp WebSocket real-time)
- Swashbuckle (Swagger UI)

**Frontend**
- Next.js 16 (App Router)
- React 19 & TypeScript
- Tailwind CSS v4 & shadcn/ui components
- Lucide React (Icons)
- Microsoft SignalR Client
- Recharts (Biểu đồ Dashboard)

## 👥 Vai trò Người dùng (Roles)

1. **`Admin`**: Toàn quyền hệ thống. Quản lý người dùng, danh mục (category), bộ phận, và xem dashboard thống kê tổng.
2. **`TechLeader`**: Duyệt/từ chối bản draft của Staff, tự upload file trực tiếp, yêu cầu chỉnh sửa, dừng khẩn cấp (stop)/phục hồi (resume)/rollback bản vẽ thuộc danh mục quản lý.
3. **`Staff`**: Upload draft (chờ duyệt) và nộp lại file đã sửa theo yêu cầu của Leader.
4. **`Production`**: Bộ phận sản xuất, xem các bản vẽ được phân bổ cho bộ phận mình và bấm xác nhận đã nhận.
5. **`Planning`**: Chế độ xem read-only để theo dõi trạng thái các bản vẽ và tiến độ xác nhận của các bộ phận.

## 📡 Tổng quan API Endpoints

| Nhóm | Endpoint | Mô tả |
|---|---|---|
| **Auth** | `POST /api/auth/login` | Đăng nhập lấy JWT |
| | `POST /api/auth/register` | Tạo user mới (Chỉ Admin) |
| **Files** | `POST /api/files/upload` | Upload bản vẽ (Staff tạo draft, Leader upload trực tiếp) |
| | `GET /api/files/{id}/history` | Xem lịch sử phiên bản của file |
| | `POST /api/files/{id}/stop` | Dừng (thu hồi) bản vẽ khẩn cấp |
| | `POST /api/files/{id}/resume` | Tiếp tục phân phối bản vẽ |
| | `POST /api/files/{fileId}/versions/{versionId}/rollback` | Rollback về phiên bản cũ |
| | `GET /api/files/drafts` | Danh sách draft chờ duyệt |
| | `POST /api/files/drafts/{id}/approve` | Duyệt draft (Leader) |
| | `POST /api/files/drafts/{id}/reject` | Từ chối draft (Leader) |
| | `GET /api/files/revision-requests` | Danh sách yêu cầu chỉnh sửa |
| | `POST /api/files/revision-requests` | Tạo yêu cầu chỉnh sửa (Leader) |
| | `POST /api/files/revision-requests/{id}/submit` | Nộp file sửa (Staff) |
| | `POST /api/files/revision-requests/{id}/approve-revision`| Duyệt file đã sửa (Leader) |
| **Folders**| `GET /api/folders` | Lấy cây thư mục |
| | `POST /api/folders` | Tạo thư mục mới |
| | `DELETE /api/folders/{id}` | Xóa thư mục |
| | `GET /api/folders/{id}/files` | Lấy danh sách file trong thư mục |
| **Workspaces**| `GET /api/workspaces/pending-files` | Lấy danh sách bản vẽ cần xác nhận (Production) |
| **Distributions**| `POST /api/distributions/{id}/confirm` | Xác nhận đã nhận bản vẽ |
| **Notifications**| `GET /api/notifications` | Xem thông báo |
| | `PUT /api/notifications/{id}/read` | Đánh dấu đã đọc |
| | `PUT /api/notifications/read-all` | Đánh dấu tất cả đã đọc |
| **Admin** | Các endpoint `/api/admin/*` | Quản trị user, category, dashboard, system history |

## ⚙️ Hướng dẫn Cài đặt & Chạy

### 1. Cài đặt Database
Đảm bảo đã cài đặt PostgreSQL. Tạo một database mới tên là `TechFlowDB`.

### 2. Cài đặt Backend (.NET)
1. Mở thư mục `techflow_be/MinimalAPIs/`.
2. Copy các file cấu hình mẫu:
   - Đổi tên `appsettings.example.json` thành `appsettings.json`.
   - Đổi tên `appsettings.Development.example.json` thành `appsettings.Development.json`.
3. Sửa thông tin kết nối Database và `Key` JWT trong file `appsettings.json`.
4. **Lưu ý về CORS**: Backend hiện đang cấu hình CORS cứng cho môi trường VPS (vd: `technical.vfr.net.vn:10115`, `172.29.127.250:10115`). Nếu chạy local hoặc trên port khác, bạn có thể cần sửa lại policy `NextJsDev` trong `Program.cs`.
5. Chạy migration tạo database:
   ```bash
   dotnet ef database update
   ```
6. Khởi động API:
   ```bash
   dotnet run
   ```
   Backend sẽ chạy tại `http://localhost:10114`.

### 3. Cài đặt Frontend (Next.js)
1. Mở thư mục `techflow_fe/`.
2. Cài đặt thư viện:
   ```bash
   npm install
   ```
3. Copy file biến môi trường:
   - Đổi tên `.env.example` thành `.env`.
   - Đảm bảo `NEXT_PUBLIC_API_BASE_URL` trỏ đúng về địa chỉ Backend (mặc định là `http://localhost:10114`).
4. Khởi động Frontend:
   ```bash
   npm run dev
   ```
   Frontend sẽ chạy tại `http://localhost:10115`.
