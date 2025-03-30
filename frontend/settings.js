document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const settingsForm = document.getElementById('settings-form');
    const ocrMethodSelect = document.getElementById('ocr-method');
    const aiSettings = document.getElementById('ai-settings');
    const apiKeyInput = document.getElementById('api-key');
    const saveApiKeyCheckbox = document.getElementById('save-api-key');
    const testOcrSection = document.getElementById('test-ocr-section');
    const testOcrForm = document.getElementById('test-ocr-form');
    const testResults = document.getElementById('test-results');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    // Load saved settings
    loadSettings();
    
    // Event Listeners
    ocrMethodSelect.addEventListener('change', handleOcrMethodChange);
    settingsForm.addEventListener('submit', saveSettings);
    testOcrForm.addEventListener('submit', testOCR);
    
    // --- Toast Notification Functions ---
    function showToast(message, type = 'success') {
        toast.className = `toast ${type}`;
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // --- Settings Functions ---
    function handleOcrMethodChange() {
        const selectedMethod = ocrMethodSelect.value;
        
        // Show/hide AI settings section
        if (selectedMethod === 'builtin') {
            aiSettings.classList.add('hidden');
            testOcrSection.classList.add('hidden');
        } else {
            aiSettings.classList.remove('hidden');
            testOcrSection.classList.remove('hidden');
            
            // Hide all provider settings first
            document.querySelectorAll('.provider-settings').forEach(el => {
                el.classList.add('hidden');
            });
            
            // Show the selected provider settings
            switch (selectedMethod) {
                case 'openai':
                    document.getElementById('openai-settings').classList.remove('hidden');
                    break;
                case 'gemini':
                    document.getElementById('gemini-settings').classList.remove('hidden');
                    break;
                case 'claude':
                    document.getElementById('claude-settings').classList.remove('hidden');
                    break;
                case 'openrouter':
                    document.getElementById('openrouter-settings').classList.remove('hidden');
                    break;
            }
        }
    }
    
    function loadSettings() {
        try {
            // Try to load settings from localStorage
            const settings = JSON.parse(localStorage.getItem('expenseTrackerSettings')) || {};
            
            // Set OCR method
            if (settings.ocrMethod) {
                ocrMethodSelect.value = settings.ocrMethod;
            }
            
            // Load API keys for different providers
            if (settings.openaiApiKey) {
                document.getElementById('openai-api-key').value = settings.openaiApiKey;
            }
            
            if (settings.geminiApiKey) {
                document.getElementById('gemini-api-key').value = settings.geminiApiKey;
            }
            
            if (settings.claudeApiKey) {
                document.getElementById('claude-api-key').value = settings.claudeApiKey;
            }
            
            if (settings.openrouterApiKey) {
                document.getElementById('openrouter-api-key').value = settings.openrouterApiKey;
            }
            
            // Load model selections
            if (settings.openaiModel) {
                document.getElementById('openai-model').value = settings.openaiModel;
            }
            
            
            if (settings.geminiModel) {
                // Ensure the saved value exists in the dropdown
                const geminiSelect = document.getElementById('gemini-model');
                if ([...geminiSelect.options].some(option => option.value === settings.geminiModel)) {
                    geminiSelect.value = settings.geminiModel;
                } else {
                    geminiSelect.value = 'gemini-pro-vision'; // Default if saved value is invalid
                }
            }
            if (settings.claudeModel) {
                document.getElementById('claude-model').value = settings.claudeModel;
            }
            
            if (settings.openrouterModel) {
                document.getElementById('openrouter-model').value = settings.openrouterModel;
            }
            
            // Set save API key checkbox
            if (settings.saveApiKey !== undefined) {
                saveApiKeyCheckbox.checked = settings.saveApiKey;
            }
            
            // Update UI based on selected method
            handleOcrMethodChange();
            
        } catch (error) {
            console.error('Error loading settings:', error);
            showToast('Failed to load settings', 'error');
        }
    }
    
    // Make async to handle fetch
    async function saveSettings(event) {
        event.preventDefault();
        
        const saveButton = document.querySelector('#settings-form button[type="submit"]');
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        let backendUpdateSuccess = false;
        let localSaveSuccess = false;

        // 1. Prepare settings object for localStorage and backend
        const settings = {
            ocrMethod: ocrMethodSelect.value,
            saveApiKey: saveApiKeyCheckbox.checked, // Keep track if user wants keys in localStorage
            openaiModel: document.getElementById('openai-model').value,
            geminiModel: document.getElementById('gemini-model').value,
            claudeModel: document.getElementById('claude-model').value,
            openrouterModel: document.getElementById('openrouter-model').value,
        };

        // Get current keys from inputs
        const openaiKey = document.getElementById('openai-api-key').value;
        const geminiKey = document.getElementById('gemini-api-key').value;
        const claudeKey = document.getElementById('claude-api-key').value;
        const openrouterKey = document.getElementById('openrouter-api-key').value;

        // Prepare keys to send to backend for .env update
        // Send current values regardless of 'saveApiKey' checkbox,
        // allowing users to update/clear keys in .env via UI
        const keysForBackend = {
            OPENAI_API_KEY: openaiKey,
            GEMINI_API_KEY: geminiKey,
            CLAUDE_API_KEY: claudeKey,
            OPENROUTER_API_KEY: openrouterKey,
        };

        // 2. Attempt to update backend .env file
        try {
            const response = await fetch('/api/update-env', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(keysForBackend),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Failed to update keys on server');
            }
            console.log('Backend .env update response:', result.message);
            backendUpdateSuccess = true;
        } catch (error) {
            console.error('Error updating .env file via API:', error);
            showToast(`Error saving keys to server: ${error.message}`, 'error');
        }

        // 3. Update localStorage settings based on checkbox
        try {
            if (settings.saveApiKey) {
                // Save keys to localStorage object if checkbox is checked
                if (openaiKey) settings.openaiApiKey = openaiKey; else delete settings.openaiApiKey;
                if (geminiKey) settings.geminiApiKey = geminiKey; else delete settings.geminiApiKey;
                if (claudeKey) settings.claudeApiKey = claudeKey; else delete settings.claudeApiKey;
                if (openrouterKey) settings.openrouterApiKey = openrouterKey; else delete settings.openrouterApiKey;
            } else {
                // Ensure API keys are removed from localStorage object if checkbox is unchecked
                delete settings.openaiApiKey;
                delete settings.geminiApiKey;
                delete settings.claudeApiKey;
                delete settings.openrouterApiKey;
            }
            
            // Save the potentially modified settings object to localStorage
            localStorage.setItem('expenseTrackerSettings', JSON.stringify(settings));
            localSaveSuccess = true;
            console.log('Settings saved locally:', settings);

        } catch (error) {
            console.error('Error saving settings to localStorage:', error);
            showToast('Failed to save settings locally', 'error');
        }

        // 4. Show final status toast and update UI
        if (backendUpdateSuccess && localSaveSuccess) {
            showToast('Settings saved successfully!');
        } else if (localSaveSuccess && !backendUpdateSuccess) {
            showToast('Settings saved locally, but failed to save to server.', 'warning');
        } else if (!localSaveSuccess && backendUpdateSuccess) {
             showToast('Settings saved to server, but failed to save locally.', 'warning');
        } // If both fail, individual errors were already shown

        handleOcrMethodChange(); // Update UI visibility

        // Re-enable button
        saveButton.disabled = false;
        saveButton.textContent = 'Save Settings';
    }
    
    // --- Test OCR Functions ---
    async function testOCR(event) {
        event.preventDefault();
        
        const formData = new FormData(testOcrForm);
        const settings = JSON.parse(localStorage.getItem('expenseTrackerSettings')) || {};
        const selectedMethod = settings.ocrMethod || 'builtin';
        
        // Check if a file was selected
        if (!formData.get('receipt') || formData.get('receipt').size === 0) {
            showToast('Please select a receipt file', 'error');
            return;
        }
        
        // Add OCR method to form data
        formData.append('ocrMethod', selectedMethod);
        
        // API keys handled backend. Add model based on selected provider.
        let model = '';
        switch (selectedMethod) {
            case 'openai':
                model = document.getElementById('openai-model').value;
                formData.append('model', model);
                break;
            case 'gemini':
                model = document.getElementById('gemini-model').value;
                formData.append('model', model);
                break;
            case 'claude':
                model = document.getElementById('claude-model').value;
                formData.append('model', model);
                break;
            case 'openrouter':
                model = document.getElementById('openrouter-model').value;
                formData.append('model', model);
                break;
            // 'builtin' doesn't need a model passed
        }

        try {
            // Show loading state
            document.querySelector('#test-ocr-form button').textContent = 'Processing...';
            document.querySelector('#test-ocr-form button').disabled = true;
            
            // Send the receipt for processing
            const response = await fetch('/api/test-ocr', {
                method: 'POST',
                body: formData
            });
            
            // Try to parse JSON regardless of status, as error messages might be JSON
            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                // If JSON parsing fails, use the raw text response
                const textResponse = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, Response: ${textResponse}`);
            }

            if (!response.ok) {
                 // Use the message from the parsed JSON error response if available
                throw new Error(result.message || `HTTP error! status: ${response.status}`);
            }
            
            console.log('OCR test result:', result);
            
            // Display the results
            testResults.classList.remove('hidden');
            document.getElementById('result-type').textContent = result.type || 'Not detected';
            document.getElementById('result-date').textContent = result.date || 'Not detected';
            document.getElementById('result-vendor').textContent = result.vendor || 'Not detected';
            document.getElementById('result-location').textContent = result.location || 'Not detected';
            document.getElementById('result-cost').textContent = result.cost ? `$${result.cost}` : 'Not detected';
            
            showToast('OCR test completed');
            
        } catch (error) {
            console.error('Error testing OCR:', error);
            // Display the specific error message from the backend or fetch error
            showToast(`Failed to test OCR: ${error.message}`, 'error');
            // Optionally clear or hide the results section on error
            testResults.classList.add('hidden');
        } finally {
            // Reset button state
            document.querySelector('#test-ocr-form button').textContent = 'Test OCR';
            document.querySelector('#test-ocr-form button').disabled = false;
        }
    }
});