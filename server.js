import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import expressSession from 'express-session';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// --- MIDDLEWARE ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static("Public")); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(
    expressSession({
        secret: process.env.SESSION_SECRET || 'travel_social_secret',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 3600000, secure: false } 
    })
);

// --- MONGODB CONNECTION ---
const mongoUri = process.env.MONGO_URI;
const dbName = 'travel_db'; 
let db;

MongoClient.connect(mongoUri)
    .then((client) => {
        console.log('✅ Connected to MongoDB Atlas');
        db = client.db(dbName);
    })
    .catch((error) => console.error('❌ Connection Error:', error));

// Image Upload Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './uploads'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// --- 1. AUTHENTICATION ---

app.post('/users', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashed = await bcrypt.hash(password, 10);
        await db.collection('users').insertOne({ 
            username, email, password: hashed, following: [], followers: [], createdAt: new Date() 
        });
        res.json({ registration: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.collection('users').findOne({ email });
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.isLoggedIn = true;
        req.session.userId = user._id;
        req.session.username = user.username;
        return res.json({ message: 'Login successful', loggedIn: true });
    }
    res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/login-check', (req, res) => {
    if (req.session.isLoggedIn) {
        res.json({ 
            loggedIn: true, 
            username: req.session.username,
            userId: req.session.userId  // ADD THIS LINE
        });
    } else {
        res.json({ loggedIn: false });
    }
});
app.delete('/login', (req, res) => {
    req.session.destroy();
    res.json({ message: "Logged out" });
});

// --- 2. PROFILE & SETTINGS ---

app.get('/profile/stats', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).send();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.userId) });
    res.json({
        username: user.username,
        following: user.following ? user.following.length : 0,
        followers: user.followers ? user.followers.length : 0
    });
});

app.put('/profile/password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.userId) });
    if (await bcrypt.compare(oldPassword, user.password)) {
        const hashed = await bcrypt.hash(newPassword, 10);
        await db.collection('users').updateOne({ _id: user._id }, { $set: { password: hashed } });
        return res.json({ success: true });
    }
    res.status(401).json({ error: "Wrong original password" });
});

// --- 3. POSTS & FEEDS ---

app.post('/contents', upload.single('image'), async (req, res) => {
    const { title, description } = req.body;
    await db.collection('contents').insertOne({ 
        userId: req.session.userId, username: req.session.username,
        title, description, image: `/uploads/${req.file.filename}`, createdAt: new Date() 
    });
    res.json({ success: true });
});

app.get('/feed', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).json({ error: "Not logged in" });
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.userId) });
    const posts = await db.collection('contents').find().sort({ createdAt: -1 }).toArray();
    
    const following = (user.following || []).map(id => id.toString());
    
    // Sort so following content is first
    const sorted = posts.sort((a, b) => {
        const aFollowed = following.includes(a.userId.toString());
        const bFollowed = following.includes(b.userId.toString());
        return bFollowed - aFollowed;
    });
    
    res.json({ feed: sorted, followingIds: following });
});

// --- 4. MESSAGING (CRITICAL UPDATES) ---

// --- 4. MESSAGING (FIXED SERVER LOGIC) ---

app.post('/messages', async (req, res) => {
    try {
        const { receiverId, text } = req.body;
        const senderId = req.session.userId;

        if (!senderId) return res.status(401).send("Unauthorized");

        // Convert IDs to ObjectIDs to find the users in DB
        const sender = await db.collection('users').findOne({ _id: new ObjectId(senderId) });
        const receiver = await db.collection('users').findOne({ _id: new ObjectId(receiverId) });

        if (!sender || !receiver) return res.status(404).send("User not found");

        const newMessage = {
            senderId: new ObjectId(senderId),     // Save as ObjectID
            senderName: sender.username,
            receiverId: new ObjectId(receiverId), // Save as ObjectID
            receiverName: receiver.username,
            text,
            createdAt: new Date()
        };

        await db.collection('messages').insertOne(newMessage);
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error sending message");
    }
});

app.get('/inbox', async (req, res) => {
    const myId = new ObjectId(req.session.userId); // Ensure this is an ObjectID
    if (!myId) return res.status(401).send("Not logged in");

    const messages = await db.collection('messages').find({
        $or: [{ senderId: myId }, { receiverId: myId }]
    }).sort({ createdAt: -1 }).toArray();

    res.json(messages);
});

app.get('/messages/:otherUserId', async (req, res) => {
    try {
        const myId = new ObjectId(req.session.userId);
        const otherUserId = new ObjectId(req.params.otherUserId);

        const history = await db.collection('messages').find({
            $or: [
                { senderId: myId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: myId }
            ]
        }).sort({ createdAt: 1 }).toArray();
        
        res.json(history);
    } catch (err) {
        res.status(500).json([]);
    }
});

// --- 5. SOCIAL ---

app.post('/follow/:id', async (req, res) => {
    const target = new ObjectId(req.params.id);
    const myId = new ObjectId(req.session.userId);
    
    await db.collection('users').updateOne({ _id: myId }, { $addToSet: { following: target } });
    await db.collection('users').updateOne({ _id: target }, { $addToSet: { followers: myId } });
    res.json({ followed: true });
});

app.get('/search', async (req, res) => {
    const results = await db.collection('contents').find({
        $or: [
            { title: { $regex: req.query.q, $options: 'i' } },
            { username: { $regex: req.query.q, $options: 'i' } }
        ]
    }).toArray();
    res.json(results);
});

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));