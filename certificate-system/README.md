# 🎓 Certificate Generation System

Sisitemu yo gukora certificates z'abanyeshuri, ifite:

- **Web Dashboard** yo gucunga no guprintinga
- **PDF Generation** - certificate muri PDF format
- **Batch Printing** - certificates zose hamwe

---

## 🚀 Setup (Intangiriro)

### 1. Supabase Setup

1. Jya kuri [supabase.com](https://supabase.com) ukore account
2. Kora project nshya
3. Jya kuri **SQL Editor** ugashyiramo ibiri muri `backend/database.sql`
4. Kora storage buckets 2:
   - `student-photos` (public)
   - `assets` (public)
5. Kopi **Project URL** na **API Keys** ziva kuri Settings > API

### 2. Backend Setup

```bash
cd backend
npm install

# Vugurura .env file
# Shyiramo SUPABASE_URL na SUPABASE_SERVICE_KEY

npm run dev
# Server itangira kuri http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# App itangira kuri http://localhost:3000
```

---

## 📱 Uko Gukoresha

### Gushyiramo Abanyeshuri

**Option 1 - Individual:**

- Jya kuri "Upload Students"
- Shyiramo ifoto + amazina + photo number
- Save

**Option 2 - CSV (Bulk):**

- Tegura CSV file ufite columns:
  ```
  Photo Number, First Name, Last Name, Class, Year, School
  001, John, Manzi, Top Class, 2025, ABC School
  002, Alice, Uwase, P6, 2025, ABC School
  ```
- Jya kuri "Upload Students" > "CSV Upload"
- Upload CSV > Upload All

### Gukora Certificate

**Single Certificate:**

- Jya kuri "Generate Certificate"
- Shakisha umunyeshuri (izina cyangwa photo number)
- Hitamo template
- Download PDF cyangwa Print

**Batch (Abana Bose):**

- Jya kuri "Print All"
- Hitamo class + year
- Click "Download All" cyangwa "Print All"
- PDF imwe ifite certificates zose izakorwa

### Templates Available

- 🟡 **Top Class** - Yellow theme
- 🔵 **P6** - Blue theme
- 🟢 **S3** - Green theme
- 🔴 **S6** - Red theme
- 🟣 **Nursery** - Purple theme
- 🟠 **Graduation** - Orange/Gold theme

---

## 📱 Mobile App Setup

```bash
cd mobile
npm install

# Vugurura lib/supabase.js ushyiremo SUPABASE_URL na SUPABASE_ANON_KEY

# Tangira kuri emulator cyangwa telephone
npm start
# Cyangwa kuri Android:
npm run android
```

Mobile App features:
- 📷 **Camera** — fata ifoto muri portrait (3:4) ya ID
- 🖼️ **Gallery** — hitamo ifoto muri telefoni
- 📝 **Add Student** — shyiramo Photo Number + amazina + class
- 👥 **All Students** — reba abanyeshuri bose (filter by class)
- 🔍 **Search** — shakisha umunyeshuri (izina / photo number)

---

## 🎨 Certificate Features (Publisher-Style)

Buri certificate ifite:
- **Full background image** — 18% opacity (ntiivangira inyandiko)
- **Color stripes** — ku mbaho 4 za template color
- **Corner ornaments** — mu mfundo 4 za page
- **Diamond dividers** — decorative separators
- **Double name underline** — publisher style
- **Highlighted class box** — colored band kubw'izina ry'umwaka
- **Watermark** — izina ry'ishuri, subtle cyane
- **Photo panel** — bordered, ifite photo number label
- **Signature image** — upload signature ya nyayo
- **Stamp** — circular stamp (upload cyangwa placeholder)

---

## 🗂️ Project Structure

```
certificate-system/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server
│   │   ├── supabase.js       # Database client
│   │   ├── routes/           # API routes
│   │   └── controllers/      # Business logic + PDF generation
│   ├── database.sql          # Supabase schema
│   └── .env                  # Configuration
├── frontend/
│   └── src/
│       ├── App.jsx            # Router
│       ├── api/               # API calls
│       ├── components/        # Layout, Sidebar
│       └── pages/
│           ├── Dashboard.jsx
│           ├── UploadStudents.jsx   # Individual + CSV
│           ├── SearchStudent.jsx    # Search + print
│           ├── GenerateCertificate.jsx
│           ├── PrintAll.jsx         # Batch printing
│           ├── TemplatePage.jsx     # Per-class view
│           └── Settings.jsx         # School info + background selector
└── mobile/
    ├── app/
    │   ├── _layout.jsx        # Navigation
    │   ├── index.jsx          # Home + stats
    │   ├── add-student.jsx    # Camera + form
    │   ├── students.jsx       # All students list
    │   └── search.jsx         # Search screen
    └── lib/
        └── supabase.js        # DB + storage client
```

---

## 🔧 Technology Stack

| Layer    | Technology                  |
| -------- | --------------------------- |
| Frontend | React + Vite + Tailwind CSS |
| Backend  | Node.js + Express           |
| Database | Supabase (PostgreSQL)       |
| Storage  | Supabase Storage            |
| PDF      | pdf-lib                     |
| Icons    | Lucide React                |
