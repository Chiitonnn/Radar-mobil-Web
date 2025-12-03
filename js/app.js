let servoController = null;
let pairingInterval = null;
let pairingStartTime = null;

// ===============================================
// CLASSE SERVO CONTROLLER MODULAIRE
// ===============================================

class ServoController {
    constructor() {
        this.radarVisualizer = new RadarVisualizer();
        this.deviceManager = new DeviceManager();
        this.ui = new UIManager();
        this.mqttConnected = false;
        
        this.init();
    }

    init() {
        this.ui.setupEventListeners();
        this.deviceManager.loadUserDevices();
        this.ui.updateUserInfo();
        this.setupMQTTHandlers();
        
        // Initialiser les radars
        this.radarVisualizer.initRadarVisualization();
        this.radarVisualizer.initShortRadarVisualization();
        
        if (window.authManager && window.authManager.currentUser && !window.authManager.mqttClient) {
            window.authManager.initMQTT();
        }
    }

    setupMQTTHandlers() {
        if (window.authManager) {
            window.authManager.onDeviceData = (data) => this.handleRadarData(data);
            window.authManager.onDeviceUpdate = () => this.deviceManager.loadUserDevices();
            window.authManager.onMQTTConnected = () => this.onMQTTConnected();
            window.authManager.onMQTTDisconnected = () => this.onMQTTDisconnected();
        }
    }

    onMQTTConnected() {
        this.mqttConnected = true;
        this.ui.log('✅ Connecté au radar ESP32');
        this.ui.updateConnectionStatus(true);
        this.deviceManager.loadUserDevices();
    }

    onMQTTDisconnected() {
        this.mqttConnected = false;
        this.ui.log('🔌 Déconnecté du radar');
        this.ui.updateConnectionStatus(false);
    }

    handleRadarData(data) {
        const selectedDevice = this.deviceManager.getSelectedDevice();
        if (!selectedDevice) return;

        if (data.angle !== undefined && data.distance !== undefined) {
            this.ui.updateRadarDisplay(data.angle, data.distance);
            this.radarVisualizer.addDetection(data.angle, data.distance);
            this.radarVisualizer.updateRadarVisualization(data.angle, data.distance);
            this.radarVisualizer.updateShortRadarVisualization(data.angle, data.distance);
            this.ui.updateDetectionsList(this.radarVisualizer.getRecentDetections());
            this.ui.log(`📡 ${data.angle}° | ${data.distance.toFixed(1)}cm`);
        }
    }

    setScanRange(start, end) {
        const selectedDevice = this.deviceManager.getSelectedDevice();
        if (!selectedDevice) {
            this.ui.showError('Veuillez sélectionner un radar');
            return;
        }
        
        try {
            this.deviceManager.setScanRange(start, end);
            this.deviceManager.updateRangeDisplay();

            const success = window.authManager.controlServo(start, end);
            
            if (success) {
                this.ui.log(`🎯 Plage de balayage: ${start}°-${end}°`);
            } else {
                this.ui.showError('Erreur lors de l envoi de la commande');
            }
        } catch (error) {
            this.ui.showError(error.message);
        }
    }

    resetToFullRange() {
        this.deviceManager.resetToFullRange();
        this.setScanRange(0, 180);
        this.ui.log('🔄 Retour au balayage complet 0-180°');
    }

    selectDevice(deviceId) {
        const device = this.deviceManager.selectDevice(deviceId);
        
        if (device) {
            document.getElementById('controlSection').style.display = 'block';
            document.getElementById('radarVizSection').style.display = 'block';
            
            this.radarVisualizer.initRadarVisualization();
            this.radarVisualizer.initShortRadarVisualization();
            
            this.ui.log(`📱 Radar sélectionné: ${device.name}`);
            this.ui.log('✅ Réception des données activée');
            this.ui.log('📡 Visualisation radar initialisée');
            this.deviceManager.updateRangeDisplay();
        }
    }

    testRadarVisualization() {
        if (!this.radarVisualizer.radarContext || !this.radarVisualizer.shortRadarContext) {
            this.ui.showError('Radars non initialisés');
            return;
        }
        
        this.ui.log('🧪 Test de la visualisation rectangulaire...');
        
        let testAngle = 0;
        const testInterval = setInterval(() => {
            if (testAngle > 180) {
                clearInterval(testInterval);
                this.ui.log('🧪 Test terminé.');
                setTimeout(() => {
                    this.radarVisualizer.clearDetections();
                }, 1000);
                return;
            }
            
            let testDist;
            if (testAngle > 30 && testAngle < 90) {
                testDist = 20 + Math.sin((testAngle - 30) * Math.PI / 60) * 25;
            } else if (testAngle > 120 && testAngle < 150) {
                testDist = 150;
            } else {
                testDist = 350;
            }
            
            this.handleRadarData({ angle: testAngle, distance: testDist });
            
            testAngle += 2;
        }, 50);
    }
}

// ===============================================
// FONCTIONS GLOBALES POUR LE CONTRÔLE RADAR
// ===============================================

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
        servoController.radarVisualizer.clearDetections();
        servoController.ui.log('🔄 Radars réinitialisés');
    }
}

function clearLogs() {
    if (servoController) {
        servoController.ui.clearLogs();
    }
}


// ===============================================
// FONCTIONS D'APPAIRAGE 
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
            servoController.ui.log(`✅ Nouvel appareil appairé sur gay/1: ${device.name}`);
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
        servoController.deviceManager.loadUserDevices();
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

// ===============================================
// FONCTIONS GLOBALES DE NAVIGATION
// ===============================================

function logout() {
    if (window.authManager) {
        window.authManager.logout();
    }
}

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

// ===============================================
// INITIALISATION PRINCIPALE
// ===============================================

if (window.location.pathname.includes('dashboard.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        // Vérifier que les modules sont chargés
        if (typeof RadarVisualizer === 'undefined' || 
            typeof DeviceManager === 'undefined' || 
            typeof UIManager === 'undefined') {
            console.error('❌ Modules non chargés. Vérifiez l\'ordre des scripts.');
            return;
        }
        
        // Créer le contrôleur
        servoController = new ServoController();
        
        // Exposer globalement
        window.servoController = servoController;
    });
}

// Exposer toutes les fonctions globales
window.applyCustomRange = applyCustomRange;
window.resetToFullRange = resetToFullRange;
window.setScanZone = setScanZone;
window.testRadar = testRadar;
window.resetRadar = resetRadar;
window.clearLogs = clearLogs;
window.logout = logout;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.goToPairing = goToPairing;
window.showPairingModal = showPairingModal;
window.startPairingSearch = startPairingSearch;
window.showPairingResult = showPairingResult;
window.cancelPairing = cancelPairing;
window.completePairing = completePairing;
window.retryPairing = retryPairing;
window.hidePairingModal = hidePairingModal;

if (typeof authManager !== 'undefined' && !window.authManager) {
    window.authManager = authManager;
}