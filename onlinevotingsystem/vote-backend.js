// Voting functionality with backend integration
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is authenticated
    if (!utils.isAuthenticated()) {
        alert('Please login to access the voting page.');
        window.location.href = 'login.html';
        return;
    }

    // Check if user is a voter
    if (utils.getUserType() !== 'voter') {
        alert('Only voters can access this page.');
        window.location.href = 'login.html';
        return;
    }

    let currentElection = null;
    let candidates = [];

    // Load active elections and candidates
    await loadElections();

    // Modal elements
    const modalOverlay = document.querySelector('.modal-overlay');
    const cancelButton = document.getElementById('cancel-vote');
    const confirmButton = document.getElementById('confirm-vote');
    const modalCandidateName = document.getElementById('modal-candidate-name');
    const modalCandidateParty = document.getElementById('modal-candidate-party');
    const modalCandidatePhoto = document.getElementById('modal-candidate-photo');

    let selectedCandidate = null;

    // Load elections and candidates from backend
    async function loadElections() {
        try {
            // Get active elections
            const activeElections = await elections.getActive();
            
            if (activeElections.data && activeElections.data.length > 0) {
                currentElection = activeElections.data[0]; // Use first active election
                
                // Update election title
                const electionTitle = document.querySelector('.election-title h2');
                if (electionTitle) {
                    electionTitle.textContent = currentElection.title;
                }

                // Load candidates for this election
                await loadCandidates(currentElection._id);
            } else {
                // No active elections
                const candidateGrid = document.querySelector('.candidate-grid');
                candidateGrid.innerHTML = `
                    <div class="no-election-message">
                        <h3>No Active Elections</h3>
                        <p>There are currently no active elections. Please check back later.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading elections:', error);
            alert('Error loading elections: ' + error.message);
        }
    }

    // Load candidates for the election
    async function loadCandidates(electionId) {
        try {
            const candidatesResponse = await candidates.getByElection(electionId);
            candidates = candidatesResponse.data || [];
            
            renderCandidates();
        } catch (error) {
            console.error('Error loading candidates:', error);
            alert('Error loading candidates: ' + error.message);
        }
    }

    // Render candidates in the UI
    function renderCandidates() {
        const candidateGrid = document.querySelector('.candidate-grid');
        
        if (candidates.length === 0) {
            candidateGrid.innerHTML = `
                <div class="no-candidates-message">
                    <h3>No Candidates Available</h3>
                    <p>No candidates have been registered for this election yet.</p>
                </div>
            `;
            return;
        }

        candidateGrid.innerHTML = candidates.map(candidate => `
            <div class="candidate-card" data-candidate-id="${candidate._id}">
                <img src="${candidate.profilePhoto || 'https://via.placeholder.com/80'}" 
                     alt="${candidate.fullName}" class="candidate-photo">
                <div class="candidate-details">
                    <h3 class="candidate-name">${candidate.fullName}</h3>
                    <p class="candidate-party">${candidate.politicalParty}</p>
                </div>
                <img src="${candidate.partySymbol || 'https://via.placeholder.com/50'}" 
                     alt="Party Symbol" class="party-symbol">
                <button class="btn btn-vote" data-candidate-id="${candidate._id}">Vote</button>
            </div>
        `).join('');

        // Add event listeners to vote buttons
        attachVoteButtonListeners();
    }

    // Attach event listeners to vote buttons
    function attachVoteButtonListeners() {
        const voteButtons = document.querySelectorAll('.btn-vote');
        
        voteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const candidateId = e.target.dataset.candidateId;
                selectedCandidate = candidates.find(c => c._id === candidateId);
                
                if (selectedCandidate) {
                    showVoteConfirmationModal(selectedCandidate);
                }
            });
        });
    }

    // Show vote confirmation modal
    function showVoteConfirmationModal(candidate) {
        if (modalCandidateName) modalCandidateName.textContent = candidate.fullName;
        if (modalCandidateParty) modalCandidateParty.textContent = candidate.politicalParty;
        if (modalCandidatePhoto) {
            modalCandidatePhoto.src = candidate.profilePhoto || 'https://via.placeholder.com/80';
        }
        
        if (modalOverlay) modalOverlay.classList.add('active');
    }

    // Handle vote confirmation
    if (confirmButton) {
        confirmButton.addEventListener('click', async () => {
            if (!selectedCandidate || !currentElection) {
                alert('Please select a candidate and ensure an election is active.');
                return;
            }

            // Show loading state
            confirmButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>&nbsp; Casting Vote...';
            confirmButton.disabled = true;

            try {
                // Cast vote through API
                const voteResponse = await voting.castVote(currentElection._id, selectedCandidate._id);
                
                if (voteResponse.success) {
                    // Hide modal
                    modalOverlay.classList.remove('active');
                    
                    // Show success message
                    showVoteSuccessMessage(voteResponse.data);
                } else {
                    alert('Vote casting failed: ' + voteResponse.message);
                }
            } catch (error) {
                console.error('Vote casting error:', error);
                alert('Vote casting failed: ' + error.message);
            } finally {
                // Reset button
                confirmButton.innerHTML = '<i class="fa-solid fa-check"></i>&nbsp; Confirm Vote';
                confirmButton.disabled = false;
            }
        });
    }

    // Handle vote cancellation
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
            selectedCandidate = null;
        });
    }

    // Hide modal on overlay click
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('active');
                selectedCandidate = null;
            }
        });
    }

    // Show vote success message
    function showVoteSuccessMessage(voteData) {
        const candidateGrid = document.querySelector('.candidate-grid');
        const thankYouMessage = document.querySelector('.thank-you-message');
        
        if (candidateGrid && thankYouMessage) {
            candidateGrid.style.display = 'none';
            thankYouMessage.classList.add('active');
        } else {
            // Create success message if elements don't exist
            const voteContainer = document.querySelector('.vote-container');
            voteContainer.innerHTML = `
                <div class="vote-success-message">
                    <div class="success-icon">
                        <i class="fa-solid fa-check-circle"></i>
                    </div>
                    <h2>Vote Cast Successfully!</h2>
                    <p>Thank you for participating in the democratic process.</p>
                    <div class="vote-details">
                        <p><strong>Verification Code:</strong> ${voteData.verificationCode}</p>
                        <p><strong>Candidate:</strong> ${voteData.candidate}</p>
                        <p><strong>Election:</strong> ${voteData.election}</p>
                        <p><strong>Time:</strong> ${utils.formatDate(voteData.votedAt)}</p>
                    </div>
                    <div class="success-actions">
                        <button onclick="window.print()" class="btn btn-secondary">
                            <i class="fa-solid fa-print"></i> Print Receipt
                        </button>
                        <a href="index.html" class="btn btn-primary">
                            <i class="fa-solid fa-home"></i> Go to Home
                        </a>
                    </div>
                </div>
            `;
        }
    }

    // Handle logout
    const logoutButton = document.querySelector('.btn-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                auth.logout();
            }
        });
    }

    // Check if user has already voted
    async function checkVotingStatus() {
        try {
            const profile = await auth.getProfile();
            if (profile.data && profile.data.profile.hasVoted) {
                // User has already voted
                const voteContainer = document.querySelector('.vote-container');
                voteContainer.innerHTML = `
                    <div class="already-voted-message">
                        <div class="info-icon">
                            <i class="fa-solid fa-info-circle"></i>
                        </div>
                        <h2>You Have Already Voted</h2>
                        <p>You have already cast your vote in this election.</p>
                        <div class="actions">
                            <a href="index.html" class="btn btn-primary">
                                <i class="fa-solid fa-home"></i> Go to Home
                            </a>
                            <button onclick="showVotingHistory()" class="btn btn-secondary">
                                <i class="fa-solid fa-history"></i> View Voting History
                            </button>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error checking voting status:', error);
        }
    }

    // Show voting history
    window.showVotingHistory = async () => {
        try {
            const history = await voting.getHistory();
            // Implementation for showing voting history modal
            console.log('Voting history:', history);
        } catch (error) {
            console.error('Error fetching voting history:', error);
        }
    };

    // Initial check for voting status
    await checkVotingStatus();
});