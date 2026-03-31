import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import expressSession from 'express-session';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static("Public"));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(
    expressSession({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 3600000 },
    })
);

// MongoDB Connection
const mongoUri = process.env.MONGO_URI;
const dbName = 'travel_db'; 
let db;

MongoClient.connect(mongoUri)
    .then((client) => {
        console.log('✅ Connected to MongoDB Atlas Cluster');
        db = client.db(dbName);
    })
    .catch((error) => {
        console.error('❌ MongoDB Atlas Connection Error:', error);
    });

// File upload setup with Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({ storage });

// --- ROUTES ---

// Welcome Route
app.get('/M00949001', (req, res) => {
    res.send('Welcome to my website with Student ID M00949001!');
});

// User Registration
app.post('/M00949001/users', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, password, and email are required' });
    }

    try {
        const result = await db.collection('users').insertOne({ username, email, password });
        res.json({
            registration: true,
            message: 'User registered successfully',
            userId: result.insertedId,
        });
    } catch (error) {
        res.status(500).json({ error: `Error during registration: ${error.message}` });
    }
});

// Login Route
app.post('/M00949001/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const user = await db.collection('users').findOne({ username, password });
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        req.session.isLoggedIn = true;
        req.session.userId = user._id;
        req.session.email = user.email;

        res.json({ message: 'Login successful', userId: user._id });
    } catch (error) {
        res.status(500).json({ error: `Error during login: ${error.message}` });
    }
});

// Post Content
app.post('/M00949001/contents', upload.single('image'), async (req, res) => {
    const { title, content } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: 'You must be logged in to post content' });
    }

    try {
        const result = await db.collection('contents').insertOne({ 
            userId: req.session.userId, 
            title, 
            content, 
            image,
            createdAt: new Date()
        });
        res.json({ message: 'Content posted successfully', contentId: result.insertedId });
    } catch (error) {
        res.status(500).json({ error: `Error while posting: ${error.message}` });
    }
});

// Search Users
app.get('/M00949001/users/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query is required' });

    try {
        const users = await db.collection('users')
            .find({
                $or: [
                    { username: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                ],
            }).toArray();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout
app.delete('/M00949001/login', (req, res) => {
    req.session.destroy((error) => {
        if (error) return res.status(500).json({ error: 'Logout failed' });
        res.json({ message: 'Logout successful' });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}/M00949001`);
});