#!/usr/bin/env python
"""
MushkilPay Database Preview Tool
View all data in the created database
"""

import oracledb
import os
from dotenv import load_dotenv
from tabulate import tabulate

def print_header(title):
    """Print a formatted header"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def display_table(cursor, table_name):
    """Display contents of a table"""
    print(f"\n📋 {table_name}:")
    print("-" * 80)
    
    try:
        # Get column names
        cursor.execute(f"SELECT * FROM {table_name} WHERE ROWNUM <= 1")
        col_names = [desc[0] for desc in cursor.description]
        
        # Get all data
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        
        if not rows:
            print("  (no data)")
            return
        
        # Display using tabulate
        print(tabulate(rows, headers=col_names, tablefmt="grid", showindex=True))
        print(f"\n  Total records: {len(rows)}")
        
    except Exception as e:
        print(f"  ✗ Error: {e}")

def main():
    # Load environment
    load_dotenv()
    
    # Connect to database
    db_config = {
        'user': os.getenv('ORACLE_USER', 'c##wallet_user'),
        'password': os.getenv('ORACLE_PASSWORD', 'wallet_password_2026'),
        'dsn': os.getenv('ORACLE_DSN', 'localhost:1521/xe')
    }
    
    try:
        print("""
╔════════════════════════════════════════════════════════════════════════════╗
║              MushkilPay Database Preview Tool                              ║
║              View All Created Tables and Data                              ║
╚════════════════════════════════════════════════════════════════════════════╝
        """)
        
        print("🔗 Connecting to Oracle database...")
        conn = oracledb.connect(**db_config)
        print("✓ Connected successfully\n")
        
        cursor = conn.cursor()
        
        # ===== USERS TABLE =====
        print_header("1️⃣  USERS TABLE")
        display_table(cursor, "USERS")
        
        # ===== WALLETS TABLE =====
        print_header("2️⃣  WALLETS TABLE")
        display_table(cursor, "WALLETS")
        
        # ===== CARDS TABLE =====
        print_header("3️⃣  CARDS TABLE")
        display_table(cursor, "CARDS")
        
        # ===== ADMINS TABLE =====
        print_header("4️⃣  ADMINS TABLE")
        display_table(cursor, "ADMINS")
        
        # ===== NOTIFICATIONS TABLE =====
        print_header("5️⃣  NOTIFICATIONS TABLE")
        display_table(cursor, "NOTIFICATIONS")
        
        # ===== WITHDRAWAL_LIMITS TABLE =====
        print_header("6️⃣  WITHDRAWAL_LIMITS TABLE")
        display_table(cursor, "WITHDRAWAL_LIMITS")
        
        # ===== TRANSFERS TABLE =====
        print_header("7️⃣  TRANSFERS TABLE")
        display_table(cursor, "TRANSFERS")
        
        # ===== CARD_REQUESTS TABLE =====
        print_header("8️⃣  CARD_REQUESTS TABLE")
        display_table(cursor, "CARD_REQUESTS")
        
        # ===== CARD_PINS TABLE =====
        print_header("9️⃣  CARD_PINS TABLE")
        display_table(cursor, "CARD_PINS")
        
        # ===== TOPUP_REQUESTS TABLE =====
        print_header("🔟 TOPUP_REQUESTS TABLE")
        display_table(cursor, "TOPUP_REQUESTS")
        
        # ===== SUMMARY STATISTICS =====
        print_header("📊 DATABASE SUMMARY")
        
        cursor.execute("""
            SELECT 
                (SELECT COUNT(*) FROM USERS) as users_count,
                (SELECT COUNT(*) FROM WALLETS) as wallets_count,
                (SELECT COUNT(*) FROM CARDS) as cards_count,
                (SELECT COUNT(*) FROM ADMINS) as admins_count,
                (SELECT SUM(BALANCE) FROM WALLETS) as total_balance,
                (SELECT COUNT(*) FROM TRANSFERS) as transfers_count,
                (SELECT COUNT(*) FROM NOTIFICATIONS) as notifications_count
            FROM DUAL
        """)
        
        result = cursor.fetchone()
        
        stats = [
            ["👥 Total Users", result[0]],
            ["💼 Total Wallets", result[1]],
            ["💳 Total Cards", result[2]],
            ["👨‍💼 Total Admins", result[3]],
            ["💰 Total System Balance", f"PKR {result[4]:,.2f}" if result[4] else "0"],
            ["↔️  Total Transfers", result[5]],
            ["🔔 Total Notifications", result[6]]
        ]
        
        print(tabulate(stats, tablefmt="simple", showindex=False))
        
        # ===== VIEWS CHECK =====
        print_header("👁️  DATABASE VIEWS")
        
        cursor.execute("""
            SELECT VIEW_NAME 
            FROM USER_VIEWS 
            WHERE VIEW_NAME LIKE '%VIEW%' OR VIEW_NAME LIKE '%HISTORY%' OR VIEW_NAME LIKE '%SUMMARY%'
        """)
        
        views = cursor.fetchall()
        if views:
            for view in views:
                print(f"  ✓ {view[0]}")
        else:
            print("  (no views found)")
        
        # ===== TRIGGERS CHECK =====
        print_header("⚡ DATABASE TRIGGERS")
        
        cursor.execute("""
            SELECT TRIGGER_NAME 
            FROM USER_TRIGGERS 
            WHERE TRIGGER_NAME LIKE 'TRG_%'
        """)
        
        triggers = cursor.fetchall()
        if triggers:
            for trigger in triggers:
                print(f"  ✓ {trigger[0]}")
        else:
            print("  (no triggers found)")
        
        # ===== INDEXES CHECK =====
        print_header("🔍 DATABASE INDEXES")
        
        cursor.execute("""
            SELECT INDEX_NAME 
            FROM USER_INDEXES 
            WHERE TABLE_OWNER = USER() AND INDEX_TYPE = 'NORMAL'
        """)
        
        indexes = cursor.fetchall()
        if indexes:
            for idx in indexes:
                print(f"  ✓ {idx[0]}")
        else:
            print("  (no indexes found)")
        
        cursor.close()
        conn.close()
        
        print_header("✅ PREVIEW COMPLETE")
        print("\n🚀 Ready to start the backend and frontend servers!\n")
        
    except Exception as e:
        print(f"\n✗ Error: {e}\n")

if __name__ == '__main__':
    main()
