const apiBase = "https://zuconnect-ntkhfsrm.b4a.run";
let currentChatUserId = null;
let myUserId = null;
let myFollowingIds = []; // Tracks who the logged-in user follows
let isSearchActive = false; // Tracks if search results are being shown

// --- 1. INITIALIZATION & AUTH CHECK ---
async function init() {
    try {
        const res = await fetch(`${apiBase}/login-check`);
        const data = await res.json();
        
        if (data.loggedIn) {
            myUserId = data.userId;

            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('app-section').classList.remove('hidden');
            document.getElementById('app-nav').classList.remove('hidden');
            document.getElementById('fab').classList.remove('hidden'); 
            
            const searchBar = document.querySelector('.search-container');
            if (searchBar) searchBar.classList.remove('hidden');

            showTab('feed-tab'); 
            loadFeed(); 
            loadProfileStats();
        } else {
            document.getElementById('auth-section').classList.remove('hidden');
            document.getElementById('app-nav').classList.add('hidden');
            document.getElementById('fab').classList.add('hidden');
        }
    } catch (err) { 
        console.error("Server Down or Connection Error:", err); 
    }
}

// --- 2. TAB NAVIGATION ---
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    const target = document.getElementById(tabId);
    if (target) target.classList.remove('hidden');
    
    // Update active tab button styling
    document.querySelectorAll('.tabs button[data-tab]').forEach(btn => {
        btn.classList.toggle('active-tab', btn.getAttribute('data-tab') === tabId);
    });

    if (tabId === 'inbox-tab') loadInbox();
    if (tabId === 'profile-tab') loadProfileTab();
}

// --- 3. LOGIN & REGISTER ---
document.getElementById('show-register').onclick = (e) => {
    e.preventDefault();
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('register-view').classList.remove('hidden');
};

document.getElementById('show-login').onclick = (e) => {
    e.preventDefault();
    document.getElementById('register-view').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
};

document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value
        })
    });
    if (res.ok) location.reload(); else alert("Login Failed");
};

document.getElementById('register-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: document.getElementById('register-username').value,
            email: document.getElementById('register-email').value,
            password: document.getElementById('register-password').value
        })
    });
    if (res.ok) { alert("Success! Please Login."); document.getElementById('show-login').click(); }
};

// --- 4. FEED, SEARCH & POSTING ---
async function loadFeed() {
    const res = await fetch(`${apiBase}/feed`);
    const data = await res.json();
    myFollowingIds = data.followingIds || []; // Store globally for follow state
    renderPosts(data.feed);
}

// Search with back button
async function searchContent() {
    const q = document.getElementById('search-query').value.trim();
    if (!q) return clearSearch();
    
    const res = await fetch(`${apiBase}/search?q=${encodeURIComponent(q)}`);
    const posts = await res.json();
    renderPosts(posts);

    // Show back button
    isSearchActive = true;
    document.getElementById('back-btn').classList.remove('hidden');
}

// Clear search and return to full feed
function clearSearch() {
    document.getElementById('search-query').value = '';
    isSearchActive = false;
    document.getElementById('back-btn').classList.add('hidden');
    loadFeed();
}

// Allow Enter key to trigger search
function handleSearchSubmit(e) {
    e.preventDefault();
    searchContent();
}

document.getElementById('search-query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchContent();
    }
});
function getPostImages(post) {
    // Support both new multi-image posts and old single-image posts
    if (post.images && post.images.length > 0) return post.images;
    if (post.image) return [post.image];
    return [];
}

function buildCarousel(images, postId) {
    if (images.length === 0) return '';
    if (images.length === 1) {
        return `<img src="${images[0]}" alt="Post image" class="post-main-img" loading="lazy">`;
    }
    const dots = images.map((_, i) =>
        `<span class="carousel-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide('${postId}', ${i})"></span>`
    ).join('');
    const slides = images.map((src, i) =>
        `<img src="${src}" alt="Post image ${i+1}" class="carousel-slide ${i === 0 ? 'active' : ''}" loading="lazy">`
    ).join('');
    return `
        <div class="carousel" id="carousel-${postId}">
            ${slides}
            ${images.length > 1 ? `
            <button class="carousel-btn prev" onclick="event.stopPropagation(); shiftSlide('${postId}', -1)">&#8249;</button>
            <button class="carousel-btn next" onclick="event.stopPropagation(); shiftSlide('${postId}', 1)">&#8250;</button>
            <div class="carousel-dots">${dots}</div>
            ` : ''}
        </div>`;
}

function shiftSlide(postId, dir) {
    const carousel = document.getElementById(`carousel-${postId}`);
    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots = carousel.querySelectorAll('.carousel-dot');
    let current = Array.from(slides).findIndex(s => s.classList.contains('active'));
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (current + dir + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
}

function goToSlide(postId, idx) {
    const carousel = document.getElementById(`carousel-${postId}`);
    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots = carousel.querySelectorAll('.carousel-dot');
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
}

function renderPosts(posts) {
    const list = document.getElementById('post-list');
    showTab('feed-tab');

    if (!posts || posts.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:30px;">No posts found.</p>';
        return;
    }

    list.innerHTML = posts.map(post => {
        const isMyPost = post.userId === myUserId || post.userId?.toString() === myUserId?.toString();
        const isFollowing = myFollowingIds.includes(post.userId?.toString());
        const likeCount = post.likeCount || 0;
        const likedByMe = post.likedByMe || false;
        const images = getPostImages(post);

        let actionButtons = '';
        if (isMyPost) {
            actionButtons = `<span class="my-post-tag">Your Post ✓</span>`;
        } else if (isFollowing) {
            actionButtons = `
                <button class="btn-following" onclick="follow('${post.userId}')">✓ Following</button>
                <button class="btn-insta-grey" onclick="openDirectChat('${post.userId}', '${post.username}')">Message</button>
            `;
        } else {
            actionButtons = `
                <button class="btn-insta-blue" onclick="follow('${post.userId}')">Follow</button>
                <button class="btn-insta-grey" onclick="openDirectChat('${post.userId}', '${post.username}')">Message</button>
            `;
        }

        return `
        <div class="post" id="feed-post-${post._id}">
            <div class="post-header"><strong>${post.username}</strong></div>
            <div class="post-media" onclick="openFeedPostModal('${post._id}')">
                ${buildCarousel(images, post._id)}
                <div class="post-read-hint">Tap to read full post</div>
            </div>
            <div class="post-body">
                <h3>${post.title}</h3>
                <p class="post-preview-desc">${post.description}</p>
            </div>
            <div class="post-actions">
                <button class="btn-like ${likedByMe ? 'liked' : ''}" onclick="toggleLike('${post._id}', this)">
                    <span class="heart">${likedByMe ? '❤️' : '🤍'}</span>
                    <span class="like-count">${likeCount}</span>
                </button>
                ${actionButtons}
            </div>
        </div>`;
    }).join('');

    // Store posts data for modal lookup
    window._feedPosts = posts;
}

function openFeedPostModal(postId) {
    const post = (window._feedPosts || []).find(p => p._id?.toString() === postId.toString());
    if (!post) return;
    const images = getPostImages(post);
    openPostModal(images, post.title, post.description, post.username);
}

document.getElementById('new-post-form').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch(`${apiBase}/contents`, { method: 'POST', body: formData });
    if (res.ok) { 
        e.target.reset(); 
        showTab('feed-tab');
        loadFeed(); 
    }
};

// --- 5. SOCIAL & FOLLOW ---
async function follow(id) {
    await fetch(`${apiBase}/follow/${id}`, { method: 'POST' });
    // Update local state immediately so button switches without full reload
    const idStr = id.toString();
    if (!myFollowingIds.includes(idStr)) {
        myFollowingIds.push(idStr);
    }
    // Re-render the current posts with updated follow state
    if (isSearchActive) {
        searchContent();
    } else {
        loadFeed();
    }
    loadProfileStats();
}

// --- 6. PROFILE TAB ---
async function loadProfileTab() {
    await loadProfileStats();
    await loadMyPosts();
}

async function loadProfileStats() {
    const res = await fetch(`${apiBase}/profile/stats`);
    if (!res.ok) return;
    const data = await res.json();

    // Update header stat
    document.getElementById('user-stats').innerHTML = `<b>${data.username}</b> | Followers: ${data.followers}`;
    document.getElementById('user-stats').classList.remove('hidden');

    // Update profile tab
    document.getElementById('profile-display-name').textContent = data.username;
    document.getElementById('profile-followers-count').textContent = data.followers;
    document.getElementById('profile-following-count').textContent = data.following;

    // Avatar initials
    const initials = data.username.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const avatar = document.getElementById('profile-avatar-initials');
    if (avatar) avatar.textContent = initials;

    // Pre-fill the rename input
    const nameInput = document.getElementById('new-username');
    if (nameInput) nameInput.value = data.username;
}

async function loadMyPosts() {
    const res = await fetch(`${apiBase}/profile/posts`);
    if (!res.ok) return;
    const posts = await res.json();

    const container = document.getElementById('my-post-list');
    document.getElementById('profile-posts-count').textContent = posts.length;

    if (posts.length === 0) {
        container.innerHTML = '<p class="no-posts-msg">You haven\'t posted anything yet. Share your first memory! ✈️</p>';
        return;
    }

    container.innerHTML = posts.map(post => {
        const imgs = (post.images && post.images.length > 0) ? post.images : (post.image ? [post.image] : []);
        const thumb = imgs[0] || '';
        const imgsJson = JSON.stringify(imgs).replace(/"/g, '&quot;');
        const safeTitle = post.title.replace(/'/g, "\'");
        const safeDesc = post.description.replace(/'/g, "\'");
        return `
        <div class="my-post-item" id="post-item-${post._id}">
            <img class="my-post-thumb" src="${thumb}" alt="${post.title}"
                 style="cursor:pointer;"
                 onclick="openPostModal(JSON.parse(this.closest('.my-post-item').dataset.imgs), '${safeTitle}', '${safeDesc}')"
            >
            <div class="my-post-info" style="cursor:pointer;"
                 onclick="openPostModal(JSON.parse(this.closest('.my-post-item').dataset.imgs), '${safeTitle}', '${safeDesc}')">
                <strong>${post.title}</strong>
                <p>${post.description}</p>
                ${imgs.length > 1 ? `<small style="color:var(--primary-blue);">📷 ${imgs.length} photos</small>` : ''}
            </div>
            <button class="btn-delete-post" onclick="deletePost('${post._id}')">🗑 Delete</button>
        </div>`;
    }).map((html, i) => {
        const post = posts[i];
        const imgs = (post.images && post.images.length > 0) ? post.images : (post.image ? [post.image] : []);
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        tmp.firstElementChild.dataset.imgs = JSON.stringify(imgs);
        return tmp.innerHTML;
    }).join('');
}

async function deletePost(postId) {
    if (!confirm("Delete this post? This can't be undone.")) return;
    const res = await fetch(`${apiBase}/contents/${postId}`, { method: 'DELETE' });
    if (res.ok) {
        // Remove from DOM instantly
        const el = document.getElementById(`post-item-${postId}`);
        if (el) el.remove();
        // Update post count
        const countEl = document.getElementById('profile-posts-count');
        if (countEl) countEl.textContent = parseInt(countEl.textContent) - 1;
        // Refresh feed too
        loadFeed();
    } else {
        alert("Couldn't delete this post.");
    }
}

// Update display name
document.getElementById('username-form').onsubmit = async (e) => {
    e.preventDefault();
    const newName = document.getElementById('new-username').value.trim();
    const res = await fetch(`${apiBase}/profile/username`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newName })
    });
    if (res.ok) {
        alert(`Name updated to "${newName}" ✓`);
        loadProfileStats();
        loadFeed(); // Refresh feed so posts show new name
    } else {
        alert("Couldn't update name — try again.");
    }
};

// Change password (moved to profile tab)
document.getElementById('password-form').onsubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`${apiBase}/profile/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            oldPassword: document.getElementById('old-pass').value,
            newPassword: document.getElementById('new-pass').value
        })
    });
    if (res.ok) {
        alert("Password updated ✓");
        e.target.reset();
    } else {
        alert("Wrong current password — try again.");
    }
};

// Logout (moved to profile tab)
document.getElementById('logout').onclick = async () => { 
    await fetch(`${apiBase}/login`, { method: 'DELETE' }); 
    location.reload(); 
};

// --- 7. FOLLOWERS / FOLLOWING MODALS ---
async function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');

    if (modalId === 'followers-modal') {
        const res = await fetch(`${apiBase}/profile/followers`);
        const users = await res.json();
        renderUserList('followers-list', users, 'No followers yet.');
    } else if (modalId === 'following-modal') {
        const res = await fetch(`${apiBase}/profile/following`);
        const users = await res.json();
        renderUserList('following-list', users, 'Not following anyone yet.');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function closeModalOutside(event, modalId) {
    if (event.target === document.getElementById(modalId)) {
        closeModal(modalId);
    }
}

function renderUserList(containerId, users, emptyMsg) {
    const container = document.getElementById(containerId);
    if (!users || users.length === 0) {
        container.innerHTML = `<p class="empty-modal-msg">${emptyMsg}</p>`;
        return;
    }
    container.innerHTML = users.map(u => {
        const initials = u.username.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
        return `
            <div class="user-list-item">
                <div class="user-list-avatar">${initials}</div>
                <strong>${u.username}</strong>
            </div>
        `;
    }).join('');
}

// Close modals with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal('followers-modal');
        closeModal('following-modal');
    }
});

// --- 8. MESSAGING ---
async function loadInbox() {
    const res = await fetch(`${apiBase}/inbox`);
    const msgs = await res.json();
    const list = document.getElementById('inbox-list');
    
    const partners = new Map();

    msgs.forEach(m => {
        const sId = m.senderId.toString();
        const rId = m.receiverId.toString();
        const me = myUserId.toString();

        const isISentIt = sId === me;
        const partnerId = isISentIt ? rId : sId;
        const partnerName = isISentIt ? (m.receiverName || 'User') : (m.senderName || 'User');

        if (partnerId && partnerId !== me) {
            partners.set(partnerId, partnerName);
        }
    });

    list.innerHTML = Array.from(partners).map(([id, name]) => `
        <div class="inbox-card" onclick="openDirectChat('${id}','${name}')">
            <strong>${name}</strong>
            <p style="font-size:0.75rem; margin:0; color:var(--text-muted);">View conversation</p>
        </div>
    `).join('') || "<p style='padding:20px; color:var(--text-muted);'>No messages yet.</p>";
}

async function openDirectChat(id, name) {
    currentChatUserId = id;
    showTab('inbox-tab');
    
    const chatWin = document.getElementById('chat-window');
    const nameHeader = document.getElementById('chat-with-name');
    const historyDiv = document.getElementById('message-history');

    chatWin.classList.remove('hidden');
    nameHeader.innerText = name; 
    
    const res = await fetch(`${apiBase}/messages/${id}`);
    const history = await res.json();
    
    historyDiv.innerHTML = history.map(m => {
        const side = (m.senderId.toString() === myUserId.toString()) ? 'sent' : 'received';
        return `<div class="msg-bubble ${side}">${m.text}</div>`;
    }).join('');
    
    historyDiv.scrollTop = historyDiv.scrollHeight;
}

document.getElementById('send-reply-btn').onclick = async () => {
    const input = document.getElementById('reply-text');
    const text = input.value.trim();
    if (!text || !currentChatUserId) return;

    const res = await fetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: currentChatUserId, text })
    });

    if (res.ok) {
        input.value = "";
        const currentName = document.getElementById('chat-with-name').innerText;
        openDirectChat(currentChatUserId, currentName);
    }
};


// --- 9. LIKES ---
async function toggleLike(postId, btn) {
    const res = await fetch(`${apiBase}/contents/${postId}/like`, { method: 'POST' });
    if (!res.ok) return;
    const data = await res.json();
    
    const heartEl = btn.querySelector('.heart');
    const countEl = btn.querySelector('.like-count');
    
    countEl.textContent = data.likeCount;
    heartEl.textContent = data.likedByMe ? '❤️' : '🤍';
    btn.classList.toggle('liked', data.likedByMe);
}

// --- 10. POST FULL VIEW MODAL (from profile) ---
function openPostModal(images, title, desc, username) {
    // images can be array or single string (from profile click)
    const imgs = Array.isArray(images) ? images : [images];
    
    const mediaEl = document.getElementById('post-view-media');
    if (imgs.length === 1) {
        mediaEl.innerHTML = `<img src="${imgs[0]}" alt="${title}" style="width:100%;max-height:70vh;object-fit:contain;border-radius:16px 16px 0 0;display:block;background:#000;">`;
    } else {
        const slides = imgs.map((src, i) =>
            `<img src="${src}" alt="${title} ${i+1}" class="modal-slide ${i===0?'active':''}" style="width:100%;max-height:70vh;object-fit:contain;background:#000;display:none;" ${i===0?'':''}>`
        ).join('');
        const dots = imgs.map((_, i) =>
            `<span class="carousel-dot ${i===0?'active':''}" onclick="goToModalSlide(${i})" style="cursor:pointer;"></span>`
        ).join('');
        mediaEl.innerHTML = `
            <div class="modal-carousel" id="modal-carousel">
                ${slides}
                <button class="carousel-btn prev" onclick="shiftModalSlide(-1)">&#8249;</button>
                <button class="carousel-btn next" onclick="shiftModalSlide(1)">&#8250;</button>
                <div class="carousel-dots">${dots}</div>
            </div>`;
        // Show first slide
        mediaEl.querySelectorAll('.modal-slide')[0].style.display = 'block';
    }

    document.getElementById('post-view-title').textContent = title;
    document.getElementById('post-view-desc').textContent = desc;
    if (username) {
        document.getElementById('post-view-username').textContent = username;
        document.getElementById('post-view-username').style.display = 'block';
    } else {
        document.getElementById('post-view-username').style.display = 'none';
    }
    document.getElementById('post-view-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function shiftModalSlide(dir) {
    const slides = document.querySelectorAll('#modal-carousel .modal-slide');
    const dots = document.querySelectorAll('#modal-carousel .carousel-dot');
    let current = Array.from(slides).findIndex(s => s.style.display === 'block');
    slides[current].style.display = 'none';
    dots[current].classList.remove('active');
    current = (current + dir + slides.length) % slides.length;
    slides[current].style.display = 'block';
    dots[current].classList.add('active');
}

function goToModalSlide(idx) {
    const slides = document.querySelectorAll('#modal-carousel .modal-slide');
    const dots = document.querySelectorAll('#modal-carousel .carousel-dot');
    slides.forEach((s, i) => { s.style.display = i === idx ? 'block' : 'none'; });
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
}

function closePostModal(event) {
    // Only close if clicking the backdrop itself
    if (event.target === document.getElementById('post-view-modal')) {
        document.getElementById('post-view-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// Close post modal with Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('post-view-modal').classList.add('hidden');
        document.body.style.overflow = '';
    }
});

// --- 11. SCROLL TO MY POSTS in profile ---
function scrollToMyPosts() {
    const el = document.getElementById('my-post-list');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- THEME TOGGLE ---
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('zuzu-theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Apply saved theme immediately on load
(function() {
    const saved = localStorage.getItem('zuzu-theme') || 'light';
    applyTheme(saved);
})();

// --- BOOT ---
init();