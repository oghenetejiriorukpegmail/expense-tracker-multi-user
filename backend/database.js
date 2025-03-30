// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'expenses.db'); // Use the existing db file name

// Connect to the database (or create it if it doesn't exist)
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

// Function to initialize database tables
const initializeDatabase = () => {
    db.serialize(() => {
        // Create users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                console.log('Users table checked/created successfully.');
            }
        });

        // Create expenses table
        db.run(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT,
                date TEXT NOT NULL,
                vendor TEXT,
                location TEXT,
                cost REAL NOT NULL,
                comments TEXT,
                tripName TEXT,
                receiptPath TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                console.error('Error creating expenses table:', err.message);
            } else {
                console.log('Expenses table checked/created successfully.');
            }
        });

        // Add indexes for potentially faster lookups
        db.run('CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses (user_id);', (err) => {
             if (err) console.error('Error creating user_id index:', err.message);
        });
         db.run('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date);', (err) => {
             if (err) console.error('Error creating date index:', err.message);
        });
         db.run('CREATE INDEX IF NOT EXISTS idx_expenses_tripName ON expenses (tripName);', (err) => {
             if (err) console.error('Error creating tripName index:', err.message);
        });
    });
};

// Function to close the database connection
const closeDatabase = () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
    });
};

// Export the database connection and close function
module.exports = { db, closeDatabase, initializeDatabase };