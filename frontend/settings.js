document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const settingsForm = document.getElementById('settings-form');
    const ocrMethodSelect = document.getElementById('ocr-method');
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
    const aiSettings = document.getElementById('ai-settings');
    const saveApiKeyCheckbox = document.getElementById('save-api-key');
    const testOcrSection = document.getElementById('test-ocr-section');
    const testOcrForm = document.getElementById('test-ocr-form');
    const testResults = document.getElementById('test-results');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // Auth state
    let authToken = null;
    let currentUser = null;

    // Initial Auth Check
    updateUIForAuthState();

    // --- Auth Token Helpers ---
    function saveToken(token, user) {
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        authToken = token;
        currentUser = user;
    };

    function getToken() {
        authToken = localStorage.getItem('authToken');
        const userString = localStorage.getItem('currentUser');
        currentUser = userString ? JSON.parse(userString) : null;
        return authToken;
    };

    function clearToken() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        authToken = null;
        currentUser = null;
    };

    function isLoggedIn() {
        return !!getToken();
    };

    // --- UI Update Function ---
    function updateUIForAuthState() {
        const loggedIn = isLoggedIn();
        console.log("Settings: Updating UI for auth state:", loggedIn);
        if (!authSection || !appContent) {
             console.error("Settings: Could not find authSection or appContent elements!"); return;
        }
        if (loggedIn) {
            authSection.classList.add('hidden');
            appContent.classList.remove('hidden');
            navLogout.classList.remove('hidden');
            document.getElementById('nav-trips')?.classList.remove('hidden');
            document.getElementById('nav-add-expense')?.classList.remove('hidden');
            document.getElementById('nav-settings')?.classList.remove('hidden');
        } else {
            authSection.classList.remove('hidden');
            appContent.classList.add('hidden');
            navLogout.classList.add('hidden');
            loginFormContainer.classList.remove('hidden');
            registerFormContainer.classList.add('hidden');
            document.getElementById('nav-trips')?.classList.add('hidden');
            document.getElementById('nav-add-expense')?.classList.add('hidden');
            document.getElementById('nav-settings')?.classList.add('hidden');
        }
    };

    // --- API Fetch Helper ---
     async function fetchWithAuth(url, options = {}) {
        const token = getToken();
        const headers = { ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            console.log('Auth error detected, logging out.');
            clearToken();
            updateUIForAuthState();
            showToast('Session expired or invalid. Please log in again.', 'error');
            throw new Error('Authentication required');
        }
        return response;
    };

    // --- Toast Notification Functions ---
    function showToast(message, type = 'success') {
        if (!toast || !toastMessage) return; // Guard against missing elements
        toast.className = `toast ${type}`;
        toastMessage.textContent = message;
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }

    // --- Settings Functions ---
    function handleOcrMethodChange() {
        const selectedMethod = ocrMethodSelect.value;
        if (selectedMethod === 'builtin') {
            aiSettings.classList.add('hidden');
            testOcrSection.classList.add('hidden');
        } else {
            aiSettings.classList.remove('hidden');
            testOcrSection.classList.remove('hidden');
            document.querySelectorAll('.provider-settings').forEach(el => el.classList.add('hidden'));
            switch (selectedMethod) {
                case 'openai': document.getElementById('openai-settings').classList.remove('hidden'); break;
                case 'gemini': document.getElementById('gemini-settings').classList.remove('hidden'); break;
                case 'claude': document.getElementById('claude-settings').classList.remove('hidden'); break;
                case 'openrouter': document.getElementById('openrouter-settings').classList.remove('hidden'); break;
            }
        }
    }

    function loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('expenseTrackerSettings')) || {};
            if (settings.ocrMethod) ocrMethodSelect.value = settings.ocrMethod;
            if (settings.openaiApiKey) document.getElementById('openai-api-key').value = settings.openaiApiKey;
            if (settings.geminiApiKey) document.getElementById('gemini-api-key').value = settings.geminiApiKey;
            if (settings.claudeApiKey) document.getElementById('claude-api-key').value = settings.claudeApiKey;
            if (settings.openrouterApiKey) document.getElementById('openrouter-api-key').value = settings.openrouterApiKey;
            if (settings.openaiModel) document.getElementById('openai-model').value = settings.openaiModel;
            if (settings.geminiModel) {
                const geminiSelect = document.getElementById('gemini-model');
                if ([...geminiSelect.options].some(option => option.value === settings.geminiModel)) geminiSelect.value = settings.geminiModel;
                else geminiSelect.value = 'gemini-pro-vision';
            }
            if (settings.claudeModel) document.getElementById('claude-model').value = settings.claudeModel;
            if (settings.openrouterModel) document.getElementById('openrouter-model').value = settings.openrouterModel;
            if (settings.saveApiKey !== undefined) saveApiKeyCheckbox.checked = settings.saveApiKey;
            handleOcrMethodChange();
        } catch (error) {
            console.error('Error loading settings:', error);
            showToast('Failed to load settings', 'error');
        }
    }

    async function saveSettings(event) {
        event.preventDefault();
        const saveButton = document.querySelector('#settings-form button[type="submit"]');
        saveButton.disabled = true; saveButton.textContent = 'Saving...';
        let backendUpdateSuccess = false; let localSaveSuccess = false;
        const settings = {
            ocrMethod: ocrMethodSelect.value, saveApiKey: saveApiKeyCheckbox.checked,
            openaiModel: document.getElementById('openai-model').value,
            geminiModel: document.getElementById('gemini-model').value,
            claudeModel: document.getElementById('claude-model').value,
            openrouterModel: document.getElementById('openrouter-model').value,
        };
        const openaiKey = document.getElementById('openai-api-key').value;
        const geminiKey = document.getElementById('gemini-api-key').value;
        const claudeKey = document.getElementById('claude-api-key').value;
        const openrouterKey = document.getElementById('openrouter-api-key').value;
        const keysForBackend = {
            OPENAI_API_KEY: openaiKey, GEMINI_API_KEY: geminiKey,
            CLAUDE_API_KEY: claudeKey, OPENROUTER_API_KEY: openrouterKey,
        };
        try {
            const response = await fetchWithAuth('/api/update-env', { method: 'POST', body: keysForBackend });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || `Failed to update keys on server (Status: ${response.status})`);
            console.log('Backend .env update response:', result.message);
            backendUpdateSuccess = true;
        } catch (error) {
            console.error('Error updating .env file via API:', error);
            if (error.message !== 'Authentication required') showToast(`Error saving keys to server: ${error.message}`, 'error');
            backendUpdateSuccess = false;
        }
        try {
            if (settings.saveApiKey) {
                if (openaiKey) settings.openaiApiKey = openaiKey; else delete settings.openaiApiKey;
                if (geminiKey) settings.geminiApiKey = geminiKey; else delete settings.geminiApiKey;
                if (claudeKey) settings.claudeApiKey = claudeKey; else delete settings.claudeApiKey;
                if (openrouterKey) settings.openrouterApiKey = openrouterKey; else delete settings.openrouterApiKey;
            } else {
                delete settings.openaiApiKey; delete settings.geminiApiKey;
                delete settings.claudeApiKey; delete settings.openrouterApiKey;
            }
            localStorage.setItem('expenseTrackerSettings', JSON.stringify(settings));
            localSaveSuccess = true; console.log('Settings saved locally:', settings);
        } catch (error) {
            console.error('Error saving settings to localStorage:', error);
            showToast('Failed to save settings locally', 'error');
        }
        if (backendUpdateSuccess && localSaveSuccess) showToast('Settings saved successfully!');
        else if (localSaveSuccess && !backendUpdateSuccess) showToast('Settings saved locally, but failed to save to server.', 'warning');
        else if (!localSaveSuccess && backendUpdateSuccess) showToast('Settings saved to server, but failed to save locally.', 'warning');
        handleOcrMethodChange();
        saveButton.disabled = false; saveButton.textContent = 'Save Settings';
    }

    async function testOCR(event) {
        event.preventDefault();
        const formData = new FormData(testOcrForm);
        const settings = JSON.parse(localStorage.getItem('expenseTrackerSettings')) || {};
        const selectedMethod = settings.ocrMethod || 'builtin';
        if (!formData.get('receipt') || formData.get('receipt').size === 0) {
            showToast('Please select a receipt file', 'error'); return;
        }
        formData.append('ocrMethod', selectedMethod);
        let model = '';
        switch (selectedMethod) {
            case 'openai': model = document.getElementById('openai-model').value; formData.append('model', model); break;
            case 'gemini': model = document.getElementById('gemini-model').value; formData.append('model', model); break;
            case 'claude': model = document.getElementById('claude-model').value; formData.append('model', model); break;
            case 'openrouter': model = document.getElementById('openrouter-model').value; formData.append('model', model); break;
        }
        const testButton = document.querySelector('#test-ocr-form button');
        try {
            testButton.textContent = 'Processing...'; testButton.disabled = true;
            const response = await fetchWithAuth('/api/test-ocr', { method: 'POST', body: formData });
            let result;
            try { result = await response.json(); } catch (jsonError) {
                const textResponse = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, Response: ${textResponse}`);
            }
            if (!response.ok) throw new Error(result.message || `HTTP error! status: ${response.status}`);
            console.log('OCR test result:', result);
            testResults.classList.remove('hidden');
            document.getElementById('result-type').textContent = result.type || 'Not detected';
            document.getElementById('result-date').textContent = result.date || 'Not detected';
            document.getElementById('result-vendor').textContent = result.vendor || 'Not detected';
            document.getElementById('result-location').textContent = result.location || 'Not detected';
            document.getElementById('result-cost').textContent = result.cost ? `$${result.cost}` : 'Not detected';
            showToast('OCR test completed');
        } catch (error) {
            console.error('Error testing OCR:', error);
            showToast(`Failed to test OCR: ${error.message}`, 'error');
            testResults.classList.add('hidden');
        } finally {
            testButton.textContent = 'Test OCR'; testButton.disabled = false;
        }
    }

    // --- Auth Handlers ---
    async function handleLogin(event) {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const loginData = Object.fromEntries(formData.entries());
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || `HTTP error! status: ${response.status}`);
            saveToken(result.token, { id: result.userId, username: result.username });
            showToast('Login successful!');
            updateUIForAuthState();
            loadSettings(); // Reload settings after login
            loginForm.reset();
        } catch (error) {
            console.error('Login failed:', error);
            showToast(error.message || 'Login failed.', 'error');
        }
    };

     async function handleRegister(event) {
        event.preventDefault();
        const formData = new FormData(registerForm);
        const registerData = Object.fromEntries(formData.entries());
        if (registerData.password.length < 6) {
             showToast('Password must be at least 6 characters long.', 'error'); return;
        }
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerData)
            });
            const result = await response.json();
            if (!response.ok) {
                if (response.status === 400 && result.errors) throw new Error(result.errors.map(err => err.msg).join(' '));
                throw new Error(result.message || `HTTP error! status: ${response.status}`);
            }
            showToast('Registration successful! Please log in.');
            registerForm.reset();
            registerFormContainer.classList.add('hidden');
            loginFormContainer.classList.remove('hidden');
        } catch (error) {
            console.error('Registration failed:', error);
            showToast(error.message || 'Registration failed.', 'error');
        }
    };

    function handleLogout() {
        clearToken();
        showToast('Logged out successfully.');
        updateUIForAuthState();
        loadSettings(); // Reload settings (will show defaults)
    };

    // --- Event Listeners ---
    ocrMethodSelect.addEventListener('change', handleOcrMethodChange);
    settingsForm.addEventListener('submit', saveSettings);
    testOcrForm.addEventListener('submit', testOCR);
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

    // --- Initialize ---
    loadSettings(); // Load settings on initial load
    // updateUIForAuthState(); // Already called at the top
});