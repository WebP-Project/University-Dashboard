const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'unievent';

let cachedClient = null;
let cachedDb = null;
let initPromise = null;

function requireMongoConfig() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it to your environment before running the app.');
  }
}

async function connectToDatabase() {
  requireMongoConfig();

  if (cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!initPromise) {
    initPromise = (async () => {
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db(MONGODB_DB);

      cachedClient = client;
      cachedDb = db;

      await Promise.all([
        db.collection('users').createIndex({ email: 1 }, { unique: true }),
        db.collection('registrations').createIndex({ eventId: 1, userEmail: 1 }, { unique: true }),
        db.collection('events').createIndex({ status: 1, date: 1 })
      ]);

      return { client, db };
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

async function getDb() {
  const { db } = await connectToDatabase();
  return db;
}

module.exports = {
  getDb
};
