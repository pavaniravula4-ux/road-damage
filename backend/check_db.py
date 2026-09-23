import sqlite3

conn = sqlite3.connect("roadguard.db")
cursor = conn.cursor()

# Show tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
print("Tables:", cursor.fetchall())

# Show columns in user table
cursor.execute("PRAGMA table_info(user);")
print("User table columns:", cursor.fetchall())

conn.close()
