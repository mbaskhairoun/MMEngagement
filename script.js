// ============================================
// RSVP Form Handling with Firebase Firestore
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('rsvpForm');
    const submitBtn = form.querySelector('.submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const formMessage = document.getElementById('formMessage');
    const attendingFields = document.getElementById('attendingFields');
    const guestNamesGroup = document.getElementById('guestNamesGroup');
    const childrenAgesGroup = document.getElementById('childrenAgesGroup');

    // Smooth scroll for scroll indicator
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', function() {
            document.querySelector('.story-section').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }

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
        if (parseInt(this.value) > 1) {
            guestNamesGroup.style.display = 'block';
        } else {
            guestNamesGroup.style.display = 'none';
        }
    });

    // Show/hide children ages field based on children count
    const childrenCountSelect = document.getElementById('childrenCount');
    childrenCountSelect.addEventListener('change', function() {
        if (parseInt(this.value) > 0) {
            childrenAgesGroup.style.display = 'block';
        } else {
            childrenAgesGroup.style.display = 'none';
        }
    });

    // Form submission handler
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const attendingValue = document.querySelector('input[name="attending"]:checked')?.value;

        // Collect form data
        const formData = {
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
            childrenCount: attendingValue === 'yes' ? parseInt(document.getElementById('childrenCount').value) : 0,
            childrenAges: attendingValue === 'yes' ? (document.getElementById('childrenAges').value.trim() || null) : null,

            // Extras
            songRequest: attendingValue === 'yes' ? (document.getElementById('songRequest').value.trim() || null) : null,
            transportNeeded: attendingValue === 'yes' ? document.getElementById('transportNeeded').checked : false,
            accommodationNeeded: attendingValue === 'yes' ? document.getElementById('accommodationNeeded').checked : false,
            specialRequests: attendingValue === 'yes' ? (document.getElementById('specialRequests').value.trim() || null) : null,

            // Message
            message: document.getElementById('message').value.trim() || null,

            // Metadata
            submittedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,

            // Admin fields (for future use)
            inviteSentDate: null,
            tableAssignment: null,
            adminNotes: null,
            lastUpdated: null,
            checkedIn: false,
            checkedInAt: null
        };

        // Disable submit button and show loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        formMessage.style.display = 'none';

        try {
            // Submit to Firebase Firestore
            await submitRSVP(formData);

            // Show success message
            const successMsg = formData.attending === 'yes'
                ? "Thank you for your RSVP! We're so excited to celebrate with you!"
                : "Thank you for letting us know. We'll miss you and hope to see you soon!";
            showMessage('success', successMsg);

            // Reset form
            form.reset();
            attendingFields.style.display = 'none';
            guestNamesGroup.style.display = 'none';
            childrenAgesGroup.style.display = 'none';

        } catch (error) {
            showMessage('error', 'Oops! Something went wrong. Please try again or contact us directly.');
            console.error('RSVP submission error:', error);
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    });

    // Function to submit RSVP to Firebase
    async function submitRSVP(data) {
        // Wait for Firebase to be ready
        let attempts = 0;
        while (!window.firebaseDb && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!window.firebaseDb) {
            throw new Error('Firebase not initialized');
        }

        // Add document to Firestore
        const docRef = await window.firebaseAddDoc(
            window.firebaseCollection(window.firebaseDb, 'rsvps'),
            {
                ...data,
                createdAt: window.firebaseServerTimestamp()
            }
        );

        console.log('RSVP submitted with ID:', docRef.id);
        return docRef;
    }

    // Function to display form messages
    function showMessage(type, text) {
        formMessage.className = `form-message ${type}`;
        formMessage.textContent = text;
        formMessage.style.display = 'block';

        formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (type === 'success') {
            setTimeout(() => {
                formMessage.style.display = 'none';
            }, 8000);
        }
    }

    // Add animation on scroll
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
    const animatedElements = document.querySelectorAll('.detail-card, .story-image-wrapper, .rsvp-form');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
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
});

// ============================================
// Additional Features
// ============================================

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
