// --- SİSTEM DEĞİŞKENLERİ ---
let myData = JSON.parse(localStorage.getItem('wos_me')) || null;
let myFriends = JSON.parse(localStorage.getItem('wos_friends')) || [];
let myStories = JSON.parse(localStorage.getItem('wos_stories')) || [];
let currentChatIndex = null;
let peer, activeConn, mediaRecorder, audioChunks = [];

// --- CSS STİLLERİNİ ENJEKTE ET ---
const style = document.createElement('style');
style.textContent = `
    body { font-family: 'Segoe UI', sans-serif; background: #111b21; color: #e9edef; margin: 0; display: flex; justify-content: center; height: 100vh; }
    #app { width: 100%; max-width: 450px; background: #222e35; position: relative; overflow: hidden; display: flex; flex-direction: column; }
    .screen { display: none; flex-direction: column; height: 100%; width: 100%; }
    .active { display: flex; }
    header { background: #202c33; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313d45; }
    .btn { background: #00a884; color: #111b21; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-weight: bold; }
    .btn-call { background: #25d366; margin-left: 5px; }
    #chat-messages { flex: 1; padding: 15px; overflow-y: auto; background: #0b141a; display: flex; flex-direction: column; }
    .bubble { padding: 10px; border-radius: 8px; margin: 5px 0; max-width: 75%; position: relative; }
    .sent { background: #005c4b; align-self: flex-end; }
    .received { background: #202c33; align-self: flex-start; }
    .call-msg { font-style: italic; color: #8696a0; font-size: 12px; border: 1px solid #313d45; text-align: center; align-self: center; background: none; }
    #splash { background: #111b21; align-items: center; justify-content: center; text-align: center; position: absolute; inset: 0; z-index: 999; }
    #splash img { width: 150px; height: 150px; border-radius: 20px; margin-bottom: 20px; }
    .story-circle { min-width: 60px; height: 60px; border-radius: 50%; border: 2px solid #00a884; background-size: cover; cursor: pointer; flex-shrink: 0; }
`;
document.head.appendChild(style);

// --- ARAYÜZ OLUŞTURMA ---
const app = document.getElementById('app');
app.innerHTML = `
    <div id="splash" class="screen active">
        <img src="açılış.webp" alt="Logo">
        <h1 style="color:#00a884">Wosunacth</h1>
    </div>
    <div id="main-screen" class="screen">
        <header><div id="user-info"></div><button class="btn" onclick="showSettings()">⚙️</button></header>
        <div id="story-list" style="display:flex; padding:10px; gap:10px; overflow-x:auto; background:#111b21;"></div>
        <div style="padding:10px;"><input type="number" id="search-input" placeholder="Numara Ekle..." onkeypress="handleSearch(event)"></div>
        <div id="contact-list" style="flex:1; overflow-y:auto;"></div>
    </div>
    <div id="chat-screen" class="screen">
        <header>
            <button class="btn" onclick="goBack()">←</button>
            <div id="chat-title" style="flex:1; margin-left:10px;"></div>
            <button class="btn btn-call" onclick="startCall()">📞</button>
        </header>
        <div id="chat-messages"></div>
        <div style="padding:10px; display:flex; gap:5px; background:#202c33;">
            <input type="text" id="msg-input" placeholder="Mesaj..." style="flex:1; padding:8px; border-radius:5px; border:none;">
            <button class="btn" onmousedown="startVoiceMsg()" onmouseup="stopVoiceMsg()">🎤</button>
            <button class="btn" onclick="sendTextMsg()">➤</button>
        </div>
    </div>
`;

// --- CORE FONKSİYONLAR ---
window.onload = () => {
    setTimeout(() => {
        document.getElementById('splash').classList.remove('active');
        if (myData) { initPeer(); showScreen('main-screen'); renderContacts(); } 
        else { loginPrompt(); }
    }, 3000);
};

function loginPrompt() {
    let num = prompt("10 Haneli numaranız:");
    if(num && num.length === 10) {
        myData = { id: "WOS-" + num, nick: num, pic: "" };
        localStorage.setItem('wos_me', JSON.stringify(myData));
        location.reload();
    }
}

function initPeer() {
    peer = new Peer(myData.id);
    peer.on('open', () => console.log("Bağlanıldı: " + myData.id));
    
    // Mesaj alma
    peer.on('connection', (conn) => {
        activeConn = conn;
        conn.on('data', (data) => handleData(conn.peer, data));
    });

    // Arama alma
    peer.on('call', (call) => {
        if(confirm("Gelen Arama! Kabul edilsin mi?")) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                call.answer(stream);
                handleCall(call);
                addCallRecord(call.peer, "Gelen Arama (Kabul Edildi)");
            });
        } else {
            addCallRecord(call.peer, "Cevapsız Arama");
        }
    });
}

// --- SESLİ MESAJ SİSTEMİ ---
async function startVoiceMsg() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/ogg' });
        const reader = new FileReader();
        reader.onload = () => {
            sendData({ type: 'audio', content: reader.result });
            addMsgToUI({ type: 'audio', content: reader.result, side: 'sent' });
        };
        reader.readAsDataURL(blob);
    };
    mediaRecorder.start();
}
function stopVoiceMsg() { mediaRecorder.stop(); }

// --- SESLİ ARAMA SİSTEMİ ---
async function startCall() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const call = peer.call(myFriends[currentChatIndex].id, stream);
    addCallRecord(myFriends[currentChatIndex].id, "Giden Arama");
    handleCall(call);
}

function handleCall(call) {
    call.on('stream', remoteStream => {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play();
    });
}

function addCallRecord(peerId, type) {
    const friend = myFriends.find(f => f.id === peerId);
    if(friend) {
        const time = new Date().toLocaleTimeString();
        const msg = { type: 'call', content: `${type} - ${time}`, side: 'center' };
        friend.messages.push(msg);
        save();
        if(currentChatIndex !== null) renderMessages();
    }
}

// --- MESAJLAŞMA VE VERİ ---
function sendTextMsg() {
    const val = document.getElementById('msg-input').value;
    if(!val) return;
    sendData({ type: 'text', content: val });
    addMsgToUI({ type: 'text', content: val, side: 'sent' });
    document.getElementById('msg-input').value = "";
}

function sendData(data) {
    const friend = myFriends[currentChatIndex];
    const conn = peer.connect(friend.id);
    conn.on('open', () => conn.send(data));
}

function handleData(senderPeer, data) {
    const friend = myFriends.find(f => f.id === senderPeer);
    if(friend) {
        const msg = { type: data.type, content: data.content, side: 'received' };
        friend.messages.push(msg);
        save();
        if(currentChatIndex !== null && myFriends[currentChatIndex].id === senderPeer) renderMessages();
    }
}

function addMsgToUI(msg) {
    myFriends[currentChatIndex].messages.push(msg);
    save();
    renderMessages();
}

function renderMessages() {
    const box = document.getElementById('chat-messages');
    box.innerHTML = "";
    myFriends[currentChatIndex].messages.forEach(m => {
        if(m.type === 'text') {
            box.innerHTML += `<div class="bubble ${m.side}">${m.content}</div>`;
        } else if(m.type === 'audio') {
            box.innerHTML += `<div class="bubble ${m.side}"><audio controls src="${m.content}"></audio></div>`;
        } else if(m.type === 'call') {
            box.innerHTML += `<div class="bubble call-msg">${m.content}</div>`;
        }
    });
    box.scrollTop = box.scrollHeight;
}

// --- YARDIMCI FONKSİYONLAR ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function renderContacts() {
    const list = document.getElementById('contact-list');
    list.innerHTML = "";
    myFriends.forEach((f, i) => {
        list.innerHTML += `<div onclick="openChat(${i})" style="padding:15px; border-bottom:1px solid #313d45; cursor:pointer;">
            <b>${f.nick}</b><br><small>${f.id}</small>
        </div>`;
    });
}

function openChat(i) {
    currentChatIndex = i;
    document.getElementById('chat-title').innerText = myFriends[i].nick;
    showScreen('chat-screen');
    renderMessages();
}

function handleSearch(e) {
    if(e.key === 'Enter') {
        const num = e.target.value;
        const id = "WOS-" + num;
        if(!myFriends.find(f => f.id === id)) {
            myFriends.push({ id, nick: num, messages: [] });
            save();
            renderContacts();
        }
        e.target.value = "";
    }
}

function goBack() { currentChatIndex = null; showScreen('main-screen'); }
function save() { localStorage.setItem('wos_friends', JSON.stringify(myFriends)); }
