class RadarVisualizer {
    constructor() {
        this.radarContext = null;
        this.shortRadarContext = null;
        this.detections = [];
    }

    initRadarVisualization() {
        const canvas = document.getElementById('radarCanvas');
        if (canvas) {
            canvas.width = 400;
            canvas.height = 300;
            this.radarContext = canvas.getContext('2d');
            console.log('✅ Canvas radar LONGUE PORTÉE initialisé');
            this.drawRadarBase(false);
        } else {
            console.log('❌ Canvas radar LONGUE PORTÉE non trouvé');
        }
    }

    initShortRadarVisualization() {
        const canvas = document.getElementById('shortRangeRadarCanvas');
        if (canvas) {
            canvas.width = 400;
            canvas.height = 300;
            this.shortRadarContext = canvas.getContext('2d');
            console.log('✅ Canvas radar COURTE PORTÉE initialisé');
            this.drawRadarBase(true);
        } else {
            console.log('❌ Canvas radar COURTE PORTÉE non trouvé');
        }
    }

    drawRadarBase(isShortRange) {
        const ctx = isShortRange ? this.shortRadarContext : this.radarContext;
        if (!ctx) return;
        
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const plotWidth = width - margin.left - margin.right;
        const plotHeight = height - margin.top - margin.bottom;
        
        const maxDist = isShortRange ? 50 : 400;
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
        for (let dist = 0; dist <= maxDist; dist += (isShortRange ? 10 : 100)) {
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
        ctx.fillText('Distance (mm)', 0, 0);
        ctx.restore();
    }

    updateRadarVisualization(angle, distance) {
        if (!this.radarContext) return;
        
        this.drawRadarBase(false);
        
        const ctx = this.radarContext;
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const plotWidth = ctx.canvas.width - margin.left - margin.right;
        const plotHeight = ctx.canvas.height - margin.top - margin.bottom;
        
        const maxDist = 400;
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

    updateShortRadarVisualization(angle, distance) {
        if (!this.shortRadarContext) return;
        
        this.drawRadarBase(true);
        
        const ctx = this.shortRadarContext;
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const plotWidth = ctx.canvas.width - margin.left - margin.right;
        const plotHeight = ctx.canvas.height - margin.top - margin.bottom;
        
        const maxDist = 50;
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
            
            if (y < margin.top || detection.distance <= 0 || detection.distance > maxDist) return; 

            const opacity = 1 - (index / this.detections.length);
            ctx.fillStyle = `rgba(255, 165, 0, ${opacity})`;
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
        
        return detection;
    }

    getRecentDetections(limit = 10) {
        return this.detections.slice(0, limit);
    }

    clearDetections() {
        this.detections = [];
        if (this.radarContext) this.drawRadarBase(false);
        if (this.shortRadarContext) this.drawRadarBase(true);
    }
}