const loginForm = document.getElementById('loginForm');
const eventGrid = document.getElementById('eventGrid');
const logoutLink = document.querySelector('.logout-link');
const eventsHeading = document.getElementById('eventsHeading');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const registrationPage = document.getElementById('registrationPage');
const registrationForm = document.getElementById('registrationForm');
const registrationEventBox = document.getElementById('registrationEventBox');
const registrationMessage = document.getElementById('registrationMessage');
const registrationSuccess = document.getElementById('registrationSuccess');
const profileToggleBtn = document.getElementById('profileToggleBtn');
const profilePanel = document.getElementById('profilePanel');

let allClientEvents = [];
let currentEventFilter = 'all';
let currentUser = null;
let selectedRegistrationEvent = null;

window.addEventListener('DOMContentLoaded', async () => {
    initClientTheme();

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleClientTheme);
    }

    bindProfilePanel();

    if (loginForm) {
        bindLogin();
    }

    if (logoutLink) {
        bindLogout();
    }

    if (eventGrid) {
        bindEventFilters();
        currentUser = await loadCurrentUser();
        if (!currentUser) return;
        await fetchEvents();
    }

    if (registrationPage) {
        currentUser = await loadCurrentUser();
        if (!currentUser) return;
        await initRegistrationPage();
    }
});

function bindLogin() {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role })
            });

            const data = await response.json();

            if (response.ok) {
                window.location.href = data.redirectUrl;
            } else {
                const msgElement = document.getElementById('message');
                if (msgElement) msgElement.innerText = data.error;
            }
        } catch (err) {
            console.error('Login failed', err);
            const msgElement = document.getElementById('message');
            if (msgElement) msgElement.innerText = 'Server error. Please try again.';
        }
    });
}

function bindLogout() {
    logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (err) {
            console.error('Logout failed', err);
        }
        window.location.href = '/login.html';
    });
}

async function loadCurrentUser() {
    try {
        const res = await fetch('/api/me');
        if (!res.ok) {
            window.location.href = '/login.html';
            return null;
        }

        const user = await res.json();
        const welcome = document.getElementById('welcomeUser');
        if (welcome) welcome.textContent = `Welcome, ${user.username}`;
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profileRole = document.getElementById('profileRole');
        if (profileName) profileName.textContent = user.username || '-';
        if (profileEmail) profileEmail.textContent = user.email || '-';
        if (profileRole) profileRole.textContent = user.role || '-';
        return user;
    } catch (err) {
        console.error('Error loading user session', err);
        window.location.href = '/login.html';
        return null;
    }
}

async function fetchEvents() {
    try {
        const response = await fetch('/api/events');
        allClientEvents = await response.json();
        renderFilteredEvents();
    } catch (err) {
        console.error('Error loading events:', err);
        if (eventGrid) eventGrid.innerHTML = '<p class="error-msg">Unable to load events at this time.</p>';
    }
}

function bindEventFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (!filterButtons.length) return;

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            currentEventFilter = button.dataset.filter || 'all';
            filterButtons.forEach((btn) => btn.classList.remove('active-filter'));
            button.classList.add('active-filter');
            renderFilteredEvents();
        });
    });
}

function parseLocalDate(dateText) {
    const parts = (dateText || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date('invalid');
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
}

function getEventState(eventDateText) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventDate = parseLocalDate(eventDateText);
    if (Number.isNaN(eventDate.getTime())) return 'upcoming';

    if (eventDate < today) return 'completed';
    if (eventDate > today) return 'upcoming';
    return 'ongoing';
}

function getEventId(event) {
    return `${event.name}|${event.date}|${event.time || 'TBA'}|${event.venue}`;
}

function renderFilteredEvents() {
    if (!eventGrid) return;

    const filteredEvents = allClientEvents.filter((event) => {
        if (currentEventFilter === 'all') return true;
        return getEventState(event.date) === currentEventFilter;
    });

    eventGrid.innerHTML = '';

    if (eventsHeading) {
        const headingMap = {
            all: 'All',
            upcoming: 'Upcoming',
            ongoing: 'Ongoing',
            completed: 'Completed'
        };
        const title = headingMap[currentEventFilter] || 'All';
        eventsHeading.textContent = `${title} Events`;
    }

    if (!filteredEvents.length) {
        const emptyLabel = currentEventFilter === 'all' ? 'events' : `${currentEventFilter} events`;
        eventGrid.innerHTML = `<p>No ${emptyLabel} found.</p>`;
        return;
    }

    filteredEvents.forEach((event) => {
        const eventState = getEventState(event.date);
        const canRegister = eventState === 'upcoming';
        const eventId = getEventId(event);

        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="event-content">
                <span class="event-status status-${eventState}">${eventState.toUpperCase()}</span>
                <h3>${event.name}</h3>
                <div class="event-details">
                    <p><strong>Date:</strong> ${event.date}</p>
                    <p><strong>Time:</strong> ${event.time || 'TBA'}</p>
                    <p><strong>Venue:</strong> ${event.venue}</p>
                </div>
                <p class="event-desc">${event.description || 'No description provided.'}</p>
                <button class="register-btn ${canRegister ? '' : 'register-btn-disabled'}" ${canRegister ? '' : 'disabled'}>
                    ${canRegister ? 'Register Now' : 'Registration Closed'}
                </button>
            </div>
        `;

        const registerBtn = card.querySelector('.register-btn');
        if (canRegister && registerBtn) {
            registerBtn.addEventListener('click', () => registerForEventById(eventId));
        }

        eventGrid.appendChild(card);
    });
}

function registerForEventById(eventId) {
    const event = allClientEvents.find((item) => getEventId(item) === eventId);
    if (!event) {
        alert('Event not found.');
        return;
    }

    if (getEventState(event.date) !== 'upcoming') {
        alert('You can only register for upcoming events.');
        return;
    }

    sessionStorage.setItem('selectedEventId', eventId);
    window.location.href = `/register.html?event=${encodeURIComponent(eventId)}`;
}

async function initRegistrationPage() {
    const params = new URLSearchParams(window.location.search);
    const paramEventId = params.get('event');
    const selectedId = paramEventId ? decodeURIComponent(paramEventId) : sessionStorage.getItem('selectedEventId');

    try {
        const response = await fetch('/api/events');
        const events = await response.json();
        selectedRegistrationEvent = events.find((item) => getEventId(item) === selectedId) || null;
    } catch (err) {
        console.error('Failed to load events for registration page', err);
    }

    if (!selectedRegistrationEvent) {
        setRegistrationMessage('Event not found. Please go back and select an event again.', 'error');
        if (registrationForm) registrationForm.classList.add('hidden');
        return;
    }

    renderRegistrationEventDetails();
    prefillRegistrationUser();

    if (getEventState(selectedRegistrationEvent.date) !== 'upcoming') {
        setRegistrationMessage('This event is not upcoming, so registration is closed.', 'error');
        if (registrationForm) {
            const submitBtn = registrationForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add('register-btn-disabled');
                submitBtn.textContent = 'Registration Closed';
            }
        }
        return;
    }

    if (registrationForm) {
        registrationForm.addEventListener('submit', handleRegistrationSubmit);
    }
}

function renderRegistrationEventDetails() {
    if (!registrationEventBox || !selectedRegistrationEvent) return;

    const eventState = getEventState(selectedRegistrationEvent.date);
    registrationEventBox.innerHTML = `
        <span class="event-status status-${eventState}">${eventState.toUpperCase()}</span>
        <h3>${selectedRegistrationEvent.name}</h3>
        <p><strong>Date:</strong> ${selectedRegistrationEvent.date}</p>
        <p><strong>Time:</strong> ${selectedRegistrationEvent.time || 'TBA'}</p>
        <p><strong>Venue:</strong> ${selectedRegistrationEvent.venue}</p>
        <p>${selectedRegistrationEvent.description || 'No description provided.'}</p>
    `;
}

function prefillRegistrationUser() {
    if (!currentUser) return;

    const nameInput = document.getElementById('regName');
    const emailInput = document.getElementById('regEmail');

    if (nameInput) nameInput.value = currentUser.username || '';
    if (emailInput) emailInput.value = currentUser.email || '';
}

function bindProfilePanel() {
    if (!profileToggleBtn || !profilePanel) return;

    profileToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profilePanel.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (profilePanel.classList.contains('hidden')) return;
        if (!profilePanel.contains(e.target) && !profileToggleBtn.contains(e.target)) {
            profilePanel.classList.add('hidden');
        }
    });
}

function setRegistrationMessage(text, type) {
    if (!registrationMessage) return;
    registrationMessage.className = type === 'error' ? 'error-msg' : 'success-msg';
    registrationMessage.textContent = text;
}

function handleRegistrationSubmit(e) {
    e.preventDefault();
    if (!selectedRegistrationEvent) return;

    if (getEventState(selectedRegistrationEvent.date) !== 'upcoming') {
        setRegistrationMessage('Registration allowed only for upcoming events.', 'error');
        return;
    }

    const regName = document.getElementById('regName')?.value.trim() || '';
    const regEmail = (document.getElementById('regEmail')?.value.trim() || '').toLowerCase();
    const regStudentId = document.getElementById('regStudentId')?.value.trim() || '';
    const regDepartment = document.getElementById('regDepartment')?.value.trim() || '';

    const eventId = getEventId(selectedRegistrationEvent);
    const registration = {
        eventId,
        eventName: selectedRegistrationEvent.name,
        date: selectedRegistrationEvent.date,
        time: selectedRegistrationEvent.time || 'TBA',
        venue: selectedRegistrationEvent.venue,
        userName: regName,
        userEmail: regEmail,
        studentId: regStudentId,
        department: regDepartment,
        registeredAt: new Date().toISOString()
    };

    submitRegistration(registration);
}

async function submitRegistration(registration) {
    try {
        const response = await fetch('/api/registrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registration)
        });

        const raw = await response.text();
        let data = {};
        try {
            data = raw ? JSON.parse(raw) : {};
        } catch (parseErr) {
            data = {};
        }

        if (!response.ok) {
            const fallbackMessage =
                response.status === 404
                    ? 'Registration API not found. Restart the server to load latest routes.'
                    : `Registration failed (HTTP ${response.status}).`;
            setRegistrationMessage(data.error || fallbackMessage, 'error');
            return;
        }

        setRegistrationMessage('Registration confirmed successfully.', 'success');

        if (registrationSuccess) {
            registrationSuccess.classList.remove('hidden');
            registrationSuccess.innerHTML = `
                <h3>Registration Confirmed</h3>
                <p><strong>Name:</strong> ${registration.userName}</p>
                <p><strong>Email:</strong> ${registration.userEmail}</p>
                <p><strong>Student ID:</strong> ${registration.studentId}</p>
                <p><strong>Department:</strong> ${registration.department}</p>
                <hr>
                <p><strong>Event:</strong> ${registration.eventName}</p>
                <p><strong>Date:</strong> ${registration.date}</p>
                <p><strong>Time:</strong> ${registration.time}</p>
                <p><strong>Venue:</strong> ${registration.venue}</p>
            `;
        }
    } catch (err) {
        console.error('Registration submit failed', err);
        setRegistrationMessage('Registration failed. Please try again.', 'error');
    }
}

function initClientTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
}

function toggleClientTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
}
