from datetime import datetime
from app import db

# Association table for playlist assets with ordering
class PlaylistAsset(db.Model):
    __tablename__ = 'playlist_assets'
    
    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey('playlists.id', ondelete='CASCADE'), nullable=False)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)
    
    # Custom duration override (if None, use asset's default duration)
    custom_duration = db.Column(db.Integer, nullable=True)
    
    asset = db.relationship('Asset', backref='playlist_associations')
    
    def to_dict(self):
        return {
            'id': self.id,
            'playlist_id': self.playlist_id,
            'asset_id': self.asset_id,
            'position': self.position,
            'custom_duration': self.custom_duration,
            'asset': self.asset.to_dict() if self.asset else None
        }


class Asset(db.Model):
    __tablename__ = 'assets'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'image', 'video', 'url'
    path = db.Column(db.String(500), nullable=False)  # file path or URL
    thumbnail_path = db.Column(db.String(500), nullable=True)
    duration = db.Column(db.Integer, default=10)  # seconds
    mime_type = db.Column(db.String(100), nullable=True)
    file_size = db.Column(db.Integer, nullable=True)  # bytes
    width = db.Column(db.Integer, nullable=True)
    height = db.Column(db.Integer, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'path': self.path,
            'thumbnail_path': self.thumbnail_path,
            'duration': self.duration,
            'mime_type': self.mime_type,
            'file_size': self.file_size,
            'width': self.width,
            'height': self.height,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Playlist(db.Model):
    __tablename__ = 'playlists'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship with assets through PlaylistAsset
    playlist_assets = db.relationship('PlaylistAsset', backref='playlist', 
                                       lazy='dynamic', cascade='all, delete-orphan',
                                       order_by='PlaylistAsset.position')
    
    # Relationship with schedules
    schedules = db.relationship('Schedule', backref='playlist', lazy='dynamic',
                                cascade='all, delete-orphan')
    
    def to_dict(self, include_assets=False):
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active,
            'is_default': self.is_default,
            'asset_count': self.playlist_assets.count(),
            'total_duration': self.get_total_duration(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_assets:
            data['assets'] = [pa.to_dict() for pa in self.playlist_assets.order_by(PlaylistAsset.position).all()]
        return data
    
    def get_total_duration(self):
        total = 0
        for pa in self.playlist_assets.all():
            duration = pa.custom_duration if pa.custom_duration else pa.asset.duration
            total += duration if duration else 0
        return total


class Schedule(db.Model):
    __tablename__ = 'schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    playlist_id = db.Column(db.Integer, db.ForeignKey('playlists.id', ondelete='CASCADE'), nullable=False)
    
    # Time configuration
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    
    # Days of week (stored as comma-separated: "0,1,2,3,4,5,6" for Mon-Sun)
    days_of_week = db.Column(db.String(20), default="0,1,2,3,4,5,6")
    
    # Date range (optional)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    
    is_recurring = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    priority = db.Column(db.Integer, default=0)  # Higher priority wins on conflicts
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'playlist_id': self.playlist_id,
            'playlist_name': self.playlist.name if self.playlist else None,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'days_of_week': [int(d) for d in self.days_of_week.split(',') if d],
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_recurring': self.is_recurring,
            'is_active': self.is_active,
            'priority': self.priority,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class SystemConfig(db.Model):
    __tablename__ = 'system_config'
    
    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=True)
    description = db.Column(db.String(255), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'key': self.key,
            'value': self.value,
            'description': self.description,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    action = db.Column(db.String(100), nullable=False)
    entity_type = db.Column(db.String(50), nullable=True)  # 'asset', 'playlist', 'schedule', 'system'
    entity_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'details': self.details,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def log(cls, action, details=None, entity_type=None, entity_id=None):
        """Helper method to create activity log entry"""
        log_entry = cls(
            action=action,
            details=details,
            entity_type=entity_type,
            entity_id=entity_id
        )
        db.session.add(log_entry)
        db.session.commit()
        return log_entry


class Widget(db.Model):
    __tablename__ = 'widgets'
    
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), nullable=False)  # 'clock', 'weather', 'text'
    name = db.Column(db.String(255), nullable=False, default='Widget')
    position = db.Column(db.String(50), default='bottom-right')  # Position on screen
    config = db.Column(db.JSON, default={})  # Widget-specific configuration
    is_enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'name': self.name,
            'position': self.position,
            'config': self.config or {},
            'is_enabled': self.is_enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
