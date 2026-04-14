# Deployment Guide: Going Online

There are two main ways to show your project to a customer:
1.  **Quick Demo (Ngrok)**: Exposes your *local* machine to the internet. Fastest, easiest, perfect for a quick meeting.
2.  **Cloud Deployment**: Hosts your app on servers (e.g., Vercel, Render). More permanent, but requires setup (especially for the database).

---

## Option 1: The Quickest Way (Ngrok)
This allows the customer to access the site running on your computer right now.

### Prerequisites
1.  Download **ngrok** from [ngrok.com](https://ngrok.com/download) and install it.
2.  Sign up for a free account to get your Authtoken.

### Steps
1.  **Start your Backend** (Port 3000):
    Open a terminal in `backend/` and run:
    ```bash
    npm run dev
    ```

2.  **Start your Frontend** (Port 5173):
    Open a terminal in `frontend/` and run:
    ```bash
    npm run dev
    ```

3.  **Expose the Backend**:
    Open a NEW terminal and run:
    ```bash
    ngrok http 3000
    ```
    *Copy the Forwarding URL (e.g., `https://aaaa-1111.ngrok-free.app`).*

4.  **Update Frontend Config**:
    Go to `frontend/src/utils/api.ts` (or wherever your Axios instance is) and change the `baseURL` to your **Ngrok Backend URL**.
    ```typescript
    // frontend/src/utils/api.ts
    const api = axios.create({
        baseURL: 'https://aaaa-1111.ngrok-free.app/api', // Update this!
    });
    ```

5.  **Expose the Frontend**:
    Open ANOTHER terminal and run:
    ```bash
    ngrok http 5173
    ```
    *Copy this forwarding URL.* **Send this URL to your customer.**

**Note:** When you stop ngrok, the URLs stop working.

---

## Option 2: Permanent Cloud Deployment (Render + Vercel)

Since you are using SQLite, **you cannot simply deploy to most cloud platforms** (like Heroku or Render) because they delete the database file every time the server restarts.

**You must switch to PostgreSQL** for a real deployment.

### Phase 1: Switch to PostgreSQL (Required for Cloud)
1.  **Get a Free Database**: Sign up for [Supabase](https://supabase.com/) or [Neon.tech](https://neon.tech/) and create a project. They will give you a `postgres://...` connection string.
2.  **Update `schema.prisma`**:
    ```prisma
    datasource db {
      provider  = "postgresql"
      url       = env("DATABASE_URL")
      directUrl = env("DIRECT_URL")
    }
    ```
3.  **Update `.env`**:
    - Replace `DATABASE_URL` with your **Transaction Pooler URL** (Port `6543`) from Supabase, and make sure it ends with `?pgbouncer=true`.
    - Add `DIRECT_URL` with your **Session / Direct Connection URL** (Port `5432`) from Supabase.
4.  **Migrate**: Run `npx prisma db push` (this uses the `DIRECT_URL` automatically).

### Phase 2: Deploy Backend (Render.com)
1.  Push your code to **GitHub**.
2.  Sign up for [Render.com](https://render.com/).
3.  Create a **New Web Service**.
    - Connect your GitHub repo.
    - Root Directory: `backend`
    - Build Command: `npm install`
    - Start Command: `npm start`
    - **Environment Variables**: 
      - Add `DATABASE_URL` (Supabase Pooler URL **with** `?pgbouncer=true`).
      - Add `DIRECT_URL` (Supabase Session URL on port `5432`).
      - Add `JWT_SECRET`, etc.
    - **Important**: Do **not** run `npx prisma db push` as part of your Render Build Command. Run it locally connected to the `DIRECT_URL` before deploying, or update your build command precisely.
4.  Render will give you a URL (e.g., `https://incident-backend.onrender.com`).

### Phase 3: Deploy Frontend (Vercel)
1.  Sign up for [Vercel](https://vercel.com/).
2.  **Import Project** from GitHub.
    - Root Directory: `frontend`
    - Framework Preset: Vite
    - **Environment Variables**:
        - `VITE_API_URL`: `https://incident-backend.onrender.com/api` (The URL from Phase 2).
3.  Deploy! Vercel will give you a URL (e.g., `https://incident-system.vercel.app`).

---

## Recommendation for TODAY
Use **Option 1 (Ngrok)**. It will take 5 minutes and requires no database changes.
