import * as camApp from "./cameraapp.js";
// Expand your global scope initialization
window.invoices = window.savedinvoices || [];
window.expenses = window.savedexpenses || []; // New array for expenses
let customerSettings = null;
let currentFilter, currentExpenseFilter = "all";
let activeTab = "invoices"; // Tracks 'invoices' or 'expenses'
let isUnsaved = false;
const dateFormatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month:"2-digit",
    year:"numeric"
});
const dashboardFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: "always"
});
document.addEventListener("DOMContentLoaded", function() {
    setTimeout(() => {
        applyCustomerSettings();
    }, 0);
});
    // Native browser event listener to block accidental tab closures
    window.addEventListener("beforeunload", (event) => {
        if (isUnsaved) {
            event.preventDefault();
            event.returnValue = true; 
        }
    });
    function sortTable(columnName) {
        const nameType = activeTab === "expenses" ? "exp" : "inv";
        const tableHead = document.getElementById(activeTab + "-table-header");
        const tableBody = document.getElementById(activeTab + "-table-body");
        const rowsArray = Array.from(tableBody.rows);
        const currentSortType = tableHead.dataset.sortColumn;
        let currentSortOrder = tableHead.dataset.sortOrder || "asc";
        if (currentSortType === columnName) {
            // If the same column is clicked again, toggle the sort order
            tableHead.dataset.sortOrder = tableBody.dataset.sortOrder === "asc" ? "desc" : "asc";
            tableHead.querySelector(`#header-${nameType}-${columnName}`).classList.add("sort-active");
        } else {
            tableHead.querySelectorAll(".sort-active").forEach(el => el.classList.remove("sort-active"));
            // If a new column is clicked, set it as the current sort column and default to ascending order
            tableHead.dataset.sortColumn = columnName;
            tableHead.dataset.sortOrder = "asc";
            tableHead.querySelector(`#header-${nameType}-${columnName}`).classList.add("sort-active");
        }
        currentSortOrder = tableBody.dataset.sortOrder || "asc";
        const newSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
        
        rowsArray.sort((a, b) => {
            let aValue = a.querySelector(`.cell-${nameType}-${columnName}`).innerText.trim();
            let bValue = b.querySelector(`.cell-${nameType}-${columnName}`).innerText.trim();
            
            if (columnName === "date") {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            } else if (columnName === "amount") {
                aValue = parseFloat(aValue.replace(/[$,]/g, '')) || 0;
                bValue = parseFloat(bValue.replace(/[$,]/g, '')) || 0;
            } else {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }
            
            if (aValue < bValue){
                return newSortOrder === "asc" ? -1 : 1;
            }
            if (aValue > bValue) {
                return newSortOrder === "asc" ? 1 : -1;
            }
            return 0;
        });
        
        // Re-append sorted rows to the table body
        rowsArray.forEach(row => tableBody.appendChild(row));
        
        // Update the sort order data attribute
        tableBody.dataset.sortOrder = newSortOrder;
    }
    function filterList() {
        const searchTerm = document.getElementById(activeTab === "expenses" ? "expense-search" : "invoice-search").value.toLowerCase();
        const filteredList = window[activeTab].filter(item => {
            return Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm));
        });
        renderTable(filteredList);
    }
    function setFilter(filterName){
        const nameType = activeTab === "expenses" ? "exp" : "inv";
        if(activeTab === "expenses") currentExpenseFilter = filterName.toLowerCase();
        else currentFilter = filterName.toLowerCase();
        document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
        document.getElementById(nameType + "-filter-" + filterName.toLowerCase()).classList.add("active");
        renderTable();
    }
    function updateBarGraph() {
        let totalPaid = 0;
        let totalPending = 0;
        let totalOverdue = 0;
        window.invoices.forEach(inv => {
            let numericVal = parseFloat(String(inv.amount).replace(/[$,]/g, ""));
            if (!isNaN(numericVal)) {
                if (inv.status === 'paid') totalPaid += numericVal;
                if (inv.status === 'pending') totalPending += numericVal;
                if (inv.status === 'overdue') totalOverdue += numericVal;
            }
        });
        let totalInvoiced = totalPaid + totalPending + totalOverdue;
        let outstanding = totalPending + totalOverdue;
        document.getElementById('chart-txt-paid').innerText = dashboardFormatter.format(totalPaid);
        document.getElementById('chart-txt-pending').innerText = dashboardFormatter.format(totalPending);
        document.getElementById('chart-txt-overdue').innerText = dashboardFormatter.format(totalOverdue);
        document.getElementById('lbl-total-invoiced').innerText = dashboardFormatter.format(totalInvoiced);
        document.getElementById('lbl-paid-amount').innerText = dashboardFormatter.format(totalPaid);
        document.getElementById('lbl-outstanding-amount').innerText = dashboardFormatter.format(outstanding);
        document.getElementById('lbl-total-overdue').innerText = dashboardFormatter.format(totalOverdue);
        let maxTotal = Math.max(totalPaid, totalPending, totalOverdue);
        let paidPercent = maxTotal > 0 ? (totalPaid / maxTotal) * 100 : 0;
        let pendingPercent = maxTotal > 0 ? (totalPending / maxTotal) * 100 : 0;
        let overduePercent = maxTotal > 0 ? (totalOverdue / maxTotal) * 100 : 0;
        document.getElementById('chart-bar-paid').style.height = paidPercent + '%';
        document.getElementById('chart-bar-pending').style.height = pendingPercent + '%';
        document.getElementById('chart-bar-overdue').style.height = overduePercent + '%';
    }
    function toggleEditRow(index){
    console.log('toggleEditRow');
    const nameType = activeTab === "expenses" ? "exp" : "inv";
    const row = document.getElementById(nameType + "-row-" + index);
    const button = document.getElementById(nameType + "-edit-btn-" + index);
    let editableTextCells = row.querySelectorAll('td:not(:last-child):not(.cell-inv-status):not(.cell-inv-date)');
    if(nameType === "exp") editableTextCells = row.querySelectorAll('td:not(:last-child):not(.cell-exp-category):not(.cell-exp-date)');
    const isEditing = button.classList.contains('save-action');
    const dateCell = row.querySelector('.cell-'+nameType+'-date');
    const dropDownCell = nameType === "exp" ? row.querySelector('.cell-exp-category') : row.querySelector('.cell-inv-status');
   // const expFields = ["date", "category", "vendor", "description", "amount"];
   // const invFields = ["date", "client", "clientaddress", "clientphone", "clientfax", "job", "jobdescription", "amount", "status"];
    let listItem = activeTab === 'expenses' ? window.expenses.find(itm => itm.id === index) : window.invoices.find(itm => itm.id === index);

    if(!isEditing){
        
        editableTextCells.forEach(cell => {
            if(cell.classList.contains("cell-" + nameType + "-amount")) {
                cell.innerText = cell.innerText.replace(/[$,]/g, '');
            }
            if(!cell.classList.contains('cell-inv-id')) {
                cell.contentEditable = "true";
                cell.classList.add('editing-active');

                cell.onfocus = function() {
                    setTimeout(() => {
                        const range = document.createRange();
                        const selection = window.getSelection();
                        range.selectNodeContents(cell);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }, 10);
                };
                
                 // 🎯 NEW: Live Auto-Format Date (MM/DD/YYYY) While Typing

                if(cell.classList.contains('cell-'+nameType+'-date')) {
                    cell.oninput = function(){
                         // Remove all non-digits
                        let digits = cell.innerText.replace(/\D/g, '');
                    
                        // Enforce maximum length of 8 digits (MMDDYYYY)
                        if (digits.length > 8) digits = digits.slice(0, 8);
                    
                        let formatted = "";
                        if (digits.length > 0) {
                            // Build MM section
                            formatted += digits.substr(0, 2);
                            if (digits.length > 2) {
                                // Append first slash and DD section
                                formatted += '/' + digits.substr(2, 2);
                                if (digits.length > 4) {
                                    // Append second slash and YYYY section
                                    formatted += '/' + digits.substr(4, 4);
                                }
                            }
                        }

                         // Only rewrite the text context if it structurally changed to preserve selection anchors
                        if (cell.innerText !== formatted) {
                            cell.innerText = formatted;
                        
                            // Force the cursor to stay at the very end of the line
                            const range = document.createRange();
                            const selection = window.getSelection();
                            range.selectNodeContents(cell);
                            range.collapse(false); // false means collapse to end
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    };
                }
            }
        });
    
        const currentDropDownChoice = nameType === "exp" ? dropDownCell.innerText : dropDownCell.getAttribute("data-status");
        dropDownCell.innerHTML = '<select class="status-select"></select>';
        const ddSelect = dropDownCell.querySelector('select');
        if(nameType === "exp"){
            for(const cat of customerSettings.expenseCats){
                ddSelect.innerHTML += '<option value="' + cat + '">' + cat + '</option>';
            }
        } else {
            for(const status of customerSettings.invoiceStatus){
                ddSelect.innerHTML += '<option value="' + status.toLowerCase() + '">' + status + '</option>';
            }
            ddSelect.value = currentDropDownChoice;
        }

        const currentDate = dateFormatter.format(new Date(dateCell.innerHTML));
        const [month, day, year] = currentDate.split('/');
        dateCell.innerHTML = '<input type="date" value="'+year+'-'+month+'-'+day+'">';
        
        button.innerHTML = "💾 Save";
        button.className = "mobile-action-btn save-action";
        
        // 🎯 NEW: Automatically focus the first editable expense text cell (usually the Date cell)
        if(editableTextCells.length > 0){
        // If the first cell happens to be the read-only cell-inv-id, skip to the next one
            const firstEditable = editableTextCells[0].classList.contains('cell-inv-id') ? editableTextCells[1] : editableTextCells[0];
            if(firstEditable) firstEditable.focus();
        }
    }else{

        // 🔍 1. Extract Elements for Real-Time Validation
        const amountCell = activeTab === 'expenses' ? row.querySelector('.cell-exp-amount') : row.querySelector('.cell-inv-amount');
        
        //const rawDate = dateCell.innerText.trim();
        const rawDate = new Date(dateCell.querySelector('input').value.trim()+' 00:00:00');
        const rawAmt = amountCell.innerText.trim().replace(/[$,]/g, '');

        // 🕒 2. Date Validation (Must look like YYYY-MM-DD and be a calendar date)
        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        const parsedDateCheck = rawDate;

        if (!dateRegex.test(dateFormatter.format(new Date(rawDate))) || isNaN(parsedDateCheck.getTime())) {
            alert("⚠️ Invalid Date Format!\nPlease enter a valid date using the YYYY-MM-DD format (e.g., 2026-09-06).");
            // Force focus back onto the broken field and halt the save process
            dateCell.focus();
            return; 
        }

        // 💰 3. Amount Validation (Must be a numeric value)
        let numericVal = parseFloat(rawAmt);
        if (isNaN(numericVal)) {
            alert("⚠️ Invalid Amount Value!\nPlease enter a valid decimal number (e.g., 1250.50). Do not include text.");
            amountCell.focus();
            return; 
        }

        if(listItem){
            switch(activeTab){
                case "expenses":
                    listItem.date = dateFormatter.format(rawDate);
                    listItem.category = row.querySelector('select').value;
                    listItem.vendor = row.querySelector('.cell-exp-vendor').innerText.trim();
                    listItem.description = row.querySelector('.cell-exp-description').innerText.trim();
                    listItem.amount = String(numericVal.toFixed(2));
                    break;
                case "invoices":
                    listItem.date = dateFormatter.format(rawDate);
                    listItem.client = row.querySelector('.cell-inv-client').innerText.trim();
                    listItem.clientaddress = row.querySelector('.cell-inv-clientaddress').innerText.trim();
                    listItem.clientphone = row.querySelector('.cell-inv-clientphone').innerText.trim();
                    listItem.clientfax = row.querySelector('.cell-inv-clientfax').innerText.trim();
                    listItem.job = row.querySelector('.cell-inv-job').innerText.trim();
                    listItem.jobdescription = row.querySelector('.cell-inv-jobdescription').innerText.trim();
                    listItem.amount = String(numericVal.toFixed(2));
                    listItem.status = row.querySelector('.status-select').value;
                    break;
                default: console.log("What the hell?");
            }

        }
        isUnsaved = true;
        renderTable();
    }
}
    function addNewInvoice() {
    const nextNum = window.invoices.reduce((max, inv) => {
        const num = parseInt(inv.id.replace("INV-", ""), 10);
        return num > max ? num : max;
    }, 0) + 1;
    const nextId = "INV-" + String(nextNum).padStart(3, '0');
    const todayStr = dateFormatter.format(new Date());
    const newInv = {
        id: nextId,
        date: todayStr,
        client: "New Client Name",
        clientaddress: "Enter Client Address",
        clientphone: "000-000-0000",
        clientfax: "000-000-0000",
        job: "Job Name",
        jobdescription: "Enter Job Description",
        amount: "0.00",
        status: "pending",
        createdTimestamp: Date.now()
    };
    window.invoices.push(newInv);
    isUnsaved = true;
    setFilter('all');
    toggleEditRow(nextId);
    }
    // NEW FUNCTION: Compiles both datasets, wraps them into a single text file stream, and initiates saving
    async function saveTableToFile() {
        // 1. Transform both data object arrays directly into structured code syntax strings
       // let dataStr = "var savedinvoices = " + JSON.stringify(window.invoices, null, 4) + ";\n" +
         //           "var savedexpenses = " + JSON.stringify(window.expenses, null, 4) + ";";
        
         let dataStr = JSON.parse(`{"data":{}}`);

        dataStr.apiKey = sessionStorage.getItem("apiKey"); 
        dataStr.data.savedinvoices = window.invoices;
        dataStr.data.savedexpenses = window.expenses;
        dataStr.settings = customerSettings;
        
        dataStr = JSON.stringify(dataStr, null, 4);

        try {
            // 2. Open the browser's native "Save As" dialog picker (Corrected lower-case startIn property)
            const handle = await window.showSaveFilePicker({
                suggestedName: 'invoice_data.json',
                startIn: 'downloads', 
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/javascript': ['.json'] }
                }],
            });

            // 3. Create a writable stream to the chosen file
            const writable = await handle.createWritable();
            
            // 4. Write the double-dataset bundle and close the stream
            await writable.write(dataStr);
            await writable.close();
            
            // 🎉 SUCCESS: Clear the unsaved flag so the user can navigate away safely
            isUnsaved = false;
            console.log("File saved successfully with Invoices and Expenses!");
            alert("Data successfully saved to file!");
            
        } catch (err) {
            // 5. FALLBACK MECHANISM: If the native picker fails or is unsupported (Firefox, Safari, Mobile Chrome)
            console.warn("Native file picker failed/unsupported. Falling back to anchor download...", err);
            
            try {
                const blob = new Blob([dataStr], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'invoice_data.js';
                document.body.appendChild(a);
                
                a.click(); // Trigger layout click simulation
                
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                // Clear the dirty flag upon successful fallback down-stream download
                isUnsaved = false; 
                alert("Data downloaded successfully!");
            } catch (fallbackErr) {
                console.error("Complete save operation failure:", fallbackErr);
                alert("Failed to save file. Please check browser permissions.");
            }
        }
    }

    // NEW FUNCTION: Reads an uploaded data file stream, maps structural data sets, and targets live rendering sweeps
    function importTableFromFile(event, bypassValidation = false) {
        console.log("Importing file..." + (event.target.files[0] ? event.target.files[0].name : ""));
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const rawText = e.target.result;
                let parsedInvoices = null;
                let parsedExpenses = null;
                let apiKey = null;

                // 1. Check if the incoming file is using the new dual-array variable format
             //   if (rawText.includes("var savedexpenses =")) {
                    console.log("Parsing JSON Data from file...");                
                    const parsedString = JSON.parse(rawText);
                    customerSettings = parsedString.settings;
                    applyCustomerSettings();
                    // Clean prefixes, extract data content boundaries, and strip trailing semicolons
                 /*   const invString = rawText.split("var savedexpenses =")[0]
                                            .replace("var savedinvoices =", "")
                                            .trim().replace(/;$/, "");
                    const expString = rawText.split("var savedexpenses =")[1].trim().replace(/;$/, "");
                    const apiString = rawText.split("const apiKey =")[1].trim();
*/
                //    parsedInvoices = JSON.parse(invString);
                  //  parsedExpenses = JSON.parse(expString);
                    parsedInvoices = parsedString.data.savedinvoices;
                    parsedExpenses = parsedString.data.savedexpenses;
                    apiKey = parsedString.apiKey.trim();
                    sessionStorage.setItem("apiKey", apiKey);
              //  } 
                // 2. Legacy Fallback: Process older file snapshots containing only invoice records
        /*        else {
                    console.log("Detecting legacy single-dataset architecture...");
                    const singleCleanedString = rawText.replace("var savedinvoices =", "").trim().replace(/;$/, "");
                    parsedInvoices = JSON.parse(singleCleanedString);
                    parsedExpenses = []; // Initialize blank array for legacy imports
                }*/

                // 3. Structural Validation & Variable State Assignment
                if (Array.isArray(parsedInvoices) && Array.isArray(parsedExpenses)) {
                    // Ensure all imported invoices possess a hidden creation timestamp tracker
                    const standardizedInvoices = parsedInvoices.map(inv => {
                        if (!inv.createdTimestamp) {
                            inv.createdTimestamp = inv.date ? new Date(inv.date).getTime() : Date.now();
                        }
                        return inv;
                    });

                    // Securely reset and populate the global window namespaces to maintain referencing anchors
                    if (!window.invoices) window.invoices = [];
                    if (!window.expenses) window.expenses = [];

                    window.invoices.length = 0;
                    window.invoices.push(...standardizedInvoices);

                    window.expenses.length = 0;
                    window.expenses.push(...parsedExpenses);

                    console.log("Import success! Invoices:", window.invoices, "Expenses:", window.expenses);
                    console.log("activeTab context:", activeTab);
                    // Alert the system that the file tracking layout is modified
                    isUnsaved = true;

                    if (!bypassValidation) {
                        alert("Dashboard datasets successfully synchronized!");
                    }

                    // Force live redraw loops depending on which tab view index context is currently focused
                    if (typeof activeTab !== 'undefined') {
                        setFilter("all");
                    }
                } else {
                    alert("Invalid schema. The chosen file does not map cleanly into database array elements.");
                }
            } catch (error) {
                console.error("Parsing breakdown error detail:", error);
                alert(error + ": Failed to map data arrays. Ensure chosen file is a valid formatting script.");
            }
        };
        
        // Execute streaming execution read lifecycle
        reader.readAsText(file);
        
        // Bulletproof fix for fast repetitive changes: wipe out element state instantly on the thread
        event.target.value = "";
    }


    function checkOverdueStatus() {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        
        // Set a rolling 30-day lookback anchor window
        thirtyDaysAgo.setDate(today.getDate() - 30);

        let altered = false;

        window.invoices.forEach(inv => {
            // Only inspect records currently marked as pending
            if (inv.status === 'pending' && inv.date) {
                const invoiceDate = new Date(inv.date);

                // Verify if the invoice date falls past our 30-day horizon window
                if (!isNaN(invoiceDate.getTime()) && invoiceDate < thirtyDaysAgo) {
                    inv.status = 'overdue';
                    altered = true;
                }
            }
        });

        // If any records were automatically updated, alert the system state
        if (altered) {
            isUnsaved = true;
        }
    }
    function openInvoiceWindow(index) {
        const listItem = window.invoices.find(itm => itm.id === index);
        const rawDate = dateFormatter.format(new Date(listItem.date));
        const [month, day, year] = rawDate.split('/');
        const newWindow = window.open("", "_blank", "width=900,height=900");
        newWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <title>View Invoice - ${listItem.id}</title>
                <link rel="stylesheet" href="css/invoicegenerator.css">
                <script src="js/config.js"></script>
                <script src="js/invoicegenerator.js"></script>
            </head>
            <body>
            <div id="content">

                                    <div class="header">
                                        <table>
                                            <tr>
                                                <th>
                                                <img class="logo-png" src="${customerSettings.logoimg}" alt="${customerSettings.companyName}">
                                                </th>
                                                <th>
                                                    <span style="font-size:40px; vertical-align:middle;">
                                                        ${customerSettings.companyName}
                                                    </span>
                                                </th>
                                            </tr>
                                            <tr>
                                                <td colspan="2">
                                                    <div class="company-info">
                                                        ${customerSettings.companyAddress}<br><br>
                                                        P: ${customerSettings.companyPhone}<br>
                                                        ${customerSettings.companyEmail}
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>

                                        <div class="billto">
                                            <h1>INVOICE</h1>

                                            <div class="invoice-section">
                                                <div class="field-label">Invoice #:</div>
                                                <input id="invoiceNumber" type="text" value="${listItem.id}" readonly>

                                                <div class="field-label">Invoice date:</div>
                                                <input id="invoicedate" type="date" lang="" data-date-format="MM/DD/YYYY" value="${year}-${month}-${day}" readonly>

                                                <div class="field-label">Bill to:</div>
                                                <input id="billtoname" type="text" value="${listItem.client}" readonly>

                                                <div class="field-label">Address:</div>
                                                <textarea id="billtoaddress" readonly>${listItem.clientaddress}</textarea>

                                                <div class="field-label">Phone:</div>
                                                <input id="billtophone" type="text" value="${listItem.clientphone}" readonly>

                                                <div class="field-label">Fax:</div>
                                                <input id="billtofax" type="text" value="${listItem.clientfax}" readonly>
                                            </div>
                                        </div>

                                        <div class="clear"></div>
                                </div>

                                <table class="in">
                                    <tr>
                                        <th>Job</th>
                                        <th>Description</th>
                                        <th>Price</th>
                                    </tr>

                                    <tr>
                                        <td><input type="text" value="${listItem.job}" readonly></td>
                                        <td><textarea readonly>${listItem.jobdescription}</textarea></td>
                                        <td><input type="text" inputmode="decimal" id="lineprice1" class="lineprice" value="${dashboardFormatter.format(listItem.amount)}"></td>
                                    </tr>

                                </table>

                                <div class="total">
                                    TOTAL: <span id="totalAmount">0.00</span>
                                </div>

                                <div class="footer-text">
                                    Please make all checks payable to ${customerSettings.companyName}<br>
                                    Total due in 30 days. Overdue accounts subject to a service charge of 1.5% per month.
                                </div>

                            </div>                 
            <\/body>
            <\/html>

        `);
    newWindow.document.close();
    }


    // Tab Switch Controller Engine
    function switchTab(tabName) {
        activeTab = tabName;
        document.querySelectorAll('#tab-invoices, #tab-expenses').forEach(btn => btn.classList.remove('active'));
        
        if (tabName === 'invoices') {
            document.getElementById('tab-invoices').classList.add('active');
            document.getElementById('invoices-view-container').style.display = 'block';
            document.getElementById('expenses-view-container').style.display = 'none';
        } else {
            document.getElementById('tab-expenses').classList.add('active');
            document.getElementById('invoices-view-container').style.display = 'none';
            document.getElementById('expenses-view-container').style.display = 'block';
        }
        setFilter("all");
    }

    // Calculate and Update Expense Summary Visual Cards
    function updateExpenseMetrics(filterType) {
        let totalExpenses = 0;
        window.expenses.forEach(exp => {
            if(exp.category.toLowerCase() === filterType || filterType === "all"){
                let numericVal = parseFloat(String(exp.amount).replace(/[$,]/g, ""));
                if (!isNaN(numericVal)) totalExpenses += numericVal;
            }
        });
        
        document.getElementById('lbl-total-expenses').innerText = dashboardFormatter.format(totalExpenses);
        document.getElementById('lbl-expenses-title').innerText = `Total ${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`;
    }

function renderTable(filteredList = null) {
    const list = filteredList || (activeTab === "expenses" ? window.expenses : window.invoices);
    const nameType = activeTab === "expenses" ? "exp" : "inv";
    if(activeTab==="invoices") checkOverdueStatus();
    const tableBody = activeTab ==="expenses" ? document.getElementById("expenses-table-body") : document.getElementById("invoices-table-body");
    tableBody.innerHTML = "";
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    list.forEach((itm) => {
        if(activeTab === "invoices" && currentFilter !== "all" && itm.status.toLowerCase() !== currentFilter) return;
        if(activeTab === "expenses" && currentExpenseFilter !== "all" && itm.category.toLowerCase() !== currentExpenseFilter) return;
        const row = document.createElement("tr");
        row.id = nameType + "-row-" + itm.id
        row.setAttribute("data-id", itm.id)
        let badgeClass;
        if (activeTab === "invoices" && itm.status){
            switch(itm.status) {
                case "paid":
                    badgeClass = "badge-paid";
                    break;
                case "overdue":
                    badgeClass = "badge-overdue";
                    break;
                default:
                    badgeClass = "badge-pending";
            }
        }
        const numericVal = parseFloat(String(itm.amount).replace(/[$,]/g, ""));
        const formattedAmount = isNaN(numericVal) ? "$0.00" : dashboardFormatter.format(numericVal);

        switch(activeTab){
            case "expenses" :
                row.innerHTML = `
                    <td class="cell-exp-date">${itm.date}</td>
                    <td class="cell-exp-category">${itm.category}</td>
                    <td class="cell-exp-vendor">${itm.vendor}</td>
                    <td class="cell-exp-description">${itm.description}</td>
                    <td class="cell-exp-amount">${formattedAmount}</td>
                    <td>
                        <div class="action-cell">
                            <button type="button" id="${nameType}-edit-btn-${itm.id}" class="mobile-action-btn edit-action" title="Edit" onclick="toggleEditRow('${itm.id}')">✏️</button>
                        </div>
                    </td>
                `;
                break;
            case "invoices" :
                row.innerHTML = `
                    <td class="cell-inv-id">${itm.id}</td>
                    <td class="cell-inv-date">${itm.date}</td>
                    <td class="cell-inv-client">${itm.client}</td>
                    <td class="cell-inv-clientaddress">${itm.clientaddress}</td>
                    <td class="cell-inv-clientphone">${itm.clientphone}</td>
                    <td class="cell-inv-clientfax">${itm.clientfax}</td>
                    <td class="cell-inv-job">${itm.job}</td>
                    <td class="cell-inv-jobdescription">${itm.jobdescription}</td>
                    <td class="cell-inv-amount">${formattedAmount}</td>
                    <td class="cell-inv-status" data-status="${itm.status}"><span class="badge ${badgeClass}">${itm.status}</span></td>
                    <td>
                        <div class="action-cell">
                            <button type="button" id="${nameType}-edit-btn-${itm.id}" class="mobile-action-btn edit-action" title="Edit" onclick="toggleEditRow('${itm.id}')">✏️</button>
                        </div>
                    </td>
                `;
                break;
        }

        const acell = row.querySelector('.action-cell');
        let buttonHtml = `<button type="button" class="mobile-action-btn del-btn" title="Delete" onclick="deleteListItem('${itm.id}')">🗑️</button>`
        acell.innerHTML += buttonHtml;
        if(activeTab === "invoices"){
            buttonHtml = `<button type="button" class="mobile-action-btn view-action" title="View Invoice" onclick="openInvoiceWindow('${itm.id}')">👁️</button>`
            acell.innerHTML = buttonHtml + acell.innerHTML;
        }
        //else acell.innerHTML += buttonHtml;
        tableBody.appendChild(row);
    });

    if(activeTab === "expenses"){
        // 4. CHECK: Is there an active "New Expense" row currently being edited?
        // If so, force it to prepend to the very top of the table body
        const activeEditingRow = document.getElementById("new-expense-editing-row");
        if (activeEditingRow) {
            expenseTableBody.prepend(activeEditingRow);
        }

        updateExpenseMetrics(currentExpenseFilter);
    }
    else updateBarGraph();
}
    // Function triggered when clicking "➕ Record New Expense"
    function createNewExpenseRow() {
        // If an editing row already exists, don't create duplicates
        if (document.getElementById("new-expense-editing-row")) return;

        const expenseTableBody = document.getElementById("expenses-table-body");
        const editRow = document.createElement("tr");
        editRow.id = "new-expense-editing-row";

        const rawDate = dateFormatter.format(new Date());
        const [month, day, year] = rawDate.split('/');

        // Populate with your form fields or inputs
        editRow.innerHTML = `
            <td><input type="date" id="input-date" class="cell-exp-date" value="${year}-${month}-${day}"></td>
            <td><select id="input-category" class="cell-exp-category status-select" placeholder="Category"></select></td>
            <td><input type="text" id="input-vendor" class="cell-exp-vendor" placeholder="Vendor"></td>
            <td><input type="text" id="input-desc" class="cell-exp-desc" placeholder="Description"></td>
            <td><input type="number" id="input-amount" class="cell-exp-amount" placeholder="0.00" step="0.01"></td>
            <td><button class="mobile-action-btn save-action" title="Save" onclick="saveNewExpense()">Save</button>
            <button class="mobile-action-btn cancel-action" title="Cancel" onclick="cancelNewExpense()">Cancel</button></td>
        `;

            const catSelect = editRow.querySelector("select");
            for(const cat of configuration.expenseCats){
                catSelect.innerHTML += '<option value="'+cat+'">'+cat+'</option>;';
            }

        // Force the edit inputs to stay pinned at the very top of the visual stack
        expenseTableBody.prepend(editRow);
    }
    function cancelNewExpense(){
        document.getElementById("new-expense-editing-row").remove();
    }
   export function validateReceiptData(data){
        for(const d of data){
        createNewExpenseRow();
        saveNewExpense(true, d);
        }
        
    }
    // Function triggered when clicking "Save" on the top row
    function saveNewExpense(fromReceipt = false, data = null) {
        const dateVal = new Date(fromReceipt ? `${data.date} 00:00:00` : `${document.getElementById("input-date").value} 00:00:00`);
        const catVal = fromReceipt && data.category ? data.category : document.getElementById("input-category").value;
        const venVal = fromReceipt && data.vendor ? data.vendor : document.getElementById("input-vendor").value;
        const descVal = fromReceipt && data.description ? data.description : document.getElementById("input-desc").value;
        const amtVal = fromReceipt ? data.total : document.getElementById("input-amount").value;

        // Validate inputs (ensure date and amount are populated)
        if (!dateVal || !amtVal) return alert("Please fill out Date and Amount.");

        // Push the compiled data object directly into the saved array
        const newExpense = {
            id: Date.now().toString(), // Generate a unique ID using JS Date.now()
            date: dateFormatter.format(new Date(dateVal)),
            category: catVal,
            vendor: venVal,
            description: descVal,
            amount: amtVal,
            timestamp: Date.now() // Track precisely when it was submitted
        };
        window.expenses.push(newExpense);

        // Re-render table: This automatically sorts the entire list by date 
        // and cleans up the temporary editing row element
        renderTable();
    }

    // Append a fresh Expense Record Entity
    function addNewExpense() {
        const todayStr = dateFormatter.format(new Date());
        const newExp = {
            id: Date.now(),
            createdTimeStamp: Date.now(),
            date: todayStr,
            category: "Fuel",
            vendor: "Vendor Name",
            description: "Description details",
            amount: "0.00"
        };
        window.expenses.push(newExp);
        isUnsaved = true;
        setFilter('all');
        toggleEditRow(newExp.id);
    }

    function deleteListItem(index){
            const list = activeTab === "expenses" ? window.expenses : window.invoices;
        if(confirm("Are you sure you want to delete this "+activeTab+" entry?")){
            const i = list.findIndex(itm => itm.id === index);
            if(i != -1) list.splice(i, 1);
            isUnsaved = true;
            renderTable();
        }
    }

    function takeReceiptPhoto(){
        //window.open("camera.html", "blank");
        const cameraContainer = document.getElementById("camera-container");
        if(cameraContainer.classList.contains("hidden")) cameraContainer.classList.remove("hidden");
        camApp.initWebcam();
    }

    function applyCustomerSettings(){
        console.table(customerSettings);
        const logoEl = document.getElementsByClassName("logo-png")[0];
        if(logoEl) {logoEl.src = customerSettings.logoimg;}
        document.getElementById("company-title").innerText = customerSettings.companyName;
           const expCatField = document.getElementById("expenseCategory");
    const catButtonsHTML = [];
    catButtonsHTML.push('<button class="filter-btn active" id="exp-filter-all" data-category="all">All</button>');
    for(const cat of customerSettings.expenseCats){
        catButtonsHTML.push('<button class="filter-btn" id="exp-filter-'+cat.toLowerCase()+'" data-category="'+cat.toLowerCase()+'">'+cat+'</button>');
    }
    expCatField.innerHTML += catButtonsHTML.join("");
    expCatField.addEventListener("click", (event) => {
        const targetButton = event.target.closest(".filter-btn");
        if(!targetButton) return;
        const selectedCategory = targetButton.dataset.category;
        setFilter(selectedCategory, "expenses");
    });
    }
/*    // Listen for data sent back from the popup
window.addEventListener('message', (event) => {
  // Security check: ensure the message comes from your own domain
  const fdata = "["+event.data+"]";
  if (event.origin !== window.location.origin) return;

  console.log('Data received from popup:', fdata);
  validateReceiptData(JSON.parse(fdata));
});*/

// Make these functions accessible to inline HTML events
window.setFilter = setFilter;
window.addNewInvoice = addNewInvoice;
window.sortTable = sortTable;
window.switchTab = switchTab;
window.saveTableToFile = saveTableToFile;
window.importTableFromFile = importTableFromFile;
window.takeReceiptPhoto = takeReceiptPhoto;
window.createNewExpenseRow = createNewExpenseRow;
window.filterList = filterList;
window.toggleEditRow = toggleEditRow;
window.openInvoiceWindow = openInvoiceWindow;
window.cancelNewExpense = cancelNewExpense;
window.addNewExpense = addNewExpense;
window.deleteListItem = deleteListItem;
window.saveNewExpense = saveNewExpense;