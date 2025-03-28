const express = require('express');
const path = require('path');
const fs = require('fs'); // File system module
const multer = require('multer'); // Middleware for handling file uploads
const Tesseract = require('tesseract.js'); // OCR library
const XLSX = require('xlsx'); // Excel library
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js'); // PDF processing
const { createCanvas } = require('canvas'); // For rendering PDF page to image

// Required for pdfjs-dist node usage
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

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
async function pdfToImageBuffer(pdfPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdfDocument = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdfDocument.getPage(1); // Get the first page

    // Set scale for rendering quality
    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    // Prepare canvas using 'canvas' package
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    // Render PDF page into canvas context
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    await page.render(renderContext).promise;

    // Return image buffer (PNG format)
    return canvas.toBuffer('image/png');
}


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
        let ocrInput = null; // Will hold file path or image buffer

        // --- Prepare Input for OCR (Image or PDF) ---
        if (req.file) {
            ocrAttempted = true;
            console.log(`Processing uploaded file: ${req.file.path} (Type: ${req.file.mimetype})`);

            if (req.file.mimetype === 'application/pdf') {
                console.log('PDF detected, converting first page to image for OCR...');
                try {
                    ocrInput = await pdfToImageBuffer(req.file.path);
                    console.log('PDF page converted to image buffer.');
                } catch (pdfError) {
                    console.error("PDF processing failed:", pdfError);
                    // Proceed without OCR if PDF conversion fails
                    ocrInput = null;
                    ocrAttempted = false; // Mark OCR as not attempted if conversion failed
                }
            } else if (req.file.mimetype.startsWith('image/')) {
                // For images, use the file path directly
                ocrInput = req.file.path;
            } else {
                console.log(`Unsupported file type for OCR: ${req.file.mimetype}`);
                ocrAttempted = false; // Cannot attempt OCR on unsupported types
            }
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
                // Don't fail the request, just proceed without OCR data
            }
        }
        // --- End OCR Processing ---


        const expenses = readData();
        const newExpense = {
            id: Date.now().toString(), type: type, date: date, location: location,
            cost: parseFloat(cost), comments: comments, receiptPath: receiptPath,
            ocr: { attempted: ocrAttempted, foundDate: ocrFoundDate, foundCost: ocrFoundCost }
        };

        if (!newExpense.type || !newExpense.date || isNaN(newExpense.cost)) {
             // Don't delete the original PDF/Image if validation fails after OCR attempt
             // as the user might want to retry manually. Only delete if server error occurs later.
             return res.status(400).json({ message: 'Missing required fields (type, date, cost) after potential OCR.' });
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

// GET /api/expenses/export - Generate and download Excel file
app.get('/api/expenses/export', (req, res) => {
    console.log('GET /api/expenses/export hit');
    try {
        const expenses = readData();
        const dataForSheet = [
            ['Type', 'Date', 'Location', 'Cost', 'Comments', 'Receipt Path']
        ];
        expenses.forEach(exp => {
            dataForSheet.push([
                exp.type, exp.date, exp.location || '', exp.cost,
                exp.comments || '', exp.receiptPath || ''
            ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(dataForSheet);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', bookSST: true });
        const filename = `expenses_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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