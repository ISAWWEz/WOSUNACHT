// --- DEĞİŞKENLER VE STORAGE ---
let myData = JSON.parse(localStorage.getItem('wos_me')) || null;
let myFriends = JSON.parse(localStorage.getItem('wos_friends')) || [];
let myStories = JSON.parse(localStorage.getItem('wos_stories')) || [];
let currentChatIndex = null;
let modalTargetIndex = null;
let peer, activeConn, mediaRecorder, audioChunks = [];

// --- CSS ENJEKSİYONU ---
const style = document.createElement('style');
style.textContent = `
    body { font-family: 'Segoe UI', sans-serif; background: #111b21; color: #e9edef; margin: 0; display: flex; justify-content: center; height: 100vh; }
    #app { width: 100%; max-width: 450px; background: #222e35; display: flex; flex-direction: column; position: relative; overflow: hidden; }
    .screen { display: none; flex-direction: column; height: 100%; }
    .active { display: flex; }
    header { background: #202c33; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313d45; }
    .btn { background: #00a884; color: #111b21; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; }
    .btn-danger { background: #ea0038; color: white; }
    .search-box { padding: 10px; background: #111b21; }
    input { width: 100%; padding: 10px; background: #2a3942; border: none; color: white; border-radius: 8px; box-sizing: border-box; outline: none; }
    .list-container { flex: 1; overflow-y: auto; }
    .item { padding: 15px; border-bottom: 1px solid #313d45; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    #chat-messages { flex: 1; padding: 15px; overflow-y: auto; background-color: #0b141a; display: flex; flex-direction: column; }
    .bubble { padding: 8px 12px; border-radius: 8px; margin: 5px 0; max-width: 70%; word-wrap: break-word; }
    .sent { background: #005c4b; align-self: flex-end; }
    .received { background: #202c33; align-self: flex-start; }
    .call-record { align-self: center; background: rgba(255,255,255,0.1); font-size: 11px; padding: 4px 10px; border-radius: 10px; color: #8696a0; }
    .stories { display: flex; padding: 10px; gap: 10px; overflow-x: auto; background: #111b21; border-bottom: 1px solid #313d45; }
    .story-circle { min-width: 55px; height: 55px; border-radius: 50%; border: 2px solid #00a884; position: relative; background-size: cover; cursor: pointer; }
    .story-overlay { position: absolute; bottom: 0; background: rgba(0,0,0,0.5); width: 100%; font-size: 8px; text-align: center; }
    #friend-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; justify-content: center; align-items: center; }
    .modal-content { background: #222e35; padding: 25px; border-radius: 15px; width: 80%; text-align: center; }
    .profile-pic { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #313d45; }
`;
document.head.appendChild(style);

// --- HTML YAPISI OLUŞTURMA ---
const app = document.getElementById('app');
app.innerHTML = `
    <div id="friend-modal"><div class="modal-content"><h3 id="modal-title"></h3><button class="btn" onclick="modalRename()" style="width:100%; margin-bottom:10px;">Yeniden Adlandır</button><button id="block-btn" class="btn btn-danger" onclick="modalToggleBlock()" style="width:100%; margin-bottom:10px;">Engelle</button><button class="btn" onclick="closeModal()" style="width:100%; background:#313d45; color:white;">İptal</button></div></div>
    <div id="splash-screen" class="screen active" style="align-items:center; justify-content:center;"><img src="acilis.webp" style="width:150px; border-radius:20px; margin-bottom:20px;"><h1 style="color:#00a884;">Wosunacth</h1></div>
    <div id="login-screen" class="screen" style="padding:40px; justify-content:center; text-align:center;"><h1>Wosunacth</h1><p>10 haneli numaranız</p><input type="number" id="my-num-in" placeholder="5xxxxxxxxx"><button class="btn" onclick="startApp()" style="margin-top:20px; width:100%;">Giriş Yap</button></div>
    <div id="main-screen" class="screen">
        <header><div id="user-info" style="display:flex; align-items:center;"></div><div onclick="openSettings()" style="cursor:pointer;">⚙️</div></header>
        <div class="stories" id="story-list"></div>
        <div class="search-box"><input type="number" id="search-id" placeholder="Numara ile kişi ekle..." onkeypress="handleSearch(event)"></div>
        <div class="list-container" id="contact-list"></div>
    </div>
    <div id="chat-screen" class="screen">
        <header><button class="btn" onclick="goBack()">←</button><div id="chat-title" style="flex:1; margin-left:10px;"></div><button class="btn" onclick="startVoiceCall()" style="background:#25d366;">📞</button></header>
        <div id="chat-messages"></div>
        <div id="chat-footer" style="padding:10px; background:#202c33; display:flex; gap:5px;">
            <input type="text" id="msg-input" placeholder="Mesaj..." style="flex:1;">
            <button class="btn" onmousedown="startVoiceRec()" onmouseup="stopVoiceRec()">🎤</button>
            <button class="btn" onclick="sendMsg()">➤</button>
        </div>
    </div>
    <div id="settings-screen" class="screen" style="padding:20px; text-align:center;">
        <header><button class="btn" onclick="showScreen('main-screen')">←</button><span>Ayarlar</span><span></span></header>
        <img id="set-prev" class="profile-pic" style="width:100px; height:100px; margin-top:20px;">
        <input type="file" id="p-up" style="display:none;" onchange="handlePUp(this)"><button class="btn" onclick="document.getElementById('p-up').click()" style="display:block; width:100%; margin-top:10px;">Resim Seç</button>
        <input type="text" id="set-nick" style="margin-top:20px;" placeholder="İsim">
        <button class="btn" onclick="saveSettings()" style="width:100%; margin-top:20px;">Kaydet</button>
        <button class="btn btn-danger" onclick="logout()" style="width:100%; margin-top:10px;">Hesabı Sil</button>
    </div>
    <input type="file" id="s-up" style="display:none;" onchange="handleSUp(this)">
`;

// --- MANTIK VE FONKSİYONLAR ---
window.onload = () => {
    setTimeout(() => {
        if (myData) { initPeer(); loadMain(); } 
        else { showScreen('login-screen'); }
    }, 2000);
};

function startApp() {
    const num = document.getElementById('my-num-in').value;
    if (num.length !== 10) return alert("10 hane girin!");
    myData = { nick: num, id: "WOS-" + num, pic: "" };
    localStorage.setItem('wos_me', JSON.stringify(myData));
    location.reload();
}

function initPeer() {
    peer = new Peer(myData.id);
    peer.on('connection', conn => {
        activeConn = conn;
        conn.on('data', data => {
            const friend = myFriends.find(f => f.id === conn.peer);
            if(friend && friend.isBlocked) return;
            if(data.type === 'audio') { handleIncomingAudio(conn.peer, data.content); }
            else { handleIncomingMsg(conn.peer, data); }
        });
    });
    peer.on('call', call => {
        if(confirm("Gelen Arama!")) {
            navigator.mediaDevices.getUserMedia({audio:true}).then(s => {
                call.answer(s);
                handleCallStream(call);
                addCallMsg(call.peer, "Gelen Arama (Kabul Edildi)");
            });
        }
    });
}

// --- SESLİ MESAJ VE ARAMA ---
async function startVoiceRec() {
    const s = await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder = new MediaRecorder(s);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
        const b = new Blob(audioChunks, {type:'audio/ogg'});
        const r = new FileReader();
        r.onload = () => {
            if(activeConn) activeConn.send({type:'audio', content: r.result});
            myFriends[currentChatIndex].messages.push({audio: r.result, type:'sent'});
            save(); renderMessages();
        };
        r.readAsDataURL(b);
    };
    mediaRecorder.start();
}
function stopVoiceRec() { if(mediaRecorder) mediaRecorder.stop(); }

async function startVoiceCall() {
    const s = await navigator.mediaDevices.getUserMedia({audio:true});
    const call = peer.call(myFriends[currentChatIndex].id, s);
    addCallMsg(myFriends[currentChatIndex].id, "Giden Arama");
    handleCallStream(call);
}

function handleCallStream(call) {
    call.on('stream', rs => { const a = new Audio(); a.srcObject = rs; a.play(); });
}

function addCallMsg(pId, txt) {
    const f = myFriends.find(x => x.id === pId);
    if(f) { f.messages.push({text: txt, type:'call-record'}); save(); if(currentChatIndex !== null) renderMessages(); }
}

// --- DURUM YÖNETİMİ ---
function handleSUp(input) {
    const f = input.files[0];
    const desc = prompt("Açıklama:");
    const r = new FileReader();
    r.onload = (e) => {
        myStories.unshift({id: Date.now(), owner: myData.nick, text: desc||"", media: e.target.result, type: f.type.startsWith('video')?'video':'image'});
        localStorage.setItem('wos_stories', JSON.stringify(myStories)); renderStories();
    };
    r.readAsDataURL(f);
}

function renderStories() {
    const l = document.getElementById('story-list');
    l.innerHTML = `<div class="story-circle" onclick="document.getElementById('s-up').click()" style="display:flex; align-items:center; justify-content:center; border:2px dashed #8696a0;">+</div>`;
    myStories.forEach(s => {
        const d = document.createElement('div');
        d.className = 'story-circle';
        d.style.backgroundImage = s.type==='image'?`url(${s.media})`:'none';
        d.onclick = () => alert(s.text);
        const del = document.createElement('div');
        del.innerHTML = "°°°";
        del.style = "position:absolute; top:-5px; right:-5px; color:white; font-weight:bold;";
        del.onclick = (e) => { e.stopPropagation(); if(confirm("Sil?")) { myStories = myStories.filter(x => x.id !== s.id); localStorage.setItem('wos_stories', JSON.stringify(myStories)); renderStories(); }};
        d.appendChild(del);
        d.innerHTML += `<div class="story-overlay">${s.owner}</div>`;
        l.appendChild(d);
    });
}

// --- STANDART FONKSİYONLAR ---
function sendMsg() {
    const i = document.getElementById('msg-input');
    if(!i.value || !activeConn) return;
    activeConn.send(i.value);
    myFriends[currentChatIndex].messages.push({text: i.value, type:'sent'});
    save(); renderMessages(); i.value = '';
}

function handleIncomingMsg(pId, msg) {
    const f = myFriends.find(x => x.id === pId);
    if(f) { f.messages.push({text: msg, type:'received'}); save(); if(currentChatIndex !== null) renderMessages(); }
}

function handleIncomingAudio(pId, aud) {
    const f = myFriends.find(x => x.id === pId);
    if(f) { f.messages.push({audio: aud, type:'received'}); save(); if(currentChatIndex !== null) renderMessages(); }
}

function renderMessages() {
    const c = document.getElementById('chat-messages');
    c.innerHTML = '';
    myFriends[currentChatIndex].messages.forEach(m => {
        if(m.audio) { c.innerHTML += `<div class="bubble ${m.type}"><audio controls src="${m.audio}" style="width:100%;"></audio></div>`; }
        else { c.innerHTML += `<div class="bubble ${m.type}">${m.text}</div>`; }
    });
    c.scrollTop = c.scrollHeight;
}

function openChat(i) { currentChatIndex = i; showScreen('chat-screen'); document.getElementById('chat-title').innerText = myFriends[i].nick; activeConn = peer.connect(myFriends[i].id); renderMessages(); }
function handleSearch(e) { if(e.key === 'Enter') { const n = e.target.value; const id = "WOS-"+n; if(!myFriends.find(x=>x.id===id)) { myFriends.push({id, nick:n, messages:[], isBlocked:false}); save(); renderContacts(); } e.target.value=''; }}
function renderContacts() { const l = document.getElementById('contact-list'); l.innerHTML = ''; myFriends.forEach((f, i) => { l.innerHTML += `<div class="item"><div onclick="openChat(${i})" style="flex:1;"><b>${f.nick}</b><br><small>${f.id}</small></div><div onclick="openFriendMenu(${i})" style="color:#00a884; font-weight:bold; cursor:pointer;">•••</div></div>`; }); }
function openFriendMenu(i) { modalTargetIndex = i; document.getElementById('modal-title').innerText = myFriends[i].nick; document.getElementById('block-btn').innerText = myFriends[i].isBlocked?"Engeli Kaldır":"Engelle"; document.getElementById('friend-modal').style.display = 'flex'; }
function closeModal() { document.getElementById('friend-modal').style.display = 'none'; }
function modalRename() { const n = prompt("Yeni isim:"); if(n) { myFriends[modalTargetIndex].nick = n; save(); renderContacts(); } closeModal(); }
function modalToggleBlock() { myFriends[modalTargetIndex].isBlocked = !myFriends[modalTargetIndex].isBlocked; save(); renderContacts(); closeModal(); }
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function loadMain() { showScreen('main-screen'); document.getElementById('user-info').innerText = myData.nick; renderContacts(); renderStories(); }
function save() { localStorage.setItem('wos_friends', JSON.stringify(myFriends)); }
function logout() { if(confirm("Silinsin mi?")) { localStorage.clear(); location.reload(); } }
function openSettings() { showScreen('settings-screen'); }
function saveSettings() { myData.nick = document.getElementById('set-nick').value || myData.nick; localStorage.setItem('wos_me', JSON.stringify(myData)); loadMain(); }
                
