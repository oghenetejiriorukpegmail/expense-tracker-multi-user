// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const { db } = require('../database'); // Adjust path as needed

// Ensure JWT_SECRET is set in your .env file!
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    // In a real app, you might want to exit or prevent the server from starting
    // process.exit(1);
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        console.log('Auth Middleware: No token provided.');
        return res.sendStatus(401); // if there isn't any token
    }

    if (!JWT_SECRET) {
         console.error("Auth Middleware: JWT_SECRET is missing, cannot verify token.");
         return res.sendStatus(500); // Internal server error if secret is missing
    }

    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) {
            console.log('Auth Middleware: Token verification failed:', err.message);
            return res.sendStatus(403); // Token is no longer valid or incorrect
        }

        // Token is valid, fetch user details from DB to ensure user still exists
        // We only stored the user ID in the token payload
        const sql = "SELECT id, username FROM users WHERE id = ?";
        db.get(sql, [userPayload.userId], (dbErr, user) => {
            if (dbErr) {
                console.error('Auth Middleware: Database error fetching user:', dbErr.message);
                return res.sendStatus(500);
            }
            if (!user) {
                console.log('Auth Middleware: User from token not found in DB (ID:', userPayload.userId, ')');
                return res.sendStatus(403); // User associated with token doesn't exist anymore
            }

            // Attach user info to the request object
            req.user = user; // Contains { id, username }
            console.log('Auth Middleware: User authenticated (ID:', req.user.id, ')');
            next(); // proceed to the next middleware or route handler
        });
    });
};

module.exports = authenticateToken;