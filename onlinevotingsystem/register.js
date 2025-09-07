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
    registrationForm.addEventListener('submit', (event) => {
        // Prevent the default form submission which reloads the page
        event.preventDefault();

        // Get values from all form fields
        const fullName = document.getElementById('full-name').value.trim();
        const dob = document.getElementById('dob').value.trim();
        const gender = document.getElementById('gender').value;
        const address = document.getElementById('address').value.trim();
        const email = document.getElementById('email-address').value.trim();
        const phone = document.getElementById('phone-number').value.trim();
        const aadhaar = document.getElementById('aadhaar').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const terms = document.getElementById('terms').checked;

        // --- Validation Checks ---
        
        // Check for empty required fields
        if (!fullName || !dob || !gender || !address || !email || !phone || !aadhaar || !password || !confirmPassword) {
            alert('Please fill out all required fields.');
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

        // Validate Phone Number (must be 10 digits)
        if (!/^\d{10}$/.test(phone)) {
            alert('Please enter a valid 10-digit phone number.');
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
        
        // Validate Password Strength (e.g., at least 8 characters)
        if (password.length < 8) {
            alert('Password must be at least 8 characters long.');
            return;
        }
        
        // Check if Terms and Conditions are accepted
        if (!terms) {
            alert('You must agree to the Terms of Service and Privacy Policy.');
            return;
        }

        // --- If all validations pass ---
        console.log('Form Submitted Successfully!');
        
        // Create a data object with the voter's information
        const voterData = {
            fullName,
            dob,
            gender,
            address,
            email,
            phone,
            aadhaarLast4: aadhaar.slice(-4), // Storing only last 4 digits as hinted
            password: '***' // Never log or store plain text passwords
        };
        
        console.log('Voter Data:', voterData);
        alert('✅ Registration Successful!\nYour information has been submitted for verification.');

        // Reset the form after successful submission
        registrationForm.reset();
    });
});