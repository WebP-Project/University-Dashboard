document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    // This is where you connect to your Node.js Server 
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });

        const data = await response.json();

        if (response.ok) {
            // If admin, go to admin dash; if student, go to event list 
            window.location.href = data.redirectUrl;
        } else {
            document.getElementById('message').innerText = data.error;
        }
    } catch (err) {
        console.error("Login failed", err);
    }
});

// Run this function when the page loads
window.addEventListener('DOMContentLoaded', fetchEvents);

async function fetchEvents() {
    try {
        // Request the list of events from your Node.js server
        const response = await fetch('/api/events');
        const events = await response.json();

        const grid = document.getElementById('eventGrid');
        grid.innerHTML = ''; // Clear the "Loading" message

        if (events.length === 0) {
            grid.innerHTML = '<p>No upcoming events found.</p>';
            return;
        }

        // Loop through each event and create a card
        events.forEach(event => {
            const card = document.createElement('div');
            card.className = 'event-card';
            card.innerHTML = `
                <h3>${event.name}</h3>
                <p><strong>Date:</strong> ${event.date}</p>
                <p><strong>Venue:</strong> ${event.venue}</p>
                <p>${event.description}</p>
                <button onclick="registerForEvent('${event.id}')" class="register-btn">
                    Register Now
                </button>
            `;
            grid.appendChild(card);
        });

    } catch (err) {
        console.error("Error loading events:", err);
    }
}

async function registerForEvent(eventId) {
    alert("Sending registration for event ID: " + eventId);
    // You would eventually add a fetch('/api/register', ...) call here
}