// js/modules/mqtt-manager.js
class MQTTManager {
    constructor() {
        this.client = null;
        this.isConnecting = false;
        this.connected = false;
        
        // Configuration MQTT
        this.config = {
            broker: 'wss://broker.emqx.io:8084/mqtt',
            topics: {
                discover: 'gay/1/discover',
                register: 'gay/1/register',
                command: 'gay/1/setScan',
                status: 'gay/1/status',
                data: 'gay/1'
            }
        };

        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onMessage: null,
            onError: null,
            onDeviceData: null,
            onDeviceRegistration: null
        };
    }

    // Initialisation MQTT
    init(userId) {
        if (this.isConnecting || this.connected) {
            console.log('⚠️ MQTT déjà en cours de connexion ou connecté');
            return false;
        }
        
        this.isConnecting = true;
        
        try {
            const clientId = `web-${userId || 'anon'}-${Math.random().toString(16).substr(2, 8)}`;
            
            console.log('🔄 Connexion MQTT pour ESP32 Radar...');
            
            this.client = mqtt.connect(this.config.broker, {
                clientId: clientId,
                clean: true,
                connectTimeout: 10000,
                reconnectPeriod: 2000,
                keepalive: 60
            });

            // Événements MQTT
            this.client.on('connect', () => this.handleConnect());
            this.client.on('message', (topic, message) => this.handleMessage(topic, message));
            this.client.on('error', (err) => this.handleError(err));
            this.client.on('offline', () => this.handleOffline());
            this.client.on('close', () => this.handleClose());

            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation MQTT:', error);
            this.isConnecting = false;
            this.callbacks.onError?.(error);
            return false;
        }
    }

    handleConnect() {
        console.log('✅ Connecté à MQTT - Prêt pour ESP32 Radar');
        this.isConnecting = false;
        this.connected = true;
        
        // S'abonner aux topics
        this.subscribeToTopics();
        
        // Notifier la connexion
        this.callbacks.onConnect?.();
    }

    handleMessage(topic, message) {
        try {
            const messageStr = message.toString();
            console.log(`📥 MQTT [${topic}]:`, messageStr);
            
            const data = JSON.parse(messageStr);
            
            // Distribuer le message selon le topic
            this.distributeMessage(topic, data);
            
        } catch (error) {
            console.error('❌ Erreur traitement message MQTT:', error);
        }
    }

    distributeMessage(topic, data) {
        // Données du radar
        if (topic === this.config.topics.data) {
            this.callbacks.onDeviceData?.(data);
            this.callbacks.onMessage?.(topic, data);
        }
        // Réponse à l'appairage
        else if (topic === this.config.topics.register) {
            this.callbacks.onDeviceRegistration?.(data);
            this.callbacks.onMessage?.(topic, data);
        }
        // Autres messages
        else {
            this.callbacks.onMessage?.(topic, data);
        }
    }

    handleError(err) {
        console.error('❌ Erreur MQTT:', err);
        this.isConnecting = false;
        this.connected = false;
        this.callbacks.onError?.(err);
    }

    handleOffline() {
        console.log('🔌 MQTT hors ligne');
        this.connected = false;
        this.callbacks.onDisconnect?.();
    }

    handleClose() {
        console.log('🔒 Connexion MQTT fermée');
        this.connected = false;
        this.callbacks.onDisconnect?.();
    }

    subscribeToTopics() {
        if (!this.client || !this.connected) return;
        this.client.subscribe(this.config.topics.data, (err) => {
            if (err) {
                console.error(`❌ Erreur abonnement ${this.config.topics.data}:`, err);
            } else {
                console.log(`✅ Abonné aux données: ${this.config.topics.data}`);
            }
        });
        
        this.client.subscribe(this.config.topics.register, (err) => {
            if (err) {
                console.error(`❌ Erreur abonnement ${this.config.topics.register}:`, err);
            } else {
                console.log(`✅ Abonné à l'appairage: ${this.config.topics.register}`);
            }
        });
    }

    publish(topic, message) {
        if (!this.client || !this.connected) {
            console.warn('⚠️ MQTT non connecté, message non envoyé');
            return false;
        }

        try {
            const messageStr = typeof message === 'object' ? JSON.stringify(message) : message;
            this.client.publish(topic, messageStr);
            console.log(`✅ Message publié sur ${topic}`);
            return true;
        } catch (error) {
            console.error('❌ Erreur publication MQTT:', error);
            return false;
        }
    }

    startPairingDiscovery(userId) {
        if (!this.connected) {
            console.warn('⚠️ MQTT non connecté, appairage impossible');
            return false;
        }

        const discoveryMessage = {
            action: 'discover',
            user: userId,
            timestamp: Date.now(),
            type: 'web_interface'
        };

        return this.publish(this.config.topics.discover, discoveryMessage);
    }

    sendControlCommand(startAngle, endAngle) {
        if (!this.connected) {
            console.warn('⚠️ MQTT non connecté, commande non envoyée');
            return false;
        }

        const command = `${startAngle}-${endAngle}`;
        return this.publish(this.config.topics.command, command);
    }

    isConnected() {
        return this.connected;
    }

    disconnect() {
        if (this.client) {
            this.client.end();
            this.client = null;
            this.connected = false;
            this.isConnecting = false;
            console.log('🔓 Déconnecté de MQTT');
        }
    }

    on(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        } else {
            console.warn(`⚠️ Événement MQTT inconnu: ${event}`);
        }
    }

    getTopics() {
        return this.config.topics;
    }

    reconnect(userId) {
        this.disconnect();
        setTimeout(() => {
            this.init(userId);
        }, 2000);
    }
}