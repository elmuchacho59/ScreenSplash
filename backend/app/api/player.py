from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_from_directory
import os
from app import db
from app.models import Playlist, PlaylistAsset, Schedule, Asset

player_bp = Blueprint('player', __name__)


@player_bp.route('/current', methods=['GET'])
def get_current_content():
    """Get current playlist content to display based on schedule."""
    now = datetime.now()
    current_time = now.time()
    current_day = now.weekday()
    current_date = now.date()
    
    # Find active schedule
    schedules = Schedule.query.filter(
        Schedule.is_active == True
    ).order_by(Schedule.priority.desc()).all()
    
    active_schedule = None
    for schedule in schedules:
        days = [int(d) for d in schedule.days_of_week.split(',') if d]
        if current_day not in days:
            continue
        
        if schedule.start_date and current_date < schedule.start_date:
            continue
        if schedule.end_date and current_date > schedule.end_date:
            continue
        
        if schedule.start_time <= schedule.end_time:
            if schedule.start_time <= current_time <= schedule.end_time:
                active_schedule = schedule
                break
        else:
            if current_time >= schedule.start_time or current_time <= schedule.end_time:
                active_schedule = schedule
                break
    
    # Get playlist
    playlist = None
    if active_schedule:
        playlist = Playlist.query.get(active_schedule.playlist_id)
    else:
        # Fall back to default playlist
        playlist = Playlist.query.filter_by(is_default=True, is_active=True).first()
    
    if not playlist:
        # Get first active playlist
        playlist = Playlist.query.filter_by(is_active=True).first()
    
    if not playlist:
        return jsonify({
            'message': 'No content available',
            'items': []
        })
    
    # Get playlist assets
    playlist_assets = PlaylistAsset.query.filter_by(playlist_id=playlist.id)\
        .order_by(PlaylistAsset.position).all()
    
    items = []
    for pa in playlist_assets:
        if pa.asset and pa.asset.is_active:
            duration = pa.custom_duration if pa.custom_duration else pa.asset.duration
            item = {
                'id': pa.id,
                'asset_id': pa.asset.id,
                'type': pa.asset.type,
                'name': pa.asset.name,
                'path': pa.asset.path,
                'duration': duration,
                'position': pa.position
            }
            
            # Add full URL for files
            if pa.asset.type != 'url':
                item['url'] = f"/api/assets/{pa.asset.id}/file"
            else:
                item['url'] = pa.asset.path
            
            items.append(item)
    
    return jsonify({
        'playlist': {
            'id': playlist.id,
            'name': playlist.name
        },
        'schedule': active_schedule.to_dict() if active_schedule else None,
        'items': items,
        'timestamp': now.isoformat()
    })


@player_bp.route('/next', methods=['GET'])
def get_next_item():
    """Get next item after current (for preloading)."""
    current_position = request.args.get('current', 0, type=int)
    playlist_id = request.args.get('playlist_id', type=int)
    
    if not playlist_id:
        return jsonify({'error': 'playlist_id is required'}), 400
    
    # Get next item
    next_item = PlaylistAsset.query.filter(
        PlaylistAsset.playlist_id == playlist_id,
        PlaylistAsset.position > current_position
    ).order_by(PlaylistAsset.position).first()
    
    # If no next item, loop to first
    if not next_item:
        next_item = PlaylistAsset.query.filter_by(playlist_id=playlist_id)\
            .order_by(PlaylistAsset.position).first()
    
    if not next_item or not next_item.asset:
        return jsonify({'message': 'No next item'})
    
    duration = next_item.custom_duration if next_item.custom_duration else next_item.asset.duration
    
    return jsonify({
        'id': next_item.id,
        'asset_id': next_item.asset.id,
        'type': next_item.asset.type,
        'name': next_item.asset.name,
        'path': next_item.asset.path,
        'duration': duration,
        'position': next_item.position,
        'url': f"/api/assets/{next_item.asset.id}/file" if next_item.asset.type != 'url' else next_item.asset.path
    })


@player_bp.route('/status', methods=['POST'])
def update_player_status():
    """Update player status (for monitoring)."""
    data = request.get_json() or {}
    
    # This could be extended to store player status in DB
    # For now, just acknowledge
    return jsonify({
        'message': 'Status received',
        'received': data,
        'timestamp': datetime.now().isoformat()
    })
