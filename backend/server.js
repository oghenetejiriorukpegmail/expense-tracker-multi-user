/**
 * Expense Tracker API Server
 * 
 * This server provides API endpoints for managing expenses, including
 * creating, reading, updating, and deleting expenses, as well as
 * OCR processing of receipts and exporting expenses to Excel.
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Import OCR utilities
const ocrUtils = require('./utils/ocr');
// Import database connection
const { db } = require('./database');
// Import authentication middleware
const authenticateToken = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
// const DATA_FILE = path.join(__dirname, 'data.json'); // Removed - Using database now
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// --- Multer Configuration ---
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
// Add file filter for common image/pdf types
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF and images are allowed.'), false);
    }
};
const upload = multer({ storage: storage, fileFilter: fileFilter });


// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(UPLOADS_DIR));
// Global error handler for Multer errors (like invalid file type)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error("Multer error:", err);
        return res.status(400).json({ message: `File upload error: ${err.message}` });
    } else if (err) {
        console.error("General error:", err);
         // Handle specific errors like invalid file type from filter
         if (err.message.startsWith('Invalid file type')) {
             return res.status(400).json({ message: err.message });
         }
        return res.status(500).json({ message: 'An unexpected error occurred.' });
    }
    next();
});


// --- Helper Functions (Removed readData/writeData, using database now) ---

/**
 * Updates the .env file with new key-value pairs.
 * IMPORTANT: In a real application, writing to .env via an API endpoint
 *            is a security risk and should be heavily protected or avoided.
 * @param {Object} newEnvVars - Object containing keys and values to update/add.
 */
const updateEnvFile = (newEnvVars) => {
    const envFilePath = path.join(__dirname, '.env');
    let envContent = '';

    // Read existing .env content if it exists
    if (fs.existsSync(envFilePath)) {
        envContent = fs.readFileSync(envFilePath, 'utf8');
    }

    let lines = envContent.split('\n');
    const updatedKeys = new Set(Object.keys(newEnvVars));

    // Update existing lines or add new ones
    lines = lines.map(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            return line; // Keep comments and empty lines
        }
        const [key] = trimmedLine.split('=');
        if (newEnvVars.hasOwnProperty(key)) {
            updatedKeys.delete(key); // Mark key as updated
            return `${key}=${newEnvVars[key]}`;
        }
        return line;
    });

    // Add any new keys that weren't in the original file
    updatedKeys.forEach(key => {
        lines.push(`${key}=${newEnvVars[key]}`);
    });

    // Write the updated content back to the .env file
    try {
        fs.writeFileSync(envFilePath, lines.join('\n'), 'utf8');
        console.log('.env file updated successfully.');
        // Reload dotenv to reflect changes in the current process
        // NOTE: This might not be reliable in all scenarios. A server restart is safer.
        require('dotenv').config({ override: true });
        return true;
    } catch (error) {
        console.error('Error writing to .env file:', error);
        return false;
    }
};


// --- Validation Rules ---
const expenseValidationRules = [
    body('type').optional().trim().escape(),
    body('date').optional().isISO8601().toDate().withMessage('Invalid date format, please use YYYY-MM-DD'),
    body('vendor').optional().trim().escape(),
    body('location').optional().trim().escape(),
    body('cost').optional().isFloat({ gt: 0 }).withMessage('Cost must be a positive number'),
    body('comments').optional().trim().escape(),
    body('tripName').optional({ nullable: true, checkFalsy: true }).trim().escape()
];

// Validation rules specifically for POST (creation) where some fields are mandatory
const expenseCreationValidationRules = [
    body('type').notEmpty().withMessage('Type is required').trim().escape(),
    body('date').notEmpty().withMessage('Date is required').isISO8601().toDate().withMessage('Invalid date format, please use YYYY-MM-DD'),
    body('vendor').notEmpty().withMessage('Vendor is required').trim().escape(),
    body('location').notEmpty().withMessage('Location is required').trim().escape(),
    body('cost').notEmpty().withMessage('Cost is required').isFloat({ gt: 0 }).withMessage('Cost must be a positive number'),
    body('comments').optional().trim().escape(),
    body('tripName').notEmpty().withMessage('Trip Name is required').trim().escape()
];
// --- End Validation Rules ---


// --- Auth Routes ---

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters long').trim().escape(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
    console.log('POST /api/auth/register hit');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const saltRounds = 10; // Standard practice for bcrypt salt rounds

    try {
        // Check if username already exists
        const checkUserSql = "SELECT id FROM users WHERE username = ?";
        db.get(checkUserSql, [username], async (err, row) => {
            if (err) {
                console.error('Register: Error checking username:', err.message);
                return res.status(500).json({ message: 'Database error during registration.' });
            }
            if (row) {
                console.log(`Register: Username "${username}" already exists.`);
                return res.status(400).json({ message: 'Username already taken.' });
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, saltRounds);

            // Insert new user
            const insertSql = "INSERT INTO users (username, password_hash) VALUES (?, ?)";
            db.run(insertSql, [username, passwordHash], function(err) { // Use function() to access this.lastID
                if (err) {
                    console.error('Register: Error inserting user:', err.message);
                    return res.status(500).json({ message: 'Failed to register user.' });
                }
                console.log(`Register: User "${username}" created with ID ${this.lastID}`);
                res.status(201).json({ message: 'User registered successfully.', userId: this.lastID });
            });
        });
    } catch (error) {
        console.error('Register: Unexpected error:', error);
        res.status(500).json({ message: 'An unexpected error occurred during registration.' });
    }
});

// POST /api/auth/login - Log in a user
app.post('/api/auth/login', [
    body('username').notEmpty().withMessage('Username is required').trim().escape(),
    body('password').notEmpty().withMessage('Password is required')
], (req, res) => {
    console.log('POST /api/auth/login hit');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    const JWT_SECRET = process.env.JWT_SECRET; // Get secret from environment

    if (!JWT_SECRET) {
        console.error("Login Error: JWT_SECRET is not defined.");
        return res.status(500).json({ message: 'Server configuration error.' });
    }

    const sql = "SELECT id, username, password_hash FROM users WHERE username = ?";
    db.get(sql, [username], async (err, user) => {
        if (err) {
            console.error('Login: Database error:', err.message);
            return res.status(500).json({ message: 'Database error during login.' });
        }
        if (!user) {
            console.log(`Login: User "${username}" not found.`);
            return res.status(401).json({ message: 'Invalid username or password.' }); // Generic message for security
        }

        // Compare password with hash
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            console.log(`Login: Incorrect password for user "${username}".`);
            return res.status(401).json({ message: 'Invalid username or password.' }); // Generic message
        }

        // Passwords match - Generate JWT
        const payload = { userId: user.id, username: user.username };
        // Consider adding an expiration time (e.g., '1h', '7d')
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour

        console.log(`Login: User "${username}" (ID: ${user.id}) logged in successfully.`);
        res.json({ message: 'Login successful.', token: token, userId: user.id, username: user.username });
    });
});

// --- End Auth Routes ---


// --- Expense API Routes (Protected) ---

// Apply authentication middleware to this route
app.get('/api/expenses', authenticateToken, (req, res) => {
    const userId = req.user.id; // Get user ID from authenticated request
    console.log(`GET /api/expenses hit for user ${userId}`);

    // Fetch expenses from the database for the specific user
    const sql = "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC";
    const params = [userId];

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(`Error fetching expenses for user ${userId}:`, err.message);
            return res.status(500).json({ message: 'Failed to fetch expenses' });
        }
        console.log(`GET /api/expenses: Found ${rows.length} expenses for user ${userId}`);
        // Convert cost back to number if stored as REAL
        const expenses = rows.map(exp => ({
            ...exp,
            cost: parseFloat(exp.cost)
        }));
        return res.json(expenses);
    });
});

// Apply authentication middleware
app.get('/api/expenses/:id', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const expenseId = req.params.id;
    console.log(`GET /api/expenses/${expenseId} hit for user ${userId}`);

    const sql = "SELECT * FROM expenses WHERE id = ? AND user_id = ?";
    const params = [expenseId, userId];

    db.get(sql, params, (err, row) => {
        if (err) {
            console.error(`Error fetching expense ${expenseId} for user ${userId}:`, err.message);
            return res.status(500).json({ message: 'Failed to fetch expense' });
        }
        if (!row) {
            console.log(`Expense ${expenseId} not found or not owned by user ${userId}`);
            return res.status(404).json({ message: 'Expense not found' });
        }
        // Convert cost back to number
        const expense = { ...row, cost: parseFloat(row.cost) };
        res.json(expense);
    });
});

// PUT /api/expenses/:id - Update an existing expense (Protected)
app.put('/api/expenses/:id', authenticateToken, function(req, res, next) {
    // Handle file upload first
    upload.single('receipt')(req, res, function(err) {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ message: `File upload error: ${err.message}` });
        }
        next(); // Proceed to validation
    });
}, function(req, res, next) {
    // Apply validation rules (using optional rules for PUT)
    Promise.all(expenseValidationRules.map(validation => validation.run(req)))
        .then(() => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.error("Validation Errors:", JSON.stringify(errors.array()));
                // Clean up uploaded file if validation fails
                if (req.file && req.file.path) { try { fs.unlinkSync(req.file.path); } catch (err) { console.error("Error deleting file after validation error:", err); } }
                return res.status(400).json({ errors: errors.array() });
            }
            next(); // Proceed to main logic
        }).catch(next);
}, function(req, res) {
    // Main route logic
    const userId = req.user.id;
    const expenseId = req.params.id;
    console.log(`PUT /api/expenses/${expenseId} hit for user ${userId}`);

    // 1. Fetch the existing expense to check ownership and get old receipt path
    const fetchSql = "SELECT * FROM expenses WHERE id = ? AND user_id = ?";
    db.get(fetchSql, [expenseId, userId], (fetchErr, existingExpense) => {
        if (fetchErr) {
            console.error(`Error fetching expense ${expenseId} for update (user ${userId}):`, fetchErr.message);
            // Clean up file if fetch fails
            if (req.file && req.file.path) { try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { console.error("Error deleting file:", unlinkErr); } }
            return res.status(500).json({ message: 'Failed to retrieve expense for update.' });
        }
        if (!existingExpense) {
            console.log(`Expense ${expenseId} not found or not owned by user ${userId} for update.`);
            // Clean up file if expense not found
            if (req.file && req.file.path) { try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { console.error("Error deleting file:", unlinkErr); } }
            return res.status(404).json({ message: 'Expense not found or you do not have permission to update it.' });
        }

        // 2. Prepare updated data
        const { type, date, vendor, location, cost, comments, tripName } = req.body;
        let newReceiptPath = existingExpense.receiptPath; // Default to old path

        // Handle file update: Delete old, set new path
        if (req.file) {
            if (existingExpense.receiptPath) {
                const oldFilePath = path.join(__dirname, existingExpense.receiptPath.replace('/uploads/', 'uploads/'));
                try {
                    if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
                    console.log(`Deleted old receipt: ${oldFilePath}`);
                } catch (err) {
                    console.error(`Error deleting old receipt ${oldFilePath}: ${err}`);
                    // Decide if this is critical - maybe just log and continue?
                }
            }
            newReceiptPath = `/uploads/${req.file.filename}`; // Set new path
        }

        // Merge existing data with new data (only update fields provided in request)
        const updatedData = {
            type: type !== undefined ? type : existingExpense.type,
            // Ensure date is formatted correctly if provided
            date: date !== undefined ? (date instanceof Date ? date.toISOString().split('T')[0] : date) : existingExpense.date,
            vendor: vendor !== undefined ? vendor : existingExpense.vendor,
            location: location !== undefined ? location : existingExpense.location,
            cost: cost !== undefined ? parseFloat(cost) : existingExpense.cost,
            comments: comments !== undefined ? comments : existingExpense.comments,
            tripName: tripName !== undefined ? tripName : existingExpense.tripName,
            receiptPath: newReceiptPath,
            updatedAt: new Date().toISOString()
        };

        // Basic check for essential fields after merge (should be caught by validation, but good safety net)
        if (!updatedData.date || !updatedData.cost || isNaN(updatedData.cost) || updatedData.cost <= 0) {
             console.error("Update Error: Missing Date or invalid Cost after merge.");
             if (req.file && req.file.path) { try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { console.error("Error deleting file:", unlinkErr); } }
             return res.status(400).json({ message: 'Internal Error: Missing Date or invalid Cost after update.' });
        }

        // 3. Update database
        const updateSql = `UPDATE expenses SET
                               type = ?, date = ?, vendor = ?, location = ?, cost = ?,
                               comments = ?, tripName = ?, receiptPath = ?, updatedAt = ?
                           WHERE id = ? AND user_id = ?`;
        const updateParams = [
            updatedData.type, updatedData.date, updatedData.vendor, updatedData.location, updatedData.cost,
            updatedData.comments, updatedData.tripName, updatedData.receiptPath, updatedData.updatedAt,
            expenseId, userId
        ];

        db.run(updateSql, updateParams, function(updateErr) {
            if (updateErr) {
                console.error(`Error updating expense ${expenseId} for user ${userId}:`, updateErr.message);
                // Don't delete the *new* file here, as the update failed. The old one might already be gone.
                return res.status(500).json({ message: 'Failed to update expense.' });
            }
            if (this.changes === 0) {
                // Should not happen if fetch succeeded, but good check
                console.error(`Update Error: Expense ${expenseId} (user ${userId}) not found during UPDATE, though found during initial GET.`);
                return res.status(404).json({ message: 'Expense not found during update process.' });
            }

            console.log(`Expense ${expenseId} updated successfully for user ${userId}`);

            // 4. Fetch the final updated expense to return
            db.get(fetchSql, [expenseId, userId], (finalFetchErr, finalRow) => {
                 if (finalFetchErr) {
                     console.error(`Error fetching updated expense ${expenseId}:`, finalFetchErr.message);
                     return res.status(500).json({ message: 'Expense updated but failed to fetch final details.' });
                 }
                 if (!finalRow) {
                      return res.status(500).json({ message: 'Expense updated but could not be found immediately after.' });
                 }
                 const responseExpense = { ...finalRow, cost: parseFloat(finalRow.cost) };
                 return res.json({ message: 'Expense updated successfully', expense: responseExpense });
            });
        });
    });
});

// DELETE /api/expenses/:id - Delete an expense (Protected)
app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const expenseId = req.params.id;
    console.log(`DELETE /api/expenses/${expenseId} hit for user ${userId}`);

    // 1. Fetch the expense to check ownership and get receipt path
    const fetchSql = "SELECT receiptPath FROM expenses WHERE id = ? AND user_id = ?";
    db.get(fetchSql, [expenseId, userId], (fetchErr, expenseToDelete) => {
        if (fetchErr) {
            console.error(`Error fetching expense ${expenseId} for deletion (user ${userId}):`, fetchErr.message);
            return res.status(500).json({ message: 'Failed to retrieve expense for deletion.' });
        }
        if (!expenseToDelete) {
            console.log(`Expense ${expenseId} not found or not owned by user ${userId} for deletion.`);
            // Return 404 even if it exists but isn't owned by the user, for security
            return res.status(404).json({ message: 'Expense not found or you do not have permission to delete it.' });
        }

        // 2. Delete the expense from the database
        const deleteSql = "DELETE FROM expenses WHERE id = ? AND user_id = ?";
        db.run(deleteSql, [expenseId, userId], function(deleteErr) {
            if (deleteErr) {
                console.error(`Error deleting expense ${expenseId} for user ${userId}:`, deleteErr.message);
                return res.status(500).json({ message: 'Failed to delete expense.' });
            }
            if (this.changes === 0) {
                // Should not happen if fetch succeeded, but good check
                console.error(`Delete Error: Expense ${expenseId} (user ${userId}) not found during DELETE, though found during initial GET.`);
                return res.status(404).json({ message: 'Expense not found during delete process.' });
            }

            console.log(`Expense ${expenseId} deleted successfully from DB for user ${userId}`);

            // 3. Delete the associated receipt file, if it exists
            if (expenseToDelete.receiptPath) {
                const filePath = path.join(__dirname, expenseToDelete.receiptPath.replace('/uploads/', 'uploads/'));
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted associated receipt file: ${filePath}`);
                    }
                } catch (fileErr) {
                    // Log the error but don't fail the request, as the DB entry is gone.
                    console.error(`Error deleting receipt file ${filePath}: ${fileErr}`);
                }
            }

            res.json({ message: 'Expense deleted successfully' });
        });
    });
});

/**
 * POST /api/test-ocr - Test OCR processing without saving
 * 
 * This endpoint processes a receipt image or PDF using OCR to extract
 * expense details like date, cost, vendor, location, and type.
 * It supports both built-in OCR (Tesseract) and Gemini Vision API.
 */
app.post('/api/test-ocr', upload.single('receipt'), async (req, res) => {
    console.log('POST /api/test-ocr hit');
    try {
        // Validate request
        if (!req.file) {
            return res.status(400).json({ message: 'Receipt upload is required for OCR testing.' });
        }

        const ocrMethod = req.body.ocrMethod || 'builtin';
        // API Key is retrieved from environment variables on the backend
        // const apiKey = req.body.apiKey; // No longer passed from frontend
        const modelName = req.body.model; // Model name can still be passed if needed

        console.log(`Testing OCR with method: ${ocrMethod}`);
        console.log(`Processing uploaded file: ${req.file.path} (Type: ${req.file.mimetype})`);

        let result;

        // Process with selected OCR method
        // Removed duplicate declaration: let apiKey;
        // Process with selected OCR method - Get API Key from environment
        let apiKey;
        switch (ocrMethod) {
            case 'gemini':
                apiKey = process.env.GEMINI_API_KEY;
                break;
            case 'openai':
                apiKey = process.env.OPENAI_API_KEY;
                break;
            case 'claude':
                apiKey = process.env.CLAUDE_API_KEY;
                break;
            case 'openrouter':
                apiKey = process.env.OPENROUTER_API_KEY;
                break;
            // 'builtin' doesn't need a key
        }

        // Validate that the key exists in the environment for non-builtin methods
        if (ocrMethod !== 'builtin' && (!apiKey || apiKey.startsWith('YOUR_') || apiKey.endsWith('_HERE'))) {
            console.error(`API key for ${ocrMethod} not found or not set in .env file.`);
            if (req.file && req.file.path) fs.unlinkSync(req.file.path); // Clean up file
            return res.status(400).json({ message: `API key for ${ocrMethod} is not configured on the server. Please set it via the Settings page.` });
        }

        if (ocrMethod === 'gemini') {
            // Use Gemini OCR (apiKey comes from process.env)
            const visionModelName = modelName || 'gemini-pro-vision';
            console.log(`Using Gemini model: ${visionModelName}`);
            result = await ocrUtils.processWithGeminiOCR(
                req.file.path,
                req.file.mimetype,
                apiKey, // Use the key fetched from process.env
                visionModelName
            );
        } else if (ocrMethod === 'openai') {
            console.log('Using OpenAI OCR processing...');
            const visionModelName = modelName || 'gpt-4-vision-preview'; // Default OpenAI vision model
            result = await ocrUtils.processWithOpenAIOCR(
                req.file.path,
                req.file.mimetype,
                apiKey,
                visionModelName
            );
        } else if (ocrMethod === 'claude') {
             console.log('Using Claude OCR processing...');
             const visionModelName = modelName || 'claude-3-haiku-20240307'; // Default Claude vision model
             result = await ocrUtils.processWithClaudeOCR(
                 req.file.path,
                 req.file.mimetype,
                 apiKey,
                 visionModelName
             );
        } else if (ocrMethod === 'openrouter') {
             console.log('Using OpenRouter OCR processing...');
             // Default model might vary, ensure frontend sends one or set a sensible default
             const visionModelName = modelName || 'openai/gpt-4-vision-preview';
             result = await ocrUtils.processWithOpenRouterOCR(
                 req.file.path,
                 req.file.mimetype,
                 apiKey,
                 visionModelName
             );
        } else { // Built-in
            // Use built-in OCR
            console.log('Using built-in OCR processing...');
            
            // Validate file type
            if (!req.file.mimetype.startsWith('image/') && req.file.mimetype !== 'application/pdf') {
                if (req.file && req.file.path) {
                    fs.unlinkSync(req.file.path);
                }
                return res.status(400).json({ message: 'Unsupported file type for OCR.' });
            }
            
            result = await ocrUtils.processWithBuiltinOCR(req.file.path, req.file.mimetype);
            console.log('Built-in OCR complete');
        }

        // Clean up the uploaded file
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (err) => { 
                if (err) console.error("Error deleting temporary file:", err); 
            });
        }

        // Return the extracted data
        return res.json(result);
    } catch (error) {
        console.error('Error testing OCR:', error);
        
        // Clean up on error
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (err) => { 
                if (err) console.error("Error deleting file after server error:", err); 
            });
        }
        
        return res.status(500).json({ 
            message: `Failed to test OCR due to server error: ${error.message}` 
        });
    }
});


// POST /api/expenses - Add a new expense (Protected)
app.post('/api/expenses', authenticateToken, function(req, res, next) {
    // Handle file upload first
    upload.single('receipt')(req, res, function(err) {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ message: `File upload error: ${err.message}` });
        }
        // File uploaded successfully (or no file), proceed to validation
        next();
    });
}, function(req, res, next) {
    // Apply validation rules (ensure this runs *after* multer and auth)
    // Need to manually trigger validation checks here as they are separate middleware
    Promise.all(expenseCreationValidationRules.map(validation => validation.run(req)))
        .then(() => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                console.error("Validation Errors:", JSON.stringify(errors.array()));
                // Clean up uploaded file if validation fails
                if (req.file && req.file.path) {
                    try { fs.unlinkSync(req.file.path); } catch (err) { console.error("Error deleting file after validation error:", err); }
                }
                return res.status(400).json({ errors: errors.array() });
            }
            // Validation passed, proceed to main logic
            next();
        }).catch(next); // Pass errors to the global error handler
}, function(req, res) {
    // Main route logic (runs after auth, multer, and validation)
    const userId = req.user.id;
    console.log(`POST /api/expenses hit for user ${userId}`);

    // Ensure uploads directory exists (Multer should handle this, but double-check)
    if (!fs.existsSync(UPLOADS_DIR)) {
        try {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        } catch (err) {
            console.error("Error creating uploads directory:", err);
            // Clean up file if directory creation fails mid-request
            if (req.file && req.file.path) { try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { console.error("Error deleting file:", unlinkErr); } }
            return res.status(500).json({ message: 'Failed to ensure uploads directory exists.' });
        }
    }

    try {
        // Extract form data (already validated)
        const { type, date, vendor, location, cost, comments, tripName } = req.body;
        const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;
        const now = new Date().toISOString();

        // Prepare data for insertion
        const sql = `INSERT INTO expenses (user_id, type, date, vendor, location, cost, comments, tripName, receiptPath, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
            userId,
            type,
            // Ensure date is in YYYY-MM-DD format if it came from validation as Date object
            (date instanceof Date ? date.toISOString().split('T')[0] : date),
            vendor,
            location,
            parseFloat(cost), // Ensure cost is a number
            comments || null, // Use null for empty optional fields
            tripName,
            receiptPath,
            now,
            now
        ];

        // Insert into database
        db.run(sql, params, function(err) {
            if (err) {
                console.error(`Error inserting expense for user ${userId}:`, err.message);
                // Clean up uploaded file if DB insert fails
                if (req.file && req.file.path) { try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { console.error("Error deleting file:", unlinkErr); } }
                return res.status(500).json({ message: 'Failed to save expense.' });
            }

            const newExpenseId = this.lastID;
            console.log(`Expense created with ID ${newExpenseId} for user ${userId}`);

            // Fetch the newly created expense to return it
            const fetchSql = "SELECT * FROM expenses WHERE id = ? AND user_id = ?";
            db.get(fetchSql, [newExpenseId, userId], (fetchErr, row) => {
                if (fetchErr) {
                    console.error(`Error fetching newly created expense ${newExpenseId}:`, fetchErr.message);
                    // Even if fetch fails, the expense was created, so maybe return 201 with just ID?
                    return res.status(500).json({ message: 'Expense created but failed to fetch details.' });
                }
                if (!row) {
                     return res.status(500).json({ message: 'Expense created but could not be found immediately after.' });
                }

                // Format response
                const responseExpense = { ...row, cost: parseFloat(row.cost) };
                return res.status(201).json({ message: 'Expense added successfully', expense: responseExpense });
            });
        });

    } catch (error) {
        console.error(`POST /api/expenses: Unexpected error for user ${userId}:`, error);
        // Clean up uploaded file on unexpected error
        if (req.file && req.file.path) { try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { console.error("Error deleting file:", unlinkErr); } }
        return res.status(500).json({ message: 'Failed to add expense due to server error.' });
    }
});

// GET /api/export-expenses - Generate and download Excel file (Protected)
app.get('/api/export-expenses', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const requestedTripName = req.query.tripName;

    if (!requestedTripName) {
        return res.status(400).send('Error: Please specify a tripName query parameter.');
    }
    console.log(`GET /api/export-expenses hit for user ${userId}. Trip requested: ${requestedTripName}`);

    // Fetch expenses for the specific user and trip name
    const sql = "SELECT type, date, vendor, location, cost, comments FROM expenses WHERE user_id = ? AND tripName = ? ORDER BY date ASC";
    const params = [userId, requestedTripName];

    db.all(sql, params, (err, expensesToExport) => {
        if (err) {
            console.error(`Error fetching expenses for export (user ${userId}, trip ${requestedTripName}):`, err.message);
            return res.status(500).send('Error fetching expenses for export.');
        }

        try {
            let filenameBase = requestedTripName.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_') || 'trip_expenses';
            const wb = XLSX.utils.book_new();
            const headers = ['Type', 'Date', 'Vendor', 'Location', 'Cost', 'Comments'];
            const data = [headers]; // Start data array with headers

            if (expensesToExport.length > 0) {
                expensesToExport.forEach(exp => {
                    // Date should already be in correct string format from DB or previous processing
                    let dateStr = exp.date;
                    // Just in case, handle potential Date objects (though unlikely if stored as TEXT)
                    if (exp.date instanceof Date) dateStr = exp.date.toISOString().split('T')[0];
                    else if (typeof exp.date === 'string' && exp.date.includes('T')) dateStr = exp.date.split('T')[0];

                    data.push([
                        exp.type || '',
                        dateStr || '',
                        exp.vendor || '',
                        exp.location || '',
                        parseFloat(exp.cost || 0).toFixed(2), // Ensure cost is formatted
                        exp.comments || ''
                    ]);
                });
            } else {
                console.log(`No expenses found for user ${userId}, trip: ${requestedTripName}`);
                // Optionally, still generate an empty file or return a message
                // For now, generate file with only headers
            }

            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
            const tempFilePath = path.join(__dirname, `expenses_${Date.now()}.xlsx`);
            XLSX.writeFile(wb, tempFilePath);

            const filename = `${filenameBase}.xlsx`;
            res.download(tempFilePath, filename, (downloadErr) => {
                // Cleanup the temporary file after download attempt
                if (fs.existsSync(tempFilePath)) {
                    fs.unlink(tempFilePath, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting temporary Excel file:', unlinkErr);
                    });
                }
                if (downloadErr) {
                    console.error('Error sending Excel file:', downloadErr);
                    // Avoid sending another response if headers already sent
                }
            });
            console.log(`Generated Excel file: ${filename} for user ${userId}`);

        } catch (excelError) {
            console.error(`Error generating Excel export for user ${userId}, trip ${requestedTripName}:`, excelError);
            res.status(500).send('Error generating Excel file.');
        }
    });
});

/**
 * POST /api/update-env - Update API keys in the .env file
 * SECURITY WARNING: This endpoint allows modifying server environment variables
 * from the frontend. In a production environment, this MUST be secured
 * with proper authentication and authorization.
 */
// Apply authentication middleware - Only logged-in users should update settings
app.post('/api/update-env', authenticateToken, (req, res) => {
    console.log(`POST /api/update-env hit by user ${req.user.id}`); // Log which user is making the change
    const {
        GEMINI_API_KEY,
        OPENAI_API_KEY,
        CLAUDE_API_KEY,
        OPENROUTER_API_KEY
    } = req.body;

    // Basic validation: Check if at least one key is provided
    // Allow empty strings to clear keys
    const keysProvided = Object.values(req.body).some(key => key !== undefined);
    if (!keysProvided) {
         return res.status(400).json({ message: 'No API keys provided for update.' });
    }


    const keysToUpdate = {};
    // Only include keys that were actually present in the request body
    if (req.body.hasOwnProperty('GEMINI_API_KEY')) keysToUpdate.GEMINI_API_KEY = GEMINI_API_KEY || '';
    if (req.body.hasOwnProperty('OPENAI_API_KEY')) keysToUpdate.OPENAI_API_KEY = OPENAI_API_KEY || '';
    if (req.body.hasOwnProperty('CLAUDE_API_KEY')) keysToUpdate.CLAUDE_API_KEY = CLAUDE_API_KEY || '';
    if (req.body.hasOwnProperty('OPENROUTER_API_KEY')) keysToUpdate.OPENROUTER_API_KEY = OPENROUTER_API_KEY || '';


    const success = updateEnvFile(keysToUpdate);

    if (success) {
        res.json({ message: 'API keys updated successfully. Restart server for changes to take full effect if issues arise.' });
    } else {
        res.status(500).json({ message: 'Failed to update API keys on the server.' });
    }
});


// --- Server Start ---
// Conditionally start the server only if the script is run directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log(`Frontend accessible at http://localhost:${PORT}`);
    });
}

// Export the app instance for testing
module.exports = app;