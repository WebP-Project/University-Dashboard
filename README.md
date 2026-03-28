# UniEvent - University Event Management System

UniEvent is a dual-interface event planning platform for universities. It gives admins a dashboard to schedule, confirm, and analyze events, while students get a separate portal to discover confirmed events, register, and track completed participation.

## Key Features

### Admin Dashboard
- Schedule new events with poster upload
- Save event data in MongoDB
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
- Database: MongoDB
- Hosting Target: Vercel-compatible Express API

## Prerequisites

- Node.js 18+ recommended
- npm
- MongoDB Atlas connection string
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

3. Create your environment file:

```bash
cp .env.example .env
```

Set:

- `MONGODB_URI`
- `MONGODB_DB`
- `AUTH_SECRET`

4. Start the server:

```bash
npm start
```

`.env` is loaded automatically for local runs. Hosted environments such as Vercel should use their own configured project environment variables instead.

5. Open the app in your browser:

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
├── api/
│   └── index.js
├── admin/
│   ├── css/
│   ├── js/
│   ├── dashboard.html
│   └── event-preview.html
├── data/
│   ├── events.json
│   ├── posters/
│   ├── registrations.json
│   └── users.json
├── lib/
│   └── db.js
├── public/
│   ├── css/
│   ├── js/
│   ├── client.html
│   ├── login.html
│   └── register.html
├── app.js
├── server.js
├── vercel.json
├── package.json
└── README.md
```

## How Data Is Stored

- MongoDB stores users, events, and registrations
- Existing `data/*.json` files are used only as initial seed data when the database is empty
- Poster files inside `data/posters/` are still served as static assets

## Notes

- Uploaded posters are served from `data/posters/`
- Students only see events whose status is `Confirmed`
- Authentication uses a signed HTTP-only cookie
- Browser notifications depend on the user granting notification permission

## Vercel Deployment

1. Push this repo to GitHub.
2. Create a MongoDB Atlas database.
3. In Vercel, import the repo.
4. Add these environment variables in the Vercel project settings:
   - `MONGODB_URI`
   - `MONGODB_DB`
   - `AUTH_SECRET`
   - `NODE_ENV=production`
5. Deploy.

The app is configured so all routes are served through `api/index.js` on Vercel.

## Available Scripts

```bash
npm start
```

Starts the Express server on port `3000`.

## Future Improvements

- Email reminders for registered events
- Search, filters, and role-based analytics expansion
