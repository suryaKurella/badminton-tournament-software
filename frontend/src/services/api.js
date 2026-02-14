import axios from 'axios';
import { supabase } from '../config/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Function to set auth token (called by AuthContext)
export const setAuthToken = (token) => {
  console.log('=== Setting Auth Token ===');
  console.log('Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'null');

  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('Authorization header set successfully');
    console.log('Current headers:', api.defaults.headers.common);
  } else {
    delete api.defaults.headers.common['Authorization'];
    console.log('Authorization header cleared');
  }
};

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log('=== API Request ===');
    console.log('URL:', config.url);
    console.log('Method:', config.method);
    console.log('Authorization header:', config.headers.Authorization ? 'Set (' + config.headers.Authorization.substring(0, 20) + '...)' : 'NOT SET');
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the session
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !session) {
          processQueue(refreshError || new Error('Session refresh failed'), null);
          isRefreshing = false;
          return Promise.reject(error);
        }

        const newToken = session.access_token;
        setAuthToken(newToken);
        processQueue(null, newToken);
        isRefreshing = false;

        // Retry the original request with new token
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  checkUsername: (username) => api.get(`/auth/check-username/${username}`),
};

// Tournament APIs
export const tournamentAPI = {
  getAll: (params) => api.get('/tournaments', { params }),
  getById: (id) => api.get(`/tournaments/${id}`),
  create: (data) => api.post('/tournaments', data),
  update: (id, data) => api.put(`/tournaments/${id}`, data),
  delete: (id) => api.delete(`/tournaments/${id}`),
  register: (id, data) => api.post(`/tournaments/${id}/register`, data),
  deregister: (id) => api.delete(`/tournaments/${id}/register`),
  approveRegistration: (tournamentId, registrationId) => api.put(`/tournaments/${tournamentId}/registrations/${registrationId}/approve`),
  approveAllPendingRegistrations: (tournamentId) => api.put(`/tournaments/${tournamentId}/registrations/approve-all`),
  rejectRegistration: (tournamentId, registrationId) => api.put(`/tournaments/${tournamentId}/registrations/${registrationId}/reject`),
  unregisterParticipant: (tournamentId, registrationId) => api.delete(`/tournaments/${tournamentId}/registrations/${registrationId}`),
  togglePause: (id) => api.put(`/tournaments/${id}/toggle-pause`),
  toggleRegistration: (id) => api.put(`/tournaments/${id}/toggle-registration`),
  regenerateBracket: (id) => api.post(`/tournaments/${id}/regenerate-bracket`),
  replaceTeam: (tournamentId, matchId, data) => api.put(`/tournaments/${tournamentId}/matches/${matchId}/replace-team`, data),
  reset: (id) => api.post(`/tournaments/${id}/reset`),
  // Group stage endpoints
  getGroupStandings: (id) => api.get(`/tournaments/${id}/group-standings`),
  completeGroupStage: (id) => api.post(`/tournaments/${id}/complete-group-stage`),
  // Manual group assignment endpoints
  getGroupAssignments: (id) => api.get(`/tournaments/${id}/group-assignments`),
  assignToGroup: (tournamentId, registrationId, groupName) => api.put(`/tournaments/${tournamentId}/registrations/${registrationId}/assign-group`, { groupName }),
  autoAssignGroups: (id) => api.post(`/tournaments/${id}/auto-assign-groups`),
  shuffleGroups: (id) => api.post(`/tournaments/${id}/shuffle-groups`),
};

// Match APIs
export const matchAPI = {
  getByTournament: (tournamentId, limit = 100) => api.get(`/matches/tournament/${tournamentId}?limit=${limit}`),
  getById: (id) => api.get(`/matches/${id}`),
  create: (data) => api.post('/matches', data),
  walkover: (id, data) => api.put(`/matches/${id}/walkover`, data),
  update: (id, data) => api.put(`/matches/${id}`, data),
  updateScore: (id, data) => api.put(`/matches/${id}/score`, data),
  start: (id) => api.put(`/matches/${id}/start`),
  complete: (id, data) => api.put(`/matches/${id}/complete`, data),
};

// User APIs
export const userAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Club APIs
export const clubAPI = {
  getAll: (params) => api.get('/clubs', { params }),
  getById: (id) => api.get(`/clubs/${id}`),
  getMyClubs: () => api.get('/clubs/my-clubs'),
  create: (data) => api.post('/clubs', data),
  update: (id, data) => api.put(`/clubs/${id}`, data),
  delete: (id) => api.delete(`/clubs/${id}`),
  // Membership
  join: (id) => api.post(`/clubs/${id}/join`),
  leave: (id) => api.delete(`/clubs/${id}/leave`),
  approveMembership: (clubId, membershipId) => api.put(`/clubs/${clubId}/memberships/${membershipId}/approve`),
  rejectMembership: (clubId, membershipId) => api.put(`/clubs/${clubId}/memberships/${membershipId}/reject`),
  removeMember: (clubId, membershipId) => api.delete(`/clubs/${clubId}/memberships/${membershipId}`),
  updateMemberRole: (clubId, membershipId, role) => api.put(`/clubs/${clubId}/memberships/${membershipId}/role`, { role }),
  // Club tournaments
  getTournaments: (id, params) => api.get(`/clubs/${id}/tournaments`, { params }),
};

export default api;
