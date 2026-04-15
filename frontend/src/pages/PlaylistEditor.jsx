import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus,
    Trash2,
    GripVertical,
    Clock,
    Play,
    Image as ImageIcon,
    Video,
    Globe,
    X,
    Save,
    Layout,
    RefreshCw,
    SkipBack,
    SkipForward,
    Calendar,
    ChevronDown,
    ChevronUp
} from 'lucide-react';



import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { playlistsApi, assetsApi, systemApi } from '../services/api';

const getAssetStatus = (pa) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (pa.schedule_end_date) {
        const end = new Date(pa.schedule_end_date);
        end.setHours(23, 59, 59, 999);
        if (now > end) return 'red';
    }
    if (pa.schedule_start_date) {
        const start = new Date(pa.schedule_start_date);
        start.setHours(0, 0, 0, 0);
        if (now < start) return 'orange';
    }
    return 'green';
};

function PlaylistEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [assets, setAssets] = useState([]);
    const [playlistAssets, setPlaylistAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddAssetModal, setShowAddAssetModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFeedback, setActiveFeedback] = useState(null); // 'prev', 'next', 'refresh'

    const activeAssets = playlistAssets.filter(pa => getAssetStatus(pa) !== 'red');
    const inactiveAssets = playlistAssets.filter(pa => getAssetStatus(pa) === 'red');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchPlaylists();
        fetchAllAssets();
    }, []);

    useEffect(() => {
        if (id && playlists.length > 0) {
            const playlist = playlists.find(p => p.id === parseInt(id));
            if (playlist) selectPlaylist(playlist);
        } else if (!id && playlists.length > 0 && !selectedPlaylist) {
            selectPlaylist(playlists[0]);
        }
    }, [id, playlists]);

    const fetchPlaylists = async () => {
        try {
            const res = await playlistsApi.getAll(false);
            setPlaylists(res.data.playlists || []);
        } catch (error) {
            console.error('Error fetching playlists:', error);
        } finally {
            setLoading(false);
        }
    };

    const broadcastChange = () => {
        const syncChannel = new BroadcastChannel('screensplash_sync');
        syncChannel.postMessage('data_updated');
        syncChannel.close();
    };


    const fetchAllAssets = async () => {
        try {
            const res = await assetsApi.getAll({ per_page: 100, active: true });
            setAssets(res.data.assets || []);
        } catch (error) {
            console.error('Error fetching assets:', error);
        }
    };

    const selectPlaylist = async (playlist) => {
        setSelectedPlaylist(playlist);
        navigate(`/playlists/${playlist.id}`, { replace: true });
        try {
            const res = await playlistsApi.getAssets(playlist.id);
            setPlaylistAssets(res.data.assets || []);
        } catch (error) {
            console.error('Error fetching playlist assets:', error);
        }
    };

    const handleCreatePlaylist = async (name, description) => {
        try {
            const res = await playlistsApi.create({ name, description });
            await fetchPlaylists();
            selectPlaylist(res.data);
            broadcastChange();
            setShowCreateModal(false);
        } catch (error) {

            console.error('Error creating playlist:', error);
        }
    };

    const handleDeletePlaylist = async (playlistId) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette playlist ?')) return;
        try {
            await playlistsApi.delete(playlistId);
            if (selectedPlaylist?.id === playlistId) {
                setSelectedPlaylist(null);
                setPlaylistAssets([]);
            }
            fetchPlaylists();
            broadcastChange();
        } catch (error) {

            console.error('Error deleting playlist:', error);
        }
    };

    const handleAddAsset = async (assetIdOrIds) => {
        if (!selectedPlaylist) return;
        try {
            if (Array.isArray(assetIdOrIds)) {
                if (assetIdOrIds.length === 0) return;
                await playlistsApi.addAsset(selectedPlaylist.id, { asset_ids: assetIdOrIds });
            } else {
                await playlistsApi.addAsset(selectedPlaylist.id, assetIdOrIds);
            }
            const res = await playlistsApi.getAssets(selectedPlaylist.id);
            setPlaylistAssets(res.data.assets || []);
            broadcastChange();
            setShowAddAssetModal(false);
        } catch (error) {

            console.error('Error adding asset:', error);
        }
    };

    const handleRemoveAsset = async (playlistAssetId) => {
        if (!selectedPlaylist) return;
        try {
            await playlistsApi.removeAsset(selectedPlaylist.id, playlistAssetId);
            setPlaylistAssets(prev => prev.filter(pa => pa.id !== playlistAssetId));
            broadcastChange();
        } catch (error) {

            console.error('Error removing asset:', error);
        }
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = activeAssets.findIndex(pa => pa.id === active.id);
        const newIndex = activeAssets.findIndex(pa => pa.id === over.id);

        const newActiveOrder = arrayMove(activeAssets, oldIndex, newIndex);
        const newOrder = [...newActiveOrder, ...inactiveAssets];
        setPlaylistAssets(newOrder);

        try {
            await playlistsApi.reorderAssets(
                selectedPlaylist.id,
                newOrder.map(pa => pa.id)
            );
            broadcastChange();
        } catch (error) {
            console.error('Error reordering:', error);
            const res = await playlistsApi.getAssets(selectedPlaylist.id);
            setPlaylistAssets(res.data.assets || []);
        }

    };

    const handleSetDefault = async (playlistId) => {
        try {
            await playlistsApi.update(playlistId, { is_default: true });
            fetchPlaylists();
            broadcastChange();
        } catch (error) {

            console.error('Error setting default:', error);
        }
    };

    const handlePlayerCommand = async (command) => {
        setActiveFeedback(command);
        try {
            await systemApi.updateConfig({
                player_command: command,
                player_command_time: Date.now().toString()
            });
            // Reset feedback after animation
            setTimeout(() => setActiveFeedback(null), 600);
        } catch (error) {
            console.error(`Error sending command ${command}:`, error);
            setActiveFeedback(null);
        }
    };

    const handlePlayerRefresh = async () => {
        setRefreshing(true);
        setActiveFeedback('refresh');
        try {
            await systemApi.updateConfig({ player_refresh_token: Date.now().toString() });
            setTimeout(() => {
                setRefreshing(false);
                setActiveFeedback(null);
            }, 1000);
        } catch (error) {
            console.error('Error refreshing player:', error);
            setRefreshing(false);
            setActiveFeedback(null);
        }
    };



    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    const getTotalDuration = () => {
        return playlistAssets.reduce((total, pa) => {
            const duration = pa.custom_duration || pa.asset?.duration || 0;
            return total + duration;
        }, 0);
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'image': return <ImageIcon size={16} />;
            case 'video': return <Video size={16} />;
            case 'url': return <Globe size={16} />;
            case 'widget': return <Layout size={16} />;
            default: return <ImageIcon size={16} />;
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
                        <h1 className="page-title">Playlists</h1>
                        <p className="page-subtitle">Créez et organisez vos séquences de contenu</p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
                        {/* Remote Controls */}
                        <div style={{
                            display: 'flex',
                            background: 'var(--color-bg-tertiary)',
                            padding: '4px',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-border)',
                            gap: '4px'
                        }}>
                            <button
                                className={`btn btn-icon ${activeFeedback === 'prev' ? 'btn-primary animate-pulse-success' : 'btn-secondary'}`}
                                title="Précédent"
                                onClick={() => handlePlayerCommand('prev')}
                                style={{
                                    border: 'none',
                                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }}
                            >
                                <SkipBack size={18} style={{
                                    transform: activeFeedback === 'prev' ? 'scale(1.2)' : 'scale(1)',
                                    transition: 'transform 0.2s'
                                }} />
                            </button>
                            <button
                                className={`btn btn-icon ${activeFeedback === 'refresh' ? 'btn-primary animate-pulse-success' : 'btn-secondary'}`}
                                title="Actualiser le Player"
                                onClick={handlePlayerRefresh}
                                style={{
                                    border: 'none',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} style={{
                                    transform: activeFeedback === 'refresh' && !refreshing ? 'scale(1.2)' : 'scale(1)',
                                    transition: 'transform 0.2s'
                                }} />
                            </button>
                            <button
                                className={`btn btn-icon ${activeFeedback === 'next' ? 'btn-primary animate-pulse-success' : 'btn-secondary'}`}
                                title="Suivant"
                                onClick={() => handlePlayerCommand('next')}
                                style={{
                                    border: 'none',
                                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }}
                            >
                                <SkipForward size={18} style={{
                                    transform: activeFeedback === 'next' ? 'scale(1.2)' : 'scale(1)',
                                    transition: 'transform 0.2s'
                                }} />
                            </button>
                        </div>

                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                            <Plus size={18} />
                            Nouvelle playlist
                        </button>
                    </div>
                </div>
            </header>


            <div className="page-content">
                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--spacing-lg)', minHeight: 'calc(100vh - 200px)' }}>
                    {/* Playlists Sidebar */}
                    <div className="card" style={{ height: 'fit-content' }}>
                        <div className="card-header">
                            <h3 className="card-title">Mes Playlists</h3>
                        </div>
                        <div className="card-body" style={{ padding: 'var(--spacing-sm)' }}>
                            {playlists.length === 0 ? (
                                <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    Aucune playlist
                                </div>
                            ) : (
                                playlists.map(playlist => (
                                    <div
                                        key={playlist.id}
                                        onClick={() => selectPlaylist(playlist)}
                                        style={{
                                            padding: 'var(--spacing-md)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            background: selectedPlaylist?.id === playlist.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                            border: selectedPlaylist?.id === playlist.id ? '1px solid var(--color-accent-primary)' : '1px solid transparent',
                                            marginBottom: 'var(--spacing-xs)',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                    {playlist.name}
                                                    {playlist.is_default && (
                                                        <span style={{
                                                            fontSize: '0.65rem',
                                                            background: 'var(--color-accent-primary)',
                                                            padding: '2px 6px',
                                                            borderRadius: 'var(--radius-sm)',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            Défaut
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                    {playlist.asset_count} assets • {formatDuration(playlist.total_duration)}
                                                </div>
                                            </div>
                                            <button
                                                className="btn btn-icon btn-secondary"
                                                onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(playlist.id); }}
                                                style={{ opacity: 0.6 }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Playlist Content */}
                    <div className="card">
                        {selectedPlaylist ? (
                            <>
                                <div className="card-header">
                                    <div>
                                        <h3 className="card-title">{selectedPlaylist.name}</h3>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                            <Clock size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                                            Durée totale: {formatDuration(getTotalDuration())}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                        {!selectedPlaylist.is_default && (
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => handleSetDefault(selectedPlaylist.id)}
                                            >
                                                Définir par défaut
                                            </button>
                                        )}
                                        <button className="btn btn-primary" onClick={() => setShowAddAssetModal(true)}>
                                            <Plus size={18} />
                                            Ajouter asset
                                        </button>
                                    </div>
                                </div>
                                <div className="card-body">
                                    {playlistAssets.length === 0 ? (
                                        <div className="empty-state">
                                            <div className="empty-state-icon">
                                                <Play size={32} />
                                            </div>
                                            <h3 className="empty-state-title">Playlist vide</h3>
                                            <p className="empty-state-text">
                                                Ajoutez des assets pour créer votre séquence d'affichage
                                            </p>
                                            <button className="btn btn-primary" onClick={() => setShowAddAssetModal(true)}>
                                                <Plus size={18} />
                                                Ajouter un asset
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragEnd={handleDragEnd}
                                            >
                                                <SortableContext
                                                    items={activeAssets.map(pa => pa.id)}
                                                    strategy={verticalListSortingStrategy}
                                                >
                                                    {activeAssets.map((playlistAsset, index) => (
                                                        <SortableItem
                                                            key={playlistAsset.id}
                                                            playlistAsset={playlistAsset}
                                                            playlistId={selectedPlaylist.id}
                                                            index={index}
                                                            status={getAssetStatus(playlistAsset)}
                                                            onRemove={() => handleRemoveAsset(playlistAsset.id)}
                                                            onUpdateSchedule={async (data) => {
                                                                try {
                                                                    await playlistsApi.updateAsset(selectedPlaylist.id, playlistAsset.id, data);
                                                                    const res = await playlistsApi.getAssets(selectedPlaylist.id);
                                                                    setPlaylistAssets(res.data.assets || []);
                                                                    broadcastChange();
                                                                } catch (error) {
                                                                    console.error('Error updating schedule:', error);
                                                                }
                                                            }}
                                                            getTypeIcon={getTypeIcon}
                                                            formatDuration={formatDuration}
                                                        />
                                                    ))}

                                                </SortableContext>
                                            </DndContext>

                                            {inactiveAssets.length > 0 && (
                                                <div style={{ marginTop: 'var(--spacing-xl)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--spacing-md)' }}>
                                                    <h4 style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-md)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                        Assets inactifs (Date passée)
                                                    </h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.65 }}>
                                                        {inactiveAssets.map((playlistAsset, index) => (
                                                            <SortableItem
                                                                key={playlistAsset.id}
                                                                playlistAsset={playlistAsset}
                                                                playlistId={selectedPlaylist.id}
                                                                index={index}
                                                                status="red"
                                                                disabled={true}
                                                                onRemove={() => handleRemoveAsset(playlistAsset.id)}
                                                                onUpdateSchedule={async (data) => {
                                                                    try {
                                                                        await playlistsApi.updateAsset(selectedPlaylist.id, playlistAsset.id, data);
                                                                        const res = await playlistsApi.getAssets(selectedPlaylist.id);
                                                                        setPlaylistAssets(res.data.assets || []);
                                                                        broadcastChange();
                                                                    } catch (error) {
                                                                        console.error('Error updating schedule:', error);
                                                                    }
                                                                }}
                                                                getTypeIcon={getTypeIcon}
                                                                formatDuration={formatDuration}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="card-body">
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <Play size={32} />
                                    </div>
                                    <h3 className="empty-state-title">Sélectionnez une playlist</h3>
                                    <p className="empty-state-text">
                                        Choisissez une playlist dans la liste ou créez-en une nouvelle
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Create Playlist Modal */}
                {showCreateModal && (
                    <CreatePlaylistModal
                        onClose={() => setShowCreateModal(false)}
                        onSubmit={handleCreatePlaylist}
                    />
                )}

                {/* Add Asset Modal */}
                {showAddAssetModal && (
                    <AddAssetModal
                        assets={assets}
                        playlistAssets={playlistAssets}
                        onClose={() => setShowAddAssetModal(false)}
                        onAdd={handleAddAsset}
                        getTypeIcon={getTypeIcon}
                    />
                )}
            </div>
        </>
    );
}

function SortableItem({ playlistAsset, playlistId, index, status = 'green', disabled = false, onRemove, onUpdateSchedule, getTypeIcon, formatDuration }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: playlistAsset.id,
        disabled: disabled
    });
    const [showSchedule, setShowSchedule] = useState(false);
    const [customDuration, setCustomDuration] = useState(playlistAsset.custom_duration || playlistAsset.asset?.duration || 10);
    const [scheduleData, setScheduleData] = useState({
        schedule_start_time: playlistAsset.schedule_start_time || '',
        schedule_end_time: playlistAsset.schedule_end_time || '',
        schedule_days: playlistAsset.schedule_days || [],
        schedule_start_date: playlistAsset.schedule_start_date || '',
        schedule_end_date: playlistAsset.schedule_end_date || ''
    });

    const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const hasSchedule = scheduleData.schedule_start_time || scheduleData.schedule_end_time ||
        (scheduleData.schedule_days && scheduleData.schedule_days.length > 0) ||
        scheduleData.schedule_start_date || scheduleData.schedule_end_date;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    const asset = playlistAsset.asset;
    const duration = customDuration;

    const handleDurationChange = (newDuration) => {
        const dur = parseInt(newDuration) || 10;
        setCustomDuration(dur);
        onUpdateSchedule({ custom_duration: dur });
    };


    const toggleDay = (dayIndex) => {
        const currentDays = scheduleData.schedule_days || [];
        let newDays;
        if (currentDays.includes(dayIndex)) {
            newDays = currentDays.filter(d => d !== dayIndex);
        } else {
            newDays = [...currentDays, dayIndex].sort((a, b) => a - b);
        }
        const newData = { ...scheduleData, schedule_days: newDays };
        setScheduleData(newData);
        onUpdateSchedule({ schedule_days: newDays.length > 0 ? newDays : null });
    };

    const handleTimeChange = (field, value) => {
        const newData = { ...scheduleData, [field]: value };
        setScheduleData(newData);
        onUpdateSchedule({ [field]: value || null });
    };

    const handleDateChange = (field, value) => {
        const newData = { ...scheduleData, [field]: value };
        setScheduleData(newData);
        onUpdateSchedule({ [field]: value || null });
    };

    const clearSchedule = () => {
        setScheduleData({
            schedule_start_time: '',
            schedule_end_time: '',
            schedule_days: [],
            schedule_start_date: '',
            schedule_end_date: ''
        });
        onUpdateSchedule({
            schedule_start_time: null,
            schedule_end_time: null,
            schedule_days: null,
            schedule_start_date: null,
            schedule_end_date: null
        });
    };

    const statusColor = status === 'green' ? 'var(--color-success, #10b981)' :
                        status === 'orange' ? 'var(--color-warning, #f59e0b)' :
                        'var(--color-danger, #ef4444)';

    return (
        <div ref={setNodeRef} style={style} className="playlist-item-wrapper">
            <div className="playlist-item">
                <div {...attributes} {...listeners} className="playlist-item-drag" style={{ cursor: disabled ? 'default' : 'grab', opacity: disabled ? 0.3 : 1 }}>
                    <GripVertical size={20} />
                </div>
                <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                }}>
                    {index + 1}
                </div>
                <div className="playlist-item-thumb">
                    {asset?.type === 'image' && asset?.thumbnail_path ? (
                        <img src={`/api/assets/${asset.id}/thumbnail`} alt="" />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {getTypeIcon(asset?.type)}
                        </div>
                    )}
                </div>
                <div className="playlist-item-info">
                    <div className="playlist-item-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: statusColor,
                            boxShadow: `0 0 5px ${statusColor}80`
                        }} title={status === 'green' ? 'Actif' : status === 'orange' ? 'En attente (Date future)' : 'Inactif (Date passée)'} />
                        {asset?.name || 'Asset inconnu'}
                    </div>
                    <div className="playlist-item-duration">
                        {getTypeIcon(asset?.type)} {asset?.type} • {formatDuration(duration)}
                    </div>
                </div>
                <div className="playlist-item-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        className={`btn btn-icon ${hasSchedule ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setShowSchedule(!showSchedule)}
                        title={showSchedule ? "Fermer la planification" : "Planifier cet élément"}
                    >
                        <Calendar size={16} />
                    </button>
                    <button className="btn btn-icon btn-danger" onClick={onRemove} title="Supprimer">
                        <Trash2 size={16} />
                    </button>
                </div>

            </div>

            {/* Inline Schedule Picker */}
            {showSchedule && (
                <div style={{
                    background: 'var(--color-bg-tertiary)',
                    borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                    padding: 'var(--spacing-md)',
                    marginTop: '-4px',
                    borderTop: '1px dashed var(--color-border)'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>

                        {/* Row 1: Duration & Time */}
                        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
                            {/* Custom Duration */}
                            <div style={{ flex: '0 0 120px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                                    <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                    Durée (sec)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={customDuration}
                                    onChange={(e) => handleDurationChange(e.target.value)}
                                    style={{
                                        padding: '6px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-border)',
                                        background: 'var(--color-bg-secondary)',
                                        color: 'var(--color-text-primary)',
                                        fontSize: '0.85rem',
                                        width: '100%'
                                    }}
                                />
                            </div>

                            {/* Time Range */}
                            <div style={{ flex: '1', minWidth: '200px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                                    <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                    Plage Horaire
                                </label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="time"
                                        value={scheduleData.schedule_start_time || ''}
                                        onChange={(e) => handleTimeChange('schedule_start_time', e.target.value)}
                                        style={{
                                            padding: '6px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--color-border)',
                                            background: 'var(--color-bg-secondary)',
                                            color: 'var(--color-text-primary)',
                                            fontSize: '0.85rem',
                                            flex: 1
                                        }}
                                    />
                                    <span style={{ color: 'var(--color-text-muted)' }}>à</span>
                                    <input
                                        type="time"
                                        value={scheduleData.schedule_end_time || ''}
                                        onChange={(e) => handleTimeChange('schedule_end_time', e.target.value)}
                                        style={{
                                            padding: '6px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--color-border)',
                                            background: 'var(--color-bg-secondary)',
                                            color: 'var(--color-text-primary)',
                                            fontSize: '0.85rem',
                                            flex: 1
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Days & Dates */}
                        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            {/* Days */}
                            <div style={{ flex: '2', minWidth: '280px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                                    Jours actifs
                                </label>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {DAYS.map((day, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => toggleDay(i)}
                                            style={{
                                                padding: '6px 2px',
                                                borderRadius: 'var(--radius-sm)',
                                                border: 'none',
                                                background: (scheduleData.schedule_days || []).includes(i)
                                                    ? 'var(--color-accent-primary)'
                                                    : 'var(--color-bg-secondary)',
                                                color: (scheduleData.schedule_days || []).includes(i) ? 'white' : 'var(--color-text-muted)',
                                                cursor: 'pointer',
                                                fontSize: '0.7rem',
                                                fontWeight: 500,
                                                transition: 'all 0.15s',
                                                flex: 1,
                                                minWidth: '32px'
                                            }}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date Range */}
                            <div style={{ flex: '2', minWidth: '280px' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                                    <Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                    Période (optionnel)
                                </label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="date"
                                        value={scheduleData.schedule_start_date || ''}
                                        onChange={(e) => handleDateChange('schedule_start_date', e.target.value)}
                                        style={{
                                            padding: '6px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--color-border)',
                                            background: 'var(--color-bg-secondary)',
                                            color: 'var(--color-text-primary)',
                                            fontSize: '0.8rem',
                                            flex: 1
                                        }}
                                    />
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>au</span>
                                    <input
                                        type="date"
                                        value={scheduleData.schedule_end_date || ''}
                                        onChange={(e) => handleDateChange('schedule_end_date', e.target.value)}
                                        style={{
                                            padding: '6px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--color-border)',
                                            background: 'var(--color-bg-secondary)',
                                            color: 'var(--color-text-primary)',
                                            fontSize: '0.8rem',
                                            flex: 1
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Clear Button */}
                            {hasSchedule && (
                                <button
                                    onClick={clearSchedule}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--color-border)',
                                        background: 'transparent',
                                        color: 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        height: '32px'
                                    }}
                                >
                                    <X size={14} />
                                    Effacer
                                </button>
                            )}
                        </div>
                    </div>

                    {hasSchedule && (
                        <div style={{
                            marginTop: 'var(--spacing-md)',
                            padding: '8px 12px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                            color: 'var(--color-accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></div>
                            Cet élément s'affichera uniquement selon cette planification
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


function CreatePlaylistModal({ onClose, onSubmit }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit(name, description);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Nouvelle playlist</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Nom *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ma playlist"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-input"
                                rows={3}
                                placeholder="Description optionnelle..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={18} />
                            Créer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddAssetModal({ assets, playlistAssets, onClose, onAdd, getTypeIcon }) {
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const existingIds = new Set(playlistAssets.map(pa => pa.asset_id));

    const filteredAssets = assets.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) && !existingIds.has(a.id)
    );

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleAddSelected = () => {
        if (selectedIds.size > 0) {
            onAdd(Array.from(selectedIds));
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Ajouter des assets</h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Rechercher..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ marginBottom: 'var(--spacing-md)' }}
                    />
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                        {filteredAssets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--color-text-muted)' }}>
                                Aucun asset disponible
                            </div>
                        ) : (
                            filteredAssets.map(asset => {
                                const isSelected = selectedIds.has(asset.id);
                                return (
                                    <div
                                        key={asset.id}
                                        onClick={() => toggleSelection(asset.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-md)',
                                            padding: 'var(--spacing-md)',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                            border: isSelected ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border)',
                                            background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                            marginBottom: 'var(--spacing-sm)',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                    >
                                        <div style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '50%',
                                            border: isSelected ? '5px solid var(--color-accent-primary)' : '2px solid var(--color-text-muted)',
                                            marginRight: '8px',
                                            flexShrink: 0
                                        }} />
                                        <div style={{
                                            width: 60,
                                            height: 40,
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'var(--color-bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            flexShrink: 0
                                        }}>
                                            {asset.type === 'image' && asset.thumbnail_path ? (
                                                <img src={`/api/assets/${asset.id}/thumbnail`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                getTypeIcon(asset.type)
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                {asset.type} • {asset.duration}s
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                <div className="modal-footer" style={{ borderTop: '1px solid var(--color-border)', marginTop: 0, paddingTop: 'var(--spacing-md)' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                        {selectedIds.size} élément{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                        <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleAddSelected}
                            disabled={selectedIds.size === 0}
                        >
                            <Plus size={18} />
                            Ajouter la sélection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PlaylistEditor;
