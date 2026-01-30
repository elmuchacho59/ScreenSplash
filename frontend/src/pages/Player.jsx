import { useState, useEffect, useRef, useCallback } from 'react';
import { playerApi, systemApi } from '../services/api';
import InfoPage from '../components/InfoPage';
import { Maximize, Minimize } from 'lucide-react';

function Player() {
    const [currentItem, setCurrentItem] = useState(null);
    const [nextItem, setNextItem] = useState(null);
    const [items, setItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playlist, setPlaylist] = useState(null);
    const [transitioning, setTransitioning] = useState(false);
    const [error, setError] = useState(null);
    const [config, setConfig] = useState({
        display_rotation: '0',
        transition_effect: 'fade',
        transition_duration: '500',
        screen_orientation: 'landscape'
    });
    const [widgets, setWidgets] = useState([]);

    // Refs for polling and timers
    const videoRef = useRef(null);
    const timerRef = useRef(null);
    const pollRef = useRef(null);
    const managementPollRef = useRef(null);
    const lastRefreshToken = useRef(null);
    const lastCommandTime = useRef(null);
    const itemsRef = useRef([]);

    // Kiosk state
    const [showControls, setShowControls] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showCursor, setShowCursor] = useState(true);
    const controlsTimerRef = useRef(null);
    const cursorTimerRef = useRef(null);

    // Fetch config
    const fetchConfig = useCallback(async () => {
        try {
            const res = await systemApi.getConfig();
            if (res.data.config) {
                setConfig(prev => ({ ...prev, ...res.data.config }));
            }
        } catch (err) {
            console.error('Error fetching config:', err);
        }
    }, []);

    // Fetch widgets
    const fetchWidgets = useCallback(async () => {
        try {
            const res = await fetch('/api/widgets?enabled=true');
            if (res.ok) {
                const data = await res.json();
                setWidgets(data.widgets || []);
            }
        } catch (err) {
            console.error('Error fetching widgets:', err);
        }
    }, []);

    // Fetch current playlist content
    const fetchContent = useCallback(async () => {
        try {
            const res = await playerApi.getCurrent();
            if (res.data.items && res.data.items.length > 0) {
                setItems(res.data.items);
                itemsRef.current = res.data.items;
                setPlaylist(res.data.playlist);
                setError(null);
            } else {
                setError('Aucun contenu à afficher');
                setItems([]);
                itemsRef.current = [];
            }
        } catch (err) {
            console.error('Error fetching content:', err);
            setError('Impossible de charger le contenu');
        }
    }, []);

    // Advance to next item
    const advanceToNext = useCallback(() => {
        const duration = parseInt(config.transition_duration) || 500;
        setTransitioning(true);
        setTimeout(() => {
            setCurrentIndex(prev => {
                if (itemsRef.current.length === 0) return 0;
                return (prev + 1) % itemsRef.current.length;
            });
            setTransitioning(false);
        }, duration);
    }, [config.transition_duration]);

    // Initial fetch and polling
    useEffect(() => {
        fetchConfig();
        fetchContent();
        fetchWidgets();

        pollRef.current = setInterval(() => {
            fetchContent();
            fetchConfig();
            fetchWidgets();
        }, 60000); // Poll every minute

        // Live Management Polling (Refresh & Remote Control)
        managementPollRef.current = setInterval(async () => {
            try {
                const res = await systemApi.getConfig();
                const remoteConfig = res.data.config;
                if (!remoteConfig) return;

                // 1. Check for Refresh
                const refreshToken = remoteConfig.player_refresh_token;
                if (refreshToken && refreshToken !== lastRefreshToken.current) {
                    lastRefreshToken.current = refreshToken;
                    fetchContent();
                    fetchConfig();
                    fetchWidgets();
                }

                // 2. Check for Commands
                const command = remoteConfig.player_command;
                const commandTime = remoteConfig.player_command_time;
                if (command && command !== 'none' && commandTime && commandTime !== lastCommandTime.current) {
                    lastCommandTime.current = commandTime;
                    if (command === 'next') advanceToNext();
                    if (command === 'prev') {
                        setCurrentIndex(prev => {
                            if (itemsRef.current.length <= 1) return prev;
                            return (prev - 1 + itemsRef.current.length) % itemsRef.current.length;
                        });
                    }
                    if (command === 'refresh') fetchContent();
                }
            } catch (err) {
                console.error('Management poll error:', err);
            }
        }, 2000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (managementPollRef.current) clearInterval(managementPollRef.current);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [fetchContent, fetchConfig, fetchWidgets, advanceToNext]);

    // Handle item changes
    useEffect(() => {
        if (items.length > 0) {
            setCurrentItem(items[currentIndex]);
            const nextIdx = (currentIndex + 1) % items.length;
            setNextItem(items[nextIdx]);
        }
    }, [items, currentIndex]);

    // Handle auto-advancement
    useEffect(() => {
        if (!currentItem) return;
        const duration = (currentItem.duration || 10) * 1000;
        if (timerRef.current) clearTimeout(timerRef.current);
        if (currentItem.type === 'video') return;

        timerRef.current = setTimeout(() => {
            advanceToNext();
        }, duration);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [currentItem, advanceToNext]);

    const handleVideoEnd = () => advanceToNext();
    const handleVideoError = () => {
        console.error('Video error, advancing...');
        advanceToNext();
    };

    // Fullscreen and Kiosk logic
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Fullscreen error: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const handleMouseMove = useCallback(() => {
        setShowControls(true);
        setShowCursor(true);
        if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
        if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
        controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
        cursorTimerRef.current = setTimeout(() => setShowCursor(false), 3000);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') advanceToNext();
            else if (e.key === 'ArrowLeft') {
                setCurrentIndex(prev => {
                    if (itemsRef.current.length <= 1) return prev;
                    return (prev - 1 + itemsRef.current.length) % itemsRef.current.length;
                });
            } else if (e.key.toLowerCase() === 'f') toggleFullscreen();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [advanceToNext]);

    // Styles
    const rotation = parseInt(config.display_rotation) || 0;
    const isRotated = rotation === 90 || rotation === 270;

    const containerStyle = {
        width: '100vw',
        height: '100vh',
        background: '#000',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        cursor: showCursor ? 'default' : 'none'
    };

    const rotatedContentStyle = {
        width: isRotated ? '100vh' : '100vw',
        height: isRotated ? '100vw' : '100vh',
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center center',
        position: 'absolute',
        top: isRotated ? `calc(50vh - 50vw)` : 0,
        left: isRotated ? `calc(50vw - 50vh)` : 0
    };

    const getTransitionStyle = () => {
        const effect = config.transition_effect || 'fade';
        const duration = parseInt(config.transition_duration) || 500;
        if (effect === 'none') return { opacity: transitioning ? 0 : 1 };
        if (effect === 'fade') return { opacity: transitioning ? 0 : 1, transition: `opacity ${duration}ms ease-in-out` };
        return { opacity: 1 };
    };

    return (
        <div style={containerStyle} onMouseMove={handleMouseMove}>
            {/* Floating Controls */}
            <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 1000,
                opacity: showControls ? 1 : 0,
                transition: 'opacity 0.3s ease',
                pointerEvents: showControls ? 'auto' : 'none'
            }}>
                <button
                    onClick={toggleFullscreen}
                    style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        backdropFilter: 'blur(5px)',
                        display: 'flex'
                    }}
                >
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
            </div>

            <div style={rotatedContentStyle}>
                {error && items.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', height: '100%', color: 'white'
                    }}>
                        <h2 style={{ fontSize: '2rem' }}>ScreenSplash</h2>
                        <p style={{ opacity: 0.7 }}>{error}</p>
                    </div>
                ) : items.length === 0 ? (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: '100%', color: 'white'
                    }}>
                        <div className="loading-spinner" />
                    </div>
                ) : (
                    <div style={{ position: 'relative', width: '100%', height: '100%', ...getTransitionStyle() }}>
                        {currentItem.type === 'image' && (
                            <img src={currentItem.url || `/api/assets/${currentItem.asset_id}/file`} alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        )}
                        {currentItem.type === 'video' && (
                            <video ref={videoRef} src={currentItem.url || `/api/assets/${currentItem.asset_id}/file`}
                                autoPlay muted onEnded={handleVideoEnd} onError={handleVideoError}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        )}
                        {currentItem.type === 'url' && (
                            <iframe src={currentItem.url} title="content"
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                sandbox="allow-scripts allow-same-origin" />
                        )}
                        {currentItem.type === 'widget' && <InfoPage />}
                    </div>
                )}
                <WidgetOverlay widgets={widgets} />
            </div>
        </div>
    );
}

function WidgetOverlay({ widgets }) {
    if (!widgets || widgets.length === 0) return null;
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
            {widgets.map(widget => <Widget key={widget.id} widget={widget} />)}
        </div>
    );
}

function Widget({ widget }) {
    const positionStyles = {
        'top-left': { top: 20, left: 20 },
        'top-right': { top: 20, right: 20 },
        'bottom-left': { bottom: 20, left: 20 },
        'bottom-right': { bottom: 20, right: 20 }
    };
    const baseStyle = {
        position: 'absolute', padding: '12px 20px', background: 'rgba(0,0,0,0.7)',
        borderRadius: 12, color: 'white', ...(positionStyles[widget.position] || positionStyles['bottom-right'])
    };

    if (widget.type === 'clock') return <ClockWidget style={baseStyle} config={widget.config} />;
    return null;
}

function ClockWidget({ style }) {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div style={style}>
            <div style={{ fontSize: 32, fontWeight: 600 }}>{time.toLocaleTimeString('fr-FR')}</div>
        </div>
    );
}

export default Player;
