import { useState, useEffect, useRef } from 'react';
import {
    Upload,
    Image as ImageIcon,
    Video,
    Globe,
    Trash2,
    Edit2,
    X,
    Grid,
    List,
    Search,
    Plus,
    Eye
} from 'lucide-react';


import { assetsApi } from '../services/api';

function AssetManager() {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('grid');
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [previewAsset, setPreviewAsset] = useState(null);
    const [editingAsset, setEditingAsset] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchAssets();
    }, [filterType]);

    const fetchAssets = async () => {
        try {
            const params = { per_page: 100 };
            if (filterType !== 'all') params.type = filterType;
            const res = await assetsApi.getAll(params);
            setAssets(res.data.assets || []);
        } catch (error) {
            console.error('Error fetching assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const broadcastChange = () => {
        const syncChannel = new BroadcastChannel('screensplash_sync');
        syncChannel.postMessage('data_updated');
        syncChannel.close();
    };


    const handleFileUpload = async (files) => {
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

            try {
                await assetsApi.create(formData);
            } catch (error) {
                console.error('Upload error:', error);
            }
        }
        fetchAssets();
        broadcastChange();
        setShowUploadModal(false);
    };


    const handleUrlSubmit = async (url, name, duration) => {
        try {
            await assetsApi.createUrl({ url, name: name || url, duration: duration || 30 });
            fetchAssets();
            broadcastChange();
            setShowUrlModal(false);
        } catch (error) {

            console.error('Error adding URL:', error);
        }
    };

    const getUrlDomain = (url) => {
        try {
            const domain = new URL(url).hostname;
            return domain;
        } catch (e) {
            return '';
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet asset ?')) return;
        try {
            await assetsApi.delete(id);
            fetchAssets();
            broadcastChange();
        } catch (error) {

            console.error('Error deleting asset:', error);
        }
    };

    const handleUpdate = async (id, data) => {
        try {
            await assetsApi.update(id, data);
            fetchAssets();
            broadcastChange();
            setEditingAsset(null);
        } catch (error) {

            console.error('Error updating asset:', error);
        }
    };

    const filteredAssets = assets.filter(asset =>
        asset.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getTypeIcon = (type) => {
        switch (type) {
            case 'image': return <ImageIcon size={16} />;
            case 'video': return <Video size={16} />;
            case 'url': return <Globe size={16} />;
            default: return <ImageIcon size={16} />;
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '—';
        if (seconds < 60) return `${seconds}s`;
        return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    };

    return (
        <>
            <header className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 className="page-title">Assets</h1>
                        <p className="page-subtitle">Gérez vos images, vidéos et URLs</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        <button className="btn btn-secondary" onClick={() => setShowUrlModal(true)}>
                            <Globe size={18} />
                            Ajouter URL
                        </button>
                        <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                            <Upload size={18} />
                            Uploader
                        </button>
                    </div>
                </div>
            </header>

            <div className="page-content">
                {/* Toolbar */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--spacing-lg)',
                    gap: 'var(--spacing-md)',
                    flexWrap: 'wrap'
                }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
                        <Search
                            size={18}
                            style={{
                                position: 'absolute',
                                left: 'var(--spacing-md)',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--color-text-muted)'
                            }}
                        />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '44px' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                        {/* Type Filter */}
                        <select
                            className="form-input"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            style={{ width: 'auto' }}
                        >
                            <option value="all">Tous les types</option>
                            <option value="image">Images</option>
                            <option value="video">Vidéos</option>
                            <option value="url">Liens Web</option>
                        </select>

                        {/* View Mode */}
                        <div style={{ display: 'flex', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <button
                                className={`btn btn-icon ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setViewMode('grid')}
                                style={{ borderRadius: 'var(--radius-md) 0 0 var(--radius-md)' }}
                            >
                                <Grid size={18} />
                            </button>
                            <button
                                className={`btn btn-icon ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setViewMode('list')}
                                style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Assets Display */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-2xl)' }}>
                        <div className="loading-spinner" />
                    </div>
                ) : filteredAssets.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <ImageIcon size={32} />
                        </div>
                        <h3 className="empty-state-title">Aucun asset</h3>
                        <p className="empty-state-text">
                            Commencez par uploader des images, vidéos ou ajouter des URLs
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={() => setShowUploadModal(true)}>
                            <Upload size={20} />
                            Uploader des fichiers
                        </button>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="asset-grid">
                        {filteredAssets.map(asset => (
                            <div key={asset.id} className="asset-card">
                                <div className="asset-thumbnail">
                                    {asset.thumbnail_path ? (
                                        <img src={assetsApi.getThumbnail(asset.id)} alt={asset.name} />
                                    ) : asset.type === 'video' ? (
                                        <div className="asset-placeholder video">
                                            <Video size={32} />
                                        </div>
                                    ) : asset.type === 'url' ? (
                                        <div className="asset-placeholder url">
                                            <img
                                                src={`https://www.google.com/s2/favicons?domain=${getUrlDomain(asset.path)}&sz=128`}
                                                alt="favicon"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src = '';
                                                    e.target.parentElement.innerHTML = '<div class="globe-icon">🌐</div>';
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <Globe size={32} style={{ color: 'var(--color-text-muted)' }} />
                                    )}
                                    <span className="asset-type-badge">{asset.type}</span>
                                </div>
                                <div className="asset-info">
                                    <div className="asset-name">{asset.name}</div>
                                    <div className="asset-meta">
                                        {formatDuration(asset.duration)}
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    padding: '0 var(--spacing-md) var(--spacing-md)',
                                    gap: 'var(--spacing-xs)'
                                }}>
                                    <button
                                        className="btn-icon"
                                        title="Prévisualiser"
                                        onClick={() => setPreviewAsset(asset)}
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        title="Modifier"
                                        onClick={() => setEditingAsset(asset)}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        className="btn btn-icon btn-danger"
                                        onClick={() => handleDelete(asset.id)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card">
                        <div className="card-body" style={{ padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                        <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 500 }}>Nom</th>
                                        <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 500 }}>Type</th>
                                        <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 500 }}>Durée</th>
                                        <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', color: 'var(--color-text-muted)', fontWeight: 500 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAssets.map(asset => (
                                        <tr key={asset.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                            <td style={{ padding: 'var(--spacing-md)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                                    <div style={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: 'var(--color-bg-tertiary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {asset.type === 'image' && asset.thumbnail_path ? (
                                                            <img src={assetsApi.getThumbnail(asset.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            getTypeIcon(asset.type)
                                                        )}
                                                    </div>
                                                    <span>{asset.name}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: 'var(--spacing-md)', textTransform: 'capitalize' }}>{asset.type}</td>
                                            <td style={{ padding: 'var(--spacing-md)' }}>{formatDuration(asset.duration)}</td>
                                            <td style={{ padding: 'var(--spacing-md)', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-xs)' }}>
                                                    <button
                                                        className="btn btn-icon btn-secondary"
                                                        title="Prévisualiser"
                                                        onClick={() => setPreviewAsset(asset)}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button className="btn btn-icon btn-secondary" onClick={() => setEditingAsset(asset)}>
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button className="btn btn-icon btn-danger" onClick={() => handleDelete(asset.id)}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Upload Modal */}
                {showUploadModal && (
                    <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Uploader des fichiers</h2>
                                <button className="modal-close" onClick={() => setShowUploadModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <div
                                    className={`upload-zone ${dragOver ? 'dragover' : ''}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOver(false);
                                        handleFileUpload(e.dataTransfer.files);
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="upload-zone-icon">
                                        <Upload size={32} />
                                    </div>
                                    <p className="upload-zone-text">
                                        <strong>Cliquez</strong> ou glissez-déposez des fichiers ici
                                    </p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-sm)' }}>
                                        Images (JPG, PNG, GIF, WebP) • Vidéos (MP4, WebM, MOV)
                                    </p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="image/*,video/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleFileUpload(e.target.files)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* URL Modal */}
                {showUrlModal && (
                    <UrlModal
                        onClose={() => setShowUrlModal(false)}
                        onSubmit={handleUrlSubmit}
                    />
                )}

                {/* Edit Modal */}
                {editingAsset && (
                    <EditModal
                        asset={editingAsset}
                        onClose={() => setEditingAsset(null)}
                        onSubmit={(data) => handleUpdate(editingAsset.id, data)}
                    />
                )}

                {/* Preview Modal */}
                {previewAsset && (
                    <PreviewModal
                        asset={previewAsset}
                        onClose={() => setPreviewAsset(null)}
                    />
                )}
            </div>
        </>
    );
}

function UrlModal({ onClose, onSubmit }) {
    const [url, setUrl] = useState('');
    const [name, setName] = useState('');
    const [duration, setDuration] = useState(30);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!url.trim()) return;
        onSubmit(url, name, duration);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Ajouter une URL</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">URL *</label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://exemple.com"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Nom (optionnel)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ma page web"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Durée d'affichage (secondes)</label>
                            <input
                                type="number"
                                className="form-input"
                                min="5"
                                max="3600"
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Annuler
                        </button>
                        <button type="submit" className="btn btn-primary">
                            <Plus size={18} />
                            Ajouter
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function EditModal({ asset, onClose, onSubmit }) {
    const [name, setName] = useState(asset.name);
    const [duration, setDuration] = useState(asset.duration || 10);
    const [url, setUrl] = useState(asset.path || '');

    const handleSubmit = (e) => {
        e.preventDefault();
        const data = { name, duration };
        if (asset.type === 'url') data.path = url;
        onSubmit(data);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Modifier l'asset</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Nom</label>
                            <input
                                type="text"
                                className="form-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        {asset.type === 'url' && (
                            <div className="form-group">
                                <label className="form-label">URL</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                />
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Durée d'affichage (secondes)</label>
                            <input
                                type="number"
                                className="form-input"
                                min="1"
                                max="3600"
                                value={duration}
                                onChange={(e) => setDuration(parseInt(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Annuler
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Enregistrer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PreviewModal({ asset, onClose }) {
    const getUrlDomain = (url) => {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return '';
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal preview-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
                <div className="modal-header">
                    <h2 className="modal-title">Aperçu : {asset.name}</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: 0, background: '#000', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {asset.type === 'image' && (
                            <img
                                src={asset.url || `/api/assets/${asset.id}/file`}
                                alt={asset.name}
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                        )}
                        {asset.type === 'video' && (
                            <video
                                src={asset.url || `/api/assets/${asset.id}/file`}
                                controls
                                autoPlay
                                style={{ maxWidth: '100%', maxHeight: '100%', outline: 'none' }}
                            />
                        )}
                        {asset.type === 'url' && (
                            <iframe
                                src={asset.path}
                                title={asset.name}
                                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                            />
                        )}
                    </div>
                </div>
                {asset.type === 'url' && (
                    <div className="modal-footer" style={{ justifyContent: 'center', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                            Source : {getUrlDomain(asset.path)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AssetManager;
