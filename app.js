class ServoController {
    constructor() {
        this.selectedDevice = null;
        this.currentAngle = 0;
        this.currentDistance = 0;
        this.scanRange = { start: 0, end: 180 };
        this.detections = []; // L'historique des points
        
        this.radarContext = null;
        this.shortRadarContext = null; // <-- AJOUTÉ: Contexte pour le 2e radar
        
        this.mqttConnected = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserDevices();
        this.updateUserInfo();
        this.setupMQTTHandlers();
        
        this.initRadarVisualization();
        this.initShortRadarVisualization(); // <-- AJOUTÉ: Initialisation du 2e radar
        
        if (authManager.currentUser && !authManager.mqttClient) {
            authManager.initMQTT();
        }
    }

    // --- INITIALISATION RADAR 1 (LONGUE PORTÉE) ---
    initRadarVisualization() {
        const canvas = document.getElementById('radarCanvas');
        if (canvas) {
            canvas.width = 400;
            canvas.height = 300;
            this.radarContext = canvas.getContext('2d');
            console.log('✅ Canvas radar LONGUE PORTÉE initialisé');
            this.drawRadarBase(); // Dessiner la base vide
        } else {
            console.log('❌ Canvas radar LONGUE PORTÉE non trouvé');
        }
    }

    // --- AJOUTÉ : INITIALISATION RADAR 2 (COURTE PORTÉE) ---
    initShortRadarVisualization() {
        const canvas = document.getElementById('shortRangeRadarCanvas');
        if (canvas) {
            canvas.width = 400;
            canvas.height = 300;
            this.shortRadarContext = canvas.getContext('2d');
            console.log('✅ Canvas radar COURTE PORTÉE initialisé');
            this.drawShortRadarBase(); // Dessiner sa propre base
        } else {
            console.log('❌ Canvas radar COURTE PORTÉE non trouvé');
        }
    }

    // --- DESSIN RADAR 1 (LONGUE PORTÉE) ---
    drawRadarBase() {
        if (!this.radarContext) return;
        
        const ctx = this.radarContext;
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        
        const maxDist = 400; // <-- Max 400cm
        const maxAngle = 180;
        
        ctx.fillStyle = '#0a1929';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#1e3a5c';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#4a90e2';
        ctx.font = '10px Arial';

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let angle = 0; angle <= maxAngle; angle += 45) {
            const x = margin.left + (angle / maxAngle) * plotWidth;
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, margin.top + plotHeight);
            ctx.stroke();
            ctx.fillText(angle + '°', x, margin.top + plotHeight + 5);
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let dist = 0; dist <= maxDist; dist += 100) { // <-- Grille tous les 100cm
            const y = margin.top + plotHeight - (dist / maxDist) * plotHeight;
            if (dist > 0) {
                ctx.beginPath();
                ctx.moveTo(margin.left, y);
                ctx.lineTo(margin.left + plotWidth, y);
                ctx.stroke();
            }
            ctx.fillText(dist, margin.left - 5, y);
        }

        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top + plotHeight);
        ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, margin.top + plotHeight);
        ctx.stroke();
        
        ctx.fillStyle = '#8892b0';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Angle (°)', margin.left + plotWidth / 2, height - 15);
        
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.translate(15, margin.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Distance (cm)', 0, 0);
        ctx.restore();
    }

    // --- AJOUTÉ : DESSIN RADAR 2 (COURTE PORTÉE) ---
    drawShortRadarBase() {
        if (!this.shortRadarContext) return;

        const ctx = this.shortRadarContext; // <-- Contexte 2
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        
        const maxDist = 50; // <-- Max 50cm
        const maxAngle = 180;
        
        ctx.fillStyle = '#0a1929';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#1e3a5c';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#4a90e2';
        ctx.font = '10px Arial';

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let angle = 0; angle <= maxAngle; angle += 45) {
            const x = margin.left + (angle / maxAngle) * plotWidth;
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, margin.top + plotHeight);
            ctx.stroke();
            ctx.fillText(angle + '°', x, margin.top + plotHeight + 5);
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let dist = 0; dist <= maxDist; dist += 10) { // <-- Grille tous les 10cm
            const y = margin.top + plotHeight - (dist / maxDist) * plotHeight;
            if (dist > 0) {
                ctx.beginPath();
                ctx.moveTo(margin.left, y);
                ctx.lineTo(margin.left + plotWidth, y);
                ctx.stroke();
            }
            ctx.fillText(dist, margin.left - 5, y);
        }

        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top + plotHeight);
        ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, margin.top + plotHeight);
        ctx.stroke();
        
        ctx.fillStyle = '#8892b0';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Angle (°)', margin.left + plotWidth / 2, height - 15);
        
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.translate(15, margin.top + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Distance (cm)', 0, 0);
        ctx.restore();
    }


    // --- MISE À JOUR VISUALISATION 1 (LONGUE PORTÉE) ---
    updateRadarVisualization(angle, distance) {
        if (!this.radarContext) return;
        
        // this.addDetection(angle, distance); <-- DÉPLACÉ vers handleRadarData
        
        this.drawRadarBase();
        
        const ctx = this.radarContext;
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const plotWidth = ctx.canvas.width - margin.left - margin.right;
        const plotHeight = ctx.canvas.height - margin.top - margin.bottom;
        
        const maxDist = 400; // <-- Max 400cm
        const maxAngle = 180;
        
        const mapX = (a) => margin.left + (a / maxAngle) * plotWidth;
        const mapY = (d) => margin.top + plotHeight - (Math.min(d, maxDist) / maxDist) * plotHeight;

        const sweepX = mapX(angle);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sweepX, margin.top);
        ctx.lineTo(sweepX, margin.top + plotHeight);
        ctx.stroke();
        
        this.detections.forEach((detection, index) => {
            const x = mapX(detection.angle);
            const y = mapY(detection.distance);
            if (y < margin.top || detection.distance <= 0) return; 
            const opacity = 1 - (index / this.detections.length);
            ctx.fillStyle = `rgba(255, 68, 68, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
            if (index === 0) {
                ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }

    // --- AJOUTÉ : MISE À JOUR VISUALISATION 2 (COURTE PORTÉE) ---
    updateShortRadarVisualization(angle, distance) {
        if (!this.shortRadarContext) return;
        
        this.drawShortRadarBase(); // <-- Dessine la base courte portée
        
        const ctx = this.shortRadarContext; // <-- Contexte 2
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const plotWidth = ctx.canvas.width - margin.left - margin.right;
        const plotHeight = ctx.canvas.height - margin.top - margin.bottom;
        
        const maxDist = 50; // <-- Max 50cm
        const maxAngle = 180;
        
        const mapX = (a) => margin.left + (a / maxAngle) * plotWidth;
        const mapY = (d) => margin.top + plotHeight - (Math.min(d, maxDist) / maxDist) * plotHeight;

        const sweepX = mapX(angle);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sweepX, margin.top);
        ctx.lineTo(sweepX, margin.top + plotHeight);
        ctx.stroke();
        
        this.detections.forEach((detection, index) => {
            const x = mapX(detection.angle);
            const y = mapY(detection.distance);
            
            // Ne dessine que les points DANS la plage 0-50cm
            if (y < margin.top || detection.distance <= 0 || detection.distance > maxDist) return; 

            const opacity = 1 - (index / this.detections.length);
            // Change la couleur pour le radar courte portée
            ctx.fillStyle = `rgba(255, 165, 0, ${opacity})`; // Orange
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fill();
            if (index === 0) {
                ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }

    // GESTION DES DÉTECTIONS (Inchangé)
    addDetection(angle, distance) {
        const detection = {
            angle: angle,
            distance: distance,
            timestamp: Date.now(),
            id: Date.now() + Math.random()
        };
        
        this.detections.unshift(detection);
        
        if (this.detections.length > 100) {
            this.detections = this.detections.slice(0, 100);
        }
        
        this.updateDetectionsList();
    }

    // (Inchangé)
    updateDetectionsList() {
        const container = document.getElementById('detectionsList');
        if (!container) return;
        
        if (this.detections.length === 0) {
            container.innerHTML = '<div class="no-detections">Aucune détection</div>';
            return;
        }
        
        const recentDetections = this.detections.slice(0, 10);
        
        container.innerHTML = recentDetections.map(detection => `
            <div class="detection-item">
                <div class="detection-angle">${detection.angle}°</div>
                <div class="detection-distance">${detection.distance.toFixed(1)}cm</div>
                <div class="detection-time">${new Date(detection.timestamp).toLocaleTimeString()}</div>
            </div>
        `).join('');
    }

    // CONTRÔLE DU RADAR (Inchangé)
    setScanRange(start, end) {
        if (!this.selectedDevice) {
            this.showError('Veuillez sélectionner un radar');
            return;
        }
        if (start >= end) {
            this.showError('L\'angle de début doit être inférieur à l angle de fin');
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
            this.showError('Erreur lors de l envoi de la commande');
        }
    }

    // (Inchangé)
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

    // (Inchangé)
    resetToFullRange() {
        this.setScanRange(0, 180);
        this.log('🔄 Retour au balayage complet 0-180°');
    }

    // GESTION DES DONNÉES (MODIFIÉ)
    handleRadarData(data) {
        // console.log('📡 Données radar reçues:', data); // Décommenter pour débugger
        
        if (!this.selectedDevice) {
            // console.log('📡 Données en attente de sélection'); // Décommenter pour débugger
            return;
        }

        if (data.angle !== undefined && data.distance !== undefined) {
            this.currentAngle = data.angle;
            this.currentDistance = data.distance;
            
            this.updateRadarDisplay(data);
            
            // --- MODIFIÉ ---
            // 1. Ajouter la détection à l'historique (une seule fois)
            this.addDetection(data.angle, data.distance);
            
            // 2. Mettre à jour les deux graphiques
            this.updateRadarVisualization(data.angle, data.distance);
            this.updateShortRadarVisualization(data.angle, data.distance);
            
            // this.log(`📡 ${data.angle}° | ${data.distance.toFixed(1)}cm`);
        }
    }

    // (Inchangé)
    updateRadarDisplay(data) {
        if (data.angle !== undefined) {
            this.currentAngle = data.angle;
            const angleElement = document.getElementById('currentAngle');
            if (angleElement) angleElement.textContent = data.angle + '°';
        }
        if (data.distance !== undefined) {
            this.currentDistance = data.distance;
            const distanceElement = document.getElementById('currentDistance');
            if (distanceElement) distanceElement.textContent = data.distance.toFixed(1) + 'cm';
        }
    }

    // INTERFACE (Inchangé)
    setupEventListeners() {
        const startInput = document.getElementById('startAngle');
        const endInput = document.getElementById('endAngle');
        if (startInput && endInput) {
            startInput.addEventListener('change', this.validateAngles.bind(this));
            endInput.addEventListener('change', this.validateAngles.bind(this));
        }
    }

    // (Inchangé)
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

    // HANDLERS MQTT (Inchangé)
    setupMQTTHandlers() {
        if (authManager) {
            authManager.onDeviceData = (data) => this.handleRadarData(data);
            authManager.onDeviceUpdate = () => this.loadUserDevices();
            authManager.onMQTTConnected = () => this.onMQTTConnected();
            authManager.onMQTTDisconnected = () => this.onMQTTDisconnected();
        }
    }

    // (Inchangé)
    onMQTTConnected() {
        this.mqttConnected = true;
        this.log('✅ Connecté au radar ESP32');
        this.updateConnectionStatus(true);
        this.loadUserDevices();
    }

    // (Inchangé)
    onMQTTDisconnected() {
        this.mqttConnected = false;
        this.log('🔌 Déconnecté du radar');
        this.updateConnectionStatus(false);
    }

    // (Inchangé)
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('mqttStatus');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connecté au radar' : 'Déconnecté';
            statusElement.className = connected ? 'status-connected' : 'status-disconnected';
        }
    }

    // GESTION APPAREILS (MODIFIÉ)
    selectDevice(deviceId) {
        const devices = authManager.getUserDevices();
        this.selectedDevice = devices.find(d => d.id === deviceId);
        
        if (this.selectedDevice) {
            document.getElementById('controlSection').style.display = 'block';
            document.getElementById('radarVizSection').style.display = 'block';
            
            // Réinitialiser les deux radars
            this.initRadarVisualization();
            this.initShortRadarVisualization(); // <-- AJOUTÉ
            
            this.log(`📱 Radar sélectionné: ${this.selectedDevice.name}`);
            this.log('✅ Réception des données activée');
            this.log('📡 Visualisation radar initialisée');
            this.updateRangeDisplay();
        }
    }

    // (Inchangé)
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
                    <div class.device-info">
                        <h3>${device.name}</h3>
                        <p>${device.type}</p>
                        <p class="device-status">Status: <span class="status-${device.status}">${device.status}</span></p>
                    </div>
                </div>
            `).join('');
        }
    }

    // COMMANDES SERVO (Inchangé)
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

    // LOGS (Inchangé)
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

    // (Inchangé)
    showError(message) {
        this.log(`❌ ${message}`);
    }

    // (Inchangé)
    updateUserInfo() {
        if (authManager.currentUser) {
            const userEmail = document.getElementById('userEmail');
            if (userEmail) {
                userEmail.textContent = authManager.currentUser.email;
            }
        }
    }

    // --- FONCTION DE TEST (MODIFIÉ) ---
    testRadarVisualization() {
        if (!this.radarContext || !this.shortRadarContext) {
            this.showError('Radars non initialisés');
            return;
        }
        
        this.log('🧪 Test de la visualisation rectangulaire...');
        
        let testAngle = 0;
        const testInterval = setInterval(() => {
            if (testAngle > 180) {
                clearInterval(testInterval);
                this.log('🧪 Test terminé.');
                setTimeout(() => {
                    this.detections = [];
                    this.drawRadarBase();
                    this.drawShortRadarBase(); // <-- AJOUTÉ
                }, 1000);
                return;
            }
            
            let testDist;
            if (testAngle > 30 && testAngle < 90) {
                testDist = 20 + Math.sin((testAngle - 30) * Math.PI / 60) * 25; // Objet proche (20-45cm)
            } else if (testAngle > 120 && testAngle < 150) {
                testDist = 150; // Objet lointain
            } else {
                testDist = 350;
            }
            
            // Mettre à jour les données (appellera les deux updates)
            this.handleRadarData({ angle: testAngle, distance: testDist });
            
            testAngle += 2;
        }, 50);
    }
}

// ===============================================
// FONCTIONS GLOBALES (MODIFIÉ)
// ===============================================

// (Inchangé)
function applyCustomRange() {
    const start = parseInt(document.getElementById('startAngle').value) || 0;
    const end = parseInt(document.getElementById('endAngle').value) || 180;
    if (servoController) {
        servoController.setScanRange(start, end);
    }
}

// (Inchangé)
function resetToFullRange() {
    if (servoController) {
        servoController.resetToFullRange();
        document.getElementById('startAngle').value = 0;
        document.getElementById('endAngle').value = 180;
    }
}

// (Inchangé)
function setScanZone(start, end) {
    if (servoController) {
        servoController.setScanRange(start, end);
        document.getElementById('startAngle').value = start;
        document.getElementById('endAngle').value = end;
    }
}

// (Inchangé)
function testRadar() {
    if (servoController) {
        servoController.testRadarVisualization();
    }
}

// (MODIFIÉ)
function resetRadar() {
    if (servoController) {
        servoController.detections = []; 
        servoController.initRadarVisualization();
        servoController.initShortRadarVisualization(); // <-- AJOUTÉ
        servoController.log('🔄 Radars réinitialisés');
    }
}

// (Inchangé)
function logout() {
    authManager.logout();
}

// (Inchangé)
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

// ===============================================
// FONCTIONS D'APPAIRAGE (Inchangées)
// ===============================================

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

// (Inchangé)
let pairingInterval = null;
let pairingStartTime = null;

// (Inchangé)
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

// (Inchangé)
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

// (Inchangé)
function cancelPairing() {
    if (pairingInterval) {
        clearInterval(pairingInterval);
    }
    authManager.showNotification('Appairage annulé', 'warning');
    hidePairingModal();
}

// (Inchangé)
function completePairing() {
    authManager.showNotification('Appareil ajouté sur gay/1 !', 'success');
    hidePairingModal();
    if (servoController) {
        servoController.loadUserDevices();
    }
}

// (Inchangé)
function retryPairing() {
    document.getElementById('pairingResult').style.display = 'none';
    document.getElementById('pairingInstructions').style.display = 'block';
}

// (Inchangé)
function hidePairingModal() {
    if (pairingInterval) {
        clearInterval(pairingInterval);
    }
    const modal = document.getElementById('pairingModal');
    if (modal) {
        modal.remove();
    }
}

// ===============================================
// Initialisation (Inchangé)
// ===============================================

let servoController;

if (window.location.pathname.includes('dashboard.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        servoController = new ServoController();
    });
}