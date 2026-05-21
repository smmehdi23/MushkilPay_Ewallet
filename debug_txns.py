import oracledb
import os
from dotenv import load_dotenv

load_dotenv()

def test_transactions(user_id):
    try:
        conn = oracledb.connect(
            user=os.getenv('ORACLE_USER'),
            password=os.getenv('ORACLE_PASSWORD'),
            dsn=os.getenv('ORACLE_DSN')
        )
        cursor = conn.cursor()
        
        # 1. Get Wallet ID
        cursor.execute("SELECT WALLET_ID FROM WALLETS WHERE USER_ID = :1", [user_id])
        row = cursor.fetchone()
        if not row:
            print(f"User {user_id} has no wallet.")
            return
        wallet_id = row[0]
        print(f"User ID: {user_id}, Wallet ID: {wallet_id}")

        # 2. Test Transfers Query
        print("\nTesting TRANSFERS query...")
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
            WHERE T.SENDER_WALLET_ID = :1 OR T.RECEIVER_WALLET_ID = :1
            ORDER BY T.TRANSFER_DATE DESC
            """,
            [wallet_id],
        )
        rows = cursor.fetchall()
        print(f"Found {len(rows)} transfers.")
        for r in rows:
            print(r)

        # 3. Test Top-ups
        print("\nTesting TOPUP_REQUESTS query...")
        cursor.execute("SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME = 'TOPUP_REQUESTS'")
        if cursor.fetchone()[0] > 0:
            cursor.execute("SELECT * FROM TOPUP_REQUESTS WHERE USER_ID = :1", [user_id])
            topups = cursor.fetchall()
            print(f"Found {len(topups)} topups.")
        else:
            print("TOPUP_REQUESTS table does not exist.")

        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test for User 1 (Mehdi)
    test_transactions(1)
