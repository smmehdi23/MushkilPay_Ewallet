import oracledb
import os
from dotenv import load_dotenv

load_dotenv()
conn = oracledb.connect(
    user=os.getenv('ORACLE_USER', 'c##wallet_user'),
    password=os.getenv('ORACLE_PASSWORD', 'wallet_password_2026'),
    dsn=f"{os.getenv('ORACLE_HOST', 'localhost')}:{os.getenv('ORACLE_PORT', 1521)}/{os.getenv('ORACLE_SID', 'xe')}"
)
cursor = conn.cursor()

print('Current wallets (showing account number generation):')
cursor.execute('SELECT WALLET_ID, USER_ID, ACCOUNT_NUMBER, BALANCE FROM WALLETS ORDER BY WALLET_ID DESC')
for row in cursor.fetchall():
    print(f'  Wallet {row[0]}: User {row[1]}, Account#: {row[2]}, Balance: {row[3]}')

cursor.close()
conn.close()
