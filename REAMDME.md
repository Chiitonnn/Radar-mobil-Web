📡 PROJET RADAR IOT - ESP32 & WEB
🎯 OBJECTIF
Contrôler à distance un radar ultrasonique ESP32 via une interface web temps réel.

🛠️ MATÉRIEL
ESP32 avec servo-moteur et capteur ultrason HC-SR04

Broker MQTT public (broker.emqx.io)

Navigateur web (Chrome/Firefox)

📡 COMMUNICATION
text
ESP32 → [MQTT] → Interface Web
Topic: gay/1 (données radar)
Données envoyées :
json
{
  "angle": 45,
  "distance": 25.5,
  "mode": "scanning/tracking"
}
Commandes reçues :
text
"30-90" → Balayage de 30° à 90°
🌐 INTERFACE WEB
Fonctionnalités :
✅ Authentification utilisateur

🔗 Appairage automatique ESP32

🎮 Contrôle manuel 0-180°

📊 2 visualisations radar :

Longue portée (0-400cm)

Courte portée (0-50cm)

📝 Journal d'activité temps réel

📱 Design responsive mobile/desktop

⚙️ TECHNOLOGIES
Frontend :
HTML5 / CSS3 / JavaScript vanilla

Canvas API pour les graphiques

WebSockets via MQTT.js

LocalStorage pour la persistance

Backend (côté ESP32) :
Arduino Framework

WiFiManager pour le WiFi

PubSubClient pour MQTT

Servo library pour le contrôle

🚀 INSTALLATION
Flash l'ESP32 avec main.cpp

Ouvrir index.html dans un navigateur

Créer un compte ou se connecter

Appairer l'ESP32 via le dashboard

Contrôler le radar en temps réel

🎮 MODES DE FONCTIONNEMENT
1. Balayage automatique
Scan de 0° à 180°

Détection d'objets

Historique des points

2. Poursuite automatique
Si objet < 10cm → tracking

Maintien de l'angle

Retour au scan si objet perdu

3. Contrôle manuel
Plage personnalisable

Boutons prédéfinis (30-90°, 60-120°, etc.)

Validation en temps réel

📁 STRUCTURE DU PROJET
text
projet-iot/
├── index.html          # Page de connexion
├── dashboard.html      # Contrôle principal
├── style.css          # Styles communs
├── js/
│   ├── auth.js        # Authentification
│   ├── app.js         # Application principale
│   └── modules/       # Architecture modulaire
│       ├── radar-visualizer.js
│       ├── device-manager.js
│       └── ui-manager.js
└── ESP32/
    └── main.cpp       # Code microcontrôleur