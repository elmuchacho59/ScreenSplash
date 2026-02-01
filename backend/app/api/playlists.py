from flask import Blueprint, request, jsonify
from app import db
from app.models import Playlist, PlaylistAsset, Asset, ActivityLog

playlists_bp = Blueprint('playlists', __name__)


@playlists_bp.route('', methods=['GET'])
def get_playlists():
    """Get all playlists."""
    include_assets = request.args.get('include_assets', 'false').lower() == 'true'
    playlists = Playlist.query.order_by(Playlist.created_at.desc()).all()
    return jsonify({
        'playlists': [p.to_dict(include_assets=include_assets) for p in playlists]
    })


@playlists_bp.route('/<int:playlist_id>', methods=['GET'])
def get_playlist(playlist_id):
    """Get single playlist with assets."""
    playlist = Playlist.query.get_or_404(playlist_id)
    return jsonify(playlist.to_dict(include_assets=True))


@playlists_bp.route('', methods=['POST'])
def create_playlist():
    """Create new playlist."""
    data = request.get_json()
    
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    playlist = Playlist(
        name=data['name'],
        description=data.get('description'),
        is_active=data.get('is_active', True),
        is_default=data.get('is_default', False)
    )
    
    # If this is set as default, unset other defaults
    if playlist.is_default:
        Playlist.query.filter(Playlist.is_default == True).update({'is_default': False})
    
    db.session.add(playlist)
    db.session.commit()
    
    # Log activity
    log = ActivityLog(action='playlist_created', entity_type='playlist', 
                     entity_id=playlist.id, details=f"Created: {playlist.name}")
    db.session.add(log)
    db.session.commit()
    
    return jsonify(playlist.to_dict()), 201


@playlists_bp.route('/<int:playlist_id>', methods=['PUT'])
def update_playlist(playlist_id):
    """Update playlist metadata."""
    playlist = Playlist.query.get_or_404(playlist_id)
    data = request.get_json()
    
    if 'name' in data:
        playlist.name = data['name']
    if 'description' in data:
        playlist.description = data['description']
    if 'is_active' in data:
        playlist.is_active = data['is_active']
    if 'is_default' in data:
        if data['is_default']:
            Playlist.query.filter(Playlist.is_default == True).update({'is_default': False})
        playlist.is_default = data['is_default']
    
    db.session.commit()
    
    # Log activity
    log = ActivityLog(action='playlist_updated', entity_type='playlist', 
                     entity_id=playlist.id, details=f"Updated: {playlist.name}")
    db.session.add(log)
    db.session.commit()
    
    return jsonify(playlist.to_dict())


@playlists_bp.route('/<int:playlist_id>', methods=['DELETE'])
def delete_playlist(playlist_id):
    """Delete playlist."""
    playlist = Playlist.query.get_or_404(playlist_id)
    
    # Log before delete
    log = ActivityLog(action='playlist_deleted', entity_type='playlist', 
                     entity_id=playlist.id, details=f"Deleted: {playlist.name}")
    db.session.add(log)
    
    db.session.delete(playlist)
    db.session.commit()
    
    return jsonify({'message': 'Playlist deleted successfully'})


@playlists_bp.route('/<int:playlist_id>/assets', methods=['GET'])
def get_playlist_assets(playlist_id):
    """Get assets in playlist with order."""
    playlist = Playlist.query.get_or_404(playlist_id)
    playlist_assets = PlaylistAsset.query.filter_by(playlist_id=playlist_id)\
        .order_by(PlaylistAsset.position).all()
    
    return jsonify({
        'playlist_id': playlist_id,
        'assets': [pa.to_dict() for pa in playlist_assets]
    })


@playlists_bp.route('/<int:playlist_id>/assets', methods=['POST'])
def add_asset_to_playlist(playlist_id):
    """Add asset to playlist (single or bulk)."""
    playlist = Playlist.query.get_or_404(playlist_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    asset_ids = []
    if 'asset_ids' in data and isinstance(data['asset_ids'], list):
        asset_ids = data['asset_ids']
    elif 'asset_id' in data:
        asset_ids = [data['asset_id']]
    else:
        return jsonify({'error': 'asset_id or asset_ids is required'}), 400
    
    # Get the next position
    max_position = db.session.query(db.func.max(PlaylistAsset.position))\
        .filter(PlaylistAsset.playlist_id == playlist_id).scalar() or -1
    
    added_assets = []
    for i, asset_id in enumerate(asset_ids):
        asset = Asset.query.get(asset_id)
        if not asset:
            continue
            
        playlist_asset = PlaylistAsset(
            playlist_id=playlist_id,
            asset_id=asset.id,
            position=max_position + 1 + i,
            custom_duration=data.get('custom_duration')
        )
        db.session.add(playlist_asset)
        added_assets.append(playlist_asset)
    
    db.session.commit()
    
    if 'asset_ids' in data:
        return jsonify({'message': f'{len(added_assets)} assets added', 'count': len(added_assets)}), 201

    if not added_assets:
        return jsonify({'error': 'Asset not found'}), 404
    
    return jsonify(added_assets[0].to_dict()), 201


@playlists_bp.route('/<int:playlist_id>/assets/<int:playlist_asset_id>', methods=['DELETE'])
def remove_asset_from_playlist(playlist_id, playlist_asset_id):
    """Remove asset from playlist."""
    playlist_asset = PlaylistAsset.query.filter_by(
        id=playlist_asset_id, playlist_id=playlist_id
    ).first_or_404()
    
    removed_position = playlist_asset.position
    db.session.delete(playlist_asset)
    
    # Reorder remaining items
    PlaylistAsset.query.filter(
        PlaylistAsset.playlist_id == playlist_id,
        PlaylistAsset.position > removed_position
    ).update({PlaylistAsset.position: PlaylistAsset.position - 1})
    
    db.session.commit()
    
    return jsonify({'message': 'Asset removed from playlist'})


@playlists_bp.route('/<int:playlist_id>/assets/reorder', methods=['PUT'])
def reorder_playlist_assets(playlist_id):
    """Reorder assets in playlist."""
    Playlist.query.get_or_404(playlist_id)
    data = request.get_json()
    
    if not data or 'order' not in data:
        return jsonify({'error': 'order array is required'}), 400
    
    # order is an array of playlist_asset_ids in new order
    for index, playlist_asset_id in enumerate(data['order']):
        PlaylistAsset.query.filter_by(
            id=playlist_asset_id, playlist_id=playlist_id
        ).update({'position': index})
    
    db.session.commit()
    
    # Log activity
    log = ActivityLog(action='playlist_reordered', entity_type='playlist', 
                     entity_id=playlist_id, details=f"Assets reordered")
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'message': 'Playlist reordered successfully'})


@playlists_bp.route('/<int:playlist_id>/assets/<int:playlist_asset_id>', methods=['PUT'])
def update_playlist_asset(playlist_id, playlist_asset_id):
    """Update playlist asset (custom duration, schedule)."""
    from datetime import datetime
    
    playlist_asset = PlaylistAsset.query.filter_by(
        id=playlist_asset_id, playlist_id=playlist_id
    ).first_or_404()
    
    data = request.get_json()
    
    if 'custom_duration' in data:
        playlist_asset.custom_duration = data['custom_duration']
    
    # Schedule time fields
    if 'schedule_start_time' in data:
        if data['schedule_start_time']:
            playlist_asset.schedule_start_time = datetime.strptime(data['schedule_start_time'], '%H:%M').time()
        else:
            playlist_asset.schedule_start_time = None
            
    if 'schedule_end_time' in data:
        if data['schedule_end_time']:
            playlist_asset.schedule_end_time = datetime.strptime(data['schedule_end_time'], '%H:%M').time()
        else:
            playlist_asset.schedule_end_time = None
    
    # Schedule days (array -> comma-separated string)
    if 'schedule_days' in data:
        if data['schedule_days'] and len(data['schedule_days']) > 0:
            playlist_asset.schedule_days = ','.join(str(d) for d in data['schedule_days'])
        else:
            playlist_asset.schedule_days = None
    
    # Date range fields
    if 'schedule_start_date' in data:
        if data['schedule_start_date']:
            playlist_asset.schedule_start_date = datetime.strptime(data['schedule_start_date'], '%Y-%m-%d').date()
        else:
            playlist_asset.schedule_start_date = None
            
    if 'schedule_end_date' in data:
        if data['schedule_end_date']:
            playlist_asset.schedule_end_date = datetime.strptime(data['schedule_end_date'], '%Y-%m-%d').date()
        else:
            playlist_asset.schedule_end_date = None
    
    db.session.commit()
    
    return jsonify(playlist_asset.to_dict())

