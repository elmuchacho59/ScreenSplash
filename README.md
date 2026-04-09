# ScreenSplash 📺

Application d'affichage dynamique (Digital Signage) open source pour Raspberry Pi.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red.svg)

## 🎯 Fonctionnalités

- **Gestion des médias** : Images, vidéos et pages web
- **Playlists** : Création de séquences avec drag-and-drop
- **Planification** : Programmation horaire avec jours de la semaine
- **Monitoring** : Suivi en temps réel (CPU, mémoire, température, WiFi)
- **Synchronisation** : Mise à jour instantanée sans rafraîchissement (BroadcastChannel)
- **WiFi** : Affichage de l'intensité du signal et du SSID
- **Interface web** : Administration complète depuis n'importe quel appareil
- **Mode kiosque** : Affichage plein écran optimisé

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Interface     │────▶│   Backend API   │
│   Admin (React) │     │   (Flask)       │
└─────────────────┘     └────────┬────────┘
                                 │
┌─────────────────┐     ┌────────▼────────┐
│   Player        │────▶│   SQLite DB     │
│   (Chromium)    │     │                 │
└─────────────────┘     └─────────────────┘
```

## 📋 Prérequis

- Raspberry Pi 3B ou supérieur (1GB RAM minimum)
- Raspberry Pi OS Lite (64-bit recommandé)
- Écran HDMI
- Connexion réseau (Ethernet ou WiFi)

### 🛠️ Préparation du système

Sur une installation fraîche de Raspberry Pi OS (surtout la version Lite), il est possible que `git` ne soit pas installé par défaut. Pour l'installer, exécutez la commande suivante :

```bash
sudo apt update && sudo apt install -y git
```

## 🚀 Installation

### Installation automatique

```bash
# Cloner le projet
git clone https://github.com/elmuchacho59/ScreenSplash.git
cd ScreenSplash

# Lancer l'installation
sudo bash scripts/install.sh
```


### Installation manuelle

1. **Installer les dépendances système**
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3 python3-pip python3-venv chromium-browser curl
```

2. **Configurer le backend**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. **Configurer le frontend**
```bash
cd frontend
npm install
npm run build
```

4. **Démarrer l'application**
```bash
# Backend
cd backend && source venv/bin/activate
python run.py

# Dans un autre terminal, ouvrir le player
chromium-browser --kiosk http://localhost:5000/player
```

## 📁 Structure du projet

```
screensplash/
├── backend/              # API Flask
│   ├── app/
│   │   ├── api/          # Endpoints REST
│   │   ├── models.py     # Modèles SQLAlchemy
│   │   └── __init__.py   # Factory Flask
│   └── run.py            # Point d'entrée
├── frontend/             # Interface React
│   ├── src/
│   │   ├── pages/        # Composants de pages
│   │   ├── services/     # Services API
│   │   └── components/   # Composants réutilisables
│   └── vite.config.js    # Configuration Vite
├── scripts/              # Scripts Raspberry Pi
│   ├── install.sh        # Installation auto
│   └── *.service         # Services systemd
└── README.md
```

## 🖥️ Interface d'administration

Accédez à `http://[IP-RASPBERRY]:5000` depuis n'importe quel navigateur.

### Pages disponibles

| Page | Description |
|------|-------------|
| Dashboard | Vue d'ensemble du système et statistiques |
| Assets | Gestion des médias (upload, édition, suppression) |
| Playlists | Création de séquences avec réorganisation |
| Planification | Programmation horaire des playlists |
| Paramètres | Configuration d'affichage et système |

## ⚙️ Configuration Raspberry Pi

### Paramètres recommandés (config.txt)

```ini
# Mémoire GPU pour vidéos
gpu_mem=256

# Désactiver overscan
disable_overscan=1

# Forcer sortie HDMI
hdmi_force_hotplug=1

# Accélération matérielle
dtoverlay=vc4-fkms-v3d
```

### Services systemd

```bash
# Démarrer les services
sudo systemctl start screensplash
sudo systemctl start screensplash-kiosk

# Voir les logs
journalctl -u screensplash -f

# Activer au démarrage
sudo systemctl enable screensplash screensplash-kiosk
```

## 🔌 API Endpoints

### Assets
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/assets` | Lister les assets |
| POST | `/api/assets/upload` | Upload fichier |
| POST | `/api/assets/url` | Créer asset URL |
| PUT | `/api/assets/<id>` | Modifier asset |
| DELETE | `/api/assets/<id>` | Supprimer asset |

### Playlists
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/playlists` | Lister les playlists |
| POST | `/api/playlists` | Créer playlist |
| POST | `/api/playlists/<id>/assets` | Ajouter asset |
| PUT | `/api/playlists/<id>/reorder` | Réordonner |

### System
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/system/status` | État système |
| GET | `/api/system/device` | Info appareil |
| GET | `/api/system/logs` | Journaux activité |

## 🛠️ Développement

### Backend (Flask)
```bash
cd backend
source venv/bin/activate
flask run --debug
```

### Frontend (React + Vite)
```bash
cd frontend
npm run dev
```

Le frontend sera accessible sur `http://localhost:5173` avec proxy vers le backend.

## 🚑 Dépannage (Écran Noir / HDMI)

Si l'écran de votre Raspberry Pi reste noir après l'installation, vérifiez ces 3 points :

1. **Redémarrage requis** : Le script configure un démarrage automatique (`autologin` + `.xinitrc`). Ce mode ne devient actif **qu'après un redémarrage**.
   ```bash
   sudo reboot
   ```
2. **Forcer le port HDMI si débranché** : Lors d'un démarrage sans écran branché, le Pi désactive le port. Le script d'installation configure `hdmi_force_hotplug=1`, mais si vous venez d'allumer l'écran, vous devrez redémarrer.
3. **Erreur d'Auto-Login** : Si vous vous retrouvez sur une invite de commande (console) vous demandant un login/mot de passe :
   - Tapez `sudo raspi-config`
   - Allez dans `1 System Options` > `S5 Boot / Auto Login` > Choisissez `B2 Console Autologin`.

## 📝 Licence

MIT License - Voir [LICENSE](LICENSE)

## 🤝 Contribution

Les contributions sont bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

---

*Développé avec ❤️ pour l'affichage dynamique sur Raspberry Pi*
