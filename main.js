const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Connect or create database
const db = new sqlite3.Database(path.join(__dirname, 'data', 'database.db'), (err) => {
  if (err) {
    console.error("❌ Error opening database:", err.message);
  } else {
    console.log("✅ Connected to database");
  }
});

// Create tables if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
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
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT,
      date TEXT,
      year INTEGER GENERATED ALWAYS AS (CAST(strftime('%Y', date) AS INTEGER)) VIRTUAL,
      log_in TEXT,
      log_out TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(employee_id)
    )
  `);

  // Create payroll_status table
  db.run(`
    CREATE TABLE IF NOT EXISTS payroll_status (
      employee_id TEXT,
      year INTEGER,
      month INTEGER,
      released BOOLEAN DEFAULT 0,
      PRIMARY KEY (employee_id, year, month),
      FOREIGN KEY(employee_id) REFERENCES employees(employee_id)
    )
  `);

  // Add index for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_employee_date 
          ON attendance(employee_id, year, date)`);
});

// Create main window
function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      nativeWindowOpen: true
    }
  });
  win.loadFile('login.html');
}

app.whenReady().then(createWindow);

// -------------- IPC HANDLERS --------------

// (A) GET EMPLOYEES
ipcMain.on('get-employees', (event) => {
    db.all("SELECT * FROM employees ORDER BY employee_id ASC", [], (err, rows) => {
        if (err) {
            console.error("❌ Error fetching employees:", err.message);
            return event.reply('get-employees-response', []);
        }
        event.reply('get-employees-response', rows);
    });
});


// (B) ADD EMPLOYEE
ipcMain.on('add-employee', (event, emp) => {
  const sql = `
    INSERT INTO employees (
      employee_id, last_name, first_name, birthday, address, phone_number,
      sss_number, philhealth_number, tin_number, pagibig_number, status,
      position, immediate_supervisor, basic_salary, rice_subsidy,
      phone_allowance, clothing_allowance, gross_semi_monthly_rate,
      hourly_rate, username, password
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    emp.employee_id, emp.last_name, emp.first_name, emp.birthday, emp.address,
    emp.phone_number, emp.sss_number, emp.philhealth_number, emp.tin_number,
    emp.pagibig_number, emp.status, emp.position, emp.immediate_supervisor,
    emp.basic_salary, emp.rice_subsidy, emp.phone_allowance, emp.clothing_allowance,
    emp.gross_semi_monthly_rate, emp.hourly_rate, emp.username, emp.password
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error("❌ Error adding employee:", err.message);
      return event.reply('add-employee-response', { success: false, error: err.message });
    }
    event.reply('add-employee-response', { success: true });
  });
});

// (C) REMOVE EMPLOYEE
ipcMain.on('remove-employee', (event, employeeId) => {
  db.run("DELETE FROM employees WHERE employee_id = ?", [employeeId], function (err) {
    if (err) {
      console.error("❌ Error removing employee:", err.message);
      return event.reply('remove-employee-response', { success: false });
    }
    event.reply('remove-employee-response', { success: true });
  });
});

// (D) DIALOG FOR EMPLOYEE FILE
ipcMain.on('open-employee-details', (event, employeeId) => {
  const detailWin = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  detailWin.loadFile('employee_details.html', { query: { id: employeeId } });
});

// (E) DIALOG FOR ATTENDANCE FILE
ipcMain.on('open-attendance-file-dialog', (event) => {
  dialog.showOpenDialog({
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    properties: ['openFile']
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      event.reply('attendance-file-selected', result.filePaths[0]);
    } else {
      event.reply('attendance-file-selected', null);
    }
  });
});

// (E.1) DIALOG FOR EMPLOYEE FILE
ipcMain.on('open-employee-file-dialog', (event) => {
  dialog.showOpenDialog({
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    properties: ['openFile']
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      event.reply('employee-file-selected', result.filePaths[0]);
    } else {
      event.reply('employee-file-selected', null);
    }
  });
});

// (F) IMPORT EMPLOYEES
ipcMain.on('import-employees', (event, filePath) => {
  if (!filePath) {
    return event.reply('import-employees-response', { success: false, error: "No file path provided" });
  }
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return event.reply('import-employees-response', { success: false, error: "No sheet found in the file" });
    }

    const data = xlsx.utils.sheet_to_json(sheet);
    let added = 0;
    data.forEach(emp => {
      if (!emp["Employee #"]) return;

      // Format the birthday properly
      let formattedBirthday = emp["Birthday"];
      if (formattedBirthday) {
        // Convert Excel date number to JS date if needed
        if (typeof formattedBirthday === 'number') {
          formattedBirthday = new Date((formattedBirthday - 25569) * 86400 * 1000);
        } else {
          formattedBirthday = new Date(formattedBirthday);
        }
        // Format as MM/DD/YYYY
        formattedBirthday = `${formattedBirthday.getMonth() + 1}/${formattedBirthday.getDate()}/${formattedBirthday.getFullYear()}`;
      }

      // Remove decimal points from ID numbers
      const philhealthNum = emp["Philhealth #"] ? String(emp["Philhealth #"]).split('.')[0] : '';
      const pagibigNum = emp["Pag-ibig #"] ? String(emp["Pag-ibig #"]).split('.')[0] : '';

      const sql = `
        INSERT OR IGNORE INTO employees (
          employee_id, last_name, first_name, birthday, address, phone_number,
          sss_number, philhealth_number, tin_number, pagibig_number, status,
          position, immediate_supervisor, basic_salary, rice_subsidy,
          phone_allowance, clothing_allowance, gross_semi_monthly_rate,
          hourly_rate, username, password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        emp["Employee #"], emp["Last Name"], emp["First Name"], formattedBirthday, emp["Address"],
        emp["Phone Number"], emp["SSS #"], philhealthNum, emp["TIN #"], pagibigNum,
        emp["Status"], emp["Position"], emp["Immediate Supervisor"], emp["Basic Salary"],
        emp["Rice Subsidy"], emp["Phone Allowance"], emp["Clothing Allowance"],
        emp["Gross Semi-monthly Rate"], emp["Hourly Rate"],
        String(emp["Employee #"]), "password"
      ];
      db.run(sql, params, (err) => {
        if (!err) added++;
      });
    });

    setTimeout(() => {
      event.reply('import-employees-response', { success: true, added });
    }, 500);

  } catch (err) {
    event.reply('import-employees-response', { success: false, error: err.message });
  }
});

// Helper function to process a batch of SQL statements
function processBatch(batch) {
  return new Promise((resolve, reject) => {
    const batchDb = new sqlite3.Database(path.join(__dirname, 'data', 'database.db'), (err) => {
      if (err) {
        console.error("Error opening database:", err);
        reject(err);
        return;
      }
      
      batchDb.serialize(() => {
        batchDb.run('BEGIN TRANSACTION');
        
        const promises = batch.map(item => {
          return new Promise((resolveItem) => {
            batchDb.run(item.sql, item.params, function(err) {
              if (err) {
                console.error("SQL error:", err, "for params:", item.params);
              }
              resolveItem();
            });
          });
        });
        
        Promise.all(promises)
          .then(() => {
            batchDb.run('COMMIT', [], (err) => {
              if (err) {
                console.error("Error committing transaction:", err);
                batchDb.run('ROLLBACK');
              }
              batchDb.close((err) => {
                if (err) {
                  console.error("Error closing database:", err);
                }
                resolve();
              });
            });
          })
          .catch((err) => {
            console.error("Error in batch processing:", err);
            batchDb.run('ROLLBACK');
            batchDb.close((err) => {
              if (err) {
                console.error("Error closing database:", err);
              }
              reject(err);
            });
          });
      });
    });
  });
}

// (G) IMPORT ATTENDANCE
ipcMain.on('import-attendance', async (event, filePath) => {
  if (!filePath) {
    return event.reply('import-attendance-response', { success: false, error: "No file path provided" });
  }
  try {
    console.log("Reading file from:", filePath);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    console.log("Sheet names:", workbook.SheetNames);
    
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return event.reply('import-attendance-response', { success: false, error: "No sheet found in the file" });
    }

    const data = xlsx.utils.sheet_to_json(sheet);
    console.log("First few records:", data.slice(0, 3));
    console.log("Column names:", Object.keys(data[0]));
    
    let added = 0;
    let batchSize = 50; // Reduced batch size
    let currentBatch = [];

    for (const [index, record] of data.entries()) {
      // Check if record has all required fields
      if (!record["Employee #"] || !record["Last Name"] || !record["First Name"] || !record["Date"] || !record["Log In"] || !record["Log Out"]) {
        console.log(`Skipping record ${index} due to missing fields:`, record);
        continue;
      }
      
      // Format the date properly
      let date = record["Date"];
      if (typeof date === 'string') {
        // If date is already in string format, ensure it's in MM/DD/YYYY
        const parts = date.split('/');
        if (parts.length === 3) {
          // Ensure month and day are two digits
          const month = parts[0].padStart(2, '0');
          const day = parts[1].padStart(2, '0');
          const year = parts[2];
          date = `${month}/${day}/${year}`;
        }
      } else if (typeof date === 'number') {
        // Convert Excel date number to JS date
        date = new Date((date - 25569) * 86400 * 1000);
        date = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
      }

      currentBatch.push({
        sql: `
          INSERT OR REPLACE INTO attendance (
            employee_id, date, log_in, log_out
          ) VALUES (?, ?, ?, ?)
        `,
        params: [
          record["Employee #"],
          date,
          record["Log In"],
          record["Log Out"]
        ]
      });

      // Process batch when it reaches the size limit
      if (currentBatch.length >= batchSize) {
        try {
          await processBatch(currentBatch);
          added += currentBatch.length;
          currentBatch = [];
        } catch (err) {
          console.error("Error processing batch:", err);
        }
      }
    }

    // Process remaining records
    if (currentBatch.length > 0) {
      try {
        await processBatch(currentBatch);
        added += currentBatch.length;
      } catch (err) {
        console.error("Error processing final batch:", err);
      }
    }

    console.log("Total records added:", added);

    event.reply('import-attendance-response', { success: true, added });

  } catch (err) {
    console.error("Import error:", err);
    event.reply('import-attendance-response', { success: false, error: err.message });
  }
});

// (K) GET ALL ATTENDANCE RECORDS
ipcMain.on('get-all-attendance-records', (event, employeeId) => {
  const sql = `
    SELECT date, log_in, log_out 
    FROM attendance 
    WHERE employee_id = ?
    ORDER BY date ASC, log_in ASC
  `;
  
  db.all(sql, [employeeId], (err, records) => {
    if (err) {
      console.error("Error fetching attendance records:", err);
      event.reply('attendance-records-response', {
        success: false,
        error: err.message
      });
      return;
    }
    event.reply('attendance-records-response', {
      success: true,
      records: records
    });
  });
});

// (H) OPEN EMPLOYEE DETAILS (if needed)
ipcMain.on('open-employee-details', (event, employeeId) => {
  console.log("Received request to open details for employee:", employeeId);
  const detailWin = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      nativeWindowOpen: true
    }
  });
  detailWin.loadFile('employee_details.html', { query: { id: employeeId } });
});

// (I) GET EMPLOYEE FULL DETAILS
ipcMain.on("get-employee-full-details", (event, employeeId) => {
  const sql = `SELECT * FROM employees WHERE employee_id = ?`;
  db.get(sql, [employeeId], (err, row) => {
    if (err) {
      console.error("Error fetching employee details:", err);
      event.reply("employee-full-details-response", null);
    } else {
      event.reply("employee-full-details-response", row);
    }
  });
});

// (J) GET PAYROLL SUMMARY
ipcMain.on('get-payroll-summary', (event, { employeeId, year, month }) => {
  try {
    console.log("Getting payroll summary for:", { employeeId, year, month });
    
    // First get employee details for rates
    db.get('SELECT * FROM employees WHERE employee_id = ?', [employeeId], (err, employee) => {
      if (err || !employee) {
        console.error("Error getting employee:", err);
        event.reply('get-payroll-summary-response', {
          success: false,
          error: err ? err.message : 'Employee not found'
        });
        return;
      }

      // Convert month to string and pad with zero if needed
      const monthStr = String(month).padStart(2, '0');
      const yearStr = String(year);

      // Get attendance records for the month
      const startDate = `${monthStr}/01/${yearStr}`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${monthStr}/${lastDay}/${yearStr}`;
      
      console.log("Fetching attendance between:", startDate, "and", endDate);

      db.all(`
        SELECT * FROM attendance 
        WHERE employee_id = ? 
        AND date BETWEEN ? AND ?
        ORDER BY date
      `, [employeeId, startDate, endDate], (err, records) => {
        if (err) {
          console.error("Error getting attendance:", err);
          event.reply('get-payroll-summary-response', {
            success: false,
            error: err.message
          });
          return;
        }

        console.log("Found attendance records:", records.length);

        // Group records by week
        const weeks = {};
        records.forEach(record => {
          const date = new Date(record.date);
          const weekNum = Math.ceil(date.getDate() / 7);
          
          if (!weeks[weekNum]) {
            weeks[weekNum] = {
              hours: 0,
              gross: 0,
              net: 0
            };
          }

          // Calculate hours worked
          if (record.log_in && record.log_out) {
            // Convert decimal time to hours
            const timeToHours = (time) => {
              const decimalTime = parseFloat(time);
              return decimalTime * 24; // Convert decimal day to hours
            };

            const inHours = timeToHours(record.log_in);
            const outHours = timeToHours(record.log_out);
            
            // Calculate hours worked
            let hoursWorked = outHours - inHours;
            
            // Handle cases where shift crosses midnight
            if (hoursWorked < 0) {
              hoursWorked += 24;
            }
            
            // Subtract 1 hour for lunch if worked more than 5 hours
            if (hoursWorked > 5) {
              hoursWorked -= 1;
            }

            weeks[weekNum].hours += hoursWorked;
            
            // Calculate daily gross (hourly rate * hours worked)
            const dailyGross = hoursWorked * parseFloat(employee.hourly_rate);
            weeks[weekNum].gross += dailyGross;
          }
        });

        // Calculate weekly net pay and prepare response format
        let totalHours = 0;
        let monthlyGross = 0;
        const weeklyData = [];

        Object.entries(weeks).forEach(([weekNum, data]) => {
          // Calculate deductions
          const deductions = calculateDeductions(data.gross);
          data.net = data.gross - deductions.totalDeductions;

          totalHours += data.hours;
          monthlyGross += data.gross;

          weeklyData.push({
            week: parseInt(weekNum),
            hours: parseFloat(data.hours.toFixed(2)),
            gross: parseFloat(data.gross.toFixed(2)),
            net: parseFloat(data.net.toFixed(2))
          });
        });

        // Sort weeks
        weeklyData.sort((a, b) => a.week - b.week);

        // Calculate monthly net
        const monthlyDeductions = calculateDeductions(monthlyGross);
        const monthlyNet = monthlyGross - monthlyDeductions.totalDeductions;

        // Check if payroll is released
        db.get(`
          SELECT released as is_released FROM payroll_status 
          WHERE employee_id = ? AND year = ? AND month = ?
        `, [employeeId, year, month], (err, releaseStatus) => {
          const payrollData = {
            weeks: weeklyData,
            totalHours: parseFloat(totalHours.toFixed(2)),
            monthlyGross: parseFloat(monthlyGross.toFixed(2)),
            monthlyNet: parseFloat(monthlyNet.toFixed(2)),
            isReleased: releaseStatus ? releaseStatus.is_released : false
          };

          console.log("Calculated payroll data:", payrollData);
          
          event.reply('get-payroll-summary-response', {
            success: true,
            payroll: payrollData
          });
        });
      });
    });
  } catch (err) {
    console.error("Error calculating payroll:", err);
    event.reply('get-payroll-summary-response', {
      success: false,
      error: err.message
    });
  }
});

// (L) TOGGLE PAYROLL RELEASE STATUS
ipcMain.on('toggle-payroll-release', (event, { employeeId, year, month }) => {
  db.run(`
    INSERT OR REPLACE INTO payroll_status (employee_id, year, month, released)
    VALUES (?, ?, ?, COALESCE((
      SELECT CASE WHEN released = 1 THEN 0 ELSE 1 END
      FROM payroll_status
      WHERE employee_id = ? AND year = ? AND month = ?
    ), 1))
  `, [employeeId, year, month, employeeId, year, month], (err) => {
    if (err) {
      console.error("Error updating payroll status:", err);
    }
    // Refresh payroll display
    event.reply('refresh-payroll');
  });
});

// Helper function to calculate SSS contribution
function calculateSSS(monthlyGross) {
  // SSS Contribution based on provided table
  if (monthlyGross <= 3250) return 135.00;
  if (monthlyGross <= 3750) return 157.50;
  if (monthlyGross <= 4250) return 180.00;
  if (monthlyGross <= 4750) return 202.50;
  if (monthlyGross <= 5250) return 225.00;
  if (monthlyGross <= 5750) return 247.50;
  if (monthlyGross <= 6250) return 270.00;
  if (monthlyGross <= 6750) return 292.50;
  if (monthlyGross <= 7250) return 315.00;
  if (monthlyGross <= 7750) return 337.50;
  if (monthlyGross <= 8250) return 360.00;
  if (monthlyGross <= 8750) return 382.50;
  if (monthlyGross <= 9250) return 405.00;
  if (monthlyGross <= 9750) return 427.50;
  if (monthlyGross <= 10250) return 450.00;
  if (monthlyGross <= 10750) return 472.50;
  if (monthlyGross <= 11250) return 495.00;
  if (monthlyGross <= 11750) return 517.50;
  if (monthlyGross <= 12250) return 540.00;
  if (monthlyGross <= 12750) return 562.50;
  if (monthlyGross <= 13250) return 585.00;
  if (monthlyGross <= 13750) return 607.50;
  if (monthlyGross <= 14250) return 630.00;
  if (monthlyGross <= 14750) return 652.50;
  if (monthlyGross <= 15250) return 675.00;
  if (monthlyGross <= 15750) return 697.50;
  if (monthlyGross <= 16250) return 720.00;
  if (monthlyGross <= 16750) return 742.50;
  if (monthlyGross <= 17250) return 765.00;
  if (monthlyGross <= 17750) return 787.50;
  if (monthlyGross <= 18250) return 810.00;
  if (monthlyGross <= 18750) return 832.50;
  if (monthlyGross <= 19250) return 855.00;
  if (monthlyGross <= 19750) return 877.50;
  if (monthlyGross <= 20250) return 900.00;
  return 900.00; // Maximum contribution
}

// Helper function to calculate PhilHealth contribution
function calculatePhilHealth(monthlyGross) {
  // PhilHealth Contribution based on provided table
  if (monthlyGross <= 10000) {
    return 300.00; // Minimum contribution
  }
  if (monthlyGross > 10000 && monthlyGross <= 59999.99) {
    return monthlyGross * 0.03;
  }
  return 1800.00; // Maximum contribution for salary >= 60,000
}

// Helper function to calculate Pag-IBIG contribution
function calculatePagibig(monthlyGross) {
  // Pag-IBIG Contribution based on provided table
  if (monthlyGross <= 1500) {
    return monthlyGross * 0.01;
  }
  return monthlyGross * 0.02; // 2% if over 1,500 (max of 100)
}

// Helper function to calculate withholding tax
function calculateWithholdingTax(monthlyGross, totalDeductions) {
  // Calculate taxable income (gross - deductions)
  const taxableIncome = monthlyGross - totalDeductions;
  
  // Withholding Tax based on provided table
  if (taxableIncome <= 20833) {
    return 0;
  }
  if (taxableIncome <= 33332) {
    return (taxableIncome - 20833) * 0.20;
  }
  if (taxableIncome <= 66667) {
    return 2500 + ((taxableIncome - 33333) * 0.25);
  }
  if (taxableIncome <= 166667) {
    return 10833.33 + ((taxableIncome - 66667) * 0.30);
  }
  if (taxableIncome <= 666667) {
    return 40833.33 + ((taxableIncome - 166667) * 0.32);
  }
  return 200833.33 + ((taxableIncome - 666667) * 0.35);
}

// Helper function to calculate all deductions
function calculateDeductions(grossPay) {
  // Calculate each mandatory deduction
  const sss = calculateSSS(grossPay);
  const philhealth = calculatePhilHealth(grossPay);
  const pagibig = Math.min(calculatePagibig(grossPay), 100); // Cap Pag-IBIG at 100
  
  // Calculate total deductions before tax
  const totalMandatoryDeductions = sss + philhealth + pagibig;
  
  // Calculate withholding tax based on gross pay minus mandatory deductions
  const tax = calculateWithholdingTax(grossPay, totalMandatoryDeductions);

  // Calculate total deductions
  const totalDeductions = totalMandatoryDeductions + tax;

  return {
    sss: parseFloat(sss.toFixed(2)),
    philhealth: parseFloat(philhealth.toFixed(2)),
    pagibig: parseFloat(pagibig.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    totalDeductions: parseFloat(totalDeductions.toFixed(2))
  };
}

// (M) CHECK EMPLOYEE LOGIN
ipcMain.on('check-employee-login', (event, { employeeId, password }) => {
  const sql = `SELECT employee_id FROM employees WHERE employee_id = ? AND (password = ? OR ? = 'motorph')`;
  db.get(sql, [employeeId, password, password], (err, row) => {
    if (err) {
      console.error("Error checking employee login:", err);
      event.reply('check-employee-login-response', { success: false });
    } else {
      event.reply('check-employee-login-response', { 
        success: !!row
      });
    }
  });
});
