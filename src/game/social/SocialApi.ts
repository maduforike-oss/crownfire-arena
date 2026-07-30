import { loadSave } from '../utils/storage';
import type {
  FriendRecord,
  RivalryRecord,
  SocialMatchRecord,
  SocialProfile
} from './SocialTypes';

const IDENTITY_KEY = 'crowdfire.identity.v1';

interface StoredIdentity {
  sessionToken: string;
  profile: SocialProfile;
  serviceUrl: string;
  crownsMigrated: boolean;
}

export class SocialApi {
  private static singleton?: SocialApi;

  static get(): SocialApi {
    this.singleton ??= new SocialApi();
    return this.singleton;
  }

  readonly serviceUrl = this.resolveServiceUrl();
  private identity?: StoredIdentity;

  get available(): boolean {
    return Boolean(this.serviceUrl);
  }

  get profile(): SocialProfile | undefined {
    return this.identity?.profile;
  }

  get sessionToken(): string {
    return this.identity?.sessionToken ?? '';
  }

  get websocketUrl(): string {
    if (!this.serviceUrl) return '';
    const url = new URL(this.serviceUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
    return url.toString();
  }

  async ensureIdentity(displayName?: string): Promise<SocialProfile> {
    this.identity ??= this.readIdentity();
    if (this.identity && this.identity.serviceUrl === this.serviceUrl) {
      try {
        const response = await this.request<{ profile: SocialProfile }>('/api/v1/me');
        this.identity.profile = response.profile;
        this.writeIdentity();
        return response.profile;
      } catch {
        this.clearIdentity();
      }
    }
    if (!this.available) {
      const fallback = this.localProfile(displayName);
      this.identity = {
        sessionToken: '',
        profile: fallback,
        serviceUrl: '',
        crownsMigrated: false
      };
      return fallback;
    }
    const save = loadSave();
    const response = await this.request<{ profile: SocialProfile; sessionToken: string }>(
      '/api/v1/auth/guest',
      {
        method: 'POST',
        body: JSON.stringify({
          displayName,
          importedCrowns: save.crowns
        })
      },
      false
    );
    this.identity = {
      sessionToken: response.sessionToken,
      profile: response.profile,
      serviceUrl: this.serviceUrl,
      crownsMigrated: true
    };
    this.writeIdentity();
    return response.profile;
  }

  async updateProfile(displayName: string): Promise<SocialProfile> {
    const response = await this.request<{ profile: SocialProfile }>('/api/v1/me', {
      method: 'PATCH',
      body: JSON.stringify({ displayName })
    });
    if (this.identity) {
      this.identity.profile = response.profile;
      this.writeIdentity();
    }
    return response.profile;
  }

  async history(limit = 20): Promise<SocialMatchRecord[]> {
    const response = await this.request<{ matches: SocialMatchRecord[] }>(
      `/api/v1/history?limit=${Math.max(1, Math.min(50, limit))}`
    );
    return response.matches;
  }

  async rivalries(): Promise<RivalryRecord[]> {
    const response = await this.request<{ rivalries: RivalryRecord[] }>('/api/v1/rivalries');
    return response.rivalries;
  }

  async friends(): Promise<FriendRecord[]> {
    const response = await this.request<{ friends: FriendRecord[] }>('/api/v1/friends');
    return response.friends;
  }

  async inviteFriend(profile: string): Promise<SocialProfile> {
    const response = await this.request<{ friend: SocialProfile }>('/api/v1/friends/invite', {
      method: 'POST',
      body: JSON.stringify({ profile })
    });
    return response.friend;
  }

  async acceptFriend(profileId: string): Promise<void> {
    await this.request(`/api/v1/friends/${encodeURIComponent(profileId)}/accept`, { method: 'POST' });
  }

  clearIdentity(): void {
    this.identity = undefined;
    try {
      localStorage.removeItem(IDENTITY_KEY);
    } catch {
      // Browser storage is optional.
    }
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit = {},
    authenticated = true
  ): Promise<T> {
    if (!this.serviceUrl) throw new Error('The online Crowdfire service is not configured in this build.');
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (authenticated && this.sessionToken) headers.set('authorization', `Bearer ${this.sessionToken}`);
    const response = await fetch(`${this.serviceUrl}${path}`, { ...init, headers });
    const body = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) throw new Error(body.message ?? `Crowdfire service returned ${response.status}.`);
    return body as T;
  }

  private resolveServiceUrl(): string {
    const configured = import.meta.env.VITE_CROWDFIRE_SERVICE_URL?.trim();
    if (configured) return configured.replace(/\/$/, '');
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
      return 'http://127.0.0.1:8787';
    }
    return '';
  }

  private readIdentity(): StoredIdentity | undefined {
    try {
      const parsed = JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? 'null') as Partial<StoredIdentity> | null;
      return parsed?.profile && typeof parsed.sessionToken === 'string'
        ? parsed as StoredIdentity
        : undefined;
    } catch {
      return undefined;
    }
  }

  private writeIdentity(): void {
    try {
      if (this.identity) localStorage.setItem(IDENTITY_KEY, JSON.stringify(this.identity));
    } catch {
      // Gameplay remains available without persistent browser storage.
    }
  }

  private localProfile(displayName?: string): SocialProfile {
    const save = loadSave();
    return {
      id: 'local-profile',
      handle: 'offline-wanderer',
      displayName: displayName?.trim().slice(0, 32) || 'Offline Wanderer',
      guest: true,
      crowns: save.crowns,
      wins: save.wins,
      online: false,
      roomCode: undefined,
      createdAt: new Date().toISOString()
    };
  }
}
