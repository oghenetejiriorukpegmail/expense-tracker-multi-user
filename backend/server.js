const express = require('express');
const path = require('path');
const fs = require('fs'); // File system module
const multer = require('multer'); // Middleware for handling file uploads
const Tesseract = require('tesseract.js'); // OCR library
const XLSX = require('xlsx'); // Excel library
const { createCanvas } = require('canvas'); // For rendering PDF page to image

// We'll use a different approach for PDF processing
const pdf = require('pdf-parse');

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
const upload = multer({ storage: storage });

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(UPLOADS_DIR));

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

// --- PDF to Image Buffer Helper ---
// For PDF processing, we'll extract text directly instead of converting to image
async function extractTextFromPDF(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        
        // Return the extracted text
        return data.text;
    } catch (error) {
        console.error('PDF text extraction error:', error);
        throw error;
    }
}


// --- OCR Helper Functions (Enhanced Parsing) ---
const findDateInText = (text) => {
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
                    return `${year}-${month}-${day}`;
                 }
            }
        } catch (e) { console.error("Date parsing error:", e); }
        return dateStr;
    }
    return null;
};

const findCostInText = (text) => {
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

const findVendorInText = (text) => {
    const lines = text.split('\n');
    
    // Common store/business names
    const businessKeywords = [
        'walmart', 'target', 'costco', 'kroger', 'safeway', 'publix', 'amazon',
        'starbucks', 'mcdonalds', 'restaurant', 'cafe', 'store', 'market',
        'shop', 'supermarket', 'gas station', 'pharmacy', 'hotel'
    ];
    
    // Look for lines that might contain business names
    // First check for lines with common business indicators
    for (const line of lines) {
        const cleanLine = line.trim().toLowerCase();
        
        // Skip very short lines
        if (cleanLine.length < 3) continue;
        
        // Check for business keywords
        for (const keyword of businessKeywords) {
            if (cleanLine.includes(keyword)) {
                return line.trim();
            }
        }
        
        // Look for lines that might be a business name (often at the top of receipt)
        if (lines.indexOf(line) < 5 &&
            cleanLine.length > 3 &&
            !cleanLine.match(/receipt|invoice|order|date|time|customer|phone|tel|fax|www|http/i)) {
            return line.trim();
        }
    }
    
    return null;
};

const findLocationInText = (text) => {
    const lines = text.split('\n');
    
    // Common city names to look for
    const commonCities = [
        'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
        'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
        'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle',
        'Denver', 'Boston', 'Portland', 'Las Vegas', 'Detroit', 'Atlanta', 'Miami'
    ];
    
    // Look for city, state, zip patterns
    const cityStateZipRegex = /([a-zA-Z\s]+),?\s+([A-Z]{2})\s+(\d{5}(-\d{4})?)/;
    const cityStateRegex = /([a-zA-Z\s]+),\s+([A-Z]{2})/;
    
    for (const line of lines) {
        // Check for common city names first
        for (const city of commonCities) {
            if (line.includes(city)) {
                return city;
            }
        }
        
        // Check for city, state, zip pattern
        const cityStateZipMatch = line.match(cityStateZipRegex);
        if (cityStateZipMatch && cityStateZipMatch[1]) {
            return cityStateZipMatch[1].trim(); // Return just the city name
        }
        
        // Check for city, state pattern
        const cityStateMatch = line.match(cityStateRegex);
        if (cityStateMatch && cityStateMatch[1]) {
            return cityStateMatch[1].trim(); // Return just the city name
        }
    }
    
    // Look for address patterns that might contain city names
    const addressRegex = /(\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|place|pl|court|ct))/i;
    
    for (const line of lines) {
        const addressMatch = line.match(addressRegex);
        if (addressMatch) {
            return addressMatch[0];
        }
    }
    
    // If no address pattern found, look for location keywords
    const locationKeywords = ['location', 'store', 'branch', 'outlet', 'city'];
    
    for (const line of lines) {
        const cleanLine = line.trim().toLowerCase();
        for (const keyword of locationKeywords) {
            if (cleanLine.includes(keyword) && cleanLine.length > keyword.length + 3) {
                return line.trim();
            }
        }
    }
    
    return null;
};

const findTypeInText = (text) => {
    // Common expense categories
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
    
    // Check for category keywords in the text
    for (const [category, keywords] of Object.entries(categories)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                return category.charAt(0).toUpperCase() + category.slice(1); // Capitalize first letter
            }
        }
    }
    
    // If no category is found, try to extract from product items
    const lines = text.split('\n');
    for (const line of lines) {
        // Look for lines that might be product descriptions
        if (line.match(/\d+\s+[\w\s]+\s+\d+\.\d{2}/)) {
            const productMatch = line.match(/\d+\s+([\w\s]+)\s+\d+\.\d{2}/);
            if (productMatch && productMatch[1].length > 3) {
                return 'Purchase';
            }
        }
    }
    
    return 'Expense'; // Default type
};


// --- API Routes ---

app.get('/api/expenses', (req, res) => {
    console.log('GET /api/expenses hit');
    const expenses = readData();
    res.json(expenses);
});

// GET /api/expenses/:id - Get a specific expense by ID
app.get('/api/expenses/:id', (req, res) => {
    console.log(`GET /api/expenses/${req.params.id} hit`);
    try {
        const expenses = readData();
        const expense = expenses.find(exp => exp.id === req.params.id);
        
        if (!expense) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        
        res.json(expense);
    } catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({ message: 'Failed to fetch expense' });
    }
});

// PUT /api/expenses/:id - Update an existing expense
app.put('/api/expenses/:id', upload.single('receipt'), async (req, res) => {
    console.log(`PUT /api/expenses/${req.params.id} hit`);
    try {
        const expenses = readData();
        const expenseIndex = expenses.findIndex(exp => exp.id === req.params.id);
        
        if (expenseIndex === -1) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        
        const existingExpense = expenses[expenseIndex];
        let { comments, tripName } = req.body; // Destructure tripName
        
        // Validate Trip Name if provided (it's required, but check format)
        // Allow undefined or null to keep existing, but not empty string
        if (tripName !== undefined && tripName !== null && (typeof tripName !== 'string' || tripName.trim() === '')) {
             // Clean up uploaded file if validation fails early
             if (req.file && req.file.path) {
                 fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after validation error:", err);});
             }
            return res.status(400).json({ message: 'Trip Name cannot be empty.' });
        }
        
        let type = existingExpense.type;
        let date = existingExpense.date;
        let location = existingExpense.location;
        let cost = existingExpense.cost;
        let receiptPath = existingExpense.receiptPath;
        let ocrAttempted = existingExpense.ocr?.attempted || false;
        let ocrFoundDate = existingExpense.ocr?.foundDate || null;
        let ocrFoundCost = existingExpense.ocr?.foundCost || null;
        let ocrFoundLocation = existingExpense.ocr?.foundLocation || null;
        let ocrFoundType = existingExpense.ocr?.foundType || null;
        
        // If a new receipt is uploaded, process it
        if (req.file) {
            // If there was a previous receipt, delete it
            if (existingExpense.receiptPath) {
                const oldFilePath = path.join(__dirname, existingExpense.receiptPath.replace('/uploads/', 'uploads/'));
                try {
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                        console.log(`Deleted old receipt: ${oldFilePath}`);
                    }
                } catch (err) {
                    console.error(`Error deleting old receipt: ${err}`);
                }
            }
            
            receiptPath = `/uploads/${req.file.filename}`;
            let ocrInput = null;
            
            // Process the new receipt for OCR
            ocrAttempted = true;
            console.log(`Processing uploaded file: ${req.file.path} (Type: ${req.file.mimetype})`);
            
            if (req.file.mimetype === 'application/pdf') {
                console.log('PDF detected, extracting text directly...');
                try {
                    // Extract text directly from PDF
                    const pdfText = await extractTextFromPDF(req.file.path);
                    console.log('PDF text extracted successfully.');
                    
                    // Process the extracted text directly
                    ocrFoundDate = findDateInText(pdfText);
                    ocrFoundCost = findCostInText(pdfText);
                    const ocrFoundVendor = findVendorInText(pdfText);
                    ocrFoundLocation = findLocationInText(pdfText);
                    ocrFoundType = findTypeInText(pdfText);
                    
                    console.log(`PDF text extraction results:
                        Date: ${ocrFoundDate || 'Not found'}
                        Cost: ${ocrFoundCost || 'Not found'}
                        Vendor: ${ocrFoundVendor || 'Not found'}
                        Location: ${ocrFoundLocation || 'Not found'}
                        Type: ${ocrFoundType || 'Not found'}
                    `);
                    
                    // Set the values from extracted results
                    date = ocrFoundDate;
                    cost = ocrFoundCost;
                    location = ocrFoundVendor || 'Unknown'; // Use vendor as location for now
                    type = ocrFoundType || 'Expense';
                    
                    // Skip the OCR step since we've already processed the text
                    ocrInput = null;
                    ocrAttempted = true;
                } catch (pdfError) {
                    console.error("PDF processing failed:", pdfError);
                    ocrInput = null;
                    ocrAttempted = false;
                }
            } else if (req.file.mimetype.startsWith('image/')) {
                ocrInput = req.file.path;
            } else {
                console.log(`Unsupported file type for OCR: ${req.file.mimetype}`);
                ocrAttempted = false;
            }
            
            // Perform OCR if possible
            if (ocrAttempted && ocrInput) {
                console.log(`Attempting OCR...`);
                try {
                    const { data: { text } } = await Tesseract.recognize(
                        ocrInput,
                        'eng',
                        { logger: m => console.log(m) }
                    );
                    console.log("OCR Result Text:\n", text);
                    
                    ocrFoundDate = findDateInText(text);
                    ocrFoundCost = findCostInText(text);
                    ocrFoundLocation = findLocationInText(text);
                    ocrFoundType = findTypeInText(text);
                    
                    console.log(`OCR results:
                        Date: ${ocrFoundDate || 'Not found'}
                        Cost: ${ocrFoundCost || 'Not found'}
                        Location: ${ocrFoundLocation || 'Not found'}
                        Type: ${ocrFoundType || 'Not found'}
                    `);
                    
                    // Set the values from OCR results
                    date = ocrFoundDate;
                    cost = ocrFoundCost;
                    location = ocrFoundLocation || 'Unknown';
                    type = ocrFoundType || 'Expense';
                } catch (ocrError) {
                    console.error("OCR processing failed:", ocrError);
                }
            }
        }
        
        // Update the expense
        // Prioritize form data, then OCR data (if new receipt), then existing data
        const finalType = req.body.type || type || existingExpense.type;
        const finalDate = req.body.date || date || existingExpense.date;
        const finalVendor = req.body.vendor || location || existingExpense.vendor; // Form > OCR Vendor > Existing
        const finalLocation = req.body.location || ocrFoundLocation || existingExpense.location; // Form > OCR Location > Existing
        const finalCost = parseFloat(req.body.cost || cost || existingExpense.cost);
        const finalComments = comments || existingExpense.comments; // Comments only come from form
        const finalTripName = req.body.tripName !== undefined ? (req.body.tripName || null) : existingExpense.tripName; // Allow clearing trip name
        
        const updatedExpense = {
            ...existingExpense,
            type: finalType,
            date: finalDate,
            vendor: finalVendor,
            location: finalLocation,
            tripName: finalTripName,
            cost: finalCost,
            comments: finalComments,
            receiptPath: receiptPath, // Always update receipt path if new file uploaded
            ocr: {
                attempted: ocrAttempted,
                foundDate: ocrFoundDate,
                foundCost: ocrFoundCost,
                foundVendor: location || null,
                foundLocation: ocrFoundLocation || null,
                foundType: ocrFoundType || null
            },
            updatedAt: new Date().toISOString()
        };
        
        if (req.file && (!date || !cost)) {
            return res.status(400).json({
                message: 'Could not extract required information from receipt. Please try with a clearer image.',
                missingFields: {
                    date: !date,
                    cost: !cost
                }
            });
        }
        
        expenses[expenseIndex] = updatedExpense;
        writeData(expenses);
        console.log('Expense updated:', updatedExpense);
        res.json({ message: 'Expense updated successfully', expense: updatedExpense });
        
    } catch (error) {
        console.error('Error updating expense:', error);
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file after server error:", err);
            });
        }
        res.status(500).json({ message: 'Failed to update expense due to server error.' });
    }
});

// DELETE /api/expenses/:id - Delete an expense
app.delete('/api/expenses/:id', (req, res) => {
    console.log(`DELETE /api/expenses/${req.params.id} hit`);
    try {
        const expenses = readData();
        const expenseIndex = expenses.findIndex(exp => exp.id === req.params.id);
        
        if (expenseIndex === -1) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        
        const expenseToDelete = expenses[expenseIndex];
        
        // If there's a receipt, delete the file
        if (expenseToDelete.receiptPath) {
            const filePath = path.join(__dirname, expenseToDelete.receiptPath.replace('/uploads/', 'uploads/'));
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted receipt: ${filePath}`);
                }
            } catch (err) {
                console.error(`Error deleting receipt: ${err}`);
                // Continue with deletion even if file removal fails
            }
        }
        
        // Remove the expense from the array
        expenses.splice(expenseIndex, 1);
        writeData(expenses);
        
        console.log(`Expense deleted: ${req.params.id}`);
        res.json({ message: 'Expense deleted successfully' });
        
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ message: 'Failed to delete expense due to server error.' });
    }
});

// POST /api/expenses/process - Process a receipt without saving
app.post('/api/expenses/process', upload.single('receipt'), async (req, res) => {
    console.log('POST /api/expenses/process hit');
    try {
        // Receipt is required
        if (!req.file) {
            return res.status(400).json({ message: 'Receipt upload is required for processing.' });
        }
        
        let type = null;
        let date = null;
        let vendor = null;
        let location = null;
        let cost = null;
        let ocrAttempted = true;
        let ocrInput = null;
        
        // Get OCR method from request body
        const ocrMethod = req.body.ocrMethod || 'builtin';
        const model = req.body.model; // Get model name
        
        console.log(`Processing uploaded file: ${req.file.path} (Type: ${req.file.mimetype}) using method: ${ocrMethod}`);
        
        // Extract text based on file type
        let text = '';
        try {
            if (req.file.mimetype === 'application/pdf') {
                text = await extractTextFromPDF(req.file.path);
                console.log('PDF text extracted successfully.');
            } else if (req.file.mimetype.startsWith('image/')) {
                // Use Tesseract to get base text even for AI methods (for simulation)
                const { data } = await Tesseract.recognize(req.file.path, 'eng');
                text = data.text;
                console.log('Image text extracted successfully using Tesseract.');
            } else {
                console.log(`Unsupported file type for OCR: ${req.file.mimetype}`);
                ocrAttempted = false;
            }
        } catch (textExtractionError) {
            console.error("Text extraction failed:", textExtractionError);
            ocrAttempted = false;
        }
        
        // Process based on OCR method if text extraction was successful
        if (ocrAttempted) {
            try {
                switch (ocrMethod) {
                    case 'openai':
                        const openaiKey = req.body.apiKey;
                        if (!openaiKey) throw new Error('API key is required for OpenAI OCR.');
                        console.log(`Simulating OpenAI Vision API processing with model: ${model}...`);
                        // TODO: Implement actual OpenAI API call
                        date = findDateInText(text); cost = findCostInText(text); vendor = findVendorInText(text); location = findLocationInText(text); type = findTypeInText(text);
                        if (!type && text.toLowerCase().includes('restaurant')) type = 'Meal';
                        console.log('OpenAI simulation complete');
                        break;
                    case 'gemini':
                        const geminiKey = req.body.apiKey;
                        if (!geminiKey) throw new Error('API key is required for Gemini OCR.');
                        console.log(`Simulating Google Gemini Vision processing with model: ${model}...`); // Model can be 'gemini-pro-vision' or 'gemini-2.0-flash'
                        // TODO: Implement actual Gemini API call
                        date = findDateInText(text); cost = findCostInText(text); vendor = findVendorInText(text); location = findLocationInText(text); type = findTypeInText(text);
                        
                        // --- Simulation Improvement ---
                        if (text.toLowerCase().includes('uber')) {
                            vendor = 'Uber';
                        } else if (!vendor && text.toLowerCase().includes('inc')) {
                            const lines = text.split('\n');
                            for (const line of lines) { if (line.toLowerCase().includes('inc')) { vendor = line.trim(); break; } }
                        }
                        // --- End Simulation Improvement ---
                        
                        console.log('Gemini simulation complete');
                        break;
                    case 'claude':
                        const claudeKey = req.body.apiKey;
                        if (!claudeKey) throw new Error('API key is required for Claude OCR.');
                        console.log(`Simulating Claude processing with model: ${model}...`);
                        // TODO: Implement actual Claude API call
                        date = findDateInText(text); cost = findCostInText(text); vendor = findVendorInText(text); location = findLocationInText(text); type = findTypeInText(text);
                        if (!location && text.toLowerCase().includes('address')) { const lines = text.split('\n'); for (const line of lines) { if (line.toLowerCase().includes('address')) { location = line.replace(/address[:\s]*/i, '').trim(); break; } } }
                        console.log('Claude simulation complete');
                        break;
                    case 'openrouter':
                        const openrouterKey = req.body.apiKey;
                        if (!openrouterKey) throw new Error('API key is required for Open Router OCR.');
                        console.log(`Simulating Open Router processing with model: ${model}...`);
                        // TODO: Implement actual Open Router API call
                        date = findDateInText(text); cost = findCostInText(text); vendor = findVendorInText(text); location = findLocationInText(text); type = findTypeInText(text);
                        if (!cost) { const totalPattern = /total[\s:]*\$?(\d+\.\d{2})/i; const match = text.match(totalPattern); if (match) cost = match[1]; }
                        console.log('Open Router simulation complete');
                        break;
                    default: // 'builtin'
                        console.log('Using built-in OCR processing...');
                        date = findDateInText(text); cost = findCostInText(text); vendor = findVendorInText(text); location = findLocationInText(text); type = findTypeInText(text);
                        console.log('Built-in OCR complete');
                        break;
                }
                
                console.log(`OCR results (${ocrMethod}):
                    Date: ${date || 'Not found'}
                    Cost: ${cost || 'Not found'}
                    Vendor: ${vendor || 'Not found'}
                    Location: ${location || 'Not found'}
                    Type: ${type || 'Not found'}
                `);
                
            } catch (ocrError) {
                console.error(`OCR processing failed for method ${ocrMethod}:`, ocrError);
                ocrAttempted = false; // Mark OCR as failed if any error occurs during processing
            }
        }
        // Clean up the uploaded file since we're not saving it
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting temporary file:", err);
            });
        }
        
        // Return the extracted data
        res.json({
            message: 'Receipt processed successfully',
            extractedData: {
                type: type,
                date: date,
                vendor: vendor,
                location: location,
                cost: cost
            },
            success: ocrAttempted && (date || cost || vendor || location || type)
        });
        
    } catch (error) {
        console.error('Error processing receipt:', error);
        
        // Clean up the uploaded file if an error occurred
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file after server error:", err);
            });
        }
        
        res.status(500).json({ message: 'Failed to process receipt due to server error.' });
    }
});

app.post('/api/expenses', upload.single('receipt'), async (req, res) => {
    console.log('POST /api/expenses hit');
    try {
        let { comments, tripName } = req.body; // Destructure tripName
        
        // Receipt and Trip Name are required
        if (!req.file) {
            return res.status(400).json({ message: 'Receipt upload is required.' });
        }
        if (!tripName || typeof tripName !== 'string' || tripName.trim() === '') {
             // Clean up uploaded file if validation fails early
             if (req.file && req.file.path) {
                 fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after validation error:", err);});
             }
            return res.status(400).json({ message: 'Trip Name is required.' });
        }
        
        let receiptPath = `/uploads/${req.file.filename}`;
        let type = null;
        let date = null;
        let location = null;
        let cost = null;
        let ocrAttempted = true;
        let ocrFoundDate = null;
        let ocrFoundCost = null;
        let ocrFoundLocation = null;
        let ocrFoundType = null;
        let ocrInput = null; // Will hold file path or image buffer

        // --- Prepare Input for OCR (Image or PDF) ---
        console.log(`Processing uploaded file: ${req.file.path} (Type: ${req.file.mimetype})`);

        if (req.file.mimetype === 'application/pdf') {
            console.log('PDF detected, extracting text directly...');
            try {
                // Extract text directly from PDF
                const pdfText = await extractTextFromPDF(req.file.path);
                console.log('PDF text extracted successfully.');
                
                // Process the extracted text directly
                ocrFoundDate = findDateInText(pdfText);
                ocrFoundCost = findCostInText(pdfText);
                const ocrFoundVendor = findVendorInText(pdfText);
                ocrFoundLocation = findLocationInText(pdfText);
                ocrFoundType = findTypeInText(pdfText);
                
                console.log(`PDF text extraction results:
                    Date: ${ocrFoundDate || 'Not found'}
                    Cost: ${ocrFoundCost || 'Not found'}
                    Vendor: ${ocrFoundVendor || 'Not found'}
                    Location: ${ocrFoundLocation || 'Not found'}
                    Type: ${ocrFoundType || 'Not found'}
                `);
                
                // Set the values from extracted results
                date = ocrFoundDate;
                cost = ocrFoundCost;
                location = ocrFoundVendor || 'Unknown'; // Use vendor as location for now
                type = ocrFoundType || 'Expense';
                
                // Skip the OCR step since we've already processed the text
                ocrInput = null;
                ocrAttempted = true;
            } catch (pdfError) {
                console.error("PDF processing failed:", pdfError);
                // Proceed without OCR if PDF extraction fails
                ocrInput = null;
                ocrAttempted = false; // Mark OCR as not attempted if extraction failed
            }
        } else if (req.file.mimetype.startsWith('image/')) {
            // For images, use the file path directly
            ocrInput = req.file.path;
        } else {
            console.log(`Unsupported file type for OCR: ${req.file.mimetype}`);
            ocrAttempted = false; // Cannot attempt OCR on unsupported types
        }
        // --- End Prepare Input ---


        // --- OCR Processing ---
        if (ocrAttempted && ocrInput) {
            console.log(`Attempting OCR...`);
            try {
                const { data: { text } } = await Tesseract.recognize(
                    ocrInput, // Use path for images, buffer for converted PDFs
                    'eng',
                    { logger: m => console.log(m) }
                );
                console.log("OCR Result Text:\n", text);

                ocrFoundDate = findDateInText(text);
                ocrFoundCost = findCostInText(text);
                const ocrFoundVendor = findVendorInText(text);
                ocrFoundLocation = findLocationInText(text);
                ocrFoundType = findTypeInText(text);

                console.log(`OCR results:
                    Date: ${ocrFoundDate || 'Not found'}
                    Cost: ${ocrFoundCost || 'Not found'}
                    Vendor: ${ocrFoundVendor || 'Not found'}
                    Location: ${ocrFoundLocation || 'Not found'}
                    Type: ${ocrFoundType || 'Not found'}
                `);

                // Set the values from OCR results
                date = ocrFoundDate;
                cost = ocrFoundCost;
                location = ocrFoundVendor || 'Unknown'; // Use vendor as location for now
                type = ocrFoundType || 'Expense';
            } catch (ocrError) {
                console.error("OCR processing failed:", ocrError);
                // Don't fail the request, just proceed without OCR data
            }
        }
        // --- End OCR Processing ---


        const expenses = readData();
        const newExpense = {
            id: Date.now().toString(),
            type: req.body.type || type, // Prioritize form input
            date: req.body.date || date, // Prioritize form input
            vendor: req.body.vendor || location, // Prioritize form input over initial OCR vendor
            location: req.body.location || ocrFoundLocation || 'Unknown', // Prioritize form input over initial OCR location
            cost: parseFloat(req.body.cost || cost), // Prioritize form input
            comments: comments, // Comments only come from form
            tripName: req.body.tripName || null,
            receiptPath: receiptPath,
            ocr: {
                attempted: ocrAttempted,
                foundDate: ocrFoundDate,
                foundCost: ocrFoundCost,
                foundVendor: location || null,
                foundLocation: ocrFoundLocation || null,
                foundType: ocrFoundType || null
            }
        };

        if (!date || !cost) {
            // Don't delete the original PDF/Image if OCR fails to extract required data
            return res.status(400).json({
                message: 'Could not extract required information from receipt. Please try with a clearer image.',
                missingFields: {
                    date: !date,
                    cost: !cost
                }
            });
        }

        expenses.push(newExpense);
        writeData(expenses);
        console.log('Expense added:', newExpense);
        res.status(201).json({ message: 'Expense added successfully', expense: newExpense });

    } catch (error) {
        console.error('Error adding expense:', error);
         // Clean up uploaded file if a server error occurred
         if (req.file && req.file.path) {
             fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after server error:", err);});
         }
        res.status(500).json({ message: 'Failed to add expense due to server error.' });
    }
});

// GET /api/export-expenses - Generate and download Excel file
app.get('/api/export-expenses', (req, res) => {
    const requestedTripName = req.query.tripName; // Get trip name from query param
    
    // Require tripName parameter
    if (!requestedTripName) {
        return res.status(400).send('Error: Please specify a tripName query parameter (e.g., /api/export-expenses?tripName=MyTrip).');
    }
    
    console.log(`GET /api/export-expenses hit. Trip requested: ${requestedTripName}`);
    
    try {
        let allExpenses = readData();
        let expensesToExport = [];
        let filenameBase = 'trip_expenses'; // Default if sanitization fails
        
        // Filter expenses for the requested tripName
        expensesToExport = allExpenses.filter(exp => exp.tripName === requestedTripName);
        
        // Sanitize trip name for filename
        filenameBase = requestedTripName.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_') || filenameBase;
        
        // Create a workbook with a worksheet
        const wb = XLSX.utils.book_new();
        
        // Define the headers
        const headers = ['Type', 'Date', 'Vendor', 'Location', 'Cost', 'Comments'];
        
        // Create data array with headers as first row
        const data = [headers];
        
        // Add expense data (filtered or all)
        if (expensesToExport && expensesToExport.length > 0) {
            expensesToExport.forEach(exp => {
                data.push([
                    exp.type || '',
                    exp.date || '',
                    exp.vendor || exp.location || '',
                    exp.location || '',
                    parseFloat(exp.cost || 0).toFixed(2),
                    exp.comments || ''
                ]);
            });
        } else if (requestedTripName) {
             console.log(`No expenses found for trip: ${requestedTripName}`);
        } else {
             console.log('No expenses found to export.');
        }
        
        // Create worksheet from data
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        
        // Generate a temporary file path
        const tempFilePath = path.join(__dirname, `expenses_${Date.now()}.xlsx`);
        
        // Write the workbook to a file
        XLSX.writeFile(wb, tempFilePath);
        
        // Set the filename for download using the sanitized trip name
        const filename = `${filenameBase}.xlsx`;
        
        // Send the file as a download
        res.download(tempFilePath, filename, (err) => {
            // Delete the temporary file after sending
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            
            if (err) {
                console.error('Error sending Excel file:', err);
                // If there was an error sending the file and it hasn't been deleted yet
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
        });
        
        console.log(`Generated Excel file: ${filename}`);
    } catch (error) {
        console.error('Error generating Excel export:', error);
        res.status(500).send('Error generating Excel file.');
    }
});

// POST /api/test-ocr - Test OCR processing without saving
app.post('/api/test-ocr', upload.single('receipt'), async (req, res) => {
    console.log('POST /api/test-ocr hit');
    try {
        // Receipt is required
        if (!req.file) {
            return res.status(400).json({ message: 'Receipt upload is required for OCR testing.' });
        }
        
        // Get OCR method from request
        const ocrMethod = req.body.ocrMethod || 'builtin';
        let type = null;
        let date = null;
        let vendor = null;
        let location = null;
        let cost = null;
        
        console.log(`Testing OCR with method: ${ocrMethod}`);
        console.log(`Processing uploaded file: ${req.file.path} (Type: ${req.file.mimetype})`);
        
        // Extract text based on file type
        let text = '';
        if (req.file.mimetype === 'application/pdf') {
            text = await extractTextFromPDF(req.file.path);
        } else if (req.file.mimetype.startsWith('image/')) {
            const { data } = await Tesseract.recognize(req.file.path, 'eng');
            text = data.text;
        } else {
            return res.status(400).json({ message: 'Unsupported file type for OCR.' });
        }
        
        // Get model from request body, specific to the provider
        const model = req.body.model;
        
        // Process based on OCR method
        switch (ocrMethod) {
            case 'openai':
                const openaiKey = req.body.apiKey;
                if (!openaiKey) {
                    return res.status(400).json({ message: 'API key is required for OpenAI OCR.' });
                }
                console.log(`Simulating OpenAI Vision API processing with model: ${model}...`);
                // TODO: Implement actual OpenAI API call using openaiKey and model
                date = findDateInText(text);
                cost = findCostInText(text);
                vendor = findVendorInText(text);
                location = findLocationInText(text);
                type = findTypeInText(text);
                if (!type && text.toLowerCase().includes('restaurant')) type = 'Meal';
                console.log('OpenAI simulation complete');
                break;
                
            case 'gemini':
                const geminiKey = req.body.apiKey;
                if (!geminiKey) {
                    return res.status(400).json({ message: 'API key is required for Gemini OCR.' });
                }
                console.log(`Simulating Google Gemini Vision processing with model: ${model}...`); // Model can be 'gemini-pro-vision' or 'gemini-2.0-flash'
                // TODO: Implement actual Gemini API call using geminiKey and model
                date = findDateInText(text);
                cost = findCostInText(text);
                vendor = findVendorInText(text); // Initial attempt
                location = findLocationInText(text);
                type = findTypeInText(text);
                
                // --- Simulation Improvement ---
                // If text contains "Uber", prioritize it as vendor
                if (text.toLowerCase().includes('uber')) {
                    vendor = 'Uber';
                } else if (!vendor && text.toLowerCase().includes('inc')) {
                    // Keep the existing improvement for 'inc' if Uber wasn't found
                    const lines = text.split('\n');
                    for (const line of lines) {
                        if (line.toLowerCase().includes('inc')) { vendor = line.trim(); break; }
                    }
                }
                // --- End Simulation Improvement ---
                
                console.log('Gemini simulation complete');
                break;
                
            case 'claude':
                const claudeKey = req.body.apiKey;
                if (!claudeKey) {
                    return res.status(400).json({ message: 'API key is required for Claude OCR.' });
                }
                console.log(`Simulating Claude processing with model: ${model}...`);
                 // TODO: Implement actual Claude API call using claudeKey and model
                date = findDateInText(text);
                cost = findCostInText(text);
                vendor = findVendorInText(text);
                location = findLocationInText(text);
                type = findTypeInText(text);
                if (!location && text.toLowerCase().includes('address')) {
                    const lines = text.split('\n');
                    for (const line of lines) {
                        if (line.toLowerCase().includes('address')) { location = line.replace(/address[:\s]*/i, '').trim(); break; }
                    }
                }
                console.log('Claude simulation complete');
                break;
                
            case 'openrouter':
                const openrouterKey = req.body.apiKey;
                if (!openrouterKey) {
                    return res.status(400).json({ message: 'API key is required for Open Router OCR.' });
                }
                console.log(`Simulating Open Router processing with model: ${model}...`);
                // TODO: Implement actual Open Router API call using openrouterKey and model
                date = findDateInText(text);
                cost = findCostInText(text);
                vendor = findVendorInText(text);
                location = findLocationInText(text);
                type = findTypeInText(text);
                if (!cost) {
                    const totalPattern = /total[\s:]*\$?(\d+\.\d{2})/i;
                    const match = text.match(totalPattern);
                    if (match) cost = match[1];
                }
                console.log('Open Router simulation complete');
                break;
                
            default: // 'builtin'
                console.log('Using built-in OCR processing...');
                date = findDateInText(text);
                cost = findCostInText(text);
                vendor = findVendorInText(text);
                location = findLocationInText(text);
                type = findTypeInText(text);
                console.log('Built-in OCR complete');
                break;
        }
        
        // Clean up the uploaded file
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting temporary file:", err);
            });
        }
        
        // Return the extracted data
        res.json({
            type: type,
            date: date,
            vendor: vendor,
            location: location,
            cost: cost,
            method: ocrMethod
        });
        
    } catch (error) {
        console.error('Error testing OCR:', error);
        
        // Clean up the uploaded file if an error occurred
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error deleting file after server error:", err);
            });
        }
        
        res.status(500).json({ message: 'Failed to test OCR due to server error.' });
    }
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Frontend accessible at http://localhost:${PORT}`);
});