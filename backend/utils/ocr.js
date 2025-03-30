/**
 * OCR Utilities Module
 * 
 * This module contains functions for Optical Character Recognition (OCR)
 * processing of receipts and other documents.
 */

const fs = require('fs');
const Tesseract = require('tesseract.js');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Extract text from a PDF file
 * @param {string} pdfPath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text from the PDF
 */
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

/**
 * Convert a file to a generative part for AI API requests
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Object} - Generative part object for AI API
 */
function fileToGenerativePart(filePath, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType
        },
    };
}

/**
 * Find a date in the OCR text
 * @param {string} text - OCR text to search
 * @returns {string|null} - Extracted date in YYYY-MM-DD format or null if not found
 */
function findDateInText(text) {
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
}

/**
 * Find a cost/amount in the OCR text
 * @param {string} text - OCR text to search
 * @returns {string|null} - Extracted cost as a string or null if not found
 */
function findCostInText(text) {
    const lines = text.split('\n');
    let bestMatch = null;
    let maxCost = -1;
    const costRegex = /\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/;
    
    // First try to find costs in lines with keywords like "total", "amount", etc.
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
    
    // If no match found with keywords, look for any cost in the text
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
}

/**
 * Find a vendor name in the OCR text
 * @param {string} text - OCR text to search
 * @returns {string|null} - Extracted vendor name or null if not found
 */
function findVendorInText(text) {
    const lines = text.split('\n');
    if (lines.length === 0) return null;
    
    // Look for a line that doesn't contain common receipt words
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 1 && !trimmedLine.match(/receipt|invoice|order|date|time|customer|phone|tel|fax|www|http|cash|card|total|amount/i)) {
            return trimmedLine;
        }
    }
    
    // If no suitable line found, return the first line
    return lines[0].trim() || null;
}

/**
 * Find a location in the OCR text
 * @param {string} text - OCR text to search
 * @returns {string|null} - Extracted location or null if not found
 */
function findLocationInText(text) {
    const lines = text.split('\n');
    const cityStateZipRegex = /([a-zA-Z\s\-\']+),?\s+([A-Z]{2})\s+(\d{5}(-\d{4})?)/;
    const cityStateRegex = /([a-zA-Z\s\-\']+),\s+([A-Z]{2})/;
    
    // Look for city, state, zip format
    for (const line of lines) {
        const cityStateZipMatch = line.match(cityStateZipRegex);
        if (cityStateZipMatch && cityStateZipMatch[1]) return cityStateZipMatch[1].trim();
        const cityStateMatch = line.match(cityStateRegex);
        if (cityStateMatch && cityStateMatch[1]) return cityStateMatch[1].trim();
    }
    
    // Look for street address format
    for (const line of lines) {
        if (line.match(/\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|blvd|ln|dr)/i) && !line.match(/total|amount|cash|card/i)) {
            const parts = line.split(',');
            if (parts.length > 1) return parts[0].trim();
            return line.trim();
        }
    }
    
    return null;
}

/**
 * Find an expense type in the OCR text
 * @param {string} text - OCR text to search
 * @returns {string} - Extracted expense type or "Expense" if not found
 */
function findTypeInText(text) {
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
}

/**
 * Process OCR using Tesseract (built-in)
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<Object>} - Extracted data
 */
async function processWithBuiltinOCR(filePath, mimeType) {
    let text = '';
    
    if (mimeType === 'application/pdf') {
        text = await extractTextFromPDF(filePath);
    } else if (mimeType.startsWith('image/')) {
        const { data } = await Tesseract.recognize(filePath, 'eng');
        text = data.text;
    } else {
        throw new Error('Unsupported file type for OCR.');
    }
    
    return {
        type: findTypeInText(text),
        date: findDateInText(text),
        vendor: findVendorInText(text),
        location: findLocationInText(text),
        cost: findCostInText(text),
        method: 'builtin'
    };
}

/**
 * Process OCR using Google Gemini API
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type of the file
 * @param {string} apiKey - Gemini API key
 * @param {string} modelName - Gemini model name
 * @returns {Promise<Object>} - Extracted data
 */
async function processWithGeminiOCR(filePath, mimeType, apiKey, modelName = 'gemini-pro-vision') {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `Extract the following details from this receipt image/document in JSON format: date (YYYY-MM-DD), cost (total amount as number), vendor (store/service name), location (city/address), type (e.g., Groceries, Dining, Transportation, Shopping, Utilities, Entertainment, Healthcare, Travel, Office, Expense). If a field cannot be determined, use null for its value. Respond ONLY with the JSON object. Example: {"date": "2024-01-15", "cost": 25.50, "vendor": "Example Store", "location": "Anytown", "type": "Shopping"}`;

        const imagePart = fileToGenerativePart(filePath, mimeType);

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
            const date = extractedData.date && typeof extractedData.date === 'string' && extractedData.date.match(/^\d{4}-\d{2}-\d{2}$/) ? extractedData.date : null;
            const cost = extractedData.cost && !isNaN(parseFloat(extractedData.cost)) ? parseFloat(extractedData.cost).toFixed(2) : null;
            const vendor = extractedData.vendor && typeof extractedData.vendor === 'string' ? extractedData.vendor.trim() : null;
            const location = extractedData.location && typeof extractedData.location === 'string' ? extractedData.location.trim() : null;
            const type = extractedData.type && typeof extractedData.type === 'string' ? extractedData.type.trim() : 'Expense';

            console.log(`Gemini Parsed Data: Date: ${date}, Cost: ${cost}, Vendor: ${vendor}, Location: ${location}, Type: ${type}`);
            
            return {
                type,
                date,
                vendor,
                location,
                cost,
                method: 'gemini'
            };
        } catch (parseError) {
            console.error("Failed to parse JSON response from Gemini:", parseError);
            console.error("Original Gemini response text:", responseText);
            
            // Fallback to basic text extraction if JSON parsing fails
            console.log("Falling back to basic text extraction using Tesseract...");
            return processWithBuiltinOCR(filePath, mimeType);
        }
    } catch (geminiError) {
        console.error("Error calling Gemini API:", geminiError);
        // Fallback to built-in OCR on API error
        console.log("Gemini API call failed. Falling back to built-in OCR...");
        return processWithBuiltinOCR(filePath, mimeType);
    }
}

/**
 * Process OCR using OpenAI API
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type of the file
 * @param {string} apiKey - OpenAI API key
 * @param {string} modelName - OpenAI model name (e.g., gpt-4-vision-preview)
 * @returns {Promise<Object>} - Extracted data
 */
async function processWithOpenAIOCR(filePath, mimeType, apiKey, modelName = 'gpt-4-vision-preview') {
    try {
        const openai = new OpenAI({ apiKey });
        const base64Image = Buffer.from(fs.readFileSync(filePath)).toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        const prompt = `Extract the following details from this receipt image/document in JSON format: date (YYYY-MM-DD), cost (total amount as number), vendor (store/service name), location (city/address), type (e.g., Groceries, Dining, Transportation, Shopping, Utilities, Entertainment, Healthcare, Travel, Office, Expense). If a field cannot be determined, use null for its value. Respond ONLY with the JSON object. Example: {"date": "2024-01-15", "cost": 25.50, "vendor": "Example Store", "location": "Anytown", "type": "Shopping"}`;

        const response = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: { url: dataUrl },
                        },
                    ],
                },
            ],
            // Optional: Add max_tokens if needed
            // max_tokens: 300,
        });

        const responseText = response.choices[0].message.content;
        console.log("OpenAI API Response Text:", responseText);

        try {
            const jsonString = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const extractedData = JSON.parse(jsonString);

            const date = extractedData.date && typeof extractedData.date === 'string' && extractedData.date.match(/^\d{4}-\d{2}-\d{2}$/) ? extractedData.date : null;
            const cost = extractedData.cost && !isNaN(parseFloat(extractedData.cost)) ? parseFloat(extractedData.cost).toFixed(2) : null;
            const vendor = extractedData.vendor && typeof extractedData.vendor === 'string' ? extractedData.vendor.trim() : null;
            const location = extractedData.location && typeof extractedData.location === 'string' ? extractedData.location.trim() : null;
            const type = extractedData.type && typeof extractedData.type === 'string' ? extractedData.type.trim() : 'Expense';

            console.log(`OpenAI Parsed Data: Date: ${date}, Cost: ${cost}, Vendor: ${vendor}, Location: ${location}, Type: ${type}`);
            return { type, date, vendor, location, cost, method: 'openai' };
        } catch (parseError) {
            console.error("Failed to parse JSON response from OpenAI:", parseError);
            console.error("Original OpenAI response text:", responseText);
            console.log("Falling back to built-in OCR...");
            return processWithBuiltinOCR(filePath, mimeType);
        }
    } catch (apiError) {
        console.error("Error calling OpenAI API:", apiError);
        console.log("OpenAI API call failed. Falling back to built-in OCR...");
        return processWithBuiltinOCR(filePath, mimeType);
    }
}

/**
 * Process OCR using Anthropic Claude API
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type of the file
 * @param {string} apiKey - Anthropic API key
 * @param {string} modelName - Claude model name (e.g., claude-3-haiku-20240307)
 * @returns {Promise<Object>} - Extracted data
 */
async function processWithClaudeOCR(filePath, mimeType, apiKey, modelName = 'claude-3-haiku-20240307') {
     // Claude Vision currently requires specific MIME types
     const supportedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
     if (!supportedMimeTypes.includes(mimeType)) {
         console.warn(`Claude does not support MIME type ${mimeType}. Falling back to built-in OCR.`);
         return processWithBuiltinOCR(filePath, mimeType);
     }

    try {
        const anthropic = new Anthropic({ apiKey });
        const base64Image = Buffer.from(fs.readFileSync(filePath)).toString('base64');

        const prompt = `Extract the following details from this receipt image in JSON format: date (YYYY-MM-DD), cost (total amount as number), vendor (store/service name), location (city/address), type (e.g., Groceries, Dining, Transportation, Shopping, Utilities, Entertainment, Healthcare, Travel, Office, Expense). If a field cannot be determined, use null for its value. Respond ONLY with the JSON object. Example: {"date": "2024-01-15", "cost": 25.50, "vendor": "Example Store", "location": "Anytown", "type": "Shopping"}`;

        const msg = await anthropic.messages.create({
            model: modelName,
            max_tokens: 1024, // Adjust as needed
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mimeType,
                                data: base64Image,
                            },
                        },
                        { type: 'text', text: prompt }
                    ],
                },
                 // Add assistant prefill if needed to guide JSON output
                 // { role: 'assistant', content: '{' }
            ],
        });

        const responseText = msg.content[0].text;
        console.log("Claude API Response Text:", responseText);

        try {
            // Claude might sometimes wrap the JSON, try to extract it
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const extractedData = JSON.parse(jsonString);

            const date = extractedData.date && typeof extractedData.date === 'string' && extractedData.date.match(/^\d{4}-\d{2}-\d{2}$/) ? extractedData.date : null;
            const cost = extractedData.cost && !isNaN(parseFloat(extractedData.cost)) ? parseFloat(extractedData.cost).toFixed(2) : null;
            const vendor = extractedData.vendor && typeof extractedData.vendor === 'string' ? extractedData.vendor.trim() : null;
            const location = extractedData.location && typeof extractedData.location === 'string' ? extractedData.location.trim() : null;
            const type = extractedData.type && typeof extractedData.type === 'string' ? extractedData.type.trim() : 'Expense';

            console.log(`Claude Parsed Data: Date: ${date}, Cost: ${cost}, Vendor: ${vendor}, Location: ${location}, Type: ${type}`);
            return { type, date, vendor, location, cost, method: 'claude' };
        } catch (parseError) {
            console.error("Failed to parse JSON response from Claude:", parseError);
            console.error("Original Claude response text:", responseText);
            console.log("Falling back to built-in OCR...");
            return processWithBuiltinOCR(filePath, mimeType);
        }
    } catch (apiError) {
        console.error("Error calling Claude API:", apiError);
        console.log("Claude API call failed. Falling back to built-in OCR...");
        return processWithBuiltinOCR(filePath, mimeType);
    }
}

/**
 * Process OCR using OpenRouter API (using OpenAI compatible endpoint)
 * @param {string} filePath - Path to the file
 * @param {string} mimeType - MIME type of the file
 * @param {string} apiKey - OpenRouter API key
 * @param {string} modelName - OpenRouter model name (e.g., openai/gpt-4-vision-preview)
 * @returns {Promise<Object>} - Extracted data
 */
async function processWithOpenRouterOCR(filePath, mimeType, apiKey, modelName = 'openai/gpt-4-vision-preview') {
     // Note: This assumes the OpenRouter model is OpenAI vision compatible.
     // Adjust if using a different model type.
    try {
        const openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: apiKey,
            // Optional: Set headers for app identification
            // defaultHeaders: {
            //   "HTTP-Referer": $YOUR_SITE_URL, // Optional, for including your app on openrouter.ai rankings.
            //   "X-Title": $YOUR_SITE_NAME, // Optional. Shows in rankings on openrouter.ai.
            // },
        });

        const base64Image = Buffer.from(fs.readFileSync(filePath)).toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        const prompt = `Extract the following details from this receipt image/document in JSON format: date (YYYY-MM-DD), cost (total amount as number), vendor (store/service name), location (city/address), type (e.g., Groceries, Dining, Transportation, Shopping, Utilities, Entertainment, Healthcare, Travel, Office, Expense). If a field cannot be determined, use null for its value. Respond ONLY with the JSON object. Example: {"date": "2024-01-15", "cost": 25.50, "vendor": "Example Store", "location": "Anytown", "type": "Shopping"}`;

        const response = await openai.chat.completions.create({
            model: modelName,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: { url: dataUrl },
                        },
                    ],
                },
            ],
        });

        const responseText = response.choices[0].message.content;
        console.log("OpenRouter API Response Text:", responseText);

        try {
            const jsonString = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            const extractedData = JSON.parse(jsonString);

            const date = extractedData.date && typeof extractedData.date === 'string' && extractedData.date.match(/^\d{4}-\d{2}-\d{2}$/) ? extractedData.date : null;
            const cost = extractedData.cost && !isNaN(parseFloat(extractedData.cost)) ? parseFloat(extractedData.cost).toFixed(2) : null;
            const vendor = extractedData.vendor && typeof extractedData.vendor === 'string' ? extractedData.vendor.trim() : null;
            const location = extractedData.location && typeof extractedData.location === 'string' ? extractedData.location.trim() : null;
            const type = extractedData.type && typeof extractedData.type === 'string' ? extractedData.type.trim() : 'Expense';

            console.log(`OpenRouter Parsed Data: Date: ${date}, Cost: ${cost}, Vendor: ${vendor}, Location: ${location}, Type: ${type}`);
            return { type, date, vendor, location, cost, method: 'openrouter' };
        } catch (parseError) {
            console.error("Failed to parse JSON response from OpenRouter:", parseError);
            console.error("Original OpenRouter response text:", responseText);
            console.log("Falling back to built-in OCR...");
            return processWithBuiltinOCR(filePath, mimeType);
        }
    } catch (apiError) {
        console.error("Error calling OpenRouter API:", apiError);
        console.log("OpenRouter API call failed. Falling back to built-in OCR...");
        return processWithBuiltinOCR(filePath, mimeType);
    }
}


module.exports = {
    extractTextFromPDF,
    fileToGenerativePart,
    findDateInText,
    findCostInText,
    findVendorInText,
    findLocationInText,
    findTypeInText,
    processWithBuiltinOCR,
    processWithGeminiOCR,
    processWithOpenAIOCR,
    processWithClaudeOCR,
    processWithOpenRouterOCR
};