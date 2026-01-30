import os
import platform
import socket
import psutil
import subprocess
from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models import SystemConfig, ActivityLog, Asset, Playlist

system_bp = Blueprint('system', __name__)


def get_cpu_temperature():
    """Get CPU temperature (Raspberry Pi specific)."""
    try:
        # Linux / Raspberry Pi
        if os.path.exists('/sys/class/thermal/thermal_zone0/temp'):
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                temp = int(f.read().strip()) / 1000.0
                return round(temp, 1)
    except:
        pass
    
    # Windows / Other - psutil may have temp sensors
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for name, entries in temps.items():
                if entries:
                    return round(entries[0].current, 1)
    except:
        pass
    
    return None


def get_device_info():
    """Get device model and related info."""
    info = {
        'hostname': socket.gethostname(),
        'platform': platform.system(),
        'platform_release': platform.release(),
        'architecture': platform.machine(),
        'processor': platform.processor(),
        'model': 'Unknown'
    }
    
    # Try to get Raspberry Pi model
    try:
        if os.path.exists('/proc/device-tree/model'):
            with open('/proc/device-tree/model', 'r') as f:
                info['model'] = f.read().strip().rstrip('\x00')
    except:
        pass
    
    return info


def get_mac_address():
    """Get primary MAC address."""
    try:
        for interface, addrs in psutil.net_if_addrs().items():
            for addr in addrs:
                if addr.family == psutil.AF_LINK:
                    if addr.address and addr.address != '00:00:00:00:00:00':
                        return addr.address
    except:
        pass
    return None


def get_ip_address():
    """Get primary IP address."""
    try:
        # Connect to external address to find primary interface
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return '127.0.0.1'


def get_wifi_info():

    """Get WiFi SSID and signal strength (Raspberry Pi specific)."""
    wifi = {'ssid': None, 'signal': None, 'active': False}
    if platform.system() != 'Linux':
        return wifi
        
    try:
        # Get SSID
        ssid = subprocess.check_output(['iwgetid', '-r'], stderr=subprocess.STDOUT).decode('utf-8').strip()
        if ssid:
            wifi['ssid'] = ssid
            wifi['active'] = True
            
            # Try to get signal quality from /proc/net/wireless
            try:
                with open('/proc/net/wireless', 'r') as f:
                    lines = f.readlines()
                    for line in lines:
                        if ':' in line: # Interface lines
                            parts = line.split()
                            # parts[2] is Link Quality (usually out of 70)
                            link_quality = float(parts[2].replace('.', ''))
                            wifi['signal'] = int((link_quality / 70.0) * 100)
            except:
                # Fallback to nmcli if /proc/net/wireless fails
                try:
                    sig_output = subprocess.check_output(['nmcli', '-t', '-f', 'active,signal', 'dev', 'wifi'], 
                                                       stderr=subprocess.STDOUT).decode('utf-8').strip()
                    for line in sig_output.split('\n'):
                        if line.startswith('oui:') or line.startswith('yes:'):
                            wifi['signal'] = int(line.split(':')[1])
                except:
                    pass
    except:
        pass
    
    return wifi


@system_bp.route('/status', methods=['GET'])
def get_system_status():
    """Get system status (CPU, memory, disk, temperature, wifi)."""
    # CPU
    cpu_percent = psutil.cpu_percent(interval=0.5)
    cpu_count = psutil.cpu_count()
    
    # Memory
    memory = psutil.virtual_memory()
    
    # Disk
    disk = psutil.disk_usage('/')
    
    # Uptime
    boot_time = datetime.fromtimestamp(psutil.boot_time())
    uptime_seconds = (datetime.now() - boot_time).total_seconds()
    
    # Temperature
    cpu_temp = get_cpu_temperature()
    
    # WiFi
    wifi_info = get_wifi_info()
    
    return jsonify({
        'cpu': {
            'percent': cpu_percent,
            'count': cpu_count
        },
        'memory': {
            'total': memory.total,
            'available': memory.available,
            'used': memory.used,
            'percent': memory.percent
        },
        'disk': {
            'total': disk.total,
            'used': disk.used,
            'free': disk.free,
            'percent': round((disk.used / disk.total) * 100, 1)
        },
        'temperature': {
            'cpu': cpu_temp
        },
        'uptime': {
            'seconds': int(uptime_seconds),
            'boot_time': boot_time.isoformat()
        },
        'network': {
            'ip': get_ip_address(),
            'connected': True,
            'wifi': wifi_info
        },
        'timestamp': datetime.now().isoformat()
    })



@system_bp.route('/info', methods=['GET'])
def get_system_info():
    """Get device information."""
    device_info = get_device_info()
    
    # Get counts
    asset_count = Asset.query.count()
    playlist_count = Playlist.query.count()
    
    # Get software version from config
    version_config = SystemConfig.query.get('version')
    version = version_config.value if version_config else '1.0.0'
    
    return jsonify({
        'device': device_info,
        'mac_address': get_mac_address(),
        'ip_address': get_ip_address(),
        'version': version,
        'stats': {
            'assets': asset_count,
            'playlists': playlist_count
        },
        'python_version': platform.python_version()
    })


@system_bp.route('/logs', methods=['GET'])
def get_activity_logs():
    """Get recent activity logs."""
    limit = request.args.get('limit', 50, type=int)
    entity_type = request.args.get('type')
    
    query = ActivityLog.query
    
    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)
    
    logs = query.order_by(ActivityLog.created_at.desc()).limit(limit).all()
    
    return jsonify({
        'logs': [log.to_dict() for log in logs]
    })


@system_bp.route('/config', methods=['GET'])
def get_config():
    """Get all system configuration."""
    configs = SystemConfig.query.all()
    return jsonify({
        'config': {c.key: c.value for c in configs}
    })


@system_bp.route('/config', methods=['PUT'])
def update_config():
    """Update system configuration."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Data is required'}), 400
    
    updated = []
    for key, value in data.items():
        config = SystemConfig.query.get(key)
        if config:
            config.value = str(value)
        else:
            config = SystemConfig(key=key, value=str(value))
            db.session.add(config)
        updated.append(key)
    
    db.session.commit()
    
    # Log activity
    log = ActivityLog(action='config_updated', entity_type='system', 
                     details=f"Updated config: {', '.join(updated)}")
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'message': 'Configuration updated', 'updated_keys': updated})


@system_bp.route('/config/<key>', methods=['GET'])
def get_config_value(key):
    """Get single config value."""
    config = SystemConfig.query.get(key)
    if not config:
        return jsonify({'error': 'Config key not found'}), 404
    return jsonify(config.to_dict())


@system_bp.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })
