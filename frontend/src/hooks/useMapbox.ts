// src/hooks/useMapbox.ts

import { useState, useEffect, useCallback } from 'react';
import mapConfigService, { MapConfig } from '../services/mapConfigService';

interface UseMapboxOptions {
    autoLoad?: boolean;
}

interface UseMapboxReturn {
    isLoading: boolean;
    isEnabled: boolean;
    error: string | null;
    config: MapConfig | null;
    accessToken: string | null;
    style: string;
    defaultCenter: [number, number];
    defaultZoom: number;
    refreshConfig: () => Promise<void>;
}

export function useMapbox(options: UseMapboxOptions = {}): UseMapboxReturn {
    const { autoLoad = true } = options;

    const [isLoading, setIsLoading] = useState(true);
    const [isEnabled, setIsEnabled] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [config, setConfig] = useState<MapConfig | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [style, setStyle] = useState('mapbox://styles/mapbox/streets-v12');
    const [defaultCenter, setDefaultCenter] = useState<[number, number]>([106.6297, 10.8231]);
    const [defaultZoom, setDefaultZoom] = useState(12);

    const loadConfig = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const mapConfig = await mapConfigService.getConfig();

            setConfig(mapConfig);

            if (mapConfig.enabled && mapConfig.accessToken) {
                setIsEnabled(true);
                setAccessToken(mapConfig.accessToken);
                setStyle(mapConfig.style);
                setDefaultCenter(mapConfig.options.defaultCenter);
                setDefaultZoom(mapConfig.options.defaultZoom);
            } else {
                setIsEnabled(false);
                setError('Map service is not available');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load map config');
            setIsEnabled(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (autoLoad) {
            loadConfig();
        }
    }, [autoLoad, loadConfig]);

    const refreshConfig = useCallback(async () => {
        await mapConfigService.refreshConfig();
        await loadConfig();
    }, [loadConfig]);

    return {
        isLoading,
        isEnabled,
        error,
        config,
        accessToken,
        style,
        defaultCenter,
        defaultZoom,
        refreshConfig,
    };
}

export default useMapbox;
