class AuthManager {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('servo_users')) || [];
        this.currentUser = JSON.parse(localStorage.getItem('current_user')) || null;
        this.devices = JSON.parse(localStorage.getItem('user_devices')) || {};
        this.mqttClient = null; // Nouveau: client MQTT
        this.pairingPromise = null; // Pour gérer l'appairage
        this.init();
    }

    init() {
        if (this.currentUser && window.location.pathname.includes('index.html')) {
            window.location.href = 'dashboard.html';
        }
        if (!this.currentUser && window.location.pathname.includes('dashboard.html')) {
            window.location.href = 'index.html';
        }
        this.setupAuthForms();
        
        // Nouveau: Initialiser MQTT si sur le dashboard
        if (this.currentUser && window.location.pathname.includes('dashboard.html')) {
            this.initMQTT();
        }
    }

    setupAuthForms() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
        
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
    }

    // NOUVEAU: Initialisation MQTT
    initMQTT() {
        try {
            // Vérifier que MQTT est disponible
            if (typeof mqtt === 'undefined') {
                console.error('MQTT library not loaded');
                return;
            }

            // Configuration MQTT - broker public gratuit
            const broker = 'wss://broker.hivemq.com:8884/mqtt';
            const clientId = 'web-' + this.currentUser.id + '-' + Date.now();
            
            this.mqttClient = mqtt.connect(broker, {
                clientId: clientId,
                clean: true,
                connectTimeout: 4000,
                reconnectPeriod: 1000,
            });

            this.mqttClient.on('connect', () => {
                console.log('Connecté à MQTT');
                
                // S'abonner aux topics
                this.mqttClient.subscribe('iot2024/discover', (err) => {
                    if (!err) console.log('Abonné à iot2024/discover');
                });
                
                this.mqttClient.subscribe('iot2024/register', (err) => {
                    if (!err) console.log('Abonné à iot2024/register');
                });
                
                this.mqttClient.subscribe('iot2024/status', (err) => {
                    if (!err) console.log('Abonné à iot2024/status');
                });

                this.mqttClient.subscribe('iot2024/command', (err) => {
                    if (!err) console.log('Abonné à iot2024/command');
                });
            });

            this.mqttClient.on('message', (topic, message) => {
                this.handleMQTTMessage(topic, message.toString());
            });

            this.mqttClient.on('error', (err) => {
                console.error('Erreur MQTT:', err);
                this.showNotification('Erreur de connexion MQTT', 'error');
            });

            this.mqttClient.on('offline', () => {
                console.log('MQTT déconnecté');
                this.showNotification('Déconnecté de MQTT', 'warning');
            });

        } catch (error) {
            console.error('Erreur initialisation MQTT:', error);
        }
    }

    // NOUVEAU: Gestion des messages MQTT
    handleMQTTMessage(topic, message) {
        try {
            console.log('Message MQTT reçu:', topic, message);
            const data = JSON.parse(message);
            
            if (topic === 'iot2024/register') {
                // Un ESP32 répond à l'appairage
                this.handleDeviceRegistration(data);
            }
            
            if (topic === 'iot2024/status') {
                // Mise à jour de statut
                this.updateDeviceStatus(data);
            }
            
        } catch (error) {
            console.error('Erreur traitement message MQTT:', error);
        }
    }

    // NOUVEAU: Gestion de l'enregistrement d'un appareil
    handleDeviceRegistration(deviceData) {
        if (this.pairingPromise) {
            const newDevice = {
                id: deviceData.deviceId,
                name: `ESP32-${deviceData.deviceId.substr(-4)}`,
                type: deviceData.type || 'ESP32_Servo_Ultrason',
                status: 'connected',
                lastSeen: new Date().toISOString(),
                ip: deviceData.ip || 'N/A',
                signal: Math.floor(Math.random() * 30) + 70,
                userId: this.currentUser.id
            };

            if (!this.devices[this.currentUser.id]) {
                this.devices[this.currentUser.id] = [];
            }

            // Éviter les doublons
            const exists = this.devices[this.currentUser.id].find(d => d.id === newDevice.id);
            if (!exists) {
                this.devices[this.currentUser.id].push(newDevice);
                this.saveDevices();
                
                // Résoudre la promesse d'appairage
                this.pairingPromise.resolve(newDevice);
                this.pairingPromise = null;
                
                this.showNotification('Appareil appairé avec succès!', 'success');
            }
        }
    }

    handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            this.login(email, password);
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert(error.message);
        }
    }

    handleRegister() {
        const name = document.getElementById('name').value;
        const email = document.getElementById('newEmail').value;
        const password = document.getElementById('newPassword').value;
        
        try {
            this.register(name, email, password);
            alert('Compte créé avec succès !');
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert(error.message);
        }
    }

    register(name, email, password) {
        if (this.users.find(user => user.email === email)) {
            throw new Error('Un compte avec cet email existe déjà');
        }

        const newUser = {
            id: this.generateId(),
            name,
            email,
            password: btoa(password),
            createdAt: new Date().toISOString()
        };

        this.users.push(newUser);
        this.currentUser = newUser;
        this.saveUsers();
        localStorage.setItem('current_user', JSON.stringify(newUser));
        
        return newUser;
    }

    login(email, password) {
        const user = this.users.find(u => u.email === email && u.password === btoa(password));
        if (!user) {
            throw new Error('Email ou mot de passe incorrect');
        }

        this.currentUser = user;
        localStorage.setItem('current_user', JSON.stringify(user));
        return user;
    }

    logout() {
        // Déconnexion MQTT
        if (this.mqttClient && this.mqttClient.connected) {
            this.mqttClient.end();
        }
        
        this.currentUser = null;
        localStorage.removeItem('current_user');
        window.location.href = 'index.html';
    }

    // MODIFIÉ: Processus d'appairage avec MQTT
    async startPairingProcess() {
        if (!this.currentUser) {
            this.showNotification('Veuillez vous connecter d\'abord', 'warning');
            return null;
        }

        if (!this.mqttClient || !this.mqttClient.connected) {
            this.showNotification('Connexion MQTT non disponible', 'error');
            return null;
        }

        return new Promise((resolve, reject) => {
            // Timeout de 15 secondes
            const timeout = setTimeout(() => {
                if (this.pairingPromise) {
                    this.pairingPromise.reject(new Error('Timeout de détection'));
                    this.pairingPromise = null;
                }
                this.showNotification('Aucun appareil détecté', 'warning');
                resolve(null);
            }, 15000);

            // Stocker la référence pour résoudre plus tard
            this.pairingPromise = {
                resolve: (device) => {
                    clearTimeout(timeout);
                    resolve(device);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            };

            // Envoyer la demande de découverte via MQTT
            const discoveryMessage = JSON.stringify({
                action: 'discover',
                user: this.currentUser.id,
                timestamp: Date.now()
            });

            this.mqttClient.publish('iot2024/discover', discoveryMessage);
            this.showNotification('Recherche d\'appareils en cours...', 'info');
        });
    }

    // NOUVEAU: Mise à jour du statut d'un appareil
    updateDeviceStatus(statusData) {
        if (!this.devices[this.currentUser.id]) return;
        
        const deviceIndex = this.devices[this.currentUser.id].findIndex(
            device => device.id === statusData.deviceId
        );
        
        if (deviceIndex !== -1) {
            this.devices[this.currentUser.id][deviceIndex].status = statusData.status;
            this.devices[this.currentUser.id][deviceIndex].lastSeen = new Date().toISOString();
            this.saveDevices();
            
            // Mettre à jour l'interface si nécessaire
            if (typeof this.onDeviceUpdate === 'function') {
                this.onDeviceUpdate();
            }
        }
    }

    // NOUVEAU: Envoyer une commande à un appareil
    sendCommandToDevice(deviceId, command, value) {
        if (!this.mqttClient || !this.mqttClient.connected) {
            this.showNotification('Connexion MQTT non disponible', 'error');
            return;
        }

        const commandMessage = JSON.stringify({
            deviceId: deviceId,
            command: command,
            value: value,
            user: this.currentUser.id,
            timestamp: Date.now()
        });

        this.mqttClient.publish('iot2024/command', commandMessage);
        console.log('Commande envoyée:', command, value);
    }

    // NOUVEAU: Lire la distance ultrasonique
    readDistance(deviceId) {
        this.sendCommandToDevice(deviceId, 'read_distance', 0);
    }

    // NOUVEAU: Contrôler le servo
    controlServo(deviceId, angle) {
        this.sendCommandToDevice(deviceId, 'servo', angle);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            transform: translateX(400px);
            opacity: 0;
            transition: all 0.3s ease;
            border-left: 4px solid ${type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : type === 'error' ? '#dc3545' : '#667eea'};
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        }, 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    saveDevices() {
        localStorage.setItem('user_devices', JSON.stringify(this.devices));
    }

    saveUsers() {
        localStorage.setItem('servo_users', JSON.stringify(this.users));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getUserDevices() {
        if (!this.currentUser) return [];
        return this.devices[this.currentUser.id] || [];
    }

    // NOUVEAU: Vérifier si MQTT est connecté
    isMQTTConnected() {
        return this.mqttClient && this.mqttClient.connected;
    }

    // NOUVEAU: Déconnecter MQTT
    disconnectMQTT() {
        if (this.mqttClient) {
            this.mqttClient.end();
            this.mqttClient = null;
        }
    }
}

const authManager = new AuthManager();

function showRegister() {
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('registerCard').style.display = 'block';
}

function showLogin() {
    document.getElementById('registerCard').style.display = 'none';
    document.getElementById('loginCard').style.display = 'block';
}

// NOUVEAU: Fonctions globales pour le dashboard
function startDeviceDiscovery() {
    authManager.startPairingProcess().then(device => {
        if (device) {
            console.log('Appareil trouvé:', device);
            // L'interface sera mise à jour automatiquement via les events MQTT
        }
    });
}

function controlServo(deviceId, angle) {
    authManager.controlServo(deviceId, angle);
}

function readUltrasonic(deviceId) {
    authManager.readDistance(deviceId);
}