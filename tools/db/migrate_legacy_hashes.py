"""
One-time migration helper for known default seed credentials.

Use this when the existing DB still has legacy or placeholder hashes.
It rewrites USERS/ADMINS/WALLETS hashes to current PBKDF2 format.
"""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from main import get_connection, _hash_password


def run():
    conn = get_connection()
    cursor = conn.cursor()
    try:
        user_defaults = {
            "mehdi@gmail.com": "mehdi",
            "mustafa@gmail.com": "mustafa",
            "aayan@gmail.com": "aayan",
        }
        for email, plain_password in user_defaults.items():
            cursor.execute(
                "UPDATE USERS SET PASSWORD_HASH = :1 WHERE EMAIL = :2",
                [_hash_password(plain_password), email],
            )

        cursor.execute(
            "UPDATE ADMINS SET PASSWORD_HASH = :1 WHERE USERNAME = :2",
            [_hash_password("admin"), "admin"],
        )

        cursor.execute(
            "UPDATE WALLETS SET WALLET_PIN = :1 WHERE USER_ID IN (1,2,3)",
            [_hash_password("1234")],
        )

        conn.commit()
        print("Legacy default hashes migrated successfully.")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    run()
