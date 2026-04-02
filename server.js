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
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

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
app.set('trust proxy', 1);
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

async function startServer() {
    try {
        // We wait for the database FIRST
        const client = await MongoClient.connect(mongoUri);
        db = client.db(dbName);
        console.log('✅ Connected to MongoDB Atlas');

        // Only after DB is ready, we start the server
        app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
    } catch (error) {
        console.error('❌ Connection Error:', error);
        process.exit(1); 
    }
}

startServer();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'zuzu_connect_uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
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
            userId: req.session.userId
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

// NEW: Update display name
app.put('/profile/username', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).send();
    const { username } = req.body;
    if (!username || username.trim().length < 2) return res.status(400).json({ error: "Name too short" });
    await db.collection('users').updateOne(
        { _id: new ObjectId(req.session.userId) },
        { $set: { username: username.trim() } }
    );
    req.session.username = username.trim();
    res.json({ success: true });
});

// NEW: Get current user's own posts
app.get('/profile/posts', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).send();
    const posts = await db.collection('contents')
        .find({ userId: req.session.userId })
        .sort({ createdAt: -1 })
        .toArray();
    res.json(posts);
});

// NEW: Delete a post (only owner can delete)
app.delete('/contents/:id', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).send();
    try {
        const result = await db.collection('contents').deleteOne({
            _id: new ObjectId(req.params.id),
            userId: req.session.userId
        });
        if (result.deletedCount === 0) return res.status(403).json({ error: "Not your post" });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// NEW: Get followers list with usernames
app.get('/profile/followers', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).send();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.userId) });
    const followerIds = (user.followers || []).map(id => new ObjectId(id));
    if (followerIds.length === 0) return res.json([]);
    const followers = await db.collection('users')
        .find({ _id: { $in: followerIds } })
        .project({ username: 1 })
        .toArray();
    res.json(followers);
});

// NEW: Get following list with usernames
app.get('/profile/following', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).send();
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.userId) });
    const followingIds = (user.following || []).map(id => new ObjectId(id));
    if (followingIds.length === 0) return res.json([]);
    const following = await db.collection('users')
        .find({ _id: { $in: followingIds } })
        .project({ username: 1 })
        .toArray();
    res.json(following);
});

// --- 3. POSTS & FEEDS ---

app.post('/contents', upload.array('images', 10), async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "At least one image is required" });
        }
        const images = req.files.map(f => f.path);
        await db.collection('contents').insertOne({ 
            userId: req.session.userId, 
            username: req.session.username,
            title, 
            description, 
            images,                  // array of URLs
            image: images[0],        // keep for backward compat with old posts
            createdAt: new Date() 
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Failed to upload to Cloudinary" });
    }
});

app.get('/feed', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).json({ error: "Not logged in" });
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.session.userId) });
    const posts = await db.collection('contents').find().sort({ createdAt: -1 }).toArray();
    
    const following = (user.following || []).map(id => id.toString());
    const myId = req.session.userId.toString();

    // Sort: followed users first, then newest within each group
    const sorted = posts.sort((a, b) => {
        const aFollowed = a.userId ? (following.includes(a.userId.toString()) ? 1 : 0) : 0;
        const bFollowed = b.userId ? (following.includes(b.userId.toString()) ? 1 : 0) : 0;
        if (bFollowed !== aFollowed) return bFollowed - aFollowed;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Attach likedByMe flag to each post
    const enriched = sorted.map(p => ({
        ...p,
        likeCount: (p.likes || []).length,
        likedByMe: (p.likes || []).map(id => id.toString()).includes(myId)
    }));
    
    res.json({ feed: enriched, followingIds: following });
});

// Toggle like on a post
app.post('/contents/:id/like', async (req, res) => {
    if (!req.session.isLoggedIn) return res.status(401).send();
    const postId = new ObjectId(req.params.id);
    const myId = new ObjectId(req.session.userId);

    const post = await db.collection('contents').findOne({ _id: postId });
    if (!post) return res.status(404).send();

    const likes = (post.likes || []).map(id => id.toString());
    const alreadyLiked = likes.includes(req.session.userId.toString());

    if (alreadyLiked) {
        await db.collection('contents').updateOne({ _id: postId }, { $pull: { likes: myId } });
    } else {
        await db.collection('contents').updateOne({ _id: postId }, { $addToSet: { likes: myId } });
    }

    const updated = await db.collection('contents').findOne({ _id: postId });
    res.json({ likeCount: (updated.likes || []).length, likedByMe: !alreadyLiked });
});

// --- 4. MESSAGING ---

app.post('/messages', async (req, res) => {
    try {
        const { receiverId, text } = req.body;
        const senderId = req.session.userId;
        if (!senderId) return res.status(401).send("Unauthorized");

        const sender = await db.collection('users').findOne({ _id: new ObjectId(senderId) });
        const receiver = await db.collection('users').findOne({ _id: new ObjectId(receiverId) });
        if (!sender || !receiver) return res.status(404).send("User not found");

        const newMessage = {
            senderId: new ObjectId(senderId),
            senderName: sender.username,
            receiverId: new ObjectId(receiverId),
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
    const myId = new ObjectId(req.session.userId);
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

