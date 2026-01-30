import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Power, Save, Clock, CloudSun, Type } from 'lucide-react';

const WIDGET_ICONS = {
    clock: Clock,
    weather: CloudSun,
    text: Type
};

const WIDGET_NAMES = {
    clock: 'Horloge',
    weather: 'Météo',
    text: 'Texte'
};

function WidgetManager() {
    const [widgets, setWidgets] = useState([]);
    const [widgetTypes, setWidgetTypes] = useState([]);
    const [positions, setPositions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingWidget, setEditingWidget] = useState(null);

    useEffect(() => {
        fetchWidgets();
        fetchWidgetTypes();
    }, []);

    const fetchWidgets = async () => {
        try {
            const res = await fetch('/api/widgets');
            const data = await res.json();
            setWidgets(data.widgets || []);
        } catch (err) {
            console.error('Error fetching widgets:', err);
        } finally {
            setLoading(false);
        }
    };

    const broadcastChange = () => {
        const syncChannel = new BroadcastChannel('screensplash_sync');
        syncChannel.postMessage('data_updated');
        syncChannel.close();
    };


    const fetchWidgetTypes = async () => {
        try {
            const res = await fetch('/api/widgets/types');
            const data = await res.json();
            setWidgetTypes(data.types || []);
            setPositions(data.positions || []);
        } catch (err) {
            console.error('Error fetching widget types:', err);
        }
    };

    const handleCreate = async (data) => {
        try {
            const res = await fetch('/api/widgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                fetchWidgets();
                broadcastChange();
                setShowModal(false);
            }

        } catch (err) {
            console.error('Error creating widget:', err);
        }
    };

    const handleUpdate = async (id, data) => {
        try {
            const res = await fetch(`/api/widgets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                fetchWidgets();
                broadcastChange();
                setEditingWidget(null);
            }

        } catch (err) {
            console.error('Error updating widget:', err);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Supprimer ce widget ?')) return;
        try {
            await fetch(`/api/widgets/${id}`, { method: 'DELETE' });
            fetchWidgets();
            broadcastChange();
        } catch (err) {

            console.error('Error deleting widget:', err);
        }
    };

    const handleToggle = async (widget) => {
        await handleUpdate(widget.id, { is_enabled: !widget.is_enabled });
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
                        <h1 className="page-title">Widgets</h1>
                        <p className="page-subtitle">Ajoutez des widgets overlay sur l'écran (horloge, météo, texte)</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={18} />
                        Ajouter un widget
                    </button>
                </div>
            </header>

            <div className="page-content">
                {widgets.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <Clock size={32} />
                        </div>
                        <h3 className="empty-state-title">Aucun widget</h3>
                        <p className="empty-state-text">
                            Les widgets s'affichent en overlay sur le lecteur
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={() => setShowModal(true)}>
                            <Plus size={20} />
                            Créer un widget
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--spacing-md)' }}>
                        {widgets.map(widget => {
                            const Icon = WIDGET_ICONS[widget.type] || Clock;
                            return (
                                <div key={widget.id} className="card">
                                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                        {/* Toggle */}
                                        <div
                                            onClick={() => handleToggle(widget)}
                                            style={{
                                                width: 44,
                                                height: 26,
                                                borderRadius: 'var(--radius-full)',
                                                background: widget.is_enabled ? 'var(--color-success)' : 'var(--color-bg-tertiary)',
                                                cursor: 'pointer',
                                                position: 'relative',
                                                flexShrink: 0,
                                                transition: 'background var(--transition-fast)'
                                            }}
                                        >
                                            <div style={{
                                                width: 20,
                                                height: 20,
                                                borderRadius: '50%',
                                                background: 'white',
                                                position: 'absolute',
                                                top: 3,
                                                left: widget.is_enabled ? 21 : 3,
                                                transition: 'left var(--transition-fast)'
                                            }} />
                                        </div>

                                        {/* Icon */}
                                        <div style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--color-bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Icon size={22} />
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600 }}>{widget.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                                {WIDGET_NAMES[widget.type]} • {positions.find(p => p.id === widget.position)?.name || widget.position}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                            <button
                                                className="btn btn-icon btn-secondary"
                                                onClick={() => setEditingWidget(widget)}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn btn-icon btn-danger"
                                                onClick={() => handleDelete(widget.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Create/Edit Modal */}
                {(showModal || editingWidget) && (
                    <WidgetModal
                        widget={editingWidget}
                        widgetTypes={widgetTypes}
                        positions={positions}
                        onClose={() => { setShowModal(false); setEditingWidget(null); }}
                        onSubmit={editingWidget
                            ? (data) => handleUpdate(editingWidget.id, data)
                            : handleCreate
                        }
                    />
                )}
            </div>
        </>
    );
}

function WidgetModal({ widget, widgetTypes, positions, onClose, onSubmit }) {
    const [type, setType] = useState(widget?.type || 'clock');
    const [name, setName] = useState(widget?.name || '');
    const [position, setPosition] = useState(widget?.position || 'bottom-right');
    const [config, setConfig] = useState(widget?.config || {});

    const selectedType = widgetTypes.find(t => t.id === type);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            type,
            name: name || WIDGET_NAMES[type] || 'Widget',
            position,
            config,
            is_enabled: true
        });
    };

    const updateConfig = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {widget ? 'Modifier le widget' : 'Nouveau widget'}
                    </h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 300px', gap: 'var(--spacing-lg)' }}>
                            <div className="modal-form-content">
                                {/* Type Selection */}
                                {!widget && (
                                    <div className="form-group">
                                        <label className="form-label">Type de widget</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-sm)' }}>
                                            {widgetTypes.map(wt => (
                                                <button
                                                    key={wt.id}
                                                    type="button"
                                                    onClick={() => { setType(wt.id); if (!name || name === WIDGET_NAMES[type]) setName(WIDGET_NAMES[wt.id]); }}
                                                    style={{
                                                        padding: 'var(--spacing-md)',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: type === wt.id
                                                            ? '2px solid var(--color-accent-primary)'
                                                            : '1px solid var(--color-border)',
                                                        background: type === wt.id
                                                            ? 'rgba(99, 102, 241, 0.1)'
                                                            : 'var(--color-bg-tertiary)',
                                                        cursor: 'pointer',
                                                        textAlign: 'center',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        transition: 'all var(--transition-fast)'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '24px' }}>{wt.icon}</span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{wt.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Nom</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder={WIDGET_NAMES[type]}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Position</label>
                                        <select
                                            className="form-input"
                                            value={position}
                                            onChange={(e) => setPosition(e.target.value)}
                                        >
                                            {positions.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Type-specific config */}
                                {selectedType && selectedType.config_schema && (
                                    <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-border)' }}>
                                        <h4 style={{ marginBottom: 'var(--spacing-md)', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                            Configuration
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                                            {Object.entries(selectedType.config_schema).map(([key, schema]) => (
                                                <div className="form-group" key={key} style={{ marginBottom: 'var(--spacing-sm)' }}>
                                                    <label className="form-label">{schema.label || key}</label>
                                                    {schema.type === 'boolean' ? (
                                                        <div style={{ height: '42px', display: 'flex', alignItems: 'center' }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={config[key] ?? schema.default}
                                                                    onChange={(e) => updateConfig(key, e.target.checked)}
                                                                    style={{ width: '18px', height: '18px' }}
                                                                />
                                                                <span style={{ fontSize: '0.9rem' }}>Activer</span>
                                                            </label>
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            placeholder={schema.default || ''}
                                                            value={config[key] ?? schema.default ?? ''}
                                                            onChange={(e) => updateConfig(key, e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-preview-sidebar">
                                <label className="form-label">Aperçu en direct</label>
                                <div className="widget-preview-container" style={{ width: '100%', marginBottom: 0 }}>
                                    <div className="widget-preview-content">
                                        <WidgetPreview type={type} config={config} position={position} />
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-sm)' }}>
                                    L'aperçu simule l'affichage final sur l'écran du lecteur.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={18} />
                            {widget ? 'Enregistrer les modifications' : 'Créer le widget'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function WidgetPreview({ type, config, position }) {
    const positionStyles = {
        'top-left': { top: '10px', left: '10px' },
        'top-right': { top: '10px', right: '10px' },
        'top-center': { top: '10px', left: '50%', transform: 'translateX(-50%)' },
        'bottom-left': { bottom: '10px', left: '10px' },
        'bottom-right': { bottom: '10px', right: '10px' },
        'bottom-center': { bottom: '10px', left: '50%', transform: 'translateX(-50%)' }
    };

    const baseStyle = {
        position: 'absolute',
        padding: '6px 10px',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(5px)',
        borderRadius: 6,
        color: 'white',
        fontSize: '10px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        transition: 'all 0.3s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
        ...(positionStyles[position] || positionStyles['bottom-right'])
    };

    if (type === 'clock') {
        const time = new Date();
        const showSeconds = config?.showSeconds !== false;
        const showDate = config?.showDate !== false;

        const timeStr = time.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: showSeconds ? '2-digit' : undefined
        });
        const dateStr = time.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

        return (
            <div style={baseStyle}>
                <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.2 }}>{timeStr}</div>
                {showDate && <div style={{ fontSize: '8px', opacity: 0.8 }}>{dateStr}</div>}
            </div>
        );
    }

    if (type === 'weather') {
        return (
            <div style={{ ...baseStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: '18px' }}>🌤️</div>
                <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1 }}>22°C</div>
                    <div style={{ fontSize: '7px', opacity: 0.8 }}>{config?.city || 'Paris'}</div>
                </div>
            </div>
        );
    }

    if (type === 'text') {
        return (
            <div style={{ ...baseStyle, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {config?.text || 'Texte personnalisé'}
            </div>
        );
    }

    return null;
}

export default WidgetManager;
