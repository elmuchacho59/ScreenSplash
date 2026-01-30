import os
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    
    # Configuration
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'screensplash-secret-key-2024')
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(basedir, '..', '..', 'database', 'screensplash.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.path.join(basedir, '..', '..', 'assets')
    app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max upload
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    
    # Allowed extensions
    app.config['ALLOWED_IMAGE_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    app.config['ALLOWED_VIDEO_EXTENSIONS'] = {'mp4', 'webm', 'mov'}
    
    # Initialize extensions
    CORS(app, origins="*", supports_credentials=True)
    db.init_app(app)
    
    # Ensure directories exist
    os.makedirs(os.path.join(basedir, '..', '..', 'database'), exist_ok=True)
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'images'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'videos'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'thumbnails'), exist_ok=True)
    
    # Register blueprints
    from app.api.assets import assets_bp
    from app.api.playlists import playlists_bp
    from app.api.schedules import schedules_bp
    from app.api.system import system_bp
    from app.api.player import player_bp
    from app.api.widgets import widgets_bp
    from app.api.auth import auth_bp
    
    app.register_blueprint(assets_bp, url_prefix='/api/assets')
    app.register_blueprint(playlists_bp, url_prefix='/api/playlists')
    app.register_blueprint(schedules_bp, url_prefix='/api/schedules')
    app.register_blueprint(system_bp, url_prefix='/api/system')
    app.register_blueprint(player_bp, url_prefix='/api/player')
    app.register_blueprint(widgets_bp, url_prefix='/api/widgets')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    return app
