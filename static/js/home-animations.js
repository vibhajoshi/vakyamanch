document.addEventListener('DOMContentLoaded', function() {
    // Initialize animations when elements come into view
    const animateOnScroll = function() {
        const elements = document.querySelectorAll('.animate__animated');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const screenPosition = window.innerHeight / 1.3;
            
            if (elementPosition < screenPosition) {
                const animationClass = Array.from(element.classList)
                    .find(cls => cls.startsWith('animate__'));
                
                if (animationClass) {
                    element.style.opacity = '1';
                    
                    // Add small delay for staggered animations
                    const delay = element.dataset.delay || '0s';
                    element.style.animationDelay = delay;
                }
            }
        });
    };

    // Run on load and scroll
    window.addEventListener('load', animateOnScroll);
    window.addEventListener('scroll', animateOnScroll);

    // Add hover effect to feature cards
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-10px)';
            card.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.15)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.boxShadow = '';
        });
    });

    // Simple testimonial slider
    const testimonials = document.querySelectorAll('.testimonial');
    let currentTestimonial = 0;
    
    function showTestimonial(index) {
        testimonials.forEach((testimonial, i) => {
            testimonial.style.display = i === index ? 'block' : 'none';
        });
    }
    
    // Auto-rotate testimonials every 5 seconds
    setInterval(() => {
        currentTestimonial = (currentTestimonial + 1) % testimonials.length;
        showTestimonial(currentTestimonial);
    }, 5000);
    
    // Show first testimonial initially
    showTestimonial(0);
});

document.addEventListener('DOMContentLoaded', function() {
    // Create floating particles
    createParticles();
    
    // Add hover effects to post cards
    setupPostHoverEffects();
    
    // Add subtle animations to elements as they come into view
    setupScrollAnimations();
    
    // Add typewriter effect to hero text
    setupTypewriterEffect();
});

function createParticles() {
    const container = document.createElement('div');
    container.className = 'particles-container';
    document.body.appendChild(container);
    
    // Create particles
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random properties
        const size = Math.random() * 10 + 5;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.top = `${posY}%`;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;
        
        container.appendChild(particle);
    }
}

function setupPostHoverEffects() {
    const posts = document.querySelectorAll('.post-card, .post');
    
    posts.forEach(post => {
        post.addEventListener('mouseenter', () => {
            post.style.transform = 'translateY(-5px)';
            post.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.15)';
        });
        
        post.addEventListener('mouseleave', () => {
            post.style.transform = 'translateY(0)';
            post.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        });
    });
}

function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    document.querySelectorAll('.feature, .post-card, .post, blockquote').forEach(el => {
        observer.observe(el);
    });
}

function setupTypewriterEffect() {
    const heroText = document.querySelector('.tagline');
    if (heroText) {
        heroText.classList.add('typewriter');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Create floating particles
    const heroParticles = document.getElementById('heroParticles');
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random properties
        const size = Math.random() * 10 + 5;
        const posX = Math.random() * 100;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${delay}s`;
        
        heroParticles.appendChild(particle);
    }
    
    // Animate features on scroll
    const features = document.querySelectorAll('.feature');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('slide-in');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    features.forEach(feature => {
        observer.observe(feature);
    });
    
    // Smooth scroll for "Discover More" button
    const scrollDown = document.querySelector('.scroll-down');
    if (scrollDown) {
        scrollDown.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelector('.features-section').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }
});

