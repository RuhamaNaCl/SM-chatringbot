// Firebase SDK ইমপোর্ট করা
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⭐ আপনার Firebase কনফিগারেশন ⭐
const firebaseConfig = {
    apiKey: "AIzaSyBtd-be8YoABPKfkDEp18bjX52mHRb8wC0",
    authDomain: "myprivetchat-49d65.firebaseapp.com",
    projectId: "myprivetchat-49d65",
    storageBucket: "myprivetchat-49d65.firebasestorage.app",
    messagingSenderId: "219287315146",
    appId: "1:219287315146:web:1752df6875cdd3f0530a33",
    measurementId: "G-322DLQYEGY" // Analytics ব্যবহার না করলে এটা বাদও দিতে পারেন
};

// অ্যাপ ইনিশিয়ালাইজ করা
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ⭐ আপনার ImgBB API Key ⭐ (নিজেকেই এখানে বসাতে হবে)
const IMGBB_API_KEY = "YOUR_IMGBB_API_KEY_HERE"; // ⚠️ এখানে আপনার আসল Key টি দিন!

let currentUser = null;

// ১. অটোমেটিক লগইন
signInAnonymously(auth).catch((error) => {
    console.error("Login Failed:", error);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('my-uid').innerText = user.uid.slice(0, 6);
        loadMessages();
    }
});

// ২. মেসেজ পাঠানো (ImgBB সহ)
const sendBtn = document.getElementById('send-btn');
const msgInput = document.getElementById('msg-input');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const fileNameDisplay = document.getElementById('file-name-display');

fileBtn.addEventListener('click', () => fileInput.click());

// ফাইল সিলেক্ট করলে নাম দেখানো
fileInput.addEventListener('change', (e) => {
    if(e.target.files[0]) {
        fileNameDisplay.innerText = "Selected: " + e.target.files[0].name;
    }
});

sendBtn.addEventListener('click', async () => {
    const text = msgInput.value;
    const file = fileInput.files[0];

    if (!text && !file) return;

    sendBtn.innerText = "Sending...";
    sendBtn.disabled = true;

    let fileUrl = null;
    let fileType = null;

    try {
        // ফাইল থাকলে এবং সেটা ছবি হলে, ImgBB তে আপলোড হবে
        if (file) {
            if (file.type.startsWith('image/')) {
                const formData = new FormData();
                formData.append("image", file);
                
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

        // ডেটাবেসে (Firestore) মেসেজ সেভ করা
        await addDoc(collection(db, "messages"), {
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

// ৩. রিয়েল-টাইম মেসেজ রিসিভ করা
function loadMessages() {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snapshot) => {
        const msgArea = document.getElementById('messages-area');
        msgArea.innerHTML = ""; 

        snapshot.forEach((doc) => {
            const msg = doc.data();
            const msgDiv = document.createElement('div');
            const isMe = msg.uid === currentUser.uid;
            
            msgDiv.className = `message ${isMe ? 'my-msg' : 'other-msg'}`;
            
            let contentHtml = `<span class="sender-id">ID: ${msg.uid.slice(0, 6)}</span>`;
            
            // ছবি থাকলে দেখানো
            if (msg.fileUrl && msg.fileType === 'image') {
                contentHtml += `<img src="${msg.fileUrl}" class="msg-img"><br>`;
            }
            
            // টেক্সট থাকলে দেখানো (লিংক থাকলে ক্লিকেবল হবে)
            if (msg.text) {
                // কেউ লিংক দিলে সেটা যেন ক্লিক করা যায়
                const textWithLink = msg.text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: inherit; text-decoration: underline;">$1</a>');
                contentHtml += `<span>${textWithLink}</span>`;
            }

            msgDiv.innerHTML = contentHtml;
            msgArea.appendChild(msgDiv);
        });
        msgArea.scrollTop = msgArea.scrollHeight;
    });
}
