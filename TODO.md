# Deployment & Delivery Checklist

## 1. Prerequisites (Render.com Hosting)
To host the full-stack application, we recommend deploying the **backend** and **frontend** separately on Render.

### **A. Backend Deployment (Python FastAPI)**
1.  **Create a New Web Service** on Render.
2.  **Connect your Repository** containing this project.
3.  **Root Directory:** `python-backend`
4.  **Runtime:** `Python 3`
5.  **Build Command:** `pip install -r requirements.txt`
6.  **Start Command:** `uvicorn main:app --host 0.0.0.0 --port 10000`
7.  **Environment Variables:** Add all keys from your local `.env`:
    *   `META_PHONE_ID`
    *   `META_WABA_ID`
    *   `META_ACCESS_TOKEN`
    *   `SUPABASE_URL`
    *   `SUPABASE_SERVICE_ROLE_KEY`
    *   `RAZORPAY_KEY_ID`
    *   `RAZORPAY_KEY_SECRET`
    *   `CORS_ORIGINS`: Add your **Frontend URL** once deployed (e.g., `https://your-frontend.onrender.com`).

### **B. Frontend Deployment (React/Vite)**
1.  **Create a Static Site** on Render.
2.  **Connect the same Repository**.
3.  **Root Directory:** `.` (root of the repo)
4.  **Build Command:** `npm install && npm run build`
5.  **Publish Directory:** `dist`
6.  **Environment Variables:**
    *   `VITE_SUPABASE_URL`: Your Supabase Project URL.
    *   `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
    *   `VITE_API_URL`: **Important!** Set this to your **Backend URL** from step A (e.g., `https://your-backend.onrender.com`).

---

## 2. Security & Database Access
Since you are using Supabase, security is handled via **Row Level Security (RLS)** and API Keys.

### **Database Access Control**
1.  **Enable RLS:** Ensure RLS is enabled on all tables (`contacts`, `message_logs`, etc.).
2.  **Policies:**
    *   `contacts`: Allow `select`, `insert`, `update`, `delete` ONLY for authenticated users where `auth.uid() = user_id`.
    *   `message_logs`: Allow `select`, `insert` for authenticated users.
3.  **Service Role Key:** The `SUPABASE_SERVICE_ROLE_KEY` is used **only on the backend** to bypass RLS for admin tasks (like user registration). **NEVER** expose this key in the frontend.

### **CORS Configuration (Limit Backend Access)**
Currently, the backend allows all origins (`*`). Once your frontend is live, **restrict this** to prevent unauthorized websites from calling your API.

1.  In your Render Backend Environment Variables, set:
    `CORS_ORIGINS` = `https://your-frontend-app.onrender.com`
2.  The `main.py` is already configured to read this variable:
    ```python
    origins_env = os.environ.get("CORS_ORIGINS", "*")
    CORS_ORIGINS = [o.strip() for o in origins_env.split(",") if o.strip()]
    ```
    This ensures only your frontend can communicate with your backend.

---

## 3. Legal Pages & Compliance
To go live with a payment gateway (Razorpay) and Meta API, you must have these pages accessible:

*   **Terms & Conditions:** `/terms`
*   **Privacy Policy:** `/privacy`
*   **Refund Policy:** `/refund`

*These pages have been generated and linked in the Login screen footer.*

**Action Item:**
*   Review the content in `src/pages/Terms.jsx`, `Privacy.jsx`, and `Refund.jsx`.
*   Replace placeholder emails (e.g., `support@wappbroadcast.com`) with your actual support email.

---

## 4. Final Delivery to Client
1.  **Transfer Ownership:**
    *   **Supabase:** Invite the client as an Owner or Transfer the project.
    *   **Render:** Transfer the service or set up billing on their card.
    *   **Meta Business Manager:** Ensure the client owns the WABA (WhatsApp Business Account) and the App.
    *   **Razorpay:** Ensure the API keys are from their Live Mode account.

2.  **Production Checklist:**
    *   [ ] Change Razorpay Keys to **LIVE** mode keys in Render Env Vars.
    *   [ ] Change Meta App form **Development** to **Live** mode.
    *   [ ] Verify the `VITE_API_URL` points to the production backend.
    *   [ ] Test a small real payment (₹1) and refund it.
    *   [ ] Verify the Webhook URL in Meta App Dashboard points to your backend (if using webhooks).

3.  **Documentation:**
    *   Provide this `TODO.md` file layout to the client so they understand the architecture.
