/**
 * ============================================================
 *  CLASSROOM EMPTY SLOT FINDER — script.js  (DYNAMIC VERSION)
 *
 *  WHAT CHANGED FROM STATIC VERSION:
 *  ─────────────────────────────────
 *  BEFORE: Rooms were hardcoded in DEFAULT_ROOMS array and
 *          always loaded fresh — any toggle reset on reload.
 *
 *  NOW:    1. localStorage is the single source of truth.
 *          2. Default rooms load ONLY ONCE (first visit).
 *          3. All CRUD (Add / Edit / Delete / Toggle) saves
 *             immediately to localStorage and re-renders UI.
 *          4. Every dropdown, grid, and list auto-refreshes
 *             after each action.
 *
 *  HOW localStorage IS USED:
 *  ──────────────────────────
 *   "sf_rooms"   → JSON array of all room objects
 *   "sf_log"     → JSON array of recent update log entries
 *   "sf_seeded"  → flag ("1") so defaults only load once
 * ============================================================
 */

/* ============================================================
   DEFAULT DATA  (used only on first visit)
   ============================================================ */
const DEFAULT_ROOMS = [
  { id:"A101", name:"Room A101",   type:"classroom", status:"available", note:"" },
  { id:"A102", name:"Room A102",   type:"classroom", status:"occupied",  note:"Lecture in progress" },
  { id:"A103", name:"Room A103",   type:"classroom", status:"available", note:"" },
  { id:"A104", name:"Room A104",   type:"classroom", status:"occupied",  note:"Exam — Do not disturb" },
  { id:"B201", name:"Room B201",   type:"classroom", status:"available", note:"" },
  { id:"B202", name:"Room B202",   type:"classroom", status:"available", note:"" },
  { id:"B203", name:"Room B203",   type:"classroom", status:"occupied",  note:"Faculty meeting" },
  { id:"C301", name:"Room C301",   type:"classroom", status:"available", note:"" },
  { id:"C302", name:"Room C302",   type:"classroom", status:"occupied",  note:"Workshop" },
  { id:"LAB1", name:"Lab 1",       type:"lab",       status:"available", note:"" },
  { id:"LAB2", name:"Lab 2",       type:"lab",       status:"occupied",  note:"Practical session" },
  { id:"LAB3", name:"Lab 3",       type:"lab",       status:"available", note:"" },
  { id:"LAB4", name:"Lab 4",       type:"lab",       status:"available", note:"" },
  { id:"LAB5", name:"Lab 5",       type:"lab",       status:"occupied",  note:"Research ongoing" },
  { id:"SEM1", name:"Seminar 1",   type:"seminar",   status:"available", note:"" },
  { id:"SEM2", name:"Seminar 2",   type:"seminar",   status:"occupied",  note:"Group discussion" },
];

/* ============================================================
   APP STATE
   ============================================================ */
let rooms        = [];
let updateLog    = [];
let activeFilter = "all";
let pendingAction = null;   // for modal confirm callback

/* ============================================================
   ICON MAP — maps room type → emoji
   ============================================================ */
const TYPE_ICONS = {
  classroom : "&#127979;",
  lab       : "&#128300;",
  seminar   : "&#128161;",
};

function iconFor(type) {
  return TYPE_ICONS[type] || "&#127979;";
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", function () {
  loadFromStorage();   // ← dynamic: loads from localStorage first
  renderHomePreview();
  updateStats();
  renderRoomsGrid();
  renderManageList();
  populateSelect();
  syncRadio();
  syncAddRadio();
  renderLog();
  goTo("home");
  startSimulation();
});

/* ============================================================
   STORAGE  (core of the dynamic system)
   ============================================================ */

/**
 * loadFromStorage()
 * -----------------
 * BEFORE: Always used cloneDefaults() → static, reset every time.
 * NOW:    1. If "sf_seeded" flag exists → load from localStorage.
 *         2. If not → seed with defaults ONCE, set flag.
 */
function loadFromStorage() {
  try {
    var seeded = localStorage.getItem("sf_seeded");
    var r      = localStorage.getItem("sf_rooms");
    var l      = localStorage.getItem("sf_log");

    if (seeded && r) {
      // Returning visit — use stored rooms
      rooms = JSON.parse(r);
    } else {
      // First visit — seed with defaults
      rooms = cloneDefaults();
      localStorage.setItem("sf_seeded", "1");
      localStorage.setItem("sf_rooms", JSON.stringify(rooms));
    }

    updateLog = l ? JSON.parse(l) : [];
  } catch (e) {
    rooms     = cloneDefaults();
    updateLog = [];
  }
}

function saveToStorage() {
  try {
    localStorage.setItem("sf_rooms", JSON.stringify(rooms));
    localStorage.setItem("sf_log",   JSON.stringify(updateLog));
  } catch (e) { /* quota exceeded — silently ignore */ }
}

function cloneDefaults() {
  return DEFAULT_ROOMS.map(function(r) {
    return { id:r.id, name:r.name, type:r.type,
             status:r.status, note:r.note };
  });
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function goTo(pageId) {
  document.querySelectorAll(".page").forEach(function(p) {
    p.classList.remove("active");
  });

  var target = document.getElementById(pageId);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(function(a) {
    a.classList.toggle("active", a.getAttribute("data-page") === pageId);
  });

  document.getElementById("navLinks").classList.remove("open");
  window.scrollTo({ top:0, behavior:"smooth" });

  if (pageId === "home")  { renderHomePreview(); updateStats(); }
  if (pageId === "rooms") { renderRoomsGrid(); }
  if (pageId === "add")   { renderManageList(); }
  if (pageId === "mark")  { populateSelect(); renderLog(); syncRadio(); }
}

function toggleMenu() {
  document.getElementById("navLinks").classList.toggle("open");
}

/* ============================================================
   HOME
   ============================================================ */
function renderHomePreview() {
  var grid = document.getElementById("homePreview");
  if (!grid) return;

  var preview = rooms.slice(0, 8);
  grid.innerHTML = preview.map(function(r) {
    return '<div class="mini-card ' + r.status + '">' +
      '<div class="mini-card-icon">' + iconFor(r.type) + '</div>' +
      '<div class="mini-card-name">' + esc(r.name) + '</div>' +
      '<div class="mini-card-status">' + (r.status === "available" ? "Free" : "Busy") + '</div>' +
    '</div>';
  }).join("");
}

function updateStats() {
  var avail = rooms.filter(function(r) { return r.status === "available"; }).length;
  var occ   = rooms.length - avail;
  countUp("availCount", avail);
  countUp("occCount",   occ);
  countUp("totalCount", rooms.length);
}

function countUp(elId, target) {
  var el = document.getElementById(elId);
  if (!el) return;
  var current = 0;
  var step    = Math.max(1, Math.ceil(target / 16));
  var timer   = setInterval(function () {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

/* ============================================================
   ROOMS GRID  (Check Rooms page)
   ============================================================ */
function renderRoomsGrid() {
  var grid    = document.getElementById("roomsGrid");
  var emptyEl = document.getElementById("emptyMsg");
  if (!grid) return;

  var query = ((document.getElementById("searchInput") || {}).value || "").trim().toLowerCase();

  var filtered = rooms.filter(function(r) {
    var matchFilter =
      activeFilter === "all"       ? true :
      activeFilter === "available" ? r.status === "available" :
      activeFilter === "occupied"  ? r.status === "occupied"  :
      activeFilter === "classroom" ? r.type === "classroom"   :
      activeFilter === "lab"       ? r.type === "lab"         : true;

    var matchSearch = !query ||
      r.name.toLowerCase().indexOf(query) > -1 ||
      r.id.toLowerCase().indexOf(query) > -1 ||
      r.type.toLowerCase().indexOf(query) > -1;

    return matchFilter && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");

  grid.innerHTML = filtered.map(function(r, i) {
    var badgeClass = r.status === "available" ? "badge-green" : "badge-red";
    var badgeText  = r.status === "available" ? "Available"   : "Occupied";
    var btnText    = r.status === "available" ? "Mark Occupied" : "Mark Available";

    return '<div class="room-card ' + r.status + '" id="card-' + r.id + '" ' +
           'style="animation-delay:' + (i * 0.04) + 's">' +
      '<div class="room-card-top">' +
        '<span class="room-icon">' + iconFor(r.type) + '</span>' +
        '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
      '</div>' +
      '<div class="room-name">' + esc(r.name) + '</div>' +
      '<div class="room-type">' + r.type + '</div>' +
      '<div class="room-note">' + esc(r.note || "") + '</div>' +
      '<div class="card-actions">' +
        '<button class="room-toggle-btn" onclick="toggleStatus(\'' + r.id + '\')">' + btnText + '</button>' +
        '<button class="card-edit-btn"   onclick="goEditRoom(\'' + r.id + '\')" title="Edit">&#9999;</button>' +
        '<button class="card-del-btn"    onclick="confirmDelete(\'' + r.id + '\')" title="Delete">&#128465;</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

/* ============================================================
   TOGGLE STATUS  (existing feature, improved)
   ============================================================ */
function toggleStatus(roomId) {
  var room = getRoomById(roomId);
  if (!room) return;

  room.status = room.status === "available" ? "occupied" : "available";
  if (room.status === "available") room.note = "";

  saveToStorage();
  addLogEntry(room.name, room.status, room.note);
  refreshAll();
  showToast(esc(room.name) + " → " + room.status.toUpperCase(), "ok");
}

/* ============================================================
   ADD / EDIT ROOM  ← NEW DYNAMIC FEATURE
   ============================================================ */

/**
 * submitAddOrEdit()
 * -----------------
 * Handles BOTH adding a new room and saving an edit.
 * Checks hidden field #editRoomId to decide which mode.
 */
function submitAddOrEdit() {
  var nameEl   = document.getElementById("addRoomName");
  var typeEl   = document.getElementById("addRoomType");
  var noteEl   = document.getElementById("addRoomNote");
  var editIdEl = document.getElementById("editRoomId");
  var checked  = document.querySelector('input[name="addStatus"]:checked');

  var name   = nameEl.value.trim();
  var type   = typeEl.value;
  var note   = noteEl.value.trim();
  var status = checked ? checked.value : "available";
  var editId = editIdEl.value;

  if (!name) {
    showAddMsg("Please enter a room name.", "err");
    nameEl.focus();
    return;
  }

  if (editId) {
    // ── EDIT MODE ──
    var room = getRoomById(editId);
    if (!room) { showAddMsg("Room not found.", "err"); return; }

    room.name = name;
    room.type = type;
    room.note = note;
    // status is NOT changed during edit (use toggle for that)

    saveToStorage();
    addLogEntry(room.name, room.status, "Edited");
    refreshAll();
    showToast("Updated: " + esc(room.name), "ok");
    cancelEdit();

  } else {
    // ── ADD MODE ──
    // Check for duplicate name
    var duplicate = rooms.some(function(r) {
      return r.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) {
      showAddMsg("A room with this name already exists.", "err");
      return;
    }

    var newRoom = {
      id:     "R" + Date.now(),   // unique ID using timestamp
      name:   name,
      type:   type,
      status: status,
      note:   note
    };

    rooms.push(newRoom);
    saveToStorage();
    addLogEntry(newRoom.name, newRoom.status, "Added");
    refreshAll();
    showToast("Added: " + esc(newRoom.name), "ok");
    showAddMsg(esc(newRoom.name) + " added successfully!", "ok");

    // Reset form
    nameEl.value = "";
    noteEl.value = "";
    document.querySelector('input[name="addStatus"][value="available"]').checked = true;
    syncAddRadio();
  }
}

/**
 * goEditRoom(id)
 * ──────────────
 * Called from the ✏ button on room cards in Check Rooms page,
 * OR from the manage list. Navigates to Manage Rooms page and
 * pre-fills the form for editing.
 */
function goEditRoom(roomId) {
  var room = getRoomById(roomId);
  if (!room) return;

  goTo("add");

  // Small delay so page transition completes
  setTimeout(function() {
    document.getElementById("editRoomId").value  = room.id;
    document.getElementById("addRoomName").value = room.name;
    document.getElementById("addRoomType").value = room.type;
    document.getElementById("addRoomNote").value = room.note || "";

    // Set radio to room's current status
    var rad = document.querySelector('input[name="addStatus"][value="' + room.status + '"]');
    if (rad) rad.checked = true;
    syncAddRadio();

    // Switch form to edit mode
    document.getElementById("formCardTitle").innerHTML = "&#9999; Edit Room: " + esc(room.name);
    document.getElementById("addSubmitBtn").textContent = "Save Changes";
    document.getElementById("addSubmitBtn").classList.remove("btn-green");
    document.getElementById("addSubmitBtn").classList.add("btn-blue");
    document.getElementById("cancelEditBtn").classList.remove("hidden");

    document.getElementById("addRoomName").focus();
  }, 50);
}

function cancelEdit() {
  document.getElementById("editRoomId").value  = "";
  document.getElementById("addRoomName").value = "";
  document.getElementById("addRoomType").value = "classroom";
  document.getElementById("addRoomNote").value = "";
  document.querySelector('input[name="addStatus"][value="available"]').checked = true;
  syncAddRadio();

  document.getElementById("formCardTitle").innerHTML = "&#43; Add New Room";
  document.getElementById("addSubmitBtn").textContent = "Add Room";
  document.getElementById("addSubmitBtn").classList.add("btn-green");
  document.getElementById("addSubmitBtn").classList.remove("btn-blue");
  document.getElementById("cancelEditBtn").classList.add("hidden");
  document.getElementById("addFormMsg").classList.add("hidden");
}

/* ============================================================
   DELETE ROOM  ← NEW DYNAMIC FEATURE
   ============================================================ */
function confirmDelete(roomId) {
  var room = getRoomById(roomId);
  if (!room) return;

  openModal(
    "Delete " + esc(room.name) + "?",
    "This will permanently remove the room from the system.",
    function() { deleteRoom(roomId); }
  );
}

function deleteRoom(roomId) {
  var room = getRoomById(roomId);
  if (!room) return;
  var name = room.name;

  rooms = rooms.filter(function(r) { return r.id !== roomId; });
  saveToStorage();
  addLogEntry(name, "deleted", "");
  refreshAll();
  showToast("Deleted: " + esc(name), "err");
}

/* ============================================================
   MANAGE LIST  (Manage Rooms page room list)
   ============================================================ */
function renderManageList() {
  var el    = document.getElementById("manageList");
  var badge = document.getElementById("roomCountBadge");
  if (!el) return;

  var query = ((document.getElementById("manageSearch") || {}).value || "").trim().toLowerCase();

  var filtered = rooms.filter(function(r) {
    return !query ||
      r.name.toLowerCase().indexOf(query) > -1 ||
      r.type.toLowerCase().indexOf(query) > -1;
  });

  if (badge) badge.textContent = rooms.length;

  if (filtered.length === 0) {
    el.innerHTML = '<p class="empty-msg" style="padding:32px;text-align:center">No rooms found.</p>';
    return;
  }

  el.innerHTML = filtered.map(function(r) {
    var bClass = r.status === "available" ? "badge-green" : "badge-red";
    var bText  = r.status === "available" ? "Available"   : "Occupied";
    return '<div class="manage-item">' +
      '<div class="manage-item-left">' +
        '<span class="manage-item-icon">' + iconFor(r.type) + '</span>' +
        '<div>' +
          '<div class="manage-item-name">' + esc(r.name) + '</div>' +
          '<div class="manage-item-type">' + r.type + (r.note ? " · " + esc(r.note) : "") + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="manage-item-right">' +
        '<span class="badge ' + bClass + '">' + bText + '</span>' +
        '<button class="icon-btn icon-toggle" onclick="toggleStatus(\'' + r.id + '\')" title="Toggle status">&#9654;</button>' +
        '<button class="icon-btn icon-edit"   onclick="goEditRoom(\'' + r.id + '\')"   title="Edit">&#9999;</button>' +
        '<button class="icon-btn icon-del"    onclick="confirmDelete(\'' + r.id + '\')" title="Delete">&#128465;</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

/* ============================================================
   MARK OCCUPANCY FORM
   ============================================================ */
function populateSelect() {
  var sel = document.getElementById("roomSel");
  if (!sel) return;
  var prev = sel.value;

  sel.innerHTML = rooms.map(function(r) {
    return '<option value="' + r.id + '">' + esc(r.name) + ' (' + r.type + ')</option>';
  }).join("");

  // Try to restore previous selection
  if (prev) sel.value = prev;
}

function syncRadio() {
  var lblA = document.getElementById("lblAvail");
  var lblO = document.getElementById("lblOcc");
  if (!lblA || !lblO) return;
  var checked = document.querySelector('input[name="roomStatus"]:checked');
  var val = checked ? checked.value : "available";
  lblA.classList.toggle("selected-green", val === "available");
  lblA.classList.toggle("selected-red",   false);
  lblO.classList.toggle("selected-red",   val === "occupied");
  lblO.classList.toggle("selected-green", false);
}

function syncAddRadio() {
  var lblA = document.getElementById("addLblAvail");
  var lblO = document.getElementById("addLblOcc");
  if (!lblA || !lblO) return;
  var checked = document.querySelector('input[name="addStatus"]:checked');
  var val = checked ? checked.value : "available";
  lblA.classList.toggle("selected-green", val === "available");
  lblA.classList.toggle("selected-red",   false);
  lblO.classList.toggle("selected-red",   val === "occupied");
  lblO.classList.toggle("selected-green", false);
}

function submitForm() {
  var sel     = document.getElementById("roomSel");
  var noteEl  = document.getElementById("noteInp");
  var checked = document.querySelector('input[name="roomStatus"]:checked');

  if (!sel || !checked) return;

  var roomId = sel.value;
  var status = checked.value;
  var note   = noteEl ? noteEl.value.trim() : "";
  var room   = getRoomById(roomId);

  if (!room) { showFormMsg("Room not found.", "err"); return; }

  room.status = status;
  room.note   = note;
  saveToStorage();
  addLogEntry(room.name, status, note);
  refreshAll();
  renderLog();

  showFormMsg(esc(room.name) + " marked as " + status.toUpperCase() + "!", "ok");
  showToast("Updated: " + esc(room.name), "ok");
  if (noteEl) noteEl.value = "";
}

function showFormMsg(text, type) {
  var el = document.getElementById("formMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + type;
  el.classList.remove("hidden");
  setTimeout(function() { el.classList.add("hidden"); }, 3500);
}

function showAddMsg(text, type) {
  var el = document.getElementById("addFormMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + type;
  el.classList.remove("hidden");
  setTimeout(function() { el.classList.add("hidden"); }, 3500);
}

/* ============================================================
   FILTER + SEARCH
   ============================================================ */
function setFilter(btn, filterVal) {
  document.querySelectorAll(".ftab").forEach(function(b) { b.classList.remove("active"); });
  btn.classList.add("active");
  activeFilter = filterVal;
  renderRoomsGrid();
}

function applyFilter() { renderRoomsGrid(); }

/* ============================================================
   UPDATE LOG
   ============================================================ */
function addLogEntry(roomName, status, note) {
  var now     = new Date();
  var timeStr = now.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  updateLog.unshift({ room:roomName, status:status, note:note, time:timeStr });
  if (updateLog.length > 40) updateLog.length = 40;
  saveToStorage();
}

function renderLog() {
  var el = document.getElementById("updateLog");
  if (!el) return;

  if (updateLog.length === 0) {
    el.innerHTML = '<li class="log-empty">No updates yet. Be the first!</li>';
    return;
  }

  el.innerHTML = updateLog.map(function(e) {
    var bClass =
      e.status === "available" ? "badge-green" :
      e.status === "deleted"   ? "badge-gray"  : "badge-red";
    return '<li class="log-item">' +
      '<div class="log-row">' +
        '<span class="log-room">' + esc(e.room) + '</span>' +
        '<span class="badge ' + bClass + '">' + e.status + '</span>' +
      '</div>' +
      '<div class="log-time">' + e.time + '</div>' +
      (e.note && e.note !== "Edited" && e.note !== "Added"
        ? '<div class="log-note">"' + esc(e.note) + '"</div>' : '') +
    '</li>';
  }).join("");
}

/* ============================================================
   REFRESH ALL — call after every data change
   ============================================================ */
function refreshAll() {
  renderHomePreview();
  updateStats();
  renderManageList();
  populateSelect();

  var roomsPage = document.getElementById("rooms");
  if (roomsPage && roomsPage.classList.contains("active")) {
    renderRoomsGrid();
  }
}

/* ============================================================
   RESET TO DEFAULTS
   ============================================================ */
function confirmReset() {
  openModal(
    "Reset to Defaults?",
    "All custom rooms will be removed. The original 16 default rooms will be restored.",
    function() {
      rooms = cloneDefaults();
      updateLog = [];
      localStorage.setItem("sf_rooms",  JSON.stringify(rooms));
      localStorage.setItem("sf_log",    JSON.stringify(updateLog));
      localStorage.setItem("sf_seeded", "1");
      cancelEdit();
      refreshAll();
      renderLog();
      showToast("Reset to defaults!", "info");
    }
  );
}

/* ============================================================
   CONFIRM MODAL
   ============================================================ */
function openModal(title, msg, onConfirm) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalMsg").textContent   = msg;
  document.getElementById("confirmModal").classList.remove("hidden");
  pendingAction = onConfirm;
}

function closeModal() {
  document.getElementById("confirmModal").classList.add("hidden");
  pendingAction = null;
}

function modalConfirm() {
  if (typeof pendingAction === "function") pendingAction();
  closeModal();
}

// Close modal on overlay click
document.addEventListener("click", function(e) {
  if (e.target && e.target.id === "confirmModal") closeModal();
});

/* ============================================================
   HELPERS
   ============================================================ */
function getRoomById(id) {
  for (var i = 0; i < rooms.length; i++) {
    if (rooms[i].id === id) return rooms[i];
  }
  return null;
}

/* Escape HTML to prevent XSS from user input */
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function showToast(message, type) {
  var toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerHTML = message;
  toast.className = "toast " + (type || "ok");
  toast.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () {
    toast.classList.add("hidden");
  }, 3200);
}

/* ============================================================
   AUTO SIMULATION — flips 1 random room every 20 seconds
   ============================================================ */
function startSimulation() {
  setInterval(function () {
    if (rooms.length === 0) return;
    var idx      = Math.floor(Math.random() * rooms.length);
    var room     = rooms[idx];
    var newStatus = Math.random() < 0.55 ? "available" : "occupied";

    if (room.status !== newStatus) {
      room.status = newStatus;
      if (newStatus === "available") room.note = "";
      saveToStorage();
      addLogEntry(room.name, newStatus, room.note);
      refreshAll();
      showToast("Auto: " + esc(room.name) + " is now " + newStatus, "info");
    }
  }, 20000);
}
