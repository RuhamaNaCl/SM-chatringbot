// UI Elements
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const signupBtn = document.getElementById('signupBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const createRoomBtn = document.getElementById('createRoomBtn');
const newRoomName = document.getElementById('newRoomName');
const roomsList = document.getElementById('roomsList');
const roomHeader = document.getElementById('roomHeader');
const messagesEl = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

let currentRoomId = null;
let messagesUnsub = null;
                                            // Auth Logic
signupBtn.addEventListener('click', async ()=>{
  const email = emailEl.value.trim();
  const pass = passwordEl.value;
  if(!email || !pass) return alert('Provide email and password');
  try { await auth.createUserWithEmailAndPassword(email, pass); } catch(e){ alert(e.message); }
});

loginBtn.addEventListener('click', async ()=>{
  const email = emailEl.value.trim();
  const pass = passwordEl.value;
  if(!email || !pass) return alert('Provide email and password');
  try { await auth.signInWithEmailAndPassword(email, pass); } catch(e){ alert(e.message); }
});

logoutBtn.addEventListener('click', ()=> auth.signOut());

auth.onAuthStateChanged(user => {
  if(user){
    userInfo.textContent = `Logged in as ${user.email}`;
    logoutBtn.classList.remove('hidden');
  } else {
    userInfo.textContent = '';
    logoutBtn.classList.add('hidden');
  }
  loadRooms();
});
  // Room Logic
async function loadRooms(){
  roomsList.innerHTML = '';
  const roomsSnap = await db.collection('rooms').get();
  roomsSnap.forEach(docSnap => {
    const li = document.createElement('li');
    li.textContent = docSnap.data().name;
    li.dataset.roomId = docSnap.id;
    li.addEventListener('click', ()=> selectRoom(docSnap.id, docSnap.data().name));
    roomsList.appendChild(li);
  });
}

createRoomBtn.addEventListener('click', async ()=>{
  const name = newRoomName.value.trim();
  if(!name) return;
  try {
    const r = await db.collection('rooms').add({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    newRoomName.value = '';
    loadRooms();
    selectRoom(r.id, name);
  } catch(e){ alert(e.message); }
});

// Select Room & Messages
async function selectRoom(roomId, roomName){
  currentRoomId = roomId;
  roomHeader.textContent = roomName;
  Array.from(roomsList.children).forEach(li => li.classList.toggle('active', li.dataset.roomId===roomId));
   if(messagesUnsub) messagesUnsub();
  messagesEl.innerHTML = '';
  messageForm.classList.remove('hidden');

  const messagesQuery = db.collection(`rooms/${roomId}/messages`).orderBy('createdAt');
  messagesUnsub = messagesQuery.onSnapshot(snapshot => {
    messagesEl.innerHTML = '';
    snapshot.forEach(docSnap => {
      const m = docSnap.data();
      const div = document.createElement('div');
      div.className = 'message ' + (m.uid === (auth.currentUser && auth.currentUser.uid) ? 'me' : 'other');
      div.innerHTML = `<div>${escapeHtml(m.text)}</div><small>${m.sender} • ${m.createdAt ? new Date(m.createdAt.toDate()).toLocaleString() : ''}</small>`;
      messagesEl.appendChild(div);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

// Send Messages
messageForm.addEventListener('submit', async e => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if(!text || !currentRoomId) return;
  const user = auth.currentUser;
  if(!user) return alert('Sign in to send messages');
  try {
    await db.collection(`rooms/${currentRoomId}/messages`).add({
      text,
      uid: user.uid,
      sender: user.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    messageInput.value = '';
  } catch(e){ alert(e.message); }
});

// Escape HTML
function escapeHtml(str){
  return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s]);
}
// Initial Load
loadRooms();
