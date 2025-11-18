class AuthManager {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('servo_users')) || [];
        this.currentUser = JSON.parse(localStorage.getItem('current_user')) || null;
        this.devices = JSON.parse(localStorage.getItem('user_devices')) || {};
        this.mqttClient = null;
        this.pairingPromise = null;
        this.isConnecting = false;
        
        // ✅ TOPICS POUR SON CODE ESP32
        this.topics = {
            discover: 'gay/1/discover',
            register: 'gay/1/register', 
            command: 'gay/1/setScan',  // 👈 SON TOPIC DE COMMANDE
            status: 'gay/1/status',
            data: 'gay/1'             // 👈 SON TOPIC DE DONNÉES
        };
        
        this.init();
    }

    init() {
        const currentPage = window.location.pathname.split('/').pop();
        
        if (this.currentUser && currentPage === 'index.html') {
            window.location.href = 'dashboard.html';
            return;
        }
        
        if (!this.currentUser && (currentPage === 'dashboard.html' || currentPage === 'profile.html' || currentPage === 'pairing.html')) {
            window.location.href = 'index.html';
            return;
        }
        
        this.setupAuthForms();
        
        if (this.currentUser && currentPage === 'dashboard.html') {
            this.initMQTT();
        }
    }

    // MODIFIÉ: Configuration MQTT pour SON code
    initMQTT() {
        if (this.isConnecting) return;
        
        this.isConnecting = true;
        
        try {
            const broker = 'wss://broker.emqx.io:8084/mqtt'; // Même broker que lui
            const clientId = 'web-' + (this.currentUser?.id || 'anon') + '-' + Math.random().toString(16).substr(2, 8);
            
            console.log('🔄 Connexion MQTT pour ESP32 Radar...');
            
            this.mqttClient = mqtt.connect(broker, {
                clientId: clientId,
                clean: true,
                connectTimeout: 10000,
                reconnectPeriod: 2000,
                keepalive: 60
            });

            this.mqttClient.on('connect', () => {
                console.log('✅ Connecté à MQTT - Prêt pour ESP32 Radar');
                this.isConnecting = false;
                this.showNotification('Connecté au radar ESP32', 'success');
                
                this.subscribeToTopics();
                if (typeof this.onMQTTConnected === 'function') {
                    this.onMQTTConnected();
                }
            });

            this.mqttClient.on('message', (topic, message) => {
                this.handleMQTTMessage(topic, message.toString());
            });

            this.mqttClient.on('error', (err) => {
                console.error('❌ Erreur MQTT:', err);
                this.isConnecting = false;
                this.showNotification('Erreur connexion MQTT', 'error');
            });

            this.mqttClient.on('offline', () => {
                console.log('🔌 Déconnecté de MQTT');
                this.showNotification('Déconnecté du radar', 'warning');
                if (typeof this.onMQTTDisconnected === 'function') {
                    this.onMQTTDisconnected();
                }
            });

        } catch (error) {
            console.error('❌ Erreur initialisation MQTT:', error);
            this.isConnecting = false;
            this.showNotification('Erreur de connexion MQTT', 'error');
        }
    }

    // MODIFIÉ: Abonnement aux topics de SON code
    subscribeToTopics() {
        // S'abonner aux données du radar (son topic principal)
        this.mqttClient.subscribe(this.topics.data, (err) => {
            if (!err) {
                console.log(`✅ Abonné aux données: ${this.topics.data}`);
            }
        });
        
        // S'abonner aux réponses d'appairage
        this.mqttClient.subscribe(this.topics.register, (err) => {
            if (!err) {
                console.log(`✅ Abonné à l'appairage: ${this.topics.register}`);
            }
        });
    }

    // MODIFIÉ: Gestion des messages pour SON code
    handleMQTTMessage(topic, message) {
        try {
            console.log(`📥 MQTT [${topic}]:`, message);
            const data = JSON.parse(message);
            
            // Données du radar (son topic principal)
            if (topic === this.topics.data) {
                this.handleRadarData(data);
            }
            // Réponse à l'appairage
            else if (topic === this.topics.register) {
                this.handleDeviceRegistration(data);
            }
            
        } catch (error) {
            console.error('❌ Erreur traitement message:', error);
        }
    }

    handleRadarData(data) {
        console.log('📡 Données radar:', data);
        
        // Ne transmettre les données QUE si un appareil est appairé
        if (this.getUserDevices().length > 0) {
            if (typeof this.onDeviceData === 'function') {
                this.onDeviceData(data);
            }
            
            // Logger dans l'interface seulement si appairé
            if (window.servoController && data.angle !== undefined && data.distance !== undefined) {
                window.servoController.log(`📡 Angle: ${data.angle}° | Distance: ${data.distance}cm`);
            }
        }
        // Si pas d'appareil appairé, juste logger dans la console
        else {
            console.log('📡 Données reçues (attente appairage):', data);
        }
    }

    // MODIFIÉ: Appairage pour SON code
    async startPairingProcess() {
        if (!this.currentUser) {
            this.showNotification('Veuillez vous connecter d\'abord', 'warning');
            return null;
        }

        if (!this.isMQTTConnected()) {
            this.showNotification('Connexion MQTT en cours...', 'info');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (!this.isMQTTConnected()) {
                this.showNotification('Impossible de se connecter à MQTT', 'error');
                return null;
            }
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.pairingPromise) {
                    this.pairingPromise.reject(new Error('Timeout de détection'));
                    this.pairingPromise = null;
                }
                this.showNotification('Aucun radar ESP32 détecté', 'warning');
                resolve(null);
            }, 15000);

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

            // Envoyer la demande de découverte
            const discoveryMessage = JSON.stringify({
                action: 'discover',
                user: this.currentUser.id,
                timestamp: Date.now(),
                type: 'web_interface'
            });

            this.publish(this.topics.discover, discoveryMessage);
            this.showNotification('Recherche du radar ESP32...', 'info');
        });
    }

    // MODIFIÉ: Publication MQTT
    publish(topic, message) {
        if (!this.isMQTTConnected()) {
            console.warn('MQTT non connecté, message non envoyé');
            return false;
        }

        try {
            this.mqttClient.publish(topic, message);
            console.log(`✅ Message publié sur ${topic}`);
            return true;
        } catch (error) {
            console.error('❌ Erreur publication:', error);
            return false;
        }
    }

    // MODIFIÉ: Contrôle du radar - ENVOYER LA PLAGE DE BALAYAGE
    controlRadar(startAngle, endAngle) {
        // SON code attend "start-end" comme "30-90"
        const command = `${startAngle}-${endAngle}`;
        
        const success = this.publish(this.topics.command, command);
        
        if (success && window.servoController) {
            window.servoController.log(`🎯 Plage balayage: ${startAngle}°-${endAngle}°`);
        }
        
        return success;
    }

    // MODIFIÉ: Lecture distance - DÉMARRER UN BALAYAGE RAPIDE
    readDistance() {
        // Envoyer une plage réduite pour une mesure rapide
        return this.controlRadar(90, 90); // Rester à 90° pour une mesure
    }

    // MODIFIÉ: Contrôle servo - CHANGER LA PLAGE DE BALAYAGE
    controlServo(startAngle, endAngle) {
        return this.controlRadar(startAngle, endAngle);
    }

    // Gestion de l'enregistrement d'appareil
    handleDeviceRegistration(deviceData) {
        if (this.pairingPromise) {
            const newDevice = {
                id: deviceData.deviceId || 'radar_001',
                name: `Radar-${(deviceData.deviceId || 'ESP32').substr(-4)}`,
                type: deviceData.type || 'ESP32_Radar_Servo',
                status: 'connected',
                lastSeen: new Date().toISOString(),
                ip: deviceData.ip || 'N/A',
                signal: Math.floor(Math.random() * 30) + 70,
                userId: this.currentUser.id
            };

            if (!this.devices[this.currentUser.id]) {
                this.devices[this.currentUser.id] = [];
            }

            const exists = this.devices[this.currentUser.id].find(d => d.id === newDevice.id);
            if (!exists) {
                this.devices[this.currentUser.id].push(newDevice);
                this.saveDevices();
                
                this.pairingPromise.resolve(newDevice);
                this.pairingPromise = null;
                
                this.showNotification('Radar ESP32 détecté!', 'success');
            }
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
        if (this.mqttClient && this.mqttClient.connected) {
            this.mqttClient.end();
        }
        
        this.currentUser = null;
        localStorage.removeItem('current_user');
        window.location.href = 'index.html';
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

    isMQTTConnected() {
        return this.mqttClient && this.mqttClient.connected;
    }

    reconnectMQTT() {
        if (!this.isConnecting) {
            this.showNotification('Reconnexion à gay/1...', 'info');
            this.initMQTT();
        }
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

    handleMQTTError(err) {
        console.error('❌ Erreur MQTT:', err);
        let errorMessage = 'Erreur de connexion MQTT';
        if (err.message.includes('WebSocket')) {
            errorMessage = 'Erreur réseau - Vérifiez votre connexion';
        }
        this.showNotification(errorMessage, 'error');
    }
}

const authManager = new AuthManager();

// FONCTIONS GLOBALES POUR LA NAVIGATION
function showRegister() {
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('registerCard').style.display = 'block';
}

function showLogin() {
    document.getElementById('registerCard').style.display = 'none';
    document.getElementById('loginCard').style.display = 'block';
}

function goToPairing() {
    if (authManager.currentUser) {
        window.location.href = 'pairing.html';
    } else {
        alert('Veuillez vous connecter d\'abord');
    }
}

function goToDashboard() {
    window.location.href = 'dashboard.html';
}