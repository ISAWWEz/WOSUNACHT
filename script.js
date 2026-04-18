// --- DEĞİŞKENLER ---
let mediaRecorder;
let audioChunks = [];
let localStream;

// --- 1. SESLİ MESAJ KAYDI ---
async function startRecording() {
    audioChunks = [];
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Audio = e.target.result;
                if(activeConn && activeConn.open) {
                    activeConn.send({ type: 'audio_msg', data: base64Audio });
                    myFriends[currentChatIndex].messages.push({ 
                        text: "🎤 Sesli Mesaj", 
                        audio: base64Audio, 
                        type: 'sent' 
                    });
                    save();
                    renderMessages();
                }
            };
            reader.readAsDataURL(audioBlob);
        };
        mediaRecorder.start();
        console.log("Kayıt başladı...");
    } catch (err) { alert("Mikrofon izni gerekli!"); }
}

function stopRecording() {
    if(mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
}

// --- 2. SESLİ ARAMA (VOICE CALL) ---
async function startVoiceCall() {
    const friend = myFriends[currentChatIndex];
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const call = peer.call(friend.id, localStream);
        handleCall(call);
        document.getElementById('conn-status').innerText = "Aranıyor...";
    } catch (err) { alert("Mikrofona erişilemedi!"); }
}

// Gelen Aramayı Dinle (initPeer içine entegre edilmeli)
function listenForCalls() {
    peer.on('call', async (call) => {
        if(confirm("Gelen Sesli Arama... Açmak ister misin?")) {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            call.answer(localStream);
            handleCall(call);
        }
    });
}

function handleCall(call) {
    call.on('stream', (remoteStream) => {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play();
        document.getElementById('conn-status').innerText = "📞 Görüşme Aktif";
    });
    call.on('close', () => {
        document.getElementById('conn-status').innerText = "Çevrimiçi";
        if(localStream) localStream.getTracks().forEach(t => t.stop());
    });
}

// --- 3. DURUM YÖNETİMİ (GALERİ + SİLME) ---
function handleStoryUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const desc = prompt("Durum açıklaması yazın:");
    const reader = new FileReader();
    reader.onload = (e) => {
        const newStory = {
            id: Date.now(), // Silme işlemi için eşsiz kimlik
            owner: myData.nick,
            text: desc || "",
            media: e.target.result,
            type: file.type.startsWith('video') ? 'video' : 'image',
            time: Date.now()
        };
        myStories.unshift(newStory);
        localStorage.setItem('wos_stories', JSON.stringify(myStories));
        renderStories();
    };
    reader.readAsDataURL(file);
}

function deleteStory(id) {
    if(confirm("Bu durumu silmek istiyor musunuz?")) {
        myStories = myStories.filter(s => s.id !== id);
        localStorage.setItem('wos_stories', JSON.stringify(myStories));
        renderStories();
    }
}

// Mevcut renderStories fonksiyonunu silme desteğiyle güncelle
function renderStories() {
    const list = document.getElementById('story-list');
    list.innerHTML = `<div class="story-circle" onclick="document.getElementById('story-upload').click()">+ Durum</div>`;
    
    myStories.forEach(s => {
        const bg = s.type === 'image' ? `background-image: url('${s.media}')` : `background: #00a884`;
        
        const storyDiv = document.createElement('div');
        storyDiv.className = 'story-circle';
        storyDiv.style = bg;
        storyDiv.onclick = () => {
            if(s.type === 'video') alert("Video oynatılıyor (Mantık eklenebilir): " + s.text);
            else alert(s.owner + ": " + s.text);
        };

        // Sağ tık veya °°° yerine üzerine basılı tutunca/küçük butonla silme
        const delBtn = document.createElement('span');
        delBtn.innerHTML = "°°°";
        delBtn.style = "position:absolute; top:2px; right:5px; font-weight:bold; color:white; text-shadow: 1px 1px 2px black;";
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteStory(s.id);
        };

        storyDiv.appendChild(delBtn);
        storyDiv.innerHTML += `<div class="story-overlay">${s.owner}</div>`;
        list.appendChild(storyDiv);
    });
}

// --- 4. MESAJLAŞMA ENTEGRASYONU (SESLİ MESAJ ALMA) ---
// Mevcut handleIncomingMsg fonksiyonunu şu şekilde güncellemelisin:
function handleIncomingMsg(peerId, data) {
    const friend = myFriends.find(f => f.id === peerId);
    if(friend && !friend.isBlocked) {
        if(typeof data === 'object' && data.type === 'audio_msg') {
            friend.messages.push({ text: "🎤 Sesli Mesaj", audio: data.data, type: 'received' });
        } else {
            friend.messages.push({ text: data, type: 'received' });
        }
        save();
        if(currentChatIndex !== null && myFriends[currentChatIndex].id === peerId) renderMessages();
    }
}

// --- 5. MESAJLARI GÖRÜNTÜLEME (SES OYNATICI) ---
// Mevcut renderMessages içine sesli mesaj desteği:
function renderMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    myFriends[currentChatIndex].messages.forEach(m => {
        let content = m.text;
        if(m.audio) {
            content = `<audio controls src="${m.audio}" style="width:180px; height:30px;"></audio>`;
        }
        container.innerHTML += `<div class="bubble ${m.type}">${content}</div>`;
    });
    container.scrollTop = container.scrollHeight;
}

// Uygulama başladığında aramaları dinlemeyi başlat
const oldInitPeer = initPeer;
initPeer = function() {
    oldInitPeer();
    listenForCalls();
};

