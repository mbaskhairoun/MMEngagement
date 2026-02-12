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

            if (tab.dataset.tab === 'analytics') {
                renderAnalytics();
            }
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
    renderAnalytics();
}

// ============================================
// Guest Management
// ============================================

let allGuests = [];
let currentFamilyMembers = [];

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

    tbody.innerHTML = guests.map(guest => {
        const members = guest.familyMembers && guest.familyMembers.length > 0
            ? escapeHtml(guest.familyMembers.join(', '))
            : '<span style="color:#999">-</span>';
        return `
        <tr data-id="${guest.id}">
            <td>${escapeHtml(guest.name)}</td>
            <td>${members}</td>
            <td>${escapeHtml(guest.email || '-')}</td>
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
    `}).join('');

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
    const totalIndividuals = allGuests.reduce((sum, g) => sum + (g.familyMembers && g.familyMembers.length > 0 ? g.familyMembers.length : 1), 0);
    document.getElementById('totalGuests').textContent = `${allGuests.length} invitations / ${totalIndividuals} guests`;
    document.getElementById('rsvpedGuests').textContent = allGuests.filter(g => g.hasRsvped).length;
}

// ============================================
// Family Members Management
// ============================================

function renderFamilyMembersList() {
    const container = document.getElementById('familyMembersList');
    if (!container) return;

    container.innerHTML = currentFamilyMembers.map((member, idx) => `
        <div class="family-member-item">
            <span>${escapeHtml(member)}</span>
            <button type="button" class="btn btn-danger btn-small remove-member-btn" data-index="${idx}">&times;</button>
        </div>
    `).join('');

    container.querySelectorAll('.remove-member-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            currentFamilyMembers.splice(index, 1);
            renderFamilyMembersList();
        });
    });
}

function initializeFamilyMemberHandlers() {
    const addBtn = document.getElementById('addMemberBtn');
    const input = document.getElementById('newMemberName');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            addFamilyMember();
        });
    }

    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addFamilyMember();
            }
        });
    }
}

function addFamilyMember() {
    const input = document.getElementById('newMemberName');
    const name = input.value.trim();
    if (name) {
        currentFamilyMembers.push(name);
        input.value = '';
        renderFamilyMembersList();
        input.focus();
    }
}

// ============================================
// Guest Handlers
// ============================================

function initializeGuestHandlers() {
    const modal = document.getElementById('guestModal');
    const addBtn = document.getElementById('addGuestBtn');
    const saveBtn = document.getElementById('saveGuestBtn');
    const searchInput = document.getElementById('guestSearch');
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');

    // Initialize family member handlers
    initializeFamilyMemberHandlers();

    // Add guest button
    addBtn.addEventListener('click', () => {
        document.getElementById('guestModalTitle').textContent = 'Add Guest';
        document.getElementById('guestForm').reset();
        document.getElementById('guestId').value = '';
        currentFamilyMembers = [];
        renderFamilyMembersList();
        modal.style.display = 'flex';
    });

    // Save guest
    saveBtn.addEventListener('click', async () => {
        const guestId = document.getElementById('guestId').value;
        const invitationName = document.getElementById('guestName').value.trim();
        const members = [...currentFamilyMembers];

        // If no members added, treat the invitation name as the sole member
        if (members.length === 0) {
            members.push(invitationName);
        }

        const guestData = {
            name: invitationName,
            nameLower: invitationName.toLowerCase(),
            email: document.getElementById('guestEmail').value.trim() || null,
            familyMembers: members,
            familyMembersLower: members.map(m => m.toLowerCase()),
            notes: document.getElementById('guestNotes').value.trim() || null
        };

        if (!guestData.name) {
            alert('Please enter an invitation name');
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
            (g.email && g.email.toLowerCase().includes(query)) ||
            (g.familyMembers && g.familyMembers.some(m => m.toLowerCase().includes(query)))
        );
        renderGuests(filtered);
    });

    // Download template
    downloadTemplateBtn.addEventListener('click', () => {
        const template = [
            ['Invitation Name', 'Guest Name', 'Email', 'Notes'],
            ['Smith Family', 'John Smith', 'john@example.com', 'Friend of groom'],
            ['Smith Family', 'Jane Smith', '', ''],
            ['Smith Family', 'Billy Smith', '', ''],
            ['Sarah Lee', 'Sarah Lee', 'sarah@example.com', 'Solo guest']
        ];

        const ws = XLSX.utils.aoa_to_sheet(template);
        // Auto-size columns for readability
        ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 20 }];
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
    document.getElementById('guestNotes').value = guest.notes || '';

    currentFamilyMembers = guest.familyMembers ? [...guest.familyMembers] : [];
    renderFamilyMembersList();

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

                // Group rows by Invitation Name
                // Columns: Invitation Name, Guest Name, Email, Notes
                const invitationMap = {};
                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    const invitationName = row[0] ? row[0].toString().trim() : '';
                    const guestName = row[1] ? row[1].toString().trim() : '';
                    if (!invitationName || !guestName) continue;

                    if (!invitationMap[invitationName]) {
                        invitationMap[invitationName] = {
                            name: invitationName,
                            familyMembers: [],
                            email: null,
                            notes: null
                        };
                    }

                    invitationMap[invitationName].familyMembers.push(guestName);

                    // Use the first email found for this invitation
                    if (!invitationMap[invitationName].email && row[2]) {
                        invitationMap[invitationName].email = row[2].toString().trim();
                    }

                    // Use the first notes found for this invitation
                    if (!invitationMap[invitationName].notes && row[3]) {
                        invitationMap[invitationName].notes = row[3].toString().trim();
                    }
                }

                resolve(Object.values(invitationMap));
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
    const existingNames = new Set(allGuests.map(g => g.name.toLowerCase()));

    tbody.innerHTML = data.map(guest => {
        const isDuplicate = existingNames.has(guest.name.toLowerCase());
        return `
        <tr style="${isDuplicate ? 'opacity: 0.5;' : ''}">
            <td>${escapeHtml(guest.name)}${isDuplicate ? ' <span class="status-badge pending">Exists</span>' : ' <span class="status-badge confirmed">New</span>'}</td>
            <td>${escapeHtml(guest.familyMembers.join(', '))}</td>
            <td>${escapeHtml(guest.email || '-')}</td>
            <td>${escapeHtml(guest.notes || '-')}</td>
        </tr>
    `}).join('');

    const totalMembers = data.reduce((sum, g) => sum + g.familyMembers.length, 0);
    const newCount = data.filter(g => !existingNames.has(g.name.toLowerCase())).length;
    const dupCount = data.length - newCount;
    let previewText = `${data.length} invitations, ${totalMembers} total guests`;
    if (dupCount > 0) {
        previewText += ` — ${newCount} new, ${dupCount} already exist (skipped in "Add to existing" mode)`;
    }
    document.getElementById('previewCount').textContent = previewText;
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

        // Build set of existing names for dedup in append mode
        const existingNames = new Set(allGuests.map(g => g.name.toLowerCase()));
        let addedCount = 0;
        let skippedCount = 0;

        // Add new guests (skip duplicates in append mode)
        for (const guest of guests) {
            if (mode === 'append' && existingNames.has(guest.name.toLowerCase())) {
                skippedCount++;
                continue;
            }

            const docRef = window.firebaseDoc(
                window.firebaseCollection(window.firebaseDb, 'guests')
            );
            batch.set(docRef, {
                name: guest.name,
                nameLower: guest.name.toLowerCase(),
                email: guest.email,
                familyMembers: guest.familyMembers,
                familyMembersLower: guest.familyMembers.map(m => m.toLowerCase()),
                notes: guest.notes,
                hasRsvped: false,
                addedAt: window.firebaseServerTimestamp()
            });
            addedCount++;
        }

        await batch.commit();
        await loadGuests();

        let message = `Successfully added ${addedCount} new guest(s)!`;
        if (skippedCount > 0) {
            message += ` ${skippedCount} duplicate(s) were skipped.`;
        }
        alert(message);
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
    tbody.innerHTML = '<tr><td colspan="9" class="loading">Loading...</td></tr>';

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
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Error loading RSVPs</td></tr>';
    }
}

function renderRsvps(rsvps) {
    const tbody = document.getElementById('rsvpsTableBody');

    if (rsvps.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">No RSVPs yet</td></tr>';
        return;
    }

    tbody.innerHTML = rsvps.map(rsvp => {
        const date = rsvp.createdAt?.toDate ? rsvp.createdAt.toDate() : new Date(rsvp.submittedAt);
        const membersDisplay = rsvp.attendingMembers && rsvp.attendingMembers.length > 0
            ? escapeHtml(rsvp.attendingMembers.join(', '))
            : (rsvp.guestCount ? rsvp.guestCount + ' guest(s)' : '1 guest');
        return `
            <tr data-id="${rsvp.id}" data-guest-id="${rsvp.guestId || ''}">
                <td>${escapeHtml(rsvp.fullName)}</td>
                <td>${escapeHtml(rsvp.email)}</td>
                <td>
                    <span class="status-badge ${rsvp.attending === 'yes' ? 'confirmed' : 'declined'}">
                        ${rsvp.attending === 'yes' ? 'Yes' : 'No'}
                    </span>
                </td>
                <td>${membersDisplay}</td>
                <td>${escapeHtml(rsvp.mealPreference || '-')}</td>
                <td>${escapeHtml(rsvp.dietaryRestrictions || '-')}</td>
                <td>${escapeHtml(rsvp.message || '-')}</td>
                <td>${date.toLocaleDateString()}</td>
                <td class="actions">
                    <button class="btn btn-danger btn-small delete-rsvp-btn">Delete</button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach delete event listeners
    tbody.querySelectorAll('.delete-rsvp-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            const rsvpId = row.dataset.id;
            const guestId = row.dataset.guestId;
            deleteRsvp(rsvpId, guestId);
        });
    });
}

async function deleteRsvp(rsvpId, guestId) {
    const rsvp = allRsvps.find(r => r.id === rsvpId);
    if (!rsvp) return;

    if (!confirm(`Are you sure you want to delete the RSVP from "${rsvp.fullName}"?`)) {
        return;
    }

    try {
        // Delete the RSVP
        await window.firebaseDeleteDoc(
            window.firebaseDoc(window.firebaseDb, 'rsvps', rsvpId)
        );

        // Reset the guest's hasRsvped status if guestId exists
        if (guestId) {
            try {
                await window.firebaseUpdateDoc(
                    window.firebaseDoc(window.firebaseDb, 'guests', guestId),
                    { hasRsvped: false }
                );
            } catch (e) {
                console.log('Could not update guest status:', e);
            }
        }

        // Reload data
        await loadRsvps();
        await loadGuests();
    } catch (error) {
        console.error('Error deleting RSVP:', error);
        alert('Error deleting RSVP. Please try again.');
    }
}

function updateRsvpStats() {
    const attending = allRsvps.filter(r => r.attending === 'yes');
    const declined = allRsvps.filter(r => r.attending === 'no');
    const totalGuests = attending.reduce((sum, r) => sum + (r.totalAttending || r.guestCount || 1), 0);

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
            'Total Attending': rsvp.totalAttending || rsvp.guestCount || 1,
            'Attending Members': rsvp.attendingMembers ? rsvp.attendingMembers.join(', ') : (rsvp.guestNames || ''),
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
// Analytics
// ============================================

let analyticsCharts = {};

function renderAnalytics() {
    if (!allGuests.length && !allRsvps.length) return;

    const totalHouseholds = allGuests.length;
    const totalIndividuals = allGuests.reduce((sum, g) => sum + (g.familyMembers && g.familyMembers.length > 0 ? g.familyMembers.length : 1), 0);
    const rsvpedHouseholds = allRsvps.length;
    const responseRate = totalHouseholds > 0 ? Math.round((rsvpedHouseholds / totalHouseholds) * 100) : 0;
    const attendingRsvps = allRsvps.filter(r => r.attending === 'yes');
    const declinedRsvps = allRsvps.filter(r => r.attending === 'no');
    const attendanceRate = rsvpedHouseholds > 0 ? Math.round((attendingRsvps.length / rsvpedHouseholds) * 100) : 0;
    const totalHeadcount = attendingRsvps.reduce((sum, r) => sum + (r.totalAttending || r.guestCount || 1), 0);
    const pendingCount = totalHouseholds - rsvpedHouseholds;

    document.getElementById('analyticsHouseholds').textContent = totalHouseholds;
    document.getElementById('analyticsTotalIndividuals').textContent = totalIndividuals;
    document.getElementById('analyticsResponseRate').textContent = responseRate + '%';
    document.getElementById('analyticsAttendanceRate').textContent = attendanceRate + '%';
    document.getElementById('analyticsHeadcount').textContent = totalHeadcount;
    document.getElementById('analyticsDeclined').textContent = declinedRsvps.length;
    document.getElementById('analyticsPending').textContent = pendingCount;

    renderRsvpTimelineChart();
    renderAttendanceChart(attendingRsvps.length, declinedRsvps.length, pendingCount);
    renderMealChart();
    renderFamilySizeChart();
}

function renderRsvpTimelineChart() {
    const ctx = document.getElementById('rsvpTimelineChart');
    if (!ctx) return;

    const dateMap = {};
    allRsvps.forEach(rsvp => {
        const date = rsvp.createdAt?.toDate
            ? rsvp.createdAt.toDate().toLocaleDateString()
            : new Date(rsvp.submittedAt).toLocaleDateString();
        dateMap[date] = (dateMap[date] || 0) + 1;
    });

    const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(a) - new Date(b));
    let cumulative = 0;
    const cumulativeData = sortedDates.map(d => { cumulative += dateMap[d]; return cumulative; });

    if (analyticsCharts.timeline) analyticsCharts.timeline.destroy();

    analyticsCharts.timeline = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Cumulative RSVPs',
                data: cumulativeData,
                borderColor: '#5a7a5c',
                backgroundColor: 'rgba(90, 122, 92, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
}

function renderAttendanceChart(attending, declined, pending) {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;

    if (analyticsCharts.attendance) analyticsCharts.attendance.destroy();

    analyticsCharts.attendance = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Attending', 'Declined', 'Pending'],
            datasets: [{
                data: [attending, declined, pending],
                backgroundColor: ['#28a745', '#dc3545', '#ffc107']
            }]
        },
        options: { responsive: true }
    });
}

function renderMealChart() {
    const ctx = document.getElementById('mealChart');
    if (!ctx) return;

    const mealCounts = {};
    allRsvps.filter(r => r.attending === 'yes' && r.mealPreference).forEach(r => {
        const label = r.mealPreference.charAt(0).toUpperCase() + r.mealPreference.slice(1);
        mealCounts[label] = (mealCounts[label] || 0) + 1;
    });

    if (analyticsCharts.meal) analyticsCharts.meal.destroy();

    analyticsCharts.meal = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: Object.keys(mealCounts),
            datasets: [{
                data: Object.values(mealCounts),
                backgroundColor: ['#5a7a5c', '#8ba888', '#b4c9b3', '#d4af37', '#e8d48b', '#f7e7ce']
            }]
        },
        options: { responsive: true }
    });
}

function renderFamilySizeChart() {
    const ctx = document.getElementById('familySizeChart');
    if (!ctx) return;

    const sizeCounts = {};
    allGuests.forEach(g => {
        const size = g.familyMembers && g.familyMembers.length > 0 ? g.familyMembers.length : 1;
        const label = size === 1 ? '1 (Solo)' : size + ' members';
        sizeCounts[label] = (sizeCounts[label] || 0) + 1;
    });

    // Sort by family size
    const sortedLabels = Object.keys(sizeCounts).sort((a, b) => parseInt(a) - parseInt(b));
    const sortedData = sortedLabels.map(l => sizeCounts[l]);

    if (analyticsCharts.familySize) analyticsCharts.familySize.destroy();

    analyticsCharts.familySize = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: sortedLabels,
            datasets: [{
                label: 'Households',
                data: sortedData,
                backgroundColor: '#5a7a5c'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
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
