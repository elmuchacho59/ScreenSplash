from datetime import datetime, time
from flask import Blueprint, request, jsonify
from app import db
from app.models import Schedule, Playlist, ActivityLog

schedules_bp = Blueprint('schedules', __name__)


@schedules_bp.route('', methods=['GET'])
def get_schedules():
    """Get all schedules."""
    schedules = Schedule.query.order_by(Schedule.priority.desc(), Schedule.start_time).all()
    return jsonify({
        'schedules': [s.to_dict() for s in schedules]
    })


@schedules_bp.route('/<int:schedule_id>', methods=['GET'])
def get_schedule(schedule_id):
    """Get single schedule."""
    schedule = Schedule.query.get_or_404(schedule_id)
    return jsonify(schedule.to_dict())


@schedules_bp.route('', methods=['POST'])
def create_schedule():
    """Create new schedule."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Data is required'}), 400
    
    required_fields = ['name', 'playlist_id', 'start_time', 'end_time']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Verify playlist exists
    playlist = Playlist.query.get_or_404(data['playlist_id'])
    
    # Parse times
    try:
        start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        end_time = datetime.strptime(data['end_time'], '%H:%M').time()
    except ValueError:
        return jsonify({'error': 'Invalid time format. Use HH:MM'}), 400
    
    # Parse days of week
    days_of_week = data.get('days_of_week', [0, 1, 2, 3, 4, 5, 6])
    if isinstance(days_of_week, list):
        days_of_week = ','.join(str(d) for d in days_of_week)
    
    # Parse dates if provided
    start_date = None
    end_date = None
    if data.get('start_date'):
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    if data.get('end_date'):
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    
    schedule = Schedule(
        name=data['name'],
        playlist_id=playlist.id,
        start_time=start_time,
        end_time=end_time,
        days_of_week=days_of_week,
        start_date=start_date,
        end_date=end_date,
        is_recurring=data.get('is_recurring', True),
        is_active=data.get('is_active', True),
        priority=data.get('priority', 0)
    )
    
    db.session.add(schedule)
    db.session.commit()
    
    # Log activity
    log = ActivityLog(action='schedule_created', entity_type='schedule', 
                     entity_id=schedule.id, details=f"Created: {schedule.name}")
    db.session.add(log)
    db.session.commit()
    
    return jsonify(schedule.to_dict()), 201


@schedules_bp.route('/<int:schedule_id>', methods=['PUT'])
def update_schedule(schedule_id):
    """Update schedule."""
    schedule = Schedule.query.get_or_404(schedule_id)
    data = request.get_json()
    
    if 'name' in data:
        schedule.name = data['name']
    if 'playlist_id' in data:
        Playlist.query.get_or_404(data['playlist_id'])
        schedule.playlist_id = data['playlist_id']
    if 'start_time' in data:
        schedule.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
    if 'end_time' in data:
        schedule.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
    if 'days_of_week' in data:
        days = data['days_of_week']
        if isinstance(days, list):
            days = ','.join(str(d) for d in days)
        schedule.days_of_week = days
    if 'start_date' in data:
        schedule.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date() if data['start_date'] else None
    if 'end_date' in data:
        schedule.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data['end_date'] else None
    if 'is_recurring' in data:
        schedule.is_recurring = data['is_recurring']
    if 'is_active' in data:
        schedule.is_active = data['is_active']
    if 'priority' in data:
        schedule.priority = data['priority']
    
    db.session.commit()
    
    # Log activity
    log = ActivityLog(action='schedule_updated', entity_type='schedule', 
                     entity_id=schedule.id, details=f"Updated: {schedule.name}")
    db.session.add(log)
    db.session.commit()
    
    return jsonify(schedule.to_dict())


@schedules_bp.route('/<int:schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    """Delete schedule."""
    schedule = Schedule.query.get_or_404(schedule_id)
    
    # Log before delete
    log = ActivityLog(action='schedule_deleted', entity_type='schedule', 
                     entity_id=schedule.id, details=f"Deleted: {schedule.name}")
    db.session.add(log)
    
    db.session.delete(schedule)
    db.session.commit()
    
    return jsonify({'message': 'Schedule deleted successfully'})


@schedules_bp.route('/active', methods=['GET'])
def get_active_schedule():
    """Get currently active schedule based on current time."""
    now = datetime.now()
    current_time = now.time()
    current_day = now.weekday()  # 0=Monday, 6=Sunday
    current_date = now.date()
    
    # Query active schedules
    schedules = Schedule.query.filter(
        Schedule.is_active == True
    ).order_by(Schedule.priority.desc()).all()
    
    for schedule in schedules:
        # Check day of week
        days = [int(d) for d in schedule.days_of_week.split(',') if d]
        if current_day not in days:
            continue
        
        # Check date range if specified
        if schedule.start_date and current_date < schedule.start_date:
            continue
        if schedule.end_date and current_date > schedule.end_date:
            continue
        
        # Check time range
        if schedule.start_time <= schedule.end_time:
            # Normal range (e.g., 09:00 - 17:00)
            if schedule.start_time <= current_time <= schedule.end_time:
                return jsonify(schedule.to_dict())
        else:
            # Overnight range (e.g., 22:00 - 06:00)
            if current_time >= schedule.start_time or current_time <= schedule.end_time:
                return jsonify(schedule.to_dict())
    
    # No active schedule, return default playlist if any
    default_playlist = Playlist.query.filter_by(is_default=True, is_active=True).first()
    if default_playlist:
        return jsonify({
            'id': None,
            'name': 'Default',
            'playlist_id': default_playlist.id,
            'playlist_name': default_playlist.name,
            'is_default': True
        })
    
    return jsonify({'message': 'No active schedule'}), 404
