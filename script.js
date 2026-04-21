let myData = JSON.parse(localStorage.getItem('wos_me')) || null;
let myFriends = JSON.parse(localStorage.getItem('wos_friends')) || [];
let myStories = JSON.parse(localStorage.getItem('wos_stories')) || [];

let currentChatIndex = null;
let modalTargetIndex = null;
let peer = null;
let activeConn = null;
let tempProfilePic = "";

window.onload = () => {
    setTimeout(() => {
        if (myData) {
            initPeer();
            loadMain();
        } else {
            showScreen('login-screen');
        }
    }, 3000);
};

function startApp() {
    const numberInput = document.getElementById('my-number');
    const number = numberInput.value.trim();

    if (!/^\d{10}$/.test(number)) {
        alert("Numaranız 10 haneli olmalıdır!");
        return;
    }

    myData = {
        nick: number,
        id: "WOS-" + number,
        pic: ""
    };

    localStorage.setItem('wos_me', JSON.stringify(myData));
    initPeer();
    loadMain();
}

function initPeer() {
    try {
        if (peer) {
            peer.destroy();
        }

        peer = new Peer(myData.id);

        peer.on('open', () => {
            console.log("Peer hazır:", myData.id);
        });

        peer.on('connection', (conn) => {
            setupIncomingConnection(conn);
        });

        peer.on('error', (err) => {
            console.error("Peer hatası:", err);
            document.getElementById('conn-status').innerText = "Bağlantı hatası";
        });
    } catch (error) {
        console.error("Peer başlatılamadı:", error);
        alert("Bağlantı sistemi başlatılamadı.");
    }
}

function setupIncomingConnection(conn) {
    activeConn = conn;

    conn.on('open', () => {
        console.log("Gelen bağlantı açıldı:", conn.peer);
    });

    conn.on('data', (data) => {
        const friend = myFriends.find(f => f.id === conn.peer);
        if (friend && friend.isBlocked) return;

        if (typeof data === 'object' && data !== null && data.type === 'profile_sync') {
            updateFriendProfile(conn.peer, data);
        } else {
            handleIncomingMsg(conn.peer, data);
        }
    });

    conn.on('close', () => {
        if (document.getElementById('conn-status')) {
            document.getElementById('conn-status').innerText = "Çevrimdışı";
        }
    });

    conn.on('error', (err) => {
        console.error("Bağlantı hatası:", err);
    });
}

function openFriendMenu(index) {
    modalTargetIndex = index;
    const friend = myFriends[index];
    if (!friend) return;

    document.getElementById('modal-title').innerText = friend.nick;
    document.getElementById('block-btn').innerText = friend.isBlocked ? "Engeli Kaldır" : "Engelle";
    document.getElementById('friend-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('friend-modal').style.display = 'none';
    modalTargetIndex = null;
}

function modalRename() {
    if (modalTargetIndex === null) return;

    const friend = myFriends[modalTargetIndex];
    if (!friend) return;

    const newName = prompt("Yeni isim:", friend.nick);
    if (newName && newName.trim()) {
        friend.nick = newName.trim();
        saveFriends();
        renderContacts();

        if (currentChatIndex === modalTargetIndex) {
            document.getElementById('chat-title').innerText = friend.nick;
        }
    }

    closeModal();
}

function modalToggleBlock() {
    if (modalTargetIndex === null) return;

    const friend = myFriends[modalTargetIndex];
    if (!friend) return;

    friend.isBlocked = !friend.isBlocked;
    saveFriends();
    renderContacts();

    if (currentChatIndex === modalTargetIndex) {
        openChat(modalTargetIndex);
    }

    closeModal();
}

function renderContacts() {
    const list = document.getElementById('contact-list');
    list.innerHTML = '';

    if (myFriends.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:20px; color:#8696a0;">Kişi yok.</p>';
        return;
    }

    myFriends.forEach((f, index) => {
        const imgHtml = f.pic
            ? `<img src="${f.pic}" class="profile-pic" style="width:35px; height:35px;">`
            : '<div class="profile-pic" style="width:35px; height:35px;"></div>';

        const blockedHtml = f.isBlocked
            ? '<span style="color:#ea0038; font-size:10px;"> (ENGELLİ)</span>'
            : '';

        list.innerHTML += `
            <div class="item">
                <div style="display:flex; align-items:center; flex:1;" onclick="openChat(${index})">
                    ${imgHtml}
                    <div>
                        <strong>${escapeHtml(f.nick)}${blockedHtml}</strong><br>
                        <span class="id-text">${escapeHtml(f.id.replace("WOS-", ""))}</span>
                    </div>
                </div>
                <div class="more-icon" onclick="openFriendMenu(${index})">•••</div>
            </div>
        `;
    });
}

function openChat(index) {
    const f = myFriends[index];
    if (!f) return;

    currentChatIndex = index;
    showScreen('chat-screen');

    document.getElementById('chat-title').innerText = f.nick;
    document.getElementById('conn-status').innerText = "Bağlanıyor...";

    const avatar = document.getElementById('chat-avatar');
    if (f.pic) {
        avatar.src = f.pic;
        avatar.style.display = "block";
    } else {
        avatar.style.display = "none";
    }

    if (f.isBlocked) {
        document.getElementById('chat-footer').style.display = "none";
        document.getElementById('blocked-notice').style.display = "block";
    } else {
        document.getElementById('chat-footer').style.display = "flex";
        document.getElementById('blocked-notice').style.display = "none";
    }

    renderMessages();

    try {
        if (activeConn && activeConn.open) {
            activeConn.close();
        }

        activeConn = peer.connect(f.id);
        setupConnEvents(activeConn);

        setTimeout(() => {
            if (activeConn && activeConn.open) {
                activeConn.send({
                    type: 'profile_sync',
                    nick: myData.nick,
                    pic: myData.pic
                });
            }
        }, 1000);
    } catch (error) {
        console.error("Sohbet bağlantısı kurulamadı:", error);
        document.getElementById('conn-status').innerText = "Bağlantı kurulamadı";
    }
}

function sendMsg() {
    if (currentChatIndex === null) return;

    const friend = myFriends[currentChatIndex];
    if (!friend || friend.isBlocked) return;

    const input = document.getElementById('msg-input');
    const text = input.value.trim();

    if (!text) return;

    if (!activeConn || !activeConn.open) {
        alert("Kişi çevrimdışı veya bağlantı kurulamadı.");
        return;
    }

    try {
        activeConn.send(text);

        if (!Array.isArray(friend.messages)) {
            friend.messages = [];
        }

        friend.messages.push({
            text: text,
            type: 'sent'
        });

        saveFriends();
        renderMessages();
        input.value = '';
    } catch (error) {
        console.error("Mesaj gönderilemedi:", error);
        alert("Mesaj gönderilemedi.");
    }
}

function handleProfileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        tempProfilePic = e.target.result;
        document.getElementById('settings-preview-pic').src = tempProfilePic;
    };
    reader.readAsDataURL(file);
}

function handleStoryUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const desc = prompt("Açıklama:");
    const reader = new FileReader();

    reader.onload = (e) => {
        const story = {
            owner: myData.nick,
            text: desc || "",
            media: e.target.result,
            type: file.type.startsWith('video') ? 'video' : 'image',
            time: Date.now()
        };

        myStories.unshift(story);
        localStorage.setItem('wos_stories', JSON.stringify(myStories));
        renderStories();
    };

    reader.readAsDataURL(file);
}

function openSettings() {
    document.getElementById('edit-nick').value = myData.nick;
    document.getElementById('settings-preview-pic').src = myData.pic || "";
    tempProfilePic = myData.pic || "";
    showScreen('settings-screen');
}

function saveSettings() {
    const newNick = document.getElementById('edit-nick').value.trim();

    myData.nick = newNick || myData.nick;
    myData.pic = tempProfilePic || "";

    localStorage.setItem('wos_me', JSON.stringify(myData));
    loadMain();
    showScreen('main-screen');
}

function loadMain() {
    showScreen('main-screen');

    const imgHtml = myData.pic
        ? `<img src="${myData.pic}" class="profile-pic">`
        : '<div class="profile-pic"></div>';

    document.getElementById('user-info').innerHTML = `
        ${imgHtml}
        <div>
            <b>${escapeHtml(myData.nick)}</b><br>
            <span class="id-text">${escapeHtml(myData.id.replace("WOS-", ""))}</span>
        </div>
    `;

    renderContacts();
    renderStories();
}

function handleSearch(event) {
    if (event.key !== 'Enter') return;

    const input = document.getElementById('search-id');
    const num = input.value.trim();

    if (!/^\d{10}$/.test(num)) {
        alert("10 haneli numara girin.");
        return;
    }

    const sid = "WOS-" + num;

    if (sid === myData.id) {
        alert("Kendinizi ekleyemezsiniz.");
        return;
    }

    const existing = myFriends.find(f => f.id === sid);
    if (!existing) {
        myFriends.push({
            id: sid,
            nick: num,
            messages: [],
            pic: "",
            isBlocked: false
        });
        saveFriends();
        renderContacts();
    }

    input.value = '';
}

function setupConnEvents(conn) {
    conn.on('open', () => {
        document.getElementById('conn-status').innerText = "Çevrimiçi";

        try {
            conn.send({
                type: 'profile_sync',
                nick: myData.nick,
                pic: myData.pic
            });
        } catch (e) {
            console.error("Profil senkronizasyonu gönderilemedi:", e);
        }
    });

    conn.on('data', (data) => {
        if (typeof data === 'object' && data !== null && data.type === 'profile_sync') {
            updateFriendProfile(conn.peer, data);
        } else {
            handleIncomingMsg(conn.peer, data);
        }
    });

    conn.on('close', () => {
        document.getElementById('conn-status').innerText = "Çevrimdışı";
    });

    conn.on('error', () => {
        document.getElementById('conn-status').innerText = "Bağlantı hatası";
    });
}

function updateFriendProfile(peerId, data) {
    const friend = myFriends.find(f => f.id === peerId);
    if (!friend) return;

    if (data.nick && !friend.customName) {
        friend.nick = data.nick;
    }

    if (typeof data.pic !== 'undefined') {
        friend.pic = data.pic;
    }

    saveFriends();

    if (currentChatIndex !== null && myFriends[currentChatIndex]?.id === peerId) {
        const avatar = document.getElementById('chat-avatar');
        if (data.pic) {
            avatar.src = data.pic;
            avatar.style.display = "block";
        } else {
            avatar.style.display = "none";
        }

        document.getElementById('chat-title').innerText = friend.nick;
    }

    renderContacts();
}

function handleIncomingMsg(peerId, text) {
    const friend = myFriends.find(f => f.id === peerId);
    if (!friend || friend.isBlocked) return;

    if (!Array.isArray(friend.messages)) {
        friend.messages = [];
    }

    friend.messages.push({
        text: String(text),
        type: 'received'
    });

    saveFriends();

    if (currentChatIndex !== null && myFriends[currentChatIndex]?.id === peerId) {
        renderMessages();
    }
}

function renderMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    if (currentChatIndex === null || !myFriends[currentChatIndex]) return;

    const messages = myFriends[currentChatIndex].messages || [];

    messages.forEach(m => {
        const bubble = document.createElement('div');
        bubble.className = `bubble ${m.type}`;
        bubble.textContent = m.text;
        container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
}

function renderStories() {
    const list = document.getElementById('story-list');

    list.innerHTML = `
        <div class="story-circle" onclick="document.getElementById('story-upload').click()">+ Durum</div>
        <input type="file" id="story-upload" class="file-input" accept="image/*,video/*" onchange="handleStoryUpload(this)">
    `;

    myStories.slice(0, 10).forEach(s => {
        const storyDiv = document.createElement('div');
        storyDiv.className = 'story-circle';

        if (s.type === 'image') {
            storyDiv.style.backgroundImage = `url('${s.media}')`;
            storyDiv.style.backgroundSize = 'cover';
            storyDiv.style.backgroundPosition = 'center';
        } else {
            storyDiv.style.background = '#00a884';
        }

        storyDiv.onclick = () => {
            alert(`${s.owner}: ${s.text}`);
        };

        const overlay = document.createElement('div');
        overlay.className = 'story-overlay';
        overlay.textContent = s.owner;

        storyDiv.appendChild(overlay);
        list.appendChild(storyDiv);
    });
}

function saveFriends() {
    localStorage.setItem('wos_friends', JSON.stringify(myFriends));
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
    }
}

function goBack() {
    currentChatIndex = null;
    showScreen('main-screen');
}

function logout() {
    if (confirm("Tüm veriler silinecek?")) {
        localStorage.clear();
        location.reload();
    }
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
                }
        
