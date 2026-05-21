#!/usr/bin/env python
"""
MushkilPay Database Schema Deployment Script
Deploys all database tables, triggers, and views
"""

import oracledb
import os
import sys

def execute_sql_file_smart(cursor, filename):
    """Execute SQL file with better handling of Oracle syntax"""
    print(f"\n{'='*60}")
    print(f"Executing: {filename}")
    print('='*60)
    
    try:
        with open(filename, 'r') as f:
            content = f.read()
        
        # Remove comments
        lines = []
        for line in content.split('\n'):
            if line.strip().startswith('--'):
                continue
            if '--' in line:
                line = line[:line.index('--')]
            lines.append(line)
        
        content = '\n'.join(lines)
        
        # Split on / (Oracle statement terminator) first
        statements = content.split('/')
        
        statement_count = 0
        for statement in statements:
            statement = statement.strip()
            
            if not statement:
                continue
            
            # Further split on ; if no / was used
            if ';' in statement:
                sub_statements = statement.split(';')
            else:
                sub_statements = [statement]
            
            for sub_stmt in sub_statements:
                sub_stmt = sub_stmt.strip()
                if not sub_stmt:
                    continue
                
                try:
                    statement_count += 1
                    cursor.execute(sub_stmt)
                    display_stmt = sub_stmt.replace('\n', ' ')[:50]
                    print(f"  [{statement_count}] {display_stmt}...")
                except oracledb.DatabaseError as e:
                    error_str = str(e)
                    if 'ORA-00955' in error_str or 'already exists' in error_str:
                        print(f"  [{statement_count}] (already exists, skipped)")
                    elif 'ORA-04043' in error_str or 'does not exist' in error_str:
                        print(f"  [{statement_count}] (object missing, skipped)")
                    else:
                        print(f"  ✗ ERROR: {e}")
                        raise
        
        print(f"✓ {filename}: {statement_count} statements executed")
        return True
        
    except FileNotFoundError:
        print(f"✗ File not found: {filename}")
        return False
    except Exception as e:
        print(f"✗ Error executing {filename}: {e}")
        return False

def main():
    # Load environment variables
    from dotenv import load_dotenv
    
    load_dotenv()
    
    # Database connection details from .env
    db_config = {
        'user': os.getenv('ORACLE_USER', 'c##wallet_user'),
        'password': os.getenv('ORACLE_PASSWORD', 'wallet_password_2026'),
        'dsn': os.getenv('ORACLE_DSN', 'localhost:1521/xe')
    }
    
    print("""
╔════════════════════════════════════════════════════════════╗
║     MushkilPay Database Schema Deployment Tool             ║
║     Creating Oracle Database Tables & Objects              ║
╚════════════════════════════════════════════════════════════╝
    """)
    
    # Connect to database
    try:
        print("🔗 Connecting to Oracle database...")
        print(f"   User: {db_config['user']}")
        conn = oracledb.connect(**db_config)
        print("✓ Connected successfully")
    except oracledb.DatabaseError as e:
        if 'ORA-28000' in str(e):
            print("\n✗ ACCOUNT LOCKED: The 'system' account is locked (ORA-28000)")
            print("\nTo fix this, you need SYSDBA access.")
            print("Contact your DBA or use:")
            print("  sqlplus sys/password@localhost:1521/xe as sysdba")
            print("  ALTER USER system ACCOUNT UNLOCK;")
            sys.exit(1)
        else:
            print(f"✗ Connection failed: {e}")
            sys.exit(1)
    
    try:
        cursor = conn.cursor()
        
        # List of SQL files to execute in order
        sql_files = [
            'database_schema.sql',
            'database_triggers_and_views.sql',
            'DATABASE_UPDATES.sql',
            'database_seed_data.sql'
        ]
        
        files_executed = 0
        # Execute each SQL file
        for sql_file in sql_files:
            if os.path.exists(sql_file):
                try:
                    if execute_sql_file_smart(cursor, sql_file):
                        files_executed += 1
                except Exception as e:
                    print(f"⚠ Error in {sql_file}, continuing...")
            else:
                print(f"⚠ File not found: {sql_file} (skipping)")
        
        # Commit all changes
        print(f"\n{'='*60}")
        print("Committing changes...")
        conn.commit()
        print("✓ All changes committed to database")
        
        # Verify installation
        print(f"\n{'='*60}")
        print("Verifying installation...")
        cursor.execute("""
            SELECT COUNT(*) as table_count 
            FROM USER_TABLES 
            WHERE TABLE_NAME IN ('USERS', 'WALLETS', 'CARDS', 'TRANSFERS', 'ADMINS', 
                                'NOTIFICATIONS', 'CARD_REQUESTS', 'CARD_PINS', 
                                'WITHDRAWAL_LIMITS', 'TOPUP_REQUESTS')
        """)
        result = cursor.fetchone()
        table_count = result[0] if result else 0
        
        print(f"✓ Found {table_count}/10 tables created")
        
        if table_count >= 10:
            print("\n✅ ALL TABLES CREATED SUCCESSFULLY!")
        elif table_count >= 5:
            print(f"\n⚠ Partial deployment: {table_count}/10 tables")
        else:
            print(f"\n❌ Deployment incomplete: {table_count}/10 tables")
        
        cursor.close()
        conn.close()
        
        print(f"\n{'='*60}\n")
        
    except Exception as e:
        print(f"\n✗ Deployment failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
