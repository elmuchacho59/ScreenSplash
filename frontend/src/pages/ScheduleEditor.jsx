import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Calendar, Clock } from 'lucide-react';
import { schedulesApi, playlistsApi } from '../services/api';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function ScheduleEditor() {
    const [schedules, setSchedules] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [schedulesRes, playlistsRes] = await Promise.all([
                schedulesApi.getAll(),
                playlistsApi.getAll()
            ]);
            setSchedules(schedulesRes.data.schedules || []);
            setPlaylists(playlistsRes.data.playlists || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const broadcastChange = () => {
        const syncChannel = new BroadcastChannel('screensplash_sync');
        syncChannel.postMessage('data_updated');
        syncChannel.close();
    };


    const handleCreate = async (data) => {
        try {
            await schedulesApi.create(data);
            fetchData();
            broadcastChange();
            setShowModal(false);
        } catch (error) {

            console.error('Error creating schedule:', error);
        }
    };

    const handleUpdate = async (id, data) => {
        try {
            await schedulesApi.update(id, data);
            fetchData();
            broadcastChange();
            setEditingSchedule(null);
        } catch (error) {

            console.error('Error updating schedule:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette planification ?')) return;
        try {
            await schedulesApi.delete(id);
            fetchData();
            broadcastChange();
        } catch (error) {

            console.error('Error deleting schedule:', error);
        }
    };

    const handleToggleActive = async (schedule) => {
        try {
            await schedulesApi.update(schedule.id, { is_active: !schedule.is_active });
            fetchData();
            broadcastChange();
        } catch (error) {

            console.error('Error toggling schedule:', error);
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
                        <h1 className="page-title">Planification</h1>
                        <p className="page-subtitle">Programmez l'affichage de vos playlists selon des horaires</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={18} />
                        Nouvelle planification
                    </button>
                </div>
            </header>

            <div className="page-content">
                {schedules.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <Calendar size={32} />
                        </div>
                        <h3 className="empty-state-title">Aucune planification</h3>
                        <p className="empty-state-text">
                            Créez des planifications pour automatiser l'affichage de vos playlists
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={() => setShowModal(true)}>
                            <Plus size={20} />
                            Créer une planification
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                        {schedules.map(schedule => (
                            <div key={schedule.id} className="card">
                                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
                                    {/* Status Toggle */}
                                    <div
                                        onClick={() => handleToggleActive(schedule)}
                                        style={{
                                            width: 48,
                                            height: 28,
                                            borderRadius: 'var(--radius-full)',
                                            background: schedule.is_active ? 'var(--color-success)' : 'var(--color-bg-tertiary)',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            transition: 'background var(--transition-fast)'
                                        }}
                                    >
                                        <div style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: '50%',
                                            background: 'white',
                                            position: 'absolute',
                                            top: 3,
                                            left: schedule.is_active ? 23 : 3,
                                            transition: 'left var(--transition-fast)'
                                        }} />
                                    </div>

                                    {/* Schedule Info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-sm)' }}>
                                            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{schedule.name}</span>
                                            <span style={{
                                                padding: '2px 8px',
                                                background: 'rgba(99, 102, 241, 0.15)',
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '0.8rem',
                                                color: 'var(--color-accent-primary)'
                                            }}>
                                                {schedule.playlist_name}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                            {/* Time */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                                <Clock size={16} />
                                                {schedule.start_time} - {schedule.end_time}
                                            </div>

                                            {/* Days */}
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {DAYS.map((day, i) => (
                                                    <span
                                                        key={i}
                                                        style={{
                                                            width: 28,
                                                            height: 28,
                                                            borderRadius: 'var(--radius-sm)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 500,
                                                            background: schedule.days_of_week.includes(i)
                                                                ? 'var(--color-accent-primary)'
                                                                : 'var(--color-bg-tertiary)',
                                                            color: schedule.days_of_week.includes(i)
                                                                ? 'white'
                                                                : 'var(--color-text-muted)'
                                                        }}
                                                    >
                                                        {day}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                        <button
                                            className="btn btn-icon btn-secondary"
                                            onClick={() => setEditingSchedule(schedule)}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="btn btn-icon btn-danger"
                                            onClick={() => handleDelete(schedule.id)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Create/Edit Modal */}
                {(showModal || editingSchedule) && (
                    <ScheduleModal
                        schedule={editingSchedule}
                        playlists={playlists}
                        onClose={() => { setShowModal(false); setEditingSchedule(null); }}
                        onSubmit={editingSchedule
                            ? (data) => handleUpdate(editingSchedule.id, data)
                            : handleCreate
                        }
                    />
                )}
            </div>
        </>
    );
}

function ScheduleModal({ schedule, playlists, onClose, onSubmit }) {
    const [name, setName] = useState(schedule?.name || '');
    const [playlistId, setPlaylistId] = useState(schedule?.playlist_id || (playlists[0]?.id || ''));
    const [startTime, setStartTime] = useState(schedule?.start_time || '09:00');
    const [endTime, setEndTime] = useState(schedule?.end_time || '18:00');
    const [daysOfWeek, setDaysOfWeek] = useState(schedule?.days_of_week || [0, 1, 2, 3, 4]);
    const [isRecurring, setIsRecurring] = useState(schedule?.is_recurring ?? true);
    const [priority, setPriority] = useState(schedule?.priority || 0);

    const toggleDay = (day) => {
        if (daysOfWeek.includes(day)) {
            setDaysOfWeek(daysOfWeek.filter(d => d !== day));
        } else {
            setDaysOfWeek([...daysOfWeek, day].sort());
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !playlistId) return;

        onSubmit({
            name,
            playlist_id: parseInt(playlistId),
            start_time: startTime,
            end_time: endTime,
            days_of_week: daysOfWeek,
            is_recurring: isRecurring,
            priority,
            is_active: true
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {schedule ? 'Modifier la planification' : 'Nouvelle planification'}
                    </h2>
                    <button className="modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Nom *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Horaires de bureau"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Playlist *</label>
                            <select
                                className="form-input"
                                value={playlistId}
                                onChange={(e) => setPlaylistId(e.target.value)}
                                required
                            >
                                <option value="">Sélectionner une playlist</option>
                                {playlists.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                            <div className="form-group">
                                <label className="form-label">Heure de début</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Heure de fin</label>
                                <input
                                    type="time"
                                    className="form-input"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Jours de la semaine</label>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                                {DAYS.map((day, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => toggleDay(i)}
                                        style={{
                                            flex: 1,
                                            padding: 'var(--spacing-sm)',
                                            borderRadius: 'var(--radius-md)',
                                            border: 'none',
                                            background: daysOfWeek.includes(i)
                                                ? 'var(--color-accent-primary)'
                                                : 'var(--color-bg-tertiary)',
                                            color: daysOfWeek.includes(i) ? 'white' : 'var(--color-text-secondary)',
                                            cursor: 'pointer',
                                            fontWeight: 500,
                                            transition: 'all var(--transition-fast)'
                                        }}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Priorité</label>
                            <input
                                type="number"
                                className="form-input"
                                min="0"
                                max="100"
                                value={priority}
                                onChange={(e) => setPriority(parseInt(e.target.value))}
                            />
                            <small style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                En cas de conflit horaire, la planification avec la plus haute priorité sera utilisée
                            </small>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
                        <button type="submit" className="btn btn-primary">
                            {schedule ? 'Enregistrer' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ScheduleEditor;
