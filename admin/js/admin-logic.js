const defaultEvents = [
    { name: "Tech Symposium", date: "2026-03-12", time: "Morning", venue: "Grand Auditorium", status: "Confirmed" },
    { name: "Basketball Finals", date: "2026-03-14", time: "Afternoon", venue: "Sports Complex", status: "Confirmed" },
    { name: "Literature Fest", date: "2026-03-18", time: "Evening", venue: "Conference Hall A", status: "Planning" }
];

const venues = ["Grand Auditorium", "Sports Complex", "Conference Hall A"];
const timeSlots = ["Morning", "Afternoon", "Evening"];

let events = [];
let clashCounter = 0;
let venueFilter = "all";

let budgetChartRef = null;
let burnChartRef = null;
let participationChartRef = null;

window.onload = async function () {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.body.setAttribute("data-theme", savedTheme);

    const dateInput = document.getElementById("eventDate");
    if (dateInput) dateInput.valueAsDate = new Date();

    await loadEventsFromServer();
    bindFormHandlers();
};

function hashText(text) {
    return text.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function eventMetrics(event, index) {
    const seed = hashText(event.name) + index * 13;
    const registrations = 120 + (seed % 320);
    const attendance = Math.min(registrations, Math.floor(registrations * (0.58 + (seed % 23) / 100)));
    const engagement = Math.round((attendance / Math.max(1, registrations)) * 100);
    const budgetNeed = 3000 + (seed % 7000);
    const categories = ["Marketing", "Logistics", "Security", "Hospitality"];
    const category = categories[index % categories.length];

    return { registrations, attendance, engagement, budgetNeed, category };
}

function getAnalyticsEvents() {
    return events.map((ev, idx) => ({ ...ev, ...eventMetrics(ev, idx) }));
}

async function loadEventsFromServer() {
    try {
        const response = await fetch("/api/events");
        const data = await response.json();
        events = Array.isArray(data) && data.length ? data : defaultEvents;
    } catch (error) {
        console.error("Error loading events:", error);
        events = defaultEvents;
    }

    renderEventsTable();
    renderAllInsights();
}

async function saveData() {
    try {
        const response = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(events)
        });
        if (!response.ok) throw new Error("Server failed to save");
    } catch (error) {
        console.error("Error saving data:", error);
        alert("Failed to save to server.");
    }
}

function bindFormHandlers() {
    const eventForm = document.getElementById("eventForm");
    if (!eventForm) return;

    eventForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const name = document.getElementById("eventName").value.trim();
        const date = document.getElementById("eventDate").value;
        const time = document.getElementById("eventTime").value;
        const venue = document.getElementById("eventVenue").value;

        const clashAlert = document.getElementById("clashAlert");
        const successAlert = document.getElementById("successAlert");

        const isClash = events.some((ev) => ev.status === "Confirmed" &&ev.date === date && ev.time === time && ev.venue === venue);

        if (isClash) {
            clashCounter += 1;
            clashAlert.classList.remove("hidden");
            successAlert.classList.add("hidden");
            setTimeout(() => clashAlert.classList.add("hidden"), 2600);
        } else {
            events.push({ name, date, time, venue, status: "Planning" });
            await saveData();
            renderEventsTable();
            renderAllInsights();

            successAlert.classList.remove("hidden");
            clashAlert.classList.add("hidden");
            eventForm.reset();
            document.getElementById("eventDate").valueAsDate = new Date();
            setTimeout(() => successAlert.classList.add("hidden"), 2600);
        }

        updateSchedulingKpis();
    });
}

function deleteEvent(index) {
    if (!confirm("Are you sure you want to delete this event?")) return;

    events.splice(index, 1);
    saveData();
    renderEventsTable();
    renderAllInsights();
}

function renderEventsTable() {
    const tbody = document.getElementById("eventsTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    events.forEach((event, index) => {
        const row = `
            <tr>
                <td><strong>${event.name}</strong></td>
                <td>${event.date} (${event.time})</td>
                <td>${event.venue}</td>
                <td>
                    <span class="status-badge ${event.status === "Confirmed" ? "status-good" : "status-watch"}">${event.status}</span>
                    <button onclick="deleteEvent(${index})" style="margin-left:10px; color:#e74c3c; background:none; border:none; cursor:pointer; font-weight:bold;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function showSection(sectionId, navItem) {
    document.querySelectorAll(".section").forEach((sec) => sec.classList.add("hidden"));
    document.querySelectorAll(".sidebar li").forEach((item) => item.classList.remove("active-nav"));

    document.getElementById(sectionId).classList.remove("hidden");
    if (navItem) navItem.classList.add("active-nav");
}

function updateSchedulingKpis() {
    const totalEl = document.getElementById("totalEventsDisplay");
    const todayEl = document.getElementById("todayBookings");
    const clashEl = document.getElementById("clashCount");

    const today = new Date().toISOString().slice(0, 10);
    const todayBookings = events.filter((ev) => ev.date === today).length;

    if (totalEl) totalEl.innerText = events.length;
    if (todayEl) todayEl.innerText = todayBookings;
    if (clashEl) clashEl.innerText = clashCounter;
}

function renderBudget() {
    const analytics = getAnalyticsEvents();
    const categories = ["Marketing", "Logistics", "Security", "Hospitality"];
    const allocated = {
        Marketing: 10000,
        Logistics: 16000,
        Security: 9000,
        Hospitality: 11000
    };

    const spent = { Marketing: 0, Logistics: 0, Security: 0, Hospitality: 0 };
    analytics.forEach((ev) => {
        spent[ev.category] += ev.budgetNeed;
    });

    const cards = document.getElementById("budgetCards");
    if (cards) {
        cards.innerHTML = categories
            .map((c) => {
                const pct = Math.min(100, Math.round((spent[c] / allocated[c]) * 100));
                const variance = allocated[c] - spent[c];
                return `
                    <div class="card metric-card">
                        <h4>${c}</h4>
                        <div class="metric-line"><span>Allocated</span><strong>$${allocated[c].toLocaleString()}</strong></div>
                        <div class="metric-line"><span>Spent</span><strong>$${spent[c].toLocaleString()}</strong></div>
                        <div class="metric-line"><span>Variance</span><strong>${variance >= 0 ? "+" : "-"}$${Math.abs(variance).toLocaleString()}</strong></div>
                        <div class="progress"><span style="width:${pct}%"></span></div>
                    </div>
                `;
            })
            .join("");
    }

    const budgetCtx = document.getElementById("budgetChart");
    if (budgetCtx) {
        if (budgetChartRef) budgetChartRef.destroy();
        budgetChartRef = new Chart(budgetCtx, {
            type: "doughnut",
            data: {
                labels: categories,
                datasets: [{
                    data: categories.map((c) => allocated[c]),
                    backgroundColor: ["#0f766e", "#3b82f6", "#d97706", "#7c3aed"]
                }]
            },
            options: { responsive: true, plugins: { legend: { position: "bottom" } } }
        });
    }

    const burnCtx = document.getElementById("burnChart");
    if (burnCtx) {
        if (burnChartRef) burnChartRef.destroy();
        burnChartRef = new Chart(burnCtx, {
            type: "bar",
            data: {
                labels: categories,
                datasets: [{
                    label: "Spent",
                    data: categories.map((c) => spent[c]),
                    backgroundColor: "#0f766e"
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}

function filterVenue(mode, button) {
    venueFilter = mode;
    document.querySelectorAll("#venues .chip").forEach((chip) => chip.classList.remove("active-chip"));
    if (button) button.classList.add("active-chip");
    renderVenueUtilization();
}

function renderVenueUtilization() {
    const matrix = document.getElementById("venueMatrix");
    if (!matrix) return;

    const rowData = venues.map((venue) => {
        const slotData = timeSlots.map((slot) => {
            const count = events.filter((ev) => ev.venue === venue && ev.time === slot).length;
            const utilization = Math.min(100, count * 38);
            return { slot, count, utilization };
        });
        const peak = Math.max(...slotData.map((s) => s.utilization));
        return { venue, slotData, peak };
    });

    const filtered = rowData.filter((row) => {
        if (venueFilter === "available") return row.peak < 38;
        if (venueFilter === "high") return row.peak >= 76;
        return true;
    });

    const header = `
        <div class="matrix-row">
            <div class="matrix-cell cell-head">Venue</div>
            <div class="matrix-cell cell-head">Morning</div>
            <div class="matrix-cell cell-head">Afternoon</div>
            <div class="matrix-cell cell-head">Evening</div>
        </div>
    `;

    const rows = filtered
        .map((row) => {
            const cells = row.slotData
                .map((slotData) => {
                    const cls = slotData.utilization >= 76 ? "occ-high" : slotData.utilization >= 38 ? "occ-mid" : "occ-low";
                    return `<div class="matrix-cell ${cls}">${slotData.count} event(s)<br>${slotData.utilization}% occupied</div>`;
                })
                .join("");
            return `<div class="matrix-row"><div class="matrix-cell cell-head">${row.venue}</div>${cells}</div>`;
        })
        .join("");

    matrix.innerHTML = header + (rows || "<div class='matrix-cell'>No venues match this filter.</div>");
}

function renderParticipation() {
    const analytics = getAnalyticsEvents();
    const rangeValue = document.getElementById("participationRange")?.value || "all";

    const sorted = [...analytics].sort((a, b) => new Date(b.date) - new Date(a.date));
    const selected = rangeValue === "all" ? sorted : sorted.slice(0, Number(rangeValue));

    const labels = selected.map((ev) => ev.name);
    const registrations = selected.map((ev) => ev.registrations);
    const attendance = selected.map((ev) => ev.attendance);

    const partCtx = document.getElementById("participationChart");
    if (partCtx) {
        if (participationChartRef) participationChartRef.destroy();
        participationChartRef = new Chart(partCtx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    { label: "Registrations", data: registrations, backgroundColor: "#3b82f6" },
                    { label: "Attendance", data: attendance, backgroundColor: "#0f766e" }
                ]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    const leaderboard = document.getElementById("topEventsList");
    if (leaderboard) {
        const top = [...analytics].sort((a, b) => b.attendance - a.attendance).slice(0, 5);
        leaderboard.innerHTML = top
            .map((ev, idx) => `<li><span>${idx + 1}. ${ev.name}</span><strong>${ev.attendance} attendees</strong></li>`)
            .join("");
    }
}

function renderPerformance() {
    const analytics = getAnalyticsEvents();
    const averageEngagement = analytics.length
        ? Math.round(analytics.reduce((sum, ev) => sum + ev.engagement, 0) / analytics.length)
        : 0;

    const highRisk = analytics.filter((ev) => ev.engagement < 55).length;
    const healthy = analytics.filter((ev) => ev.engagement >= 75).length;

    const kpis = document.getElementById("performanceKpis");
    if (kpis) {
        kpis.innerHTML = `
            <div class="card kpi"><h3>Avg Engagement</h3><p>${averageEngagement}%</p></div>
            <div class="card kpi"><h3>High-Risk Events</h3><p>${highRisk}</p></div>
            <div class="card kpi"><h3>Healthy Events</h3><p>${healthy}</p></div>
        `;
    }

    const riskRows = analytics
        .filter((ev) => ev.engagement < 75)
        .sort((a, b) => a.engagement - b.engagement)
        .map((ev) => {
            const risk = ev.engagement < 55 ? "High" : "Watch";
            const badgeClass = ev.engagement < 55 ? "status-risk" : "status-watch";
            return `
                <tr>
                    <td>${ev.name}</td>
                    <td>${ev.engagement}%</td>
                    <td><span class="status-badge ${badgeClass}">${risk}</span></td>
                </tr>
            `;
        })
        .join("");

    const riskTableBody = document.getElementById("riskTableBody");
    if (riskTableBody) {
        riskTableBody.innerHTML = riskRows || "<tr><td colspan='3'>No underperforming events found.</td></tr>";
    }
}

function renderPlanning() {
    const analytics = getAnalyticsEvents();
    const planningGrid = document.getElementById("planningGrid");
    if (!planningGrid) return;

    const venueLoads = venues.map((venue) => ({
        venue,
        load: events.filter((ev) => ev.venue === venue).length
    }));
    const recommendedVenue = venueLoads.sort((a, b) => a.load - b.load)[0]?.venue || "Conference Hall A";

    const avgAtt = analytics.length
        ? Math.round(analytics.reduce((sum, ev) => sum + ev.attendance, 0) / analytics.length)
        : 200;

    const avgBudget = analytics.length
        ? Math.round(analytics.reduce((sum, ev) => sum + ev.budgetNeed, 0) / analytics.length)
        : 5000;

    const recommendations = [
        {
            title: "Innovation Summit 2026",
            detail: `Projected attendance: ${avgAtt + 45} | Suggested slot: Morning`,
            sub: `Recommended venue: ${recommendedVenue}`,
            confidence: 82
        },
        {
            title: "Cultural Week Launch",
            detail: `Projected budget: $${(avgBudget + 1200).toLocaleString()} | Suggested slot: Evening`,
            sub: "Higher engagement expected with club collaborations",
            confidence: 76
        },
        {
            title: "Career Expo",
            detail: `Projected attendance: ${avgAtt + 90} | Suggested slot: Afternoon`,
            sub: "Use multi-zone setup for smoother crowd flow",
            confidence: 88
        }
    ];

    planningGrid.innerHTML = recommendations
        .map(
            (rec) => `
            <div class="card metric-card">
                <h4>${rec.title}</h4>
                <p class="metric-line">${rec.detail}</p>
                <p class="metric-line">${rec.sub}</p>
                <div class="metric-line"><span>Confidence</span><strong class="metric-strong">${rec.confidence}%</strong></div>
                <div class="progress"><span style="width:${rec.confidence}%"></span></div>
            </div>
        `
        )
        .join("");
}

function renderAllInsights() {
    updateSchedulingKpis();
    renderBudget();
    renderVenueUtilization();
    renderParticipation();
    renderPerformance();
    renderPlanning();
}

function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute("data-theme") === "dark";

    if (isDark) {
        body.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
    } else {
        body.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
    }
}
// --- 9. EVENT CONFIRMATION LOGIC ---
const confirmForm = document.getElementById('confirmForm');

if (confirmForm) {
    confirmForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const name = document.getElementById('confirmName').value.trim();
        const time = document.getElementById('confirmTime').value;
        const venue = document.getElementById('confirmVenue').value;
        const msgBox = document.getElementById('confirmMessage');

        // 1. Find the event that is currently "Planning"
        const targetIndex = events.findIndex(ev => 
            ev.name.toLowerCase() === name.toLowerCase() && 
            ev.time === time && 
            ev.venue === venue && 
            ev.status === "Planning"
        );

        if (targetIndex === -1) {
            msgBox.className = "alert error";
            msgBox.innerHTML = "<strong>Error!</strong> No 'Planning' event found matching these details.";
            msgBox.classList.remove('hidden');
            setTimeout(() => msgBox.classList.add('hidden'), 4000);
            return;
        }

        const eventToConfirm = events[targetIndex];

        // 2. Final Clash Check: Is another event ALREADY confirmed for this Date, Time, and Venue?
        const isClash = events.some(ev => 
            ev.status === "Confirmed" && 
            ev.date === eventToConfirm.date && // Inherits date from the planned event
            ev.time === eventToConfirm.time && 
            ev.venue === eventToConfirm.venue
        );

        if (isClash) {
            msgBox.className = "alert error";
            msgBox.innerHTML = "<strong>Clash Detected!</strong> Another event was confirmed for this venue and time while you were planning.";
            msgBox.classList.remove('hidden');
        } else {
            // 3. Success! Upgrade status to Confirmed
            events[targetIndex].status = "Confirmed";
            saveData();
            renderEventsTable();
            
            msgBox.className = "alert success";
            msgBox.innerHTML = "<strong>Success!</strong> Event is now Confirmed.";
            msgBox.classList.remove('hidden');
            confirmForm.reset();
        }
        
        setTimeout(() => msgBox.classList.add('hidden'), 4000);
    });
}
