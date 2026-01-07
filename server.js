const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Middleware to handle data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Path to your database
const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');

// --- 1. SERVE FILES ---

// Serve the 'Public' folder (For your friend's Client View) at root URL '/'
app.use(express.static(path.join(__dirname, 'public')));

// Serve n'
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// --- 2. API ROUTES (The Connection) ---

// API: Get All Events (Used by both Admin and Client)
app.get('/api/events', (req, res) => {
    fs.readFile(EVENTS_FILE, 'utf8', (err, data) => {
        if (err) {
            // If file doesn't exist, return empty array
            return res.json([]);
        }
        res.json(JSON.parse(data || "[]"));
    });
});

// API: Save/Update Events (Used by Admin Logic)
app.post('/api/events', (req, res) => {
    const newEvents = req.body; // The array sent from admin-logic.js
    
    // Write the new list to the JSON file
    fs.writeFile(EVENTS_FILE, JSON.stringify(newEvents, null, 2), (err) => {
        if (err) {
            return res.status(500).send('Error saving data');
        }
        res.send('Data saved successfully');
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Admin Dashboard: http://localhost:${PORT}/admin/dashboard.html`);
});