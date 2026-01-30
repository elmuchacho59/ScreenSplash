import os
import uuid
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from werkzeug.utils import secure_filename
from PIL import Image
from app import db
from app.models import Asset, ActivityLog

assets_bp = Blueprint('assets', __name__)

def allowed_file(filename, file_type):
    """Check if file extension is allowed."""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if file_type == 'image':
        return ext in current_app.config['ALLOWED_IMAGE_EXTENSIONS']
    elif file_type == 'video':
        return ext in current_app.config['ALLOWED_VIDEO_EXTENSIONS']
    return False

def get_file_type(filename):
    """Determine file type from extension."""
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if ext in current_app.config['ALLOWED_IMAGE_EXTENSIONS']:
        return 'image'
    elif ext in current_app.config['ALLOWED_VIDEO_EXTENSIONS']:
        return 'video'
    return None

def generate_thumbnail(filepath, asset_type):
    """Generate thumbnail for image/video."""
    thumbnails_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'thumbnails')
    thumb_filename = f"thumb_{uuid.uuid4().hex}.jpg"
    thumb_path = os.path.join(thumbnails_dir, thumb_filename)
    
    try:
        if asset_type == 'image':
            with Image.open(filepath) as img:
                img.thumbnail((300, 300))
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                img.save(thumb_path, 'JPEG', quality=85)
            return f"thumbnails/{thumb_filename}"
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
    return None


@assets_bp.route('', methods=['GET'])
def get_assets():
    """Get all assets with optional filtering."""
    asset_type = request.args.get('type')
    is_active = request.args.get('active')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    query = Asset.query
    
    if asset_type:
        query = query.filter(Asset.type == asset_type)
    if is_active is not None:
        query = query.filter(Asset.is_active == (is_active.lower() == 'true'))
    
    query = query.order_by(Asset.created_at.desc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'assets': [asset.to_dict() for asset in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@assets_bp.route('/<int:asset_id>', methods=['GET'])
def get_asset(asset_id):
    """Get single asset by ID."""
    asset = Asset.query.get_or_404(asset_id)
    return jsonify(asset.to_dict())


@assets_bp.route('', methods=['POST'])
def create_asset():
    """Create new asset (file upload or URL)."""
    # Check if it's a URL-based or Widget-based asset
    if request.content_type and 'application/json' in request.content_type:
        data = request.get_json()
        if not data or (not data.get('url') and data.get('type') != 'widget'):
            return jsonify({'error': 'URL or type=widget is required'}), 400
        
        asset_type = data.get('type', 'url')
        asset = Asset(
            name=data.get('name', data.get('url', 'Widget')[:50]),
            type=asset_type,
            path=data.get('url', 'info_page'),
            duration=data.get('duration', 30),
            is_active=data.get('is_active', True)
        )
        db.session.add(asset)
        db.session.commit()
        
        # Log activity
        log = ActivityLog(action='asset_created', entity_type='asset', 
                         entity_id=asset.id, details=f"{asset_type.capitalize()} asset: {asset.name}")
        db.session.add(log)
        db.session.commit()
        
        return jsonify(asset.to_dict()), 201
    
    # File upload
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    file_type = get_file_type(file.filename)
    if not file_type:
        return jsonify({'error': 'File type not allowed'}), 400
    
    # Generate unique filename
    original_name = secure_filename(file.filename)
    ext = original_name.rsplit('.', 1)[1].lower() if '.' in original_name else ''
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    
    # Save file
    subfolder = 'images' if file_type == 'image' else 'videos'
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], subfolder, unique_filename)
    file.save(filepath)
    
    # Get file info
    file_size = os.path.getsize(filepath)
    width, height = None, None
    
    if file_type == 'image':
        try:
            with Image.open(filepath) as img:
                width, height = img.size
        except:
            pass
    
    # Generate thumbnail
    thumbnail_path = generate_thumbnail(filepath, file_type)
    
    # Get custom name or use original
    name = request.form.get('name', original_name.rsplit('.', 1)[0])
    duration = request.form.get('duration', 10 if file_type == 'image' else 0, type=int)
    
    asset = Asset(
        name=name,
        type=file_type,
        path=f"{subfolder}/{unique_filename}",
        thumbnail_path=thumbnail_path,
        duration=duration,
        mime_type=file.content_type,
        file_size=file_size,
        width=width,
        height=height,
        is_active=True
    )
    db.session.add(asset)
    db.session.commit()
    
    # Log activity
    log = ActivityLog(action='asset_created', entity_type='asset', 
                     entity_id=asset.id, details=f"File uploaded: {asset.name}")
    db.session.add(log)
    db.session.commit()
    
    return jsonify(asset.to_dict()), 201


@assets_bp.route('/<int:asset_id>', methods=['PUT'])
def update_asset(asset_id):
    """Update asset metadata."""
    asset = Asset.query.get_or_404(asset_id)
    data = request.get_json()
    
    if 'name' in data:
        asset.name = data['name']
    if 'duration' in data:
        asset.duration = data['duration']
    if 'is_active' in data:
        asset.is_active = data['is_active']
    if 'path' in data and asset.type == 'url':
        asset.path = data['path']
    
    db.session.commit()
    
    # Log activity
    log = ActivityLog(action='asset_updated', entity_type='asset', 
                     entity_id=asset.id, details=f"Updated: {asset.name}")
    db.session.add(log)
    db.session.commit()
    
    return jsonify(asset.to_dict())


@assets_bp.route('/<int:asset_id>', methods=['DELETE'])
def delete_asset(asset_id):
    """Delete asset and its file."""
    asset = Asset.query.get_or_404(asset_id)
    
    # Delete physical file if exists
    if asset.type != 'url' and asset.path:
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], asset.path)
        if os.path.exists(filepath):
            os.remove(filepath)
    
    # Delete thumbnail if exists
    if asset.thumbnail_path:
        thumb_path = os.path.join(current_app.config['UPLOAD_FOLDER'], asset.thumbnail_path)
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
    
    # Log before delete
    log = ActivityLog(action='asset_deleted', entity_type='asset', 
                     entity_id=asset.id, details=f"Deleted: {asset.name}")
    db.session.add(log)
    
    db.session.delete(asset)
    db.session.commit()
    
    return jsonify({'message': 'Asset deleted successfully'})


@assets_bp.route('/<int:asset_id>/file', methods=['GET'])
def get_asset_file(asset_id):
    """Serve asset file."""
    asset = Asset.query.get_or_404(asset_id)
    
    if asset.type == 'url':
        return jsonify({'error': 'URL assets cannot be served as files'}), 400
    
    directory = os.path.dirname(os.path.join(current_app.config['UPLOAD_FOLDER'], asset.path))
    filename = os.path.basename(asset.path)
    
    return send_from_directory(directory, filename)


@assets_bp.route('/<int:asset_id>/thumbnail', methods=['GET'])
def get_asset_thumbnail(asset_id):
    """Serve asset thumbnail."""
    asset = Asset.query.get_or_404(asset_id)
    
    if not asset.thumbnail_path:
        return jsonify({'error': 'No thumbnail available'}), 404
    
    directory = os.path.dirname(os.path.join(current_app.config['UPLOAD_FOLDER'], asset.thumbnail_path))
    filename = os.path.basename(asset.thumbnail_path)
    
    return send_from_directory(directory, filename)
