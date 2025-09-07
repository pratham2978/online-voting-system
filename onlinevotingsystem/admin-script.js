// Wait until the HTML page is fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // Get the form and the table body from the HTML using their IDs
    const candidateForm = document.getElementById('add-candidate-form');
    const candidateList = document.getElementById('candidate-list');

    // --- Part 1: Loading and Displaying Candidates ---

    // Function to get candidates from localStorage
    const getCandidates = () => {
        // Get the candidates string from localStorage. If it doesn't exist, use an empty array '[]'.
        const candidates = localStorage.getItem('candidates');
        return candidates ? JSON.parse(candidates) : [];
    };

    // Function to save candidates to localStorage
    const saveCandidates = (candidates) => {
        // Convert the candidates array into a string and save it
        localStorage.setItem('candidates', JSON.stringify(candidates));
    };

    // Function to display all candidates in the table
    const displayCandidates = () => {
        // Clear the table first to avoid duplicates
        candidateList.innerHTML = '';
        const candidates = getCandidates();

        // Loop through each candidate and create a table row for them
        candidates.forEach((candidate, index) => {
            // Create a new table row element
            const row = document.createElement('tr');

            // Set the HTML content for the row
            row.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${candidate.photo || 'https://via.placeholder.com/40'}" alt="Candidate Photo" class="table-photo">
                        <span>${candidate.name}</span>
                    </div>
                </td>
                <td>${candidate.party}</td>
                <td>${candidate.election}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" data-index="${index}"><i class="fa-solid fa-pencil"></i></button>
                        <button class="btn-action btn-danger" data-index="${index}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            // Add the new row to the table body
            candidateList.appendChild(row);
        });

        // Add event listeners for all the new delete buttons
        addDeleteListeners();
    };


    // --- Part 2: Adding a New Candidate ---

    // Listen for the "submit" event on the form
    candidateForm.addEventListener('submit', (event) => {
        // Prevent the page from reloading when the form is submitted
        event.preventDefault();

        // Get the values from the form inputs
        const name = document.getElementById('candidate-name').value;
        const party = document.getElementById('candidate-party').value;
        const election = document.getElementById('election').value;
        
        // Check if all fields are filled
        if (!name || !party || !election) {
            alert('Please fill out all fields.');
            return;
        }

        // Create a new candidate object
        const newCandidate = {
            name: name,
            party: party,
            election: election,
            photo: 'https://via.placeholder.com/40' // Using a placeholder for now
        };

        // Add the new candidate to our list
        const candidates = getCandidates();
        candidates.push(newCandidate);
        saveCandidates(candidates);

        // Refresh the table to show the new candidate
        displayCandidates();

        // Clear the form fields for the next entry
        candidateForm.reset();
    });
    
    // --- Part 3: Deleting a Candidate ---

    // Function to delete a candidate
    const deleteCandidate = (index) => {
        const candidates = getCandidates();
        // Remove the candidate from the array at the specified index
        candidates.splice(index, 1);
        saveCandidates(candidates);
        displayCandidates(); // Refresh the table
    };

    // Function to find all delete buttons and add a click listener
    const addDeleteListeners = () => {
        const deleteButtons = document.querySelectorAll('.btn-danger');
        deleteButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                // Get the index of the candidate from the button's 'data-index' attribute
                const index = event.currentTarget.getAttribute('data-index');
                if (confirm('Are you sure you want to delete this candidate?')) {
                    deleteCandidate(index);
                }
            });
        });
    };
    

    // --- Initial Load ---
    // Display any candidates that are already saved when the page first loads
    displayCandidates();
});