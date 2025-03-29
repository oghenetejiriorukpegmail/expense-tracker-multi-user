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
    
    function saveSettings(event) {
        event.preventDefault();
        
        try {
            const settings = {
                ocrMethod: ocrMethodSelect.value,
                saveApiKey: saveApiKeyCheckbox.checked
            };
            
            // Save model selections
            settings.openaiModel = document.getElementById('openai-model').value;
            settings.geminiModel = document.getElementById('gemini-model').value; // This now includes 'gemini-2.0-flash'
            settings.claudeModel = document.getElementById('claude-model').value;
            settings.openrouterModel = document.getElementById('openrouter-model').value;
            
            // Only save API keys if checkbox is checked
            if (settings.saveApiKey) {
                const openaiKey = document.getElementById('openai-api-key').value;
                const geminiKey = document.getElementById('gemini-api-key').value;
                const claudeKey = document.getElementById('claude-api-key').value;
                const openrouterKey = document.getElementById('openrouter-api-key').value;
                
                if (openaiKey) settings.openaiApiKey = openaiKey;
                if (geminiKey) settings.geminiApiKey = geminiKey;
                if (claudeKey) settings.claudeApiKey = claudeKey;
                if (openrouterKey) settings.openrouterApiKey = openrouterKey;
            } else {
                // Remove API keys from storage if not saving
                delete settings.openaiApiKey;
                delete settings.geminiApiKey;
                delete settings.claudeApiKey;
                delete settings.openrouterApiKey;
            }
            
            // Save settings to localStorage
            localStorage.setItem('expenseTrackerSettings', JSON.stringify(settings));
            
            showToast('Settings saved successfully');
            
            // Update UI based on selected method
            handleOcrMethodChange();
            
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Failed to save settings', 'error');
        }
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
        
        // Add API key and model based on selected provider
        let apiKey = '';
        let model = '';
        
        switch (selectedMethod) {
            case 'openai':
                apiKey = document.getElementById('openai-api-key').value;
                model = document.getElementById('openai-model').value;
                if (!apiKey) {
                    showToast('Please enter an OpenAI API key', 'error');
                    return;
                }
                formData.append('apiKey', apiKey);
                formData.append('model', model);
                break;
                
            case 'gemini':
                apiKey = document.getElementById('gemini-api-key').value;
                model = document.getElementById('gemini-model').value; // This now includes 'gemini-2.0-flash'
                if (!apiKey) {
                    showToast('Please enter a Gemini API key', 'error');
                    return;
                }
                formData.append('apiKey', apiKey);
                formData.append('model', model);
                break;
                
            case 'claude':
                apiKey = document.getElementById('claude-api-key').value;
                model = document.getElementById('claude-model').value;
                if (!apiKey) {
                    showToast('Please enter a Claude API key', 'error');
                    return;
                }
                formData.append('apiKey', apiKey);
                formData.append('model', model);
                break;
                
            case 'openrouter':
                apiKey = document.getElementById('openrouter-api-key').value;
                model = document.getElementById('openrouter-model').value;
                if (!apiKey) {
                    showToast('Please enter an Open Router API key', 'error');
                    return;
                }
                formData.append('apiKey', apiKey);
                formData.append('model', model);
                break;
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
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
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
            showToast('Failed to test OCR', 'error');
        } finally {
            // Reset button state
            document.querySelector('#test-ocr-form button').textContent = 'Test OCR';
            document.querySelector('#test-ocr-form button').disabled = false;
        }
    }
});