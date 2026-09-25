// API Client Module — strictly adheres to API_CONTRACT (1).md

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Generic fetch wrapper with Bearer token injection
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = {
    ...options.headers,
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If payload is not FormData, ensure Content-Type is JSON
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${BASE_URL.replace(/\/$/, '')}${endpoint}`;
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.detail || errorBody.message || `API Error: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.data = errorBody;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

/* =========================================================================
   1. RISK & PREDICTION
   ========================================================================= */

export async function getRiskZones(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/risk-zones${query ? `?${query}` : ''}`);
}

export async function predictRisk(features) {
  return request('/predict-risk', {
    method: 'POST',
    body: JSON.stringify(features),
  });
}

export async function getRiskZoneHistory(zone_id) {
  return request(`/risk-zones/${encodeURIComponent(zone_id)}/history`);
}

/* =========================================================================
   2. WEATHER & SENSOR DATA
   ========================================================================= */

export async function getCurrentWeather(lat, lng) {
  const query = new URLSearchParams({ lat, lng }).toString();
  return request(`/weather/current?${query}`);
}

export async function getSoilMoisture(zone_id) {
  const query = zone_id ? `?zone_id=${encodeURIComponent(zone_id)}` : '';
  return request(`/sensors/soil-moisture${query}`);
}

// Fetch real-time soil moisture from Open-Meteo via backend
export async function getLiveSoilMoisture(lat, lng) {
  const query = new URLSearchParams({ lat, lng }).toString();
  return request(`/weather/soil-moisture-live?${query}`);
}

// Run the ML model live for a zone (terrain from DB + live weather/soil from Open-Meteo)
export async function getZoneLivePrediction(zone_id) {
  return request(`/risk-zones/${encodeURIComponent(zone_id)}/live-predict`, {
    method: 'POST',
  });
}

/* =========================================================================
   3. GIS / INFRASTRUCTURE
   ========================================================================= */

export async function getRoads(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/roads${query ? `?${query}` : ''}`);
}

export async function updateRoadStatus(road_id, status) {
  return request(`/roads/${encodeURIComponent(road_id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getVillages() {
  return request('/villages');
}

/* =========================================================================
   4. FIELD REPORTING
   ========================================================================= */

export async function submitFieldReport(reportData) {
  let body = reportData;
  let headers = {};
  if (!(reportData instanceof FormData)) {
    body = JSON.stringify(reportData);
    headers['Content-Type'] = 'application/json';
  }

  return request('/field-reports', {
    method: 'POST',
    headers,
    body,
  });
}

export async function getFieldReports(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/field-reports${query ? `?${query}` : ''}`);
}

export async function updateFieldReportStatus(report_id, status = null, severity = null) {
  const payload = {};
  if (status) payload.status = status;
  if (severity) payload.severity = severity;

  return request(`/field-reports/${encodeURIComponent(report_id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteFieldReport(report_id) {
  return request(`/field-reports/${encodeURIComponent(report_id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'archived' }),
  });
}

/**
 * POST /analyze-road-image
 * Sends a photo to the backend which uses Gemini Vision to detect road blockage.
 * @param {File} photoFile - The image file to analyze
 * @returns {Promise<{road_status, confidence, reason, hazard_type, suggested_severity}>}
 */
export async function analyzeRoadImage(photoFile) {
  const formData = new FormData();
  formData.append('photo', photoFile);
  return request('/analyze-road-image', {
    method: 'POST',
    body: formData,
  });
}

/**
 * POST /roads/from-report
 * Creates or updates a road segment on the map at the citizen's GPS location.
 * @param {object} payload - { report_id, lat, lng, road_status, road_name? }
 */
export async function createRoadFromReport(payload) {
  return request('/roads/from-report', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/* =========================================================================
   5. ALERTS & NOTIFICATIONS
   ========================================================================= */

export async function getAlerts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/alerts${query ? `?${query}` : ''}`);
}

export async function createAlert(payload) {
  const result = await request('/alerts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  try {
    const channel = new BroadcastChannel('ner_emergency_alerts');
    channel.postMessage({ type: 'NEW_ALERT', alert: result });
    channel.close();
  } catch (e) { }
  try {
    localStorage.setItem('ner_latest_alert_broadcast', JSON.stringify({ id: result?.alert_id, time: Date.now() }));
  } catch (e) { }
  return result;
}

/* =========================================================================
   6. DASHBOARD AGGREGATES
   ========================================================================= */

export async function getDashboardSummary(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/dashboard/summary${query ? `?${query}` : ''}`);
}

/* =========================================================================
   7. OFFLINE SYNC (FIELD APP)
   ========================================================================= */

export async function syncFieldReports(reportsList) {
  return request('/sync/field-reports', {
    method: 'POST',
    body: JSON.stringify({ reports: reportsList }),
  });
}

/* =========================================================================
   8. AUTH
   ========================================================================= */

export async function login(username, password) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (result.token) {
    const profile = {
      ...result,
      username: result.username || username,
      is_verified: Boolean(result.is_verified),
    };
    localStorage.setItem('auth_token', result.token);
    localStorage.setItem('user_profile', JSON.stringify(profile));
    return profile;
  }

  return result;
}

export async function register(formData) {
  return request('/auth/register', {
    method: 'POST',
    body: formData,
  });
}

export async function authenticateWithGoogle(credential) {
  const result = await request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });

  if (result.token) {
    const profile = {
      ...result,
      username: result.username || 'Google User',
      is_verified: Boolean(result.is_verified),
    };
    localStorage.setItem('auth_token', result.token);
    localStorage.setItem('user_profile', JSON.stringify(profile));
    return profile;
  }
  return result;
}

export async function getCurrentUser() {
  return request('/auth/me');
}

export async function registerWithGoogle(formData) {
  return request('/auth/google/register', {
    method: 'POST',
    body: formData,
  });
}

export async function getPendingUsers() {
  return request('/auth/pending-users');
}

export async function verifyUser(userId) {
  return request(`/auth/verify-user/${userId}`, {
    method: 'POST',
  });
}

export function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_profile');
}

/* =========================================================================
   9. AI CHAT ASSISTANT
   ========================================================================= */

/**
 * POST /chat
 * Sends a user message (with optional history) to the backend AI assistant.
 * The backend fetches live DB data and uses Gemini to produce a grounded reply.
 * @param {string} message  - The user's question
 * @param {Array}  history  - Previous turns [{role:'user'|'assistant', text:'...'}]
 * @returns {Promise<{reply: string, source: string}>}
 */
export async function sendChatMessage(message, history = []) {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history }),
  });
}

export async function registerNotificationDevice(token) {
  return request('/notifications/devices', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
