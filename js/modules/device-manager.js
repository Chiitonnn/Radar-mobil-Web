// js/modules/device-manager.js
class DeviceManager {
    constructor() {
        this.selectedDevice = null;
        this.scanRange = { start: 0, end: 180 };
    }

    setScanRange(start, end) {
        if (start >= end) {
            throw new Error('L\'angle de début doit être inférieur à l angle de fin');
        }
        if (start < 0 || end > 180) {
            throw new Error('Les angles doivent être entre 0° et 180°');
        }
        this.scanRange = { start, end };
        return this.scanRange;
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
        this.scanRange = { start: 0, end: 180 };
        return this.scanRange;
    }

    selectDevice(deviceId) {
        if (!window.authManager) return null;
        
        const devices = window.authManager.getUserDevices();
        this.selectedDevice = devices.find(d => d.id === deviceId);
        return this.selectedDevice;
    }

    getSelectedDevice() {
        return this.selectedDevice;
    }

    loadUserDevices() {
        if (!window.authManager) return;
        
        const devices = window.authManager.getUserDevices();
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
}