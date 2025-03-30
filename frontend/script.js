document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const receiptUploadStep = document.getElementById('receipt-upload-step');
    const editExpenseStep = document.getElementById('edit-expense-step');
    const receiptUploadForm = document.getElementById('receipt-upload-form');
    const expenseForm = document.getElementById('expense-form');
    const expenseIdInput = document.getElementById('expense-id');
    const submitButton = document.getElementById('submit-button');
    const processReceiptButton = document.getElementById('process-receipt-button');
    const cancelEditButton = document.getElementById('cancel-edit');
    const expenseList = document.getElementById('expense-list');
    const exportButton = document.getElementById('export-button');
    const loadingIndicator = document.getElementById('loading');
    const receiptModal = document.getElementById('receipt-modal');
    const modalImage = document.getElementById('modal-image');
    const closeModal = document.querySelector('.close-modal');
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteButton = document.getElementById('confirm-delete');
    const cancelDeleteButton = document.getElementById('cancel-delete');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const receiptPreview = document.getElementById('receipt-preview');
    const receiptFilename = document.getElementById('receipt-filename');
    // Auth elements
    const authSection = document.getElementById('auth-section');
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const appContent = document.getElementById('app-content');
    const navLinks = document.getElementById('nav-links');
    const navLogout = document.getElementById('nav-logout');
    const logoutButton = document.getElementById('logout-button');

    // Add loading overlay to the body
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(loadingOverlay);

    // State variables
    let currentExpenseId = null;
    let expenses = [];
    let expenseToDelete = null;
    let currentReceiptFile = null;
    // Auth state
    let authToken = null;
    let currentUser = null; // { id, username }

    // --- Auth Token Helpers ---
    const saveToken = (token, user) => {
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        authToken = token;
        currentUser = user;
    };

    const getToken = () => {
        authToken = localStorage.getItem('authToken');
        const userString = localStorage.getItem('currentUser');
        currentUser = userString ? JSON.parse(userString) : null;
        return authToken;
    };

    const clearToken = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        authToken = null;
        currentUser = null;
    };

    const isLoggedIn = () => {
        return !!getToken(); // Check if token exists and is valid (basic check)
    };

    // --- UI Update Function ---
    const updateUIForAuthState = () => {
        const loggedIn = isLoggedIn();
        console.log("Updating UI for auth state:", loggedIn);

        if (loggedIn) {
            // Show app content, hide auth forms
            authSection.classList.add('hidden');
            appContent.classList.remove('hidden');
            navLogout.classList.remove('hidden');
            // Optionally hide login/register links if they exist in nav
        } else {
            // Show auth forms, hide app content
            authSection.classList.remove('hidden');
            appContent.classList.add('hidden');
            navLogout.classList.add('hidden');
            // Ensure login form is shown by default when logged out
            loginFormContainer.classList.remove('hidden');
            registerFormContainer.classList.add('hidden');
        }
        // Clear expense list if logged out
        if (!loggedIn) {
            expenseList.innerHTML = '';
            document.getElementById('no-expenses').classList.remove('hidden');
            document.querySelector('.expense-table-container').classList.add('hidden');
        }
    };

    // --- API Fetch Helper ---
    const fetchWithAuth = async (url, options = {}) => {
        const token = getToken();
        const headers = { ...options.headers };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Ensure Content-Type is set for POST/PUT if body is JSON, unless it's FormData
        if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body); // Stringify if it's an object
        }

        const response = await fetch(url, { ...options, headers });

        // Handle token expiration or invalid token
        if (response.status === 401 || response.status === 403) {
            console.log('Auth error detected, logging out.');
            clearToken();
            updateUIForAuthState(); // Update UI to show login form
            showToast('Session expired or invalid. Please log in again.', 'error');
            // Throw an error to stop further processing in the calling function
            throw new Error('Authentication required');
        }

        return response;
    };

    // --- Toast Notification Functions ---
    const showToast = (message, type = 'success') => {
        toast.className = `toast ${type}`;
        toastMessage.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    };

    // --- Loading Overlay Functions ---
    const showLoadingOverlay = () => {
        loadingOverlay.classList.add('show');
    };

    const hideLoadingOverlay = () => {
        loadingOverlay.classList.remove('show');
    };

    // --- Modal Functions ---
    const openReceiptModal = (imagePath) => {
        modalImage.src = imagePath;
        receiptModal.style.display = 'block';
    };

    const closeReceiptModal = () => {
        receiptModal.style.display = 'none';
    };

    const openDeleteModal = (expenseId) => {
        expenseToDelete = expenseId;
        deleteModal.style.display = 'block';
    };

    const closeDeleteModal = () => {
        deleteModal.style.display = 'none';
        expenseToDelete = null;
    };

    // --- Loading Indicator Functions ---
    const showLoading = () => {
        loadingIndicator.style.display = 'block';
    };

    const hideLoading = () => {
        loadingIndicator.style.display = 'none';
    };

    // --- Form Functions ---
    const resetForm = () => {
        receiptUploadForm.reset();
        expenseForm.reset();
        expenseIdInput.value = '';
        currentExpenseId = null;
        receiptPreview.classList.add('hidden');
        currentReceiptFile = null;

        // Show receipt upload step, hide edit step
        receiptUploadStep.classList.remove('hidden');
        editExpenseStep.classList.add('hidden');
    };

    const showEditStep = (data = {}) => {
        // Hide receipt upload step, show edit step
        receiptUploadStep.classList.add('hidden');
        editExpenseStep.classList.remove('hidden');

        // Populate form with extracted data
        document.getElementById('type').value = data.type || '';
        document.getElementById('date').value = data.date || '';
        document.getElementById('vendor').value = data.vendor || data.location || '';
        document.getElementById('location').value = data.location || '';
        // document.getElementById('tripName').value = data.tripName || ''; // Removed trip name
        document.getElementById('cost').value = data.cost || '';
        document.getElementById('comments').value = data.comments || '';

        // Scroll to edit form
        editExpenseStep.scrollIntoView({ behavior: 'smooth' });
    };

    const populateFormForEdit = (expense) => {
        expenseIdInput.value = expense.id;

        // Show edit step
        receiptUploadStep.classList.add('hidden');
        editExpenseStep.classList.remove('hidden');

        // Populate form with expense data
        document.getElementById('type').value = expense.type || '';
        document.getElementById('date').value = expense.date || '';
        document.getElementById('vendor').value = expense.vendor || expense.location || '';
        document.getElementById('location').value = expense.location || '';
        // document.getElementById('tripName').value = expense.tripName || ''; // Removed trip name
        document.getElementById('cost').value = expense.cost || '';
        document.getElementById('comments').value = expense.comments || '';

        if (expense.receiptPath) {
            receiptPreview.classList.remove('hidden');
            receiptFilename.textContent = expense.receiptPath.split('/').pop();
        } else {
            receiptPreview.classList.add('hidden');
        }

        submitButton.textContent = 'Update Expense';
        currentExpenseId = expense.id;

        // Scroll to form
        document.getElementById('add-expense').scrollIntoView({ behavior: 'smooth' });
    };

    
        // --- Expense CRUD Functions ---
        const fetchAndDisplayExpenses = async () => {
            if (!isLoggedIn()) {
                console.log("Not logged in, cannot fetch expenses.");
                expenseList.innerHTML = ''; // Clear list if logged out
                document.getElementById('no-expenses').classList.remove('hidden');
                document.querySelector('.expense-table-container').classList.add('hidden');
                // Don't show loading if not logged in
                return;
            }
            showLoading();
            try {
                // Use fetchWithAuth
                const response = await fetchWithAuth('/api/expenses'); // Changed fetch to fetchWithAuth
                if (!response.ok) {
                    // fetchWithAuth handles 401/403 by throwing; catch block handles it.
                    // Handle other non-auth errors here.
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

            expenseList.innerHTML = ''; // Clear current list
            const noExpensesDiv = document.getElementById('no-expenses');

            if (expenses.length === 0) {
                noExpensesDiv.classList.remove('hidden');
                document.querySelector('.expense-table-container').classList.add('hidden');
            } else {
                noExpensesDiv.classList.add('hidden');
                document.querySelector('.expense-table-container').classList.remove('hidden');

                // Group expenses by tripName
                const groupedExpenses = expenses.reduce((acc, expense) => {
                    const trip = expense.tripName || 'Uncategorized';
                    if (!acc[trip]) {
                        acc[trip] = [];
                    }
                    acc[trip].push(expense);
                    return acc;
                }, {});

                // Sort trip names (optional, Uncategorized first)
                const sortedTripNames = Object.keys(groupedExpenses).sort((a, b) => {
                    if (a === 'Uncategorized') return -1;
                    if (b === 'Uncategorized') return 1;
                    return a.localeCompare(b);
                });

                // Render grouped expenses
                sortedTripNames.forEach(tripName => {
                    // Add a header row for the trip
                    const headerRow = document.createElement('tr');
                    headerRow.classList.add('trip-header-row');
                    // Use a button instead of an anchor for export, add data attribute
                    const safeFilenamePart = tripName.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_') || 'trip';
                    headerRow.innerHTML = `
                        <td colspan="7">
                            <span>${tripName}</span>
                            <button class="btn-small btn-secondary export-trip-button"
                                    data-tripname="${encodeURIComponent(tripName)}"
                                    data-filename="${safeFilenamePart}.xlsx"
                                    title="Generate Expense Sheet for ${tripName}">
                                <i class="fas fa-file-excel"></i> Generate Expense Sheet
                            </button>
                        </td>`;
                    expenseList.appendChild(headerRow);

                    // Render expenses for this trip
                    groupedExpenses[tripName].forEach(expense => {
                        const row = document.createElement('tr');
                        // Restore extractCity function logic
                        const extractCity = (location) => {
                            if (!location) return 'N/A';
                            // Try matching "City, ST" format first
                            const cityStateMatch = location.match(/([^,]+),\s*([A-Z]{2})/);
                            if (cityStateMatch && cityStateMatch[1]) return cityStateMatch[1].trim();
                            // Fallback: Split by space, return first word > 1 char if not a number
                            const words = location.split(' ');
                            for (const word of words) {
                                if (isNaN(word) && word.length > 1) return word;
                            }
                            // Final fallback: Truncate long strings or return as is
                            return location.length > 15 ? location.substring(0, 15) + '...' : location;
                        };

                        // --- DEBUG LOG for Date Formatting ---
                        console.log(`Formatting date for expense ${expense.id}:`, expense.date, `(Type: ${typeof expense.date})`);
                        const formattedDate = formatDate(expense.date);
                        console.log(`Formatted date result:`, formattedDate);
                        // --- END DEBUG LOG ---

                        row.innerHTML = `
                            <td>${expense.type || 'N/A'}</td>
                            <td>${formattedDate}</td>
                            <td>${expense.vendor || 'N/A'}</td>
                            <td>${extractCity(expense.location)}</td>
                            <td>$${parseFloat(expense.cost || 0).toFixed(2)}</td>
                            <td class="receipt-cell">
                                ${expense.receiptPath ? `
                                    <div class="receipt-container">
                                        <img src="${expense.receiptPath}" alt="Receipt" class="receipt-thumbnail" data-path="${expense.receiptPath}">
                                        <a href="${expense.receiptPath}" download class="download-receipt" title="Download Receipt">
                                            <i class="fas fa-file-arrow-down"></i>
                                        </a>
                                    </div>
                                ` : '<i class="fas fa-receipt receipt-placeholder"></i>'}
                            </td>
                            <td>
                                <div class="btn-group">
                                    <button class="btn-small edit-expense" data-id="${expense.id}">Edit</button>
                                    <button class="btn-small btn-danger delete-expense" data-id="${expense.id}">Delete</button>
                                </div>
                            </td>
                        `;
                        expenseList.appendChild(row);

                        // Add event listeners
                        const editButton = row.querySelector('.edit-expense');
                        const deleteButton = row.querySelector('.delete-expense');
                        const receiptThumbnail = row.querySelector('.receipt-thumbnail');

                        if (editButton) editButton.addEventListener('click', () => handleEditClick(expense.id));
                        if (deleteButton) deleteButton.addEventListener('click', () => openDeleteModal(expense.id));
                        if (receiptThumbnail) receiptThumbnail.addEventListener('click', () => openReceiptModal(expense.receiptPath));
                    });
                });
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
            expenseList.innerHTML = '<tr><td colspan="7">Error loading expenses.</td></tr>';
            showToast('Failed to load expenses', 'error');
        } finally {
            hideLoading();
        }
    };

    const handleEditClick = async (expenseId) => {
        if (!isLoggedIn()) return; // Should not be possible if UI is correct, but safety check
        try {
            showLoading();
            // Use fetchWithAuth
            const response = await fetchWithAuth(`/api/expenses/${expenseId}`);
            if (!response.ok) {
                // fetchWithAuth handles 401/403
                if (response.status !== 401 && response.status !== 403) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                } else {
                    return; // Stop processing on auth error
                }
            }
            const expense = await response.json();
            populateFormForEdit(expense);
        } catch (error) {
            console.error('Error fetching expense details:', error);
            showToast('Failed to load expense details', 'error');
        } finally {
            hideLoading();
        }
    };

    const addExpense = async (formData) => {
        if (!isLoggedIn()) return;
        try {
            showLoading();
            // Use fetchWithAuth
            const response = await fetchWithAuth('/api/expenses', { method: 'POST', body: formData });
            if (!response.ok) {
                 // fetchWithAuth handles 401/403
                 if (response.status === 400) {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) throw new Error(`Validation Error: ${errorData.errors.map(err => err.msg).join(' ')}`);
                 }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('Expense added:', result);
            showToast('Expense added successfully');
            resetForm();
            await fetchAndDisplayExpenses();
        } catch (error) {
            console.error('Error adding expense:', error);
            let errorMessage = error.message.startsWith('Validation Error:') ? error.message.replace('Validation Error: ', '') : 'Failed to add expense';
            showToast(errorMessage, 'error');
        } finally {
            hideLoading();
        }
    };

    const updateExpense = async (expenseId, formData) => {
        if (!isLoggedIn()) return;
        try {
            showLoading();
            // Use fetchWithAuth
            const response = await fetchWithAuth(`/api/expenses/${expenseId}`, { method: 'PUT', body: formData });
             if (!response.ok) {
                 // fetchWithAuth handles 401/403
                 if (response.status === 400) {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) throw new Error(`Validation Error: ${errorData.errors.map(err => err.msg).join(' ')}`);
                 }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('Expense updated:', result);
            showToast('Expense updated successfully');
            resetForm();
            await fetchAndDisplayExpenses();
        } catch (error) {
            console.error('Error updating expense:', error);
            let errorMessage = error.message.startsWith('Validation Error:') ? error.message.replace('Validation Error: ', '') : 'Failed to update expense';
            showToast(errorMessage, 'error');
        } finally {
            hideLoading();
        }
    };

    const deleteExpense = async (expenseId) => {
        if (!isLoggedIn()) return;
        try {
            showLoading();
            // Use fetchWithAuth
            const response = await fetchWithAuth(`/api/expenses/${expenseId}`, { method: 'DELETE' });
            if (!response.ok) {
                // fetchWithAuth handles 401/403
                if (response.status !== 401 && response.status !== 403) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                } else {
                    return; // Stop processing on auth error
                }
            }
            console.log('Expense deleted:', expenseId);
            showToast('Expense deleted successfully');
            await fetchAndDisplayExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
            showToast('Failed to delete expense', 'error');
        } finally {
            hideLoading();
            closeDeleteModal();
        }
    };

    const handleExportClick = async (tripName, filename) => {
        if (!isLoggedIn()) {
            showToast('Please log in to export expenses.', 'error');
            return;
        }
        console.log(`Exporting trip: ${tripName}, Filename: ${filename}`);
        showLoadingOverlay(); // Show overlay during fetch/download prep

        try {
            const response = await fetchWithAuth(`/api/export-expenses?tripName=${encodeURIComponent(tripName)}`);

            if (!response.ok) {
                // Try to get error message from body, otherwise use status text
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json(); // Or response.text() if error isn't JSON
                    errorMsg = errorData.message || errorMsg;
                } catch (e) { /* Ignore parsing error, use status text */ }
                throw new Error(errorMsg);
            }

            // Get the blob data (the Excel file)
            const blob = await response.blob();

            // Create a temporary URL for the blob
            const url = window.URL.createObjectURL(blob);

            // Create a temporary link element to trigger the download
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename || 'expenses.xlsx'; // Use the filename from data attribute or a default
            document.body.appendChild(a);

            // Click the link to start download
            a.click();

            // Clean up: revoke the object URL and remove the link
            window.URL.revokeObjectURL(url);
            a.remove();

            showToast(`Exported ${filename} successfully.`);

        } catch (error) {
            console.error('Error exporting expenses:', error);
            // Avoid showing duplicate auth errors
            if (error.message !== 'Authentication required') {
                showToast(`Failed to export expenses: ${error.message}`, 'error');
            }
        } finally {
            hideLoadingOverlay(); // Hide overlay after download starts or on error
        }
    };

    // --- Utility Functions ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            // Handle both Date objects and YYYY-MM-DD strings
            const date = new Date(dateString);
             // Check if it's a valid date object; if not, try adding time for timezone robustness
             if (isNaN(date.getTime())) {
                 const dateWithTime = new Date(dateString + 'T00:00:00');
                 if (isNaN(dateWithTime.getTime())) return 'Invalid Date'; // Still invalid
                 const options = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }; // Use UTC
                 return dateWithTime.toLocaleDateString(undefined, options);
             }
            const options = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }; // Use UTC
            return date.toLocaleDateString(undefined, options);
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return 'Invalid Date';
        }
    };

    // --- Frontend Validation Function ---
    const validateExpenseForm = () => {
        const typeInput = document.getElementById('type');
        const dateInput = document.getElementById('date');
        const vendorInput = document.getElementById('vendor');
        const locationInput = document.getElementById('location');
        const costInput = document.getElementById('cost');
        const tripNameInput = document.getElementById('tripName'); // Main trip name input

        const type = typeInput.value.trim();
        const date = dateInput.value.trim();
        const vendor = vendorInput.value.trim();
        const location = locationInput.value.trim();
        const cost = costInput.value.trim();
        const tripName = tripNameInput.value.trim();

        // --- DEBUG LOG ---
        console.log("Validating Date Input:", date);
        // --- END DEBUG LOG ---

        let isValid = true;
        let errors = [];

        // Required fields check (TripName only required for NEW expenses)
        if (!currentExpenseId && !tripName) {
            errors.push('Trip Name is required.');
            isValid = false;
            tripNameInput.classList.add('is-invalid'); // Add visual feedback
        } else {
             tripNameInput.classList.remove('is-invalid');
        }

        if (!type) {
            errors.push('Type is required.');
            isValid = false;
            typeInput.classList.add('is-invalid');
        } else {
             typeInput.classList.remove('is-invalid');
        }

        if (!date) {
            errors.push('Date is required.');
            isValid = false;
            dateInput.classList.add('is-invalid');
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            // Check if it's potentially a Date object converted to string - less likely here
            // but the main check is the format YYYY-MM-DD
            errors.push('Date must be in YYYY-MM-DD format.');
            isValid = false;
            dateInput.classList.add('is-invalid');
        } else {
             dateInput.classList.remove('is-invalid');
        }

        if (!vendor) {
            errors.push('Vendor is required.');
            isValid = false;
            vendorInput.classList.add('is-invalid');
        } else {
             vendorInput.classList.remove('is-invalid');
        }

        if (!location) {
            errors.push('Location is required.');
            isValid = false;
            locationInput.classList.add('is-invalid');
        } else {
             locationInput.classList.remove('is-invalid');
        }

        if (!cost) {
            errors.push('Cost is required.');
            isValid = false;
            costInput.classList.add('is-invalid');
        } else if (isNaN(parseFloat(cost)) || parseFloat(cost) <= 0) {
            errors.push('Cost must be a positive number.');
            isValid = false;
            costInput.classList.add('is-invalid');
        } else {
             costInput.classList.remove('is-invalid');
        }

        if (!isValid) {
            showToast(errors.join(' '), 'error');
        } else {
             // Remove potential error classes if form is now valid
             [typeInput, dateInput, vendorInput, locationInput, costInput, tripNameInput].forEach(el => el.classList.remove('is-invalid'));
        }

        return isValid;
    };


    // --- Process Receipt Function ---
    const processReceipt = async (formData) => { /* ... unchanged ... */
        try {
            showLoadingOverlay(); showLoading();
            currentReceiptFile = formData.get('receipt');
            const settings = JSON.parse(localStorage.getItem('expenseTrackerSettings')) || {};
            const ocrMethod = settings.ocrMethod || 'builtin';
            const processFormData = new FormData();
            processFormData.append('receipt', currentReceiptFile);
            processFormData.append('ocrMethod', ocrMethod);
            let apiKey = '', model = '';
            switch (ocrMethod) { /* ... unchanged api key logic ... */
                case 'openai': apiKey = settings.openaiApiKey; model = settings.openaiModel || 'gpt-4-vision-preview'; if (!apiKey) { showToast('OpenAI API key not found.', 'error'); hideLoadingOverlay(); hideLoading(); return; } processFormData.append('apiKey', apiKey); processFormData.append('model', model); break;
                case 'gemini': apiKey = settings.geminiApiKey; model = settings.geminiModel || 'gemini-pro-vision'; if (!apiKey) { showToast('Gemini API key not found.', 'error'); hideLoadingOverlay(); hideLoading(); return; } processFormData.append('apiKey', apiKey); processFormData.append('model', model); break;
                case 'claude': apiKey = settings.claudeApiKey; model = settings.claudeModel || 'claude-3-opus'; if (!apiKey) { showToast('Claude API key not found.', 'error'); hideLoadingOverlay(); hideLoading(); return; } processFormData.append('apiKey', apiKey); processFormData.append('model', model); break;
                case 'openrouter': apiKey = settings.openrouterApiKey; model = settings.openrouterModel || 'anthropic/claude-3-opus'; if (!apiKey) { showToast('Open Router API key not found.', 'error'); hideLoadingOverlay(); hideLoading(); return; } processFormData.append('apiKey', apiKey); processFormData.append('model', model); break;
            }
            // Use fetchWithAuth (even though route might not be protected yet, for consistency)
            const response = await fetchWithAuth('/api/test-ocr', { method: 'POST', body: processFormData });
            if (!response.ok) {
                // fetchWithAuth handles 401/403
                if (response.status !== 401 && response.status !== 403) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                } else {
                    return; // Stop processing on auth error
                }
            }
            const result = await response.json();
            console.log('Receipt processed:', result);
            if (result.type || result.date || result.cost) {
                showEditStep(result); // Pass the result object directly
                showToast('Receipt processed successfully! Please review.');
            } else {
                showEditStep({});
                showToast('Could not extract details. Please fill manually.', 'warning');
            }
        } catch (error) {
            console.error('Error processing receipt:', error);
            showEditStep({});
            showToast('Could not process receipt. Please fill manually.', 'error');
        } finally {
            hideLoadingOverlay(); hideLoading();
        }
    };

    // --- Auth Handlers ---
    const handleLogin = async (event) => {
        event.preventDefault();
        showLoadingOverlay();
        const formData = new FormData(loginForm);
        const loginData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `HTTP error! status: ${response.status}`);
            }

            saveToken(result.token, { id: result.userId, username: result.username });
            showToast('Login successful!');
            updateUIForAuthState();
            fetchAndDisplayExpenses(); // Fetch expenses after login
            loginForm.reset();

        } catch (error) {
            console.error('Login failed:', error);
            showToast(error.message || 'Login failed. Please check username/password.', 'error');
        } finally {
            hideLoadingOverlay();
        }
    };

    const handleRegister = async (event) => {
        event.preventDefault();
        showLoadingOverlay();
        const formData = new FormData(registerForm);
        const registerData = Object.fromEntries(formData.entries());

        if (registerData.password.length < 6) {
             showToast('Password must be at least 6 characters long.', 'error');
             hideLoadingOverlay();
             return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerData)
            });

            const result = await response.json();

            if (!response.ok) {
                // Handle specific validation errors from backend if available
                if (response.status === 400 && result.errors) {
                    const errorMessages = result.errors.map(err => err.msg).join(' ');
                    throw new Error(errorMessages);
                }
                throw new Error(result.message || `HTTP error! status: ${response.status}`);
            }

            showToast('Registration successful! Please log in.');
            registerForm.reset();
            // Switch back to login form
            registerFormContainer.classList.add('hidden');
            loginFormContainer.classList.remove('hidden');

        } catch (error) {
            console.error('Registration failed:', error);
            showToast(error.message || 'Registration failed. Please try again.', 'error');
        } finally {
            hideLoadingOverlay();
        }
    };

    const handleLogout = () => {
        clearToken();
        showToast('Logged out successfully.');
        updateUIForAuthState();
        // Optionally clear form fields or reset completely
        resetForm();
    };

    // --- Event Listeners ---

    // Delegated listener for export buttons within the expense list
    expenseList.addEventListener('click', (event) => {
        if (event.target.closest('.export-trip-button')) {
            const button = event.target.closest('.export-trip-button');
            const tripName = decodeURIComponent(button.dataset.tripname);
            const filename = button.dataset.filename;
            handleExportClick(tripName, filename);
        }
    });

    // Auth form listeners
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    logoutButton.addEventListener('click', handleLogout);

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
    });

    // Existing listeners
    receiptUploadForm.addEventListener('submit', async (event) => { /* ... unchanged ... */
        const formData = new FormData(receiptUploadForm);
        const tripNameInput = document.getElementById('tripName');
        if (!tripNameInput || !tripNameInput.value.trim()) { showToast('Please enter a Trip Name', 'error'); tripNameInput.focus(); return; }
        if (!formData.get('receipt') || formData.get('receipt').size === 0) { showToast('Please select a receipt file', 'error'); return; }
        await processReceipt(formData);
    });

    expenseForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // --- Frontend Validation ---
        if (!validateExpenseForm()) {
            return; // Stop submission if validation fails
        }
        // --- End Frontend Validation ---


        const formData = new FormData(expenseForm);
        const dateValue = formData.get('date'); // Get date before potentially adding file

        // --- DEBUG LOG ---
        console.log("Submitting Date Value:", dateValue);
        // --- END DEBUG LOG ---


        // Add the receipt file if we have one (from initial upload or if editing without changing receipt)
        if (currentReceiptFile) {
            formData.append('receipt', currentReceiptFile);
        } else if (currentExpenseId) {
            formData.delete('receipt');
        }

        // Explicitly add the Trip Name from the main page input
        const tripNameInput = document.getElementById('tripName');
        if (tripNameInput && tripNameInput.value) {
            formData.set('tripName', tripNameInput.value);
        } else {
             formData.delete('tripName');
        }

        if (currentExpenseId) {
            await updateExpense(currentExpenseId, formData);
        } else {
            if (!currentReceiptFile) { showToast('Receipt file is missing.', 'error'); return; }
            await addExpense(formData);
        }
    });

    cancelEditButton.addEventListener('click', resetForm);

    closeModal.addEventListener('click', closeReceiptModal);
    window.addEventListener('click', (event) => { /* ... unchanged ... */
        if (event.target === receiptModal) closeReceiptModal();
        if (event.target === deleteModal) closeDeleteModal();
    });

    confirmDeleteButton.addEventListener('click', () => { /* ... unchanged ... */
        if (expenseToDelete) deleteExpense(expenseToDelete);
    });

    cancelDeleteButton.addEventListener('click', closeDeleteModal);

    // --- Initialize ---
    // Check login status on load
    updateUIForAuthState();
    if (isLoggedIn()) {
        fetchAndDisplayExpenses(); // Fetch expenses only if logged in
    } else {
        resetForm(); // Reset form if not logged in
    }
    // resetForm(); // Reset form is now handled based on login state
    // fetchAndDisplayExpenses(); // Fetching is now handled based on login state
});