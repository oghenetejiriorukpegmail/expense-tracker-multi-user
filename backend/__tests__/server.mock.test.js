const request = require('supertest');

// Import the mock app
const app = require('./server.test.mock');

describe('Expense API Endpoints (Mock Server)', () => {
    // Test GET /api/expenses
    it('should fetch all expenses', async () => {
        const res = await request(app).get('/api/expenses');
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toEqual(2);
        expect(res.body[0]).toHaveProperty('id', '1');
        expect(res.body[1]).toHaveProperty('tripName', 'Test Trip');
    });

    // Test POST /api/expenses - Basic success case
    it('should add a new expense', async () => {
        const newExpenseData = {
            type: 'Food',
            date: '2024-03-15',
            vendor: 'Super Cafe',
            location: 'Downtown',
            cost: 15.75,
            comments: 'Lunch meeting',
            tripName: 'Work Trip'
        };

        const res = await request(app)
            .post('/api/expenses')
            .send(newExpenseData);

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('message', 'Expense added successfully');
        expect(res.body).toHaveProperty('expense');
        expect(res.body.expense).toHaveProperty('id');
        expect(res.body.expense.type).toEqual(newExpenseData.type);
        expect(res.body.expense.vendor).toEqual(newExpenseData.vendor);
        expect(res.body.expense.cost).toEqual(newExpenseData.cost);
        expect(res.body.expense.tripName).toEqual(newExpenseData.tripName);
    });

    // Test GET /api/expenses/:id
    it('should fetch a single expense', async () => {
        const res = await request(app).get('/api/expenses/1');
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('id', '1');
        expect(res.body).toHaveProperty('type', 'Test');
        expect(res.body).toHaveProperty('tripName', 'Test Trip');
    });

    // Test PUT /api/expenses/:id
    it('should update an expense', async () => {
        const updateData = {
            type: 'Updated Type',
            cost: 25.00
        };

        const res = await request(app)
            .put('/api/expenses/2')
            .send(updateData);

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message', 'Expense updated successfully');
        expect(res.body.expense).toHaveProperty('id', '2');
        expect(res.body.expense).toHaveProperty('type', 'Updated Type');
        expect(res.body.expense).toHaveProperty('cost', 25.00);
        expect(res.body.expense).toHaveProperty('tripName', 'Test Trip');
    });

    // Test DELETE /api/expenses/:id
    it('should delete an expense', async () => {
        const res = await request(app).delete('/api/expenses/1');
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message', 'Expense deleted successfully');
        
        // Verify the expense was deleted
        const checkRes = await request(app).get('/api/expenses/1');
        expect(checkRes.statusCode).toEqual(404);
    });
});