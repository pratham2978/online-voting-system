document.addEventListener('DOMContentLoaded', () => {
    const voteButtons = document.querySelectorAll('.btn-vote');
    const modalOverlay = document.querySelector('.modal-overlay');
    const cancelButton = document.getElementById('cancel-vote');
    const confirmButton = document.getElementById('confirm-vote');

    const modalCandidateName = document.getElementById('modal-candidate-name');
    const modalCandidateParty = document.getElementById('modal-candidate-party');
    const modalCandidatePhoto = document.getElementById('modal-candidate-photo');

    let selectedCandidateCard = null;

    // Show modal when a "Vote" button is clicked
    voteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            selectedCandidateCard = e.target.closest('.candidate-card');
            
            const name = selectedCandidateCard.querySelector('.candidate-name').textContent;
            const party = selectedCandidateCard.querySelector('.candidate-party').textContent;
            const photoSrc = selectedCandidateCard.querySelector('.candidate-photo').src;

            modalCandidateName.textContent = name;
            modalCandidateParty.textContent = party;
            modalCandidatePhoto.src = photoSrc;

            modalOverlay.classList.add('active');
        });
    });

    // Hide modal when "Cancel" is clicked
    cancelButton.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
    });

    // Hide modal on overlay click
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    });

    // Confirm vote and show thank you message
    confirmButton.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        
        const candidateGrid = document.querySelector('.candidate-grid');
        const thankYouMessage = document.querySelector('.thank-you-message');

        candidateGrid.style.display = 'none';
        thankYouMessage.classList.add('active');
    });
});