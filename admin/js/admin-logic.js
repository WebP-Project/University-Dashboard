const defaultEvents = [
    {
        name: "Tech Symposium",
        date: "2026-03-12",
        time: "Morning",
        venue: "Grand Auditorium",
        status: "Confirmed",
        description: "A university-wide technology showcase with student innovations and expert sessions.",
        posterImage: ""
    },
    {
        name: "Basketball Finals",
        date: "2026-03-14",
        time: "Afternoon",
        venue: "Sports Complex",
        status: "Confirmed",
        description: "Championship game featuring top college teams and live audience engagement.",
        posterImage: ""
    },
    {
        name: "Literature Fest",
        date: "2026-03-18",
        time: "Evening",
        venue: "Conference Hall A",
        status: "Planning",
        description: "Literary activities including poetry, talks, and student-led book discussions.",
        posterImage: ""
    }
];

const venues = ["Grand Auditorium", "Sports Complex", "Conference Hall A"];
const timeSlots = ["Morning", "Afternoon", "Evening"];

let events = [];
let registrations = [];
let clashCounter = 0;
let selectedPosterImage = "";

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
        description: (ev.description && ev.description.trim()) || `Details for ${ev.name}.`,
        posterImage: typeof ev.posterImage === "string" ? ev.posterImage : ""
    }));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getPosterMarkup(event, altText = "Event poster") {
    const previewUrl = `event-preview.html?event=${encodeURIComponent(getEventId(event))}`;
    if (event.posterImage) {
        return `
            <a class="poster-link" href="${previewUrl}" target="_blank" rel="noopener noreferrer" title="Open full event preview">
                <img src="${event.posterImage}" alt="${escapeHtml(altText)}" class="poster-thumb">
            </a>
        `;
    }
    return `
        <a class="poster-link" href="${previewUrl}" target="_blank" rel="noopener noreferrer" title="Open full event preview">
            <span class="poster-fallback" aria-label="No poster">NA</span>
        </a>
    `;
}

function setPosterPreview(imageSrc = "", fileName = "") {
    const previewCard = document.getElementById("posterPreviewCard");
    const previewImage = document.getElementById("posterPreviewImage");
    const previewName = document.getElementById("posterPreviewName");
    if (!previewCard || !previewImage || !previewName) return;

    if (!imageSrc) {
        previewCard.classList.add("hidden");
        previewImage.removeAttribute("src");
        previewName.textContent = "No file selected";
        return;
    }

    previewImage.src = imageSrc;
    previewName.textContent = fileName || "Poster selected";
    previewCard.classList.remove("hidden");
}

function readPosterFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("Unable to read image file"));
        reader.readAsDataURL(file);
    });
}

function bindPosterUploader() {
    const posterInput = document.getElementById("eventPoster");
    if (!posterInput) return;

    posterInput.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            selectedPosterImage = "";
            setPosterPreview();
            return;
        }

        if (!file.type.startsWith("image/")) {
            alert("Please upload a valid image file for the event poster.");
            posterInput.value = "";
            selectedPosterImage = "";
            setPosterPreview();
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert("Please upload a poster image smaller than 2 MB.");
            posterInput.value = "";
            selectedPosterImage = "";
            setPosterPreview();
            return;
        }

        try {
            selectedPosterImage = await readPosterFile(file);
            setPosterPreview(selectedPosterImage, file.name);
        } catch (error) {
            console.error("Poster preview failed:", error);
            selectedPosterImage = "";
            setPosterPreview();
        }
    });
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
    bindPosterUploader();

    eventForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const name = document.getElementById("eventName").value.trim();
        const date = document.getElementById("eventDate").value;
        const time = document.getElementById("eventTime").value;
        const venue = document.getElementById("eventVenue").value;
        const descriptionInput = document.getElementById("eventDescription");
        const description = descriptionInput?.value.trim() || `Details for ${name}.`;
        const posterImage = selectedPosterImage;
        const clashAlert = document.getElementById("clashAlert");
        const successAlert = document.getElementById("successAlert");

        const isClash = events.some((ev) => ev.status === "Confirmed" &&ev.date === date && ev.time === time && ev.venue === venue);

        if (isClash) {
            clashCounter += 1;
            clashAlert.classList.remove("hidden");
            successAlert.classList.add("hidden");
            setTimeout(() => clashAlert.classList.add("hidden"), 2600);
        } else {
            events.push({ name, date, time, venue, description, posterImage, status: "Planning" });
            await saveData();
            renderEventsTable();
            renderAllInsights();
            populateConfirmationDropdown();
            successAlert.classList.remove("hidden");
            clashAlert.classList.add("hidden");
            eventForm.reset();
            document.getElementById("eventDate").valueAsDate = new Date();
            selectedPosterImage = "";
            setPosterPreview();
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
                <td>${getPosterMarkup(event, `${event.name} poster`)}</td>
                <td><strong class="event-name-text" title="${escapeHtml(event.name)}">${escapeHtml(event.name)}</strong></td>
                <td>
                    <div class="event-table-meta">
                        <span class="event-table-date">${escapeHtml(event.date)}</span>
                        <span class="event-table-sub">${escapeHtml(event.time)}</span>
                    </div>
                </td>
                <td>
                    <span class="event-table-venue">${escapeHtml(event.venue)}</span>
                </td>
                <td>
                    <div class="event-table-actions">
                        <span class="status-badge ${event.status === "Confirmed" ? "status-good" : "status-watch"}">${event.status}</span>
                        <button onclick="deleteEvent(${index})" class="event-delete-btn" aria-label="Delete event">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
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
    renderPlanningInsights();
}

function renderPlanningInsights() {
    const planningInsights = document.getElementById("planningInsights");
    if (!planningInsights) return;

    const upcoming = [...events]
        .filter((ev) => parseEventDate(ev.date))
        .sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date));
    const planned = upcoming.filter((ev) => ev.status === "Planning");
    const postersReady = events.filter((ev) => ev.posterImage).length;
    const readyToPublish = upcoming.filter((ev) => ev.status === "Confirmed" && ev.posterImage).length;

    planningInsights.innerHTML = `
        <div class="card metric-card">
            <h4>Ready To Publish</h4>
            <div class="metric-strong">${readyToPublish}</div>
            <p>${readyToPublish ? "Confirmed events with posters are ready for posters, notices, and student promotion." : "No events are fully ready for publishing yet."}</p>
        </div>
        <div class="card metric-card">
            <h4>Poster Coverage</h4>
            <div class="metric-strong">${postersReady}/${events.length || 0}</div>
            <p>${events.length ? `${Math.round((postersReady / events.length) * 100)}% of events already have creative assets.` : "Upload posters while scheduling to build your media-ready catalog."}</p>
        </div>
        <div class="card metric-card">
            <h4>Planning Backlog</h4>
            <div class="metric-strong">${planned.length}</div>
            <p>${planned.length ? "These events are still waiting for confirmation and publishing." : "No pending events. The queue is fully cleared."}</p>
        </div>
        <div class="card metric-card">
            <h4>Most Used Venue</h4>
            <div class="metric-strong">${getMostUsedVenue()}</div>
            <p>Useful for spotting overbooked spaces and shifting upcoming plans.</p>
        </div>
    `;
}

function getMostUsedVenue() {
    if (!events.length) return "N/A";
    const counts = {};
    events.forEach((ev) => {
        counts[ev.venue] = (counts[ev.venue] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
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
                        <div class="metric-line"><span>Allocated</span><strong>₹${allocated[c].toLocaleString()}</strong></div>
                        <div class="metric-line"><span>Spent</span><strong>₹${spent[c].toLocaleString()}</strong></div>
                        <div class="metric-line"><span>Variance</span><strong>${variance >= 0 ? "+" : "-"}₹${Math.abs(variance).toLocaleString()}</strong></div>
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
                        label: "Allocated (₹)",
                        data: allocatedValues,
                        backgroundColor: "#94a3b8"
                    },
                    {
                        label: "Spent (₹)",
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
                            label: (ctx) => `${ctx.dataset.label}: ₹${ctx.raw.toLocaleString()}`
                        }
                    }
                }
            }
        });
    }
}

function parseEventDate(dateText) {
    const [year, month, day] = (dateText || "").split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function renderEventOperations() {
    const overview = document.getElementById("operationsOverview");
    const priorityBoard = document.getElementById("launchPriorityBoard");
    const pressureList = document.getElementById("venuePressureList");
    const creativeTracker = document.getElementById("creativeTracker");
    if (!overview || !priorityBoard || !pressureList || !creativeTracker) return;

    const venueCapacities = {
        "Grand Auditorium": 800,
        "Sports Complex": 1200,
        "Conference Hall A": 240
    };

    const venueZones = {
        "Grand Auditorium": "Central Academic Block",
        "Sports Complex": "South Campus Sports Zone",
        "Conference Hall A": "Conference Wing"
    };

    const analytics = getAnalyticsEvents();
    const analyticsMap = Object.fromEntries(analytics.map((event) => [getEventId(event), event]));

    const upcoming = [...events]
        .filter((ev) => {
            const parsed = parseEventDate(ev.date);
            if (!parsed) return false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return parsed >= today;
        })
        .sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date))
        .map((event) => {
            const enriched = analyticsMap[getEventId(event)] || {};
            const projectedAttendance = enriched.attendance || 0;
            const capacity = venueCapacities[event.venue] || 300;
            const utilization = capacity ? Math.min(100, Math.round((projectedAttendance / capacity) * 100)) : 0;
            return {
                ...event,
                projectedAttendance,
                capacity,
                utilization,
                zone: venueZones[event.venue] || "Main Campus"
            };
        });

    const recentFallback = [...events]
        .filter((ev) => parseEventDate(ev.date))
        .sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date))
        .slice(0, 6)
        .map((event) => {
            const enriched = analyticsMap[getEventId(event)] || {};
            const projectedAttendance = enriched.attendance || 0;
            const capacity = venueCapacities[event.venue] || 300;
            const utilization = capacity ? Math.min(100, Math.round((projectedAttendance / capacity) * 100)) : 0;
            return {
                ...event,
                projectedAttendance,
                capacity,
                utilization,
                zone: venueZones[event.venue] || "Main Campus"
            };
        });

    const venueEvents = upcoming.length ? upcoming : recentFallback;
    const dataWindowLabel = upcoming.length ? "upcoming" : "recent";

    const underUtilized = venueEvents.filter((ev) => ev.utilization <= 35);
    const optimalFit = venueEvents.filter((ev) => ev.utilization > 35 && ev.utilization <= 85);
    const crowded = venueEvents.filter((ev) => ev.utilization > 85);
    const roomFitEvents = [...venueEvents].sort((a, b) => {
        if (a.utilization !== b.utilization) {
            return a.utilization - b.utilization;
        }
        return parseEventDate(a.date) - parseEventDate(b.date);
    });

    const crowdDensityEvents = [...venueEvents].sort((a, b) => {
        if (b.projectedAttendance !== a.projectedAttendance) {
            return b.projectedAttendance - a.projectedAttendance;
        }
        return parseEventDate(a.date) - parseEventDate(b.date);
    });

    const matchedPanelCount = Math.min(2, Math.max(roomFitEvents.length, crowdDensityEvents.length));
    const visibleRoomFitEvents = roomFitEvents.slice(0, matchedPanelCount);
    const visibleCrowdDensityEvents = crowdDensityEvents.slice(0, matchedPanelCount);

    overview.innerHTML = `
        <div class="card metric-card">
            <h4>Under-Utilized Rooms</h4>
            <div class="metric-strong">${underUtilized.length}</div>
            <p>Based on ${dataWindowLabel} events that may fit better in smaller halls.</p>
        </div>
        <div class="card metric-card">
            <h4>High Crowd Risk</h4>
            <div class="metric-strong">${crowded.length}</div>
            <p>${upcoming.length ? "Upcoming" : "Recent"} events likely to create crowding near their current venue.</p>
        </div>
        <div class="card metric-card">
            <h4>Best-Fit Bookings</h4>
            <div class="metric-strong">${optimalFit.length}</div>
            <p>Events currently placed in venues with healthy utilization levels.</p>
        </div>
        <div class="card metric-card">
            <h4>Projected Footfall</h4>
            <div class="metric-strong">${venueEvents.reduce((sum, ev) => sum + ev.projectedAttendance, 0).toLocaleString()}</div>
            <p>Total expected attendance across all ${dataWindowLabel} events on the admin board.</p>
        </div>
    `;

    if (!venueEvents.length) {
        priorityBoard.innerHTML = `
            <div class="priority-card">
                <div class="poster-fallback">OK</div>
                <div class="priority-meta">
                    <strong>No venue recommendations yet</strong>
                    <p>Create events to generate room-fit suggestions here.</p>
                </div>
            </div>
        `;
    } else {
        priorityBoard.innerHTML = visibleRoomFitEvents.map((event) => {
            const recommendation = event.utilization <= 20
                ? "Move to a smaller hall"
                : event.utilization <= 35
                    ? "Consider downsizing venue"
                    : event.utilization > 85
                        ? "Prepare overflow control"
                        : "Venue fit looks healthy";
            const reasoning = event.utilization <= 20
                ? "Large room for current turnout. A smaller hall would feel fuller."
                : event.utilization <= 35
                    ? "Slightly oversized venue. Downsizing would improve room efficiency."
                    : event.utilization > 85
                        ? "High load. Plan entry flow and overflow handling early."
                        : "Room size is well matched to projected turnout.";

            return `
                <div class="priority-card">
                    ${event.posterImage ? `<img class="priority-poster" src="${event.posterImage}" alt="${escapeHtml(event.name)} poster">` : `<div class="poster-fallback">NO</div>`}
                    <div class="priority-meta">
                        <span class="priority-tag">${recommendation}</span>
                        <strong>${escapeHtml(event.name)}</strong>
                        <p><strong>Date:</strong> ${escapeHtml(event.date)} · <strong>Time:</strong> ${escapeHtml(event.time)}</p>
                        <p><strong>Venue:</strong> ${escapeHtml(event.venue)}</p>
                        <p><strong>Zone:</strong> ${escapeHtml(event.zone)}</p>
                        <p><strong>Attendance:</strong> ${event.projectedAttendance} · <strong>Capacity:</strong> ${event.capacity} · <strong>Load:</strong> ${event.utilization}%</p>
                        <p class="priority-note">${reasoning}</p>
                    </div>
                </div>
            `;
        }).join("");
    }

    pressureList.innerHTML = visibleCrowdDensityEvents.length
        ? visibleCrowdDensityEvents.map((item) => `
        <div class="pressure-item">
            <div class="pressure-meta">
                <strong>${escapeHtml(item.name)}</strong>
                <p><strong>Date:</strong> ${escapeHtml(item.date)} · <strong>Time:</strong> ${escapeHtml(item.time)}</p>
                <p><strong>Venue:</strong> ${escapeHtml(item.venue)}</p>
                <p><strong>Zone:</strong> ${escapeHtml(item.zone)}</p>
                <p><strong>Expected Crowd:</strong> ${item.projectedAttendance} · <strong>Load:</strong> ${item.utilization}%</p>
                <p>${item.utilization > 85 ? "Heavy crowd concentration likely near this venue." : item.utilization > 60 ? "Moderate crowd build-up expected in this zone." : "Crowd movement should remain manageable here."}</p>
            </div>
            <span class="pressure-tag ${item.utilization > 85 ? "high" : item.utilization > 60 ? "mid" : "low"}">${item.utilization > 85 ? "Crowded" : item.utilization > 60 ? "Busy" : "Stable"}</span>
        </div>
    `).join("")
        : `
        <div class="pressure-item">
            <div class="pressure-meta">
                <strong>No crowd density data yet</strong>
                <p>Schedule events and this panel will estimate the busiest campus zones.</p>
            </div>
            <span class="pressure-tag low">Stable</span>
        </div>
    `;

    creativeTracker.innerHTML = venueEvents.length
        ? venueEvents.map((event) => `
            <div class="creative-card">
                ${event.posterImage ? `<img class="creative-poster" src="${event.posterImage}" alt="${escapeHtml(event.name)} poster">` : `<div class="creative-poster poster-fallback">NO POSTER</div>`}
                <div class="creative-meta">
                    <strong>${escapeHtml(event.name)}</strong>
                    <p>${escapeHtml(event.date)} · ${escapeHtml(event.venue)} · Capacity ${event.capacity}</p>
                    <span class="creative-tag ${event.utilization > 85 ? "missing" : "ready"}">${event.utilization}% utilized</span>
                </div>
            </div>
        `).join("")
        : `
            <div class="creative-card">
                <div class="creative-meta">
                    <strong>No venue data</strong>
                    <p>Create or confirm events to populate the optimization view.</p>
                </div>
            </div>
        `;
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
    const planningSupportGrid = document.getElementById("planningSupportGrid");
    if (!planningGrid || !planningSupportGrid) return;

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
        planningSupportGrid.innerHTML = `
            <div class="card planning-support-card">
                <span class="planning-pill">Starter Tip</span>
                <h4>Build a Future Pipeline</h4>
                <p>Add a few planning-stage events first so this page can generate venue, turnout, and budget suggestions.</p>
            </div>
            <div class="card planning-support-card">
                <span class="planning-pill">Creative</span>
                <h4>Attach Posters Early</h4>
                <p>Poster uploads make the planning view more useful because your future event cards can double as promo-ready previews.</p>
            </div>
            <div class="card planning-support-card">
                <span class="planning-pill">Ops</span>
                <h4>Balance Venues</h4>
                <p>Spread early planning across venues to avoid repeatedly overloading the same halls and blocks.</p>
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
                <p class="metric-line">Estimated budget: ₹${estimatedBudget.toLocaleString()}</p>
                <div class="metric-line"><span>Planning Confidence</span><strong class="metric-strong">${confidence}%</strong></div>
                <div class="progress"><span style="width:${confidence}%"></span></div>
            </div>
        `;
            }
        )
        .join("");

    const venueCounts = {};
    plannedEvents.forEach((ev) => {
        venueCounts[ev.venue] = (venueCounts[ev.venue] || 0) + 1;
    });

    const topVenue = Object.entries(venueCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
    const nextTimeSlot = plannedEvents[0]?.time || "Morning";
    const averageBudget = Math.round(
        plannedEvents.reduce((sum, _, idx) => sum + (4200 + idx * 850), 0) / Math.max(1, plannedEvents.length)
    );

    planningSupportGrid.innerHTML = `
        <div class="card planning-support-card">
            <span class="planning-pill">Recommendation</span>
            <h4>Best Venue Focus</h4>
            <p>${escapeHtml(topVenue)} currently has the strongest upcoming planning momentum. Use it for flagship events and shift smaller ones elsewhere.</p>
        </div>
        <div class="card planning-support-card">
            <span class="planning-pill">Timing</span>
            <h4>Suggested Slot Pattern</h4>
            <p>${escapeHtml(nextTimeSlot)} is the leading slot in your current future plan. Keeping a consistent slot can simplify student communication and logistics.</p>
        </div>
        <div class="card planning-support-card">
            <span class="planning-pill">Checklist</span>
            <h4>Next Planning Actions</h4>
            <ul>
                <li>Confirm venue availability for the next two planned events.</li>
                <li>Lock poster creatives before event confirmation.</li>
                <li>Keep estimated budgets close to ₹${averageBudget.toLocaleString()} for better variance control.</li>
            </ul>
        </div>
    `;
}

function renderAllInsights() {
    updateSchedulingKpis();
    renderBudget();
    renderEventOperations();
    renderParticipation();
    renderPerformance();
    renderPlanning();
    renderConfirmationQueue();
    renderPublishingChecklist();
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
    renderConfirmationQueue();
    renderPublishingChecklist();
}

// B. Show event details when the user selects a dropdown item
if (confirmEventSelect) {
    confirmEventSelect.addEventListener('change', function() {
        const selectedIndex = this.value;
        const posterWrap = document.getElementById("confirmPosterWrap");
        const posterImg = document.getElementById("detailPoster");
        
        if (selectedIndex !== "") {
            const selectedEvent = events[selectedIndex];
            document.getElementById('detailDate').textContent = selectedEvent.date;
            document.getElementById('detailTime').textContent = selectedEvent.time;
            document.getElementById('detailVenue').textContent = selectedEvent.venue;
            document.getElementById('detailDescription').textContent = selectedEvent.description;
            if (posterWrap && posterImg) {
                if (selectedEvent.posterImage) {
                    posterImg.src = selectedEvent.posterImage;
                    posterWrap.classList.remove("hidden");
                } else {
                    posterImg.removeAttribute("src");
                    posterWrap.classList.add("hidden");
                }
            }
            
            // Unhide the details box
            confirmEventDetails.classList.remove('hidden');
        } else {
            // Hide if they go back to the default placeholder
            confirmEventDetails.classList.add('hidden');
            if (posterWrap && posterImg) {
                posterImg.removeAttribute("src");
                posterWrap.classList.add("hidden");
            }
        }
    });
}

// C. Handle the Confirmation Submit
if (confirmForm) {
    confirmForm.addEventListener('submit', async function(e) {
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
            await saveData();
            renderEventsTable();
            renderAllInsights();
            
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

function renderConfirmationQueue() {
    const queue = document.getElementById("confirmationQueue");
    if (!queue) return;

    const pending = events
        .filter((ev) => ev.status === "Planning")
        .sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date))
        .slice(0, 5);

    if (!pending.length) {
        queue.innerHTML = `
            <div class="queue-item">
                <div>
                    <strong>Queue empty</strong>
                    <p>All planned events are already confirmed.</p>
                </div>
                <span class="checklist-mark">0</span>
            </div>
        `;
        return;
    }

    queue.innerHTML = pending
        .map((event, idx) => `
            <div class="queue-item">
                <div>
                    <strong>${escapeHtml(event.name)}</strong>
                    <p>${escapeHtml(event.date)} · ${escapeHtml(event.time)} · ${escapeHtml(event.venue)}</p>
                </div>
                <span class="checklist-mark">${idx + 1}</span>
            </div>
        `)
        .join("");
}

function renderPublishingChecklist() {
    const checklist = document.getElementById("publishingChecklist");
    if (!checklist) return;

    const totalPlanning = events.filter((ev) => ev.status === "Planning").length;
    const withPoster = events.filter((ev) => ev.status === "Planning" && ev.posterImage).length;
    const withDescription = events.filter((ev) => ev.status === "Planning" && ev.description).length;
    const confirmed = events.filter((ev) => ev.status === "Confirmed").length;

    const items = [
        {
            title: "Posters attached",
            detail: `${withPoster} of ${totalPlanning} planning events already have a poster uploaded.`
        },
        {
            title: "Descriptions filled",
            detail: `${withDescription} planning events include a summary for listings and promo copy.`
        },
        {
            title: "Events confirmed",
            detail: `${confirmed} events are fully confirmed and safe to publish to students.`
        }
    ];

    checklist.innerHTML = items
        .map((item, index) => `
            <div class="checklist-item">
                <div>
                    <strong>${item.title}</strong>
                    <p>${item.detail}</p>
                </div>
                <span class="checklist-mark">${index + 1}</span>
            </div>
        `)
        .join("");
}
