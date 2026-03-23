/**
 * API base URL for the Clario backend.
 *
 * Override with EXPO_PUBLIC_API_BASE_URL (include /api/v1 suffix), e.g.:
 * - Android emulator:  http://10.0.2.2:3000/api/v1  (localhost on host)
 * - iOS simulator:       http://localhost:3000/api/v1
 * - Physical device:     http://<your-machine-LAN-IP>:3000/api/v1
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "http://localhost:3000/api/v1";
