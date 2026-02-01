"""
Migration script to add schedule fields to playlist_assets table
"""
import sqlite3
import os

# Find the database - it's in the project root, not backend folder
db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'screensplash.db')
db_path = os.path.abspath(db_path)

print(f"Database path: {db_path}")

if not os.path.exists(db_path):
    print("Database not found!")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check existing columns
cursor.execute("PRAGMA table_info(playlist_assets)")
existing_columns = [row[1] for row in cursor.fetchall()]
print(f"Existing columns: {existing_columns}")

# Add new columns if they don't exist
new_columns = [
    ('schedule_start_time', 'TEXT'),
    ('schedule_end_time', 'TEXT'),
    ('schedule_days', 'TEXT'),
    ('schedule_start_date', 'TEXT'),
    ('schedule_end_date', 'TEXT'),
]

for col_name, col_type in new_columns:
    if col_name not in existing_columns:
        print(f"Adding column: {col_name}")
        cursor.execute(f"ALTER TABLE playlist_assets ADD COLUMN {col_name} {col_type}")
    else:
        print(f"Column already exists: {col_name}")

conn.commit()
conn.close()

print("Migration complete!")
