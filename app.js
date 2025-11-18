class ServoController {
    constructor() {
        this.selectedDevice = null;
        this.currentAngle = 0;
        this.currentDistance = 0;
        this.scanRange = { start: 0, end: 180 };
        this.detections = [];
        this.radarContext = null;
        this.mqttConnected = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserDevices();
        this.updateUserInfo();
        this.setupMQTTHandlers();
        this.initRadarVisualization();
        
        if (authManager.currentUser && !authManager.mqttClient) {
            authManager.initMQTT();
        }
    }

    // INITIALISATION RADAR - CORRIGÉE
    initRadarVisualization() {
        const canvas = document.getElementById('radarCanvas');
        if (canvas) {
            // Forcer les dimensions
            canvas.width = 400;
            canvas.height = 300; // Réduit la hauteur pour le demi-cercle
            this.radarContext = canvas.getContext('2d');
            console.log('✅ Canvas radar initialisé');
            this.drawRadarBase();
        } else {
            console.log('❌ Canvas radar non trouvé');
        }
    }

    // DESSIN RADAR - MODIFIÉ POUR DEMI-CERCLE
    drawRadarBase() {
        if (!this.radarContext) {
            console.log('❌ Contexte radar non disponible');
            return;
        }
        
        const ctx = this.radarContext;
        const centerX = 200;
        const centerY = 250; // Déplacé vers le bas pour le demi-cercle
        const radius = 180;
        
        // Effacer le canvas
        ctx.clearRect(0, 0, 400, 300);
        
        // Fond
        ctx.fillStyle = '#0a1929';
        ctx.fillRect(0, 0, 400, 300);
        
        // Cercles concentriques (demi-cercles seulement)
        ctx.strokeStyle = '#1e3a5c';
        ctx.lineWidth = 1;
        
        for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            // Dessiner seulement le demi-cercle supérieur (de 0° à 180°)
            ctx.arc(centerX, centerY, radius * i / 4, Math.PI, 2 * Math.PI);
            ctx.stroke();
        }
        
        // Lignes angulaires (demi-cercle seulement)
        ctx.strokeStyle = '#1e3a5c';
        for (let angle = 0; angle <= 180; angle += 30) {
            const rad = (angle - 180) * Math.PI / 180; // Ajusté pour le demi-cercle
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + radius * Math.cos(rad),
                centerY + radius * Math.sin(rad)
            );
            ctx.stroke();
        }
        
        // Indicateurs d'angle (adapté pour demi-cercle)
        ctx.fillStyle = '#4a90e2';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        [0, 45, 90, 135, 180].forEach(angle => {
            const rad = (angle - 180) * Math.PI / 180; // Même correction
            const x = centerX + (radius + 20) * Math.cos(rad);
            const y = centerY + (radius + 20) * Math.sin(rad);
            ctx.fillText(angle + '°', x, y);
        });
        
        // Ligne de base du demi-cercle
        ctx.strokeStyle = '#1e3a5c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - radius, centerY);
        ctx.lineTo(centerX + radius, centerY);
        ctx.stroke();
        
        // Point central
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    // MISE À JOUR VISUALISATION RADAR - MODIFIÉE POUR DEMI-CERCLE
    updateRadarVisualization(angle, distance) {
        if (!this.radarContext) {
            console.log('❌ Contexte radar non disponible');
            return;
        }
        
        if (distance <= 0) {
            this.drawRadarBase(); // Redessiner seulement la base
            return;
        }
        
        // Redessiner la base d'abord
        this.drawRadarBase();
        
        const ctx = this.radarContext;
        const centerX = 200;
        const centerY = 250; // Même centre que drawRadarBase
        const maxRadius = 180;
        
        // Conversion angle pour le demi-cercle (0-180° vers demi-cercle supérieur)
        const radarAngle = (angle - 180) * Math.PI / 180; // Conversion pour demi-cercle
        const normalizedDistance = Math.min(distance / 400, 1);
        const pointRadius = maxRadius * normalizedDistance;
        
        // Position du point détecté
        const pointX = centerX + pointRadius * Math.cos(radarAngle);
        const pointY = centerY + pointRadius * Math.sin(radarAngle);
        
        // Ligne de balayage (seulement si dans le demi-cercle)
        if (angle >= 0 && angle <= 180) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(pointX, pointY);
            ctx.stroke();
            
            // Point de détection
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(pointX, pointY, 5, 0, 2 * Math.PI);
            ctx.fill();
            
            // Lueur
            ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
            ctx.beginPath();
            ctx.arc(pointX, pointY, 8, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        // Ajouter à l'historique
        this.addDetection(angle, distance);
    }

    // GESTION DES DÉTECTIONS
    addDetection(angle, distance) {
        const detection = {
            angle: angle,
            distance: distance,
            timestamp: Date.now(),
            id: Date.now() + Math.random()
        };
        
        this.detections.unshift(detection);
        
        // Garder seulement les 10 dernières détections
        if (this.detections.length > 10) {
            this.detections = this.detections.slice(0, 10);
        }
        
        this.updateDetectionsList();
    }

    updateDetectionsList() {
        const container = document.getElementById('detectionsList');
        if (!container) return;
        
        if (this.detections.length === 0) {
            container.innerHTML = '<div class="no-detections">Aucune détection</div>';
            return;
        }
        
        container.innerHTML = this.detections.map(detection => `
            <div class="detection-item">
                <div class="detection-angle">${detection.angle}°</div>
                <div class="detection-distance">${detection.distance.toFixed(1)}cm</div>
                <div class="detection-time">${new Date(detection.timestamp).toLocaleTimeString()}</div>
            </div>
        `).join('');
    }

    // CONTRÔLE DU RADAR
    setScanRange(start, end) {
        if (!this.selectedDevice) {
            this.showError('Veuillez sélectionner un radar');
            return;
        }

        if (start >= end) {
            this.showError('L\'angle de début doit être inférieur à l\'angle de fin');
            return;
        }

        if (start < 0 || end > 180) {
            this.showError('Les angles doivent être entre 0° et 180°');
            return;
        }

        this.scanRange = { start, end };
        
        const success = authManager.controlServo(start, end);
        
        if (success) {
            this.updateRangeDisplay();
            this.log(`🎯 Plage de balayage: ${start}°-${end}°`);
        } else {
            this.showError('Erreur lors de l\'envoi de la commande');
        }
    }

    updateRangeDisplay() {
        const rangeElement = document.getElementById('currentRange');
        const modeElement = document.getElementById('scanMode');
        
        if (rangeElement) {
            rangeElement.textContent = `${this.scanRange.start}° - ${this.scanRange.end}°`;
        }
        
        if (modeElement) {
            modeElement.textContent = this.scanRange.start === 0 && this.scanRange.end === 180 ? 
                'Balayage complet' : 'Plage personnalisée';
        }
    }

    resetToFullRange() {
        this.setScanRange(0, 180);
        this.log('🔄 Retour au balayage complet 0-180°');
    }

    // GESTION DES DONNÉES
    handleRadarData(data) {
        console.log('📡 Données radar reçues:', data);
        
        if (!this.selectedDevice) {
            console.log('📡 Données en attente de sélection');
            return;
        }

        if (data.angle !== undefined && data.distance !== undefined) {
            this.currentAngle = data.angle;
            this.currentDistance = data.distance;
            
            this.updateRadarDisplay(data);
            this.updateRadarVisualization(data.angle, data.distance);
            
            this.log(`📡 ${data.angle}° | ${data.distance.toFixed(1)}cm`);
        }
    }

    updateRadarDisplay(data) {
        // Mettre à jour l'angle
        if (data.angle !== undefined) {
            this.currentAngle = data.angle;
            const angleElement = document.getElementById('currentAngle');
            if (angleElement) angleElement.textContent = data.angle + '°';
        }
        
        // Mettre à jour la distance
        if (data.distance !== undefined) {
            this.currentDistance = data.distance;
            const distanceElement = document.getElementById('currentDistance');
            if (distanceElement) distanceElement.textContent = data.distance.toFixed(1) + 'cm';
        }
    }

    // INTERFACE
    setupEventListeners() {
        // Validation des angles
        const startInput = document.getElementById('startAngle');
        const endInput = document.getElementById('endAngle');
        
        if (startInput && endInput) {
            startInput.addEventListener('change', this.validateAngles.bind(this));
            endInput.addEventListener('change', this.validateAngles.bind(this));
        }
    }

    validateAngles() {
        const start = parseInt(document.getElementById('startAngle').value) || 0;
        const end = parseInt(document.getElementById('endAngle').value) || 180;
        
        if (start >= end) {
            document.getElementById('startAngle').classList.add('error');
            document.getElementById('endAngle').classList.add('error');
        } else {
            document.getElementById('startAngle').classList.remove('error');
            document.getElementById('endAngle').classList.remove('error');
        }
    }

    // HANDLERS MQTT
    setupMQTTHandlers() {
        if (authManager) {
            authManager.onDeviceData = (data) => this.handleRadarData(data);
            authManager.onDeviceUpdate = () => this.loadUserDevices();
            authManager.onMQTTConnected = () => this.onMQTTConnected();
            authManager.onMQTTDisconnected = () => this.onMQTTDisconnected();
        }
    }

    onMQTTConnected() {
        this.mqttConnected = true;
        this.log('✅ Connecté au radar ESP32');
        this.updateConnectionStatus(true);
        this.loadUserDevices();
    }

    onMQTTDisconnected() {
        this.mqttConnected = false;
        this.log('🔌 Déconnecté du radar');
        this.updateConnectionStatus(false);
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('mqttStatus');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connecté au radar' : 'Déconnecté';
            statusElement.className = connected ? 'status-connected' : 'status-disconnected';
        }
    }

    // GESTION APPAREILS
    selectDevice(deviceId) {
        const devices = authManager.getUserDevices();
        this.selectedDevice = devices.find(d => d.id === deviceId);
        
        if (this.selectedDevice) {
            // Afficher les sections
            document.getElementById('controlSection').style.display = 'block';
            document.getElementById('radarVizSection').style.display = 'block';
            
            // Réinitialiser le radar
            this.initRadarVisualization();
            
            this.log(`📱 Radar sélectionné: ${this.selectedDevice.name}`);
            this.log('✅ Réception des données activée');
            this.log('📡 Visualisation radar initialisée');
            this.updateRangeDisplay();
        }
    }

    loadUserDevices() {
        const devices = authManager.getUserDevices();
        const container = document.getElementById('devicesContainer');
        const noDevices = document.getElementById('noDevices');
        
        if (!container) return;
        
        if (devices.length === 0) {
            if (noDevices) noDevices.style.display = 'block';
            container.innerHTML = '';
        } else {
            if (noDevices) noDevices.style.display = 'none';
            container.innerHTML = devices.map(device => `
                <div class="device-card" onclick="servoController.selectDevice('${device.id}')">
                    <div class="device-icon">📡</div>
                    <div class="device-info">
                        <h3>${device.name}</h3>
                        <p>${device.type}</p>
                        <p class="device-status">Status: <span class="status-${device.status}">${device.status}</span></p>
                    </div>
                </div>
            `).join('');
        }
    }

    // COMMANDES SERVO
    sendServoCommand(startAngle, endAngle) {
        if (!this.selectedDevice) {
            this.showError('Veuillez sélectionner un radar');
            return;
        }

        if (!authManager.isMQTTConnected()) {
            this.showError('Déconnecté du radar');
            return;
        }

        startAngle = Math.max(0, startAngle);
        endAngle = Math.min(180, endAngle);
        
        const success = authManager.controlServo(startAngle, endAngle);
        
        if (success) {
            this.log(`🎯 Plage balayage: ${startAngle}°-${endAngle}°`);
        } else {
            this.showError('Erreur envoi commande');
        }
    }

    // LOGS
    log(message) {
        const logs = document.getElementById('logs');
        if (!logs) return;
        
        const timestamp = new Date().toLocaleTimeString();
        logs.innerHTML += `[${timestamp}] ${message}<br>`;
        logs.scrollTop = logs.scrollHeight;
        
        const logsCount = document.getElementById('logsCount');
        if (logsCount) {
            logsCount.textContent = (logs.children.length || 0);
        }
    }

    showError(message) {
        this.log(`❌ ${message}`);
    }

    updateUserInfo() {
        if (authManager.currentUser) {
            const userEmail = document.getElementById('userEmail');
            if (userEmail) {
                userEmail.textContent = authManager.currentUser.email;
            }
        }
    }

    // FONCTION DE TEST
    testRadarVisualization() {
        if (!this.radarContext) {
            this.showError('Radar non initialisé');
            return;
        }
        
        this.log('🧪 Test de la visualisation radar...');
        
        // Simuler des détections de test
        const testDetections = [
            { angle: 45, distance: 100 },
            { angle: 90, distance: 200 },
            { angle: 135, distance: 150 },
            { angle: 180, distance: 50 }
        ];
        
        testDetections.forEach((detection, index) => {
            setTimeout(() => {
                this.updateRadarVisualization(detection.angle, detection.distance);
                this.log(`🧪 Test: ${detection.angle}° | ${detection.distance}cm`);
            }, index * 1000);
        });
    }
}

// FONCTIONS GLOBALES POUR LE CONTRÔLE
function applyCustomRange() {
    const start = parseInt(document.getElementById('startAngle').value) || 0;
    const end = parseInt(document.getElementById('endAngle').value) || 180;
    
    if (servoController) {
        servoController.setScanRange(start, end);
    }
}

function resetToFullRange() {
    if (servoController) {
        servoController.resetToFullRange();
        document.getElementById('startAngle').value = 0;
        document.getElementById('endAngle').value = 180;
    }
}

function setScanZone(start, end) {
    if (servoController) {
        servoController.setScanRange(start, end);
        document.getElementById('startAngle').value = start;
        document.getElementById('endAngle').value = end;
    }
}

function testRadar() {
    if (servoController) {
        servoController.testRadarVisualization();
    }
}

function resetRadar() {
    if (servoController) {
        servoController.initRadarVisualization();
        servoController.log('🔄 Radar réinitialisé');
    }
}

function logout() {
    authManager.logout();
}

function clearLogs() {
    const logs = document.getElementById('logs');
    if (logs) {
        logs.innerHTML = '';
        const logsCount = document.getElementById('logsCount');
        if (logsCount) {
            logsCount.textContent = '0';
        }
    }
}

// FONCTIONS D'APPAIRAGE COMPLÈTES
async function showPairingModal() {
    const modalHTML = `
        <div class="modal-overlay" id="pairingModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div class="modal-content" style="background: white; padding: 40px; border-radius: 15px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <h2 style="text-align: center; margin-bottom: 20px; color: #333;">🔗 Appairage ESP32</h2>
                <p style="text-align: center; color: #666; margin-bottom: 20px;">Canal: <strong>gay/1</strong></p>
                
                <div id="pairingInstructions" class="pairing-instructions">
                    <div class="instruction-step" style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h3 style="margin-bottom: 15px; color: #667eea;">📋 Instructions</h3>
                        <ol style="margin-left: 20px; line-height: 1.8;">
                            <li>ESP32 configuré sur le topic <strong>gay/1</strong></li>
                            <li>Connecté au broker MQTT public</li>
                            <li>Cliquez sur "Démarrer l'appairage"</li>
                        </ol>
                    </div>
                    
                    <div class="modal-actions" style="display: flex; gap: 10px; justify-content: center;">
                        <button onclick="startPairingSearch()" class="btn btn-success" style="flex: 1;">
                            🔍 Démarrer l'appairage
                        </button>
                        <button onclick="hidePairingModal()" class="btn btn-secondary">
                            Annuler
                        </button>
                    </div>
                </div>

                <div id="pairingProgress" style="display: none;">
                    <div style="text-align: center; padding: 20px;">
                        <div class="spinner" style="
                            width: 60px;
                            height: 60px;
                            border: 6px solid #f3f3f3;
                            border-top: 6px solid #667eea;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 20px;
                        "></div>
                        <h3 style="color: #333; margin-bottom: 10px;">🔎 Recherche sur gay/1...</h3>
                        <p style="color: #666; margin-bottom: 20px;">Détection d'ESP32 sur le canal gay/1</p>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span style="color: #666;">Progression</span>
                                <span id="progressTime" style="color: #667eea; font-weight: bold;">0s / 15s</span>
                            </div>
                            <div style="width: 100%; height: 8px; background: #e1e5e9; border-radius: 4px; overflow: hidden;">
                                <div id="progressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s;"></div>
                            </div>
                        </div>
                        <button onclick="cancelPairing()" class="btn btn-danger btn-small">
                            ⏹️ Annuler
                        </button>
                    </div>
                </div>

                <div id="pairingResult" style="display: none;"></div>
            </div>
        </div>
        
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

let pairingInterval = null;
let pairingStartTime = null;

async function startPairingSearch() {
    document.getElementById('pairingInstructions').style.display = 'none';
    document.getElementById('pairingProgress').style.display = 'block';
    
    pairingStartTime = Date.now();
    
    pairingInterval = setInterval(() => {
        const elapsed = (Date.now() - pairingStartTime) / 1000;
        const progress = Math.min((elapsed / 15) * 100, 100);
        
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressTime').textContent = Math.floor(elapsed) + 's / 15s';
    }, 100);
    
    const device = await authManager.startPairingProcess();
    
    clearInterval(pairingInterval);
    
    showPairingResult(device);
}

function showPairingResult(device) {
    document.getElementById('pairingProgress').style.display = 'none';
    const resultDiv = document.getElementById('pairingResult');
    resultDiv.style.display = 'block';
    
    if (device) {
        resultDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 60px; margin-bottom: 15px;">✅</div>
                <h3 style="color: #28a745; margin-bottom: 10px;">Appairage réussi !</h3>
                <p style="color: #666; margin-bottom: 15px;">Canal: <strong>gay/1</strong></p>
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left;">
                    <p style="margin-bottom: 8px;"><strong>Nom:</strong> ${device.name}</p>
                    <p style="margin-bottom: 8px;"><strong>Type:</strong> ${device.type}</p>
                    <p style="margin-bottom: 8px;"><strong>Canal:</strong> gay/1</p>
                    <p><strong>Signal:</strong> ${device.signal}%</p>
                </div>
                <button onclick="completePairing()" class="btn btn-primary btn-large" style="width: 100%;">
                    🎉 Terminer
                </button>
            </div>
        `;
        
        if (servoController) {
            servoController.log(`✅ Nouvel appareil appairé sur gay/1: ${device.name}`);
        }
    } else {
        resultDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 60px; margin-bottom: 15px;">❌</div>
                <h3 style="color: #dc3545; margin-bottom: 10px;">Aucun appareil trouvé</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    Aucun ESP32 configuré sur <strong>gay/1</strong> n'a été détecté.
                </p>
                <div style="display: flex; gap: 10px;">
                    <button onclick="retryPairing()" class="btn btn-primary" style="flex: 1;">
                        🔄 Réessayer
                    </button>
                    <button onclick="hidePairingModal()" class="btn btn-secondary">
                        Fermer
                    </button>
                </div>
            </div>
        `;
    }
}

function cancelPairing() {
    if (pairingInterval) {
        clearInterval(pairingInterval);
    }
    authManager.showNotification('Appairage annulé', 'warning');
    hidePairingModal();
}

function completePairing() {
    authManager.showNotification('Appareil ajouté sur gay/1 !', 'success');
    hidePairingModal();
    if (servoController) {
        servoController.loadUserDevices();
    }
}

function retryPairing() {
    document.getElementById('pairingResult').style.display = 'none';
    document.getElementById('pairingInstructions').style.display = 'block';
}

function hidePairingModal() {
    if (pairingInterval) {
        clearInterval(pairingInterval);
    }
    const modal = document.getElementById('pairingModal');
    if (modal) {
        modal.remove();
    }
}

// Initialisation
let servoController;

if (window.location.pathname.includes('dashboard.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        servoController = new ServoController();
    });
}