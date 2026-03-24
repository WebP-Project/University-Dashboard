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
