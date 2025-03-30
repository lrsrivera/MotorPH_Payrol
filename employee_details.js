const { ipcRenderer } = require('electron');

// Get employee ID from URL query string (e.g., employee_details.html?id=10001)
const urlParams = new URLSearchParams(window.location.search);
const employeeId = urlParams.get("id");
console.log("Employee ID from query:", employeeId);

if (!employeeId) {
  alert("No employee ID provided.");
}

window.onload = () => {
  if (!employeeId) {
    alert("No employee ID provided.");
    return;
  }
  
  // Initialize year dropdown
  populateYearDropdown();
  
  // Set June 2024 as default
  document.getElementById('payrollYear').value = "2024";
  document.getElementById('payrollMonth').value = "6"; // June is month 6
  
  // Load initial data
  loadEmployeeDetails();
  loadPayroll();
};

// Populate year dropdown
function populateYearDropdown() {
  const years = [];
  for (let year = 2024; year <= 2050; year++) {
    years.push(year);
  }
  
  const payrollSelect = document.getElementById('payrollYear');
  payrollSelect.innerHTML = '';
  
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    if (year === 2024) option.selected = true;  // Set 2024 as selected by default
    payrollSelect.appendChild(option);
  });
}

// Load employee details
function loadEmployeeDetails() {
  ipcRenderer.send("get-employee-full-details", employeeId);
}

// View attendance records
function viewAttendance() {
  ipcRenderer.send('get-all-attendance-records', employeeId);
}

// Load payroll data
function loadPayroll() {
  const year = document.getElementById('payrollYear').value;
  const month = document.getElementById('payrollMonth').value;
  ipcRenderer.send('get-payroll-summary', { employeeId, year, month });
}

// Listen for employee details response
ipcRenderer.on("employee-full-details-response", (event, emp) => {
  console.log("Employee details received:", emp);
  if (!emp) {
    alert("Employee details not found.");
    return;
  }
  document.getElementById("emp_id").textContent = emp.employee_id;
  document.getElementById("emp_name").textContent = `${emp.first_name} ${emp.last_name}`;
  document.getElementById("emp_position").textContent = emp.position;
  document.getElementById("emp_status").textContent = emp.status;
  
  // Populate full details in the collapsible section
  document.getElementById("details").innerHTML = `
    <p><label>Birthday:</label> ${emp.birthday}</p>
    <p><label>Address:</label> ${emp.address}</p>
    <p><label>Phone Number:</label> ${emp.phone_number}</p>
    <p><label>SSS #:</label> ${emp.sss_number}</p>
    <p><label>Philhealth #:</label> ${emp.philhealth_number}</p>
    <p><label>TIN #:</label> ${emp.tin_number}</p>
    <p><label>Pag-IBIG #:</label> ${emp.pagibig_number}</p>
    <p><label>Immediate Supervisor:</label> ${emp.immediate_supervisor}</p>
    <p><label>Basic Salary:</label> ₱${parseFloat(emp.basic_salary).toFixed(2)}</p>
    <p><label>Rice Subsidy:</label> ₱${parseFloat(emp.rice_subsidy).toFixed(2)}</p>
    <p><label>Phone Allowance:</label> ₱${parseFloat(emp.phone_allowance).toFixed(2)}</p>
    <p><label>Clothing Allowance:</label> ₱${parseFloat(emp.clothing_allowance).toFixed(2)}</p>
    <p><label>Gross Semi-monthly Rate:</label> ₱${parseFloat(emp.gross_semi_monthly_rate).toFixed(2)}</p>
    <p><label>Hourly Rate:</label> ₱${parseFloat(emp.hourly_rate).toFixed(2)}</p>
  `;
});

// Listen for payroll summary response
ipcRenderer.on("get-payroll-summary-response", (event, response) => {
  console.log("Payroll summary received:", response);
  if (!response.success) {
    alert("Failed to load payroll summary: " + response.error);
    return;
  }
  displayPayroll(response.payroll);
});

// Function to display payroll summary
function displayPayroll(payrollData) {
  const container = document.getElementById("payroll");
  container.innerHTML = ""; // Clear previous content

  if (!payrollData || !payrollData.weeks || payrollData.weeks.length === 0) {
    container.innerHTML = '<p style="color: #666; font-style: italic;">No payroll data available for this period.</p>';
    return;
  }

  // Display weekly breakdown
  let html = '<div class="week-summaries">';
  
  payrollData.weeks.forEach((week, index) => {
    html += `
      <div class="week-summary">
        <h4>Week ${index + 1}</h4>
        <p>Hours Worked: ${week.hours.toFixed(2)}</p>
        <p>Gross Pay: ₱${week.gross.toFixed(2)}</p>
        <p>Net Pay: ₱${week.net.toFixed(2)}</p>
      </div>
    `;
  });

  html += '</div>';

  // Display monthly summary
  html += `
    <div class="payroll-summary">
      <h4>Monthly Summary</h4>
      <p>Total Hours Worked: ${payrollData.totalHours.toFixed(2)}</p>
      <p>Monthly Gross Pay: ₱${payrollData.monthlyGross.toFixed(2)}</p>
      <p>Monthly Net Pay: ₱${payrollData.monthlyNet.toFixed(2)}</p>
      <button onclick="togglePayrollRelease()" class="action-btn toggle-release" id="releaseBtn">
        ${payrollData.isReleased ? 'Released' : 'Mark as Released'}
      </button>
    </div>
  `;

  container.innerHTML = html;

  // Update release button state
  const releaseBtn = document.getElementById('releaseBtn');
  if (payrollData.isReleased) {
    releaseBtn.classList.add('released');
  }
}

// Toggle payroll release status
function togglePayrollRelease() {
  const year = document.getElementById('payrollYear').value;
  const month = document.getElementById('payrollMonth').value;
  ipcRenderer.send('toggle-payroll-release', { employeeId, year, month });
}

// Function to convert decimal time to HH:MM format
function convertDecimalToTime(decimal) {
  if (!decimal || isNaN(decimal)) return '';
  
  // Convert decimal to total minutes
  const totalMinutes = Math.round(decimal * 24 * 60);
  
  // Extract hours and minutes
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  // Format with leading zeros
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Listen for attendance records response
ipcRenderer.on('attendance-records-response', (event, response) => {
  if (!response.success) {
    alert("Failed to load attendance records: " + response.error);
    return;
  }

  const records = response.records;
  const container = document.getElementById('attendanceRecords');
  
  if (records.length === 0) {
    container.innerHTML = '<p style="color: #666; font-style: italic;">No attendance records found.</p>';
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Time In</th>
          <th>Time Out</th>
          <th>Hours Worked</th>
        </tr>
      </thead>
      <tbody>
  `;

  records.forEach(record => {
    // Parse time strings into hours and minutes
    const timeIn = convertDecimalToTime(record.log_in);
    const timeOut = convertDecimalToTime(record.log_out);
    
    // Calculate hours worked
    let hoursWorked = 0;
    if (record.log_in && record.log_out) {
      const inMinutes = record.log_in * 24 * 60;
      const outMinutes = record.log_out * 24 * 60;
      hoursWorked = ((outMinutes - inMinutes) / 60).toFixed(2);
      
      // Subtract 1 hour for lunch break if worked more than 5 hours
      if (hoursWorked > 5) {
        hoursWorked = (parseFloat(hoursWorked) - 1).toFixed(2);
      }
    }

    html += `
      <tr>
        <td>${record.date}</td>
        <td>${timeIn}</td>
        <td>${timeOut}</td>
        <td>${hoursWorked > 0 ? hoursWorked : ''}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
});
