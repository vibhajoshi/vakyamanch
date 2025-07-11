function setupLoginForm() {
    const form = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorDisplay = document.getElementById('login-error');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors
        errorDisplay.textContent = '';
        usernameInput.classList.remove('error');
        passwordInput.classList.remove('error');
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        // Client-side validation
        if (!username || !password) {
            errorDisplay.textContent = 'Both username and password are required!';
            if (!username) usernameInput.classList.add('error');
            if (!password) passwordInput.classList.add('error');
            return;
        }
        
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Successful login
                if (data.redirect) {
                    window.location.href = data.redirect;
                }
            } else {
                // Handle different error cases
                errorDisplay.textContent = data.error;
                
                // Highlight problematic field
                if (data.field === 'username') {
                    usernameInput.classList.add('error');
                    usernameInput.focus();
                } else if (data.field === 'password') {
                    passwordInput.classList.add('error');
                    passwordInput.focus();
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDisplay.textContent = 'An error occurred during login. Please try again.';
        }
    });
}

function setupRegisterForm() {
    const form = document.getElementById('register-form');
    const sendOtpBtn = document.getElementById('send-otp-btn');
    
    sendOtpBtn.addEventListener('click', async function() {
        const email = document.getElementById('email').value.trim();
        if (!email) {
            alert('Please enter your email first');
            return;
        }
        
        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = 'Sending...';
        
        try {
            const response = await fetch('/send_otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send OTP');
            }
            
            alert('OTP sent successfully! Check your email.');
            console.log('OTP (for testing):', data.otp); // Remove in production
        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'An error occurred while sending OTP');
        } finally {
            sendOtpBtn.disabled = false;
            sendOtpBtn.textContent = 'Send OTP';
        }
    });
    
    form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    const email = formData.get('email');
    const otp = formData.get('otp');
    
    // First verify OTP
    try {
        const verifyResponse = await fetch('/verify_otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                email: email,
                otp: otp 
            })
        });
        
        if (!verifyResponse.ok) {
            const errorData = await verifyResponse.json();
            throw new Error(errorData.error || 'OTP verification failed');
        }
        
        // Continue with registration
        const registerResponse = await fetch('/register', {
            method: 'POST',
            body: formData
        });
        
        if (registerResponse.redirected) {
            window.location.href = registerResponse.url;
            return;
        }
        
        const registerData = await registerResponse.json();
        
        if (registerResponse.ok) {
            alert('Registration successful! Please login.');
            window.location.href = '/login';
        } else {
            throw new Error(registerData.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
    }
});
}