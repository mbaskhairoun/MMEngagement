// ============================================
// Admin Dashboard Logic
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase to initialize
    const waitForFirebase = setInterval(() => {
        if (window.firebaseAuth) {
            clearInterval(waitForFirebase);
            initializeAdmin();
        }
    }, 100);
});

function initializeAdmin() {
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const userEmailSpan = document.getElementById('userEmail');

    // Auth state listener
    window.firebaseOnAuthStateChanged(window.firebaseAuth, (user) => {
        if (user) {
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            userEmailSpan.textContent = user.email;
            loadDashboardData();
        } else {
            loginSection.style.display = 'flex';
            dashboardSection.style.display = 'none';
        }
    });

    // Login form handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            loginError.textContent = '';
            await window.firebaseSignIn(window.firebaseAuth, email, password);
        } catch (error) {
            console.error('Login error:', error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                loginError.textContent = 'Invalid email or password';
            } else if (error.code === 'auth/invalid-credential') {
                loginError.textContent = 'Invalid email or password';
            } else {
                loginError.textContent = 'Login failed. Please try again.';
            }
        }
    });

    // Logout handler
    logoutBtn.addEventListener('click', async () => {
        await window.firebaseSignOut(window.firebaseAuth);
    });

    // Tab navigation
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tab.dataset.tab}Tab`).classList.add('active');
        });
    });

    // Initialize other handlers
    initializeGuestHandlers();
    initializeSettingsHandlers();
    initializeRsvpHandlers();
    initializeUploadHandlers();
}

// ============================================
// Load Dashboard Data
// ============================================

async function loadDashboardData() {
    await Promise.all([
        loadGuests(),
        loadSettings(),
        loadRsvps()
    ]);
}

// ============================================
// Guest Management
// ============================================

let allGuests = [];

async function loadGuests() {
    const tbody = document.getElementById('guestsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';

    try {
        const q = window.firebaseQuery(
            window.firebaseCollection(window.firebaseDb, 'guests'),
            window.firebaseOrderBy('name')
        );
        const snapshot = await window.firebaseGetDocs(q);

        allGuests = [];
        snapshot.forEach(doc => {
            allGuests.push({ id: doc.id, ...doc.data() });
        });

        renderGuests(allGuests);
        updateGuestStats();
    } catch (error) {
        console.error('Error loading guests:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Error loading guests</td></tr>';
    }
}

function renderGuests(guests) {
    const tbody = document.getElementById('guestsTableBody');

    if (guests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No guests yet. Add your first guest!</td></tr>';
        return;
    }

    tbody.innerHTML = guests.map(guest => `
        <tr data-id="${guest.id}">
            <td>${escapeHtml(guest.name)}</td>
            <td>${escapeHtml(guest.email || '-')}</td>
            <td>${guest.maxGuests || 2}</td>
            <td>
                <span class="status-badge ${guest.hasRsvped ? 'confirmed' : 'pending'}">
                    ${guest.hasRsvped ? 'RSVPed' : 'Pending'}
                </span>
            </td>
            <td>${escapeHtml(guest.notes || '-')}</td>
            <td class="actions">
                <button class="btn btn-secondary btn-small edit-guest-btn">Edit</button>
                <button class="btn btn-danger btn-small delete-guest-btn">Delete</button>
            </td>
        </tr>
    `).join('');

    // Attach event listeners
    tbody.querySelectorAll('.edit-guest-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            const guestId = row.dataset.id;
            editGuest(guestId);
        });
    });

    tbody.querySelectorAll('.delete-guest-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            const guestId = row.dataset.id;
            deleteGuest(guestId);
        });
    });
}

function updateGuestStats() {
    document.getElementById('totalGuests').textContent = allGuests.length;
    document.getElementById('rsvpedGuests').textContent = allGuests.filter(g => g.hasRsvped).length;
}

function initializeGuestHandlers() {
    const modal = document.getElementById('guestModal');
    const addBtn = document.getElementById('addGuestBtn');
    const saveBtn = document.getElementById('saveGuestBtn');
    const searchInput = document.getElementById('guestSearch');
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');

    // Add guest button
    addBtn.addEventListener('click', () => {
        document.getElementById('guestModalTitle').textContent = 'Add Guest';
        document.getElementById('guestForm').reset();
        document.getElementById('guestId').value = '';
        modal.style.display = 'flex';
    });

    // Save guest
    saveBtn.addEventListener('click', async () => {
        const guestId = document.getElementById('guestId').value;
        const guestData = {
            name: document.getElementById('guestName').value.trim(),
            nameLower: document.getElementById('guestName').value.trim().toLowerCase(),
            email: document.getElementById('guestEmail').value.trim() || null,
            maxGuests: parseInt(document.getElementById('maxGuests').value),
            notes: document.getElementById('guestNotes').value.trim() || null
        };

        if (!guestData.name) {
            alert('Please enter a name');
            return;
        }

        try {
            if (guestId) {
                // Update existing
                await window.firebaseUpdateDoc(
                    window.firebaseDoc(window.firebaseDb, 'guests', guestId),
                    guestData
                );
            } else {
                // Add new
                guestData.hasRsvped = false;
                guestData.addedAt = window.firebaseServerTimestamp();
                await window.firebaseAddDoc(
                    window.firebaseCollection(window.firebaseDb, 'guests'),
                    guestData
                );
            }

            modal.style.display = 'none';
            await loadGuests();
        } catch (error) {
            console.error('Error saving guest:', error);
            alert('Error saving guest. Please try again.');
        }
    });

    // Close modal handlers
    modal.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allGuests.filter(g =>
            g.name.toLowerCase().includes(query) ||
            (g.email && g.email.toLowerCase().includes(query))
        );
        renderGuests(filtered);
    });

    // Download template
    downloadTemplateBtn.addEventListener('click', () => {
        const template = [
            ['Name', 'Email', 'Max Guests', 'Notes'],
            ['John Smith', 'john@example.com', '2', 'Friend of groom'],
            ['Jane Doe', 'jane@example.com', '3', 'Cousin']
        ];

        const ws = XLSX.utils.aoa_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Guest Template');
        XLSX.writeFile(wb, 'guest_list_template.xlsx');
    });
}

function editGuest(guestId) {
    const guest = allGuests.find(g => g.id === guestId);
    if (!guest) return;

    document.getElementById('guestModalTitle').textContent = 'Edit Guest';
    document.getElementById('guestId').value = guestId;
    document.getElementById('guestName').value = guest.name;
    document.getElementById('guestEmail').value = guest.email || '';
    document.getElementById('maxGuests').value = guest.maxGuests || 2;
    document.getElementById('guestNotes').value = guest.notes || '';

    document.getElementById('guestModal').style.display = 'flex';
}

async function deleteGuest(guestId) {
    const guest = allGuests.find(g => g.id === guestId);
    if (!guest) return;

    if (!confirm(`Are you sure you want to delete "${guest.name}"?`)) {
        return;
    }

    try {
        await window.firebaseDeleteDoc(
            window.firebaseDoc(window.firebaseDb, 'guests', guestId)
        );
        await loadGuests();
    } catch (error) {
        console.error('Error deleting guest:', error);
        alert('Error deleting guest. Please try again.');
    }
}

// ============================================
// Excel/CSV Upload
// ============================================

let pendingImportData = [];

function initializeUploadHandlers() {
    const uploadInput = document.getElementById('uploadFile');
    const previewModal = document.getElementById('uploadPreview');
    const confirmImportBtn = document.getElementById('confirmImportBtn');

    uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const data = await parseFile(file);
            pendingImportData = data;
            showImportPreview(data);
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error reading file. Please make sure it\'s a valid Excel or CSV file.');
        }

        // Reset input so same file can be selected again
        uploadInput.value = '';
    });

    // Close preview modal
    previewModal.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            previewModal.style.display = 'none';
            pendingImportData = [];
        });
    });

    // Confirm import
    confirmImportBtn.addEventListener('click', async () => {
        const importMode = document.querySelector('input[name="importMode"]:checked').value;
        await importGuests(pendingImportData, importMode);
        previewModal.style.display = 'none';
        pendingImportData = [];
    });
}

async function parseFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // Parse rows (skip header)
                const guests = [];
                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    if (row[0] && row[0].toString().trim()) {
                        guests.push({
                            name: row[0].toString().trim(),
                            email: row[1] ? row[1].toString().trim() : null,
                            maxGuests: row[2] ? parseInt(row[2]) || 2 : 2,
                            notes: row[3] ? row[3].toString().trim() : null
                        });
                    }
                }

                resolve(guests);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function showImportPreview(data) {
    const tbody = document.querySelector('#previewTable tbody');
    tbody.innerHTML = data.map(guest => `
        <tr>
            <td>${escapeHtml(guest.name)}</td>
            <td>${escapeHtml(guest.email || '-')}</td>
            <td>${guest.maxGuests}</td>
            <td>${escapeHtml(guest.notes || '-')}</td>
        </tr>
    `).join('');

    document.getElementById('previewCount').textContent = `${data.length} guests will be imported`;
    document.getElementById('uploadPreview').style.display = 'flex';
}

async function importGuests(guests, mode) {
    try {
        const batch = window.firebaseWriteBatch(window.firebaseDb);

        // If replace mode, delete all existing guests first
        if (mode === 'replace') {
            for (const guest of allGuests) {
                const docRef = window.firebaseDoc(window.firebaseDb, 'guests', guest.id);
                batch.delete(docRef);
            }
        }

        // Add new guests
        for (const guest of guests) {
            const docRef = window.firebaseDoc(
                window.firebaseCollection(window.firebaseDb, 'guests')
            );
            batch.set(docRef, {
                name: guest.name,
                nameLower: guest.name.toLowerCase(),
                email: guest.email,
                maxGuests: guest.maxGuests,
                notes: guest.notes,
                hasRsvped: false,
                addedAt: window.firebaseServerTimestamp()
            });
        }

        await batch.commit();
        await loadGuests();
        alert(`Successfully imported ${guests.length} guests!`);
    } catch (error) {
        console.error('Error importing guests:', error);
        alert('Error importing guests. Please try again.');
    }
}

// ============================================
// Form Settings
// ============================================

const defaultSettings = {
    phone: true,
    guestNames: true,
    relationship: true,
    mealPreference: true,
    dietary: true,
    childrenCount: true,
    songRequest: true,
    transportNeeded: false,
    accommodationNeeded: false,
    specialRequests: true,
    message: true
};

async function loadSettings() {
    try {
        const docRef = window.firebaseDoc(window.firebaseDb, 'settings', 'formConfig');
        const docSnap = await window.firebaseGetDoc(docRef);

        let fields = defaultSettings;
        if (docSnap.exists() && docSnap.data().fields) {
            fields = { ...defaultSettings, ...docSnap.data().fields };
        }

        // Update checkboxes
        for (const [key, value] of Object.entries(fields)) {
            const checkbox = document.getElementById(`field-${key}`);
            if (checkbox) {
                checkbox.checked = value;
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function initializeSettingsHandlers() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    const messageDiv = document.getElementById('settingsMessage');

    saveBtn.addEventListener('click', async () => {
        const fields = {};
        document.querySelectorAll('.settings-grid input[type="checkbox"]').forEach(checkbox => {
            const fieldName = checkbox.id.replace('field-', '');
            fields[fieldName] = checkbox.checked;
        });

        try {
            await window.firebaseSetDoc(
                window.firebaseDoc(window.firebaseDb, 'settings', 'formConfig'),
                {
                    fields: fields,
                    updatedAt: window.firebaseServerTimestamp()
                }
            );

            messageDiv.textContent = 'Settings saved successfully!';
            messageDiv.style.display = 'block';
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings. Please try again.');
        }
    });
}

// ============================================
// RSVPs
// ============================================

let allRsvps = [];

async function loadRsvps() {
    const tbody = document.getElementById('rsvpsTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';

    try {
        const q = window.firebaseQuery(
            window.firebaseCollection(window.firebaseDb, 'rsvps'),
            window.firebaseOrderBy('createdAt', 'desc')
        );
        const snapshot = await window.firebaseGetDocs(q);

        allRsvps = [];
        snapshot.forEach(doc => {
            allRsvps.push({ id: doc.id, ...doc.data() });
        });

        renderRsvps(allRsvps);
        updateRsvpStats();
    } catch (error) {
        console.error('Error loading RSVPs:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Error loading RSVPs</td></tr>';
    }
}

function renderRsvps(rsvps) {
    const tbody = document.getElementById('rsvpsTableBody');

    if (rsvps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No RSVPs yet</td></tr>';
        return;
    }

    tbody.innerHTML = rsvps.map(rsvp => {
        const date = rsvp.createdAt?.toDate ? rsvp.createdAt.toDate() : new Date(rsvp.submittedAt);
        return `
            <tr>
                <td>${escapeHtml(rsvp.fullName)}</td>
                <td>${escapeHtml(rsvp.email)}</td>
                <td>
                    <span class="status-badge ${rsvp.attending === 'yes' ? 'confirmed' : 'declined'}">
                        ${rsvp.attending === 'yes' ? 'Yes' : 'No'}
                    </span>
                </td>
                <td>${rsvp.guestCount || 1}</td>
                <td>${escapeHtml(rsvp.mealPreference || '-')}</td>
                <td>${escapeHtml(rsvp.dietaryRestrictions || '-')}</td>
                <td>${escapeHtml(rsvp.message || '-')}</td>
                <td>${date.toLocaleDateString()}</td>
            </tr>
        `;
    }).join('');
}

function updateRsvpStats() {
    const attending = allRsvps.filter(r => r.attending === 'yes');
    const declined = allRsvps.filter(r => r.attending === 'no');
    const totalGuests = attending.reduce((sum, r) => sum + (r.guestCount || 1), 0);

    document.getElementById('totalRsvps').textContent = allRsvps.length;
    document.getElementById('attendingCount').textContent = attending.length;
    document.getElementById('declinedCount').textContent = declined.length;
    document.getElementById('totalGuestsCount').textContent = totalGuests;
}

function initializeRsvpHandlers() {
    const exportBtn = document.getElementById('exportRsvpsBtn');

    exportBtn.addEventListener('click', () => {
        if (allRsvps.length === 0) {
            alert('No RSVPs to export');
            return;
        }

        const exportData = allRsvps.map(rsvp => ({
            'Name': rsvp.fullName,
            'Email': rsvp.email,
            'Phone': rsvp.phone || '',
            'Attending': rsvp.attending === 'yes' ? 'Yes' : 'No',
            'Guest Count': rsvp.guestCount || 1,
            'Guest Names': rsvp.guestNames || '',
            'Relationship': rsvp.relationship || '',
            'Meal Preference': rsvp.mealPreference || '',
            'Dietary Restrictions': rsvp.dietaryRestrictions || '',
            'Children Count': rsvp.childrenCount || 0,
            'Children Ages': rsvp.childrenAges || '',
            'Song Request': rsvp.songRequest || '',
            'Transport Needed': rsvp.transportNeeded ? 'Yes' : 'No',
            'Accommodation Needed': rsvp.accommodationNeeded ? 'Yes' : 'No',
            'Special Requests': rsvp.specialRequests || '',
            'Message': rsvp.message || '',
            'Submitted': rsvp.createdAt?.toDate ? rsvp.createdAt.toDate().toLocaleDateString() : rsvp.submittedAt
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'RSVPs');
        XLSX.writeFile(wb, `rsvps_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
}

// ============================================
// Utilities
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
