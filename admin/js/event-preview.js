function getEventId(event) {
    return `${event.name}|${event.date}|${event.time || "TBA"}|${event.venue}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function parseEventDate(dateText) {
    const [year, month, day] = String(dateText || "").split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

function getEventCategory(event) {
    const text = `${event.name || ""} ${event.description || ""}`.toLowerCase();
    if (/(hackathon|symposium|tech|ai|research)/.test(text)) return "Academic / Innovation";
    if (/(debate|literature|fest|poetry|showcase)/.test(text)) return "Culture / Academic";
    if (/(football|basketball|sports|gaming|valorant)/.test(text)) return "Competition / Sports";
    return "Campus Event";
}

function getVenueProfile(venue) {
    const profiles = {
        "Grand Auditorium": {
            capacity: 800,
            strengths: "Best for flagship events, formal talks, and broad attendance.",
            zone: "Central Academic Block"
        },
        "Sports Complex": {
            capacity: 1200,
            strengths: "Works well for tournaments, finals, and high-footfall gatherings.",
            zone: "South Campus Sports Zone"
        },
        "Conference Hall A": {
            capacity: 240,
            strengths: "Better for focused sessions, workshops, and smaller curated audiences.",
            zone: "Conference Wing"
        }
    };
    return profiles[venue] || {
        capacity: 300,
        strengths: "General-purpose venue for mid-sized campus events.",
        zone: "Main Campus"
    };
}

function getTimeProfile(time) {
    const profiles = {
        Morning: "Best for academic focus, faculty participation, and structured sessions.",
        Afternoon: "Stronger for active sessions, showcases, and sports-heavy turnout.",
        Evening: "Good for community events, performances, and social attendance peaks."
    };
    return profiles[time] || "Flexible slot with mixed audience availability.";
}

function estimateAttendance(event, capacity) {
    const seedText = `${event.name}|${event.venue}|${event.time}`;
    const seed = seedText.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const baseline = 110 + (seed % 260);
    return Math.min(capacity, baseline);
}

function fillPreviewList(id, items) {
    const target = document.getElementById(id);
    if (!target) return;
    target.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderHighlightBadges(event, attendance, capacity, venueProfile) {
    const target = document.getElementById("previewHighlights");
    if (!target) return;
    const utilization = Math.min(100, Math.round((attendance / Math.max(1, capacity)) * 100));
    const highlights = [
        getEventCategory(event),
        `${attendance} expected attendees`,
        `${utilization}% venue load`,
        venueProfile.zone
    ];
    target.innerHTML = highlights
        .map((item) => `<span class="preview-pill">${escapeHtml(item)}</span>`)
        .join("");
}

async function loadEventPreview() {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.body.setAttribute("data-theme", savedTheme);

    const params = new URLSearchParams(window.location.search);
    const eventId = params.get("event");
    if (!eventId) {
        renderMissingEvent("Event preview link is missing the event id.");
        return;
    }

    try {
        const response = await fetch("/api/events");
        const events = await response.json();
        const event = Array.isArray(events) ? events.find((item) => getEventId(item) === eventId) : null;

        if (!event) {
            renderMissingEvent("This event could not be found. It may have been removed.");
            return;
        }

        renderEvent(event);
    } catch (error) {
        console.error("Failed to load event preview:", error);
        renderMissingEvent("Unable to load event details right now.");
    }
}

function renderMissingEvent(message) {
    const card = document.getElementById("eventPreviewCard");
    if (!card) return;
    card.innerHTML = `
        <div class="preview-empty">
            <h1>Event Not Available</h1>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function renderEvent(event) {
    const poster = document.getElementById("previewPoster");
    const posterFallback = document.getElementById("previewPosterFallback");
    const statusBadge = document.getElementById("previewStatus");

    document.getElementById("previewName").textContent = event.name || "Untitled Event";
    document.title = `${event.name || "Event"} Preview`;
    document.getElementById("previewDescription").textContent = event.description || "No description provided.";
    document.getElementById("previewDate").textContent = event.date || "-";
    document.getElementById("previewTime").textContent = event.time || "TBA";
    document.getElementById("previewVenue").textContent = event.venue || "-";
    document.getElementById("previewStatusText").textContent = event.status || "-";

    const venueProfile = getVenueProfile(event.venue);
    const attendance = estimateAttendance(event, venueProfile.capacity);
    const utilization = Math.min(100, Math.round((attendance / Math.max(1, venueProfile.capacity)) * 100));
    const eventDate = parseEventDate(event.date);
    const daysAway = eventDate ? Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24)) : null;

    renderHighlightBadges(event, attendance, venueProfile.capacity, venueProfile);

    const posterMeta = document.getElementById("previewPosterMeta");
    if (posterMeta) {
        posterMeta.innerHTML = `
            <div class="preview-poster-stat">
                <span>Category</span>
                <strong>${escapeHtml(getEventCategory(event))}</strong>
            </div>
            <div class="preview-poster-stat">
                <span>Venue Capacity</span>
                <strong>${venueProfile.capacity}</strong>
            </div>
            <div class="preview-poster-stat">
                <span>Projected Load</span>
                <strong>${utilization}%</strong>
            </div>
        `;
    }

    fillPreviewList("previewSnapshot", [
        `${event.name} is positioned as a ${getEventCategory(event).toLowerCase()} event.`,
        `Projected turnout is around ${attendance} attendees based on current event profile.`,
        daysAway === null ? "Date is not available for a timeline estimate." : daysAway >= 0 ? `${daysAway} day(s) remain until the event date.` : "This event date has already passed.",
        event.status === "Confirmed" ? "The event is already confirmed and publication-ready." : "The event is still in planning and may need final confirmation."
    ]);

    fillPreviewList("previewVenueContext", [
        `${event.venue} sits in the ${venueProfile.zone}.`,
        venueProfile.strengths,
        `Current venue utilization estimate is ${utilization}% of available capacity.`,
        utilization < 35 ? "This room may feel oversized unless turnout increases." : utilization > 85 ? "Expect tighter circulation and heavier on-ground coordination." : "Venue sizing looks broadly balanced for the current plan."
    ]);

    fillPreviewList("previewAudienceFit", [
        getTimeProfile(event.time),
        utilization < 35 ? "This event may benefit from a more intimate audience setting." : "The projected attendance should create healthy room energy.",
        /(sports|football|basketball|gaming|valorant)/i.test(event.name) ? "Audience expectation leans toward active, high-energy participation." : "Audience expectation leans toward seated engagement and focused participation.",
        event.posterImage ? "Poster creative is available, which supports stronger student-side discoverability." : "Poster creative is still missing, so visual promotion may feel incomplete."
    ]);

    fillPreviewList("previewPlanningNotes", [
        `Primary slot: ${event.time || "TBA"} on ${event.date || "TBA"}.`,
        `Recommended admin focus: ${utilization < 35 ? "review venue sizing" : utilization > 85 ? "prepare crowd flow" : "finalize communications"}.`,
        `Suggested messaging angle: ${getEventCategory(event)} with emphasis on ${event.venue}.`,
    ]);

    if (statusBadge) {
        statusBadge.textContent = event.status || "Planning";
        statusBadge.className = `status-badge ${event.status === "Confirmed" ? "status-good" : "status-watch"}`;
    }

    if (event.posterImage) {
        poster.src = event.posterImage;
        poster.classList.remove("hidden");
        posterFallback.classList.add("hidden");
    } else {
        poster.classList.add("hidden");
        posterFallback.classList.remove("hidden");
    }
}

window.addEventListener("DOMContentLoaded", loadEventPreview);
