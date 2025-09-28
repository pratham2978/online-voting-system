// Wait for the HTML document to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // --- Element Selection ---
    const registrationForm = document.querySelector('.registration-form');
    const dobInput = document.getElementById('dob');
    const aadhaarInput = document.getElementById('aadhaar');
    const togglePasswordIcons = document.querySelectorAll('.toggle-password');

    // --- 1. Password Visibility Toggle ---
    // Adds a click event to each eye icon to show/hide the password
    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const passwordInput = icon.previousElementSibling; // The input field is right before the icon
            
            // Toggle the input type between 'password' and 'text'
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // --- 2. Input Formatting ---
    // Automatically formats the Date of Birth input as DD-MM-YYYY
    dobInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); // Remove all non-digit characters
        if (value.length > 2) {
            value = value.substring(0, 2) + '-' + value.substring(2);
        }
        if (value.length > 5) {
            value = value.substring(0, 5) + '-' + value.substring(5, 9);
        }
        e.target.value = value;
    });

    // Automatically formats the Aadhaar number as XXXX XXXX XXXX
    aadhaarInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ''); // Remove all non-digit characters
        let formattedValue = '';
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formattedValue += ' ';
            }
            formattedValue += value[i];
        }
        e.target.value = formattedValue.substring(0, 14); // Ensure it doesn't exceed 12 digits + 2 spaces
    });


    // --- 3. Form Submission and Validation ---
    registrationForm.addEventListener('submit', async (event) => {
        // Prevent the default form submission which reloads the page
        event.preventDefault();

        // Get values from all form fields
        const fullName = document.getElementById('full-name').value.trim();
        const dob = document.getElementById('dob').value.trim();
        const gender = document.getElementById('gender').value;
        const streetAddress = document.getElementById('street-address').value.trim();
        const city = document.getElementById('city').value.trim();
        const state = document.getElementById('state').value.trim();
        const pincode = document.getElementById('pincode').value.trim();
        const email = document.getElementById('email-address').value.trim();
        const phone = document.getElementById('phone-number').value.trim();
        const aadhaar = document.getElementById('aadhaar').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const terms = document.getElementById('terms').checked;

        // --- Validation Checks ---
        
        // Check for empty required fields
        if (!fullName || !dob || !gender || !streetAddress || !city || !state || !pincode || !email || !phone || !aadhaar || !password || !confirmPassword) {
            alert('Please fill out all required fields.');
            return;
        }

        // Validate Pincode (must be 6 digits)
        if (!/^\d{6}$/.test(pincode)) {
            alert('Please enter a valid 6-digit pincode.');
            return;
        }

        // Validate Date of Birth and Age (must be 18+)
        const dobParts = dob.split('-');
        if (dobParts.length !== 3 || dobParts[2].length !== 4) {
            alert('Please enter your Date of Birth in DD-MM-YYYY format.');
            return;
        }
        const birthDate = new Date(dobParts[2], dobParts[1] - 1, dobParts[0]);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        const monthDiff = new Date().getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && new Date().getDate() < birthDate.getDate())) {
            // Adjust age if birthday hasn't occurred this year
            if (age - 1 < 18) {
                 alert('You must be at least 18 years old to register.');
                 return;
            }
        } else if (age < 18) {
            alert('You must be at least 18 years old to register.');
            return;
        }

        // Validate Phone Number (must be 10 digits starting with 6-9)
        if (!/^[6-9]\d{9}$/.test(phone)) {
            alert('Please enter a valid Indian phone number (10 digits starting with 6-9).');
            return;
        }

        // Validate Aadhaar Number (must be 12 digits)
        if (aadhaar.replace(/\s/g, '').length !== 12) {
            alert('Please enter a valid 12-digit Aadhaar number.');
            return;
        }

        // Validate Password Match
        if (password !== confirmPassword) {
            alert('Passwords do not match. Please re-enter.');
            return;
        }
        
        // Validate Password Strength (must match backend requirements)
        if (password.length < 8) {
            alert('Password must be at least 8 characters long.');
            return;
        }
        
        // Check for uppercase, lowercase, and number
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            alert('Password must contain at least one lowercase letter, one uppercase letter, and one number.');
            return;
        }
        
        // Check if Terms and Conditions are accepted
        if (!terms) {
            alert('You must agree to the Terms of Service and Privacy Policy.');
            return;
        }

        // --- If all validations pass ---
        console.log('Form Submitted Successfully!');
        
        // Prepare voter data for backend API
        // Convert date from DD-MM-YYYY to ISO format
        const dobPartsForAPI = dob.split('-');
        const dobISO = `${dobPartsForAPI[2]}-${dobPartsForAPI[1]}-${dobPartsForAPI[0]}`; // Convert to YYYY-MM-DD
        
        const voterData = {
            fullName,
            dateOfBirth: dobISO,
            gender: gender.toLowerCase(), // Convert to lowercase for backend validation
            email,
            phoneNumber: phone,
            aadhaarNumber: aadhaar,
            // Address object matching backend model structure
            address: {
                street: streetAddress,
                city: city,
                state: state,
                pincode: pincode
            },
            password: password
        };
        
        // Show loading state
        const submitButton = document.querySelector('.btn-register') || document.querySelector('.btn-primary');
        let originalText = '';
        if (submitButton) {
            originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>&nbsp; Registering...';
            submitButton.disabled = true;
        }
        
        try {
            // Call the registration API
            const response = await auth.register(voterData);
            
            if (response.success) {
                alert('✅ Registration Successful!\nYour account has been created. Redirecting to login page...');
                
                // Add a small delay before redirect for better user experience
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                alert('Registration failed: ' + response.message);
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed: ' + error.message);
        } finally {
            // Reset button state
            if (submitButton) {
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
        }
    });
});