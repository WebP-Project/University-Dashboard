# UniEvent - University Event Management System

UniEvent is a dual-interface event planning platform for universities. It gives admins a dashboard to schedule, confirm, and analyze events, while students get a separate portal to discover confirmed events, register, and track completed participation.

## Key Features

### Admin Dashboard
- Schedule new events with poster upload
- Save event data in `data/events.json`
- Review and confirm planned events
- Prevent venue and time-slot clashes
- View budget, participation, performance, and venue optimization insights
- Open a full event preview page from the event poster

### Student Portal
- Login or sign up as a new student
- View only confirmed events
- Register for events with auto-filled student details
- See registered and completed events with posters
- Get reminder notifications for registered events 1 day before the event

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js, Express
- Storage: Local JSON files (`events.json`, `users.json`, `registrations.json`)

## Prerequisites

- Node.js 18+ recommended
- npm
- A modern browser
- Git (optional, only needed if you are cloning the repo)

## Installation & Setup

1. Clone the repository:

```bash
git clone https://github.com/WebP-Project/University-Dashboard.git
cd University-Dashboard
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

4. Open the app in your browser:

- Login page: `http://localhost:3000/login.html`
- Student portal: `http://localhost:3000/client.html`
- Admin dashboard: `http://localhost:3000/admin/dashboard.html`

## Demo Credentials

### Admin
- Email: `admin@college.edu`
- Password: `admin123`

### Student
- Email: `student@college.edu`
- Password: `securePass1`

You can also create a new student account from the Sign Up tab on the login page.

## Project Structure

```text
University-Dashboard/
├── admin/
│   ├── css/
│   ├── js/
│   ├── dashboard.html
│   └── event-preview.html
├── data/
│   ├── events.json
│   ├── registrations.json
│   └── users.json
├── public/
│   ├── css/
│   ├── js/
│   ├── client.html
│   ├── login.html
│   └── register.html
├── server.js
├── package.json
└── README.md
```

## How Data Is Stored

- `data/events.json`: stores event details, status, venue, time slot, and poster image path/data
- `data/registrations.json`: stores student registrations
- `data/users.json`: stores admin and student login records

## Notes

- Uploaded posters are served from `data/posters/`
- Students only see events whose status is `Confirmed`
- Session-based login is used with `express-session`
- Browser notifications depend on the user granting notification permission

## Available Scripts

```bash
npm start
```

Starts the Express server on port `3000`.

## Future Improvements

- Password hashing for better security
- Database integration instead of local JSON storage
- Email reminders for registered events
- Search, filters, and role-based analytics expansion
