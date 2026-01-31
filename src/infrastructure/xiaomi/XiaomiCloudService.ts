/**
 * Xiaomi Cloud Service
 *
 * Implementation of XiaomiCloudPort for authenticating with Xiaomi cloud
 * and extracting BLE encryption keys using QR code login flow.
 *
 * Based on: https://github.com/PiotrMachowski/Xiaomi-cloud-tokens-extractor
 *
 * @module infrastructure/xiaomi/XiaomiCloudService
 */

import * as crypto from 'crypto';
import type {
  XiaomiCloudPort,
  XiaomiRegion,
  QRLoginSession,
  QRLoginPollResult,
  QRLoginStatus,
  XiaomiDevice,
  BLEKeyResult,
  XiaomiAuthState,
} from '../../application/ports/XiaomiCloudPort';

/**
 * Internal session state
 */
interface SessionState {
  userId?: string;
  serviceToken?: string;
  ssecurity?: string;
  region?: XiaomiRegion;
  expiresAt?: number;
}

/**
 * Active QR login session
 */
interface ActiveQRSession {
  sessionId: string;
  qrCodeUrl: string;
  loginUrl: string;
  pollUrl: string;
  expiresAt: number;
}

/**
 * Xiaomi Cloud Service implementation
 */
export class XiaomiCloudService implements XiaomiCloudPort {
  private session: SessionState = {};
  private activeQRSessions: Map<string, ActiveQRSession> = new Map();

  private readonly USER_AGENT =
    'Android-7.1.1-1.0.0-ONEPLUS A]3010-136-ORFDE28FEB3F7C08:00';
  private readonly CLIENT_ID = 'Android_' + this.generateRandomString(16);

  /**
   * Generate random string for client ID
   */
  private generateRandomString(length: number): string {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
  }

  /**
   * Generate random session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get API base URL for region
   */
  private getApiBaseUrl(region: XiaomiRegion): string {
    if (region === 'cn') {
      return 'https://api.io.mi.com/app';
    }
    return `https://${region}.api.io.mi.com/app`;
  }

  /**
   * Generate signed nonce for API requests
   */
  private signedNonce(ssecurity: string, nonce: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(Buffer.from(ssecurity, 'base64'))
      .update(Buffer.from(nonce, 'base64'))
      .digest();
    return hash.toString('base64');
  }

  /**
   * Generate nonce for API requests
   */
  private generateNonce(): string {
    const randomBytes = crypto.randomBytes(8);
    const timestamp = Math.floor(Date.now() / 60000);
    const timestampBuffer = Buffer.alloc(4);
    timestampBuffer.writeUInt32BE(timestamp);
    return Buffer.concat([randomBytes, timestampBuffer]).toString('base64');
  }

  /**
   * Sign API request data
   */
  private signData(
    path: string,
    data: Record<string, unknown>,
    ssecurity: string
  ): { signature: string; nonce: string; params: string } {
    const nonce = this.generateNonce();
    const snonce = this.signedNonce(ssecurity, nonce);

    // Sort and stringify params
    const params = JSON.stringify(data);

    // Create signature
    const signatureBase = [path, snonce, nonce, `data=${params}`].join('&');
    const signature = crypto
      .createHmac('sha256', Buffer.from(snonce, 'base64'))
      .update(signatureBase)
      .digest('base64');

    return { signature, nonce, params };
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    path: string,
    data: Record<string, unknown>
  ): Promise<T> {
    if (!this.session.serviceToken || !this.session.ssecurity || !this.session.region) {
      throw new Error('Not authenticated');
    }

    const { signature, nonce, params } = this.signData(
      path,
      data,
      this.session.ssecurity
    );

    const url = `${this.getApiBaseUrl(this.session.region)}${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.USER_AGENT,
        'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
        Cookie: `userId=${this.session.userId};serviceToken=${this.session.serviceToken};locale=en_GB`,
      },
      body: new URLSearchParams({
        signature,
        _nonce: nonce,
        data: params,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code !== 0) {
      throw new Error(`API error: ${result.message || 'Unknown error'}`);
    }

    return result.result as T;
  }

  /**
   * Start QR code login flow
   */
  async startQRLogin(): Promise<QRLoginSession> {
    const sessionId = this.generateSessionId();

    // Build query parameters for QR login request
    const params = new URLSearchParams({
      _qrsize: '240',
      qs: '%3Fsid%3Dxiaomiio%26_json%3Dtrue',
      callback: 'https://sts.api.io.mi.com/sts',
      _hasLogo: 'false',
      sid: 'xiaomiio',
      serviceParam: '',
      _locale: 'en_GB',
      _dc: Date.now().toString(),
    });

    // Request QR code login URL from Xiaomi (GET request)
    const response = await fetch(
      `https://account.xiaomi.com/longPolling/loginUrl?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to start QR login: ${response.status}`);
    }

    // Response format: &&&START&&&{"loginUrl":"...","qr":"...","lp":"..."}
    const text = await response.text();
    const jsonStr = text.replace('&&&START&&&', '');

    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[XiaomiCloud] Failed to parse QR response:', text);
      throw new Error('Invalid QR login response format');
    }

    // QR code URL can be in 'qr' or 'qrUrl' field
    const qrCodeUrl = data.qr || data.qrUrl;

    if (!qrCodeUrl || !data.lp) {
      console.error('[XiaomiCloud] Missing QR data:', data);
      throw new Error('Invalid QR login response - missing QR code or polling URL');
    }

    const activeSession: ActiveQRSession = {
      sessionId,
      qrCodeUrl,
      loginUrl: data.loginUrl || '',
      pollUrl: data.lp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    };

    this.activeQRSessions.set(sessionId, activeSession);

    console.log('[XiaomiCloud] QR session started:', sessionId);

    return {
      sessionId,
      qrCodeUrl,
      loginUrl: data.loginUrl || '',
      expiresAt: activeSession.expiresAt,
    };
  }

  /**
   * Poll for QR login status
   */
  async pollLoginStatus(sessionId: string): Promise<QRLoginPollResult> {
    const session = this.activeQRSessions.get(sessionId);

    if (!session) {
      return { status: 'error', error: 'Session not found' };
    }

    if (Date.now() > session.expiresAt) {
      this.activeQRSessions.delete(sessionId);
      return { status: 'expired' };
    }

    try {
      // Long-poll the Xiaomi endpoint
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(session.pollUrl, {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Log response details for debugging
      console.log(`[XiaomiCloud] Poll response status: ${response.status}`);

      const text = await response.text();
      console.log(`[XiaomiCloud] Poll response body (first 500 chars): ${text.substring(0, 500)}`);

      if (!response.ok) {
        // Timeout, rate limit, or no response yet - still pending
        // 403 can occur when session hasn't been scanned yet
        // 504/408 are timeout responses
        if (response.status === 504 || response.status === 408 || response.status === 403) {
          console.log(`[XiaomiCloud] Poll status ${response.status} - continuing to wait`);
          return { status: 'pending' };
        }
        throw new Error(`Poll failed: ${response.status}`);
      }

      // Parse JSON response - remove &&&START&&& prefix if present
      const jsonStr = text.replace('&&&START&&&', '').trim();
      console.log(`[XiaomiCloud] Cleaned JSON: ${jsonStr.substring(0, 300)}`);

      try {
        const data = JSON.parse(jsonStr);
        console.log(`[XiaomiCloud] Parsed data keys: ${Object.keys(data).join(', ')}`);

        // Check if login was successful - look for ssecurity and userId (full auth response)
        if (data.ssecurity && data.userId) {
          console.log(`[XiaomiCloud] Login confirmed! Full auth data received`);
          // Pass the full auth data as JSON string
          return {
            status: 'confirmed',
            authToken: JSON.stringify({
              ssecurity: data.ssecurity,
              userId: data.userId,
              passToken: data.passToken,
              location: data.location,
            }),
          };
        }

        // Check for code/status fields indicating waiting
        if (data.code === 0 || data.status === 0) {
          console.log(`[XiaomiCloud] Still waiting (code/status = 0)`);
          return { status: 'pending' };
        }

        // Check for error codes
        if (data.code && data.code !== 0) {
          console.log(`[XiaomiCloud] Error code: ${data.code}, message: ${data.desc || data.message}`);
          return { status: 'error', error: data.desc || data.message || `Error code: ${data.code}` };
        }

      } catch (parseError) {
        console.log(`[XiaomiCloud] JSON parse error: ${parseError}`);

        // Check raw text for indicators
        if (text.includes('location') || text.includes('serviceToken')) {
          // Try to extract location from headers
          const locationUrl = response.headers.get('location');
          if (locationUrl) {
            console.log(`[XiaomiCloud] Found location in headers`);
            return {
              status: 'confirmed',
              authToken: locationUrl,
            };
          }
        }
      }

      // Still waiting
      console.log(`[XiaomiCloud] No definitive response, continuing to wait`);
      return { status: 'pending' };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Timeout - still pending
        return { status: 'pending' };
      }
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Complete login after QR confirmation
   */
  async completeLogin(authToken: string, region: XiaomiRegion): Promise<void> {
    // authToken is now a JSON string with ssecurity, userId, passToken, and location
    let authData: {
      ssecurity: string;
      userId: number;
      passToken: string;
      location: string;
    };

    try {
      authData = JSON.parse(authToken);
      console.log('[XiaomiCloud] Parsed auth data, userId:', authData.userId);
    } catch {
      throw new Error('Invalid auth token format');
    }

    if (!authData.ssecurity || !authData.userId) {
      throw new Error('Missing required auth fields');
    }

    // Follow the location URL to get the serviceToken cookie
    let serviceToken: string | undefined;

    if (authData.location) {
      console.log('[XiaomiCloud] Following location URL to get serviceToken...');

      const response = await fetch(authData.location, {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
        },
        redirect: 'manual',
      });

      // Extract serviceToken from cookies
      const cookies = response.headers.get('set-cookie') || '';
      console.log('[XiaomiCloud] Response cookies (first 200 chars):', cookies.substring(0, 200));

      const serviceTokenMatch = cookies.match(/serviceToken=([^;]+)/);
      if (serviceTokenMatch) {
        serviceToken = serviceTokenMatch[1];
        console.log('[XiaomiCloud] ServiceToken extracted successfully');
      } else {
        // Try to get it from response body
        try {
          const text = await response.text();
          const jsonMatch = text.match(/&&&START&&&(.+)/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1]);
            serviceToken = data.serviceToken;
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }

    // If we still don't have serviceToken, try using passToken
    if (!serviceToken && authData.passToken) {
      console.log('[XiaomiCloud] Using passToken as serviceToken fallback');
      serviceToken = authData.passToken;
    }

    if (!serviceToken) {
      throw new Error('Failed to extract service token');
    }

    this.session = {
      userId: String(authData.userId),
      serviceToken: serviceToken,
      ssecurity: authData.ssecurity,
      region,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    console.log('[XiaomiCloud] Session established:', {
      userId: this.session.userId,
      region: this.session.region,
      hasServiceToken: !!this.session.serviceToken,
      hasSsecurity: !!this.session.ssecurity,
    });
  }

  /**
   * Get list of devices from Xiaomi cloud
   */
  async getDevices(): Promise<XiaomiDevice[]> {
    const devices: XiaomiDevice[] = [];

    // Method 1: Try /home/device_list endpoint (used by original token extractor)
    console.log('[XiaomiCloud] Fetching devices using /home/device_list...');
    try {
      const allDevices = await this.apiRequest<{
        list: Array<{
          did: string;
          name: string;
          model: string;
          mac: string;
          parent_id?: string;
          isOnline?: boolean;
        }>;
      }>('/home/device_list', {
        getVirtualModel: true,
        getHuamiDevices: 1,
        get_split_device: false,
        support_smart_home: true,
        fetch_share_dev: true, // Include shared devices from other users' Homes
      });

      console.log('[XiaomiCloud] /home/device_list returned:', allDevices?.list?.length || 0, 'devices');

      for (const device of allDevices?.list || []) {
        console.log('[XiaomiCloud] Device found:', device.name, device.model, device.did);
        devices.push({
          did: device.did,
          name: device.name,
          model: device.model || '',
          mac: device.mac || '',
          isBLE: device.did?.startsWith('blt.') || false,
          parentId: device.parent_id,
        });
      }
    } catch (error) {
      console.log('[XiaomiCloud] /home/device_list failed:', error);
    }

    // Method 2: If no devices found, try homes-based approach
    if (devices.length === 0) {
      console.log('[XiaomiCloud] Trying homes-based approach...');
      try {
        const homes = await this.apiRequest<{ homelist: Array<{ id: string; name: string }> }>(
          '/v2/homeroom/gethome',
          { fg: true, fetch_share: true, limit: 300 }
        );

        console.log('[XiaomiCloud] Found', homes?.homelist?.length || 0, 'homes');

        for (const home of homes?.homelist || []) {
          console.log('[XiaomiCloud] Checking home:', home.id, home.name);
          try {
            const homeDevices = await this.apiRequest<{
              device_info: Array<{
                did: string;
                name: string;
                model: string;
                mac: string;
                parent_id?: string;
              }>;
            }>('/v2/home/home_device_list', {
              home_id: home.id,
              limit: 200,
            });

            console.log('[XiaomiCloud] Home', home.id, 'has', homeDevices?.device_info?.length || 0, 'devices');

            for (const device of homeDevices?.device_info || []) {
              console.log('[XiaomiCloud] Device in home:', device.name, device.model, device.did);
              devices.push({
                did: device.did,
                name: device.name,
                model: device.model || '',
                mac: device.mac || '',
                isBLE: device.did?.startsWith('blt.') || false,
                parentId: device.parent_id,
              });
            }
          } catch (error) {
            console.warn(`[XiaomiCloud] Failed to get devices for home ${home.id}:`, error);
          }
        }
      } catch (error) {
        console.log('[XiaomiCloud] Homes-based approach failed:', error);
      }
    }

    console.log('[XiaomiCloud] Total devices found:', devices.length);
    return devices;
  }

  /**
   * Get BLE encryption key for a device
   */
  async getBLEKey(deviceId: string): Promise<BLEKeyResult> {
    if (!deviceId.startsWith('blt.')) {
      throw new Error('Not a BLE device');
    }

    const result = await this.apiRequest<{
      beaconkey: string;
      mac: string;
    }>('/v2/device/blt_get_beaconkey', {
      did: deviceId,
      pdid: 1,
    });

    return {
      did: deviceId,
      mac: result.mac,
      beaconKey: result.beaconkey,
    };
  }

  /**
   * Get current authentication state
   */
  getAuthState(): XiaomiAuthState {
    return {
      isAuthenticated: this.isSessionValid(),
      region: this.session.region,
      userId: this.session.userId,
      expiresAt: this.session.expiresAt,
    };
  }

  /**
   * Logout and clear session
   */
  logout(): void {
    this.session = {};
    this.activeQRSessions.clear();
  }

  /**
   * Check if session is still valid
   */
  isSessionValid(): boolean {
    return !!(
      this.session.serviceToken &&
      this.session.expiresAt &&
      Date.now() < this.session.expiresAt
    );
  }
}
