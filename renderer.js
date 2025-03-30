const { ipcRenderer } = require('electron');
const path = require('path');

let employeeFilePath = null;
let attendanceFilePath = null;

console.log("✅ renderer.js loaded!");

// ===============================
// 1) Open Dialog for Employee File
// ===============================
function openEmployeeFileDialog() {
  ipcRenderer.send('open-employee-file-dialog');
}

ipcRenderer.on('employee-file-selected', (event, filePath) => {
  if (!filePath) {
    alert("No file selected for Employee Details!");
    employeeFilePath = null;
    document.getElementById('employeeFileName').textContent = "No file chosen";
    return;
  }
  employeeFilePath = filePath;
  document.getElementById('employeeFileName').textContent = path.basename(filePath);
  console.log("Employee file selected:", employeeFilePath);
});

// ===============================
// 2) Import Employees
// ===============================
function importEmployeeDetails() {
  if (!employeeFilePath) {
    alert("Please select an Employee Details file first!");
    return;
  }
  ipcRenderer.send('import-employees', employeeFilePath);
}

ipcRenderer.on('import-employees-response', (event, response) => {
  if (response.success) {
    alert(`✅ Imported ${response.added} employees successfully!`);
    loadEmployees();
    resetForm();
  } else {
    alert("❌ Import employees failed: " + response.error);
  }
});

// ===============================
// 3) Open Dialog for Attendance File
// ===============================
function openAttendanceFileDialog() {
  ipcRenderer.send('open-attendance-file-dialog');
}

ipcRenderer.on('attendance-file-selected', (event, filePath) => {
  if (!filePath) {
    alert("No file selected for Attendance!");
    attendanceFilePath = null;
    document.getElementById('attendanceFileName').textContent = "No file chosen";
    return;
  }
  attendanceFilePath = filePath;
  document.getElementById('attendanceFileName').textContent = path.basename(filePath);
  console.log("Attendance file selected:", attendanceFilePath);
});

// ===============================
// 4) Import Attendance
// ===============================
function importAttendance() {
  if (!attendanceFilePath) {
    alert("Please select an Attendance file first!");
    return;
  }
  ipcRenderer.send('import-attendance', attendanceFilePath);
}

ipcRenderer.on('import-attendance-response', (event, response) => {
  if (response.success) {
    alert(`✅ Attendance imported successfully! Added: ${response.added}`);
  } else {
    alert("❌ Import attendance failed: " + response.error);
  }
});

// ===============================
// 5) Load Employees
// ===============================
function loadEmployees() {
  ipcRenderer.send('get-employees');
}

ipcRenderer.on('get-employees-response', (event, employees) => {
  const table = document.getElementById("employeeTable");
  if (!table) return;
  table.innerHTML = "";
  employees.forEach(emp => {
    const row = `
      <tr>
        <td>${emp.employee_id}</td>
        <td>${emp.last_name}</td>
        <td>${emp.first_name}</td>
        <td>${emp.birthday || ''}</td>
        <td>${emp.position}</td>
        <td><button onclick="viewEmployee('${emp.employee_id}')">View</button></td>
        <td><button onclick="removeEmployee('${emp.employee_id}')">Remove</button></td>
      </tr>`;
    table.innerHTML += row;
  });
});

// ===============================
// 6) Remove Employee
// ===============================
function removeEmployee(employeeId) {
  if (confirm("Are you sure you want to remove this employee?")) {
    ipcRenderer.send('remove-employee', employeeId);
  }
}

ipcRenderer.on('remove-employee-response', (event, response) => {
  if (response.success) {
    alert("✅ Employee removed.");
    loadEmployees();
  } else {
    alert("❌ Error removing employee: " + response.error);
  }
});

// ===============================
// 7) Add Employee Form
// ===============================
window.onload = () => {
  loadEmployees(); // Load employees on start

  const form = document.getElementById('employeeForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const employee = {
        employee_id: document.getElementById('employee_id').value,
        last_name: document.getElementById('last_name').value,
        first_name: document.getElementById('first_name').value,
        birthday: document.getElementById('birthday').value,
        address: document.getElementById('address').value,
        phone_number: document.getElementById('phone_number').value,
        sss_number: document.getElementById('sss_number').value,
        philhealth_number: document.getElementById('philhealth_number').value,
        tin_number: document.getElementById('tin_number').value,
        pagibig_number: document.getElementById('pagibig_number').value,
        status: document.getElementById('status').value,
        position: document.getElementById('position').value,
        immediate_supervisor: document.getElementById('immediate_supervisor').value,
        basic_salary: parseFloat(document.getElementById('basic_salary').value) || 0,
        rice_subsidy: parseFloat(document.getElementById('rice_subsidy').value) || 0,
        phone_allowance: parseFloat(document.getElementById('phone_allowance').value) || 0,
        clothing_allowance: parseFloat(document.getElementById('clothing_allowance').value) || 0,
        gross_semi_monthly_rate: parseFloat(document.getElementById('gross_semi_monthly_rate').value) || 0,
        hourly_rate: 0,
        username: document.getElementById('employee_id').value,
        password: "password"
      };
      ipcRenderer.send('add-employee', employee);
    });
  }
};

ipcRenderer.on('add-employee-response', (event, response) => {
  if (response.success) {
    alert("✅ Employee added!");
    resetForm();
    loadEmployees();
  } else {
    alert("❌ Failed to add employee: " + response.error);
  }
});

// ===============================
// 8) Reset Form
// ===============================
function resetForm() {
  const form = document.getElementById('employeeForm');
  if (form) form.reset();
}

// Function to refresh employee list
function refreshEmployeeList(employees) {
    const tbody = document.getElementById('employeeList');
    tbody.innerHTML = '';
    employees.forEach(emp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${emp.employee_id}</td>
            <td>${emp.last_name}</td>
            <td>${emp.first_name}</td>
            <td>${emp.birthday || ''}</td>
            <td>${emp.position}</td>
            <td><button onclick="viewEmployee('${emp.employee_id}')">View</button></td>
            <td><button onclick="removeEmployee('${emp.employee_id}')">Remove</button></td>
        `;
        tbody.appendChild(row);
    });
}
