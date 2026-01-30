from flask import Blueprint, request, jsonify
from app.models import db, Widget, ActivityLog
import requests
import os

widgets_bp = Blueprint('widgets', __name__)

WEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')

# Weather icons mapping
WEATHER_ICONS = {
    'clear': '☀️',
    'clouds': '☁️',
    'rain': '🌧️',
    'drizzle': '🌦️',
    'thunderstorm': '⛈️',
    'snow': '❄️',
    'mist': '🌫️',
    'fog': '🌫️',
    'haze': '🌫️'
}


@widgets_bp.route('', methods=['GET'])
def get_widgets():
    """Get all widgets, optionally filtered by enabled status"""
    enabled_only = request.args.get('enabled', 'false').lower() == 'true'
    
    query = Widget.query
    if enabled_only:
        query = query.filter_by(is_enabled=True)
    
    widgets = query.order_by(Widget.position).all()
    return jsonify({'widgets': [w.to_dict() for w in widgets]})


@widgets_bp.route('', methods=['POST'])
def create_widget():
    """Create a new widget"""
    data = request.json
    
    widget = Widget(
        type=data.get('type', 'clock'),
        name=data.get('name', 'Nouveau widget'),
        position=data.get('position', 'bottom-right'),
        config=data.get('config', {}),
        is_enabled=data.get('is_enabled', True)
    )
    
    db.session.add(widget)
    db.session.commit()
    
    ActivityLog.log('widget_created', f'Widget créé: {widget.name}')
    
    return jsonify(widget.to_dict()), 201


@widgets_bp.route('/<int:widget_id>', methods=['GET'])
def get_widget(widget_id):
    """Get a single widget"""
    widget = Widget.query.get_or_404(widget_id)
    return jsonify(widget.to_dict())


@widgets_bp.route('/<int:widget_id>', methods=['PUT'])
def update_widget(widget_id):
    """Update a widget"""
    widget = Widget.query.get_or_404(widget_id)
    data = request.json
    
    if 'name' in data:
        widget.name = data['name']
    if 'type' in data:
        widget.type = data['type']
    if 'position' in data:
        widget.position = data['position']
    if 'config' in data:
        widget.config = data['config']
    if 'is_enabled' in data:
        widget.is_enabled = data['is_enabled']
    
    db.session.commit()
    
    return jsonify(widget.to_dict())


@widgets_bp.route('/<int:widget_id>', methods=['DELETE'])
def delete_widget(widget_id):
    """Delete a widget"""
    widget = Widget.query.get_or_404(widget_id)
    name = widget.name
    
    db.session.delete(widget)
    db.session.commit()
    
    ActivityLog.log('widget_deleted', f'Widget supprimé: {name}')
    
    return jsonify({'success': True})


@widgets_bp.route('/weather', methods=['GET'])
def get_weather():
    """Proxy endpoint for weather data to avoid CORS issues"""
    city = request.args.get('city', 'Paris')
    
    # If no API key, return mock data
    if not WEATHER_API_KEY:
        return jsonify({
            'temp': 18,
            'description': 'Partiellement nuageux',
            'icon': '⛅',
            'city': city
        })
    
    try:
        url = f'https://api.openweathermap.org/data/2.5/weather'
        params = {
            'q': city,
            'appid': WEATHER_API_KEY,
            'units': 'metric',
            'lang': 'fr'
        }
        
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        main_weather = data['weather'][0]['main'].lower()
        icon = WEATHER_ICONS.get(main_weather, '🌤️')
        
        return jsonify({
            'temp': round(data['main']['temp']),
            'feels_like': round(data['main']['feels_like']),
            'description': data['weather'][0]['description'],
            'icon': icon,
            'humidity': data['main']['humidity'],
            'city': data['name']
        })
        
    except requests.RequestException as e:
        return jsonify({
            'temp': '--',
            'description': 'Données indisponibles',
            'icon': '❓',
            'city': city,
            'error': str(e)
        }), 200  # Still return 200 to not break the widget


@widgets_bp.route('/types', methods=['GET'])
def get_widget_types():
    """Get available widget types and their configuration options"""
    return jsonify({
        'types': [
            {
                'id': 'clock',
                'name': 'Horloge',
                'icon': '🕐',
                'description': "Affiche l'heure et la date",
                'config_schema': {
                    'showDate': {'type': 'boolean', 'default': True, 'label': 'Afficher la date'},
                    'showSeconds': {'type': 'boolean', 'default': True, 'label': 'Afficher les secondes'}
                }
            },
            {
                'id': 'weather',
                'name': 'Météo',
                'icon': '⛅',
                'description': 'Affiche la météo actuelle',
                'config_schema': {
                    'city': {'type': 'string', 'default': 'Paris', 'label': 'Ville'}
                }
            },
            {
                'id': 'text',
                'name': 'Texte',
                'icon': '📝',
                'description': 'Affiche un texte personnalisé',
                'config_schema': {
                    'text': {'type': 'string', 'default': 'Bienvenue', 'label': 'Texte'},
                    'scrolling': {'type': 'boolean', 'default': True, 'label': 'Texte défilant'}
                }
            }
        ],
        'positions': [
            {'id': 'top-left', 'name': 'Haut gauche'},
            {'id': 'top-center', 'name': 'Haut centre'},
            {'id': 'top-right', 'name': 'Haut droite'},
            {'id': 'bottom-left', 'name': 'Bas gauche'},
            {'id': 'bottom-center', 'name': 'Bas centre'},
            {'id': 'bottom-right', 'name': 'Bas droite'}
        ]
    })
