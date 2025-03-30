# MotorPH Payroll System

A payroll management system for MotorPH built with Electron.js.

## Features
- Employee Management
- Attendance Tracking
- Payroll Generation
- Government Deductions (SSS, PhilHealth, Pag-IBIG, Tax)
- HR Dashboard
- Employee Portal

## Demo Database
The repository includes a pre-populated database (`data/database.db`) with sample:
- Employee records
- Attendance data
- Payroll history
You can use this to test the system without importing data.

## Setup Instructions

### Option 1: Run from Source
1. Install Node.js from https://nodejs.org/ (LTS version recommended)
2. Clone this repository:
```bash
git clone https://github.com/YOUR_USERNAME/MotorPH_Payroll.git
cd MotorPH_Payroll
```
3. Install dependencies:
```bash
npm install
```
4. Start the application:
```bash
npm start
```

### Option 2: Download and Run
1. Install Node.js from https://nodejs.org/ (LTS version recommended)
2. Download and extract the ZIP file from GitHub
3. Open a terminal/command prompt in the extracted folder
4. Install dependencies:
```bash
npm install
```
5. Start the application:
```bash
npm start
```

## Default Credentials
- HR Login: Use any employee ID with password "motorph"
- Employee Login: Use employee ID as both username and password

## Data Management
- The database is stored in the `data` folder
- Employee and attendance data can be imported through Excel files
- The database will persist unless manually deleted
- Sample Excel files for importing data are provided in the `sample_data` folder

## Development
This project uses:
- Electron.js for the desktop application
- SQLite3 for the database
- XLSX for Excel file handling
- Custom CSS for the Frutiger Aero-inspired design

## Note
This is a school project developed for educational purposes. 