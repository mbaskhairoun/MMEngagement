// ============================================
// RSVP Form Handling
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('rsvpForm');
    const submitBtn = form.querySelector('.submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const formMessage = document.getElementById('formMessage');

    // Smooth scroll for scroll indicator
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', function() {
            document.querySelector('.story-section').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }

    // Form submission handler
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Collect form data
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            guests: document.getElementById('guests').value,
            attending: document.querySelector('input[name="attending"]:checked').value,
            dietary: document.getElementById('dietary').value,
            message: document.getElementById('message').value,
            timestamp: new Date().toISOString()
        };

        // Disable submit button and show loading state
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        formMessage.style.display = 'none';

        try {
            // Simulate form submission (replace with actual backend endpoint)
            await submitRSVP(formData);

            // Show success message
            showMessage('success', 'Thank you for your RSVP! We\'re excited to celebrate with you.');

            // Reset form
            form.reset();

            // Store RSVP in localStorage for backup
            saveToLocalStorage(formData);

        } catch (error) {
            // Show error message
            showMessage('error', 'Oops! Something went wrong. Please try again or contact us directly.');
            console.error('RSVP submission error:', error);
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    });

    // Function to simulate RSVP submission
    async function submitRSVP(data) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Here you would typically send the data to your backend
        // Example:
        // const response = await fetch('/api/rsvp', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify(data)
        // });
        //
        // if (!response.ok) {
        //     throw new Error('Failed to submit RSVP');
        // }
        //
        // return await response.json();

        console.log('RSVP Data:', data);
        return { success: true };
    }

    // Function to display form messages
    function showMessage(type, text) {
        formMessage.className = `form-message ${type}`;
        formMessage.textContent = text;
        formMessage.style.display = 'block';

        // Scroll to message
        formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Auto-hide success message after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                formMessage.style.display = 'none';
            }, 5000);
        }
    }

    // Function to save RSVP to localStorage
    function saveToLocalStorage(data) {
        try {
            let rsvps = JSON.parse(localStorage.getItem('rsvps') || '[]');
            rsvps.push(data);
            localStorage.setItem('rsvps', JSON.stringify(rsvps));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
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
            // Remove active class from all radio options
            document.querySelectorAll('.radio-option').forEach(option => {
                option.classList.remove('active');
            });
            // Add active class to selected option
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
