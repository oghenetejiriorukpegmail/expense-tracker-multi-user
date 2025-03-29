const express = require('express');
const path = require('path');
const fs = require('fs'); // File system module
const multer = require('multer'); // Middleware for handling file uploads
const Tesseract = require('tesseract.js'); // OCR library (still needed for /test-ocr builtin)
const XLSX = require('xlsx'); // Excel library
const { createCanvas } = require('canvas'); // For rendering PDF page to image
const { body, validationResult } = require('express-validator'); // Input validation/sanitization
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Google AI SDK

// We'll use a different approach for PDF processing
const pdf = require('pdf-parse'); // Still needed for PDF text extraction if Gemini fails or for builtin

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
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


// --- Helper Function to Read/Write Data ---
const readData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading data file:', error);
        return [];
    }
};
const writeData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing data file:', error);
    }
};

// --- PDF Text Extraction Helper (Used by /test-ocr builtin) ---
async function extractTextFromPDF(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (error) {
        console.error('PDF text extraction error:', error);
        throw error;
    }
}

// --- Helper function to convert file buffer to generative part ---
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}


// --- OCR Helper Functions (Used by /test-ocr builtin) ---
const findDateInText = (text) => { /* ... keep existing findDateInText ... */
    const dateRegex = /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{1,2}\.\d{1,2}\.\d{2,4})/;
    const match = text.match(dateRegex);
    if (match) {
        let dateStr = match[0];
        try {
            const parts = dateStr.split(/[-\/.]/);
            if (parts.length === 3) {
                let year = parts[2], month = parts[0], day = parts[1];
                 if (parts[0].length === 4) { // YYYY-MM-DD
                    year = parts[0]; month = parts[1]; day = parts[2];
                 } else if (parts[2].length === 2) { // Handle YY
                     year = parseInt(parts[2]) < 70 ? '20' + parts[2] : '19' + parts[2];
                 } else if (parts[2].length === 4) {
                     year = parts[2];
                 }
                 month = month.padStart(2, '0');
                 day = day.padStart(2, '0');
                 if (parseInt(month) > 0 && parseInt(month) <= 12 && parseInt(day) > 0 && parseInt(day) <= 31) {
                    const testDate = new Date(`${year}-${month}-${day}T00:00:00`);
                    if (!isNaN(testDate) && testDate.getDate() == parseInt(day)) {
                         return `${year}-${month}-${day}`;
                    }
                 }
            }
        } catch (e) { console.error("Date parsing error:", e); }
        return dateStr.match(dateRegex) ? dateStr : null;
    }
    return null;
};
const findCostInText = (text) => { /* ... keep existing findCostInText ... */
    const lines = text.split('\n');
    let bestMatch = null;
    let maxCost = -1;
    const costRegex = /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/;
    for (const line of lines) {
        if (line.match(/total|amount|balance|due|sum|pay|charge/i)) {
            const match = line.match(costRegex);
            if (match) {
                const cost = parseFloat(match[1].replace(/,/g, ''));
                if (!isNaN(cost) && cost > maxCost) {
                    maxCost = cost;
                    bestMatch = cost.toFixed(2);
                }
            }
        }
    }
     if (bestMatch === null) {
        const allMatches = text.match(new RegExp(costRegex.source, 'g')) || [];
        for (const matchStr of allMatches) {
             const simpleMatch = matchStr.match(costRegex);
             if (simpleMatch) {
                const cost = parseFloat(simpleMatch[1].replace(/,/g, ''));
                if (!isNaN(cost) && cost > maxCost) {
                    maxCost = cost;
                    bestMatch = cost.toFixed(2);
                }
             }
        }
     }
    return bestMatch;
};
const findVendorInText = (text) => { /* ... keep existing findVendorInText ... */
    const lines = text.split('\n');
    if (lines.length === 0) return null;
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 1 && !trimmedLine.match(/receipt|invoice|order|date|time|customer|phone|tel|fax|www|http|cash|card|total|amount/i)) {
            return trimmedLine;
        }
    }
    return lines[0].trim() || null;
};
const findLocationInText = (text) => { /* ... keep existing findLocationInText ... */
    const lines = text.split('\n');
    const cityStateZipRegex = /([a-zA-Z\s\-\']+),?\s+([A-Z]{2})\s+(\d{5}(-\d{4})?)/;
    const cityStateRegex = /([a-zA-Z\s\-\']+),\s+([A-Z]{2})/;
    for (const line of lines) {
        const cityStateZipMatch = line.match(cityStateZipRegex);
        if (cityStateZipMatch && cityStateZipMatch[1]) return cityStateZipMatch[1].trim();
        const cityStateMatch = line.match(cityStateRegex);
        if (cityStateMatch && cityStateMatch[1]) return cityStateMatch[1].trim();
    }
    for (const line of lines) {
         if (line.match(/\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|blvd|ln|dr)/i) && !line.match(/total|amount|cash|card/i)) {
             const parts = line.split(',');
             if (parts.length > 1) return parts[0].trim();
             return line.trim();
         }
    }
    return null;
};
const findTypeInText = (text) => { /* ... keep existing findTypeInText ... */
    const categories = {
        'groceries': ['grocery', 'supermarket', 'food', 'produce', 'meat', 'dairy', 'bakery'],
        'dining': ['restaurant', 'cafe', 'diner', 'bistro', 'bar', 'pub', 'eatery', 'food court'],
        'transportation': ['gas', 'fuel', 'parking', 'taxi', 'uber', 'lyft', 'transit', 'train', 'bus', 'subway'],
        'shopping': ['clothing', 'apparel', 'shoes', 'accessories', 'department store', 'mall'],
        'utilities': ['electric', 'water', 'gas', 'internet', 'phone', 'utility', 'bill'],
        'entertainment': ['movie', 'theatre', 'concert', 'show', 'event', 'ticket'],
        'healthcare': ['doctor', 'hospital', 'clinic', 'pharmacy', 'medical', 'dental', 'vision'],
        'travel': ['hotel', 'motel', 'lodging', 'airfare', 'airline', 'flight', 'booking'],
        'office': ['office', 'supplies', 'stationery', 'printing', 'software', 'hardware']
    };
     const lowerText = text.toLowerCase();
     for (const [category, keywords] of Object.entries(categories)) {
         for (const keyword of keywords) {
             if (lowerText.includes(keyword)) {
                 return category.charAt(0).toUpperCase() + category.slice(1);
             }
         }
     }
    return 'Expense';
};
// --- End OCR Helper Functions ---


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


// --- API Routes ---

app.get('/api/expenses', (req, res) => { /* ... unchanged ... */
    console.log('GET /api/expenses hit');
    const expenses = readData();
    res.json(expenses);
});

app.get('/api/expenses/:id', (req, res) => { /* ... unchanged ... */
    console.log(`GET /api/expenses/${req.params.id} hit`);
    try {
        const expenses = readData();
        const expense = expenses.find(exp => exp.id === req.params.id);
        if (!expense) return res.status(404).json({ message: 'Expense not found' });
        res.json(expense);
    } catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({ message: 'Failed to fetch expense' });
    }
});

// PUT /api/expenses/:id - Update an existing expense (No OCR here)
app.put('/api/expenses/:id',
    upload.single('receipt'),
    expenseValidationRules,
    async (req, res) => { /* ... unchanged (already removed OCR) ... */
        console.log(`PUT /api/expenses/${req.params.id} hit`);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
             if (req.file && req.file.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after validation error:", err);});
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const expenses = readData();
            const expenseIndex = expenses.findIndex(exp => exp.id === req.params.id);
            if (expenseIndex === -1) {
                 if (req.file && req.file.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after not found error:", err);});
                return res.status(404).json({ message: 'Expense not found' });
            }
            const existingExpense = expenses[expenseIndex];
            const { type: formType, date: formDate, vendor: formVendor, location: formLocation, cost: formCost, comments: formComments, tripName: formTripName } = req.body;
            let receiptPath = existingExpense.receiptPath;
            if (req.file) {
                if (existingExpense.receiptPath) {
                    const oldFilePath = path.join(__dirname, existingExpense.receiptPath.replace('/uploads/', 'uploads/'));
                    try { if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath); } catch (err) { console.error(`Error deleting old receipt: ${err}`); }
                }
                receiptPath = `/uploads/${req.file.filename}`;
            }
            const finalType = formType !== undefined ? formType : existingExpense.type;
            const finalDate = formDate !== undefined ? formDate : existingExpense.date;
            const finalVendor = formVendor !== undefined ? formVendor : existingExpense.vendor;
            const finalLocation = formLocation !== undefined ? formLocation : existingExpense.location;
            const finalCost = formCost !== undefined ? parseFloat(formCost) : existingExpense.cost;
            const finalComments = formComments !== undefined ? formComments : existingExpense.comments;
            const finalTripName = formTripName !== undefined ? (formTripName || null) : existingExpense.tripName;
             if (!finalDate || !finalCost || isNaN(finalCost) || finalCost <= 0) {
                 console.error("Validation Error: Missing Date or Cost after update merge.");
                 return res.status(400).json({ message: 'Internal Error: Missing Date or Cost after update.' });
             }
            const updatedExpense = {
                ...existingExpense, type: finalType, date: finalDate, vendor: finalVendor, location: finalLocation,
                tripName: finalTripName, cost: finalCost, comments: finalComments, receiptPath: receiptPath,
                updatedAt: new Date().toISOString()
            };
            expenses[expenseIndex] = updatedExpense;
            writeData(expenses);
            console.log('Expense updated (internal):', updatedExpense);
            const responseExpense = { ...updatedExpense, date: updatedExpense.date.toISOString().split('T')[0] };
            res.json({ message: 'Expense updated successfully', expense: responseExpense });
        } catch (error) {
            console.error('Error updating expense:', error);
            if (req.file && req.file.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after server error:", err); });
            res.status(500).json({ message: 'Failed to update expense due to server error.' });
        }
    });

// DELETE /api/expenses/:id - Delete an expense
app.delete('/api/expenses/:id', (req, res) => { /* ... unchanged ... */
    console.log(`DELETE /api/expenses/${req.params.id} hit`);
    try {
        const expenses = readData();
        const expenseIndex = expenses.findIndex(exp => exp.id === req.params.id);
        if (expenseIndex === -1) return res.status(404).json({ message: 'Expense not found' });
        const expenseToDelete = expenses[expenseIndex];
        if (expenseToDelete.receiptPath) {
            const filePath = path.join(__dirname, expenseToDelete.receiptPath.replace('/uploads/', 'uploads/'));
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (err) { console.error(`Error deleting receipt: ${err}`); }
        }
        expenses.splice(expenseIndex, 1);
        writeData(expenses);
        console.log(`Expense deleted: ${req.params.id}`);
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ message: 'Failed to delete expense due to server error.' });
    }
});

// POST /api/test-ocr - Test OCR processing without saving (Integrate Gemini)
app.post('/api/test-ocr', upload.single('receipt'), async (req, res) => {
    console.log('POST /api/test-ocr hit');
     try {
         if (!req.file) return res.status(400).json({ message: 'Receipt upload is required for OCR testing.' });

         const ocrMethod = req.body.ocrMethod || 'builtin';
         const apiKey = req.body.apiKey; // Get API key from request
         const modelName = req.body.model; // Get model name from request

         let type = null, date = null, vendor = null, location = null, cost = null;

         console.log(`Testing OCR with method: ${ocrMethod}`);
         console.log(`Processing uploaded file: ${req.file.path} (Type: ${req.file.mimetype})`);

         if (ocrMethod === 'gemini') {
             if (!apiKey) {
                 if (req.file && req.file.path) fs.unlinkSync(req.file.path); // Clean up file
                 return res.status(400).json({ message: 'API key is required for Gemini OCR.' });
             }
             // Ensure a vision model is selected or default to one
             const visionModelName = modelName || 'gemini-pro-vision'; // Default if not provided
             console.log(`Using Gemini model: ${visionModelName}`);

             try {
                 const genAI = new GoogleGenerativeAI(apiKey);
                 const model = genAI.getGenerativeModel({ model: visionModelName });

                 const prompt = `Extract the following details from this receipt image/document in JSON format: date (YYYY-MM-DD), cost (total amount as number), vendor (store/service name), location (city/address), type (e.g., Groceries, Dining, Transportation, Shopping, Utilities, Entertainment, Healthcare, Travel, Office, Expense). If a field cannot be determined, use null for its value. Respond ONLY with the JSON object. Example: {"date": "2024-01-15", "cost": 25.50, "vendor": "Example Store", "location": "Anytown", "type": "Shopping"}`;

                 const imagePart = fileToGenerativePart(req.file.path, req.file.mimetype);

                 const result = await model.generateContent([prompt, imagePart]);
                 const response = await result.response;
                 const responseText = response.text();
                 console.log("Gemini API Response Text:", responseText);

                 // Attempt to parse the JSON response from Gemini
                 try {
                     // Clean potential markdown/formatting around JSON
                     const jsonString = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                     const extractedData = JSON.parse(jsonString);

                     // Validate and assign extracted data
                     date = extractedData.date && typeof extractedData.date === 'string' && extractedData.date.match(/^\d{4}-\d{2}-\d{2}$/) ? extractedData.date : null;
                     cost = extractedData.cost && !isNaN(parseFloat(extractedData.cost)) ? parseFloat(extractedData.cost).toFixed(2) : null;
                     vendor = extractedData.vendor && typeof extractedData.vendor === 'string' ? extractedData.vendor.trim() : null;
                     location = extractedData.location && typeof extractedData.location === 'string' ? extractedData.location.trim() : null;
                     type = extractedData.type && typeof extractedData.type === 'string' ? extractedData.type.trim() : 'Expense'; // Default type

                     console.log(`Gemini Parsed Data: Date: ${date}, Cost: ${cost}, Vendor: ${vendor}, Location: ${location}, Type: ${type}`);

                 } catch (parseError) {
                     console.error("Failed to parse JSON response from Gemini:", parseError);
                     console.error("Original Gemini response text:", responseText);
                     // Fallback to basic text extraction if JSON parsing fails
                     console.log("Falling back to basic text extraction using Tesseract...");
                     const { data: tesseractData } = await Tesseract.recognize(req.file.path, 'eng');
                     const fallbackText = tesseractData.text;
                     date = findDateInText(fallbackText);
                     cost = findCostInText(fallbackText);
                     vendor = findVendorInText(fallbackText);
                     location = findLocationInText(fallbackText);
                     type = findTypeInText(fallbackText);
                     console.log(`Fallback Extraction Results: Date: ${date}, Cost: ${cost}, Vendor: ${vendor}, Location: ${location}, Type: ${type}`);
                 }

             } catch (geminiError) {
                 console.error("Error calling Gemini API:", geminiError);
                 // Optionally fallback to built-in OCR on API error
                 console.log("Gemini API call failed. Falling back to built-in OCR...");
                 const { data: tesseractData } = await Tesseract.recognize(req.file.path, 'eng');
                 const fallbackText = tesseractData.text;
                 date = findDateInText(fallbackText);
                 cost = findCostInText(fallbackText);
                 vendor = findVendorInText(fallbackText);
                 location = findLocationInText(fallbackText);
                 type = findTypeInText(fallbackText);
             }

         } else { // Built-in Tesseract / Other AI simulations (can be removed if only Gemini is needed now)
             console.log('Using built-in OCR processing...');
             let text = '';
             if (req.file.mimetype === 'application/pdf') {
                 text = await extractTextFromPDF(req.file.path);
             } else if (req.file.mimetype.startsWith('image/')) {
                 const { data } = await Tesseract.recognize(req.file.path, 'eng');
                 text = data.text;
             } else {
                  if (req.file && req.file.path) fs.unlinkSync(req.file.path);
                 return res.status(400).json({ message: 'Unsupported file type for OCR.' });
             }
             date = findDateInText(text);
             cost = findCostInText(text);
             vendor = findVendorInText(text);
             location = findLocationInText(text);
             type = findTypeInText(text);
             console.log('Built-in OCR complete');
         }

         // Clean up the uploaded file
         if (req.file && req.file.path && fs.existsSync(req.file.path)) {
             fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting temporary file:", err); });
         }

         // Return the extracted data
         res.json({ type, date, vendor, location, cost, method: ocrMethod });

     } catch (error) {
         console.error('Error testing OCR:', error);
         if (req.file && req.file.path && fs.existsSync(req.file.path)) {
             fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after server error:", err); });
         }
         res.status(500).json({ message: `Failed to test OCR due to server error: ${error.message}` });
     }
 });


// POST /api/expenses - Add a new expense (No OCR here)
app.post('/api/expenses',
    upload.single('receipt'),
    expenseCreationValidationRules, // Use stricter rules for creation
    async (req, res) => { /* ... unchanged (already removed OCR) ... */
        console.log('POST /api/expenses hit');
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
             console.error("Validation Errors:", JSON.stringify(errors.array())); // Log validation errors
             if (req.file && req.file.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after validation error:", err);});
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            console.log("POST /api/expenses: Inside try block"); // Log entry
            const { type: formType, date: formDate, vendor: formVendor, location: formLocation, cost: formCost, comments: formComments, tripName: formTripName } = req.body;
            console.log("POST /api/expenses: Form data extracted"); // Log after extraction

            if (!req.file) {
                console.log("POST /api/expenses: No file found, returning 400");
                return res.status(400).json({ message: 'Receipt upload is required.' });
            }
             if (!formTripName) {
                  console.log("POST /api/expenses: No tripName found, returning 400");
                  if (req.file && req.file.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after validation error:", err);});
                 return res.status(400).json({ message: 'Trip Name is required.' });
             }
            let receiptPath = `/uploads/${req.file.filename}`;
            console.log("POST /api/expenses: Reading data..."); // Log before read
            const expenses = readData();
            console.log("POST /api/expenses: Data read successfully"); // Log after read

            const finalType = formType;
            const finalDate = formDate; // Already a Date object from validator
            const finalVendor = formVendor;
            const finalLocation = formLocation;
            const finalCost = parseFloat(formCost);
            const finalComments = formComments || '';
            const finalTripName = formTripName;
             if (!finalDate || !finalCost || isNaN(finalCost) || finalCost <= 0) {
                 console.error("Validation Error: Missing Date or Cost after creation merge.");
                 if (req.file && req.file.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after data merge error:", err);});
                 return res.status(400).json({ message: 'Internal Error: Missing Date or Cost after creation.' });
             }
            const newExpense = {
                id: Date.now().toString(), type: finalType, date: finalDate, vendor: finalVendor, location: finalLocation,
                cost: finalCost, comments: finalComments, tripName: finalTripName, receiptPath: receiptPath,
                createdAt: new Date().toISOString()
            };
            console.log("POST /api/expenses: New expense object created:", newExpense); // Log object
            expenses.push(newExpense);
            console.log("POST /api/expenses: Writing data..."); // Log before write
            writeData(expenses);
            console.log("POST /api/expenses: Data written successfully"); // Log after write
            console.log('Expense added (internal):', newExpense);
            const responseExpense = { ...newExpense, date: newExpense.date.toISOString().split('T')[0] };
            console.log("POST /api/expenses: Sending 201 response"); // Log before response
            res.status(201).json({ message: 'Expense added successfully', expense: responseExpense });

        } catch (error) {
            console.error("POST /api/expenses: Error caught in try block:", error); // Log error in catch
             if (req.file && req.file.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after server error:", err);});
            res.status(500).json({ message: 'Failed to add expense due to server error.' });
        }
    });

// GET /api/export-expenses - Generate and download Excel file
app.get('/api/export-expenses', (req, res) => { /* ... unchanged ... */
    const requestedTripName = req.query.tripName;
    if (!requestedTripName) return res.status(400).send('Error: Please specify a tripName query parameter.');
    console.log(`GET /api/export-expenses hit. Trip requested: ${requestedTripName}`);
    try {
        let allExpenses = readData();
        let expensesToExport = allExpenses.filter(exp => exp.tripName === requestedTripName);
        let filenameBase = requestedTripName.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_') || 'trip_expenses';
        const wb = XLSX.utils.book_new();
        const headers = ['Type', 'Date', 'Vendor', 'Location', 'Cost', 'Comments'];
        const data = [headers];
        if (expensesToExport.length > 0) {
            expensesToExport.forEach(exp => {
                let dateStr = exp.date;
                if (exp.date instanceof Date) dateStr = exp.date.toISOString().split('T')[0];
                else if (typeof exp.date === 'string' && exp.date.includes('T')) dateStr = exp.date.split('T')[0];
                data.push([ exp.type || '', dateStr || '', exp.vendor || '', exp.location || '', parseFloat(exp.cost || 0).toFixed(2), exp.comments || '' ]);
            });
        } else { console.log(`No expenses found for trip: ${requestedTripName}`); }
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        const tempFilePath = path.join(__dirname, `expenses_${Date.now()}.xlsx`);
        XLSX.writeFile(wb, tempFilePath);
        const filename = `${filenameBase}.xlsx`;
        res.download(tempFilePath, filename, (err) => {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (err) console.error('Error sending Excel file:', err);
        });
        console.log(`Generated Excel file: ${filename}`);
    } catch (error) {
        console.error('Error generating Excel export:', error);
        res.status(500).send('Error generating Excel file.');
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