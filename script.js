// --- SİSTEM DEĞİŞKENLERİ VE YAPILANDIRMA ---
let mediaRecorder;
let audioChunks = [];
let localStream = null;
let currentCall = null;
let incomingCallSignal = null;
let currentUnknownSenderId = null;

// PeerJS Başlatıcı Ek Yapılandırması
function initPeer() {
    peer = new Peer(myData.id);
    
    peer.on('connection', (conn) => {
        activeConn = conn;
        conn.on('data', (data) => {
            const friend = myFriends.find(f => f.id === conn.peer);
            if(friend && friend.isBlocked) return; 
            
            if(data.type === 'profile_sync') { 
                updateFriendProfile(conn.peer, data); 
            } else { 
                handleIncomingMsg(conn.peer, data); 
            }
        });
    });

    // Gelen Sesli veya Görüntülü Aramayı Yakalama Dinleyicisi
    peer.on('call', (call) => {
        const friend = myFriends.find(f => f.id === call.peer);
        if(friend && friend.isBlocked) return;

        incomingCallSignal = call;
        const isVideoCall = call.options && call.options.metadata && call.options.metadata.type === 'video';
        
        document.getElementById('call-overlay').style.display = 'flex';
        document.getElementById('accept-call-btn').style.display = 'flex'; 
        document.getElementById('call-user-name').innerText = friend ? friend.nick : call.peer.replace("WOS-", "");
        document.getElementById('call-status-text').innerText = isVideoCall ? "Görüntülü Arama Geliyor..." : "Sesli Arama Geliyor...";
        
        document.getElementById('remote-video').style.display = 'none';
        document.getElementById('local-video').style.display = 'none';
    });
}

// Bilinmeyen Numara Karşılama ve Mesaj Yönetimi
function handleIncomingMsg(peerId, data) {
    let friend = myFriends.find(f => f.id === peerId);
    
    if (!friend) {
        currentUnknownSenderId = peerId;
        const cleanNumber = peerId.replace("WOS-", "");
        document.getElementById('unknown-number-text').innerText = "Bilinmeyen Numara: " + cleanNumber;
        document.getElementById('unknown-alert').style.display = 'flex';
        
        myFriends.push({ id: peerId, nick: cleanNumber, messages: [], pic: "", isBlocked: false });
        friend = myFriends.find(f => f.id === peerId);
    }

    if(friend && !friend.isBlocked) {
        if(data.type === 'text') {
            friend.messages.push({ text: data.text, type: 'received' });
        } else if(data.type === 'audio') {
            friend.messages.push({ text: data.audioData, type: 'audio_received' });
        }
        save();
        if(currentChatIndex !== null && myFriends[currentChatIndex].id === peerId) renderMessages();
    }
}

// Bilinmeyen Üst Bar Buton Kontrolleri
function handleUnknown(action) {
    const index = myFriends.findIndex(f => f.id === currentUnknownSenderId);
    if(index !== -1) {
        if(action === 'save') {
            const newName = prompt("Kişi adı girin:", myFriends[index].nick);
            if(newName) myFriends[index].nick = newName;
        } else if(action === 'block') {
            myFriends[index].isBlocked = true;
        }
        save();
        renderContacts();
    }
    document.getElementById('unknown-alert').style.display = 'none';
    currentUnknownSenderId = null;
}

// --- TELEFON SİSTEMİ BUTON İŞLEMLERİ ---

// Arama Butonuna Tıklanınca Açılan Pencere Mantığı
function openCallSelectionMenu() {
    if(currentChatIndex === null) return;
    const mode = confirm("Görüntülü arama başlatmak için 'Tamam' butonuna tıklayın.\nSadece Sesli arama başlatmak için 'İptal' butonuna tıklayın.");
    initiateCall(mode ? 'video' : 'voice');
}

// Arama Başlatma Akışı
function initiateCall(type) {
    const constraints = { audio: true, video: type === 'video' };

    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        localStream = stream;
        
        document.getElementById('call-overlay').style.display = 'flex';
        document.getElementById('accept-call-btn').style.display = 'none'; 
        document.getElementById('call-user-name').innerText = myFriends[currentChatIndex].nick;
        document.getElementById('call-status-text').innerText = "Aranıyor...";

        if(type === 'video') {
            const localVid = document.getElementById('local-video');
            localVid.srcObject = stream;
            localVid.style.display = 'block';
        }

        const targetId = myFriends[currentChatIndex].id;
        currentCall = peer.call(targetId, stream, { metadata: { type: type } });
        
        currentCall.on('stream', remoteStream => {
            document.getElementById('call-status-text').innerText = "Bağlantı Kuruldu";
            if(type === 'video') {
                const remoteVid = document.getElementById('remote-video');
                remoteVid.srcObject = remoteStream;
                remoteVid.style.display = 'block';
            }
        });

        currentCall.on('close', () => { endCall(); });
    }).catch(() => alert("Donanım erişim izni alınamadı!"));
}

// Arama Kabul Etme (Yeşil Daire Buton)
function acceptIncomingCall() {
    if(!incomingCallSignal) return;
    
    const isVideo = incomingCallSignal.options && incomingCallSignal.options.metadata && incomingCallSignal.options.metadata.type === 'video';
    const constraints = { audio: true, video: isVideo };

    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
        localStream = stream;
        document.getElementById('accept-call-btn').style.display = 'none';
        document.getElementById('call-status-text').innerText = "Konuşuluyor...";

        if(isVideo) {
            const localVid = document.getElementById('local-video');
            localVid.srcObject = stream;
            localVid.style.display = 'block';
        }

        incomingCallSignal.answer(stream);
        incomingCallSignal.on('stream', remoteStream => {
            if(isVideo) {
                const remoteVid = document.getElementById('remote-video');
                remoteVid.srcObject = remoteStream;
                remoteVid.style.display = 'block';
            }
        });

        currentCall = incomingCallSignal;
        currentCall.on('close', () => { endCall(); });
    }).catch(() => {
        alert("Medya erişim hatası!");
        endCall();
    });
}

// Aramayı Reddetme / Kapatma (Kırmızı Daire Buton)
function endCall() {
    if (currentCall) { currentCall.close(); currentCall = null; }
    if (incomingCallSignal) { incomingCallSignal.close(); incomingCallSignal = null; }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    document.getElementById('remote-video').srcObject = null;
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').style.display = 'none';
    document.getElementById('local-video').style.display = 'none';
    document.getElementById('call-overlay').style.display = 'none';
}

// --- BAS-KONUŞ SİSTEMİ DİNLEYİCİLERİ ---
const micBtn = document.getElementById('mic-btn');
if(micBtn) {
    micBtn.addEventListener('mousedown', startAudioRecording);
    micBtn.addEventListener('mouseup', stopAudioRecording);
    micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startAudioRecording(); });
    micBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopAudioRecording(); });
}

function startAudioRecording() {
    if(currentChatIndex === null || myFriends[currentChatIndex].isBlocked) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/ogg; codecs=opus' });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Audio = reader.result;
                if (activeConn && activeConn.open) {
                    activeConn.send({ type: 'audio', audioData: base64Audio });
                }
                myFriends[currentChatIndex].messages.push({ text: base64Audio, type: 'audio_sent' });
                save();
                renderMessages();
            };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        micBtn.classList.add('mic-active');
        mediaRecorder.start();
    }).catch(() => alert("Mikrofon izni engellendi!"));
}

function stopAudioRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        micBtn.classList.remove('mic-active');
        mediaRecorder.stop();
    }
}
  
