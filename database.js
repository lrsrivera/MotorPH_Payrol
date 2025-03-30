const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Store database in the project directory
const dbPath = path.join(__dirname, 'data', 'database.db');

// Create data directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Connected to SQLite database at", dbPath);
    }
});


// 📍 Function to Initialize Database Tables
function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS employees (
            employee_id TEXT PRIMARY KEY,
            last_name TEXT NOT NULL,
            first_name TEXT NOT NULL,
            birthday TEXT,
            address TEXT,
            phone_number TEXT,
            sss_number TEXT,
            philhealth_number TEXT,
            tin_number TEXT,
            pagibig_number TEXT,
            status TEXT,
            position TEXT,
            immediate_supervisor TEXT,
            basic_salary REAL,
            rice_subsidy REAL,
            phone_allowance REAL,
            clothing_allowance REAL,
            gross_semi_monthly_rate REAL,
            hourly_rate REAL,
            username TEXT UNIQUE,
            password TEXT
        )`, (err) => {
            if (err) {
                console.error("❌ Error creating employees table:", err.message);
            } else {
                console.log("✅ Employees table is ready.");
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT,
            date TEXT,
            year INTEGER GENERATED ALWAYS AS (CAST(strftime('%Y', date) AS INTEGER)) VIRTUAL,
            log_in TEXT,
            log_out TEXT,
            FOREIGN KEY(employee_id) REFERENCES employees(employee_id),
            UNIQUE(employee_id, date)
        )`, (err) => {
            if (err) {
                console.error("❌ Error creating attendance table:", err.message);
            } else {
                console.log("✅ Attendance table is ready.");
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS payroll_status (
            employee_id TEXT,
            year INTEGER,
            month INTEGER,
            released BOOLEAN DEFAULT 0,
            PRIMARY KEY (employee_id, year, month),
            FOREIGN KEY(employee_id) REFERENCES employees(employee_id)
        )`, (err) => {
            if (err) {
                console.error("❌ Error creating payroll_status table:", err.message);
            } else {
                console.log("✅ Payroll status table is ready.");
            }
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_employee_date 
                ON attendance(employee_id, year, date)`, (err) => {
            if (err) {
                console.error("❌ Error creating attendance index:", err.message);
            } else {
                console.log("✅ Attendance index is ready.");
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS archived_employees (
            employee_id TEXT PRIMARY KEY,
            last_name TEXT NOT NULL,
            first_name TEXT NOT NULL,
            position TEXT
        )`, (err) => {
            if (err) {
                console.error("❌ Error creating archived_employees table:", err.message);
            } else {
                console.log("✅ Archived Employees table is ready.");
            }
        });
    });
}

// 📍 Force Table Creation on App Start
initializeDatabase();

module.exports = db;
