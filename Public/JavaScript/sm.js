const apiBase = "http://localhost:8080";
let currentChatUserId = null;
let myUserId = null;

// --- 1. INITIALIZATION & AUTH CHECK ---
// Update your Init function to show the Nav and FAB
async function init() {
    try {
        const res = await fetch(`${apiBase}/login-check`);
        const data = await res.json();
        
        if (data.loggedIn) {
            // 1. Store the User ID (Crucial for messaging)
            myUserId = data.userId;

            // 2. Hide Login/Register, Show App
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('app-section').classList.remove('hidden');
            
            // 3. Show Navigation & Floating Action Button
            document.getElementById('app-nav').classList.remove('hidden');
            document.getElementById('fab').classList.remove('hidden'); 
            
            // 4. Ensure the Search bar (in header) is visible
            // Note: If your search-container has the 'hidden' class in HTML, remove it here
            const searchBar = document.querySelector('.search-container');
            if (searchBar) searchBar.classList.remove('hidden');

            // 5. Load Data
            showTab('feed-tab'); 
            loadFeed(); 
            loadProfileStats();
        } else {
            // Optional: Ensure everything is hidden if NOT logged in
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
    
    // Auto-load inbox if that tab is selected
    if(tabId === 'inbox-tab') loadInbox();
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
    renderPosts(data.feed);
}

// FIXED SEARCH FUNCTION
async function searchContent() {
    const q = document.getElementById('search-query').value;
    if(!q) return loadFeed();
    
    const res = await fetch(`${apiBase}/search?q=${q}`);
    const posts = await res.json();
    renderPosts(posts);
}

function renderPosts(posts) {
    const list = document.getElementById('post-list');
    list.innerHTML = posts.map(post => {
        const isNotMine = post.userId !== myUserId; // Fix: Check if post belongs to someone else
        
        return `
        <div class="post">
            <div class="post-header"><strong>@${post.username}</strong></div>
            <img src="${post.image}" alt="Travel Image">
            <div class="post-body">
                <h3>${post.title}</h3>
                <p>${post.description}</p>
            </div>
            <div class="post-actions">
                ${isNotMine ? `
                    <button class="btn-insta-blue" onclick="follow('${post.userId}')">Follow</button>
                    <button class="btn-insta-grey" onclick="openDirectChat('${post.userId}', '${post.username}')">Message</button>
                ` : `<span class="my-post-tag">Your Post</span>`}
            </div>
        </div>`;
    }).join('');
}

document.getElementById('new-post-form').onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch(`${apiBase}/contents`, { method: 'POST', body: formData });
    if (res.ok) { e.target.reset(); loadFeed(); }
};

// --- 5. SOCIAL & MESSAGING ---
async function follow(id) {
    await fetch(`${apiBase}/follow/${id}`, { method: 'POST' });
    loadFeed(); loadProfileStats();
}

// --- UPDATED MESSENGER LOGIC ---

async function loadInbox() {
    const res = await fetch(`${apiBase}/inbox`);
    const msgs = await res.json();
    const list = document.getElementById('inbox-list');
    
    const partners = new Map();

    msgs.forEach(m => {
        // Convert IDs to strings to ensure comparison works
        const sId = m.senderId.toString();
        const rId = m.receiverId.toString();
        const me = myUserId.toString();

        const isISentIt = sId === me;
        const partnerId = isISentIt ? rId : sId;
        
        let partnerName = "User";
        if (!isISentIt) {
            partnerName = m.senderName || "New Contact"; 
        } else {
            partnerName = m.receiverName || "Chat Partner";
        }

        if (partnerName.includes("Contact") || partnerName.includes("Partner")) {
            if (partnerId) partnerName = "User_" + partnerId.substring(0, 4);
        }

        if (partnerId && partnerId !== me) {
            partners.set(partnerId, partnerName);
        }
    });

    list.innerHTML = Array.from(partners).map(([id, name]) => `
        <div class="inbox-card" onclick="openDirectChat('${id}','${name}')">
            <strong>${name}</strong>
            <p style="font-size:0.75rem; margin:0; color:var(--text-muted);">View conversation</p>
        </div>
    `).join('') || "<p style='padding:20px;'>No messages found.</p>";
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
        // Force string comparison for safety
        const side = (m.senderId.toString() === myUserId.toString()) ? 'sent' : 'received';
        return `<div class="msg-bubble ${side}">${m.text}</div>`;
    }).join('');
    
    historyDiv.scrollTop = historyDiv.scrollHeight;
}

// --- IMPORTANT: Update the Send Button ---
document.getElementById('send-reply-btn').onclick = async () => {
    const input = document.getElementById('reply-text');
    const text = input.value.trim();
    
    // Safety check: ensure we have a partner and text
    if(!text || !currentChatUserId) return;

    const res = await fetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            receiverId: currentChatUserId, 
            text: text 
        })
    });

    if(res.ok) {
        input.value = "";
        // Re-fetch chat history immediately
        const currentName = document.getElementById('chat-with-name').innerText;
        openDirectChat(currentChatUserId, currentName);
    }
};

// --- 6. SETTINGS ---
async function loadProfileStats() {
    const res = await fetch(`${apiBase}/profile/stats`);
    if(res.ok) {
        const data = await res.json();
        document.getElementById('user-stats').innerHTML = `<b>${data.username}</b> | Followers: ${data.followers}`;
        document.getElementById('user-stats').classList.remove('hidden');
    }
}

document.getElementById('logout').onclick = async () => { 
    await fetch(`${apiBase}/login`, { method: 'DELETE' }); 
    location.reload(); 
};

// BOOT THE APP
init();