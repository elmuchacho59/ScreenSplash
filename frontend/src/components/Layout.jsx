import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { systemApi } from '../services/api';
import {
    LayoutDashboard,
    Image,
    ListVideo,
    Calendar,
    Settings,
    Monitor,
    Tv2,
    Puzzle,
    LogOut
} from 'lucide-react';

function Layout({ onLogout }) {
    const location = useLocation();
    const [screenName, setScreenName] = useState('');

    useEffect(() => {
        const fetchScreenName = async () => {
            try {
                const res = await systemApi.getConfig();
                if (res.data.config && res.data.config.screen_name) {
                    setScreenName(res.data.config.screen_name);
                } else {
                    setScreenName('');
                }
            } catch (err) {
                console.error('Error fetching screen name:', err);
            }
        };

        fetchScreenName();

        // 1. Listen for instant sync from other tabs
        const syncChannel = new BroadcastChannel('screensplash_sync');
        syncChannel.onmessage = (event) => {
            if (event.data === 'config_updated') {
                fetchScreenName();
            }
        };

        // 2. Fallback polling for other devices (10s)
        const pollInterval = setInterval(fetchScreenName, 10000);

        return () => {
            syncChannel.close();
            clearInterval(pollInterval);
        };
    }, []);


    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
        { path: '/assets', icon: Image, label: 'Assets' },
        { path: '/playlists', icon: ListVideo, label: 'Playlists' },
        { path: '/schedules', icon: Calendar, label: 'Planification' },
        { path: '/widgets', icon: Puzzle, label: 'Widgets' },
        { path: '/settings', icon: Settings, label: 'Paramètres' },
    ];

    const handleLogout = async () => {
        if (onLogout) {
            onLogout();
        }
    };

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="logo">
                        <div className="logo-icon">
                            <Tv2 size={20} />
                        </div>
                        <div className="logo-text">
                            Screen<span>Splash</span>
                            {screenName && (
                                <div style={{
                                    fontSize: '0.75rem',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: 'var(--color-accent-primary)',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    marginTop: '4px',
                                    display: 'inline-block',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    letterSpacing: '0.02em',
                                    textTransform: 'uppercase'
                                }}>
                                    {screenName}
                                </div>
                            )}

                        </div>

                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">
                        <div className="nav-section-title">Navigation</div>
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `nav-link ${isActive && location.pathname === item.path ? 'active' : ''}`
                                }
                                end={item.path === '/'}
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>

                    <div className="nav-section">
                        <div className="nav-section-title">Lecteur</div>
                        <a
                            href="/player"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="nav-link"
                        >
                            <Monitor size={20} />
                            <span>Ouvrir le lecteur</span>
                        </a>
                    </div>
                </nav>

                <div className="sidebar-footer">
                    {onLogout && (
                        <button
                            onClick={handleLogout}
                            className="nav-link"
                            style={{
                                width: '100%',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                marginBottom: 'var(--spacing-sm)'
                            }}
                        >
                            <LogOut size={20} />
                            <span>Déconnexion</span>
                        </button>
                    )}
                    <div style={{
                        padding: 'var(--spacing-md)',
                        background: 'var(--color-bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.8rem'
                    }}>
                        <div style={{ color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                            Version
                        </div>
                        <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                            ScreenSplash v1.0.0
                        </div>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

export default Layout;
