// Firebase SDK ইমপোর্ট করা (Display Name এর জন্য getDoc ও যোগ করা হয়েছে)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⭐ আপনার Firebase কনফিগারেশন ⭐
const firebaseConfig = {
    apiKey: "AIzaSyBtd-be8YoABPKfkDEp18bjX52mHRb8wC0",
    authDomain: "myprivetchat-49d65.firebaseapp.com",
    projectId: "myprivetchat-49d65",
    storageBucket: "myprivetchat-49d65.firebasestorage.app",
    messagingSenderId: "219287315146",
    appId: "1:219287315146:web:1752df6875cdd3f0530a33",
    measurementId: "G-322DLQYEGY" 
};

// অ্যাপ ইনিশিয়ালাইজ করা
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ⭐ আপনার ImgBB API Key ⭐
const IMGBB_API_KEY = "YOUR_IMGBB_API_KEY_HERE"; // ⚠️ এখানে আপনার আসল Key টি দিন!

let currentUser = null;
let currentChatUid = null;
let unsubscribeFromMessages = null;

// DOM elements
const myUidSpan = document.getElementById('my-uid');
const userListDiv = document.getElementById('user-list');
const messagesArea = document.getElementById('messages-area');
const chatHeader = document.getElementById('current-chat-header');
const mainInputArea = document.getElementById('main-input-area');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const fileNameDisplay = document.getElementById('file-name-display');
const nameInput = document.getElementById('name-input');
const saveNameBtn = document.getElementById('save-name-btn');

// ১. চ্যাট রুমের ইউনিক ID তৈরি করা
function getChatRoomId(uid1, uid2) {
    // দুটি UID এর মধ্যে ছোটটিকে আগে রেখে একটি ইউনিক ID তৈরি করা হয়
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// ২. অটোমেটিক লগইন এবং UID তৈরি
signInAnonymously(auth).catch((error) => {
    console.error("Login Failed:", error);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const shortUid = user.uid.slice(0, 6);
        myUidSpan.innerText = shortUid;
        
        // ইউজারকে Firestore এ রেজিস্টার করা
        registerUser(user.uid, shortUid);

        // ইউজার লিস্ট লোড করা
        loadUserList();
    }
});

// ৩. ইউজার রেজিস্ট্রি ও ডিসপ্লে নাম হ্যান্ডলিং
async function registerUser(uid, shortUid) {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    
    let displayName = `Guest-${shortUid}`; 
    
    if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.displayName) {
            displayName = data.displayName;
        }
    }

    // Firestore এ সেভ করা (বা আপডেট করা)
    await setDoc(userDocRef, {
        uid: uid,
        shortUid: shortUid,
        displayName: displayName,
        lastActive: serverTimestamp()
    }, { merge: true });

    // ইনপুট বক্সে বর্তমান নাম দেখাও
    nameInput.value = displayName;
}

// ৪. ডিসপ্লে নাম সেভ করা
async function updateDisplayName() {
    const newName = nameInput.value.trim();
    if (!newName) {
        alert("Name cannot be empty.");
        return;
    }

    try {
        saveNameBtn.innerText = "Saving...";
        saveNameBtn.disabled = true;

        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, {
            displayName: newName
        }, { merge: true });

        // পুরো ইউজার লিস্ট রিফ্রেশ করার জন্য
        loadUserList(); 
        
        // যদি বর্তমানে কারো সাথে চ্যাট চলে, তবে তার হেডারও আপডেট করা 
        if (currentChatUid) {
             // যেহেতু loadUserList() চলে, তাই chat header আপডেট করার দরকার নেই
        }

    } catch (error) {
        console.error("Error updating name:", error);
        alert("Failed to save name.");
    } finally {
        saveNameBtn.innerText = "Save Name";
        saveNameBtn.disabled = false;
    }
}

// Event Listener যোগ করা
saveNameBtn.addEventListener('click', updateDisplayName);


// ৫. ইউজার লিস্ট লোড করা
function loadUserList() {
    // যারা সম্প্রতি Active ছিল, তাদের আগে দেখানো হবে
    const q = query(collection(db, "users"), orderBy("lastActive", "desc"));
    
    onSnapshot(q, (snapshot) => {
        userListDiv.innerHTML = "";
        snapshot.forEach((doc) => {
            const user = doc.data();
            // নিজের ID লিস্টে দেখানো হবে না
            if (user.uid === currentUser.uid) return; 

            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.setAttribute('data-uid', user.uid);
            
            // displayName ব্যবহার করা হচ্ছে
            userItem.innerText = user.displayName || `Guest ID: ${user.shortUid}`; 
            
            userItem.addEventListener('click', () => {
                // targetDisplayName পাস করা হচ্ছে
                startChat(user.uid, user.displayName || user.shortUid);
            });

            userListDiv.appendChild(userItem);
        });
    });
}

// ৬. চ্যাট শুরু করা
function startChat(targetUid, targetDisplayName) {
    // পুরানো মেসেজ লিসেনার বন্ধ করা
    if (unsubscribeFromMessages) {
        unsubscribeFromMessages();
    }

    currentChatUid = targetUid;
    const roomId = getChatRoomId(currentUser.uid, currentChatUid);

    // হেডার আপডেট করা
    chatHeader.innerText = `Chatting with: ${targetDisplayName}`;
    mainInputArea.style.display = 'flex';
    document.getElementById('initial-message').style.display = 'none';

    // ইনবক্সে Active স্টাইল সেট করা
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-uid') === targetUid) {
            item.classList.add('active');
        }
    });

    // নতুন মেসেজ লোড করা
    loadMessages(roomId);
}

// ৭. মেসেজ লোড করা
function loadMessages(roomId) {
    const messagesRef = collection(db, `chats/${roomId}/messages`);
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    
    // রিয়েল-টাইম লিসেনার সেট করা
    unsubscribeFromMessages = onSnapshot(q, (snapshot) => {
        messagesArea.innerHTML = ""; 

        snapshot.forEach((doc) => {
            const msg = doc.data();
            const msgDiv = document.createElement('div');
            const isMe = msg.uid === currentUser.uid;
            
            msgDiv.className = `message ${isMe ? 'my-msg' : 'other-msg'}`;
            
            let contentHtml = '';
            
            // ছবি থাকলে দেখানো
            if (msg.fileUrl && msg.fileType === 'image') {
                contentHtml += `<img src="${msg.fileUrl}" class="msg-img"><br>`;
            }
            
            // টেক্সট থাকলে দেখানো
            if (msg.text) {
                // লিংক অটো ডিটেক্ট করা
                const textWithLink = msg.text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: inherit; text-decoration: underline;">$1</a>');
                contentHtml += `<span>${textWithLink}</span>`;
            }

            msgDiv.innerHTML = contentHtml;
            messagesArea.appendChild(msgDiv);
        });
        messagesArea.scrollTop = messagesArea.scrollHeight;
    });
}


// ৮. মেসেজ পাঠানো লজিক
fileBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if(e.target.files[0]) {
        fileNameDisplay.innerText = "Selected: " + e.target.files[0].name;
    }
});

sendBtn.addEventListener('click', async () => {
    const text = msgInput.value;
    const file = fileInput.files[0];

    if (!text && !file) return;
    if (!currentChatUid) return alert("Please select a user first.");

    sendBtn.innerText = "Sending...";
    sendBtn.disabled = true;

    let fileUrl = null;
    let fileType = null;

    try {
        if (file) {
            if (file.type.startsWith('image/')) {
                const formData = new FormData();
                formData.append("image", file);
                
                // ImgBB API তে ছবি আপলোড করা
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                    method: "POST",
                    body: formData
                });
                
                const data = await response.json();
                if (data.success) {
                    fileUrl = data.data.url;
                    fileType = 'image';
                } else {
                    alert("Image upload failed!");
                }
            } else {
                alert("Only images are allowed directly. For other files, please share a Google Drive link.");
                sendBtn.innerText = "Send";
                sendBtn.disabled = false;
                return;
            }
        }

        // মেসেজটি সঠিক চ্যাট রুম কালেকশনে সেভ করা
        const roomId = getChatRoomId(currentUser.uid, currentChatUid);
        const messagesRef = collection(db, `chats/${roomId}/messages`);

        await addDoc(messagesRef, {
            text: text,
            uid: currentUser.uid,
            fileUrl: fileUrl,
            fileType: fileType,
            createdAt: serverTimestamp()
        });
        
        // ইনপুট ক্লিয়ার করা
        msgInput.value = "";
        fileInput.value = "";
        fileNameDisplay.innerText = "";

    } catch (e) {
        console.error("Error sending message: ", e);
        alert("Error sending message.");
    }

    sendBtn.innerText = "Send";
    sendBtn.disabled = false;
});
document.addEventListener("DOMContentLoaded", () => {
    const inboxList = document.querySelector(".inbox-list");
    const menuBtn = document.getElementById("menu-btn");

    if (menuBtn && inboxList) {
        menuBtn.addEventListener("click", () => {
            inboxList.classList.toggle("open");
        });
    }
});
