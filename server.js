const envLoadState = require('./load-env');
const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  if (envLoadState.mode === 'local') {
    const envMessage = envLoadState.loaded
      ? `Loaded local environment variables from ${envLoadState.path}`
      : `No .env file found at ${envLoadState.path}; using terminal environment variables`;
    console.log(envMessage);
  }
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI is not set. Add it to your environment before running the app.');
  }
  if (!process.env.AUTH_SECRET && !process.env.SESSION_SECRET) {
    console.warn('AUTH_SECRET is not set. Add it to your environment before production deployment.');
  }
  console.log(`Server running on port ${PORT}`);
  console.log('Login Page: /login.html');
});
