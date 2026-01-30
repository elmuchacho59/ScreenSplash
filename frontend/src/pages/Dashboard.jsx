import { useState, useEffect } from 'react';
import {
    Image,
    ListVideo,
    Calendar,
    Cpu,
    HardDrive,
    Thermometer,
    Clock,
    Wifi,
    Activity
} from 'lucide-react';
import { systemApi, assetsApi, playlistsApi } from '../services/api';

function Dashboard() {
    const [systemStatus, setSystemStatus] = useState(null);
    const [systemInfo, setSystemInfo] = useState(null);
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({ assets: 0, playlists: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();

        const interval = setInterval(fetchSystemStatus, 10000);

        // Listen for sync events
        const syncChannel = new BroadcastChannel('screensplash_sync');
        syncChannel.onmessage = (event) => {
            if (event.data === 'data_updated' || event.data === 'config_updated') {
                fetchData();
            }
        };

        return () => {
            clearInterval(interval);
            syncChannel.close();
        };
    }, []);


    const fetchData = async () => {
        try {
            const [statusRes, infoRes, logsRes, assetsRes, playlistsRes] = await Promise.all([
                systemApi.getStatus(),
                systemApi.getInfo(),
                systemApi.getLogs(10),
                assetsApi.getAll({ per_page: 1 }),
                playlistsApi.getAll()
            ]);

            setSystemStatus(statusRes.data);
            setSystemInfo(infoRes.data);
            setLogs(logsRes.data.logs || []);
            setStats({
                assets: assetsRes.data.total || 0,
                playlists: playlistsRes.data.playlists?.length || 0
            });
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSystemStatus = async () => {
        try {
            const res = await systemApi.getStatus();
            setSystemStatus(res.data);
        } catch (error) {
            console.error('Error fetching status:', error);
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds) => {
        if (!seconds) return '0s';
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}j ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const getProgressColor = (percent) => {
        if (percent < 50) return 'green';
        if (percent < 80) return 'yellow';
        return 'red';
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh'
            }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <>
            <header className="page-header">
                <h1 className="page-title">Tableau de bord</h1>
                <p className="page-subtitle">Vue d'ensemble de votre système d'affichage</p>
            </header>

            <div className="page-content">
                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon purple">
                            <Image size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Assets</div>
                            <div className="stat-value">{stats.assets}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon blue">
                            <ListVideo size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Playlists</div>
                            <div className="stat-value">{stats.playlists}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon green">
                            <Clock size={24} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-label">Uptime</div>
                            <div className="stat-value">{formatUptime(systemStatus?.uptime?.seconds)}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon orange">
                            <Wifi size={24} />
                        </div>
                        <div className="stat-content" style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div className="stat-label">Réseau</div>
                                {systemStatus?.network?.wifi?.active && (
                                    <div style={{
                                        fontSize: '0.7rem',
                                        color: systemStatus.network.wifi.signal > 50 ? 'var(--color-success)' : 'var(--color-warning)',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <Activity size={10} />
                                        {systemStatus.network.wifi.signal}%
                                    </div>
                                )}
                            </div>
                            <div className="stat-value" style={{ fontSize: '1rem', marginTop: '2px' }}>
                                {systemStatus?.network?.wifi?.active
                                    ? systemStatus.network.wifi.ssid
                                    : systemStatus?.network?.ip || 'N/A'
                                }
                            </div>
                            {systemStatus?.network?.wifi?.active && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                    IP: {systemStatus?.network?.ip}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* System Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
                    {/* CPU */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Cpu size={20} />
                                Processeur
                            </div>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {systemStatus?.cpu?.percent || 0}%
                            </span>
                        </div>
                        <div className="card-body">
                            <div className="progress-bar">
                                <div
                                    className={`progress-bar-fill ${getProgressColor(systemStatus?.cpu?.percent || 0)}`}
                                    style={{ width: `${systemStatus?.cpu?.percent || 0}%` }}
                                />
                            </div>
                            <div style={{ marginTop: 'var(--spacing-md)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                {systemStatus?.cpu?.count || 0} cœurs
                            </div>
                        </div>
                    </div>

                    {/* Memory */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Activity size={20} />
                                Mémoire RAM
                            </div>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {systemStatus?.memory?.percent || 0}%
                            </span>
                        </div>
                        <div className="card-body">
                            <div className="progress-bar">
                                <div
                                    className={`progress-bar-fill ${getProgressColor(systemStatus?.memory?.percent || 0)}`}
                                    style={{ width: `${systemStatus?.memory?.percent || 0}%` }}
                                />
                            </div>
                            <div style={{ marginTop: 'var(--spacing-md)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                {formatBytes(systemStatus?.memory?.used)} / {formatBytes(systemStatus?.memory?.total)}
                            </div>
                        </div>
                    </div>

                    {/* Disk */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <HardDrive size={20} />
                                Stockage
                            </div>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {systemStatus?.disk?.percent || 0}%
                            </span>
                        </div>
                        <div className="card-body">
                            <div className="progress-bar">
                                <div
                                    className={`progress-bar-fill ${getProgressColor(systemStatus?.disk?.percent || 0)}`}
                                    style={{ width: `${systemStatus?.disk?.percent || 0}%` }}
                                />
                            </div>
                            <div style={{ marginTop: 'var(--spacing-md)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                {formatBytes(systemStatus?.disk?.used)} / {formatBytes(systemStatus?.disk?.total)}
                            </div>
                        </div>
                    </div>

                    {/* Temperature */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Thermometer size={20} />
                                Température CPU
                            </div>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                                {systemStatus?.temperature?.cpu ? `${systemStatus.temperature.cpu}°C` : 'N/A'}
                            </span>
                        </div>
                        <div className="card-body">
                            {systemStatus?.temperature?.cpu && (
                                <>
                                    <div className="progress-bar">
                                        <div
                                            className={`progress-bar-fill ${systemStatus.temperature.cpu < 50 ? 'green' : systemStatus.temperature.cpu < 70 ? 'yellow' : 'red'}`}
                                            style={{ width: `${Math.min(100, systemStatus.temperature.cpu)}%` }}
                                        />
                                    </div>
                                    <div style={{ marginTop: 'var(--spacing-md)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                        {systemStatus.temperature.cpu < 50 ? 'Normal' : systemStatus.temperature.cpu < 70 ? 'Élevée' : 'Critique'}
                                    </div>
                                </>
                            )}
                            {!systemStatus?.temperature?.cpu && (
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                    Non disponible sur cette plateforme
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* System Info & Activity Log */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--spacing-lg)' }}>
                    {/* Device Info */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Informations Système</h3>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                                <InfoRow label="Hostname" value={systemInfo?.device?.hostname} />
                                <InfoRow label="Plateforme" value={`${systemInfo?.device?.platform} ${systemInfo?.device?.platform_release}`} />
                                <InfoRow label="Architecture" value={systemInfo?.device?.architecture} />
                                <InfoRow label="Modèle" value={systemInfo?.device?.model} />
                                <InfoRow label="Adresse MAC" value={systemInfo?.mac_address} />
                                <InfoRow label="Python" value={systemInfo?.python_version} />
                            </div>
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Activité Récente</h3>
                        </div>
                        <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            {logs.length === 0 ? (
                                <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--spacing-lg)' }}>
                                    Aucune activité récente
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                                    {logs.map((log) => (
                                        <div
                                            key={log.id}
                                            style={{
                                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                                background: 'var(--color-bg-tertiary)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                <span style={{ fontWeight: 500 }}>{log.action.replace(/_/g, ' ')}</span>
                                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                                    {new Date(log.created_at).toLocaleTimeString('fr-FR')}
                                                </span>
                                            </div>
                                            {log.details && (
                                                <div style={{ color: 'var(--color-text-muted)' }}>{log.details}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function InfoRow({ label, value }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
            <span style={{ fontWeight: 500 }}>{value || 'N/A'}</span>
        </div>
    );
}

export default Dashboard;
