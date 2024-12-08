import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import expressSession from 'express-session';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = 8080;
app.use(cors());



// MongoDB Connection URI and Database
const mongoUri = 'mongodb://localhost:27017';
const dbName = 'myDatabase';

let db; // Database instance

// Connect to MongoDB
MongoClient.connect(mongoUri)
  .then((client) => {
    console.log('Connected to Database ("MongoDB")');
    db = client.db(dbName); // Set database
  })
  .catch((error) => {
    console.error('Failed to  connecting to Database "MongoDB":', error);
  });

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(
  expressSession({
    secret: "cst2120_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 },
  })
);



// Serve static files from the "Public" directory
app.use(express.static("Public"));


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload setup with Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// {$text: {$search: "York"}}
const upload = multer({ storage });

// Serve the main website at /M00949001
app.get('/M00949001', (req, res) => {
  res.send('Welcome to my website with Student ID M00949001!');
});

// Welcome Route
app.get('/M00949001/users', async (req, res) => {
  res.json({ message: `Welcome to the page for M00949001` });
});

// User Registration Route with Email
app.post('/M00949001/users', async (req, res) => {
  const { username, email, password } = req.body;

  // Validate input
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, password, and email are required' });
  }

  // check email is unique
  try {
    // Check if email already exists in the database
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already taken!' });
    }

    // Insert user into MongoDB 
    db.collection('users')
      .insertOne({ username, email, password })
      .then((result) => {
        res.json({
          registration: true,
          message: 'User registered successfully',
          userId: result.insertedId,
        });
      })

      .catch((error) => {
        res.status(500).json({ error: `Error during registration: ${error.message}` });
      });
  } catch (error) {
    res.status(500).json({ error: `Error during registration: ${error.message}` });
  }

});

// Login Route
app.post('/M00949001/login', async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Check user credentials in MongoDB
  db.collection('users')
    .findOne({ username, password })
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Set session data
      req.session.isLoggedIn = true;
      req.session.userId = user._id;
      req.session.email = user.email;

      res.json({ message: 'Login successful', userId: user._id });
    })
    .catch((error) => {
      res.status(500).json({ error: `Error during login: ${error.message}` });
    });
});

// Login Status Route
app.get('/M00949001/login', async (req, res) => {
  if (req.session.isLoggedIn) {
    return res.json({ loggedIn: true, userId: req.session.userId });
  }
  res.json({ loggedIn: false });
});

// Logout Route
app.delete('/M00949001/login', async (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: 'Error during logout' });
    }
    res.json({ message: 'Logout successful' });
  });
});
// Add New Content 

app.post('/M00949001/contents', upload.single('image'), async (req, res) => {
  const { title, content } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  if (!req.session.isLoggedIn) {
    return res.status(401).json({ error: 'You must be logged in to post content' });
  }

  db.collection('contents')
    .insertOne({ userId: req.session.userId, title, content, image })
    .then((result) => {
      res.json({ message: 'Content posted successfully', contentId: result.insertedId });
    })
    .catch((error) => {
      res.status(500).json({ error: `Error while posting content: ${error.message}` });
    });
});



// load contents from logged in users
app.get('/M00949001/contents', async (req, res) => {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ error: 'You must be logged in to view content' });
  }

  db.collection('contents')
    .find({ userId: req.session.userId })
    .toArray()
    .then((contents) => {
      res.json({ contents });
    })
    .catch((error) => {
      res.status(500).json({ error: `Error while retrieving content: ${error.message}` });
    });
});
// Follow a User 
app.post('/M00949001/follows', async (req, res) => {
  const { email: followEmail } = req.body;

  if (!req.session.isLoggedIn) {
    console.log('User is not logged in');
    return res.status(401).json({ error: 'You must be logged in to follow users' });
  }
  const userEmail = req.session.email; // Email from session
  if (!userEmail) {
    console.log('Session email is missing.');
    return res.status(400).json({ error: 'Session email is missing. Please log in again.' });
  }
  if (!followEmail) {
    console.log('Followed email is missing:', followEmail);
    return res.status(400).json({ error: 'Followed email is required' });
  }

  try {
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.follows) {
      user.follows = [];
    }

    if (!user.follows.includes(followEmail)) {
      user.follows.push(followEmail);

      await usersCollection.updateOne(
        { email: userEmail },
        { $set: { follows: user.follows } }
      );
      console.log('User followed successfully');
      return res.json({ updated: true, message: 'Followed successfully' });
    } else {
      return res.status(400).json({ error: 'Already following this user' });
    }
  } catch (error) {
    console.error('Error while following user:', error);
    return res.status(500).json({ error: `Error while following user: ${error.message}` });
  }
});

// Get followed users
app.get('/M00949001/follows', async (req, res) => {
  if (!req.session.isLoggedIn) {
    console.log('User is not logged in');
    return res.status(401).json({ error: 'You must be logged in to view followed users' });
  }

  const userEmail = req.session.email; // Email from session
  if (!userEmail) {
    console.log('Session email is missing.');
    return res.status(400).json({ error: 'Session email is missing. Please log in again.' });
  }

  try {
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the list of followed users' emails
    const followedUsers = await usersCollection.find({ email: { $in: user.follows } }).toArray();
    return res.json({ followedUsers });
  } catch (error) {
    console.error('Error while fetching followed users:', error);
    return res.status(500).json({ error: `Error while fetching followed users: ${error.message}` });
  }
});

// Get Posts from Followed Users
app.get('/M00949001/contents', async (req, res) => {
  const loggedInUserId = req.session.userId; // Assume userId is stored in the session

  if (!loggedInUserId) {
    return res.status(401).json({ error: 'User not logged in' });
  }

  try {
    // Retrieve the logged-in user's document to get their 'follows' list (user IDs of followed users)
    console.log('Logged in userId:', loggedInUserId);
    const loggedInUser = await db.collection('users').findOne({ _id: new ObjectId(loggedInUserId) });
    
    if (!loggedInUser || !loggedInUser.follows || loggedInUser.follows.length === 0) {
      return res.json([]); // If no followed users, return empty array
    }
    console.log('Followed users:', loggedInUser.follows);
    // Get the followed userIds (no need to query by email, we already have userIds)
    const followedUserIds = loggedInUser.follows;

    if (followedUserIds.length === 0) {
      return res.json([]); // No followed userIds found
    }
    console.log('Followed userIds:', followedUserIds);
    // Fetch the posts from the followed users using their userIds
    const posts = await db.collection('contents')
      .find({ userId: { $in: followedUserIds.map(id => new ObjectId(id)) } })
      .sort({ createdAt: -1 }) // Optional: sort posts by creation time
      .toArray();
      console.log('Fetched posts:', posts);
    // Return posts of the followed users
    res.json(posts);
  } catch (error) {
    console.error('Error retrieving followed users\' posts:', error.message);
    res.status(500).json({ error: `Error retrieving posts: ${error.message}` });
  }
});


// Unfollow a User
app.delete('/M00949001/follow', async (req, res) => {
  const { email: unfollowEmail } = req.body;

  if (!req.session.isLoggedIn) {
    console.log('User is not logged in');
    return res.status(401).json({ error: 'You must be logged in to unfollow users' });
  }

  const userEmail = req.session.email; // Email from session
  if (!userEmail) {
    console.log('Session email is missing.');
    return res.status(400).json({ error: 'Session email is missing. Please log in again.' });
  }
  if (!unfollowEmail) {
    console.log('Unfollowed email is missing:', unfollowEmail);
    return res.status(400).json({ error: 'Unfollowed email is required' });
  }

  try {
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: userEmail });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.follows || !user.follows.includes(unfollowEmail)) {
      return res.status(400).json({ error: 'You are not following this user' });
    }

    // Remove the user from the follows list
    user.follows = user.follows.filter(email => email !== unfollowEmail);

    await usersCollection.updateOne(
      { email: userEmail },
      { $set: { follows: user.follows } }
    );
    console.log('User unfollowed successfully');
    return res.json({ updated: true, message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Error while unfollowing user:', error);
    return res.status(500).json({ error: `Error while unfollowing user: ${error.message}` });
  }
});


// Search Users Route
app.get('/M00949001/users/search', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  db.collection('users')
    .find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    })
    .toArray()
    .then((users) => {
      res.json(users);
    })
    .catch((error) => {
      res.status(500).json({ error: `Error while searching users: ${error.message}` });
    });
});
//view contents of the search users
app.get('/M00949001/users/:userId/contents', async (req, res) => {
  const { userId } = req.params;
  console.log('Received request for user ID:', userId);

  if (!ObjectId.isValid(userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  try {
    const posts = await db.collection('contents').find({ userId: new ObjectId(userId) }).toArray();
    if (posts.length === 0) {
      return res.status(404).json({ error: 'No posts found for this user' });
    }
    res.json(posts);
  } catch (error) {
    console.error('Error while retrieving posts:', error.message);
    res.status(500).json({ error: `Error while retrieving posts: ${error.message}` });
  }
});



// GET/search (Search for content by title)
app.get('/M00949001/contents/search', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const contents = await db.collection('contents').find({ title: { $regex: q, $options: 'i' } }).toArray();

    // Directly return contents with the username already saved in the content
    res.json(contents);
  } catch (error) {
    res.status(500).json({ error: `Error while searching contents: ${error.message}` });
  }
});




// Start the Server
app.listen(PORT, () => {

  console.log(`Website available at http://localhost:${PORT}/M00949001`);
});
