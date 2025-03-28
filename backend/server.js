const express = require('express');
const path = require('path');
const fs = require('fs'); // File system module
const multer = require('multer'); // Middleware for handling file uploads
const Tesseract = require('tesseract.js'); // OCR library
const XLSX = require('xlsx'); // Excel library

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

// --- OCR Helper Functions (Basic Parsing) ---
const findDateInText = (text) => {
    const dateRegex = /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{1,2}\.\d{1,2}\.\d{2,4})/;
    const match = text.match(dateRegex);
    if (match) {
        let dateStr = match[0];
        try {
            const parts = dateStr.split(/[-\/.]/);
            if (parts.length === 3) {
                let year = parts[2], month = parts[0], day = parts[1];
                 if (parts[0].length === 4) {
                    year = parts[0]; month = parts[1]; day = parts[2];
                 } else if (parts[2].length === 2) {
                     year = parseInt(parts[2]) < 70 ? '20' + parts[2] : '19' + parts[2];
                 } else if (parts[2].length === 4) {
                     year = parts[2];
                 }
                 month = month.padStart(2, '0');
                 day = day.padStart(2, '0');
                 // Basic validation for parsed date parts
                 if (parseInt(month) > 0 && parseInt(month) <= 12 && parseInt(day) > 0 && parseInt(day) <= 31) {
                    return `${year}-${month}-${day}`;
                 }
            }
        } catch (e) { console.error("Date parsing error:", e); }
        return dateStr; // Return original match if parsing/validation fails
    }
    return null;
};

const findCostInText = (text) => {
    const lines = text.split('\n');
    let bestMatch = null;
    let maxCost = -1;
    const costRegex = /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/;

    for (const line of lines) {
        if (line.match(/total|amount|balance|due/i)) {
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


// --- API Routes ---

app.get('/api/expenses', (req, res) => {
    console.log('GET /api/expenses hit');
    const expenses = readData();
    res.json(expenses);
});

app.post('/api/expenses', upload.single('receipt'), async (req, res) => {
    console.log('POST /api/expenses hit');
    try {
        let { type, date, location, cost, comments } = req.body;
        let receiptPath = req.file ? `/uploads/${req.file.filename}` : null;
        let ocrAttempted = false;
        let ocrFoundDate = null;
        let ocrFoundCost = null;

        if (req.file) {
            ocrAttempted = true;
            console.log(`Attempting OCR on ${req.file.path}...`);
            try {
                const { data: { text } } = await Tesseract.recognize(
                    req.file.path, 'eng', { logger: m => console.log(m) }
                );
                console.log("OCR Result Text:\n", text);
                ocrFoundDate = findDateInText(text);
                ocrFoundCost = findCostInText(text);
                if (ocrFoundDate) {
                    console.log(`OCR found date: ${ocrFoundDate}, overriding manual entry: ${date}`);
                    date = ocrFoundDate;
                }
                if (ocrFoundCost) {
                    console.log(`OCR found cost: ${ocrFoundCost}, overriding manual entry: ${cost}`);
                    cost = ocrFoundCost;
                }
            } catch (ocrError) {
                console.error("OCR processing failed:", ocrError);
            }
        }

        const expenses = readData();
        const newExpense = {
            id: Date.now().toString(), type: type, date: date, location: location,
            cost: parseFloat(cost), comments: comments, receiptPath: receiptPath,
            ocr: { attempted: ocrAttempted, foundDate: ocrFoundDate, foundCost: ocrFoundCost }
        };

        if (!newExpense.type || !newExpense.date || isNaN(newExpense.cost)) {
             if (req.file) { fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after failed validation:", err);}); }
             return res.status(400).json({ message: 'Missing required fields (type, date, cost) after potential OCR.' });
        }

        expenses.push(newExpense);
        writeData(expenses);
        console.log('Expense added:', newExpense);
        res.status(201).json({ message: 'Expense added successfully', expense: newExpense });

    } catch (error) {
        console.error('Error adding expense:', error);
         if (req.file && req.file.path) { fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after server error:", err);}); }
        res.status(500).json({ message: 'Failed to add expense due to server error.' });
    }
});

// GET /api/expenses/export - Generate and download Excel file
app.get('/api/expenses/export', (req, res) => {
    console.log('GET /api/expenses/export hit');
    try {
        const expenses = readData();

        // Prepare data for worksheet: Array of arrays
        const dataForSheet = [
            ['Type', 'Date', 'Location', 'Cost', 'Comments', 'Receipt Path'] // Header row
        ];

        expenses.forEach(exp => {
            dataForSheet.push([
                exp.type,
                exp.date,
                exp.location || '', // Handle potentially missing location
                exp.cost,
                exp.comments || '', // Handle potentially missing comments
                exp.receiptPath || '' // Handle potentially missing receipt path
            ]);
        });

        // Create workbook and worksheet
        const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses'); // Sheet name 'Expenses'

        // Generate Excel file buffer
        // 'bookSST: true' helps with compatibility for strings
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', bookSST: true });

        // Set response headers for file download
        const filename = `expenses_${new Date().toISOString().split('T')[0]}.xlsx`; // e.g., expenses_2025-03-28.xlsx
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // Send the buffer
        res.send(excelBuffer);
        console.log(`Generated and sent ${filename}`);

    } catch (error) {
        console.error('Error generating Excel export:', error);
        res.status(500).send('Error generating Excel file.');
    }
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Frontend accessible at http://localhost:${PORT}`);
});