// --- VERİ VE SİSTEM AYARLARI ---
let myData = JSON.parse(localStorage.getItem('wos_me')) || null;
let myFriends = JSON.parse(localStorage.getItem('wos_friends')) || [];
let myStories = JSON.parse(localStorage.getItem('wos_stories')) || [];
let currentChatIndex = null;
let peer, activeConn, mediaRecorder, audioChunks = [];

// Arama Değişkenleri
let currentCall = null;
let localStream = null;
let isMuted = false;
let remoteAudio = new Audio(); // Sesi çalmak için global obje

// --- DİNAMİK CSS ---
const style = document.createElement('style');
style.textContent = `
    body { font-family: 'Segoe UI', sans-serif; background: #111b21; color: #e9edef; margin: 0; display: flex; justify-content: center; height: 100vh; overflow: hidden; }
    #app { width: 100%; max-width: 450px; background: #222e35; display: flex; flex-direction: column; position: relative; }
    .screen { display: none; flex-direction: column; height: 100%; width: 100%; }
    .active { display: flex; }
    header { background: #202c33; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313d45; }
    .btn { background: #00a884; color: #111b21; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; }
    #chat-messages { flex: 1; padding: 15px; overflow-y: auto; background: #0b141a; display: flex; flex-direction: column; }
    .bubble { padding: 10px; border-radius: 8px; margin: 5px 0; max-width: 75%; }
    .sent { background: #005c4b; align-self: flex-end; }
    .received { background: #202c33; align-self: flex-start; }
    .call-info { align-self: center; background: rgba(255,255,255,0.1); font-size: 11px; padding: 5px 15px; border-radius: 20px; color: #8696a0; margin: 10px 0; }
    .stories { display: flex; padding: 10px; gap: 10px; overflow-x: auto; background: #111b21; border-bottom: 1px solid #313d45; }
    .story-circle { min-width: 60px; height: 60px; border-radius: 50%; border: 2px solid #00a884; background-size: cover; background-position: center; position: relative; cursor: pointer; flex-shrink: 0; }
    #splash { background: #111b21; align-items: center; justify-content: center; text-align: center; }
`;
document.head.appendChild(style);

// --- ARAYÜZ OLUŞTURMA ---
document.getElementById('app').innerHTML = `
    <div id="splash" class="screen active">
        <img src="acilis.webp" style="width:120px; border-radius:20px; margin-bottom:20px;">
        <h1 style="color:#00a884">Wosunacth</h1>
    </div>
    
    <div id="login-screen" class="screen" style="padding:40px; justify-content:center;">
        <h1 style="text-align:center; color:#00a884">Wosunacth</h1>
        <p style="text-align:center">10 haneli numaranızı girin</p>
        <input type="number" id="login-num" style="width:100%; padding:12px; border-radius:8px; border:none; background:#2a3942; color:white;">
        <button class="btn" onclick="startApp()" style="width:100%; margin-top:20px; height:45px;">Giriş Yap</button>
    </div>
    
    <div id="main-screen" class="screen">
        <header><div id="user-info"></div><button class="btn" onclick="logout()">Çıkış</button></header>
        <div class="stories" id="story-list"></div>
        <div style="padding:10px;"><input type="number" id="search-id" placeholder="ID ile kişi ekle..." onkeypress="handleSearch(event)" style="width:100%; padding:10px; border-radius:8px; border:none; background:#111b21; color:white;"></div>
        <div id="contact-list" style="flex:1; overflow-y:auto;"></div>
    </div>
    
    <div id="chat-screen" class="screen">
        <header>
            <button class="btn" onclick="goBack()" style="font-size:20px;">←</button>
            <div id="chat-title" style="flex:1; margin-left:10px; font-weight:bold;"></div>
            <button class="btn" onclick="makeCall()" style="background:#25d366; font-size:18px;">📞</button>
        </header>
        <div id="chat-messages"></div>
        <div id="chat-footer" style="padding:10px; background:#202c33; display:flex; gap:8px;">
            <input type="text" id="msg-input" placeholder="Mesaj..." style="flex:1; border:none; border-radius:5px; padding:8px; background:#2a3942; color:white;">
            <button class="btn" onmousedown="startVoice()" onmouseup="stopVoice()">🎤</button>
            <button class="btn" onclick="sendText()">➤</button>
        </div>
    </div>

    <div id="call-screen" class="screen" style="background:#111b21; justify-content:center; align-items:center; text-align:center;">
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
            <h2 id="call-number" style="color:#00a884; font-size:35px; margin-bottom:10px;">Numara</h2>
            <p id="call-status" style="color:#8696a0; font-size:18px; margin-bottom:40px;">Aranıyor...</p>
        </div>
        
        <div style="padding-bottom:50px;">
            <div id="call-incoming-btns" style="display:none; gap:40px; justify-content:center;">
                <button class="btn" style="background:#ea0038; width:70px; height:70px; border-radius:50%; font-size:28px;" onclick="rejectCall()">✖</button>
                <button class="btn" style="background:#25d366; width:70px; height:70px; border-radius:50%; font-size:28px;" onclick="acceptCall()">📞</button>
            </div>
            
            <div id="call-active-btns" style="display:none; gap:40px; justify-content:center;">
                <button class="btn" id="mute-btn" style="background:#313d45; color:white; width:70px; height:70px; border-radius:50%; font-size:24px;" onclick="toggleMute()">🎤</button>
                <button class="btn" style="background:#ea0038; width:70px; height:70px; border-radius:50%; font-size:28px;" onclick="endCall()">✖</button>
            </div>
        </div>
    </div>

    <input type="file" id="file-up" style="display:none" onchange="processFile(this)">
`;

// --- SİSTEM MANTIĞI ---
window.onload = () => {
    setTimeout(() => {
        document.getElementById('splash').classList.remove('active');
        if (myData) { initPeer(); loadMain(); } 
        else { showScreen('login-screen'); }
    }, 2500);
};

function startApp() {
    const num = document.getElementById('login-num').value;
    if (num.length !== 10) return alert("Hatalı numara!");
    myData = { nick: num, id: "WOS-" + num };
    localStorage.setItem('wos_me', JSON.stringify(myData));
    initPeer(); loadMain();
}

function initPeer() {
    peer = new Peer(myData.id);
    peer.on('connection', conn => {
        activeConn = conn;
        conn.on('data', data => handleIncomingData(conn.peer, data));
    });

    // BİRİSİ ARAYINCA
    peer.on('call', call => {
        currentCall = call;
        let f = myFriends.find(x => x.id === call.peer);
        let callerName = f ? f.nick : call.peer.replace("WOS-", "");
        
        showCallUI(callerName, "Gelen Arama...", 'incoming');
    });
}

// --- YENİ EKLENEN ARAMA SİSTEMİ FONKSİYONLARI ---
async function makeCall() {
    try {
        const s = await navigator.mediaDevices.getUserMedia({audio:true});
        localStream = s;
        const targetFriend = myFriends[currentChatIndex];
        
        showCallUI(targetFriend.nick, "Aranıyor...", 'active');
        currentCall = peer.call(targetFriend.id, s);
        logCall(targetFriend.id, "Giden Arama");
        
        setupCallEvents(currentCall);
    } catch (e) {
        alert("Mikrofona erişilemedi!");
    }
}

function acceptCall() {
    navigator.mediaDevices.getUserMedia({audio:true}).then(s => {
        localStream = s;
        currentCall.answer(s);
        showCallUI(document.getElementById('call-number').innerText, "Görüşülüyor...", 'active');
        logCall(currentCall.peer, "Gelen Arama (Kabul Edildi)");
        setupCallEvents(currentCall);
    }).catch(() => alert("Mikrofon hatası!"));
}

function rejectCall() {
    if(currentCall) { currentCall.close(); }
    logCall(currentCall.peer, "Cevapsız Arama");
    closeCallUI();
}

function endCall() {
    if(currentCall) { currentCall.close(); }
    closeCallUI();
}

function toggleMute() {
    if(localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks()[0].enabled = !isMuted;
        
        const muteBtn = document.getElementById('mute-btn');
        muteBtn.style.background = isMuted ? "white" : "#313d45";
        muteBtn.innerText = isMuted ? "🔇" : "🎤";
    }
}

function setupCallEvents(call) {
    call.on('stream', rs => {
        remoteAudio.srcObject = rs;
        remoteAudio.play();
        document.getElementById('call-status').innerText = "Görüşülüyor...";
    });
    call.on('close', closeCallUI);
    call.on('error', closeCallUI);
}

function showCallUI(name, status, mode) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('call-screen').classList.add('active');
    
    document.getElementById('call-number').innerText = name;
    document.getElementById('call-status').innerText = status;
    
    if(mode === 'incoming') {
        document.getElementById('call-incoming-btns').style.display = 'flex';
        document.getElementById('call-active-btns').style.display = 'none';
    } else {
        document.getElementById('call-incoming-btns').style.display = 'none';
        document.getElementById('call-active-btns').style.display = 'flex';
        isMuted = false;
        document.getElementById('mute-btn').style.background = "#313d45";
        document.getElementById('mute-btn').innerText = "🎤";
    }
}

function closeCallUI() {
    if(localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    currentCall = null;
    remoteAudio.srcObject = null;
    
    // Arama bittiğinde sohbet açıksa sohbete dön, yoksa ana ekrana dön
    if (currentChatIndex !== null) {
        showScreen('chat-screen');
    } else {
        showScreen('main-screen');
    }
}

function logCall(pId, txt) {
    let f = myFriends.find(x => x.id === pId);
    if(f) { 
        f.messages.push({type:'call', text: txt + " (" + new Date().toLocaleTimeString().slice(0,5) + ")"}); 
        save(); 
        if(currentChatIndex !== null) renderMessages(); 
    }
}

// --- SESLİ MESAJ VE NORMAL MESAJLAŞMA ---
async function startVoice() {
    const s = await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder = new MediaRecorder(s);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, {type:'audio/ogg'});
        const r = new FileReader();
        r.onload = () => {
            const data = { type: 'audio', content: r.result };
            if(activeConn) activeConn.send(data);
            saveMsg(currentChatIndex, data, 'sent');
        };
        r.readAsDataURL(blob);
    };
    mediaRecorder.start();
}
function stopVoice() { if(mediaRecorder) mediaRecorder.stop(); }

function sendText() {
    const val = document.getElementById('msg-input').value;
    if(!val || !activeConn) return;
    activeConn.send(val);
    saveMsg(currentChatIndex, val, 'sent');
    document.getElementById('msg-input').value = "";
}

function handleIncomingData(pId, data) {
    let f = myFriends.find(x => x.id === pId);
    if(!f) { f = {id: pId, nick: pId.replace("WOS-",""), messages: []}; myFriends.push(f); renderContacts(); }
    f.messages.push(data.type === 'audio' ? {audio: data.content, type:'received'} : {text: data, type:'received'});
    save(); if(currentChatIndex !== null) renderMessages();
}

function saveMsg(idx, content, side) {
    const msg = typeof content === 'string' ? {text: content, type: side} : {audio: content.content, type: side};
    myFriends[idx].messages.push(msg);
    save(); renderMessages();
}

// --- DURUM / STORY SİSTEMİ ---
function processFile(input) {
    const file = input.files[0];
    if(!file) return;
    const desc = prompt("Açıklama yazın:");
    const reader = new FileReader();
    reader.onload = (e) => {
        myStories.unshift({id: Date.now(), nick: myData.nick, media: e.target.result, text: desc || "", type: file.type.startsWith('video') ? 'video' : 'image'});
        localStorage.setItem('wos_stories', JSON.stringify(myStories)); renderStories();
    };
    reader.readAsDataURL(file);
}

function renderStories() {
    const list = document.getElementById('story-list');
    list.innerHTML = `<div class="story-circle" onclick="document.getElementById('file-up').click()" style="display:flex; align-items:center; justify-content:center; border:2px dashed #8696a0; font-size:24px;">+</div>`;
    myStories.forEach(s => {
        const div = document.createElement('div');
        div.className = 'story-circle';
        div.style.backgroundImage = s.type === 'image' ? `url(${s.media})` : 'none';
        div.style.backgroundColor = s.type === 'video' ? '#00a884' : '';
        div.onclick = () => alert(`${s.nick}:\n${s.text}`);
        
        const del = document.createElement('div');
        del.innerHTML = "°°°";
        del.style = "position:absolute; top:-5px; right:0; font-weight:bold; color:white; text-shadow: 1px 1px 2px black;";
        del.onclick = (e) => { e.stopPropagation(); if(confirm("Silinsin mi?")) { myStories = myStories.filter(x => x.id !== s.id); localStorage.setItem('wos_stories', JSON.stringify(myStories)); renderStories(); }};
        
        div.appendChild(del);
        list.appendChild(div);
    });
}

// --- YARDIMCI VE YÖNLENDİRME FONKSİYONLARI ---
function renderContacts() {
    const list = document.getElementById('contact-list');
    list.innerHTML = "";
    myFriends.forEach((f, i) => {
        list.innerHTML += `<div onclick="openChat(${i})" style="padding:15px; border-bottom:1px solid #313d45; cursor:pointer;"><b>${f.nick}</b><br><small>${f.id}</small></div>`;
    });
}

function renderMessages() {
    const box = document.getElementById('chat-messages');
    box.innerHTML = "";
    myFriends[currentChatIndex].messages.forEach(m => {
        if(m.type === 'call') box.innerHTML += `<div class="call-info">${m.text}</div>`;
        else if(m.audio) box.innerHTML += `<div class="bubble ${m.type}"><audio controls src="${m.audio}" style="width:100%; height:40px;"></audio></div>`;
        else box.innerHTML += `<div class="bubble ${m.type}">${m.text}</div>`;
    });
    box.scrollTop = box.scrollHeight;
}

function openChat(i) { currentChatIndex = i; showScreen('chat-screen'); document.getElementById('chat-title').innerText = myFriends[i].nick; activeConn = peer.connect(myFriends[i].id); renderMessages(); }
function handleSearch(e) { if(e.key === 'Enter') { const id = "WOS-"+e.target.value; if(!myFriends.find(x=>x.id===id)) { myFriends.push({id, nick: e.target.value, messages:[]}); save(); renderContacts(); } e.target.value=""; } }
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function loadMain() { showScreen('main-screen'); document.getElementById('user-info').innerText = myData.nick; renderContacts(); renderStories(); }
function save() { localStorage.setItem('wos_friends', JSON.stringify(myFriends)); }

// DÜZELTİLDİ: Geri Çıkma Butonu
function goBack() { 
    currentChatIndex = null; 
    showScreen('main-screen'); 
}

function logout() { if(confirm("Her şey silinecek!")) { localStorage.clear(); location.reload(); } }
