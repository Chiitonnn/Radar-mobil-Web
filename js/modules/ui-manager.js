class UIManager {
    constructor() {
        this.currentAngle = 0;
        this.currentDistance = 0;
    }

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

    clearLogs() {
        const logs = document.getElementById('logs');
        if (logs) {
            logs.innerHTML = '';
            const logsCount = document.getElementById('logsCount');
            if (logsCount) {
                logsCount.textContent = '0';
            }
        }
    }

    updateRadarDisplay(angle, distance) {
        if (angle !== undefined) {
            this.currentAngle = angle;
            const angleElement = document.getElementById('currentAngle');
            if (angleElement) angleElement.textContent = angle + '°';
        }
        if (distance !== undefined) {
            this.currentDistance = distance;
            const distanceElement = document.getElementById('currentDistance');
            if (distanceElement) distanceElement.textContent = distance.toFixed(1) + 'cm';
        }
    }

    updateDetectionsList(detections) {
        const container = document.getElementById('detectionsList');
        if (!container) return;
        
        if (detections.length === 0) {
            container.innerHTML = '<div class="no-detections">Aucune détection</div>';
            return;
        }
        
        container.innerHTML = detections.map(detection => `
            <div class="detection-item">
                <div class="detection-angle">${detection.angle}°</div>
                <div class="detection-distance">${detection.distance.toFixed(1)}cm</div>
                <div class="detection-time">${new Date(detection.timestamp).toLocaleTimeString()}</div>
            </div>
        `).join('');
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('mqttStatus');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connecté au radar' : 'Déconnecté';
            statusElement.className = connected ? 'status-connected' : 'status-disconnected';
        }
    }

    updateUserInfo() {
        if (window.authManager && window.authManager.currentUser) {
            const userEmail = document.getElementById('userEmail');
            if (userEmail) {
                userEmail.textContent = window.authManager.currentUser.email;
            }
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

    setupEventListeners() {
        const startInput = document.getElementById('startAngle');
        const endInput = document.getElementById('endAngle');
        if (startInput && endInput) {
            startInput.addEventListener('change', this.validateAngles.bind(this));
            endInput.addEventListener('change', this.validateAngles.bind(this));
        }
    }

    showError(message) {
        this.log(`❌ ${message}`);
    }

    // Méthode pour afficher des notifications (comme dans auth.js)
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
}