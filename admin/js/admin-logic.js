const defaultEvents = [
    {
        name: "Tech Symposium",
        date: "2026-03-12",
        time: "Morning",
        venue: "Grand Auditorium",
        status: "Confirmed",
        description: "A university-wide technology showcase with student innovations and expert sessions."
    },
    {
        name: "Basketball Finals",
        date: "2026-03-14",
        time: "Afternoon",
        venue: "Sports Complex",
        status: "Confirmed",
        description: "Championship game featuring top college teams and live audience engagement."
    },
    {
        name: "Literature Fest",
        date: "2026-03-18",
        time: "Evening",
        venue: "Conference Hall A",
        status: "Planning",
        description: "Literary activities including poetry, talks, and student-led book discussions."
    }
];

const venues = ["Grand Auditorium", "Sports Complex", "Conference Hall A"];
const timeSlots = ["Morning", "Afternoon", "Evening"];

let events = [];
let registrations = [];
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

    setupAdminSessionUI();
    await loadEventsFromServer();
    await loadRegistrationsFromServer();
    bindFormHandlers();
};

function hashText(text) {
    return text.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function getEventId(event) {
    return `${event.name}|${event.date}|${event.time || "TBA"}|${event.venue}`;
}

function getRegistrationCountMap() {
    const map = {};
    registrations.forEach((reg) => {
        map[reg.eventId] = (map[reg.eventId] || 0) + 1;
    });
    return map;
}

function eventMetrics(event, index, registrationMap) {
    const seed = hashText(event.name) + index * 13;
    const eventId = getEventId(event);
    const realRegistrations = registrationMap[eventId] || 0;
    const baselineRegistrations = 120 + (seed % 320);
    const registrationsCount = baselineRegistrations + realRegistrations;
    const attendance = Math.min(registrationsCount, Math.floor(registrationsCount * (0.68 + (seed % 12) / 100)));
    const engagement = Math.round((attendance / Math.max(1, registrationsCount)) * 100);
    const budgetNeed = 3000 + (seed % 7000);
    const categories = ["Marketing", "Logistics", "Security", "Hospitality"];
    const category = categories[index % categories.length];

    return { registrations: registrationsCount, attendance, engagement, budgetNeed, category };
}

function getAnalyticsEvents() {
    const registrationMap = getRegistrationCountMap();
    return events.map((ev, idx) => ({ ...ev, ...eventMetrics(ev, idx, registrationMap) }));
}

function ensureEventDescriptions(eventList) {
    return eventList.map((ev) => ({
        ...ev,
        description: (ev.description && ev.description.trim()) || `Details for ${ev.name}.`
    }));
}

async function loadEventsFromServer() {
    try {
        const response = await fetch("/api/events");
        const data = await response.json();
        events = ensureEventDescriptions(Array.isArray(data) && data.length ? data : defaultEvents);
    } catch (error) {
        console.error("Error loading events:", error);
        events = ensureEventDescriptions(defaultEvents);
    }

    renderEventsTable();
    renderAllInsights();
    populateConfirmationDropdown();
}

async function loadRegistrationsFromServer() {
    try {
        const response = await fetch("/api/registrations");
        const data = await response.json();
        registrations = Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Error loading registrations:", error);
        registrations = [];
    }
    renderAllInsights();
}

async function setupAdminSessionUI() {
    bindAdminProfilePanel();
    bindAdminLogout();
    try {
        const res = await fetch("/api/me");
        if (!res.ok) {
            window.location.href = "/login.html";
            return;
        }
        const user = await res.json();
        const nameEl = document.getElementById("adminProfileName");
        const emailEl = document.getElementById("adminProfileEmail");
        const roleEl = document.getElementById("adminProfileRole");
        const topNameEl = document.getElementById("adminTopName");
        if (nameEl) nameEl.textContent = user.username || "-";
        if (emailEl) emailEl.textContent = user.email || "-";
        if (roleEl) roleEl.textContent = user.role || "-";
        if (topNameEl) topNameEl.textContent = user.username || "Admin";
    } catch (err) {
        console.error("Failed to load admin profile", err);
        window.location.href = "/login.html";
    }
}

function bindAdminProfilePanel() {
    const toggle = document.getElementById("adminProfileToggle");
    const panel = document.getElementById("adminProfilePanel");
    if (!toggle || !panel) return;

    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        panel.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
        if (panel.classList.contains("hidden")) return;
        if (!panel.contains(e.target) && !toggle.contains(e.target)) {
            panel.classList.add("hidden");
        }
    });
}

function bindAdminLogout() {
    const logoutBtn = document.getElementById("adminLogoutBtn");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async () => {
        try {
            await fetch("/api/logout", { method: "POST" });
        } catch (err) {
            console.error("Admin logout failed", err);
        }
        window.location.href = "/login.html";
    });
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
        const descriptionInput = document.getElementById("eventDescription");
        const description = descriptionInput?.value.trim() || `Details for ${name}.`;
        const clashAlert = document.getElementById("clashAlert");
        const successAlert = document.getElementById("successAlert");

        const isClash = events.some((ev) => ev.status === "Confirmed" &&ev.date === date && ev.time === time && ev.venue === venue);

        if (isClash) {
            clashCounter += 1;
            clashAlert.classList.remove("hidden");
            successAlert.classList.add("hidden");
            setTimeout(() => clashAlert.classList.add("hidden"), 2600);
        } else {
            events.push({ name, date, time, venue, description, status: "Planning" });
            await saveData();
            renderEventsTable();
            renderAllInsights();
            populateConfirmationDropdown();
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
                <td><strong class="event-name-text" title="${event.name}">${event.name}</strong></td>
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
    const totalEventsEl = document.getElementById('totalEvents');
    if (totalEventsEl) totalEventsEl.textContent = events.length;

// 2. Add the new calculations for Confirmed and Planning events:
    const confirmedEventsEl = document.getElementById('confirmedEventsCount');
    const planningEventsEl = document.getElementById('planningEventsCount');

    if (confirmedEventsEl && planningEventsEl) {
    // Count how many events have the status "Confirmed"
        const confirmedCount = events.filter(ev => ev.status === "Confirmed").length;
    // Count how many events have the status "Planning"
        const planningCount = events.filter(ev => ev.status === "Planning").length;

    // Update the numbers on the screen
    confirmedEventsEl.textContent = confirmedCount;
    planningEventsEl.textContent = planningCount;
    }
}

function showSection(sectionId, navItem) {
    document.querySelectorAll(".section").forEach((sec) => sec.classList.add("hidden"));
    document.querySelectorAll(".sidebar li").forEach((item) => item.classList.remove("active-nav"));

    document.getElementById(sectionId).classList.remove("hidden");
    if (navItem) navItem.classList.add("active-nav");
    if (sectionId === "participation") loadRegistrationsFromServer();
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

    const spentPct = categories.map((c) => {
        const pct = Math.round((spent[c] / allocated[c]) * 100);
        return Math.min(100, pct);
    });

    const remainingPct = categories.map((c) => {
        const remaining = Math.max(0, allocated[c] - spent[c]);
        return Math.round((remaining / allocated[c]) * 100);
    });

    const allocatedValues = categories.map((c) => allocated[c]);
    const spentValues = categories.map((c) => spent[c]);

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
            type: "bar",
            data: {
                labels: categories,
                datasets: [
                    {
                        label: "Spent %",
                        data: spentPct,
                        backgroundColor: "#0f766e"
                    },
                    {
                        label: "Remaining %",
                        data: remainingPct,
                        backgroundColor: "#cbd5e1"
                    }
                ]
            },
            options: {
                responsive: true,
                indexAxis: "y",
                scales: {
                    x: {
                        stacked: true,
                        min: 0,
                        max: 100,
                        ticks: {
                            callback: (value) => `${value}%`
                        }
                    },
                    y: { stacked: true }
                },
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%`
                        }
                    }
                }
            }
        });
    }

    const burnCtx = document.getElementById("burnChart");
    if (burnCtx) {
        if (burnChartRef) burnChartRef.destroy();
        burnChartRef = new Chart(burnCtx, {
            type: "bar",
            data: {
                labels: categories,
                datasets: [
                    {
                        label: "Allocated ($)",
                        data: allocatedValues,
                        backgroundColor: "#94a3b8"
                    },
                    {
                        label: "Spent ($)",
                        data: spentValues,
                        backgroundColor: "#0f766e"
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: $${ctx.raw.toLocaleString()}`
                        }
                    }
                }
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

function getVenueDateBounds(rangeKey) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (rangeKey === "week") {
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return { start, end };
    }

    if (rangeKey === "month") {
        const end = new Date(start);
        end.setDate(end.getDate() + 29);
        return { start, end };
    }

    const parsedDates = events
        .map((ev) => new Date(ev.date))
        .filter((d) => !Number.isNaN(d.getTime()));

    if (!parsedDates.length) {
        return { start, end: new Date(start) };
    }

    const minDate = new Date(Math.min(...parsedDates));
    const maxDate = new Date(Math.max(...parsedDates));
    return { start: minDate, end: maxDate };
}

function isDateInRange(dateText, start, end) {
    const d = new Date(dateText);
    if (Number.isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d >= start && d <= end;
}

function formatISODate(dateObj) {
    return dateObj.toISOString().slice(0, 10);
}

function parseEventDate(dateText) {
    const [year, month, day] = (dateText || "").split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function renderVenueUtilization() {
    const matrix = document.getElementById("venueMatrix");
    const overview = document.getElementById("venueOverview");
    if (!matrix) return;

    const rangeKey = document.getElementById("venueRange")?.value || "month";
    const { start, end } = getVenueDateBounds(rangeKey);

    const rangeEvents = events.filter((ev) => isDateInRange(ev.date, start, end));
    const daysInRange = Math.max(1, Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1);

    const rowData = venues.map((venue) => {
        const venueEvents = rangeEvents.filter((ev) => ev.venue === venue);

        const slotGroupCount = {};
        const dayLoads = {};

        venueEvents.forEach((ev) => {
            const slotKey = `${ev.date}|${ev.time}`;
            slotGroupCount[slotKey] = (slotGroupCount[slotKey] || 0) + 1;
            dayLoads[ev.date] = (dayLoads[ev.date] || 0) + 1;
        });

        const clashCount = Object.values(slotGroupCount).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
        const totalEvents = venueEvents.length;
        const avgPerDay = Number((totalEvents / daysInRange).toFixed(2));
        const utilization = Math.round((avgPerDay / timeSlots.length) * 100);
        const activeDays = Object.keys(dayLoads).length;

        const peakEntry = Object.entries(dayLoads).sort((a, b) => b[1] - a[1])[0];
        const peakDay = peakEntry ? peakEntry[0] : "N/A";
        const peakPerDay = peakEntry ? peakEntry[1] : 0;

        return {
            venue,
            utilization,
            clashCount,
            totalEvents,
            avgPerDay,
            activeDays,
            peakDay,
            peakPerDay
        };
    });

    const filtered = rowData.filter((row) => {
        if (venueFilter === "available") return row.avgPerDay <= 0.6;
        if (venueFilter === "high") return row.avgPerDay >= 1.5;
        return true;
    });

    if (overview) {
        const avgUtil = rowData.length
            ? Math.round(rowData.reduce((sum, row) => sum + row.utilization, 0) / rowData.length)
            : 0;
        const totalClashes = rowData.reduce((sum, row) => sum + row.clashCount, 0);
        const mostLoaded = [...rowData].sort((a, b) => b.avgPerDay - a.avgPerDay)[0];

        overview.innerHTML = `
            <div class="card metric-card">
                <h4>Range Window</h4>
                <div class="metric-strong">${formatISODate(start)} to ${formatISODate(end)}</div>
                <p>${daysInRange} day(s) analyzed</p>
            </div>
            <div class="card metric-card">
                <h4>Average Utilization / Day</h4>
                <div class="metric-strong">${avgUtil}%</div>
                <p>Based on average events per day per venue</p>
            </div>
            <div class="card metric-card">
                <h4>Total Clash Risk</h4>
                <div class="metric-strong">${totalClashes}</div>
                <p>Only same venue + same date + same slot counted</p>
            </div>
            <div class="card metric-card">
                <h4>Most Loaded Venue</h4>
                <div class="metric-strong">${mostLoaded ? mostLoaded.venue : "N/A"}</div>
                <p>${mostLoaded ? `${mostLoaded.avgPerDay} events/day` : "No data"}</p>
            </div>
        `;
    }

    const header = `
        <div class="matrix-row">
            <div class="matrix-cell cell-head">Venue</div>
            <div class="matrix-cell cell-head">Avg Events / Day</div>
            <div class="matrix-cell cell-head">Active Days</div>
            <div class="matrix-cell cell-head">Peak Day / Clashes</div>
        </div>
    `;

    const rows = filtered
        .map((row) => {
            const utilClass = row.utilization >= 60 ? "occ-high" : row.utilization >= 30 ? "occ-mid" : "occ-low";
            return `
                <div class="matrix-row">
                    <div class="matrix-cell cell-head">${row.venue}</div>
                    <div class="matrix-cell ${utilClass}">${row.avgPerDay} (${row.utilization}%)</div>
                    <div class="matrix-cell">${row.activeDays} / ${daysInRange} days</div>
                    <div class="matrix-cell">
                        Peak: <strong>${row.peakDay}</strong> (${row.peakPerDay} events)<br>
                        Clashes: <strong>${row.clashCount}</strong>
                    </div>
                </div>
            `;
        })
        .join("");

    matrix.innerHTML = header + (rows || "<div class='matrix-cell'>No venues match this filter in selected date range.</div>");
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
    const planningGrid = document.getElementById("planningGrid");
    if (!planningGrid) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const plannedEvents = events
        .filter((ev) => ev.status === "Planning")
        .filter((ev) => {
            const parsed = parseEventDate(ev.date);
            return parsed && parsed >= today;
        })
        .sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date));

    if (!plannedEvents.length) {
        planningGrid.innerHTML = `
            <div class="card metric-card">
                <h4>No Planned Events</h4>
                <p class="metric-line">Create events in Event Planning to populate this section with real planning data.</p>
            </div>
        `;
        return;
    }

    const analytics = getAnalyticsEvents();
    const avgAtt = analytics.length
        ? Math.round(analytics.reduce((sum, ev) => sum + ev.attendance, 0) / analytics.length)
        : 200;

    planningGrid.innerHTML = plannedEvents
        .map(
            (ev, idx) => {
                const projectedAttendance = avgAtt + 20 + idx * 15;
                const estimatedBudget = 4200 + idx * 850;
                const confidence = Math.max(60, 88 - idx * 5);
                return `
            <div class="card metric-card">
                <h4>${ev.name}</h4>
                <p class="metric-line">Scheduled: ${ev.date} (${ev.time})</p>
                <p class="metric-line">Venue: ${ev.venue}</p>
                <p class="metric-line">Projected attendance: ${projectedAttendance}</p>
                <p class="metric-line">Estimated budget: $${estimatedBudget.toLocaleString()}</p>
                <div class="metric-line"><span>Planning Confidence</span><strong class="metric-strong">${confidence}%</strong></div>
                <div class="progress"><span style="width:${confidence}%"></span></div>
            </div>
        `;
            }
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
const confirmEventSelect = document.getElementById('confirmEventSelect');
const confirmEventDetails = document.getElementById('confirmEventDetails');

// A. Function to fill the dropdown with "Planning" events
function populateConfirmationDropdown() {
    if (!confirmEventSelect) return;

    // Clear old options (keep the default placeholder)
    confirmEventSelect.innerHTML = '<option value="">-- Choose an event to confirm --</option>';
    
    // Loop through events and add them if they are in "Planning" status
    events.forEach((ev, index) => {
        if (ev.status === "Planning") {
            const option = document.createElement('option');
            // We store the exact array index in the value so we can find it easily later
            option.value = index; 
            option.textContent = ev.name;
            confirmEventSelect.appendChild(option);
        }
    });
}

// B. Show event details when the user selects a dropdown item
if (confirmEventSelect) {
    confirmEventSelect.addEventListener('change', function() {
        const selectedIndex = this.value;
        
        if (selectedIndex !== "") {
            const selectedEvent = events[selectedIndex];
            document.getElementById('detailDate').textContent = selectedEvent.date;
            document.getElementById('detailTime').textContent = selectedEvent.time;
            document.getElementById('detailVenue').textContent = selectedEvent.venue;
            document.getElementById('detailDescription').textContent = selectedEvent.description;
            
            // Unhide the details box
            confirmEventDetails.classList.remove('hidden');
        } else {
            // Hide if they go back to the default placeholder
            confirmEventDetails.classList.add('hidden');
        }
    });
}

// C. Handle the Confirmation Submit
if (confirmForm) {
    confirmForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const selectedIndex = confirmEventSelect.value;
        const msgBox = document.getElementById('confirmMessage');

        if (selectedIndex === "") return; // Safety check

        const eventToConfirm = events[selectedIndex];

        // Final Clash Check against Confirmed events only
        const isClash = events.some(ev => 
            ev.status === "Confirmed" && 
            ev.date === eventToConfirm.date && 
            ev.time === eventToConfirm.time && 
            ev.venue === eventToConfirm.venue
        );

        if (isClash) {
            msgBox.className = "alert error";
            msgBox.innerHTML = "<strong>Clash Detected!</strong> Another event was confirmed for this venue and time.";
            msgBox.classList.remove('hidden');
        } else {
            // Success! Change status
            events[selectedIndex].status = "Confirmed";
            saveData();
            renderEventsTable();
            
            // Refresh the dropdown so the confirmed event disappears from the list
            populateConfirmationDropdown(); 
            confirmEventDetails.classList.add('hidden');
            
            msgBox.className = "alert success";
            msgBox.innerHTML = `<strong>Success!</strong> ${eventToConfirm.name} is now Confirmed.`;
            msgBox.classList.remove('hidden');
        }
        
        setTimeout(() => msgBox.classList.add('hidden'), 4000);
    });
}
