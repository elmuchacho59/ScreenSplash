from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from app.models import db, SystemConfig, ActivityLog
from functools import wraps

auth_bp = Blueprint('auth', __name__)


def get_password_hash():
    """Get stored password hash from config"""
    config = SystemConfig.query.filter_by(key='admin_password').first()
    return config.value if config else None


def set_password_hash(password):
    """Store password hash in config"""
    hashed = generate_password_hash(password)
    config = SystemConfig.query.filter_by(key='admin_password').first()
    if config:
        config.value = hashed
    else:
        config = SystemConfig(key='admin_password', value=hashed)
        db.session.add(config)
    db.session.commit()
    return True


def login_required(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if password is set
        if not get_password_hash():
            # No password set, allow access
            return f(*args, **kwargs)
        
        # Check session
        if not session.get('authenticated'):
            return jsonify({'error': 'Non autorisé'}), 401
        
        return f(*args, **kwargs)
    return decorated_function


@auth_bp.route('/check', methods=['GET'])
def check_auth():
    """Check if user is authenticated and if password is required"""
    password_hash = get_password_hash()
    
    if not password_hash:
        # No password set
        return jsonify({
            'authenticated': True,
            'password_required': False,
            'password_set': False
        })
    
    return jsonify({
        'authenticated': session.get('authenticated', False),
        'password_required': True,
        'password_set': True
    })


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login with password"""
    data = request.json
    password = data.get('password', '')
    
    stored_hash = get_password_hash()
    
    if not stored_hash:
        # No password set, auto-authenticate
        session['authenticated'] = True
        return jsonify({'success': True})
    
    if check_password_hash(stored_hash, password):
        session['authenticated'] = True
        session.permanent = True
        ActivityLog.log('auth_login', 'Connexion réussie')
        return jsonify({'success': True})
    
    ActivityLog.log('auth_failed', 'Tentative de connexion échouée')
    return jsonify({'error': 'Mot de passe incorrect'}), 401


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout current session"""
    session.pop('authenticated', None)
    return jsonify({'success': True})


@auth_bp.route('/password', methods=['POST'])
@login_required
def change_password():
    """Set or change admin password"""
    data = request.json
    new_password = data.get('new_password', '')
    current_password = data.get('current_password', '')
    
    if not new_password or len(new_password) < 4:
        return jsonify({'error': 'Le mot de passe doit contenir au moins 4 caractères'}), 400
    
    stored_hash = get_password_hash()
    
    # If password already set, verify current password
    if stored_hash:
        if not current_password or not check_password_hash(stored_hash, current_password):
            return jsonify({'error': 'Mot de passe actuel incorrect'}), 401
    
    set_password_hash(new_password)
    ActivityLog.log('password_changed', 'Mot de passe modifié')
    
    return jsonify({'success': True, 'message': 'Mot de passe mis à jour'})


@auth_bp.route('/password', methods=['DELETE'])
@login_required
def remove_password():
    """Remove password protection"""
    data = request.json
    current_password = data.get('current_password', '')
    
    stored_hash = get_password_hash()
    
    if stored_hash:
        if not check_password_hash(stored_hash, current_password):
            return jsonify({'error': 'Mot de passe incorrect'}), 401
    
    config = SystemConfig.query.filter_by(key='admin_password').first()
    if config:
        db.session.delete(config)
        db.session.commit()
    
    ActivityLog.log('password_removed', 'Protection par mot de passe désactivée')
    
    return jsonify({'success': True, 'message': 'Protection par mot de passe désactivée'})
