import sqlite3

conn = sqlite3.connect('backend/healthcare_records.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

# 1. Update users table for usr-pat-101
c.execute("""
    UPDATE users 
    SET full_name = 'Keerthana', email = 'sankeerthana2905@gmail.com'
    WHERE id = 'usr-pat-101' OR email = 'sankeerthana2905@gmail.com'
""")
print(f"Updated {c.rowcount} row(s) in users")

# 2. Update patient_profiles table for pat-101
c.execute("""
    UPDATE patient_profiles 
    SET full_name = 'Keerthana', email = 'sankeerthana2905@gmail.com'
    WHERE id = 'pat-101' OR user_id = 'usr-pat-101' OR email = 'sankeerthana2905@gmail.com'
""")
print(f"Updated {c.rowcount} row(s) in patient_profiles")

# 3. Update existing appointments for pat-101 where applicable
c.execute("""
    UPDATE appointments 
    SET patient_name = 'Keerthana', patient_email = 'sankeerthana2905@gmail.com'
    WHERE patient_id IN ('pat-101', 'usr-pat-101') AND patient_email = 'sankeerthana2905@gmail.com'
""")
print(f"Updated {c.rowcount} row(s) in appointments")

conn.commit()

# Verify
c.execute("SELECT id, email, full_name, role FROM users WHERE id = 'usr-pat-101'")
print("Verified user:", dict(c.fetchone()))

c.execute("SELECT id, email, full_name FROM patient_profiles WHERE id = 'pat-101'")
print("Verified profile:", dict(c.fetchone()))

conn.close()
