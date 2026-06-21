// System Notification Mechanics (Custom Pop / Alert Engine)
const SpendyNotify = {
    show(msg, type = 'info', duration = 3000) {
        const container = document.getElementById('custom-toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `custom-toast ${type}`;
        
        let icon = '<i class="fa-solid fa-circle-info"></i>';
        if(type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
        if(type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
        
        toast.innerHTML = `${icon} <span>${msg}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px) scale(0.9)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
    confirm(msg, onConfirm) {
        const container = document.getElementById('custom-toast-container');
        if (!container) return;
        const box = document.createElement('div');
        box.className = 'custom-toast confirm-box';
        box.innerHTML = `
            <div style="display:flex; gap:10px; align-items:center; font-weight:700; margin-bottom:10px;">
                <i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;"></i> <span>${msg}</span>
            </div>
            <div style="display:flex; gap:10px; width:100%; justify-content:flex-end;">
                <button id="toast-cancel">No</button>
                <button id="toast-ok">Yes, Clear</button>
            </div>
        `;
        container.appendChild(box);
        
        box.querySelector('#toast-cancel').onclick = () => box.remove();
        box.querySelector('#toast-ok').onclick = () => { onConfirm(); box.remove(); };
    }
};

// Application State Layer
let state = JSON.parse(localStorage.getItem('spendy_v28')) || { pData: [], bData: [], pBudget: 0, bCats: ['Staff', 'Porter', 'Stock'], pCats: ['Food', 'Travel', 'Rent'], isPro: false, bizName: '', bizLoc: '' };
let mode = 'personal', selectedCat = 'Other', chart = null, db = null;

// Firebase Architecture Config (Safe Initialization Check)
try {
    if (typeof firebase !== 'undefined') {
        const firebaseConfig = { 
            apiKey: "AIzaSyB-fZ2qA8aB_-Ra3I3WHa6RuoYFm-QabRY", 
            authDomain: "click-cha.firebaseapp.com", 
            databaseURL: "https://click-cha-default-rtdb.firebaseio.com", 
            projectId: "click-cha", 
            storageBucket: "click-cha.firebasestorage.app", 
            messagingSenderId: "231261928692", 
            appId: "1:231261928692:web:76e53480670c49b40932a1" 
        };
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
    }
} catch (e) {
    console.warn("Firebase initialization skipped or deferred:", e);
}

// Window Event Router for Safe DOM Execution
window.addEventListener('load', () => {
    setTimeout(function() { 
        const splash = document.getElementById('splash');
        if (splash) {
            splash.style.opacity = '0'; 
            setTimeout(function() { 
                splash.style.display = 'none'; 
                const wrapper = document.getElementById('wrapper');
                if (wrapper) wrapper.style.display = 'block'; 
            }, 400);
        }
    }, 1000);
});

function triggerBizMode() {
    if (state.isPro) { 
        if(!state.bizName) openBizInfoModal(); 
        else startApp('business'); 
    } else {
        document.getElementById('payment-modal').style.display = 'flex';
    }
}

function openBizInfoModal() { document.getElementById('biz-info-modal').style.display = 'flex'; }

function saveBizInfo() {
    state.bizName = document.getElementById('bizNameInput').value.trim() || 'My Business';
    state.bizLoc = document.getElementById('bizLocInput').value.trim() || 'Gurugram';
    save(); closeModals(); startApp('business');
}

function checkActivationCode() {
    var key = document.getElementById('activationCode').value.trim();
    if(!key) return;
    if(!db) {
        SpendyNotify.show('Database network offline. Try again.', 'error');
        return;
    }
    var btn = document.getElementById('activate-btn'); btn.innerText = "Validating...";
    db.ref('spendy_keys/' + key).once('value').then(function(snapshot) {
        if (snapshot.val() === "USED") {
            state.isPro = true; save();
            SpendyNotify.show('Pro Mode Activated Systemwide!', 'success');
            closeModals(); triggerBizMode();
        } else { 
            SpendyNotify.show('Invalid Activation License Key', 'error');
        }
        btn.innerText = "Activate License";
    }).catch(() => {
        SpendyNotify.show('Verification failed', 'error');
        btn.innerText = "Activate License";
    });
}

function startApp(m) {
    mode = m;
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    document.getElementById('universal-nav').style.display = 'flex';
    var isB = (m === 'business');
    
    document.getElementById('budget-ui').style.display = isB ? 'none' : 'block';
    document.getElementById('biz-name-disp').innerText = isB ? state.bizName : 'SPENDY';
    document.getElementById('biz-loc-disp').innerHTML = isB ? state.bizLoc + ' <i class="fa-solid fa-pen" style="cursor:pointer;" onclick="openBizInfoModal()"></i>' : 'DASHBOARD';
    
    if(!isB) document.getElementById('budgetInput').value = state.pBudget || '';
    
    loadCategories(); refresh(); renderCalendar();
}

function loadCategories() {
    var container = document.getElementById('category-list'); container.innerHTML = '';
    var cats = mode === 'personal' ? state.pCats : state.bCats;
    cats.forEach(function(c) {
        var span = document.createElement('span');
        span.className = 'chip'; span.innerText = c;
        span.onclick = function() { 
            selectedCat = c; 
            document.querySelectorAll('.chip').forEach(function(x) { x.classList.remove('selected'); }); 
            span.classList.add('selected'); 
        };
        container.appendChild(span);
    });
    
    var add = document.createElement('span'); add.className = 'chip'; add.innerHTML = '<i class="fa-solid fa-plus"></i>';
    add.onclick = function() {
        document.getElementById('newCatInput').value = '';
        document.getElementById('cat-modal').style.display = 'flex';
        document.getElementById('newCatInput').focus();
    };
    container.appendChild(add);
    selectedCat = cats[0] || 'Other';
    if(container.firstChild) container.firstChild.classList.add('selected');
}

function submitCustomCategory() {
    let catInput = document.getElementById('newCatInput');
    let catName = catInput.value.trim();
    
    if(catName !== "") {
        if(mode === 'personal') {
            state.pCats.push(catName);
        } else {
            state.bCats.push(catName);
        }
        save(); 
        loadCategories();
        closeModals();
        SpendyNotify.show('New Category Registered', 'success');
    } else {
        SpendyNotify.show('Category name cannot be empty', 'error');
    }
}

function addEntry() {
    if(mode === "personal" && (!state.pBudget || state.pBudget <= 0)){
         SpendyNotify.show("Configure your Budget allocation first.", "error");
         return;
    }
    var d = document.getElementById('desc').value.trim(), a = parseFloat(document.getElementById('amt').value);
    if(!d) { SpendyNotify.show("Transaction description cannot be blank", "error"); return; }
    if(!a || a <= 0) { SpendyNotify.show("Enter valid structural amount value", "error"); return; }
    
    var target = mode === 'personal' ? 'pData' : 'bData';
    state[target].push({ id: Date.now(), d: d, a: a, cat: selectedCat, dt: new Date().toLocaleDateString('en-IN') });
    document.getElementById('desc').value = ''; document.getElementById('amt').value = '';
    save(); refresh(); renderCalendar();
    SpendyNotify.show("Record Tracked Successfully", "success");
}

function deleteEntry(id) {
    var target = mode === 'personal' ? 'pData' : 'bData';
    state[target] = state[target].filter(function(i) { return i.id !== id; });
    save(); refresh(); renderCalendar();
    SpendyNotify.show("Entry Erased", "info");
}

function refresh() {
    var recent = document.getElementById('recent-list'), full = document.getElementById('full-list');
    if (!recent || !full) return;
    recent.innerHTML = ''; full.innerHTML = '';
    var total = 0;
    var data = mode === 'personal' ? state.pData : state.bData;
    var today = new Date().toLocaleDateString('en-IN');
    
    data.slice().reverse().forEach(function(i) {
        total += i.a;
        var row = '<div class="item-row"><div><b style="font-size:14px;">' + i.d + '</b><br><small style="color:var(--text-muted); font-size:11px;">' + i.dt + ' • ' + i.cat + '</small></div><div style="display:flex; align-items:center; gap:12px;"><div style="font-weight:700; font-size:14px;">₹' + i.a.toLocaleString('en-IN') + '</div><button class="del-btn" onclick="deleteEntry(' + i.id + ')"><i class="fa-solid fa-trash-can"></i></button></div></div>';
        full.innerHTML += row;
        if(i.dt === today) recent.innerHTML += row;
    });
    
    if(recent.innerHTML === '') recent.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:15px; font-size:12px;">No Ledger movements logged today</p>';
    
    let displayAmt = mode === 'personal' ? (state.pBudget - total) : total;
    document.getElementById('total-display').innerText = "₹" + displayAmt.toLocaleString('en-IN');
    document.getElementById('total-display').style.color = (mode === 'personal' && displayAmt < 0) ? 'var(--danger)' : 'var(--text-main)';
    
    updateChart(data);
}

function updateChart(data) {
    var chartCanvas = document.getElementById('spendChart');
    if(!chartCanvas || typeof Chart === 'undefined') return;
    var ctx = chartCanvas.getContext('2d');
    if(chart) chart.destroy();
    
    var cats = {}; data.forEach(function(i) { cats[i.cat] = (cats[i.cat] || 0) + i.a; });
    const colors = ["#3b82f6", "#64748b", "#475569", "#94a3b8", "#cbd5e1", "#1e293b"];
    
    chart = new Chart(ctx, { 
        type: 'doughnut', 
        data: { 
            labels: Object.keys(cats), 
            datasets: [{ data: Object.values(cats), backgroundColor: colors.slice(0, Object.keys(cats).length), borderWidth: 0 }] 
        }, 
        options: { 
            responsive: true,
            maintainAspectRatio: true, 
            cutout: '80%', 
            plugins: { legend: { display: true, position: 'bottom', labels: { color: '#6b7280', font: { size: 11 } } } } 
        } 
    });
}

function renderCalendar() {
    var cal = document.getElementById('calendar'); 
    if(!cal) return;
    cal.innerHTML = '';
    var data = mode === 'personal' ? state.pData : state.bData;
    var today = new Date();
    for(var i=0; i<14; i++) {
        var d = new Date(); d.setDate(today.getDate() - i);
        var ds = d.toLocaleDateString('en-IN');
        var dayTotal = data.filter(function(x) { return x.dt === ds; }).reduce(function(s, x) { return s + x.a; }, 0);
        var div = document.createElement('div');
        div.style = 'padding:8px 2px; background:' + (dayTotal > 0 ? '#1e2430':'#14171f') + '; border-radius:8px; text-align:center; font-size:10px; border: 1px solid ' + (dayTotal > 0 ? 'var(--accent)':'var(--panel-border)');
        div.innerHTML = '<b>' + d.getDate() + '</b><br><span style="color:var(--text-muted)">₹' + dayTotal + '</span>';
        cal.appendChild(div);
    }
}

function exportToPDF() {
    if(typeof window.jspdf === 'undefined') {
        SpendyNotify.show('PDF Library not loaded completely', 'error');
        return;
    }
    var jsPDF = window.jspdf.jsPDF; var doc = new jsPDF();
    var data = mode === 'personal' ? state.pData : state.bData;
    var title = mode === 'business' ? state.bizName.toUpperCase() : "BALANCE LEDGER STATEMENT";
    doc.setFontSize(16); doc.text(title, 14, 20);
    var rows = data.map(function(i) { return [i.dt, i.cat, i.d, "Rs. " + i.a.toLocaleString()]; });
    doc.autoTable({ head: [['Date', 'Category', 'Note', 'Amount']], body: rows, startY: 30, theme: 'grid', headStyles: { fillColor: [30, 30, 30] } });
    doc.save('Statement.pdf');
    SpendyNotify.show('PDF Sheet Downloaded', 'success');
}

function toggleMenu() { 
    document.getElementById('side-menu').classList.toggle('open'); 
    document.getElementById('menu-overlay').style.display = document.getElementById('side-menu').classList.contains('open') ? 'block' : 'none'; 
}

function closeModals() { document.querySelectorAll('.modal-overlay').forEach(function(m) { m.style.display = 'none'; }); }

function save() { localStorage.setItem('spendy_v28', JSON.stringify(state)); }

function showSec(id, el) { 
    document.querySelectorAll('.app-section').forEach(function(s) { s.classList.remove('active'); }); 
    document.getElementById(id).classList.add('active'); 
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); }); 
    el.classList.add('active'); 
}

function switchModePrompt() { var n = mode === 'personal' ? 'business' : 'personal'; if(n === 'business') triggerBizMode(); else startApp(n); }

function saveBudget() { state.pBudget = parseFloat(document.getElementById('budgetInput').value) || 0; save(); refresh(); }

function resetData() { 
    SpendyNotify.confirm("Wipe logs completely?", function() {
        if(mode === 'personal') state.pData = []; else state.bData = []; 
        save(); refresh(); renderCalendar();
        SpendyNotify.show("History Purged", "info");
    });
}

function sendFeedback() { 
    var m = document.getElementById('feedbackMsg').value.trim(); if(!m) return; 
    var f = new FormData(); f.append('app', 'Spendy'); f.append('message', m); 
    fetch('https://script.google.com/macros/s/AKfycbz3wk6iVLZV8HqYHBdlUD39uj7YgLPBoOwmaBT6TL29VpCXlTCL7KN_eRgMAPtAc6oO/exec', { method: 'POST', body: f })
    .then(function() { 
        SpendyNotify.show('Feedback Transmitted!', 'success');
        document.getElementById('feedbackMsg').value = ''; toggleMenu(); 
    }).catch(() => {
        SpendyNotify.show('Feedback failed to send', 'error');
    });
}
