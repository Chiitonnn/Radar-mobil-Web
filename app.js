class ServoController {
    constructor() {
        this.selectedDevice = null;
        this.autoSweepInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadUserDevices();
        this.updateUserInfo();
    }

    setupEventListeners() {
        const servoSlider = document.getElementById('servoSlider');
        if (servoSlider) {
            servoSlider.addEventListener('input', (e) => {
                const angle = parseInt(e.target.value);
                document.getElementById('servoValue').textContent = angle;
                this.sendServoCommand(angle);
            });
        }
    }

    updateUserInfo() {
        if (authManager.currentUser) {
            const userEmail = document.getElementById('userEmail');
            if (userEmail) {
                userEmail.textContent = authManager.currentUser.email;
            }
        }
    }

    loadUserDevices() {
        const devices = authManager.getUserDevices();
        const container = document.getElementById('devicesContainer');
        const noDevices = document.getElementById('noDevices');
        
        if (devices.length === 0) {
            noDevices.style.display = 'block';
            container.innerHTML = '';
            return;
        }
        
        noDevices.style.display = 'none';
        container.innerHTML = devices.map(device => `
            <div class="device-card" onclick="servoController.selectDevice('${device.id}')">
                <div class="device-icon">🤖</div>
                <div class="device-info">
                    <h3>${device.name}</h3>
                    <p>${device.type}</p>
                    <p class="device-status">Status: <span class="status-${device.status}">${device.status}</span></p>
                    <p class="device-ip">IP: ${device.ip}</p>
                </div>
                <div class="device-actions">
                    <button onclick="event.stopPropagation(); servoController.removeDevice('${device.id}')" class="btn btn-danger btn-small">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    selectDevice(deviceId) {
        const devices = authManager.getUserDevices();
        this.selectedDevice = devices.find(d => d.id === deviceId);
        
        if (this.selectedDevice) {
            document.getElementById('controlSection').style.display = 'block';
            this.log(`📱 Appareil sélectionné: ${this.selectedDevice.name}`);
        }
    }

    removeDevice(deviceId) {
        if (!confirm('Supprimer cet appareil ?')) return;
        
        const userDevices = authManager.getUserDevices();
        authManager.devices[authManager.currentUser.id] = userDevices.filter(d => d.id !== deviceId);
        authManager.saveDevices();
        this.loadUserDevices();
        
        if (this.selectedDevice?.id === deviceId) {
            this.selectedDevice = null;
            document.getElementById('controlSection').style.display = 'none';
        }
        
        this.log(`🗑️ Appareil supprimé`);
    }

    sendServoCommand(angle) {
        if (!this.selectedDevice) {
            this.showError('Veuillez sélectionner un appareil');
            return;
        }
        this.log(`🎯 Servo → ${angle}°`);
        console.log(`Commande envoyée à ${this.selectedDevice.name}: ${angle}°`);
    }

    setServoAngle(angle) {
        document.getElementById('servoValue').textContent = angle;
        document.getElementById('servoSlider').value = angle;
        this.sendServoCommand(angle);
    }

    startSweep() {
        if (!this.selectedDevice) {
            this.showError('Veuillez sélectionner un appareil');
            return;
        }

        let angle = 0;
        let direction = 1;

        this.autoSweepInterval = setInterval(() => {
            this.setServoAngle(angle);
            angle += direction * 30;
            if (angle >= 180) direction = -1;
            if (angle <= 0) direction = 1;
        }, 1000);

        this.log('🔄 Balayage automatique démarré');
    }

    stopSweep() {
        if (this.autoSweepInterval) {
            clearInterval(this.autoSweepInterval);
            this.autoSweepInterval = null;
            this.log('⏹️ Balayage arrêté');
        }
    }

    log(message) {
        const logs = document.getElementById('logs');
        const timestamp = new Date().toLocaleTimeString();
        logs.innerHTML += `[${timestamp}] ${message}<br>`;
        logs.scrollTop = logs.scrollHeight;
        
        const logsCount = document.getElementById('logsCount');
        if (logsCount) {
            logsCount.textContent = logs.children.length;
        }
    }

    showError(message) {
        this.log(`❌ ${message}`);
    }
}

let servoController;

if (window.location.pathname.includes('dashboard.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        servoController = new ServoController();
    });
}

function logout() {
    authManager.logout();
}

async function showPairingModal() {
    const modalHTML = `
        <div class="modal-overlay" id="pairingModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div class="modal-content" style="background: white; padding: 40px; border-radius: 15px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <h2 style="text-align: center; margin-bottom: 20px; color: #333;">🔗 Appairage ESP32</h2>
                
                <div id="pairingInstructions" class="pairing-instructions">
                    <div class="instruction-step" style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h3 style="margin-bottom: 15px; color: #667eea;">📋 Instructions</h3>
                        <ol style="margin-left: 20px; line-height: 1.8;">
                            <li>Redémarrez votre ESP32 (bouton RESET)</li>
                            <li>Connectez-vous au WiFi: <strong style="color: #667eea;">ESP32_Servo_Setup</strong></li>
                            <li>Configurez votre réseau WiFi dans le portail</li>
                            <li>Cliquez sur "Démarrer l'appairage" ci-dessous</li>
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
                        <h3 style="color: #333; margin-bottom: 10px;">🔎 Recherche en cours...</h3>
                        <p style="color: #666; margin-bottom: 20px;">Détection de l'ESP32 sur le réseau</p>
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
                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left;">
                    <p style="margin-bottom: 8px;"><strong>Nom:</strong> ${device.name}</p>
                    <p style="margin-bottom: 8px;"><strong>Type:</strong> ${device.type}</p>
                    <p style="margin-bottom: 8px;"><strong>IP:</strong> ${device.ip}</p>
                    <p><strong>Signal:</strong> ${device.signal}%</p>
                </div>
                <button onclick="completePairing()" class="btn btn-primary btn-large" style="width: 100%;">
                    🎉 Terminer
                </button>
            </div>
        `;
        
        if (servoController) {
            servoController.log(`✅ Nouvel appareil appairé: ${device.name}`);
        }
    } else {
        resultDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 60px; margin-bottom: 15px;">❌</div>
                <h3 style="color: #dc3545; margin-bottom: 10px;">Aucun appareil trouvé</h3>
                <p style="color: #666; margin-bottom: 20px;">
                    Aucun ESP32 n'a été détecté sur le réseau.<br>
                    Vérifiez que l'appareil est bien allumé et configuré.
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
    authManager.showNotification('Appareil ajouté avec succès !', 'success');
    hidePairingModal();
    if (typeof window.loadUserDevices === 'function') {
        window.loadUserDevices();
    }
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

function setServoAngle(angle) {
    if (servoController) {
        servoController.setServoAngle(angle);
    }
}

function startSweep() {
    if (servoController) {
        servoController.startSweep();
    }
}

function stopSweep() {
    if (servoController) {
        servoController.stopSweep();
    }
}

window.loadUserDevices = function() {
    if (servoController) {
        servoController.loadUserDevices();
    }
};