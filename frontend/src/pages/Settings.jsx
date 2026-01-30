import { useState, useEffect } from 'react';
import { Save, RefreshCw, Monitor, RotateCcw, Lock, Eye, EyeOff, Shield, Wifi, Activity, Globe } from 'lucide-react';
import { systemApi } from '../services/api';

function Settings() {
    const [config, setConfig] = useState({
        display_rotation: '0',
        refresh_interval: '60',
        transition_effect: 'fade',
        transition_duration: '500',
        screen_orientation: 'landscape'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [status, setStatus] = useState(null);


    // Password state
    const [passwordSet, setPasswordSet] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);

    useEffect(() => {
        fetchConfig();
        checkPasswordStatus();
        fetchStatus();
    }, []);


    const fetchConfig = async () => {
        try {
            const res = await systemApi.getConfig();
            if (res.data.config) {
                setConfig(prev => ({ ...prev, ...res.data.config }));
            }
        } catch (error) {
            console.error('Error fetching config:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStatus = async () => {
        try {
            const res = await systemApi.getStatus();
            setStatus(res.data);
        } catch (error) {
            console.error('Error fetching status:', error);
        }
    };


    const checkPasswordStatus = async () => {
        try {
            const res = await fetch('/api/auth/check', { credentials: 'include' });
            const data = await res.json();
            setPasswordSet(data.password_set || false);
        } catch (err) {
            console.error('Error checking password:', err);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await systemApi.updateConfig(config);

            // Broadcast sync event for local tabs
            const syncChannel = new BroadcastChannel('screensplash_sync');
            syncChannel.postMessage('config_updated');
            syncChannel.close();

            setMessage({ type: 'success', text: 'Configuration enregistrée !' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement' });
        } finally {
            setSaving(false);
        }
    };


    const handleChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
            return;
        }

        if (newPassword.length < 4) {
            setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 4 caractères' });
            return;
        }

        setPasswordSaving(true);
        try {
            const res = await fetch('/api/auth/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: 'Mot de passe mis à jour !' });
                setPasswordSet(true);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setMessage({ type: 'error', text: data.error || 'Erreur' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Erreur de connexion' });
        } finally {
            setPasswordSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleRemovePassword = async () => {
        if (!confirm('Désactiver la protection par mot de passe ?')) return;

        setPasswordSaving(true);
        try {
            const res = await fetch('/api/auth/password', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ current_password: currentPassword })
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: 'Protection désactivée' });
                setPasswordSet(false);
                setCurrentPassword('');
            } else {
                setMessage({ type: 'error', text: data.error || 'Erreur' });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Erreur de connexion' });
        } finally {
            setPasswordSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <>
            <header className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">Paramètres</h1>
                        <p className="page-subtitle">Configuration de l'affichage et du système</p>
                    </div>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
                        Enregistrer
                    </button>
                </div>
            </header>

            <div className="page-content">
                {message && (
                    <div
                        className={`toast ${message.type}`}
                        style={{
                            position: 'fixed',
                            top: 'var(--spacing-lg)',
                            right: 'var(--spacing-lg)',
                            zIndex: 1000
                        }}
                    >
                        {message.text}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--spacing-lg)' }}>
                    {/* Network Status Card - Highly Visible */}
                    <div className="card" style={{ gridColumn: '1 / -1', border: '1px solid rgba(99, 102, 241, 0.3)', background: 'rgba(99, 102, 241, 0.02)' }}>
                        <div className="card-header" style={{ borderBottom: '1px solid rgba(99, 102, 241, 0.1)' }}>
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Wifi size={20} className="text-primary" />
                                État du Réseau & WiFi
                            </h3>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-xl)' }}>
                                <div>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        Connexion
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
                                        Opérationnel
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        Adresse IP locale
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{status?.network?.ip || 'chargement...'}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        Réseau (SSID)
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {status?.network?.wifi?.active ? (
                                            <>
                                                <Wifi size={18} />
                                                {status.network.wifi.ssid}
                                            </>
                                        ) : (
                                            <>
                                                <Globe size={18} />
                                                Ethernet / Filaire
                                            </>
                                        )}
                                    </div>
                                </div>
                                {status?.network?.wifi?.active && (
                                    <div>
                                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                            Intensité du signal
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ flex: 1, height: 8, background: 'var(--color-bg-tertiary)', borderRadius: 4, overflow: 'hidden', minWidth: '120px' }}>
                                                <div style={{
                                                    width: `${status.network.wifi.signal}%`,
                                                    height: '100%',
                                                    background: status.network.wifi.signal > 70 ? 'var(--color-success)' : status.network.wifi.signal > 40 ? 'var(--color-warning)' : 'var(--color-danger)',
                                                    transition: 'width 1s ease'
                                                }} />
                                            </div>
                                            <span style={{ fontWeight: 700, fontSize: '1rem', color: status.network.wifi.signal > 40 ? 'inherit' : 'var(--color-danger)' }}>
                                                {status.network.wifi.signal}%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Display Settings */}
                    <div className="card">

                        <div className="card-header">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Monitor size={20} />
                                Affichage
                            </h3>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Nom de l'écran</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="ex: Salon, Entrée, TV 1..."
                                    value={config.screen_name || ''}
                                    onChange={(e) => handleChange('screen_name', e.target.value)}
                                />
                                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                    Apparaît dans le tableau de bord pour identifier cet écran
                                </small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Orientation de l'écran</label>

                                <select
                                    className="form-input"
                                    value={config.screen_orientation}
                                    onChange={(e) => handleChange('screen_orientation', e.target.value)}
                                >
                                    <option value="landscape">Paysage (Horizontal)</option>
                                    <option value="portrait">Portrait (Vertical)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Rotation de l'écran</label>
                                <select
                                    className="form-input"
                                    value={config.display_rotation}
                                    onChange={(e) => handleChange('display_rotation', e.target.value)}
                                >
                                    <option value="0">0° (Normal)</option>
                                    <option value="90">90° (Droite)</option>
                                    <option value="180">180° (Inversé)</option>
                                    <option value="270">270° (Gauche)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Intervalle de rafraîchissement (secondes)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="10"
                                    max="3600"
                                    value={config.refresh_interval}
                                    onChange={(e) => handleChange('refresh_interval', e.target.value)}
                                />
                                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                    Fréquence de vérification des mises à jour de contenu
                                </small>
                            </div>
                        </div>
                    </div>

                    {/* Transitions */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <RotateCcw size={20} />
                                Transitions
                            </h3>
                        </div>
                        <div className="card-body">
                            <div className="form-group">
                                <label className="form-label">Effet de transition</label>
                                <select
                                    className="form-input"
                                    value={config.transition_effect}
                                    onChange={(e) => handleChange('transition_effect', e.target.value)}
                                >
                                    <option value="none">Aucun</option>
                                    <option value="fade">Fondu</option>
                                    <option value="slide">Glissement</option>
                                    <option value="zoom">Zoom</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Durée de transition (ms)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    min="0"
                                    max="5000"
                                    step="100"
                                    value={config.transition_duration}
                                    onChange={(e) => handleChange('transition_duration', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Password Protection */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                <Shield size={20} />
                                Protection par mot de passe
                            </h3>
                        </div>
                        <div className="card-body">
                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: passwordSet
                                    ? 'rgba(34, 197, 94, 0.1)'
                                    : 'rgba(239, 68, 68, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: 'var(--spacing-md)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-sm)'
                            }}>
                                <Lock size={16} style={{ color: passwordSet ? 'var(--color-success)' : 'var(--color-error)' }} />
                                <span style={{ fontSize: '0.9rem' }}>
                                    {passwordSet ? 'Protégé par mot de passe' : 'Non protégé'}
                                </span>
                            </div>

                            <form onSubmit={handlePasswordSubmit}>
                                {passwordSet && (
                                    <div className="form-group">
                                        <label className="form-label">Mot de passe actuel</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type={showPasswords ? 'text' : 'password'}
                                                className="form-input"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                placeholder="Requis pour modifier"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">
                                        {passwordSet ? 'Nouveau mot de passe' : 'Définir un mot de passe'}
                                    </label>
                                    <input
                                        type={showPasswords ? 'text' : 'password'}
                                        className="form-input"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="4 caractères minimum"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Confirmer</label>
                                    <input
                                        type={showPasswords ? 'text' : 'password'}
                                        className="form-input"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Répétez le mot de passe"
                                    />
                                </div>

                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer', marginBottom: 'var(--spacing-md)' }}>
                                    <input
                                        type="checkbox"
                                        checked={showPasswords}
                                        onChange={(e) => setShowPasswords(e.target.checked)}
                                    />
                                    <span style={{ fontSize: '0.85rem' }}>Afficher les mots de passe</span>
                                </label>

                                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={passwordSaving || !newPassword || !confirmPassword}
                                    >
                                        {passwordSet ? 'Modifier' : 'Activer'}
                                    </button>
                                    {passwordSet && (
                                        <button
                                            type="button"
                                            className="btn btn-danger"
                                            onClick={handleRemovePassword}
                                            disabled={passwordSaving || !currentPassword}
                                        >
                                            Désactiver
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Player Link */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Lecteur</h3>
                        </div>
                        <div className="card-body">
                            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                                Ouvrez le lecteur en plein écran pour afficher le contenu sur votre écran.
                            </p>
                            <a
                                href="/player"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                <Monitor size={20} />
                                Ouvrir le lecteur
                            </a>
                            <div style={{
                                marginTop: 'var(--spacing-lg)',
                                padding: 'var(--spacing-md)',
                                background: 'var(--color-bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.85rem'
                            }}>
                                <strong>Astuce:</strong> Appuyez sur F11 pour passer en mode plein écran
                            </div>
                        </div>
                    </div>

                    {/* About */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">À propos</h3>
                        </div>
                        <div className="card-body">
                            <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Version</span>
                                    <span style={{ fontWeight: 500 }}>1.0.0</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Nom</span>
                                    <span style={{ fontWeight: 500 }}>ScreenSplash</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--color-text-muted)' }}>Licence</span>
                                    <span style={{ fontWeight: 500 }}>MIT</span>
                                </div>
                            </div>
                            <div style={{
                                marginTop: 'var(--spacing-lg)',
                                padding: 'var(--spacing-md)',
                                background: 'rgba(99, 102, 241, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                                    Application d'affichage dynamique pour Raspberry Pi
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </>
    );
}

export default Settings;
