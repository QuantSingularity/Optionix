import axios from "axios";

// API base URL - process.env values are replaced at compile time by webpack DefinePlugin
const API_BASE_URL =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_API_URL) ||
  "http://localhost:8000";

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000, // Increased timeout to 15 seconds
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Handle specific error status codes
      switch (error.response.status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem("auth_token");
          // Only redirect if we're not already on the login page
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
          break;
        case 403:
          // Forbidden
          console.error("Access forbidden:", error.response.data);
          break;
        case 429:
          // Too Many Requests
          console.error("Rate limit exceeded. Please try again later.");
          break;
        case 500:
          // Server error
          console.error("Server error occurred:", error.response.data);
          break;
        case 503:
          // Service unavailable
          console.error("Service temporarily unavailable");
          break;
        default:
          console.error("API error:", error.response.data);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error(
        "No response received from server. Please check your connection.",
      );
    } else {
      // Error in setting up the request
      console.error("Error setting up request:", error.message);
    }
    return Promise.reject(error);
  },
);

// WebSocket base URL
export const WS_BASE_URL =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_WS_URL) ||
  "ws://localhost:8000/ws";

export default api;
