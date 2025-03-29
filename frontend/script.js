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
        showLoading();
        try {
            const response = await fetch('/api/expenses');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            expenses = await response.json();

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
                    // Span 7 columns: Type, Date, Vendor, Location, Cost, Receipt, Actions
                    // Add an export button for this specific trip
                    headerRow.innerHTML = `
                        <td colspan="7">
                            <span>${tripName}</span>
                            <a href="/api/export-expenses?tripName=${encodeURIComponent(tripName)}"
                               class="btn-small btn-secondary export-trip-button"
                               download="${tripName.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_') || 'trip'}.xlsx"
                               title="Generate Expense Sheet for ${tripName}">
                                <i class="fas fa-file-excel"></i> Generate Expense Sheet
                            </a>
                        </td>`;
                    expenseList.appendChild(headerRow);

                    // Render expenses for this trip
                    groupedExpenses[tripName].forEach(expense => {
                        const row = document.createElement('tr');
                        // Extract city from location if possible (moved outside loop for efficiency)
                        const extractCity = (location) => {
                            if (!location) return 'N/A';
                            const cityStateMatch = location.match(/([^,]+),/);
                            if (cityStateMatch) return cityStateMatch[1].trim();
                            const words = location.split(' ');
                            for (const word of words) { if (isNaN(word) && word.length > 1) return word; }
                            return location.length > 15 ? location.substring(0, 15) + '...' : location;
                        };

                        row.innerHTML = `
                            <td>${expense.type || 'N/A'}</td>
                            <td>${formatDate(expense.date)}</td>
                            <td>${expense.vendor || expense.location || 'N/A'}</td>
                            <td>${extractCity(expense.location)}</td>
                            <td>$${parseFloat(expense.cost).toFixed(2)}</td>
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

                        // Add event listeners to the buttons and thumbnail
                        const editButton = row.querySelector('.edit-expense');
                        const deleteButton = row.querySelector('.delete-expense');
                        const receiptThumbnail = row.querySelector('.receipt-thumbnail');

                        // --- DIAGNOSTIC LOGS ---
                        // console.log(`Row for expense ${expense.id} (Trip: ${expense.tripName || 'N/A'})`);
                        // console.log(`  Receipt Path: ${expense.receiptPath}`);
                        // console.log(`  Edit Button Found: ${!!editButton}`);
                        // console.log(`  Delete Button Found: ${!!deleteButton}`);
                        // console.log(`  Thumbnail Found: ${!!receiptThumbnail}`);
                        // --- END DIAGNOSTIC LOGS ---

                        if (editButton) {
                            editButton.addEventListener('click', () => handleEditClick(expense.id));
                        }

                        if (deleteButton) {
                            deleteButton.addEventListener('click', () => openDeleteModal(expense.id));
                        }

                        if (receiptThumbnail) {
                            receiptThumbnail.addEventListener('click', () => openReceiptModal(expense.receiptPath));
                        }
                        // Removed duplicate event listener attachment block that was here.
                    });
                });
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
            expenseList.innerHTML = '<tr><td colspan="7">Error loading expenses.</td></tr>'; // Display error in table row
            showToast('Failed to load expenses', 'error');
        } finally {
            hideLoading();
        }
    };

    const handleEditClick = async (expenseId) => {
        try {
            showLoading();
            const response = await fetch(`/api/expenses/${expenseId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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
        try {
            showLoading();
            const response = await fetch('/api/expenses', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                 // Try to parse error response from backend validation
                 if (response.status === 400) {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) {
                        const errorMessages = errorData.errors.map(err => err.msg).join(' ');
                        throw new Error(`Validation Error: ${errorMessages}`);
                    }
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
            let errorMessage = 'Failed to add expense';

            // Use specific validation error message if available
            if (error.message.startsWith('Validation Error:')) {
                errorMessage = error.message.replace('Validation Error: ', '');
            } else if (error.message.includes('HTTP error')) {
                // Keep existing logic for other HTTP errors
                try {
                    const errorResponse = await fetch('/api/expenses'); // Re-fetch might not be ideal here
                    const errorData = await errorResponse.json();
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                    if (errorData.missingFields) {
                        if (errorData.missingFields.date && errorData.missingFields.cost) {
                            errorMessage += ' Could not detect date and cost from receipt.';
                        } else if (errorData.missingFields.date) {
                            errorMessage += ' Could not detect date from receipt.';
                        } else if (errorData.missingFields.cost) {
                            errorMessage += ' Could not detect cost from receipt.';
                        }
                    }
                } catch (e) {
                    console.error('Error parsing error response:', e);
                }
            }

            showToast(errorMessage, 'error');
        } finally {
            hideLoading();
        }
    };

    const updateExpense = async (expenseId, formData) => {
        try {
            showLoading();
            const response = await fetch(`/api/expenses/${expenseId}`, {
                method: 'PUT',
                body: formData
            });

            if (!response.ok) {
                 // Try to parse error response from backend validation
                 if (response.status === 400) {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) {
                        const errorMessages = errorData.errors.map(err => err.msg).join(' ');
                        throw new Error(`Validation Error: ${errorMessages}`);
                    }
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
            let errorMessage = 'Failed to update expense';

             // Use specific validation error message if available
             if (error.message.startsWith('Validation Error:')) {
                errorMessage = error.message.replace('Validation Error: ', '');
            } else if (error.message.includes('HTTP error')) {
                // Keep existing logic for other HTTP errors
                try {
                    const errorResponse = await fetch(`/api/expenses/${expenseId}`); // Re-fetch might not be ideal
                    const errorData = await errorResponse.json();
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                    if (errorData.missingFields) {
                        if (errorData.missingFields.date && errorData.missingFields.cost) {
                            errorMessage += ' Could not detect date and cost from receipt.';
                        } else if (errorData.missingFields.date) {
                            errorMessage += ' Could not detect date from receipt.';
                        } else if (errorData.missingFields.cost) {
                            errorMessage += ' Could not detect cost from receipt.';
                        }
                    }
                } catch (e) {
                    console.error('Error parsing error response:', e);
                }
            }

            showToast(errorMessage, 'error');
        } finally {
            hideLoading();
        }
    };

    const deleteExpense = async (expenseId) => {
        try {
            showLoading();
            const response = await fetch(`/api/expenses/${expenseId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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

    // --- Utility Functions ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            // Assuming dateString is YYYY-MM-DD or can be parsed by Date
            const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
            if (isNaN(date)) return 'Invalid Date';
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return date.toLocaleDateString(undefined, options);
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return 'Invalid Date';
        }
    };

    // --- Frontend Validation Function ---
    const validateExpenseForm = () => {
        const type = document.getElementById('type').value.trim();
        const date = document.getElementById('date').value.trim();
        const vendor = document.getElementById('vendor').value.trim();
        const location = document.getElementById('location').value.trim();
        const cost = document.getElementById('cost').value.trim();
        const tripName = document.getElementById('tripName').value.trim(); // Get trip name from main input

        let isValid = true;
        let errors = [];

        // Required fields check (TripName only required for NEW expenses)
        if (!currentExpenseId && !tripName) {
            errors.push('Trip Name is required.');
            isValid = false;
        }
        if (!type) {
            errors.push('Type is required.');
            isValid = false;
        }
        if (!date) {
            errors.push('Date is required.');
            isValid = false;
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            errors.push('Date must be in YYYY-MM-DD format.');
            isValid = false;
        }
        if (!vendor) {
            errors.push('Vendor is required.');
            isValid = false;
        }
        if (!location) {
            errors.push('Location is required.');
            isValid = false;
        }
        if (!cost) {
            errors.push('Cost is required.');
            isValid = false;
        } else if (isNaN(parseFloat(cost)) || parseFloat(cost) <= 0) {
            errors.push('Cost must be a positive number.');
            isValid = false;
        }

        if (!isValid) {
            showToast(errors.join(' '), 'error');
        }

        return isValid;
    };


    // --- Process Receipt Function ---
    const processReceipt = async (formData) => {
        try {
            showLoadingOverlay();
            showLoading();

            // Store the receipt file for later use
            currentReceiptFile = formData.get('receipt');

            // Get OCR settings
            const settings = JSON.parse(localStorage.getItem('expenseTrackerSettings')) || {};
            const ocrMethod = settings.ocrMethod || 'builtin';

            // Create a new FormData with the receipt and OCR settings
            const processFormData = new FormData();
            processFormData.append('receipt', currentReceiptFile);
            processFormData.append('ocrMethod', ocrMethod);

            // Add API key and model based on selected provider
            let apiKey = '';
            let model = '';

            switch (ocrMethod) {
                case 'openai':
                    apiKey = settings.openaiApiKey;
                    model = settings.openaiModel || 'gpt-4-vision-preview';
                    if (!apiKey) {
                        showToast('OpenAI API key not found. Please configure it in Settings.', 'error');
                        hideLoadingOverlay(); hideLoading(); return;
                    }
                    processFormData.append('apiKey', apiKey);
                    processFormData.append('model', model);
                    break;
                case 'gemini':
                    apiKey = settings.geminiApiKey;
                    model = settings.geminiModel || 'gemini-pro-vision'; // This now includes 'gemini-2.0-flash'
                    if (!apiKey) {
                        showToast('Gemini API key not found. Please configure it in Settings.', 'error');
                        hideLoadingOverlay(); hideLoading(); return;
                    }
                    processFormData.append('apiKey', apiKey);
                    processFormData.append('model', model);
                    break;
                case 'claude':
                    apiKey = settings.claudeApiKey;
                    model = settings.claudeModel || 'claude-3-opus';
                    if (!apiKey) {
                        showToast('Claude API key not found. Please configure it in Settings.', 'error');
                        hideLoadingOverlay(); hideLoading(); return;
                    }
                    processFormData.append('apiKey', apiKey);
                    processFormData.append('model', model);
                    break;
                case 'openrouter':
                    apiKey = settings.openrouterApiKey;
                    model = settings.openrouterModel || 'anthropic/claude-3-opus';
                    if (!apiKey) {
                        showToast('Open Router API key not found. Please configure it in Settings.', 'error');
                        hideLoadingOverlay(); hideLoading(); return;
                    }
                    processFormData.append('apiKey', apiKey);
                    processFormData.append('model', model);
                    break;
            }

            // Send the receipt for processing
            const response = await fetch('/api/test-ocr', {
                method: 'POST',
                body: processFormData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Receipt processed:', result);

            if (result.type || result.date || result.cost) {
                // Show the edit step with the extracted data
                showEditStep(result.extractedData); // Use extractedData object
                showToast('Receipt processed successfully! Please review the extracted information.');
            } else {
                // Show the edit step with empty fields
                showEditStep({});
                showToast('Receipt uploaded, but could not extract all details. Please fill in the missing information.', 'warning');
            }

        } catch (error) {
            console.error('Error processing receipt:', error);

            // If there's an error, still show the edit step but with empty fields
            showEditStep({});
            showToast('Could not process receipt. Please fill in the details manually.', 'error');

        } finally {
            hideLoadingOverlay();
            hideLoading();
        }
    };

    // --- Event Listeners ---
    receiptUploadForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(receiptUploadForm);
        const tripNameInput = document.getElementById('tripName');

        // Check if Trip Name is provided
        if (!tripNameInput || !tripNameInput.value.trim()) {
             showToast('Please enter a Trip Name', 'error');
             tripNameInput.focus(); // Focus the input field
             return;
        }

        // Check if a file was selected
        if (!formData.get('receipt') || formData.get('receipt').size === 0) {
            showToast('Please select a receipt file', 'error');
            return;
        }

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

        // Add the receipt file if we have one (from initial upload or if editing without changing receipt)
        if (currentReceiptFile) {
            formData.append('receipt', currentReceiptFile);
        } else if (currentExpenseId) {
            // If editing and no *new* file was selected via processReceipt,
            // we don't need to send the 'receipt' field at all, backend will keep the old one.
            formData.delete('receipt');
        }

        // Explicitly add the Trip Name from the main page input
        const tripNameInput = document.getElementById('tripName');
        if (tripNameInput && tripNameInput.value) {
            formData.set('tripName', tripNameInput.value); // Use set to overwrite if already present
        } else {
             formData.delete('tripName'); // Ensure it's not sent if empty (relevant for updates)
        }

        if (currentExpenseId) {
            await updateExpense(currentExpenseId, formData);
        } else {
            // Ensure receipt file exists for adding new expense
            if (!currentReceiptFile) {
                 showToast('Receipt file is missing. Please upload a receipt first.', 'error');
                 return;
            }
            await addExpense(formData);
        }
    });

    cancelEditButton.addEventListener('click', resetForm);

    // Removed event listener for the old global export button

    closeModal.addEventListener('click', closeReceiptModal);
    window.addEventListener('click', (event) => {
        if (event.target === receiptModal) {
            closeReceiptModal();
        }
        if (event.target === deleteModal) {
            closeDeleteModal();
        }
    });

    confirmDeleteButton.addEventListener('click', () => {
        if (expenseToDelete) {
            deleteExpense(expenseToDelete);
        }
    });

    cancelDeleteButton.addEventListener('click', closeDeleteModal);

    // --- Initialize ---
    resetForm();
    fetchAndDisplayExpenses();
});