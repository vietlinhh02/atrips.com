// src/services/mapConfigService.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

interface MapConfig {
    enabled: boolean;
    provider: string;
    accessToken: string;
    style: string;
    options: {
        defaultCenter: [number, number];
        defaultZoom: number;
        maxZoom: number;
        minZoom: number;
    };
}

const COOKIE_NAME = 'atrips_map_config';

class MapConfigService {
    private memoryCache: MapConfig | null = null;
    private fetchPromise: Promise<MapConfig> | null = null;

    /**
     * Get map config with caching (memory + cookie)
     */
    async getConfig(): Promise<MapConfig> {
        // 1. Check memory cache first (fastest)
        if (this.memoryCache) {
            return this.memoryCache;
        }

        // 2. Check cookie cache (set by backend, persists across reloads)
        const cookieConfig = this.getFromCookie();
        if (cookieConfig) {
            this.memoryCache = cookieConfig;
            return cookieConfig;
        }

        // 3. Prevent duplicate requests (dedup)
        if (this.fetchPromise) {
            return this.fetchPromise;
        }

        // 4. Fetch from API (will also set cookie)
        this.fetchPromise = this.fetchFromAPI();

        try {
            const config = await this.fetchPromise;
            return config;
        } finally {
            this.fetchPromise = null;
        }
    }

    /**
     * Fetch config from backend API
     * Backend will set cookie automatically
     */
    private async fetchFromAPI(): Promise<MapConfig> {
        try {
            const response = await fetch(`${API_BASE_URL}/config/map`, {
                method: 'GET',
                credentials: 'include', // Include cookies for auth
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required');
                }
                throw new Error(`Failed to fetch map config: ${response.status}`);
            }

            const { data } = await response.json();

            // Cache in memory
            this.memoryCache = data;

            // Note: Cookie is set automatically by backend response

            return data;
        } catch (error) {
            console.error('Failed to fetch map config:', error);

            // Return disabled config on error
            return this.getDisabledConfig();
        }
    }

    /**
     * Get config from cookie
     */
    private getFromCookie(): MapConfig | null {
        try {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === COOKIE_NAME && value) {
                    const decoded = decodeURIComponent(value);
                    return JSON.parse(decoded);
                }
            }
        } catch (e) {
            console.warn('Failed to parse map config from cookie:', e);
        }
        return null;
    }

    /**
     * Clear cache (call on logout)
     */
    clearCache(): void {
        this.memoryCache = null;
        // Clear cookie
        document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    /**
     * Refresh cache (force fetch)
     */
    async refreshConfig(): Promise<MapConfig> {
        this.clearCache();
        return this.getConfig();
    }

    /**
     * Get disabled config (fallback)
     */
    private getDisabledConfig(): MapConfig {
        return {
            enabled: false,
            provider: 'mapbox',
            accessToken: '',
            style: '',
            options: {
                defaultCenter: [106.6297, 10.8231],
                defaultZoom: 12,
                maxZoom: 18,
                minZoom: 2,
            },
        };
    }

    /**
     * Check if config is available (sync check)
     */
    hasConfig(): boolean {
        return !!(this.memoryCache || this.getFromCookie());
    }

    /**
     * Get config synchronously (from cache only, no fetch)
     * Returns null if not cached
     */
    getConfigSync(): MapConfig | null {
        if (this.memoryCache) {
            return this.memoryCache;
        }
        const cookieConfig = this.getFromCookie();
        if (cookieConfig) {
            this.memoryCache = cookieConfig;
            return cookieConfig;
        }
        return null;
    }
}

// Export singleton instance
export const mapConfigService = new MapConfigService();
export default mapConfigService;
export type { MapConfig };
