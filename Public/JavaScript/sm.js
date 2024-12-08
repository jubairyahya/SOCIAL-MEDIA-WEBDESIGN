// Select elements
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const newPostForm = document.getElementById('new-post-form');
const postList = document.getElementById('post-list');
const logoutButton = document.getElementById('logout');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const registerView = document.getElementById('register-view');
const loginView = document.getElementById('login-view');
const searchForm = document.getElementById('search-form');
const searchResults = document.getElementById('search-results');
const followedPostList = document.getElementById('followed-post-list');
const followedUsersList = document.getElementById('followed-users-list');
const usernameDisplay = document.getElementById('username-display');
const loggedInUsername = document.getElementById('logged-in-username');

const apiBase = "http://localhost:8080/M00949001";

// Show Register form
showRegister.addEventListener('click', () => {
  loginView.classList.add('hidden');
  registerView.classList.remove('hidden');
});

// Show Login form
showLogin.addEventListener('click', () => {
  registerView.classList.add('hidden');
  loginView.classList.remove('hidden');
});

// Handle login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    const response = await fetch(`${apiBase}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include', // Ensure session cookies are sent
    });

    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('username', username);
      authSection.classList.add('hidden');
      appSection.classList.remove('hidden');
      usernameDisplay.classList.remove('hidden'); 
      loggedInUsername.textContent = username; 
      loadPosts();
      loadFollowedPosts();
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (err) {
    console.error('Error during login:', err);
    alert('An error occurred while logging in.');
  }
});

// Handle registration
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value.trim();

  try {
    const response = await fetch(`${apiBase}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();
    if (response.ok) {
      alert('Registration successful. Please log in.');
      registerView.classList.add('hidden');
      loginView.classList.remove('hidden');
    } else {
      alert(data.error || 'Registration failed');
    }
  } catch (err) {
    console.error('Error during registration:', err);
    alert('An error occurred while registering.');
  }
});

// Logout
logoutButton.addEventListener('click', async () => {
  try {
    const response = await fetch(`${apiBase}/login`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (response.ok) {
      localStorage.removeItem('username');
      appSection.classList.add('hidden');
      authSection.classList.remove('hidden');
      usernameDisplay.classList.add('hidden'); 
    } else {
      alert('Failed to logout');
    }
  } catch (err) {
    console.error('Error during logout:', err);
  }
});

// Handle new post submission
newPostForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('title').value.trim();
  const content = document.getElementById('tip').value.trim();
  const image = document.getElementById('image').files[0];

  const formData = new FormData();
  formData.append('title', title);
  formData.append('content', content);
  if (image) formData.append('image', image);

  try {
    const response = await fetch(`${apiBase}/contents`, {
      method: 'POST',
      credentials: 'include', // Ensure session cookies are sent
      body: formData,
    });

    const data = await response.json();
    if (response.ok) {
      loadPosts();
      alert('Post created successfully!');
      newPostForm.reset(); // Reset form after successful submission
    } else {
      alert(data.error || 'Failed to create post');
    }
  } catch (err) {
    console.error('Error during post creation:', err);
    alert('An error occurred while creating the post.');
  }
});

// Load posts from the server
async function loadPosts() {
  try {
    const response = await fetch(`${apiBase}/contents`, {
      credentials: 'include', // Ensure session cookies are sent
    });

    const data = await response.json();
    if (response.ok) {
      if (data.contents.length === 0) {
        postList.innerHTML = '<p>No posts available</p>';
      } else {
        postList.innerHTML = data.contents.map(post => `
          <div class="post">
            <h4>${post.title}</h4>
            <p>${post.content}</p>
            ${post.image ? `<img src="${post.image}" alt="${post.title}">` : ''}
          </div>
        `).join('');
      }
    } else {
      alert(data.error || 'Failed to load posts');
    }
  } catch (err) {
    console.error('Error loading posts:', err);
    postList.innerHTML = '<p>Failed to load posts. Check console for details.</p>';
  }
}


// Load followed users' posts
async function loadFollowedPosts() {
  try {
    console.log('Fetching followed posts from:', `${apiBase}/contents`);
    const response = await fetch(`${apiBase}/contents`, {
      credentials: 'include', // Ensures session cookies are sent
    });

    const posts = await response.json();
    console.log('Response from API:', posts);
    if (response.ok) {
      // Check if there are posts and render them
      followedPostList.innerHTML = posts.length
        ? posts.map(post => `
          <div class="followed-post">
            <h4>${post.title}</h4>
            <p>${post.content}</p>
            ${post.image ? `<img src="${post.image}" alt="${post.title}">` : ''}
            <p><strong>Posted by:</strong> ${post.username || 'Anonymous'}</p>
          </div>
        `).join('')
        : '<p>No posts from followed users.</p>';
    } else {
      // Show an error message if the response is not okay
      alert(posts.error || 'Failed to load followed posts');
    }
  } catch (err) {
    console.error('Error loading followed posts:', err);
    followedPostList.innerHTML = '<p>Failed to load followed posts. Check console for details.</p>';
  }
}

// Call this function to load the posts when the page loads
loadFollowedPosts();

// Handle search form submission
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const query = document.getElementById('search-query').value.trim();

  try {
    const response = await fetch(`${apiBase}/users/search?q=${encodeURIComponent(query)}`, {
      credentials: 'include',
    });

    const results = await response.json();


    if (response.ok) {
      searchResults.innerHTML = results.map(result => `
        <div class="result">
          <h4><a href="#" class="view-user-posts" data-user-id="${result.id}">${result.username}</a></h4>
          <p>${result.email}</p>
         <button class="follow-btn" data-followed-email="${result.email}">Follow</button>
        </div>
      `).join('');
    } else {
      alert(results.error || 'Search failed');
    }
  } catch (err) {
    console.error('Error during search:', err);
    alert('An error occurred while searching.');
  }


});



// Follow user functionality
document.addEventListener('click', async (e) => {
  if (e.target && e.target.classList.contains('follow-btn')) {
    const followedEmail = e.target.getAttribute('data-followed-email');

    if (!followedEmail) {
      alert('Followed user email is missing.');
      return;
    }

    try {
      const response = await fetch(`${apiBase}/follows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: followedEmail }),
      });

      const data = await response.json();
      if (response.ok) {
        alert('User followed successfully');
        loadFollowedPosts();
      } else {
        alert(data.error || 'Failed to follow user');
      }
    } catch (err) {
      console.error('Error following user:', err);
      alert('An error occurred while following user');
    }
  }

});
// Load followed users
async function loadFollowedUsers() {
  try {
    const response = await fetch(`${apiBase}/follows`, {
      credentials: 'include', // Ensure session cookies are sent
    });

    const data = await response.json();
    if (response.ok) {
      if (data.followedUsers.length === 0) {
        followedUsersList.innerHTML = '<p>You are not following any users yet.</p>';
      } else {
        followedUsersList.innerHTML = data.followedUsers.map(user => `
          <div class="followed-user">
            <h4>${user.username}</h4>
            <button class="unfollow-btn" data-followed-email="${user.email}">Unfollow</button>
          </div>
        `).join('');
      }
    } else {
      alert(data.error || 'Failed to load followed users');
    }
  } catch (err) {
    console.error('Error loading followed users:', err);
    followedUsersList.innerHTML = '<p>Failed to load followed users. Check console for details.</p>';
  }
}


// Unfollow user functionality
document.addEventListener('click', async (e) => {
  if (e.target && e.target.classList.contains('unfollow-btn')) {
    const unfollowEmail = e.target.getAttribute('data-followed-email');

    if (!unfollowEmail) {
      alert('Unfollowed user email is missing.');
      return;
    }

    try {
      const response = await fetch(`${apiBase}/follow`, {
        method: 'DELETE',  // Change the method to DELETE
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',  // Ensures session cookies are sent
        body: JSON.stringify({ email: unfollowEmail }),
      });

      const data = await response.json();
      if (response.ok) {
        alert('User unfollowed successfully');
        loadFollowedUsers(); // Reload followed users list
      } else {
        alert(data.error || 'Failed to unfollow user');
      }
    } catch (err) {
      console.error('Error unfollowing user:', err);
      alert('An error occurred while unfollowing user');
    }
  }
});


// Initialize followed users when the page loads
loadFollowedUsers();


// Event listener for view-user-posts
searchResults.addEventListener('click', async (e) => {
  if (e.target && e.target.classList.contains('view-user-posts')) {
    e.preventDefault();

    // Retrieve the userId from the clicked element's data attribute
    const userId = e.target.getAttribute('data-user-id');
    console.log('Clicked user ID:', userId);
    if (!userId) {
      alert('User ID is missing.');
      return;
    }

    try {
      // Corrected endpoint to match the backend route
      console.log('Fetching posts for user ID:', userId);
      const response = await fetch(`${apiBase}/users/${userId}/contents`, {
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('Failed response status:', response.status);
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const posts = await response.json();
      console.log('Fetched posts:', posts);
      followedPostList.innerHTML = posts.map(post => `
        <div class="post">
          <h4>${post.title}</h4>
          <p>${post.content}</p>
          ${post.image ? `<img src="${post.image}" alt="${post.title}">` : ''}
        </div>
      `).join('');
    } catch (err) {
      console.error('Error during loading user posts:', err);
      alert('An error occurred while fetching user posts.');
    }
  }
});


// Search content by title
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const query = document.getElementById('search-query').value.trim();
  console.log(query, "id");

  try {
    const response = await fetch(`${apiBase}/contents/search?q=${encodeURIComponent(query)}`, {
      credentials: 'include',
    });

    const results = await response.json();
    if (response.ok) {
      postList.innerHTML = results.map(post => `
        <div class="post">
          <h4>${post.username}</h4> <!-- Display the username here -->
          <h5>${post.title}</h5> <!-- Content Title -->
          <p>${post.content}</p> <!-- Content Body -->
          ${post.image ? `<img src="${post.image}" alt="${post.title}">` : ''}
        </div>
      `).join('');
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to search posts');
    }
  } catch (err) {
    console.error('Error during content search:', err);
    alert('An error occurred while searching.');
  }
});

// View search user posts
async function viewUserPosts(userId) {
  try {
    const response = await fetch(`${apiBase}/users/${userId}/contents`, {
      credentials: 'include',
    });

    const posts = await response.json();
    if (response.ok) {
      postList.innerHTML = posts.length
        ? posts.map(post => `
          <div class="post">
            <h4>${post.title}</h4>
            <p>${post.content}</p>
            ${post.image ? `<img src="${post.image}" alt="${post.title}">` : ''}
          </div>
        `).join('')
        : '<p>No posts found for this user.</p>';
    } else {
      alert(posts.error || 'Failed to load user posts');
    }
  } catch (err) {
    console.error('Error loading user posts:', err);
    postList.innerHTML = '<p>Failed to load user posts. Check console for details.</p>';
  }
}

viewUserPosts();

// Initialize app by checking login status
async function initializeApp() {
  try {
    const response = await fetch(`${apiBase}/login`, {
      credentials: 'include',
    });

    const data = await response.json();
    if (data.loggedIn) {
      authSection.classList.add('hidden');
      appSection.classList.remove('hidden');
      loadPosts();
      loadFollowedPosts();
    }
  } catch (err) {
    console.error('Error initializing app:', err);
  }
}

// Run on load
initializeApp();
