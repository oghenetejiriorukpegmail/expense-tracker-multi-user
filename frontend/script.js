document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expense-form');
    const expenseList = document.getElementById('expense-list');
    const exportButton = document.getElementById('export-button');

    // --- Fetch and Display Expenses ---
    const fetchAndDisplayExpenses = async () => {
        try {
            const response = await fetch('/api/expenses'); // Assuming backend runs on the same origin or proxy is set up
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const expenses = await response.json();

            expenseList.innerHTML = ''; // Clear current list

            if (expenses.length === 0) {
                expenseList.innerHTML = '<li>No expenses yet.</li>';
            } else {
                expenses.forEach(expense => {
                    const li = document.createElement('li');
                    // Display basic info - we can enhance this later
                    li.textContent = `${expense.date} - ${expense.type}: $${expense.cost} (${expense.location || 'N/A'}) ${expense.comments ? '- ' + expense.comments : ''}`;
                    // Add image link if available (placeholder for now)
                    if (expense.receiptPath) {
                         // In a real app, you might make this a clickable link/thumbnail
                        li.textContent += ` [Receipt Attached]`;
                    }
                    expenseList.appendChild(li);
                });
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
            expenseList.innerHTML = '<li>Error loading expenses.</li>';
        }
    };

    // --- Handle Form Submission ---
    expenseForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default browser submission

        const formData = new FormData(expenseForm);

        // Log FormData contents (for debugging)
        // for (let [key, value] of formData.entries()) {
        //     console.log(`${key}: ${value}`);
        // }

        try {
            const response = await fetch('/api/expenses', {
                method: 'POST',
                body: formData // FormData handles multipart/form-data encoding including files
                // No 'Content-Type' header needed when using FormData; browser sets it correctly
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Expense added:', result);

            // Clear the form after successful submission
            expenseForm.reset();

            // Refresh the list
            fetchAndDisplayExpenses();

        } catch (error) {
            console.error('Error adding expense:', error);
            alert('Failed to add expense. Please try again.'); // Simple user feedback
        }
    });

    // --- Handle Export Button ---
    exportButton.addEventListener('click', () => {
        // Simply navigate to the export endpoint. The browser will handle the download.
        window.location.href = '/api/expenses/export';
    });

    // --- Initial Load ---
    fetchAndDisplayExpenses();
});