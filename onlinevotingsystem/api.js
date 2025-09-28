// API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to make API calls
const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        }
    };

    const config = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            // If there are detailed validation errors, show them
            if (data.errors && Array.isArray(data.errors)) {
                const errorMessages = data.errors.map(err => err.msg).join('\n');
                throw new Error(`Validation failed:\n${errorMessages}`);
            }
            throw new Error(data.message || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

// Authentication API
const auth = {
    // Voter registration
    register: async (userData) => {
        return apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    // Voter login
    login: async (identifier, password) => {
        const response = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password })
        });
        
        if (response.success && response.token) {
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('userType', 'voter');
            localStorage.setItem('userData', JSON.stringify(response.voter));
        }
        
        return response;
    },

    // Admin login
    adminLogin: async (email, password) => {
        const response = await apiCall('/auth/admin/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (response.success && response.token) {
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('userType', 'admin');
            localStorage.setItem('userData', JSON.stringify(response.admin));
        }
        
        return response;
    },

    // Get user profile
    getProfile: async () => {
        return apiCall('/auth/profile');
    },

    // Logout
    logout: () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userType');
        localStorage.removeItem('userData');
        window.location.href = '/login.html';
    }
};

// Elections API
const elections = {
    // Get all elections
    getAll: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return apiCall(`/elections${queryString ? '?' + queryString : ''}`);
    },

    // Get election by ID
    getById: async (id) => {
        return apiCall(`/elections/${id}`);
    },

    // Get active elections
    getActive: async () => {
        return apiCall('/elections/phase/voting');
    },

    // Get election results
    getResults: async (id) => {
        return apiCall(`/elections/${id}/results`);
    }
};

// Candidates API
const candidates = {
    // Get all candidates
    getAll: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return apiCall(`/candidates${queryString ? '?' + queryString : ''}`);
    },

    // Get candidates by election
    getByElection: async (electionId) => {
        return apiCall(`/candidates/election/${electionId}`);
    },

    // Get candidate by ID
    getById: async (id) => {
        return apiCall(`/candidates/${id}`);
    }
};

// Voting API
const voting = {
    // Cast a vote
    castVote: async (electionId, candidateId) => {
        return apiCall('/votes/cast', {
            method: 'POST',
            body: JSON.stringify({ electionId, candidateId })
        });
    },

    // Verify vote
    verifyVote: async (verificationCode) => {
        return apiCall(`/votes/verify/${verificationCode}`);
    },

    // Get voting history
    getHistory: async () => {
        return apiCall('/votes/history');
    }
};

// Admin API (for admin functions)
const admin = {
    // Get dashboard data
    getDashboard: async () => {
        return apiCall('/admin/dashboard');
    },

    // Manage candidates
    addCandidate: async (candidateData) => {
        return apiCall('/candidates', {
            method: 'POST',
            body: JSON.stringify(candidateData)
        });
    },

    updateCandidate: async (id, candidateData) => {
        return apiCall(`/candidates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(candidateData)
        });
    },

    deleteCandidate: async (id) => {
        return apiCall(`/candidates/${id}`, {
            method: 'DELETE'
        });
    },

    // Manage elections
    createElection: async (electionData) => {
        return apiCall('/elections', {
            method: 'POST',
            body: JSON.stringify(electionData)
        });
    }
};

// Utility functions
const utils = {
    // Check if user is authenticated
    isAuthenticated: () => {
        return !!localStorage.getItem('authToken');
    },

    // Get user type
    getUserType: () => {
        return localStorage.getItem('userType');
    },

    // Get user data
    getUserData: () => {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    },

    // Format date
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Show notification
    showNotification: (message, type = 'info') => {
        // You can integrate with a notification library here
        alert(`${type.toUpperCase()}: ${message}`);
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { auth, elections, candidates, voting, admin, utils };
}