/**
 * Xiaomi Cloud Port
 *
 * Interface for Xiaomi cloud authentication and BLE key extraction.
 * Supports QR code-based login flow.
 *
 * @module application/ports/XiaomiCloudPort
 */

/**
 * Xiaomi cloud regions
 */
export type XiaomiRegion = 'cn' | 'de' | 'us' | 'ru' | 'tw' | 'sg' | 'in' | 'i2';

/**
 * QR code login session
 */
export interface QRLoginSession {
  /** Unique session identifier */
  sessionId: string;
  /** QR code image URL */
  qrCodeUrl: string;
  /** URL user can visit directly */
  loginUrl: string;
  /** Session expiration time */
  expiresAt: number;
}

/**
 * QR login status
 */
export type QRLoginStatus =
  | 'pending'      // Waiting for user to scan
  | 'scanned'      // User scanned but not confirmed
  | 'confirmed'    // User confirmed login
  | 'expired'      // Session expired
  | 'error';       // Error occurred

/**
 * QR login poll result
 */
export interface QRLoginPollResult {
  status: QRLoginStatus;
  /** Auth token if confirmed */
  authToken?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Xiaomi device info from cloud
 */
export interface XiaomiDevice {
  /** Device ID */
  did: string;
  /** Device name */
  name: string;
  /** Device model */
  model: string;
  /** MAC address */
  mac: string;
  /** Is BLE device */
  isBLE: boolean;
  /** Parent device ID (for BLE devices connected through gateway) */
  parentId?: string;
}

/**
 * BLE key extraction result
 */
export interface BLEKeyResult {
  /** Device ID */
  did: string;
  /** MAC address */
  mac: string;
  /** BLE beacon key (hex string) */
  beaconKey: string;
}

/**
 * Auth session state
 */
export interface XiaomiAuthState {
  /** Is authenticated */
  isAuthenticated: boolean;
  /** Current region */
  region?: XiaomiRegion;
  /** User ID */
  userId?: string;
  /** Session expiration */
  expiresAt?: number;
}

/**
 * Xiaomi Cloud Port interface
 */
export interface XiaomiCloudPort {
  /**
   * Start QR code login flow
   * @returns QR login session with QR code URL
   */
  startQRLogin(): Promise<QRLoginSession>;

  /**
   * Poll for QR login status
   * @param sessionId - Session ID from startQRLogin
   * @returns Current login status
   */
  pollLoginStatus(sessionId: string): Promise<QRLoginPollResult>;

  /**
   * Complete login after QR confirmation
   * @param authToken - Auth token from successful poll
   * @param region - Xiaomi cloud region
   */
  completeLogin(authToken: string, region: XiaomiRegion): Promise<void>;

  /**
   * Get list of devices from Xiaomi cloud
   * @returns List of devices
   */
  getDevices(): Promise<XiaomiDevice[]>;

  /**
   * Get BLE encryption key for a device
   * @param deviceId - Device ID
   * @returns BLE key result
   */
  getBLEKey(deviceId: string): Promise<BLEKeyResult>;

  /**
   * Get current authentication state
   */
  getAuthState(): XiaomiAuthState;

  /**
   * Logout and clear session
   */
  logout(): void;

  /**
   * Check if session is still valid
   */
  isSessionValid(): boolean;
}
