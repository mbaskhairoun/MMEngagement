// ============================================
// RSVP Form with Guest Verification & Firebase
// ============================================

let currentGuest = null;
let existingRsvp = null;
let formSettings = null;

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scroll for scroll indicator
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', function() {
            document.querySelector('.story-section').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }

    // Wait for Firebase to initialize
    const waitForFirebase = setInterval(() => {
        if (window.firebaseDb) {
            clearInterval(waitForFirebase);
            initializeRsvpSystem();
        }
    }, 100);
});

async function initializeRsvpSystem() {
    // Load form settings
    await loadFormSettings();

    // Initialize verification
    initializeVerification();

    // Initialize form handlers
    initializeFormHandlers();
}

// ============================================
// Form Settings
// ============================================

async function loadFormSettings() {
    try {
        const docRef = window.firebaseDoc(window.firebaseDb, 'settings', 'formConfig');
        const docSnap = await window.firebaseGetDoc(docRef);

        if (docSnap.exists() && docSnap.data().fields) {
            formSettings = docSnap.data().fields;
        } else {
            // Default settings - show all fields
            formSettings = {
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
        }

        applyFormSettings();
    } catch (error) {
        console.error('Error loading form settings:', error);
    }
}

function applyFormSettings() {
    const fieldMappings = {
        phone: 'phone',
        guestNames: 'guestNames',
        relationship: 'relationship',
        mealPreference: 'mealPreference',
        dietary: 'dietary',
        childrenCount: 'childrenCount',
        songRequest: 'songRequest',
        transportNeeded: 'transportNeeded',
        accommodationNeeded: 'accommodationNeeded',
        specialRequests: 'specialRequests',
        message: 'message'
    };

    for (const [setting, fieldId] of Object.entries(fieldMappings)) {
        const field = document.getElementById(fieldId);
        if (field) {
            const formGroup = field.closest('.form-group');
            if (formGroup) {
                if (formSettings[setting]) {
                    formGroup.classList.remove('hidden');
                } else {
                    formGroup.classList.add('hidden');
                }
            }
        }
    }

    // Handle checkbox groups (transport, accommodation)
    const checkboxMappings = {
        transportNeeded: 'transportNeeded',
        accommodationNeeded: 'accommodationNeeded'
    };

    for (const [setting, fieldId] of Object.entries(checkboxMappings)) {
        const field = document.getElementById(fieldId);
        if (field) {
            const checkboxGroup = field.closest('.checkbox-group');
            if (checkboxGroup) {
                if (formSettings[setting]) {
                    checkboxGroup.classList.remove('hidden');
                } else {
                    checkboxGroup.classList.add('hidden');
                }
            }
        }
    }
}

// ============================================
// Guest Verification
// ============================================

function initializeVerification() {
    const verifyBtn = document.getElementById('verifyBtn');
    const verifyNameInput = document.getElementById('verifyName');
    const changeGuestBtn = document.getElementById('changeGuestBtn');

    verifyBtn.addEventListener('click', handleVerification);

    verifyNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleVerification();
        }
    });

    changeGuestBtn.addEventListener('click', () => {
        resetToVerification();
    });
}

async function handleVerification() {
    const verifyBtn = document.getElementById('verifyBtn');
    const btnText = verifyBtn.querySelector('.btn-text');
    const btnLoading = verifyBtn.querySelector('.btn-loading');
    const verifyError = document.getElementById('verifyError');
    const verifyName = document.getElementById('verifyName').value.trim();

    if (!verifyName) {
        showVerifyError('Please enter your name');
        return;
    }

    // Show loading
    verifyBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    verifyError.style.display = 'none';

    try {
        // Search for guest by name (case-insensitive)
        const nameLower = verifyName.toLowerCase();
        const q = window.firebaseQuery(
            window.firebaseCollection(window.firebaseDb, 'guests'),
            window.firebaseWhere('nameLower', '==', nameLower)
        );

        const snapshot = await window.firebaseGetDocs(q);

        if (snapshot.empty) {
            // Try partial/fuzzy match
            const allGuestsSnapshot = await window.firebaseGetDocs(
                window.firebaseCollection(window.firebaseDb, 'guests')
            );

            let foundGuest = null;
            allGuestsSnapshot.forEach(doc => {
                const guestData = doc.data();
                const guestNameLower = guestData.nameLower || guestData.name.toLowerCase();
                // Check if entered name is contained in guest name or vice versa
                if (guestNameLower.includes(nameLower) || nameLower.includes(guestNameLower)) {
                    foundGuest = { id: doc.id, ...guestData };
                }
            });

            if (foundGuest) {
                currentGuest = foundGuest;
                await checkExistingRsvp();
                showRsvpForm();
            } else {
                showVerifyError('We couldn\'t find your name on our guest list. Please enter your name exactly as it appears on your invitation, or contact us for assistance.');
            }
        } else {
            // Found exact match
            const doc = snapshot.docs[0];
            currentGuest = { id: doc.id, ...doc.data() };
            await checkExistingRsvp();
            showRsvpForm();
        }
    } catch (error) {
        console.error('Verification error:', error);
        showVerifyError('Something went wrong. Please try again.');
    } finally {
        verifyBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

async function checkExistingRsvp() {
    try {
        // Check if this guest has already submitted an RSVP
        const q = window.firebaseQuery(
            window.firebaseCollection(window.firebaseDb, 'rsvps'),
            window.firebaseWhere('guestId', '==', currentGuest.id)
        );

        const snapshot = await window.firebaseGetDocs(q);

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            existingRsvp = { id: doc.id, ...doc.data() };
        } else {
            existingRsvp = null;
        }
    } catch (error) {
        console.error('Error checking existing RSVP:', error);
        existingRsvp = null;
    }
}

function showVerifyError(message) {
    const verifyError = document.getElementById('verifyError');
    verifyError.textContent = message;
    verifyError.style.display = 'block';
}

function showRsvpForm() {
    const verificationStep = document.getElementById('verificationStep');
    const rsvpForm = document.getElementById('rsvpForm');
    const guestDisplayName = document.getElementById('guestDisplayName');
    const editingNotice = document.getElementById('editingNotice');
    const nameInput = document.getElementById('name');
    const guestDocIdInput = document.getElementById('guestDocId');
    const existingRsvpIdInput = document.getElementById('existingRsvpId');
    const guestsSelect = document.getElementById('guests');

    // Hide verification, show form
    verificationStep.style.display = 'none';
    rsvpForm.style.display = 'block';

    // Set guest info
    guestDisplayName.textContent = currentGuest.name;
    nameInput.value = currentGuest.name;
    guestDocIdInput.value = currentGuest.id;

    // Update max guests dropdown based on guest's allowed limit
    updateGuestDropdown(currentGuest.maxGuests || 2);

    // If editing existing RSVP, populate the form
    if (existingRsvp) {
        editingNotice.style.display = 'block';
        existingRsvpIdInput.value = existingRsvp.id;
        populateFormWithExistingRsvp();
    } else {
        editingNotice.style.display = 'none';
        existingRsvpIdInput.value = '';
    }

    // Scroll to form
    rsvpForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateGuestDropdown(maxGuests) {
    const guestsSelect = document.getElementById('guests');
    guestsSelect.innerHTML = '';

    for (let i = 1; i <= maxGuests; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i === 1 ? '1 (Just me)' : `${i} Guests`;
        guestsSelect.appendChild(option);
    }
}

function populateFormWithExistingRsvp() {
    const rsvp = existingRsvp;

    // Set email
    if (rsvp.email) {
        document.getElementById('email').value = rsvp.email;
    }

    // Set phone
    if (rsvp.phone) {
        document.getElementById('phone').value = rsvp.phone;
    }

    // Set attending
    if (rsvp.attending) {
        const radio = document.querySelector(`input[name="attending"][value="${rsvp.attending}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // Set guests count
    if (rsvp.guestCount) {
        document.getElementById('guests').value = rsvp.guestCount;
        document.getElementById('guests').dispatchEvent(new Event('change'));
    }

    // Set other fields
    const fieldMappings = {
        guestNames: 'guestNames',
        relationship: 'relationship',
        mealPreference: 'mealPreference',
        dietaryRestrictions: 'dietary',
        childrenCount: 'childrenCount',
        childrenAges: 'childrenAges',
        songRequest: 'songRequest',
        specialRequests: 'specialRequests',
        message: 'message'
    };

    for (const [rsvpField, formField] of Object.entries(fieldMappings)) {
        const element = document.getElementById(formField);
        if (element && rsvp[rsvpField]) {
            element.value = rsvp[rsvpField];
            element.dispatchEvent(new Event('change'));
        }
    }

    // Set checkboxes
    if (rsvp.transportNeeded) {
        document.getElementById('transportNeeded').checked = true;
    }
    if (rsvp.accommodationNeeded) {
        document.getElementById('accommodationNeeded').checked = true;
    }
}

function resetToVerification() {
    const verificationStep = document.getElementById('verificationStep');
    const rsvpForm = document.getElementById('rsvpForm');

    // Reset state
    currentGuest = null;
    existingRsvp = null;

    // Reset form
    rsvpForm.reset();
    document.getElementById('attendingFields').style.display = 'none';
    document.getElementById('guestNamesGroup').style.display = 'none';
    document.getElementById('childrenAgesGroup').style.display = 'none';

    // Show verification
    rsvpForm.style.display = 'none';
    verificationStep.style.display = 'block';
    document.getElementById('verifyName').value = '';
    document.getElementById('verifyError').style.display = 'none';

    // Scroll to verification
    verificationStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// Form Handlers
// ============================================

function initializeFormHandlers() {
    const form = document.getElementById('rsvpForm');
    const submitBtn = form.querySelector('.submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const formMessage = document.getElementById('formMessage');
    const attendingFields = document.getElementById('attendingFields');
    const guestNamesGroup = document.getElementById('guestNamesGroup');
    const childrenAgesGroup = document.getElementById('childrenAgesGroup');

    // Show/hide attending fields based on RSVP response
    const attendingRadios = document.querySelectorAll('input[name="attending"]');
    attendingRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'yes') {
                attendingFields.style.display = 'block';
                document.getElementById('guests').setAttribute('required', 'required');
            } else {
                attendingFields.style.display = 'none';
                document.getElementById('guests').removeAttribute('required');
            }
        });
    });

    // Show/hide guest names field based on guest count
    const guestsSelect = document.getElementById('guests');
    guestsSelect.addEventListener('change', function() {
        if (parseInt(this.value) > 1 && formSettings.guestNames) {
            guestNamesGroup.style.display = 'block';
        } else {
            guestNamesGroup.style.display = 'none';
        }
    });

    // Show/hide children ages field based on children count
    const childrenCountSelect = document.getElementById('childrenCount');
    if (childrenCountSelect) {
        childrenCountSelect.addEventListener('change', function() {
            if (parseInt(this.value) > 0) {
                childrenAgesGroup.style.display = 'block';
            } else {
                childrenAgesGroup.style.display = 'none';
            }
        });
    }

    // Form submission handler
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const attendingValue = document.querySelector('input[name="attending"]:checked')?.value;

        if (!attendingValue) {
            showMessage('error', 'Please select whether you will be attending.');
            return;
        }

        // Collect form data
        const formData = {
            // Link to guest
            guestId: document.getElementById('guestDocId').value,

            // Basic info
            fullName: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim().toLowerCase(),
            phone: document.getElementById('phone').value.trim() || null,

            // Attendance
            attending: attendingValue,
            rsvpStatus: attendingValue === 'yes' ? 'confirmed' : 'declined',

            // Guest details (only if attending)
            guestCount: attendingValue === 'yes' ? parseInt(document.getElementById('guests').value) : 0,
            guestNames: attendingValue === 'yes' ? (document.getElementById('guestNames').value.trim() || null) : null,
            relationship: attendingValue === 'yes' ? (document.getElementById('relationship').value || null) : null,

            // Meal preferences
            mealPreference: attendingValue === 'yes' ? (document.getElementById('mealPreference').value || null) : null,
            dietaryRestrictions: attendingValue === 'yes' ? (document.getElementById('dietary').value.trim() || null) : null,

            // Children
            childrenCount: attendingValue === 'yes' ? parseInt(document.getElementById('childrenCount')?.value || 0) : 0,
            childrenAges: attendingValue === 'yes' ? (document.getElementById('childrenAges')?.value.trim() || null) : null,

            // Extras
            songRequest: attendingValue === 'yes' ? (document.getElementById('songRequest')?.value.trim() || null) : null,
            transportNeeded: attendingValue === 'yes' ? (document.getElementById('transportNeeded')?.checked || false) : false,
            accommodationNeeded: attendingValue === 'yes' ? (document.getElementById('accommodationNeeded')?.checked || false) : false,
            specialRequests: attendingValue === 'yes' ? (document.getElementById('specialRequests')?.value.trim() || null) : null,

            // Message
            message: document.getElementById('message')?.value.trim() || null,

            // Metadata
            submittedAt: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        // Disable submit button and show loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        formMessage.style.display = 'none';

        try {
            const existingRsvpId = document.getElementById('existingRsvpId').value;

            if (existingRsvpId) {
                // Update existing RSVP
                await window.firebaseUpdateDoc(
                    window.firebaseDoc(window.firebaseDb, 'rsvps', existingRsvpId),
                    {
                        ...formData,
                        updatedAt: window.firebaseServerTimestamp()
                    }
                );
            } else {
                // Create new RSVP
                await window.firebaseAddDoc(
                    window.firebaseCollection(window.firebaseDb, 'rsvps'),
                    {
                        ...formData,
                        createdAt: window.firebaseServerTimestamp()
                    }
                );

                // Mark guest as having RSVPed
                await window.firebaseUpdateDoc(
                    window.firebaseDoc(window.firebaseDb, 'guests', currentGuest.id),
                    { hasRsvped: true }
                );
            }

            // Show success message
            const successMsg = existingRsvpId
                ? "Your RSVP has been updated successfully!"
                : (formData.attending === 'yes'
                    ? "Thank you for your RSVP! We're so excited to celebrate with you!"
                    : "Thank you for letting us know. We'll miss you and hope to see you soon!");

            showMessage('success', successMsg);

            // Reset to verification after success
            setTimeout(() => {
                resetToVerification();
            }, 5000);

        } catch (error) {
            showMessage('error', 'Oops! Something went wrong. Please try again or contact us directly.');
            console.error('RSVP submission error:', error);
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    });

    // Form validation styling
    const inputs = form.querySelectorAll('input[required], select[required]');
    inputs.forEach(input => {
        input.addEventListener('invalid', function() {
            this.classList.add('error');
        });

        input.addEventListener('input', function() {
            if (this.validity.valid) {
                this.classList.remove('error');
            }
        });
    });

    // Radio button styling enhancement
    const radioInputs = document.querySelectorAll('input[type="radio"]');
    radioInputs.forEach(radio => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.radio-option').forEach(option => {
                option.classList.remove('active');
            });
            if (this.checked) {
                this.closest('.radio-option').classList.add('active');
            }
        });
    });
}

function showMessage(type, text) {
    const formMessage = document.getElementById('formMessage');
    formMessage.className = `form-message ${type}`;
    formMessage.textContent = text;
    formMessage.style.display = 'block';

    formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (type === 'success') {
        setTimeout(() => {
            formMessage.style.display = 'none';
        }, 10000);
    }
}

// ============================================
// Additional Features
// ============================================

// Add animation on scroll
document.addEventListener('DOMContentLoaded', function() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animatedElements = document.querySelectorAll('.detail-card, .story-image-wrapper');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });
});

// Add parallax effect to hero section
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const heroSection = document.querySelector('.hero-section');

    if (heroSection) {
        heroSection.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

// Add smooth reveal animation for sections
document.addEventListener('DOMContentLoaded', function() {
    const sections = document.querySelectorAll('section');

    const revealSection = function(entries, observer) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('section-visible');
                observer.unobserve(entry.target);
            }
        });
    };

    const sectionObserver = new IntersectionObserver(revealSection, {
        root: null,
        threshold: 0.15,
    });

    sections.forEach(section => {
        sectionObserver.observe(section);
    });
});
