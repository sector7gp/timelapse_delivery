// Configuration
const API_URL = '/api';

// State
let state = {
    token: localStorage.getItem('token') || null,
    user: null, // we can optionally decode the token
    projects: [],
    currentProject: null,
    videos: []
};

// UI Elements
const els = {
    loginView: document.getElementById('login-view'),
    dashboardView: document.getElementById('dashboard-view'),
    loginForm: document.getElementById('login-form'),
    loginError: document.getElementById('login-error'),
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    btnLogout: document.getElementById('btn-logout'),
    userEmail: document.getElementById('user-email'),
    projectsList: document.getElementById('projects-list'),
    videosGrid: document.getElementById('videos-grid'),
    currentProjectName: document.getElementById('current-project-name'),
    notificationHub: document.getElementById('notification-hub')
};

// Initialization
function init() {
    setupEventListeners();
    checkAuth();
}

function setupEventListeners() {
    els.loginForm.addEventListener('submit', handleLogin);
    els.btnLogout.addEventListener('click', handleLogout);
}

// UI Helpers
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="uil ${type === 'success' ? 'uil-check-circle' : 'uil-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    els.notificationHub.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function switchView(viewName) {
    if (viewName === 'dashboard') {
        els.loginView.classList.add('hidden');
        els.dashboardView.classList.remove('hidden');
        loadProjects();
    } else {
        els.dashboardView.classList.add('hidden');
        els.loginView.classList.remove('hidden');
    }
}

// Authentication
function checkAuth() {
    if (state.token) {
        // Assume valid for MVP, decode email from JWT
        try {
            const base64Url = state.token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(base64));
            state.user = { email: payload.sub };
            els.userEmail.textContent = state.user.email;
            switchView('dashboard');
        } catch (e) {
            handleLogout();
        }
    } else {
        switchView('login');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    els.loginError.classList.add('hidden');
    const email = els.emailInput.value;
    const password = els.passwordInput.value;

    const formData = new FormData();
    formData.append('username', email); // OAuth2 expects username
    formData.append('password', password);

    try {
        const btn = document.getElementById('btn-login');
        btn.innerHTML = '<i class="uil uil-spinner uil-spin"></i> Authenticating...';
        btn.disabled = true;

        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Invalid credentials');

        const data = await response.json();
        state.token = data.access_token;
        localStorage.setItem('token', state.token);
        checkAuth();
        showToast('Successfully logged in');
    } catch (error) {
        els.loginError.textContent = error.message;
        els.loginError.classList.remove('hidden');
    } finally {
        const btn = document.getElementById('btn-login');
        btn.innerHTML = '<span>Sign In</span><i class="uil uil-arrow-right"></i>';
        btn.disabled = false;
    }
}

function handleLogout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    els.loginForm.reset();
    switchView('login');
    showToast('Logged out successfully', 'success');
}

// API Calls
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Authorization': `Bearer ${state.token}`,
        ...options.headers
    };
    
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    
    if (response.status === 401) {
        handleLogout();
        throw new Error('Session expired');
    }
    
    return response;
}

// Data Loading
async function loadProjects() {
    try {
        const res = await apiCall('/projects');
        state.projects = await res.json();
        renderProjects();
        if (state.projects.length > 0) {
            selectProject(state.projects[0]);
        } else {
            els.projectsList.innerHTML = '<li>No projects found</li>';
            els.videosGrid.innerHTML = '<div class="video-card"><p>No projects available.</p></div>';
        }
    } catch (error) {
        showToast('Error loading projects', 'error');
    }
}

async function selectProject(project) {
    state.currentProject = project;
    els.currentProjectName.textContent = project.name;
    
    document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`project-${project.id}`).classList.add('active');
    
    loadVideos(project.id);
}

async function loadVideos(projectId) {
    els.videosGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;"><i class="uil uil-spinner uil-spin" style="font-size: 2rem;"></i></div>';
    try {
        const res = await apiCall(`/projects/${projectId}/videos`);
        state.videos = await res.json();
        renderVideos();
    } catch (error) {
        showToast('Error loading videos', 'error');
        els.videosGrid.innerHTML = '';
    }
}

// Rendering
function renderProjects() {
    els.projectsList.innerHTML = state.projects.map(p => `
        <li class="project-item" id="project-${p.id}" onclick="selectProject(${p.id})">
            <i class="uil uil-folder"></i>
            <span>${p.name}</span>
        </li>
    `).join('');
    
    // Note: since onclick in HTML literal passes ID, we need to map id back to object
    window.selectProject = (id) => {
        const proj = state.projects.find(p => p.id === id);
        if(proj) selectProject(proj);
    };
}

function renderVideos() {
    if (state.videos.length === 0) {
        els.videosGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: #8b949e; padding: 40px;">
                <i class="uil uil-video-slash" style="font-size: 3rem; margin-bottom: 10px; display: block;"></i>
                <p>No videos found in this project.</p>
            </div>
        `;
        return;
    }

    els.videosGrid.innerHTML = state.videos.map(v => {
        const sizeMb = (v.size / (1024 * 1024)).toFixed(2);
        const date = new Date(v.last_modified).toLocaleDateString();
        
        return `
            <div class="video-card">
                <div class="video-icon"><i class="uil uil-video"></i></div>
                <div class="video-info">
                    <h4>${v.filename}</h4>
                    <div class="video-meta">
                        <span>${sizeMb} MB</span>
                        <span>${date}</span>
                    </div>
                </div>
                <div class="video-actions">
                    <button class="btn btn-small btn-download" onclick="downloadVideo('${v.filename}')">
                        <i class="uil uil-download-alt"></i> Download
                    </button>
                    <button class="btn btn-small btn-delete" onclick="deleteVideo('${v.filename}')">
                        <i class="uil uil-trash-alt"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    window.downloadVideo = async (filename) => {
        try {
            const url = `${API_URL}/projects/${state.currentProject.id}/videos/${encodeURIComponent(filename)}/download`;
            // Using fetch to pass Auth header, then create a blob link
            const res = await apiCall(`/projects/${state.currentProject.id}/videos/${encodeURIComponent(filename)}/download`);
            if(!res.ok) throw new Error("Failed to download");
            
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
            showToast('Download started', 'success');
        } catch (error) {
            showToast('Error downloading file', 'error');
        }
    };

    window.deleteVideo = async (filename) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
        
        try {
            const res = await apiCall(`/projects/${state.currentProject.id}/videos/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            if(!res.ok) throw new Error("Failed to delete");
            showToast('Video deleted', 'success');
            loadVideos(state.currentProject.id); // reload
        } catch (error) {
            showToast('Error deleting file', 'error');
        }
    };
}

// Start app
document.addEventListener('DOMContentLoaded', init);
