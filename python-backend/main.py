import os
import hmac
import hashlib
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from supabase import create_client, Client
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Meta / WhatsApp
META_PHONE_ID = os.environ.get("META_PHONE_ID", "")
META_WABA_ID = os.environ.get("META_WABA_ID", "")
META_ACCESS_TOKEN = os.environ.get("META_ACCESS_TOKEN", "")
META_WEBHOOK_VERIFY_TOKEN = os.environ.get("META_WEBHOOK_VERIFY_TOKEN", "my_secure_webhook_token")
META_GRAPH_VERSION = "v22.0"

# Razorpay
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip()

# Supabase (admin / service-role for server-side writes)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# CORS — pass a comma-separated list via env, default is all origins
try:
    origins_env = os.environ.get("CORS_ORIGINS", "*")
    if origins_env == "*":
        CORS_ORIGINS = ["*"]
    else:
        # Split by comma and strip whitespace
        CORS_ORIGINS = [o.strip() for o in origins_env.split(",") if o.strip()]
except Exception:
    CORS_ORIGINS = ["*"]

# ---------------------------------------------------------------------------
# App / middleware
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    missing = []
    for name, val in [
        ("META_PHONE_ID", META_PHONE_ID),
        ("META_WABA_ID", META_WABA_ID),
        ("META_ACCESS_TOKEN", META_ACCESS_TOKEN),
        ("RAZORPAY_KEY_ID", RAZORPAY_KEY_ID),
        ("RAZORPAY_KEY_SECRET", RAZORPAY_KEY_SECRET),
        ("SUPABASE_URL", SUPABASE_URL),
        ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY),
    ]:
        if not val:
            missing.append(name)
    if missing:
        logger.warning("⚠️  Missing environment variables: %s", ", ".join(missing))
    else:
        logger.info("✅  All required environment variables are set.")
    yield


app = FastAPI(title="WhatsApp Automation API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _supabase_admin() -> Client:
    """Return a Supabase client that uses the service-role key (bypasses RLS)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase admin credentials not configured.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _require_meta_credentials():
    if not META_PHONE_ID or not META_ACCESS_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="Missing Meta credentials (META_PHONE_ID or META_ACCESS_TOKEN)."
        )


async def _razorpay_request(method: str, path: str, payload: dict | None = None):
    """Call Razorpay REST API directly to avoid SDK header issues."""
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay credentials not configured.")

    url = f"https://api.razorpay.com/v1/{path.lstrip('/')}"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "WhatsAppAutomation/1.0"
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(
            method=method.upper(),
            url=url,
            headers=headers,
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json=payload,
        )

    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    if resp.status_code >= 400:
        detail = (
            data.get("error", {}).get("description")
            or data.get("error", {}).get("reason")
            or data.get("error", {}).get("code")
            or data
        )
        raise HTTPException(status_code=resp.status_code, detail=str(detail))

    return data


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
async def health():
    return {"status": "ok", "service": "WhatsApp Automation API"}


# ── Auth: Register new user (bypasses email confirmation) ───────────────────

@app.post("/api/register")
async def register_user(request: Request):
    """
    Create a new user via Supabase Admin API (email confirmation bypassed).
    Also creates their profile row so valid_until is never null.
    """
    body = await request.json()
    email = body.get("email", "").strip()
    password = body.get("password", "").strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase admin credentials not configured.")

    admin_api = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        # Create user with email_confirm=True to skip confirmation email
        resp = await client.post(admin_api, headers=headers, json={
            "email": email,
            "password": password,
            "email_confirm": True,
        })

    if resp.status_code not in (200, 201):
        err = resp.json()
        msg = err.get("msg") or err.get("message") or err.get("error_description") or str(err)
        raise HTTPException(status_code=resp.status_code, detail=msg)

    user_data = resp.json()
    user_id = user_data.get("id")

    if user_id:
        # Ensure profile row exists (safe upsert)
        db = _supabase_admin()
        try:
            db.from_("profiles").upsert({"id": user_id, "payment_status": False, "valid_until": None}).execute()
        except Exception as e:
            logger.warning(f"Profile creation after registration failed (non-fatal): {e}")

    return JSONResponse(content={"success": True, "user_id": user_id}, status_code=201)


# ── 0. Get WABA Analytics / Status ──────────────────────────────────────────

@app.get("/api/waba-analytics")
async def get_waba_analytics():
    """Fetch WABA onboarding and business account details."""
    if not META_WABA_ID or not META_ACCESS_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="Missing Meta credentials (META_WABA_ID or META_ACCESS_TOKEN)."
        )

    # Fetch WABA info
    fields = "marketing_messages_onboarding_status,status,account_review_status,message_template_namespace"
    url = f"https://graph.facebook.com/{META_GRAPH_VERSION}/{META_WABA_ID}?fields={fields}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {META_ACCESS_TOKEN}"}
        )

    data = resp.json()
    if resp.status_code == 401:
        return {
            "marketing_messages_onboarding_status": "UNKNOWN",
            "meta_error": data.get("error", {}).get("message", "Unauthorized")
        }

    return JSONResponse(content=data, status_code=resp.status_code)


# ── 1. Get WhatsApp Templates ───────────────────────────────────────────────

@app.get("/api/templates")
async def get_templates():
    """Fetch approved message templates from Meta WABA."""
    if not META_WABA_ID or not META_ACCESS_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="Missing Meta credentials (META_WABA_ID or META_ACCESS_TOKEN)."
        )

    url = (
        f"https://graph.facebook.com/v23.0/{META_WABA_ID}/message_templates"
        "?fields=name,status,components,language,category"
    )

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {META_ACCESS_TOKEN}"})

    return JSONResponse(content=resp.json(), status_code=resp.status_code)


# ── 2. Send Message ─────────────────────────────────────────────────────────

@app.post("/api/send-message")
async def send_message(request: Request):
    """Forward a message payload to the Meta Cloud API."""
    _require_meta_credentials()

    payload = await request.json()
    url = f"https://graph.facebook.com/{META_GRAPH_VERSION}/{META_PHONE_ID}/messages"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {META_ACCESS_TOKEN}",
            },
        )

    return JSONResponse(content=resp.json(), status_code=resp.status_code)


# ── 3. Create Payment Order (Prepaid) ───────────────────────────────────────

@app.post("/api/create-payment-order")
async def create_payment_order(request: Request):
    """Create a one-time Razorpay order for prepaid access."""
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay credentials not configured.")

    try:
        amount = 60000  # 600 INR in paise
        currency = "INR"
        
        # Create order via direct HTTP request to avoid SDK issues
        order = await _razorpay_request("POST", "orders", {
            "amount": amount,
            "currency": currency,
            "receipt": "receipt_order_123", # Can be dynamic
            "notes": {"type": "prepaid_subscription"}
        })
        
        return JSONResponse(content=order)
    except Exception as exc:
        logger.exception("Razorpay order creation failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/payment-history")
async def get_payment_history(user_id: str = Query(..., alias="userId")):
    """Fetch payment history for a user."""
    db = _supabase_admin()
    
    # Assuming we store payments in 'payments' table or reusing 'message_logs' schema?
    # Let's create a specialized query on a 'payments' table if it exists, 
    # or fallback to 'profiles' usage data if simple.
    # Given the requirements, we likely need a transaction log.
    # We'll use a 'payments' table. If it doesn't exist, we should advise creating it.
    
    try:
        response = db.from_("payments") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()
            
        return JSONResponse(content=response.data)
    except Exception as e:
        logger.warning(f"Failed to fetch payment history: {e}")
        return []

# ── 4. Get Razorpay Public Key ──────────────────────────────────────────────

@app.get("/api/razorpay-key")
async def get_razorpay_key():
    """Return the public Razorpay key ID (safe to expose to browser)."""
    if not RAZORPAY_KEY_ID:
        raise HTTPException(status_code=500, detail="Razorpay Key ID not configured.")
    return {"key": RAZORPAY_KEY_ID}


# ── 5. Verify Payment (Prepaid) ─────────────────────────────────────────────

@app.post("/api/verify-payment")
async def verify_payment(request: Request):
    """
    Verify Razorpay order signature and update prepaid validity.
    Model: Fixed monthly cycle (7th to 7th).
    """
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay Key Secret not configured.")

    body = await request.json()
    
    razorpay_payment_id = body.get("razorpay_payment_id", "")
    razorpay_order_id = body.get("razorpay_order_id", "")
    razorpay_signature = body.get("razorpay_signature", "")
    user_id = body.get("userId", "")

    # HMAC Verification for Orders: order_id + "|" + payment_id
    message = f"{razorpay_order_id}|{razorpay_payment_id}"
    
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature.")

    # Calculate Validity Period
    # Rule: Payment covers "7th of Current Month" to "7th of Next Month"
    # Logic: Extend existing validity or set new anchor.
    
    from datetime import date, timedelta
    today = date.today()
    
    # Simple logic: If paying today, valid until 7th of NEXT month (relative to today or current validity)
    # But strict "7th to 7th" rule:
    # If today is Jan 20, cycle is Jan 7 - Feb 7. Payment covers this.
    # If today is Jan 2, cycle is Jan 7 - Feb 7 (early payment).
    # So target end date is always: "7th of the month AFTER current month" (if start was current month).
    
    # 1. Determine next cycle end from TODAY
    # If today.day < 7: current month is 'target start'. End is next month 7th.
    # If today.day >= 7: current month is 'started'. End is next month 7th.
    # It seems in both cases, the target end is the SAME: 7th of (Month + 1).
    if today.month == 12:
        next_month_year = today.year + 1
        next_month = 1
    else:
        next_month_year = today.year
        next_month = today.month + 1
        
    base_valid_until = date(next_month_year, next_month, 7)

    # 2. Check existing validity to handle renewals
    db = _supabase_admin()
    
    # Fetch current profile
    # Use standard select to avoid 406 Not Acceptable errors if maybe_single behaves oddly
    profile_resp = db.from_("profiles").select("valid_until").eq("id", user_id).execute()
    
    current_validity_str = None

    # If no profile, create it (self-healing)
    if not profile_resp.data:
         logger.warning(f"Profile missing for {user_id} during payment. Creating one.")
         try:
            db.from_("profiles").insert({"id": user_id}).execute()
         except Exception as insert_error:
            logger.error(f"Failed to auto-create profile for {user_id}: {insert_error}")
            # If insert fails, we likely have a race condition or other issue, but we'll proceed as new
    else:
         # Since we didn't use .single(), data is a list
         if len(profile_resp.data) > 0:
            current_validity_str = profile_resp.data[0].get("valid_until")
    
    new_valid_until = base_valid_until

    if current_validity_str:
        try:
            current_valid_until = date.fromisoformat(current_validity_str)
            # If still valid (future date), add 1 month to IT.
            if current_valid_until > today:
                # Add 1 month to current_valid_until
                # simplistic: replace month+1
                y, m, d = current_valid_until.year, current_valid_until.month, current_valid_until.day
                if m == 12:
                    new_valid_until = date(y + 1, 1, d)
                else:
                    new_valid_until = date(y, m + 1, d)
        except ValueError:
            pass # Invalid date format in DB, fallback to base

    # Update DB
    # We set payment_status=True and update valid_until.
    # We do NOT set subscription fields as we are now Prepaid.
    update_data = {
        "payment_status": True,
        "valid_until": new_valid_until.isoformat(),
    }
    
    result = db.from_("profiles").update(update_data).eq("id", user_id).execute()

    if hasattr(result, "error") and result.error:
        logger.error("Supabase update error: %s", result.error)
        raise HTTPException(status_code=500, detail="Failed to update payment status.")

    # Record Payment in History
    try:
        db.from_("payments").insert({
            "user_id": user_id,
            "amount": 600, # Store in rupees
            "currency": "INR",
            "order_id": razorpay_order_id,
            "payment_id": razorpay_payment_id,
            "status": "success",
            "valid_from": today.isoformat(),
            "valid_until": new_valid_until.isoformat()
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to log payment: {e}")

    return {
        "success": True, 
        "message": f"Prepaid access extended until {new_valid_until.isoformat()}.",
        "valid_until": new_valid_until.isoformat()
    }


# ── 6. WhatsApp Webhook (GET = verification, POST = events) ─────────────────

@app.get("/api/webhook")
async def webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification handshake."""
    if hub_mode == "subscribe" and hub_verify_token == META_WEBHOOK_VERIFY_TOKEN:
        logger.info("Webhook verified successfully.")
        return PlainTextResponse(content=hub_challenge)
    raise HTTPException(status_code=403, detail="Forbidden — verify token mismatch.")


@app.post("/api/webhook")
async def webhook_events(request: Request):
    """Handle incoming Meta webhook events (message status updates, etc.)."""
    try:
        body = await request.json()

        if body.get("object") == "whatsapp_business_account":
            for entry in body.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})

                    # Incoming messages
                    for msg in value.get("messages", []):
                        from_number = msg.get("from")
                        msg_type = msg.get("type")
                        
                        # Handle STOP/UNSUBSCRIBE text messages
                        if msg_type == "text":
                            body_text = msg.get("text", {}).get("body", "").upper().strip()
                            if body_text in ["STOP", "UNSUBSCRIBE", "BLOCK"]:
                                logger.info(f"🛑 Received STOP request from {from_number}")
                                # Mark as stopped in DB
                                _supabase_admin().table("contacts") \
                                    .update({"status": "stopped"}) \
                                    .eq("phone_number", from_number) \
                                    .execute()

                        if msg.get("type") == "button":
                            logger.info(
                                "Button clicked: %s from %s",
                                msg["button"]["text"],
                                msg["from"],
                            )

                    # Status updates
                    for status in value.get("statuses", []):
                        logger.info(
                            "Message %s is now %s for %s",
                            status.get("id"),
                            status.get("status"),
                            status.get("recipient_id"),
                        )
                        if status.get("status") == "clicked":
                            logger.info("URL click event detected for message %s", status.get("id"))

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        # Always return 200 to Meta to prevent retries
        return PlainTextResponse(content="OK", status_code=200)

    return PlainTextResponse(content="OK")


# ── 7. Toggle Contact Status (Block/Unblock) ────────────────────────────────

@app.post("/api/contacts/{contact_id}/toggle-status")
async def toggle_contact_status(contact_id: str, request: Request):
    """
    Toggle a contact's status.
    If 'active', switch to provided 'status' (or 'blocked').
    If 'blocked'/'stopped', switch to 'active'.
    """
    body = await request.json()
    current_status = body.get("status", "active")

    # If already stopped or blocked, switch to active
    if current_status in ["blocked", "stopped"]:
        new_status = "active"
    else:
        # Defaults to blocked if current is active
        new_status = "blocked"

    db = _supabase_admin()
    
    # We use Supabase-Py client: .update({}).eq().execute()
    resp = db.table("contacts").update({"status": new_status}).eq("id", contact_id).execute()

    # The Supabase-py `execute()` returns an object with `data` property.
    # If no row was updated, data might be empty list.
    if not resp.data:
         # Suppressing 404 to avoid frontend error noise if desired, 
         # but returning false success could be confusing. 
         # We'll return 200 with success=False.
         return {"success": False, "message": "Contact not found or not updated"}

    return {"success": True, "new_status": new_status, "data": resp.data}


# ── 8. Broadcast Messaging ──────────────────────────────────────────────────

@app.post("/api/broadcast")
async def broadcast_messages(request: Request):
    """
    Broadcast a template message to a list of contacts (paginated).
    Args:
        template_name (str): The name of the template (e.g., 'hello_world').
        template_language (str): Language code (e.g., 'en_US').
        components (list): List of component objects for the template.
        limit (int): Number of contacts to process. Default 500.
        offset (int): Pagination offset. Default 0.
    """
    _require_meta_credentials()
    
    body = await request.json()
    template_name = body.get("template_name")
    template_language = body.get("template_language", "en_US")
    components = body.get("components", [])
    limit = int(body.get("limit", 500))
    offset = int(body.get("offset", 0))

    if not template_name:
        raise HTTPException(status_code=400, detail="Missing template_name.")

    # 1. Fetch contacts from Supabase (paginated, excluding blocked/stopped)
    # Using service-role key to read all contacts regardless of RLS (admin task)
    db = _supabase_admin()
    
    # Range is inclusive in Supabase/Postgrest (e.g. 0-9 returns 10 items)
    range_start = offset
    range_end = offset + limit - 1

    try:
        # Fetch batch
        response = db.from_("contacts") \
            .select("phone_number, name") \
            .not_.in_("status", ["blocked", "stopped"]) \
            .range(range_start, range_end) \
            .execute()
        
        contacts = response.data
    except Exception as e:
        logger.error(f"Error fetching contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    if not contacts:
        return {"processed": 0, "sent": 0, "failed": 0, "contacts": [], "message": "No active contacts found in this range."}

    # 2. Iterate and send messages
    success_count = 0
    failure_count = 0
    results = []

    # Using a shared HTTP client for efficiency
    async with httpx.AsyncClient(timeout=10) as client:
        for contact in contacts:
            phone = contact.get("phone_number")
            if not phone:
                continue

            # Construct payload
            payload = {
                "messaging_product": "whatsapp",
                "to": phone,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": template_language},
                    "components": components
                }
            }

            try:
                # Send to Meta
                url = f"https://graph.facebook.com/{META_GRAPH_VERSION}/{META_PHONE_ID}/messages"
                resp = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {META_ACCESS_TOKEN}",
                    },
                )
                
                resp_data = resp.json()
                
                # Check for success
                if resp.status_code in (200, 201):
                    msg_id = resp_data.get("messages", [{}])[0].get("id", "unknown")
                    success_count += 1
                    status = "sent"
                else:
                    msg_id = "error"
                    failure_count += 1
                    status = "failed"
                    logger.error(f"Failed to send to {phone}: {resp.text}")

                # Log to DB (fire and forget / async)
                # Ideally, batch insert logs, but simple loop for now
                try:
                    db.from_("message_logs").insert({
                        "message_id": msg_id,
                        "contact_phone": phone,
                        "template_name": template_name,
                        "status": status
                    }).execute()
                except Exception as db_err:
                    logger.warning(f"Failed to log message for {phone}: {db_err}")

                results.append({"phone": phone, "status": status, "id": msg_id})
                
            except Exception as e:
                logger.error(f"Exception sending to {phone}: {e}")
                failure_count += 1
                results.append({"phone": phone, "status": "error", "error": str(e)})

    return {
        "processed": len(contacts),
        "sent": success_count,
        "failed": failure_count,
        "offset_next": offset + limit,
        "has_more": len(contacts) == limit
    }
