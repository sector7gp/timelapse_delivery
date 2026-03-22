// Configuration
const API_URL = '/api';

// State
let state = {
    token: localStorage.getItem('token') || null,
    user: null, 
    projects: [],
    currentProject: null,
    videos: [],
    adminUsers: [], // Admin only
    selectedAdminUser: null // Admin only
};

// UI Elements
const els = {
    loginView: document.getElementById('login-view'),
    dashboardView: document.getElementById('dashboard-view'),
    subviewDashboard: document.getElementById('subview-dashboard'),
    subviewAdmin: document.getElementById('subview-admin'),
    navBtnAdmin: document.getElementById('nav-btn-admin'),
    navBtnDashboard: document.getElementById('nav-btn-dashboard'),
    loginForm: document.getElementById('login-form'),
    loginError: document.getElementById('login-error'),
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    btnLogout: document.getElementById('btn-logout'),
    userEmail: document.getElementById('user-email'),
    projectsList: document.getElementById('projects-list'),
    videosGrid: document.getElementById('videos-grid'),
    currentProjectName: document.getElementById('current-project-name'),
    adminUsersList: document.getElementById('admin-users-list'),
    userProjectsPanel: document.getElementById('user-projects-panel'),
    userProjectsList: document.getElementById('user-projects-list'),
    managementTitle: document.getElementById('management-title'),
    modalUser: document.getElementById('modal-user'),
    userAdminForm: document.getElementById('user-admin-form'),
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
    
    els.navBtnDashboard.addEventListener('click', () => switchSubview('dashboard'));
    els.navBtnAdmin.addEventListener('click', () => switchSubview('admin'));
    
    document.getElementById('btn-show-create-user').addEventListener('click', () => showUserModal());
    document.getElementById('btn-close-modal').addEventListener('click', () => els.modalUser.classList.add('hidden'));
    els.userAdminForm.addEventListener('submit', handleAdminUserSubmit);
    document.getElementById('btn-add-project').addEventListener('click', handleAddProject);
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
        switchSubview('dashboard');
    } else {
        els.dashboardView.classList.add('hidden');
        els.loginView.classList.remove('hidden');
    }
}

function switchSubview(subview) {
    if (subview === 'dashboard') {
        els.subviewAdmin.classList.add('hidden');
        els.subviewDashboard.classList.remove('hidden');
        els.navBtnAdmin.classList.remove('active');
        els.navBtnDashboard.classList.add('active');
        loadProjects();
    } else {
        els.subviewDashboard.classList.add('hidden');
        els.subviewAdmin.classList.remove('hidden');
        els.navBtnDashboard.classList.remove('active');
        els.navBtnAdmin.classList.add('active');
        loadAdminUsers();
    }
}

// Authentication
function checkAuth() {
    if (state.token) {
        try {
            const base64Url = state.token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(base64));
            
            state.user = { 
                email: payload.sub,
                isAdmin: payload.is_admin || false
            };
            
            if (state.user.isAdmin) {
                els.navBtnAdmin.classList.remove('hidden');
            }
            
            // Still fetch profile as a secondary verification or for other data
            fetchUserProfile();
            
            els.userEmail.textContent = state.user.email;
            switchView('dashboard');
        } catch (e) {
            handleLogout();
        }
    } else {
        switchView('login');
    }
}

async function fetchUserProfile() {
    try {
        const res = await apiCall('/auth/me');
        if (res.ok) {
            const data = await res.json();
            state.user.isAdmin = data.is_admin;
            if (state.user.isAdmin) {
                els.navBtnAdmin.classList.remove('hidden');
            }
        }
    } catch (e) {}
}

async function handleLogin(e) {
    e.preventDefault();
    els.loginError.classList.add('hidden');
    const email = els.emailInput.value;
    const password = els.passwordInput.value;

    const formData = new FormData();
    formData.append('username', email); 
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
    els.navBtnAdmin.classList.add('hidden');
    switchView('login');
}

// API Calls
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    // Don't send JSON content-type for FormData (like login)
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
        handleLogout();
        throw new Error('Session expired');
    }
    
    return response;
}

// Admin Logic
async function loadAdminUsers() {
    try {
        const res = await apiCall('/admin/users');
        state.adminUsers = await res.json();
        renderAdminUsers();
    } catch (error) {
        showToast('Error loading users', 'error');
    }
}

function renderAdminUsers() {
    els.adminUsersList.innerHTML = state.adminUsers.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.email}</td>
            <td><span class="badge ${u.is_admin ? 'badge-admin' : ''}">${u.is_admin ? 'YES' : 'NO'}</span></td>
            <td><span class="badge ${u.is_active ? 'badge-active' : 'badge-inactive'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <button class="btn btn-small btn-outline" onclick="manageUserProjects(${u.id})" title="Manage Projects">
                    <i class="uil uil-folder-open"></i>
                </button>
                <button class="btn btn-small btn-outline" onclick="showUserModal(${u.id})" title="Edit User">
                    <i class="uil uil-edit"></i>
                </button>
                <button class="btn btn-small btn-delete" onclick="deleteUser(${u.id})" title="Delete User">
                    <i class="uil uil-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    window.manageUserProjects = (id) => {
        const user = state.adminUsers.find(u => u.id === id);
        if (user) {
            state.selectedAdminUser = user;
            els.managementTitle.textContent = `Projects for: ${user.email}`;
            els.userProjectsPanel.classList.remove('hidden');
            loadUserProjects(user.id);
        }
    };

    window.showUserModal = (id = null) => {
        els.userAdminForm.reset();
        const title = document.getElementById('user-modal-title');
        const editIdInput = document.getElementById('edit-user-id');
        
        if (id) {
            const user = state.adminUsers.find(u => u.id === id);
            title.textContent = "Edit User";
            editIdInput.value = user.id;
            document.getElementById('admin-user-email').value = user.email;
            document.getElementById('admin-user-is-admin').checked = user.is_admin;
            document.getElementById('admin-user-password').placeholder = "(Leave blank to keep current)";
        } else {
            title.textContent = "Create New User";
            editIdInput.value = "";
            document.getElementById('admin-user-password').placeholder = "Password";
        }
        els.modalUser.classList.remove('hidden');
    };

    window.deleteUser = async (id) => {
        if (!confirm("Are you sure? This will delete the user and all their projects.")) return;
        try {
            await apiCall(`/admin/users/${id}`, { method: 'DELETE' });
            showToast('User deleted');
            loadAdminUsers();
        } catch (e) { showToast('Error deleting user', 'error'); }
    };
}

async function handleAdminUserSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const email = document.getElementById('admin-user-email').value;
    const password = document.getElementById('admin-user-password').value;
    const is_admin = document.getElementById('admin-user-is-admin').checked;

    const data = { email, is_admin };
    if (password) data.password = password;

    try {
        if (id) {
            await apiCall(`/admin/users/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
            showToast('User updated');
        } else {
            if (!password) { showToast('Password required for new user', 'error'); return; }
            await apiCall(`/admin/users`, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showToast('User created');
        }
        els.modalUser.classList.add('hidden');
        loadAdminUsers();
    } catch (e) { showToast('Error saving user', 'error'); }
}

async function loadUserProjects(userId) {
    try {
        const res = await apiCall(`/admin/users/${userId}/projects`);
        const projects = await res.json();
        renderUserProjects(userId, projects);
    } catch (e) {
        showToast('Error loading user projects', 'error');
    }
}

function renderUserProjects(userId, projects) {
    els.userProjectsList.innerHTML = projects.map(p => `
        <li class="project-item">
            <div class="project-info">
                <strong>${p.name}</strong>
                <span class="dir-hint">/videos/${p.directory_name}</span>
            </div>
            <button class="btn btn-small btn-delete" onclick="deleteProject(${p.id})">
                <i class="uil uil-trash-alt"></i>
            </button>
        </li>
    `).join('') || '<li class="empty-msg">No projects assigned</li>';

    window.deleteProject = async (projectId) => {
        if (!confirm("Are you sure you want to delete this project?")) return;
        try {
            await apiCall(`/admin/projects/${projectId}`, { method: 'DELETE' });
            showToast('Project deleted');
            loadUserProjects(userId);
        } catch (e) { showToast('Error deleting project', 'error'); }
    };
}

async function handleAddProject() {
    const name = document.getElementById('new-project-name').value;
    const dir = document.getElementById('new-project-dir').value;
    if (!name || !dir) { showToast('Name and directory required', 'error'); return; }

    try {
        await apiCall(`/admin/users/${state.selectedAdminUser.id}/projects`, {
            method: 'POST',
            body: JSON.stringify({ name, directory_name: dir })
        });
        showToast('Project added');
        document.getElementById('new-project-name').value = "";
        document.getElementById('new-project-dir').value = "";
        loadUserProjects(state.selectedAdminUser.id);
    } catch (e) { showToast('Error adding project', 'error'); }
}

// Data Loading (Standard View)
async function loadProjects() {
    try {
        const res = await apiCall('/projects');
        state.projects = await res.json();
        renderProjects();
        if (state.projects.length > 0) {
            setProject(state.projects[0]);
        } else {
            els.projectsList.innerHTML = '<li>No projects found</li>';
            els.videosGrid.innerHTML = '<div class="video-card"><p>No projects available.</p></div>';
        }
    } catch (error) {
        showToast('Error loading projects', 'error');
    }
}

async function setProject(project) {
    console.log("Setting project:", project);
    state.currentProject = project;
    els.currentProjectName.textContent = project.name;
    
    document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`project-${project.id}`);
    if (el) el.classList.add('active');
    
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
        console.log("Global selectProject called with id:", id);
        const proj = state.projects.find(p => p.id == id); // Use == for loose equality just in case of string/number mix
        if(proj) setProject(proj);
        else console.error("Project not found for id:", id);
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
