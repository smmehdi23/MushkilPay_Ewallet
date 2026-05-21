import hashlib
import os
import random
import base64
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional

import jwt
import oracledb
from dotenv import load_dotenv
from fastapi import Body, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape

load_dotenv()

# 1. App Setup
app = FastAPI(title="Digital Wallet API", version="1.0")
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super_secret_bank_key_2026")
_cors = os.getenv("CORS_ORIGINS", "*")
ALLOW_ORIGINS = ["*"] if _cors.strip() == "*" else [o.strip() for o in _cors.split(",") if o.strip()]

DB_CONFIG = {
    "user": os.getenv("ORACLE_USER", "system"),
    "password": os.getenv("ORACLE_PASSWORD", "Aayan@1708"),
    "dsn": os.getenv("ORACLE_DSN", "localhost:1521/xe"),
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Database Helper 
def get_connection():
    """Provides a reusable database connection."""
    return oracledb.connect(**DB_CONFIG)

def _hash_value(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def _hash_password(password: str) -> str:
    """Hash password/PIN using PBKDF2-SHA256 with per-value random salt."""
    if not isinstance(password, str) or password == "":
        raise ValueError("Password/PIN must be a non-empty string.")
    iterations = 260000
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.b64encode(salt).decode("utf-8"),
        base64.b64encode(digest).decode("utf-8"),
    )

def _verify_password(plain: str, hashed: str) -> bool:
    """Verify PBKDF2-SHA256 hashed password/PIN string."""
    if not isinstance(plain, str) or not isinstance(hashed, str):
        return False
    try:
        algo, iterations_raw, salt_b64, digest_b64 = hashed.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        salt = base64.b64decode(salt_b64.encode("utf-8"))
        expected_digest = base64.b64decode(digest_b64.encode("utf-8"))
        calculated_digest = hashlib.pbkdf2_hmac(
            "sha256",
            plain.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(calculated_digest, expected_digest)
    except Exception:
        return False

def _verify_password_with_legacy_support(plain: str, hashed: str) -> tuple[bool, bool]:
    """
    Returns (is_valid, should_rehash_to_pbkdf2).
    Supports current PBKDF2 hashes and legacy bcrypt hashes for automatic migration.
    """
    if not isinstance(plain, str) or not isinstance(hashed, str):
        return False, False

    if hashed.startswith("pbkdf2_sha256$"):
        return _verify_password(plain, hashed), False

    if hashed.startswith("$2a$") or hashed.startswith("$2b$") or hashed.startswith("$2y$"):
        try:
            import bcrypt as _legacy_bcrypt
            ok = _legacy_bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
            return ok, ok
        except Exception:
            return False, False

    return False, False

def _resolve_token(token: Optional[str], authorization: Optional[str]) -> str:
    if token:
        return token
    if authorization:
        if authorization.lower().startswith("bearer "):
            return authorization[7:]
        return authorization
    raise HTTPException(status_code=401, detail="Missing authentication token")

def _table_exists(cursor, table_name: str) -> bool:
    cursor.execute(
        "SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME = :1",
        [table_name.upper()],
    )
    return cursor.fetchone()[0] > 0

def _column_exists(cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM USER_TAB_COLUMNS
        WHERE TABLE_NAME = :1 AND COLUMN_NAME = :2
        """,
        [table_name.upper(), column_name.upper()],
    )
    return cursor.fetchone()[0] > 0

WALLETS_HAS_ACCOUNT_NUMBER: Optional[bool] = None

def _wallet_has_account_number(cursor) -> bool:
    global WALLETS_HAS_ACCOUNT_NUMBER
    if WALLETS_HAS_ACCOUNT_NUMBER is None:
        WALLETS_HAS_ACCOUNT_NUMBER = _column_exists(cursor, "WALLETS", "ACCOUNT_NUMBER")
    return WALLETS_HAS_ACCOUNT_NUMBER

def _get_wallet_id(cursor, user_id: int) -> Optional[int]:
    cursor.execute("SELECT WALLET_ID FROM WALLETS WHERE USER_ID = :1", [user_id])
    row = cursor.fetchone()
    return row[0] if row else None

def _get_wallet_by_account(cursor, account_number: str):
    if _wallet_has_account_number(cursor):
        cursor.execute(
            """
            SELECT W.WALLET_ID, W.USER_ID, U.FULL_NAME, U.EMAIL, U.PHONE
            FROM WALLETS W
            JOIN USERS U ON U.USER_ID = W.USER_ID
            WHERE W.ACCOUNT_NUMBER = :1
            """,
            [account_number],
        )
        row = cursor.fetchone()
        if row:
            return row

    if account_number.isdigit():
        cursor.execute(
            """
            SELECT W.WALLET_ID, W.USER_ID, U.FULL_NAME, U.EMAIL, U.PHONE
            FROM WALLETS W
            JOIN USERS U ON U.USER_ID = W.USER_ID
            WHERE W.WALLET_ID = :1
            """,
            [int(account_number)],
        )
        row = cursor.fetchone()
        if row:
            return row

    return None

def _create_notification(cursor, user_id: int, title: str, message: str):
    if not _table_exists(cursor, "NOTIFICATIONS"):
        return
    cursor.execute(
        """
        INSERT INTO NOTIFICATIONS (USER_ID, TITLE, MESSAGE)
        VALUES (:1, :2, :3)
        """,
        [user_id, title, message],
    )

def _ensure_support_tables():
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if not _table_exists(cursor, "NOTIFICATIONS"):
            cursor.execute(
                """
                CREATE TABLE NOTIFICATIONS (
                    NOTIF_ID NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY,
                    USER_ID NUMBER NOT NULL,
                    TITLE VARCHAR2(80),
                    MESSAGE VARCHAR2(400),
                    CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP,
                    IS_READ NUMBER(1) DEFAULT 0
                )
                """
            )

        if not _table_exists(cursor, "CARD_REQUESTS"):
            cursor.execute(
                """
                CREATE TABLE CARD_REQUESTS (
                    REQUEST_ID NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY,
                    USER_ID NUMBER NOT NULL,
                    REQUEST_TYPE VARCHAR2(20),
                    REASON VARCHAR2(50),
                    DELIVERY_ADDRESS VARCHAR2(300),
                    STATUS VARCHAR2(20) DEFAULT 'PENDING',
                    CHARGE_AMOUNT NUMBER(12,2) DEFAULT 0,
                    CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
                )
                """
            )

        if not _table_exists(cursor, "CARD_PINS"):
            cursor.execute(
                """
                CREATE TABLE CARD_PINS (
                    CARD_ID NUMBER PRIMARY KEY,
                    PIN_HASH VARCHAR2(200),
                    UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
                )
                """
            )

        if not _table_exists(cursor, "WITHDRAWAL_LIMITS"):
            cursor.execute(
                """
                CREATE TABLE WITHDRAWAL_LIMITS (
                    USER_ID NUMBER PRIMARY KEY,
                    LIMIT_AMOUNT NUMBER(12,2),
                    UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
                )
                """
            )

        if not _table_exists(cursor, "TOPUP_REQUESTS"):
            cursor.execute(
                """
                CREATE TABLE TOPUP_REQUESTS (
                    TOPUP_ID NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY,
                    ADMIN_USERNAME VARCHAR2(80),
                    USER_ID NUMBER NOT NULL,
                    ACCOUNT_NUMBER VARCHAR2(30),
                    AMOUNT NUMBER(12,2) NOT NULL,
                    METHOD VARCHAR2(20),
                    REFERENCE VARCHAR2(120),
                    STATUS VARCHAR2(20) DEFAULT 'COMPLETED',
                    CREATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
                )
                """
            )

        if not _table_exists(cursor, "TRANSACTIONS"):
            cursor.execute(
                """
                CREATE TABLE TRANSACTIONS (
                    TRANSACTION_ID NUMBER GENERATED BY DEFAULT ON NULL AS IDENTITY,
                    WALLET_ID NUMBER NOT NULL,
                    TRANSACTION_TYPE VARCHAR2(30),
                    AMOUNT NUMBER(12,2),
                    TRANSACTION_DATE TIMESTAMP DEFAULT SYSTIMESTAMP,
                    STATUS VARCHAR2(20),
                    REFERENCE_ID VARCHAR2(120)
                )
                """
            )

        if not _table_exists(cursor, "ADMIN_SETTINGS"):
            cursor.execute(
                """
                CREATE TABLE ADMIN_SETTINGS (
                    ADMIN_ID NUMBER PRIMARY KEY,
                    SESSION_TIMEOUT NUMBER DEFAULT 3600,
                    TWO_FA_ENABLED NUMBER(1) DEFAULT 0,
                    NOTIFICATION_EMAILS NUMBER(1) DEFAULT 1,
                    MAX_TOPUP_PER_TRANSACTION NUMBER(12,2) DEFAULT 1000000,
                    MAX_TOPUP_PER_DAY NUMBER(12,2) DEFAULT 10000000,
                    WITHDRAWAL_LIMIT NUMBER(12,2) DEFAULT 500000,
                    AUDIT_LOGS_RETENTION_DAYS NUMBER DEFAULT 90,
                    UPDATED_AT TIMESTAMP DEFAULT SYSTIMESTAMP
                )
                """
            )

        if _table_exists(cursor, "ADMINS") and _table_exists(cursor, "ADMIN_SETTINGS"):
            cursor.execute(
                """
                INSERT INTO ADMIN_SETTINGS (ADMIN_ID)
                SELECT A.ADMIN_ID
                FROM ADMINS A
                WHERE NOT EXISTS (
                    SELECT 1 FROM ADMIN_SETTINGS S WHERE S.ADMIN_ID = A.ADMIN_ID
                )
                """
            )

        conn.commit()
    except Exception as exc:
        conn.rollback()
        print("DB bootstrap failed:", exc)
    finally:
        cursor.close()
        conn.close()

@app.on_event("startup")
def _startup_bootstrap():
    try:
        _ensure_support_tables()
    except Exception as e:
        print(f"⚠️  Warning: Failed to ensure support tables (database may be unavailable): {str(e)}")
        print("ℹ️  Server will continue with fallback mode for development")

# 3. Auth Helpers 
def verify_user_token(token: str) -> dict:
    """Verifies customer wallet JWT; must include user_id and role 'customer'."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or Expired User Token")
    if payload.get("role") != "customer":
        raise HTTPException(status_code=403, detail="Customer access required")
    if "user_id" not in payload:
        raise HTTPException(status_code=403, detail="User identity missing in token")
    return payload

def verify_admin_token(token: str) -> dict:
    """Verifies Admin JWT token; ensures role is 'admin'."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or Expired Admin Token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload

# 4. Public Routes (Authentication)
@app.post("/user/signup", tags=["Public"])
def user_signup(data: dict = Body(...)):
    # 1. Validation
    required = ["full_name", "email", "password", "phone", "pin"]
    missing = [f for f in required if f not in data or not data[f]]
    if missing:
        return {"status": "Error", "message": f"Missing: {', '.join(missing)}"}

    import random
    card_no = "".join([str(random.randint(0, 9)) for _ in range(16)])
    cvv = "".join([str(random.randint(0, 9)) for _ in range(3)])

    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        hashed_password = _hash_password(data["password"])
        hashed_pin = _hash_password(data["pin"])

        # 2. Start Transaction: Insert into USERS
        cursor.execute("""
            INSERT INTO USERS (FULL_NAME, EMAIL, PHONE, PASSWORD_HASH, CNIC) 
            VALUES (:1, :2, :3, :4, :5)
        """, [data["full_name"], data["email"], data["phone"], hashed_password, data.get("cnic", "")])
        
        # 3. Get the next account number
        cursor.execute("""
            SELECT NVL(MAX(CAST(ACCOUNT_NUMBER AS NUMBER)), 1000000) FROM WALLETS 
            WHERE ACCOUNT_NUMBER IS NOT NULL
        """)
        max_account = cursor.fetchone()[0]
        next_account_number = str(int(max_account) + 1)
        
        # 4. Insert into WALLETS with hashed PIN
        cursor.execute("""
            INSERT INTO WALLETS (USER_ID, ACCOUNT_NUMBER, BALANCE, WALLET_STATUS, WALLET_PIN) 
            VALUES ((SELECT USER_ID FROM USERS WHERE EMAIL = :1), :2, 0.00, 'ACTIVE', :3)
        """, [data["email"], next_account_number, hashed_pin])
        
        # 5. Automatically issue a default DEBIT card
        cursor.execute("""
            INSERT INTO CARDS (USER_ID, CARD_NUMBER, CVV, EXPIRY_DATE, CARD_STATUS, CARD_TYPE)
            VALUES ((SELECT USER_ID FROM USERS WHERE EMAIL = :1), :2, :3, ADD_MONTHS(SYSDATE, 60), 'ACTIVE', 'DEBIT')
        """, [data["email"], card_no, cvv])
        
        conn.commit()
        return {"status": "Success", "message": "Account & Wallet created successfully!"}

    except Exception as e:
        conn.rollback()
        err_msg = str(e)
        if "ORA-00001" in err_msg:
            return {"status": "Error", "message": "Email or Phone already registered."}
        return {"status": "Database Error", "message": err_msg}
    
    finally:
        cursor.close()
        conn.close()               
    
@app.post("/user/login", tags=["Public"])
def user_login(data: dict = Body(...)):
    """Authenticates user using PBKDF2 verification."""
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT USER_ID, FULL_NAME, PASSWORD_HASH FROM USERS WHERE EMAIL = :1", 
                       [data["email"]])
        user = cursor.fetchone()
        if user:
            is_valid, should_rehash = _verify_password_with_legacy_support(data["password"], user[2])
            if is_valid:
                if should_rehash:
                    cursor.execute(
                        "UPDATE USERS SET PASSWORD_HASH = :1 WHERE USER_ID = :2",
                        [_hash_password(data["password"]), user[0]],
                    )
                    conn.commit()
                token = jwt.encode({
                    "user_id": user[0], 
                    "email": data["email"],
                    "role": "customer",
                    "exp": datetime.utcnow() + timedelta(days=1)
                }, SECRET_KEY, algorithm="HS256")
                return {"status": "Success", "token": token, "user_id": user[0]}
        return {"status": "Error", "message": "Invalid Credentials"}
    except Exception as e:
        return {"status": "Error", "detail": str(e)}
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

@app.post("/admin/login", tags=["Public"])
def admin_login(data: dict = Body(...)):
    """Authenticates admin using PBKDF2 verification."""
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT ADMIN_ID, ROLE, PASSWORD_HASH FROM ADMINS WHERE USERNAME = :1", 
                       [data["username"]])
        admin = cursor.fetchone()
        if admin:
            is_valid, should_rehash = _verify_password_with_legacy_support(data["password"], admin[2])
            if is_valid:
                if should_rehash:
                    cursor.execute(
                        "UPDATE ADMINS SET PASSWORD_HASH = :1 WHERE USERNAME = :2",
                        [_hash_password(data["password"]), data["username"]],
                    )
                    conn.commit()
                token = jwt.encode({
                    "sub": data["username"], 
                    "role": "admin",
                    "exp": datetime.utcnow() + timedelta(hours=1)
                }, SECRET_KEY, algorithm="HS256")
                return {"status": "Success", "token": token, "role": admin[1]}
        return {"status": "Error", "message": "Invalid Credentials"}
    except Exception as e:
        return {"status": "Error", "detail": str(e)}
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

@app.post("/transfer", tags=["User"])
def transfer_money(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Performs a balance transfer with PIN verification and withdrawal limit check."""
    user_data = verify_user_token(_resolve_token(token, authorization))
    conn = None
    cursor = None
    receiver_account = str(data.get("receiver_account") or data.get("receiver_id") or "").strip()
    raw_amount = data.get("amount")
    pin = data.get("pin")

    if not receiver_account or raw_amount in (None, "") or not pin:
        return {"status": "Error", "message": "Missing receiver account, amount, or pin."}
    try:
        amount = float(raw_amount)
    except (TypeError, ValueError):
        return {"status": "Error", "message": "Amount must be a valid number."}
    if amount <= 0:
        return {"status": "Error", "message": "Amount must be greater than zero."}

    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 1. Verify Sender Wallet and PIN
        cursor.execute("SELECT WALLET_ID, WALLET_PIN, BALANCE FROM WALLETS WHERE USER_ID = :1", [user_data["user_id"]])
        sender_row = cursor.fetchone()
        if not sender_row:
            return {"status": "Error", "message": "Sender wallet not found."}
        
        sender_wallet_id, hashed_pin, balance = sender_row
        pin_ok, should_rehash_pin = _verify_password_with_legacy_support(pin, hashed_pin)
        if not pin_ok:
            return {"status": "Error", "message": "Security Error: Invalid PIN."}
        if should_rehash_pin:
            cursor.execute(
                "UPDATE WALLETS SET WALLET_PIN = :1 WHERE WALLET_ID = :2",
                [_hash_password(pin), sender_wallet_id],
            )

        # 2. Check Daily Withdrawal Limit
        cursor.execute("SELECT LIMIT_AMOUNT FROM WITHDRAWAL_LIMITS WHERE USER_ID = :1", [user_data["user_id"]])
        limit_row = cursor.fetchone()
        if limit_row and limit_row[0] is not None:
            daily_limit = float(limit_row[0])
            # Calculate total transfers today
            cursor.execute("""
                SELECT SUM(AMOUNT) FROM TRANSFERS 
                WHERE SENDER_WALLET_ID = :1 
                AND TRUNC(TRANSFER_DATE) = TRUNC(SYSDATE)
                AND STATUS = 'COMPLETED'
            """, [sender_wallet_id])
            today_total = cursor.fetchone()[0] or 0
            if today_total + amount > daily_limit:
                return {"status": "Error", "message": f"Daily transfer limit exceeded. Remaining: {daily_limit - today_total}"}

        # 3. Find Receiver
        receiver_row = _get_wallet_by_account(cursor, receiver_account)
        if not receiver_row:
            return {"status": "Error", "message": "Receiver account not found."}

        receiver_wallet_id = receiver_row[0]
        if receiver_wallet_id == sender_wallet_id:
            return {"status": "Error", "message": "Self transfers are not allowed."}
        
        # 4. Perform Transfer (Trigger handles balance update, but PIN is verified here)
        cursor.execute(
            """
            INSERT INTO TRANSFERS (SENDER_WALLET_ID, RECEIVER_WALLET_ID, AMOUNT, PIN)
            VALUES (:1, :2, :3, :4)
            """,
            [sender_wallet_id, receiver_wallet_id, amount, "VERIFIED_BY_API"],
        )

        cursor.execute(
            """
            SELECT TRANSFER_ID, TRANSFER_DATE, STATUS
            FROM TRANSFERS
            WHERE SENDER_WALLET_ID = :1 AND RECEIVER_WALLET_ID = :2 AND AMOUNT = :3
            ORDER BY TRANSFER_DATE DESC
            FETCH FIRST 1 ROWS ONLY
            """,
            [sender_wallet_id, receiver_wallet_id, amount],
        )
        receipt = cursor.fetchone()

        _create_notification(cursor, user_data["user_id"], "Transfer Sent", f"Sent PKR {amount} to {receiver_row[2]}")
        _create_notification(cursor, receiver_row[1], "Transfer Received", f"Received PKR {amount} from {user_data.get('email', 'wallet user')}")

        conn.commit()
        return {
            "status": "Success",
            "message": "Transfer completed!",
            "receipt": {
                "transfer_id": receipt[0] if receipt else None,
                "transfer_date": receipt[1].isoformat() if receipt and receipt[1] else None,
                "status": receipt[2] if receipt else "Processed",
                "amount": amount,
                "receiver_name": receiver_row[2],
            },
        }
    except oracledb.DatabaseError as e:
        return {"status": "Error", "message": str(e.args[0])}
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.post("/user/charity/donate", tags=["User"])
def charity_donate(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Processes charity donations from user wallet."""
    user_data = verify_user_token(_resolve_token(token, authorization))
    conn = None
    cursor = None
    trust_name = data.get("trust_name")
    raw_amount = data.get("amount")
    pin = data.get("pin")

    if not trust_name or raw_amount in (None, "") or not pin:
        return {"status": "Error", "message": "Trust name, amount, and PIN are required."}
    try:
        amount = float(raw_amount)
    except (TypeError, ValueError):
        return {"status": "Error", "message": "Amount must be a valid number."}
    if amount <= 0:
        return {"status": "Error", "message": "Amount must be greater than zero."}

    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT WALLET_ID, WALLET_PIN, BALANCE FROM WALLETS WHERE USER_ID = :1", [user_data["user_id"]])
        sender = cursor.fetchone()
        if not sender: return {"status": "Error", "message": "Wallet not found."}
        
        pin_ok, should_rehash_pin = _verify_password_with_legacy_support(pin, sender[1])
        if not pin_ok:
            return {"status": "Error", "message": "Invalid PIN."}
        if should_rehash_pin:
            cursor.execute(
                "UPDATE WALLETS SET WALLET_PIN = :1 WHERE WALLET_ID = :2",
                [_hash_password(pin), sender[0]],
            )
        
        if float(sender[2]) < amount:
            return {"status": "Error", "message": "Insufficient balance."}

        # Deduct balance
        cursor.execute("UPDATE WALLETS SET BALANCE = BALANCE - :1 WHERE WALLET_ID = :2", [amount, sender[0]])

        # Record into TRANSACTIONS table for history
        if _table_exists(cursor, "TRANSACTIONS"):
            cursor.execute(
                """
                INSERT INTO TRANSACTIONS (WALLET_ID, TRANSACTION_TYPE, AMOUNT, STATUS, REFERENCE_ID)
                VALUES (:1, :2, :3, :4, :5)
                """,
                [sender[0], "WITHDRAWAL", amount, "COMPLETED", f"Charity: {trust_name}"]
            )

        # Record as a 'special' transfer or a notification for now
        _create_notification(cursor, user_data["user_id"], "Charity Donation", f"Donated PKR {amount} to {trust_name}")        
        conn.commit()
        return {"status": "Success", "message": f"Donation of PKR {amount} to {trust_name} successful!"}
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# 6. View-Based Routes (Read-Only)
def _fetch_user_view(view_name: str, user_id: int):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {view_name} WHERE USER_ID = :1", [user_id])
        cols = [c[0] for c in cursor.description]
        return [dict(zip(cols, r)) for r in cursor.fetchall()]
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.get("/user/views/transaction-history", tags=["User Views"])
def view_history(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Retrieves transaction history using database view."""
    user_id = verify_user_token(_resolve_token(token, authorization))["user_id"]
    return {"data": _fetch_user_view("USER_TRANSFER_HISTORY", user_id)}

@app.get("/user/views/wallet", tags=["User Views"])
def view_wallet(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Retrieves wallet details using database view."""
    user_id = verify_user_token(_resolve_token(token, authorization))["user_id"]
    return {"data": _fetch_user_view("USER_WALLET_VIEW", user_id)}

@app.patch("/admin/update-status/{wallet_id}", tags=["Admin"])
def update_wallet_status(
    wallet_id: int,
    new_status: str,
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Updates wallet status (ACTIVE/SUSPENDED)."""
    verify_admin_token(_resolve_token(token, authorization))
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE WALLETS SET WALLET_STATUS = :1 WHERE WALLET_ID = :2",
            [new_status.upper(), wallet_id],
        )
        conn.commit()
        return {"message": "Status updated successfully"}
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/user/download-statement", tags=["User"])
def generate_statement(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    user_id = user_data["user_id"]

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT FULL_NAME, EMAIL, PHONE, CREATED_AT FROM USERS WHERE USER_ID = :1",
            [user_id],
        )
        user_row = cursor.fetchone() or (None, None, None, None)
        full_name, email, phone, created_at = user_row

        cursor.execute(
            "SELECT WALLET_ID, ACCOUNT_NUMBER, BALANCE, WALLET_STATUS FROM WALLETS WHERE USER_ID = :1",
            [user_id],
        )
        wallet_row = cursor.fetchone() or (None, None, 0, None)
        wallet_id, account_number, current_balance, wallet_status = wallet_row
        if not account_number and wallet_id:
            account_number = str(wallet_id)

        txns = []
        if wallet_id:
            cursor.execute(
                """
                SELECT
                    T.TRANSFER_ID,
                    T.TRANSFER_DATE,
                    T.AMOUNT,
                    T.STATUS,
                    T.SENDER_WALLET_ID,
                    T.RECEIVER_WALLET_ID,
                    SU.FULL_NAME AS SENDER_NAME,
                    RU.FULL_NAME AS RECEIVER_NAME
                FROM TRANSFERS T
                LEFT JOIN WALLETS SW ON SW.WALLET_ID = T.SENDER_WALLET_ID
                LEFT JOIN USERS SU ON SU.USER_ID = SW.USER_ID
                LEFT JOIN WALLETS RW ON RW.WALLET_ID = T.RECEIVER_WALLET_ID
                LEFT JOIN USERS RU ON RU.USER_ID = RW.USER_ID
                WHERE T.SENDER_WALLET_ID = :1 OR T.RECEIVER_WALLET_ID = :2
                ORDER BY T.TRANSFER_DATE DESC
                """,
                [wallet_id, wallet_id],
            )
            for row in cursor.fetchall():
                is_sender = row[4] == wallet_id
                amount = float(row[2] or 0)
                status = row[3] or "COMPLETED"
                counterpart_name = row[7] if is_sender else row[6]
                counterpart_wallet = row[5] if is_sender else row[4]
                direction = "debit" if is_sender else "credit"
                description = (
                    f"Transfer to {counterpart_name or 'Wallet'} (Wallet #{counterpart_wallet})"
                    if is_sender
                    else f"Transfer from {counterpart_name or 'Wallet'} (Wallet #{counterpart_wallet})"
                )
                description = f"{description} [{status}]"
                txns.append(
                    {
                        "date": row[1],
                        "type": "Transfer",
                        "description": description,
                        "debit": amount if direction == "debit" else 0,
                        "credit": amount if direction == "credit" else 0,
                    }
                )

        if _table_exists(cursor, "TOPUP_REQUESTS"):
            cursor.execute(
                """
                SELECT TOPUP_ID, CREATED_AT, AMOUNT, METHOD, REFERENCE, STATUS
                FROM TOPUP_REQUESTS
                WHERE USER_ID = :1
                ORDER BY CREATED_AT DESC
                """,
                [user_id],
            )
            for row in cursor.fetchall():
                amount = float(row[2] or 0)
                method = row[3] or "CASH"
                reference = row[4] or ""
                status = row[5] or "COMPLETED"
                description = f"Top up via {method}"
                if reference:
                    description = f"{description} ({reference})"
                description = f"{description} [{status}]"
                txns.append(
                    {
                        "date": row[1],
                        "type": "Top Up",
                        "description": description,
                        "debit": 0,
                        "credit": amount,
                    }
                )

        if _table_exists(cursor, "TRANSACTIONS") and wallet_id:
            cursor.execute(
                """
                SELECT TRANSACTION_ID, TRANSACTION_DATE, AMOUNT, TRANSACTION_TYPE, REFERENCE_ID, STATUS
                FROM TRANSACTIONS
                WHERE WALLET_ID = :1
                ORDER BY TRANSACTION_DATE DESC
                """,
                [wallet_id],
            )
            for row in cursor.fetchall():
                amount = float(row[2] or 0)
                txn_type = row[3] or "TRANSACTION"
                reference = row[4] or ""
                status = row[5] or "COMPLETED"
                label = "Charity Donation" if "Charity" in reference else txn_type.title()
                direction = "debit" if txn_type in ("WITHDRAWAL", "TRANSFER") else "credit"
                description = reference or label
                description = f"{description} [{status}]"
                txns.append(
                    {
                        "date": row[1],
                        "type": label,
                        "description": description,
                        "debit": amount if direction == "debit" else 0,
                        "credit": amount if direction == "credit" else 0,
                    }
                )

        if _table_exists(cursor, "CARD_REQUESTS"):
            cursor.execute(
                """
                SELECT REQUEST_ID, CREATED_AT, CHARGE_AMOUNT, REQUEST_TYPE
                FROM CARD_REQUESTS
                WHERE USER_ID = :1 AND CHARGE_AMOUNT > 0
                ORDER BY CREATED_AT DESC
                """,
                [user_id],
            )
            for row in cursor.fetchall():
                amount = float(row[2] or 0)
                request_type = row[3] or "CARD"
                description = f"Card fee ({request_type}) [COMPLETED]"
                txns.append(
                    {
                        "date": row[1],
                        "type": "Card Fee",
                        "description": description,
                        "debit": amount,
                        "credit": 0,
                    }
                )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    def fmt_currency(value: float) -> str:
        return f"PKR {value:,.2f}"

    def fmt_date(value: Optional[datetime]) -> str:
        return value.strftime("%Y-%m-%d %H:%M") if value else "-"

    now = datetime.utcnow()
    sorted_txns = sorted(txns, key=lambda t: t.get("date") or datetime.min, reverse=True)
    period_start = min((t.get("date") for t in txns if t.get("date")), default=created_at or now)
    period_end = max((t.get("date") for t in txns if t.get("date")), default=now)

    total_credits = sum(t["credit"] for t in txns)
    total_debits = sum(t["debit"] for t in txns)
    closing_balance = float(current_balance or 0)
    opening_balance = closing_balance - total_credits + total_debits

    # 2. Setup PDF structure
    file_path = f"statement_{user_id}.pdf"
    doc = SimpleDocTemplate(
        file_path,
        pagesize=landscape(letter),
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    elements = []
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle(
        "BodySmall",
        parent=styles["BodyText"],
        fontSize=6.5,
        leading=8,
        alignment=TA_LEFT,
        wordWrap="CJK",
        splitLongWords=1,
    )
    numeric_style = ParagraphStyle(
        "BodyNumeric",
        parent=body_style,
        alignment=TA_RIGHT,
    )
    header_style = ParagraphStyle(
        "HeaderSmall",
        parent=body_style,
        fontName="Helvetica-Bold",
        textColor=colors.whitesmoke,
    )

    statement_id = f"ST-{user_id}-{now.strftime('%Y%m%d%H%M%S')}"
    elements.append(Paragraph("MushkilPay Account Statement", styles["Title"]))
    elements.append(Paragraph(f"Statement ID: {statement_id}", styles["Normal"]))
    elements.append(
        Paragraph(
            f"Statement Period: {fmt_date(period_start)} to {fmt_date(period_end)}",
            styles["Normal"],
        )
    )
    elements.append(Paragraph(f"Generated: {fmt_date(now)} UTC", styles["Normal"]))
    elements.append(Spacer(1, 12))

    account_data = [
        ["Account Holder", full_name or "N/A"],
        ["Account Number", account_number or "N/A"],
        ["Wallet ID", str(wallet_id) if wallet_id else "N/A"],
        ["Email", email or "N/A"],
        ["Phone", phone or "N/A"],
        ["Wallet Status", wallet_status or "N/A"],
    ]
    account_table = Table(account_data, colWidths=[140, 320])
    account_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.black),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    elements.append(account_table)
    elements.append(Spacer(1, 12))

    summary_data = [
        ["Opening Balance", fmt_currency(opening_balance)],
        ["Total Credits", fmt_currency(total_credits)],
        ["Total Debits", fmt_currency(total_debits)],
        ["Closing Balance", fmt_currency(closing_balance)],
    ]
    summary_table = Table(summary_data, colWidths=[140, 160])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
            ]
        )
    )
    elements.append(summary_table)
    elements.append(Spacer(1, 14))

    tx_table_data = [[
        Paragraph("Date", header_style),
        Paragraph("Type", header_style),
        Paragraph("Description", header_style),
        Paragraph("Debit", header_style),
        Paragraph("Credit", header_style),
        Paragraph("Balance", header_style),
    ]]

    running_balance = closing_balance
    if sorted_txns:
        for txn in sorted_txns:
            debit = txn["debit"]
            credit = txn["credit"]
            tx_table_data.append(
                [
                    Paragraph(escape(fmt_date(txn["date"])), body_style),
                    Paragraph(escape(str(txn["type"])), body_style),
                    Paragraph(escape(str(txn["description"])), body_style),
                    Paragraph(fmt_currency(debit) if debit else "-", numeric_style),
                    Paragraph(fmt_currency(credit) if credit else "-", numeric_style),
                    Paragraph(fmt_currency(running_balance), numeric_style),
                ]
            )
            if credit:
                running_balance -= credit
            if debit:
                running_balance += debit
    else:
        tx_table_data.append(
            [
                Paragraph("-", body_style),
                Paragraph("-", body_style),
                Paragraph("No transactions for this period", body_style),
                Paragraph("-", numeric_style),
                Paragraph("-", numeric_style),
                Paragraph(fmt_currency(opening_balance), numeric_style),
            ]
        )

    table_width = doc.width
    base_widths = [92, 72, 330, 80, 80, 80]
    width_scale = table_width / sum(base_widths)
    col_widths = [w * width_scale for w in base_widths]
    tx_table = Table(tx_table_data, repeatRows=1, colWidths=col_widths)
    tx_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.darkgrey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 7),
                ("FONTSIZE", (0, 1), (-1, -1), 6.5),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(tx_table)
    elements.append(Spacer(1, 10))
    elements.append(
        Paragraph(
            "This is a system-generated statement. For queries, contact MushkilPay support.",
            styles["Normal"],
        )
    )

    doc.build(elements)

    return FileResponse(file_path, media_type="application/pdf", filename="MushkilPay_Statement.pdf")


@app.post("/user/issue-card", tags=["Cards"])
def issue_card(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Issue a new card to user with card type support"""
    user_data = verify_user_token(_resolve_token(token, authorization))
    user_id = user_data["user_id"]
    card_type = (data.get("card_type") or "DEBIT").upper()
    
    if card_type not in {"DEBIT", "CREDIT", "VIRTUAL"}:
        return {"status": "Error", "message": "Card type must be DEBIT, CREDIT, or VIRTUAL"}
    
    card_no = "".join([str(random.randint(0, 9)) for _ in range(16)])
    cvv = "".join([str(random.randint(0, 9)) for _ in range(3)])
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Check if card of same type already exists
        cursor.execute(
            "SELECT COUNT(*) FROM CARDS WHERE USER_ID = :1 AND CARD_TYPE = :2",
            (user_id, card_type),
        )
        if cursor.fetchone()[0] > 0:
            return {"status": "Error", "message": f"{card_type} card already issued to this user."}

        # Insert card with CARD_TYPE
        cursor.execute(
            """\n            INSERT INTO CARDS (USER_ID, CARD_NUMBER, CVV, EXPIRY_DATE, CARD_STATUS, CARD_TYPE)\n            VALUES (:1, :2, :3, ADD_MONTHS(SYSDATE, 60), 'ACTIVE', :4)\n        """, [user_id, card_no, cvv, card_type])

        conn.commit()
        return {
            "status": "Success", 
            "message": f"New {card_type} Card Issued!",
            "details": {
                "card_number": card_no,
                "card_type": card_type,
                "cvv": cvv,
                "expiry": "5 Years from now"
            }
        }

    except Exception as e:
        if conn: 
            try:
                conn.rollback()
            except Exception:
                pass
        return {"status": "Database Error", "message": str(e)}
    finally:
        if conn:
            try:
                cursor.close()
                conn.close()
            except Exception:
                pass

def _mask_card_number(card_number: Optional[str]) -> str:
    if not card_number:
        return ""
    card_number = card_number.replace(" ", "")
    if len(card_number) < 8:
        return card_number
    return f"{card_number[:4]} **** **** {card_number[-4:]}"

@app.get("/user/lookup", tags=["User"])
def lookup_account(
    account_number: str,
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Looks up a wallet by account number. Required for the transfer flow."""
    verify_user_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        row = _get_wallet_by_account(cursor, account_number.strip())
        if not row:
            return {"status": "Error", "message": "Account not found."}
        return {
            "status": "Success",
            "data": {
                "wallet_id": row[0],
                "user_id": row[1],
                "full_name": row[2],
                "email": row[3],
                "phone": row[4],
            },
        }
    finally:
        cursor.close()
        conn.close()

@app.get("/user/profile", tags=["User"])
def get_profile(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        user_fields = ["FULL_NAME", "PHONE", "EMAIL"]
        if _column_exists(cursor, "USERS", "CNIC"):
            user_fields.append("CNIC")
        if _column_exists(cursor, "USERS", "CREATED_AT"):
            user_fields.append("CREATED_AT")

        cursor.execute(
            f"SELECT {', '.join(user_fields)} FROM USERS WHERE USER_ID = :1",
            [user_data["user_id"]],
        )
        user_row = cursor.fetchone()
        user_cols = [col[0].lower() for col in cursor.description] if cursor.description else []
        user_map = dict(zip(user_cols, user_row)) if user_row else {}

        cursor.execute(
            """
            SELECT WALLET_ID, BALANCE, WALLET_STATUS
            FROM WALLETS
            WHERE USER_ID = :1
            """,
            [user_data["user_id"]],
        )
        wallet_row = cursor.fetchone()

        account_number = None
        if _wallet_has_account_number(cursor):
            cursor.execute(
                "SELECT ACCOUNT_NUMBER FROM WALLETS WHERE USER_ID = :1",
                [user_data["user_id"]],
            )
            account_row = cursor.fetchone()
            account_number = account_row[0] if account_row else None

        cursor.execute(
            """
            SELECT CARD_ID, CARD_NUMBER, EXPIRY_DATE, CARD_STATUS
            FROM CARDS
            WHERE USER_ID = :1
            ORDER BY CARD_ID DESC
            FETCH FIRST 1 ROWS ONLY
            """,
            [user_data["user_id"]],
        )
        card_row = cursor.fetchone()

        cursor.execute(
            "SELECT LIMIT_AMOUNT FROM WITHDRAWAL_LIMITS WHERE USER_ID = :1",
            [user_data["user_id"]],
        )
        limit_row = cursor.fetchone()

        return {
            "status": "Success",
            "data": {
                "full_name": user_map.get("full_name"),
                "phone": user_map.get("phone"),
                "email": user_map.get("email"),
                "cnic": user_map.get("cnic"),
                "member_since": (
                    user_map.get("created_at").isoformat()
                    if user_map.get("created_at")
                    else None
                ),
                "wallet_id": wallet_row[0] if wallet_row else None,
                "account_number": account_number,
                "wallet_status": wallet_row[2] if wallet_row else None,
                "balance": float(wallet_row[1]) if wallet_row else 0,
                "card": {
                    "card_id": card_row[0] if card_row else None,
                    "card_number": card_row[1] if card_row else None,
                    "card_number_masked": _mask_card_number(card_row[1]) if card_row else None,
                    "card_last4": card_row[1][-4:] if card_row and card_row[1] else None,
                    "expiry": card_row[2].strftime("%m / %y") if card_row and card_row[2] else None,
                    "status": card_row[3] if card_row else None,
                },
                "withdrawal_limit": float(limit_row[0]) if limit_row else None,
            },
        }
    finally:
        cursor.close()
        conn.close()

@app.patch("/user/profile", tags=["User"])
def update_profile(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    allowed_fields = {
        "full_name": "FULL_NAME",
        "phone": "PHONE",
        "email": "EMAIL",
    }

    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Build a single UPDATE statement with correct sequential bind params
        set_clauses = []
        bind_values = []
        param_idx = 1

        for key, column in allowed_fields.items():
            if key in data and data[key]:
                set_clauses.append(f"{column} = :{param_idx}")
                bind_values.append(data[key])
                param_idx += 1

        if "cnic" in data and data["cnic"] and _column_exists(cursor, "USERS", "CNIC"):
            set_clauses.append(f"CNIC = :{param_idx}")
            bind_values.append(data["cnic"])
            param_idx += 1

        if not set_clauses:
            return {"status": "Error", "message": "No profile fields provided."}

        # Append user_id as the last bind parameter for WHERE clause
        bind_values.append(user_data["user_id"])
        sql = f"UPDATE USERS SET {', '.join(set_clauses)} WHERE USER_ID = :{param_idx}"
        cursor.execute(sql, bind_values)
        conn.commit()
        return {"status": "Success", "message": "Profile updated."}
    finally:
        cursor.close()
        conn.close()

@app.patch("/user/change-password", tags=["User"])
def change_password(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    old_password = data.get("old_password")
    new_password = data.get("new_password")
    if not old_password or not new_password:
        return {"status": "Error", "message": "Old and new password are required."}

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT PASSWORD_HASH FROM USERS WHERE USER_ID = :1",
            [user_data["user_id"]],
        )
        row = cursor.fetchone()
        if not row:
            return {"status": "Error", "message": "Incorrect current password."}
        old_ok, _ = _verify_password_with_legacy_support(old_password, row[0])
        if not old_ok:
            return {"status": "Error", "message": "Incorrect current password."}

        new_password_hash = _hash_password(new_password)
        cursor.execute(
            "UPDATE USERS SET PASSWORD_HASH = :1 WHERE USER_ID = :2",
            [new_password_hash, user_data["user_id"]],
        )
        conn.commit()
        return {"status": "Success", "message": "Password updated."}
    finally:
        cursor.close()
        conn.close()

@app.delete("/user/delete", tags=["User"])
def delete_account(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        wallet_id = _get_wallet_id(cursor, user_data["user_id"])
        if wallet_id:
            cursor.execute(
                "DELETE FROM TRANSFERS WHERE SENDER_WALLET_ID = :1 OR RECEIVER_WALLET_ID = :1",
                [wallet_id],
            )
            if _table_exists(cursor, "TRANSACTIONS"):
                cursor.execute(
                    "DELETE FROM TRANSACTIONS WHERE WALLET_ID = :1",
                    [wallet_id],
                )

        if _table_exists(cursor, "BANK_ACCOUNTS"):
            cursor.execute("DELETE FROM BANK_ACCOUNTS WHERE USER_ID = :1", [user_data["user_id"]])
        if _table_exists(cursor, "ADMIN_USER"):
            cursor.execute("DELETE FROM ADMIN_USER WHERE USER_ID = :1", [user_data["user_id"]])

        if _table_exists(cursor, "NOTIFICATIONS"):
            cursor.execute("DELETE FROM NOTIFICATIONS WHERE USER_ID = :1", [user_data["user_id"]])
        if _table_exists(cursor, "CARD_REQUESTS"):
            cursor.execute("DELETE FROM CARD_REQUESTS WHERE USER_ID = :1", [user_data["user_id"]])
        if _table_exists(cursor, "WITHDRAWAL_LIMITS"):
            cursor.execute("DELETE FROM WITHDRAWAL_LIMITS WHERE USER_ID = :1", [user_data["user_id"]])
        if _table_exists(cursor, "TOPUP_REQUESTS"):
            cursor.execute("DELETE FROM TOPUP_REQUESTS WHERE USER_ID = :1", [user_data["user_id"]])

        if _table_exists(cursor, "CARD_PINS"):
            cursor.execute(
                "DELETE FROM CARD_PINS WHERE CARD_ID IN (SELECT CARD_ID FROM CARDS WHERE USER_ID = :1)",
                [user_data["user_id"]],
            )
        cursor.execute("DELETE FROM CARDS WHERE USER_ID = :1", [user_data["user_id"]])
        cursor.execute("DELETE FROM WALLETS WHERE USER_ID = :1", [user_data["user_id"]])
        cursor.execute("DELETE FROM USERS WHERE USER_ID = :1", [user_data["user_id"]])

        conn.commit()
        return {"status": "Success", "message": "Account deleted."}
    finally:
        cursor.close()
        conn.close()

@app.get("/user/transactions", tags=["User"])
def get_transactions(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    try:
        user_data = verify_user_token(_resolve_token(token, authorization))
        user_id = int(user_data["user_id"])
        conn = get_connection()
        cursor = conn.cursor()
    except Exception as e:
        return {"status": "Error", "message": f"Auth/Connection Error: {str(e)}"}

    try:
        wallet_id = _get_wallet_id(cursor, user_id)
        if not wallet_id:
            return {"status": "Success", "data": []}

        cursor.execute(
            """
            SELECT
                T.TRANSFER_ID,
                T.TRANSFER_DATE,
                T.AMOUNT,
                T.STATUS,
                T.SENDER_WALLET_ID,
                T.RECEIVER_WALLET_ID,
                SU.FULL_NAME AS SENDER_NAME,
                RU.FULL_NAME AS RECEIVER_NAME
            FROM TRANSFERS T
            LEFT JOIN WALLETS SW ON SW.WALLET_ID = T.SENDER_WALLET_ID
            LEFT JOIN USERS SU ON SU.USER_ID = SW.USER_ID
            LEFT JOIN WALLETS RW ON RW.WALLET_ID = T.RECEIVER_WALLET_ID
            LEFT JOIN USERS RU ON RU.USER_ID = RW.USER_ID
            WHERE T.SENDER_WALLET_ID = :1 OR T.RECEIVER_WALLET_ID = :2
            ORDER BY T.TRANSFER_DATE DESC
            """,
            [wallet_id, wallet_id],
        )
        transfer_rows = cursor.fetchall()

        txns = []
        for row in transfer_rows:
            is_sender = row[4] == wallet_id
            counterpart_name = row[7] if is_sender else row[6]
            txns.append(
                {
                    "id": row[0],
                    "date": row[1].isoformat() if row[1] else None,
                    "type": "Money Transfer",
                    "reference": f"Wallet #{row[5] if is_sender else row[4]}",
                    "recipient": counterpart_name,
                    "amount": float(row[2]),
                    "direction": "debit" if is_sender else "credit",
                    "status": row[3],
                }
            )

        if _table_exists(cursor, "TOPUP_REQUESTS"):
            cursor.execute(
                """
                SELECT TOPUP_ID, CREATED_AT, AMOUNT, METHOD, REFERENCE
                FROM TOPUP_REQUESTS
                WHERE USER_ID = :1
                ORDER BY CREATED_AT DESC
                """,
                [user_id],
            )
            for row in cursor.fetchall():
                txns.append(
                    {
                        "id": f"TOPUP-{row[0]}",
                        "date": row[1].isoformat() if row[1] else None,
                        "type": "Top Up",
                        "reference": row[4] or row[3] or "Cash/Cheque",
                        "recipient": "Wallet Top Up",
                        "amount": float(row[2]),
                        "direction": "credit",
                        "status": "Completed",
                    }
                )

        # 3. Add Misc Transactions (Charity, etc.)
        if _table_exists(cursor, "TRANSACTIONS"):
            cursor.execute(
                """
                SELECT TRANSACTION_ID, TRANSACTION_DATE, AMOUNT, TRANSACTION_TYPE, REFERENCE_ID
                FROM TRANSACTIONS
                WHERE WALLET_ID = :1
                ORDER BY TRANSACTION_DATE DESC
                """,
                [wallet_id],
            )
            for row in cursor.fetchall():
                # Map internal types to user-friendly types
                txn_type = row[3]
                ref = row[4] or ""
                if "Charity" in ref:
                    txn_type = "Charity Donation"
                
                txns.append(
                    {
                        "id": f"TXN-{row[0]}",
                        "date": row[1].isoformat() if row[1] else None,
                        "type": txn_type,
                        "reference": ref,
                        "recipient": "Service Payment",
                        "amount": float(row[2]),
                        "direction": "debit" if row[3] in ('WITHDRAWAL', 'TRANSFER') else "credit",
                        "status": "Completed",
                    }
                )

        # 4. Add Card Fees
        if _table_exists(cursor, "CARD_REQUESTS"):
            cursor.execute(
                """
                SELECT REQUEST_ID, CREATED_AT, CHARGE_AMOUNT, REQUEST_TYPE
                FROM CARD_REQUESTS
                WHERE USER_ID = :1 AND CHARGE_AMOUNT > 0
                ORDER BY CREATED_AT DESC
                """,
                [user_id],
            )
            for row in cursor.fetchall():
                txns.append(
                    {
                        "id": f"CARD-{row[0]}",
                        "date": row[1].isoformat() if row[1] else None,
                        "type": "Card Fee",
                        "reference": f"{row[3]} Request",
                        "recipient": "MushkilPay Cards",
                        "amount": float(row[2]),
                        "direction": "debit",
                        "status": "Completed",
                    }
                )

        txns.sort(key=lambda t: t["date"] or "", reverse=True)
        return {"status": "Success", "data": txns}
    except Exception as e:
        return {"status": "Error", "message": f"Database Error: {str(e)}"}
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

@app.get("/user/notifications", tags=["User"])
def get_notifications(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    raw = _resolve_token(token, authorization)
    try:
        user_data = jwt.decode(raw, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or Expired User Token")
    uid = user_data.get("user_id")
    if uid is None:
        return {"status": "Success", "data": []}
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if not _table_exists(cursor, "NOTIFICATIONS"):
            return {"status": "Success", "data": []}
        cursor.execute(
            """
            SELECT NOTIF_ID, TITLE, MESSAGE, CREATED_AT, IS_READ
            FROM NOTIFICATIONS
            WHERE USER_ID = :1
            ORDER BY CREATED_AT DESC
            FETCH FIRST 20 ROWS ONLY
            """,
            [uid],
        )
        rows = cursor.fetchall()
        data = [
            {
                "id": row[0],
                "title": row[1],
                "message": row[2],
                "created_at": row[3].isoformat() if row[3] else None,
                "is_read": bool(row[4]),
            }
            for row in rows
        ]
        return {"status": "Success", "data": data}
    finally:
        cursor.close()
        conn.close()

@app.post("/user/notifications/read", tags=["User"])
def mark_notifications_read(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    raw = _resolve_token(token, authorization)
    try:
        user_data = jwt.decode(raw, SECRET_KEY, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or Expired User Token")
    uid = user_data.get("user_id")
    if uid is None:
        return {"status": "Success", "message": "No customer notifications for admin."}
    notif_ids = [str(n) for n in data.get("ids", []) if str(n).isdigit()]
    if not notif_ids:
        return {"status": "Success", "message": "No notifications provided."}
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if not _table_exists(cursor, "NOTIFICATIONS"):
            return {"status": "Success", "message": "Notifications disabled."}
        
        for nid in notif_ids:
            cursor.execute(
                "UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE USER_ID = :1 AND NOTIF_ID = :2",
                [uid, int(nid)],
            )
        
        conn.commit()
        return {"status": "Success", "message": "Notifications updated."}
    finally:
        cursor.close()
        conn.close()

@app.get("/user/cards", tags=["Cards"])
def get_card(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT CARD_ID, CARD_NUMBER, EXPIRY_DATE, CARD_STATUS, CARD_TYPE
            FROM CARDS
            WHERE USER_ID = :1
            ORDER BY CARD_ID DESC
            FETCH FIRST 1 ROWS ONLY
            """,
            [user_data["user_id"]],
        )
        row = cursor.fetchone()
        if not row:
            return {"status": "Success", "data": None}
        return {
            "status": "Success",
            "data": {
                "card_id": row[0],
                "card_number": _mask_card_number(row[1]),
                "card_last4": row[1][-4:] if row[1] else None,
                "expiry": row[2].strftime("%m / %y") if row[2] else None,
                "status": row[3],
                "type": row[4] if len(row) > 4 else "DEBIT",
            },
        }
    finally:
        cursor.close()
        conn.close()

@app.get("/user/cards/all", tags=["Cards"])
def get_all_cards(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Returns all cards for a user with card type information"""
    user_data = verify_user_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT CARD_ID, CARD_NUMBER, EXPIRY_DATE, CARD_STATUS, CARD_TYPE
            FROM CARDS
            WHERE USER_ID = :1
            ORDER BY CARD_ID DESC
            """,
            [user_data["user_id"]],
        )
        rows = cursor.fetchall()
        cards = [
            {
                "card_id": row[0],
                "card_number": _mask_card_number(row[1]),
                "card_last4": row[1][-4:] if row[1] else None,
                "expiry": row[2].strftime("%m / %y") if row[2] else None,
                "status": row[3],
                "type": row[4] if len(row) > 4 else "DEBIT",
            }
            for row in rows
        ]
        return {"status": "Success", "data": cards}
    finally:
        cursor.close()
        conn.close()

@app.post("/user/cards/activate", tags=["Cards"])
def activate_card(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    card_number = (data.get("card_number") or "").replace(" ", "")
    cvv = data.get("cvv")
    if not card_number or not cvv:
        return {"status": "Error", "message": "Card number and CVV are required."}

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT CARD_ID, CARD_STATUS
            FROM CARDS
            WHERE USER_ID = :1 AND CARD_NUMBER = :2 AND CVV = :3
            """,
            [user_data["user_id"], card_number, cvv],
        )
        row = cursor.fetchone()
        if not row:
            return {"status": "Error", "message": "Card not found or CVV incorrect."}

        if row[1] == "ACTIVE":
            return {"status": "Success", "message": "Card already active."}

        cursor.execute(
            "UPDATE CARDS SET CARD_STATUS = 'ACTIVE' WHERE CARD_ID = :1",
            [row[0]],
        )
        _create_notification(cursor, user_data["user_id"], "Card Activated", "Your card is now active.")
        conn.commit()
        return {"status": "Success", "message": "Card activated."}
    finally:
        cursor.close()
        conn.close()

@app.post("/user/cards/request", tags=["Cards"])
def request_new_card(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    reason = (data.get("reason") or "").strip().upper()
    delivery_address = (data.get("delivery_address") or "").strip()
    request_type = (data.get("request_type") or "REPLACE").strip().upper()

    if reason not in {"LOST", "EXPIRED"}:
        return {"status": "Error", "message": "Reason must be LOST or EXPIRED."}
    if not delivery_address:
        return {"status": "Error", "message": "Delivery address required."}

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT CARD_ID, EXPIRY_DATE
            FROM CARDS
            WHERE USER_ID = :1
            ORDER BY CARD_ID DESC
            FETCH FIRST 1 ROWS ONLY
            """,
            [user_data["user_id"]],
        )
        card_row = cursor.fetchone()
        if not card_row:
            return {"status": "Error", "message": "No card found for this user."}

        if reason == "EXPIRED" and card_row[1] and card_row[1] > datetime.utcnow():
            return {"status": "Error", "message": "Card has not expired yet."}

        cursor.execute(
            "SELECT BALANCE FROM WALLETS WHERE USER_ID = :1",
            [user_data["user_id"]],
        )
        balance_row = cursor.fetchone()
        if not balance_row or float(balance_row[0]) < 2000:
            return {"status": "Error", "message": "Insufficient balance for card fee."}

        cursor.execute(
            "UPDATE WALLETS SET BALANCE = BALANCE - 2000 WHERE USER_ID = :1",
            [user_data["user_id"]],
        )

        cursor.execute(
            """
            INSERT INTO CARD_REQUESTS (USER_ID, REQUEST_TYPE, REASON, DELIVERY_ADDRESS, CHARGE_AMOUNT)
            VALUES (:1, :2, :3, :4, 2000)
            """,
            [
                user_data["user_id"],
                request_type,
                reason,
                delivery_address,
            ],
        )

        _create_notification(
            cursor,
            user_data["user_id"],
            "Card Request Submitted",
            "Your replacement card request is submitted for delivery.",
        )
        conn.commit()
        return {"status": "Success", "message": "Card request submitted."}
    finally:
        cursor.close()
        conn.close()

@app.patch("/user/cards/change-pin", tags=["Cards"])
def change_card_pin(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Change card PIN with PBKDF2 hashing for security."""
    user_data = verify_user_token(_resolve_token(token, authorization))
    card_last4 = (data.get("card_last4") or "").strip()
    old_pin = data.get("old_pin")
    new_pin = data.get("new_pin")
    if not card_last4 or not new_pin:
        return {"status": "Error", "message": "Card last 4 and new PIN are required."}

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT CARD_ID
            FROM CARDS
            WHERE USER_ID = :1 AND SUBSTR(CARD_NUMBER, -4) = :2
            ORDER BY CARD_ID DESC
            FETCH FIRST 1 ROWS ONLY
            """,
            [user_data["user_id"], card_last4],
        )
        row = cursor.fetchone()
        if not row:
            return {"status": "Error", "message": "Card not found."}

        card_id = row[0]
        cursor.execute(
            "SELECT PIN_HASH FROM CARD_PINS WHERE CARD_ID = :1",
            [card_id],
        )
        pin_row = cursor.fetchone()
        
        # Verify old PIN if one exists
        if pin_row and old_pin:
            old_pin_ok, _ = _verify_password_with_legacy_support(old_pin, pin_row[0])
            if not old_pin_ok:
                return {"status": "Error", "message": "Incorrect current PIN."}
        elif pin_row and not old_pin:
            return {"status": "Error", "message": "Current PIN required to change PIN."}

        # Hash new PIN with PBKDF2 (secure with random salt)
        new_pin_hash = _hash_password(new_pin)
        
        if pin_row:
            cursor.execute(
                "UPDATE CARD_PINS SET PIN_HASH = :1, UPDATED_AT = SYSTIMESTAMP WHERE CARD_ID = :2",
                [new_pin_hash, card_id],
            )
        else:
            cursor.execute(
                "INSERT INTO CARD_PINS (CARD_ID, PIN_HASH) VALUES (:1, :2)",
                [card_id, new_pin_hash],
            )

        _create_notification(cursor, user_data["user_id"], "Card PIN Updated", "Your card PIN was updated.")
        conn.commit()
        return {"status": "Success", "message": "Card PIN updated securely."}
    finally:
        cursor.close()
        conn.close()

@app.put("/user/withdrawal-limit", tags=["User"])
def update_withdrawal_limit(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    limit_amount = data.get("limit_amount")
    if limit_amount in (None, ""):
        return {"status": "Error", "message": "Limit amount required."}

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            MERGE INTO WITHDRAWAL_LIMITS T
            USING (SELECT :1 AS USER_ID, :2 AS LIMIT_AMOUNT FROM DUAL) S
            ON (T.USER_ID = S.USER_ID)
            WHEN MATCHED THEN UPDATE SET T.LIMIT_AMOUNT = S.LIMIT_AMOUNT, T.UPDATED_AT = SYSTIMESTAMP
            WHEN NOT MATCHED THEN INSERT (USER_ID, LIMIT_AMOUNT, UPDATED_AT)
            VALUES (S.USER_ID, S.LIMIT_AMOUNT, SYSTIMESTAMP)
            """,
            [user_data["user_id"], limit_amount],
        )
        conn.commit()
        return {"status": "Success", "message": "Withdrawal limit updated."}
    finally:
        cursor.close()
        conn.close()

@app.get("/user/withdrawal-limit", tags=["User"])
def get_withdrawal_limit(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    user_data = verify_user_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT LIMIT_AMOUNT FROM WITHDRAWAL_LIMITS WHERE USER_ID = :1",
            [user_data["user_id"]],
        )
        row = cursor.fetchone()
        return {"status": "Success", "data": {"limit_amount": float(row[0]) if row else None}}
    finally:
        cursor.close()
        conn.close()

@app.post("/admin/topup", tags=["Admin"])
def admin_topup(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    admin_data = verify_admin_token(_resolve_token(token, authorization))
    account_number = str(data.get("account_number") or "").strip()
    raw_amount = data.get("amount")
    method = (data.get("method") or "CASH").upper()
    reference = data.get("reference")

    if not account_number or raw_amount in (None, ""):
        return {"status": "Error", "message": "Account number and amount required."}
    try:
        amount = float(raw_amount)
    except (TypeError, ValueError):
        return {"status": "Error", "message": "Amount must be a valid number."}
    if amount <= 0:
        return {"status": "Error", "message": "Amount must be greater than zero."}

    conn = get_connection()
    cursor = conn.cursor()
    try:
        max_per_tx = 1000000.0
        max_per_day = 10000000.0
        if _table_exists(cursor, "ADMIN_SETTINGS"):
            cursor.execute(
                """
                SELECT S.MAX_TOPUP_PER_TRANSACTION, S.MAX_TOPUP_PER_DAY
                FROM ADMIN_SETTINGS S
                JOIN ADMINS A ON A.ADMIN_ID = S.ADMIN_ID
                WHERE A.USERNAME = :1
                FETCH FIRST 1 ROWS ONLY
                """,
                [admin_data.get("sub")],
            )
            settings_row = cursor.fetchone()
            if settings_row:
                if settings_row[0] is not None:
                    max_per_tx = float(settings_row[0])
                if settings_row[1] is not None:
                    max_per_day = float(settings_row[1])

        if amount > max_per_tx:
            return {"status": "Error", "message": f"Top up exceeds per-transaction limit of PKR {max_per_tx:,.0f}."}

        if _table_exists(cursor, "TOPUP_REQUESTS"):
            cursor.execute(
                """
                SELECT NVL(SUM(AMOUNT), 0)
                FROM TOPUP_REQUESTS
                WHERE ADMIN_USERNAME = :1
                  AND TRUNC(CREATED_AT) = TRUNC(SYSDATE)
                  AND STATUS = 'COMPLETED'
                """,
                [admin_data.get("sub")],
            )
            today_total = float(cursor.fetchone()[0] or 0)
            if today_total + amount > max_per_day:
                remaining = max_per_day - today_total
                return {"status": "Error", "message": f"Daily top up limit exceeded. Remaining: PKR {remaining:,.0f}."}

        receiver_row = _get_wallet_by_account(cursor, account_number)
        if not receiver_row:
            return {"status": "Error", "message": "Account not found."}

        cursor.execute(
            "UPDATE WALLETS SET BALANCE = BALANCE + :1 WHERE WALLET_ID = :2",
            [amount, receiver_row[0]],
        )

        if _table_exists(cursor, "TOPUP_REQUESTS"):
            cursor.execute(
                """
                INSERT INTO TOPUP_REQUESTS (ADMIN_USERNAME, USER_ID, ACCOUNT_NUMBER, AMOUNT, METHOD, REFERENCE)
                VALUES (:1, :2, :3, :4, :5, :6)
                """,
                [
                    admin_data.get("sub"),
                    receiver_row[1],
                    account_number,
                    amount,
                    method,
                    reference,
                ],
            )

        _create_notification(
            cursor,
            receiver_row[1],
            "Wallet Top Up",
            f"PKR {amount} credited via {method}.",
        )
        conn.commit()
        return {"status": "Success", "message": "Top up completed."}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

# 7. Admin Panel Routes (Extended Dashboard)

@app.get("/admin/card-requests", tags=["Admin Dashboard"])
def get_card_requests(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Fetch all card requests from all customers."""
    verify_admin_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT 
                CR.REQUEST_ID,
                CR.USER_ID,
                U.FULL_NAME,
                U.EMAIL,
                CR.REQUEST_TYPE,
                CR.REASON,
                CR.DELIVERY_ADDRESS,
                CR.STATUS,
                CR.CHARGE_AMOUNT,
                CR.CREATED_AT
            FROM CARD_REQUESTS CR
            JOIN USERS U ON U.USER_ID = CR.USER_ID
            ORDER BY CR.CREATED_AT DESC
        """)
        cols = [c[0] for c in cursor.description]
        data = [dict(zip(cols, r)) for r in cursor.fetchall()]
        return {"status": "Success", "data": data}
    except Exception as e:
        return {"status": "Error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()

@app.get("/admin/wallets", tags=["Admin Dashboard"])
def get_all_wallets(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Fetch all customer wallets with text-based data."""
    verify_admin_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT 
                W.WALLET_ID,
                W.USER_ID,
                U.FULL_NAME,
                U.EMAIL,
                U.PHONE,
                W.ACCOUNT_NUMBER,
                W.BALANCE,
                W.WALLET_STATUS,
                W.CREATED_AT,
                (SELECT MAX(TRANSFER_DATE) FROM TRANSFERS WHERE SENDER_WALLET_ID = W.WALLET_ID OR RECEIVER_WALLET_ID = W.WALLET_ID) as LAST_ACTIVITY
            FROM WALLETS W
            JOIN USERS U ON U.USER_ID = W.USER_ID
            ORDER BY W.CREATED_AT DESC
        """)
        cols = [c[0] for c in cursor.description]
        data = [dict(zip(cols, r)) for r in cursor.fetchall()]
        return {"status": "Success", "data": data, "total_wallets": len(data)}
    except Exception as e:
        return {"status": "Error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()

@app.get("/admin/transactions", tags=["Admin Dashboard"])
def get_transactions_by_account(
    account_number: str,
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Fetch transaction history for a specific customer account."""
    verify_admin_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Find wallet by account
        wallet_row = _get_wallet_by_account(cursor, account_number.strip())
        if not wallet_row:
            return {"status": "Error", "message": "Account not found"}
        
        wallet_id = wallet_row[0]
        user_id = wallet_row[1]
        customer_name = wallet_row[2]
        
        cursor.execute("""
            SELECT 
                T.TRANSFER_ID,
                T.SENDER_WALLET_ID,
                T.RECEIVER_WALLET_ID,
                T.AMOUNT,
                T.TRANSFER_DATE,
                T.STATUS,
                SU.FULL_NAME as SENDER_NAME,
                RU.FULL_NAME as RECEIVER_NAME
            FROM TRANSFERS T
            LEFT JOIN WALLETS SW ON SW.WALLET_ID = T.SENDER_WALLET_ID
            LEFT JOIN USERS SU ON SU.USER_ID = SW.USER_ID
            LEFT JOIN WALLETS RW ON RW.WALLET_ID = T.RECEIVER_WALLET_ID
            LEFT JOIN USERS RU ON RU.USER_ID = RW.USER_ID
            WHERE T.SENDER_WALLET_ID = :1 OR T.RECEIVER_WALLET_ID = :1
            ORDER BY T.TRANSFER_DATE DESC
        """, [wallet_id, wallet_id])
        cols = [c[0] for c in cursor.description]
        transactions = [dict(zip(cols, r)) for r in cursor.fetchall()]

        # Add Top-ups
        if _table_exists(cursor, "TOPUP_REQUESTS"):
            cursor.execute("""
                SELECT TOPUP_ID, AMOUNT, CREATED_AT, METHOD, REFERENCE
                FROM TOPUP_REQUESTS WHERE USER_ID = :1
            """, [user_id])
            for r in cursor.fetchall():
                transactions.append({
                    "TRANSFER_ID": f"TOPUP-{r[0]}",
                    "SENDER_NAME": f"Admin ({r[4]})",
                    "RECEIVER_NAME": customer_name,
                    "AMOUNT": float(r[1]),
                    "TRANSFER_DATE": r[2],
                    "STATUS": "COMPLETED"
                })

        # Add Misc (Charity)
        if _table_exists(cursor, "TRANSACTIONS"):
            cursor.execute("""
                SELECT TRANSACTION_ID, AMOUNT, TRANSACTION_DATE, TRANSACTION_TYPE, REFERENCE_ID
                FROM TRANSACTIONS WHERE WALLET_ID = :1
            """, [wallet_id])
            for r in cursor.fetchall():
                transactions.append({
                    "TRANSFER_ID": f"TXN-{r[0]}",
                    "SENDER_NAME": customer_name,
                    "RECEIVER_NAME": r[4] or "Service",
                    "AMOUNT": float(r[1]),
                    "TRANSFER_DATE": r[2],
                    "STATUS": "COMPLETED"
                })

        # Add Card Fees
        if _table_exists(cursor, "CARD_REQUESTS"):
            cursor.execute("""
                SELECT REQUEST_ID, CHARGE_AMOUNT, CREATED_AT, REQUEST_TYPE
                FROM CARD_REQUESTS WHERE USER_ID = :1 AND CHARGE_AMOUNT > 0
            """, [user_id])
            for r in cursor.fetchall():
                transactions.append({
                    "TRANSFER_ID": f"CARD-{r[0]}",
                    "SENDER_NAME": customer_name,
                    "RECEIVER_NAME": f"Card Fee ({r[3]})",
                    "AMOUNT": float(r[1]),
                    "TRANSFER_DATE": r[2],
                    "STATUS": "COMPLETED"
                })

        transactions.sort(key=lambda x: x["TRANSFER_DATE"] if x["TRANSFER_DATE"] else datetime.min, reverse=True)
        
        return {
            "status": "Success",
            "customer": {
                "wallet_id": wallet_id,
                "user_id": user_id,
                "full_name": customer_name,
                "account_number": account_number
            },
            "transactions": transactions,
            "total_transactions": len(transactions)
        }
    except Exception as e:
        return {"status": "Error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()

@app.get("/admin/settings", tags=["Admin Dashboard"])
def get_admin_settings(
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Fetch admin settings and preferences."""
    admin_data = verify_admin_token(_resolve_token(token, authorization))
    username = admin_data.get("sub", "Admin")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if _table_exists(cursor, "ADMIN_SETTINGS"):
            cursor.execute(
                """
                SELECT
                    S.SESSION_TIMEOUT,
                    S.TWO_FA_ENABLED,
                    S.NOTIFICATION_EMAILS,
                    S.MAX_TOPUP_PER_TRANSACTION,
                    S.MAX_TOPUP_PER_DAY,
                    S.WITHDRAWAL_LIMIT,
                    S.AUDIT_LOGS_RETENTION_DAYS
                FROM ADMIN_SETTINGS S
                JOIN ADMINS A ON A.ADMIN_ID = S.ADMIN_ID
                WHERE A.USERNAME = :1
                FETCH FIRST 1 ROWS ONLY
                """,
                [username],
            )
            row = cursor.fetchone()
            if row:
                return {
                    "status": "Success",
                    "settings": {
                        "username": username,
                        "session_timeout": int(row[0] or 3600),
                        "two_fa_enabled": bool(row[1]),
                        "notification_emails": bool(row[2]),
                        "system_limits": {
                            "max_topup_per_transaction": float(row[3] or 1000000),
                            "max_topup_per_day": float(row[4] or 10000000),
                            "withdrawal_limit": float(row[5] or 500000),
                        },
                        "audit_logs_retention_days": int(row[6] or 90),
                    },
                }

        return {
            "status": "Success",
            "settings": {
                "username": username,
                "session_timeout": 3600,
                "two_fa_enabled": False,
                "notification_emails": True,
                "system_limits": {
                    "max_topup_per_transaction": 1000000,
                    "max_topup_per_day": 10000000,
                    "withdrawal_limit": 500000,
                },
                "audit_logs_retention_days": 90,
            },
        }
    finally:
        cursor.close()
        conn.close()

@app.patch("/admin/settings", tags=["Admin Dashboard"])
def update_admin_settings(
    data: dict = Body(...),
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Update admin settings and preferences."""
    admin_data = verify_admin_token(_resolve_token(token, authorization))
    username = admin_data.get("sub")
    if not username:
        return {"status": "Error", "message": "Invalid admin identity."}

    session_timeout = data.get("session_timeout")
    two_fa_enabled = data.get("two_fa_enabled")
    notification_emails = data.get("notification_emails")
    audit_logs_retention_days = data.get("audit_logs_retention_days")
    system_limits = data.get("system_limits") or {}
    max_topup_per_transaction = system_limits.get("max_topup_per_transaction")
    max_topup_per_day = system_limits.get("max_topup_per_day")
    withdrawal_limit = system_limits.get("withdrawal_limit")

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT ADMIN_ID FROM ADMINS WHERE USERNAME = :1", [username])
        admin_row = cursor.fetchone()
        if not admin_row:
            return {"status": "Error", "message": "Admin user not found."}
        admin_id = int(admin_row[0])

        if _table_exists(cursor, "ADMIN_SETTINGS"):
            cursor.execute(
                "SELECT COUNT(*) FROM ADMIN_SETTINGS WHERE ADMIN_ID = :1",
                [admin_id],
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute("INSERT INTO ADMIN_SETTINGS (ADMIN_ID) VALUES (:1)", [admin_id])
        else:
            return {"status": "Error", "message": "Admin settings storage not available."}

        updates = []
        bind_values = []
        bind_idx = 1

        if session_timeout is not None:
            updates.append(f"SESSION_TIMEOUT = :{bind_idx}")
            bind_values.append(int(session_timeout))
            bind_idx += 1
        if two_fa_enabled is not None:
            updates.append(f"TWO_FA_ENABLED = :{bind_idx}")
            bind_values.append(1 if bool(two_fa_enabled) else 0)
            bind_idx += 1
        if notification_emails is not None:
            updates.append(f"NOTIFICATION_EMAILS = :{bind_idx}")
            bind_values.append(1 if bool(notification_emails) else 0)
            bind_idx += 1
        if max_topup_per_transaction is not None:
            updates.append(f"MAX_TOPUP_PER_TRANSACTION = :{bind_idx}")
            bind_values.append(float(max_topup_per_transaction))
            bind_idx += 1
        if max_topup_per_day is not None:
            updates.append(f"MAX_TOPUP_PER_DAY = :{bind_idx}")
            bind_values.append(float(max_topup_per_day))
            bind_idx += 1
        if withdrawal_limit is not None:
            updates.append(f"WITHDRAWAL_LIMIT = :{bind_idx}")
            bind_values.append(float(withdrawal_limit))
            bind_idx += 1
        if audit_logs_retention_days is not None:
            updates.append(f"AUDIT_LOGS_RETENTION_DAYS = :{bind_idx}")
            bind_values.append(int(audit_logs_retention_days))
            bind_idx += 1

        updates.append(f"UPDATED_AT = :{bind_idx}")
        bind_values.append(datetime.utcnow())
        bind_idx += 1

        bind_values.append(admin_id)
        cursor.execute(
            f"UPDATE ADMIN_SETTINGS SET {', '.join(updates)} WHERE ADMIN_ID = :{bind_idx}",
            bind_values,
        )
        conn.commit()

        cursor.execute(
            """
            SELECT
                S.SESSION_TIMEOUT,
                S.TWO_FA_ENABLED,
                S.NOTIFICATION_EMAILS,
                S.MAX_TOPUP_PER_TRANSACTION,
                S.MAX_TOPUP_PER_DAY,
                S.WITHDRAWAL_LIMIT,
                S.AUDIT_LOGS_RETENTION_DAYS
            FROM ADMIN_SETTINGS S
            WHERE S.ADMIN_ID = :1
            """,
            [admin_id],
        )
        row = cursor.fetchone()
        return {
            "status": "Success",
            "message": "Settings updated successfully",
            "settings": {
                "username": username,
                "session_timeout": int(row[0] or 3600),
                "two_fa_enabled": bool(row[1]),
                "notification_emails": bool(row[2]),
                "system_limits": {
                    "max_topup_per_transaction": float(row[3] or 1000000),
                    "max_topup_per_day": float(row[4] or 10000000),
                    "withdrawal_limit": float(row[5] or 500000),
                },
                "audit_logs_retention_days": int(row[6] or 90),
            },
        }
    except Exception as e:
        conn.rollback()
        return {"status": "Error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()

@app.patch("/admin/card-request/{request_id}", tags=["Admin Dashboard"])
def update_card_request(
    request_id: int,
    new_status: str,
    token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Update card request status (APPROVED/REJECTED/DISPATCHED/DELIVERED)."""
    verify_admin_token(_resolve_token(token, authorization))
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Get request details
        cursor.execute("SELECT USER_ID, REQUEST_TYPE FROM CARD_REQUESTS WHERE REQUEST_ID = :1", [request_id])
        request = cursor.fetchone()
        if not request:
            return {"status": "Error", "message": "Card request not found"}
        
        user_id, request_type = request[0], request[1]
        
        # Update status
        cursor.execute("UPDATE CARD_REQUESTS SET STATUS = :1 WHERE REQUEST_ID = :2", 
                      [new_status.upper(), request_id])
        
        # Create notification
        status_msg = {
            "APPROVED": f"Your {request_type} card request has been approved",
            "REJECTED": f"Your {request_type} card request has been rejected",
            "DISPATCHED": f"Your {request_type} card is on the way",
            "DELIVERED": f"Your {request_type} card has been delivered"
        }.get(new_status.upper(), f"Card request status updated to {new_status}")
        
        _create_notification(cursor, user_id, "Card Request Update", status_msg)
        conn.commit()
        
        return {"status": "Success", "message": f"Card request updated to {new_status}"}
    except Exception as e:
        if conn:
            conn.rollback()
        return {"status": "Error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
