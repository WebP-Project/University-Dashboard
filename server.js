const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Middleware to handle data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Paths to your JSON "databases"
const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// --- 1. SERVE FILES ---

// Serve the 'Public' folder (contains login.html, client.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Serve 'Admin' folder
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// --- 2. API ROUTES ---

// API: LOGIN ROUTE
app.post('/api/login', (req, res) => {
    const { email, password, role } = req.body;

    console.log("--- Login Attempt ---");
    console.log("Email provided:", email);
    console.log("Role selected:", role);
    // Read the users file
    fs.readFile(USERS_FILE, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: "Could not read user database" });
        }

        const users = JSON.parse(data || "[]");

        // Find user with matching credentials and role
        const user = users.find(u => u.email === email && u.password === password && u.role === role);

        if (user) {
            console.log("Result: SUCCESS - User found:", user.username);
            // Determine redirect URL based on role
            // NOTE: If your admin.html is INSIDE the /admin folder, use '/admin/dashboard.html'
            const redirectUrl = (user.role === 'admin') ? '/admin/dashboard.html' : 'client.html';
            
            res.json({ success: true, redirectUrl: redirectUrl });
        } else {
            console.log("Result: FAILED - No match found in users.json");
            res.status(401).json({ success: false, error: "Invalid email, password, or role!" });
        }
    });
});

// API: Get All Events
app.get('/api/events', (req, res) => {
    fs.readFile(EVENTS_FILE, 'utf8', (err, data) => {
        if (err) return res.json([]);
        res.json(JSON.parse(data || "[]"));
    });
});

// API: Save/Update Events (Used by Admin Logic)
app.post('/api/events', (req, res) => {
    const newEvents = req.body;
    fs.writeFile(EVENTS_FILE, JSON.stringify(newEvents, null, 2), (err) => {
        if (err) return res.status(500).send('Error saving data');
        res.send('Data saved successfully');
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Login Page: http://localhost:${PORT}/login.html`);
});
