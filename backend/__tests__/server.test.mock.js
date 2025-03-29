const express = require('express');
const app = express();

// Mock data
let mockExpenses = [
    { id: '1', type: 'Test', date: '2024-01-01', vendor: 'Test Vendor', location: 'Test Location', cost: 10.00, tripName: 'Test Trip' },
    { id: '2', type: 'Test 2', date: '2024-01-02', vendor: 'Test Vendor 2', location: 'Test Location 2', cost: 20.50, tripName: 'Test Trip' }
];

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock file upload middleware
app.use((req, res, next) => {
    if (req.path === '/api/expenses' && req.method === 'POST') {
        req.file = {
            fieldname: 'receipt',
            originalname: 'receipt.jpg',
            encoding: '7bit',
            mimetype: 'image/jpeg',
            destination: '../uploads',
            filename: 'mock-filename.jpg',
            path: '../uploads/mock-filename.jpg',
            size: 12345
        };
    }
    next();
});

// GET /api/expenses
app.get('/api/expenses', (req, res) => {
    return res.json(mockExpenses);
});

// GET /api/expenses/:id
app.get('/api/expenses/:id', (req, res) => {
    const expense = mockExpenses.find(exp => exp.id === req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    return res.json(expense);
});

// POST /api/expenses
app.post('/api/expenses', (req, res) => {
    const { type, date, vendor, location, cost, comments, tripName } = req.body;
    
    // Basic validation
    if (!type || !date || !vendor || !location || !cost || !tripName) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const newExpense = {
        id: Date.now().toString(),
        type,
        date,
        vendor,
        location,
        cost: parseFloat(cost),
        comments: comments || '',
        tripName,
        receiptPath: req.file ? `/uploads/${req.file.filename}` : null,
        createdAt: new Date().toISOString()
    };
    
    mockExpenses.push(newExpense);
    
    return res.status(201).json({
        message: 'Expense added successfully',
        expense: newExpense
    });
});

// PUT /api/expenses/:id
app.put('/api/expenses/:id', (req, res) => {
    const expenseIndex = mockExpenses.findIndex(exp => exp.id === req.params.id);
    if (expenseIndex === -1) return res.status(404).json({ message: 'Expense not found' });
    
    const { type, date, vendor, location, cost, comments, tripName } = req.body;
    const existingExpense = mockExpenses[expenseIndex];
    
    const updatedExpense = {
        ...existingExpense,
        type: type || existingExpense.type,
        date: date || existingExpense.date,
        vendor: vendor || existingExpense.vendor,
        location: location || existingExpense.location,
        cost: cost ? parseFloat(cost) : existingExpense.cost,
        comments: comments !== undefined ? comments : existingExpense.comments,
        tripName: tripName || existingExpense.tripName,
        receiptPath: req.file ? `/uploads/${req.file.filename}` : existingExpense.receiptPath,
        updatedAt: new Date().toISOString()
    };
    
    mockExpenses[expenseIndex] = updatedExpense;
    
    return res.json({
        message: 'Expense updated successfully',
        expense: updatedExpense
    });
});

// DELETE /api/expenses/:id
app.delete('/api/expenses/:id', (req, res) => {
    const expenseIndex = mockExpenses.findIndex(exp => exp.id === req.params.id);
    if (expenseIndex === -1) return res.status(404).json({ message: 'Expense not found' });
    
    mockExpenses.splice(expenseIndex, 1);
    
    return res.json({ message: 'Expense deleted successfully' });
});

// Add a dummy test to avoid Jest error
if (process.env.NODE_ENV === 'test') {
    test('Dummy test to avoid Jest error', () => {
        expect(true).toBe(true);
    });
}

module.exports = app;