
// Default data (only used if nothing is in LocalStorage)
const defaultEvents = [
    { name: "Tech Symposium", date: "2023-11-15", time: "Morning", venue: "Grand Auditorium", status: "Confirmed" },
    { name: "Basketball Finals", date: "2023-11-16", time: "Afternoon", venue: "Sports Complex", status: "Confirmed" },
    { name: "Literature Fest", date: "2023-11-20", time: "Morning", venue: "Conference Hall A", status: "Planning" }
];

// Load from LocalStorage OR use default data
let events = [];

window.onload = async function() {
    await loadEventsFromServer(); // Load data from JSON file
    initCharts();

    // Theme logic remains the same
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
};

async function loadEventsFromServer() {
    try {
        const response = await fetch('/api/events');
        data= await response.json();
        events=data.length>0 ? data:defaultEvents;
        renderEventsTable();
    } catch (error) {
        console.error("Error loading events:", error);
        events = defaultEvents;
        renderEventsTable();// Fallback
    }
}



// --- 3. HELPER: SAVE DATA ---
async function saveData() {
    try {
        const response= await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(events)
        });
        if(!response.ok) throw new Error("Server failed to save");
        document.getElementById('totalEventsDisplay').innerText = events.length;
    } catch (error) {
        console.error("Error saving data:", error);
        alert("Failed to save to server!");
    }
}

// --- 4. NAVIGATION LOGIC ---
/*
function showSection(sectionId) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(sec => sec.classList.add('hidden'));

    const navItems = document.querySelectorAll('.sidebar li');
    navItems.forEach(item => item.classList.remove('active-nav'));

    document.getElementById(sectionId).classList.remove('hidden');
    event.currentTarget.classList.add('active-nav');
}
*/
// --- 5. SCHEDULING LOGIC ---
const eventForm = document.getElementById('eventForm');

eventForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const name = document.getElementById('eventName').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const venue = document.getElementById('eventVenue').value;

    const clashAlert = document.getElementById('clashAlert');
    const successAlert = document.getElementById('successAlert');

    // Check for Clash
    const isClash = events.some(ev => 
        ev.date === date && 
        ev.time === time && 
        ev.venue === venue
    );

    if (isClash) {
        clashAlert.classList.remove('hidden');
        successAlert.classList.add('hidden');
        setTimeout(() => clashAlert.classList.add('hidden'), 3000);
    } else {
        // Add to array
        events.push({ 
            name: name, 
            date: date, 
            time: time, 
            venue: venue, 
            status: "Confirmed" 
        });

        // SAVE TO LOCAL STORAGE
        saveData();

        renderEventsTable();
        successAlert.classList.remove('hidden');
        clashAlert.classList.add('hidden');
        eventForm.reset();
        setTimeout(() => successAlert.classList.add('hidden'), 3000);
    }
});

// --- 6. DELETE FUNCTIONALITY ---
function deleteEvent(index) {
    if(confirm("Are you sure you want to delete this event?")) {
        events.splice(index, 1); // Remove from array
        saveData(); // Save new state
        renderEventsTable(); // Update UI
    }
}
//Edit Fuctionality
function editEvent(index) {
    const eventToEdit = events[index];

    // 1. Fill the form with the existing data
    document.getElementById('eventName').value = eventToEdit.name;
    document.getElementById('eventDate').value = eventToEdit.date;
    document.getElementById('eventTime').value = eventToEdit.time;
    document.getElementById('eventVenue').value = eventToEdit.venue;

    // 2. Remove the event from the list (so we don't get duplicates when they save)
    events.splice(index, 1);

    // 3. Scroll user back to the form
    document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('eventName').focus();

    renderEventsTable();
}

// --- 7. RENDER TABLE ---
function renderEventsTable() {
    const tbody = document.getElementById('eventsTableBody');
    tbody.innerHTML = '';

    events.forEach((event, index) => {
        let badgeClass = event.status === 'Confirmed' ? 'status-confirmed' : 'status-planning';
        
        const row = `
            <tr>
                <td><strong>${event.name}</strong></td>
                <td>${event.date} (${event.time})</td>
                <td>${event.venue}</td>
                <td>
                    <span class="status-badge ${badgeClass}">${event.status}</span>
                    <button onclick="deleteEvent(${index})" style="margin-left:10px; color:#e74c3c; background:none; border:none; cursor:pointer; font-weight:bold;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
    
    // Update counter
    document.getElementById('totalEventsDisplay').innerText = events.length;
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.sidebar li').forEach(item => item.classList.remove('active-nav'));

    document.getElementById(sectionId).classList.remove('hidden');
    event.currentTarget.classList.add('active-nav');
}

// --- 8. CHARTS (Static for now) ---
function initCharts() {
    const budgetCtx = document.getElementById('budgetChart').getContext('2d');
    new Chart(budgetCtx, {
        type: 'doughnut',
        data: {
            labels: ['Marketing', 'Logistics', 'Security', 'Refreshments'],
            datasets: [{
                data: [5000, 15000, 8000, 12000],
                backgroundColor: ['#3498db', '#2ecc71', '#f1c40f', '#e74c3c']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    const partCtx = document.getElementById('participationChart').getContext('2d');
    new Chart(partCtx, {
        type: 'bar',
        data: {
            labels: ['Tech Symp', 'Sports Day', 'Lit Fest', 'Music Night'],
            datasets: [{
                label: 'Student Attendees',
                data: [450, 1200, 300, 850],
                backgroundColor: '#9b59b6'
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}
// --- DARK MODE TOGGLE ---
function toggleTheme() {
    const body = document.body;
    // Check if dark mode is currently active
    const isDark = body.getAttribute('data-theme') === 'dark';
    
    // Switch logic
    if (isDark) {
        body.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light'); // Save preference
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark'); // Save preference
    }
}

