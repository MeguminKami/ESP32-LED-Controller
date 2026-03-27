// ===========================
// Global State
// ===========================
const state = {
    currentMode: 'solid',
    isConnected: false,
    isPowerOn: false,
    previewPlaying: true,
    ledCount: 150,
    animationFrame: 0,
    presets: []
};

// ===========================
// LED Canvas Preview
// ===========================
class LEDPreview {
    constructor(canvasId, ledCount) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.ledCount = ledCount;
        this.leds = new Array(ledCount).fill({ r: 0, g: 0, b: 0 });
        this.animationId = null;
        this.time = 0;

        this.setupCanvas();
        this.animate();
    }

    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.ledWidth = (rect.width - 40) / this.ledCount;
        this.ledHeight = rect.height - 40;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return {
            r: Math.round(255 * f(0)),
            g: Math.round(255 * f(8)),
            b: Math.round(255 * f(4))
        };
    }

    updatePreview(mode) {
        if (!state.previewPlaying) return;

        switch (mode) {
            case 'solid':
                this.updateSolid();
                break;
            case 'rainbow':
                this.updateRainbow();
                break;
            case 'wave':
                this.updateWave();
                break;
            case 'fade':
                this.updateFade();
                break;
            case 'strobe':
                this.updateStrobe();
                break;
            case 'chase':
                this.updateChase();
                break;
            default:
                this.updateSolid();
        }
    }

    updateSolid() {
        const color = this.hexToRgb(document.getElementById('solid-color').value);
        const brightness = parseInt(document.getElementById('solid-brightness').value) / 100;

        for (let i = 0; i < this.ledCount; i++) {
            this.leds[i] = {
                r: color.r * brightness,
                g: color.g * brightness,
                b: color.b * brightness
            };
        }
    }

    updateRainbow() {
        const speed = parseInt(document.getElementById('rainbow-speed').value);
        const brightness = parseInt(document.getElementById('rainbow-brightness').value) / 100;
        const saturation = parseInt(document.getElementById('rainbow-saturation').value);

        for (let i = 0; i < this.ledCount; i++) {
            const hue = ((i * 360 / this.ledCount) + this.time * speed * 0.05) % 360;
            const color = this.hslToRgb(hue, saturation, 50);
            this.leds[i] = {
                r: color.r * brightness,
                g: color.g * brightness,
                b: color.b * brightness
            };
        }
    }

    updateWave() {
        const color1 = this.hexToRgb(document.getElementById('wave-color1').value);
        const color2 = this.hexToRgb(document.getElementById('wave-color2').value);
        const speed = parseInt(document.getElementById('wave-speed').value);
        const waveLength = parseInt(document.getElementById('wave-length').value);

        for (let i = 0; i < this.ledCount; i++) {
            const wave = (Math.sin((i / waveLength + this.time * speed * 0.001) * Math.PI * 2) + 1) / 2;
            this.leds[i] = {
                r: color1.r * (1 - wave) + color2.r * wave,
                g: color1.g * (1 - wave) + color2.g * wave,
                b: color1.b * (1 - wave) + color2.b * wave
            };
        }
    }

    updateFade() {
        const color1 = this.hexToRgb(document.getElementById('fade-color1').value);
        const color2 = this.hexToRgb(document.getElementById('fade-color2').value);
        const speed = parseInt(document.getElementById('fade-speed').value);

        const fade = (Math.sin(this.time * speed * 0.001) + 1) / 2;

        for (let i = 0; i < this.ledCount; i++) {
            this.leds[i] = {
                r: color1.r * (1 - fade) + color2.r * fade,
                g: color1.g * (1 - fade) + color2.g * fade,
                b: color1.b * (1 - fade) + color2.b * fade
            };
        }
    }

    updateStrobe() {
        const color = this.hexToRgb(document.getElementById('strobe-color').value);
        const speed = parseInt(document.getElementById('strobe-speed').value);
        const intensity = parseInt(document.getElementById('strobe-intensity').value) / 100;

        const on = Math.floor(this.time * speed * 0.01) % 2 === 0;

        for (let i = 0; i < this.ledCount; i++) {
            this.leds[i] = on ? {
                r: color.r * intensity,
                g: color.g * intensity,
                b: color.b * intensity
            } : { r: 0, g: 0, b: 0 };
        }
    }

    updateChase() {
        const color = this.hexToRgb(document.getElementById('chase-color').value);
        const speed = parseInt(document.getElementById('chase-speed').value);
        const spacing = parseInt(document.getElementById('chase-spacing').value);
        const reverse = document.getElementById('chase-direction').checked;

        const offset = Math.floor(this.time * speed * 0.01) % spacing;

        for (let i = 0; i < this.ledCount; i++) {
            const pos = reverse ? this.ledCount - i - 1 : i;
            const on = (pos + offset) % spacing === 0;
            this.leds[i] = on ? color : { r: 0, g: 0, b: 0 };
        }
    }

    draw() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);

        const ledSize = Math.min(this.ledWidth * 0.8, 8);
        const spacing = this.ledWidth;
        const y = rect.height / 2;

        for (let i = 0; i < this.ledCount; i++) {
            const x = 20 + i * spacing;
            const led = this.leds[i];

            // LED glow
            const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, ledSize * 2);
            gradient.addColorStop(0, `rgba(${led.r}, ${led.g}, ${led.b}, 0.8)`);
            gradient.addColorStop(0.5, `rgba(${led.r}, ${led.g}, ${led.b}, 0.3)`);
            gradient.addColorStop(1, `rgba(${led.r}, ${led.g}, ${led.b}, 0)`);

            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x - ledSize * 2, y - ledSize * 2, ledSize * 4, ledSize * 4);

            // LED core
            this.ctx.fillStyle = `rgb(${led.r}, ${led.g}, ${led.b})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, ledSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    animate() {
        this.updatePreview(state.currentMode);
        this.draw();

        if (state.previewPlaying) {
            this.time++;
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// ===========================
// Toast Notifications
// ===========================
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#667eea" stroke-width="2"/><path d="M12 16V12M12 8H12.01" stroke="#667eea" stroke-width="2" stroke-linecap="round"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===========================
// Connection Status
// ===========================
async function checkConnection() {
    try {
        const response = await fetch('/status');
        const data = await response.json();
        updateConnectionStatus(true);

        if (typeof data.isOn === 'boolean') {
            state.isPowerOn = data.isOn;
            updatePowerButtonUI();
        }

        if (typeof data.mode === 'string' && data.mode !== 'off') {
            state.currentMode = data.mode;
        }

        return true;
    } catch (error) {
        updateConnectionStatus(false);
        return false;
    }
}

function updateConnectionStatus(connected) {
    state.isConnected = connected;
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');

    if (connected) {
        indicator.classList.add('connected');
        indicator.classList.remove('disconnected');
        text.textContent = 'Connected';
    } else {
        indicator.classList.remove('connected');
        indicator.classList.add('disconnected');
        text.textContent = 'Disconnected';
    }
}

// ===========================
// Mode Selection
// ===========================
function selectMode(mode) {
    state.currentMode = mode;

    // Update mode buttons
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.mode === mode) {
            card.classList.add('active');
        }
    });

    // Update control panels
    document.querySelectorAll('.mode-controls').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`${mode}-controls`)?.classList.add('active');

    // Update title
    const titles = {
        solid: 'Solid Color Controls',
        rainbow: 'Rainbow Effect Controls',
        wave: 'Wave Effect Controls',
        fade: 'Fade Effect Controls',
        strobe: 'Strobe Effect Controls',
        chase: 'Chase Effect Controls',
        special: 'Special Modes'
    };
    document.getElementById('controlsTitle').textContent = titles[mode] || 'Controls';

    // Auto apply
    applySettings();
}

// ===========================
// Settings Management
// ===========================
function getSettings() {
    const settings = {
        mode: state.currentMode
    };

    switch (state.currentMode) {
        case 'solid':
            settings.color = document.getElementById('solid-color').value;
            settings.brightness = document.getElementById('solid-brightness').value;
            break;
        case 'rainbow':
            settings.speed = document.getElementById('rainbow-speed').value;
            settings.brightness = document.getElementById('rainbow-brightness').value;
            settings.saturation = document.getElementById('rainbow-saturation').value;
            break;
        case 'wave':
            settings.color1 = document.getElementById('wave-color1').value;
            settings.color2 = document.getElementById('wave-color2').value;
            settings.speed = document.getElementById('wave-speed').value;
            settings.length = document.getElementById('wave-length').value;
            break;
        case 'fade':
            settings.color1 = document.getElementById('fade-color1').value;
            settings.color2 = document.getElementById('fade-color2').value;
            settings.speed = document.getElementById('fade-speed').value;
            settings.smoothness = document.getElementById('fade-smooth').value;
            break;
        case 'strobe':
            settings.color = document.getElementById('strobe-color').value;
            settings.speed = document.getElementById('strobe-speed').value;
            settings.intensity = document.getElementById('strobe-intensity').value;
            break;
        case 'chase':
            settings.color = document.getElementById('chase-color').value;
            settings.speed = document.getElementById('chase-speed').value;
            settings.spacing = document.getElementById('chase-spacing').value;
            settings.reverse = document.getElementById('chase-direction').checked;
            break;
    }

    return settings;
}

async function applySettings() {
    const settings = getSettings();

    try {
        const params = new URLSearchParams(settings);
        const response = await fetch(`/apply?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        state.isPowerOn = true;
        updatePowerButtonUI();
        showToast('Settings applied successfully!', 'success');
    } catch (error) {
        console.error('Error applying settings:', error);
        showToast('Failed to apply settings', 'error');
    }
}

async function togglePower() {
    state.isPowerOn = !state.isPowerOn;

    if (state.isPowerOn) {
        updatePowerButtonUI();
        await applySettings();
        showToast('LEDs powered on', 'success');
    } else {
        try {
            const response = await fetch('/off');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            updatePowerButtonUI();
            showToast('LEDs powered off', 'info');
        } catch (error) {
            console.error('Error powering off:', error);
            showToast('Failed to power off', 'error');
            state.isPowerOn = true;
            updatePowerButtonUI();
        }
    }
}

function updatePowerButtonUI() {
    const btn = document.getElementById('powerBtn');
    if (!btn) return;

    const label = btn.querySelector('span');
    if (!label) return;

    if (state.isPowerOn) {
        label.textContent = 'Power Off';
        btn.classList.remove('power-on');
    } else {
        label.textContent = 'Power On';
        btn.classList.add('power-on');
    }
}

// ===========================
// Preset Management
// ===========================
function savePreset() {
    const name = prompt('Enter preset name:');
    if (!name) return;

    const preset = {
        id: Date.now(),
        name: name,
        settings: getSettings()
    };

    state.presets.push(preset);
    localStorage.setItem('ledPresets', JSON.stringify(state.presets));

    renderPresets();
    showToast(`Preset "${name}" saved!`, 'success');
}

function loadPreset(id) {
    const preset = state.presets.find(p => p.id === id);
    if (!preset) return;

    const settings = preset.settings;
    state.currentMode = settings.mode;

    // Map API parameter keys back to control IDs.
    const presetIdMap = {
        wave: { length: 'wave-length' },
        fade: { smoothness: 'fade-smooth' },
        chase: { reverse: 'chase-direction' }
    };

    // Load mode-specific settings
    Object.keys(settings).forEach(key => {
        if (key === 'mode') return;

        const mappedId = presetIdMap[settings.mode]?.[key] || `${settings.mode}-${key}`;
        const element = document.getElementById(mappedId);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = settings[key];
            } else {
                element.value = settings[key];
            }
        }
    });

    selectMode(settings.mode);
    showToast(`Preset "${preset.name}" loaded!`, 'success');
}

function deletePreset(id) {
    if (!confirm('Delete this preset?')) return;

    state.presets = state.presets.filter(p => p.id !== id);
    localStorage.setItem('ledPresets', JSON.stringify(state.presets));

    renderPresets();
    showToast('Preset deleted', 'info');
}

function renderPresets() {
    const grid = document.getElementById('presetsGrid');

    if (state.presets.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2"/>
                </svg>
                <p>No presets saved yet</p>
                <small>Save your favorite settings as presets</small>
            </div>
        `;
        return;
    }

    grid.innerHTML = state.presets.map(preset => `
        <div class="preset-item" onclick="loadPreset(${preset.id})">
            <div class="preset-preview" style="background: linear-gradient(135deg, ${preset.settings.color || preset.settings.color1 || '#667eea'}, ${preset.settings.color2 || '#764ba2'});"></div>
            <div class="preset-name">${preset.name}</div>
            <div class="preset-mode">${preset.settings.mode}</div>
            <button class="preset-delete" onclick="event.stopPropagation(); deletePreset(${preset.id});">×</button>
        </div>
    `).join('');
}

// ===========================
// Event Listeners
// ===========================
function setupEventListeners() {
    // Mode selection
    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.dataset.mode;
            if (mode === 'special') {
                window.location.href = 'special.html';
            } else {
                selectMode(mode);
            }
        });
    });

    // Color pickers
    document.querySelectorAll('input[type="color"]').forEach(input => {
        const display = document.getElementById(`${input.id}-display`);

        input.addEventListener('input', (e) => {
            if (display) {
                display.querySelector('.color-hex').textContent = e.target.value;
            }
            applySettings();
        });
    });

    // Preset colors
    document.querySelectorAll('.preset-color').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.closest('.control-group').querySelector('input[type="color"]').id;
            const color = btn.dataset.color;
            const input = document.getElementById(targetId);
            input.value = color;
            input.dispatchEvent(new Event('input'));
        });
    });

    // Sliders
    document.querySelectorAll('.slider').forEach(slider => {
        const valueDisplay = document.getElementById(`${slider.id}-value`);

        slider.addEventListener('input', (e) => {
            let value = e.target.value;

            // Format display based on slider type
            if (slider.id.includes('brightness') || slider.id.includes('intensity') || slider.id.includes('saturation')) {
                value = `${value}%`;
            } else if (slider.id.includes('speed') && slider.id.includes('strobe')) {
                value = `${value} Hz`;
            } else if (slider.id.includes('spacing') || slider.id.includes('length')) {
                value = `${value} LEDs`;
            }

            if (valueDisplay) {
                valueDisplay.textContent = value;
            }

            applySettings();
        });
    });

    // Checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            applySettings();
        });
    });

    // Action buttons
    document.getElementById('powerBtn').addEventListener('click', togglePower);
    document.getElementById('applyBtn').addEventListener('click', applySettings);
    document.getElementById('savePresetBtn').addEventListener('click', savePreset);
    document.getElementById('openSpecialBtn').addEventListener('click', () => {
        window.location.href = 'special.html';
    });

    // Preview play/pause
    document.getElementById('previewPlayPause').addEventListener('click', () => {
        state.previewPlaying = !state.previewPlaying;
        const playIcon = document.getElementById('playIcon');
        const pauseIcon = document.getElementById('pauseIcon');

        if (state.previewPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    });
}

// ===========================
// Initialization
// ===========================
window.addEventListener('load', async () => {
    // Allow this shared file on special.html without running main-page setup.
    if (!document.getElementById('ledCanvas')) {
        return;
    }

    // Initialize LED preview
    const preview = new LEDPreview('ledCanvas', state.ledCount);

    // Setup event listeners
    setupEventListeners();

    // Load presets
    const savedPresets = localStorage.getItem('ledPresets');
    if (savedPresets) {
        state.presets = JSON.parse(savedPresets);
        renderPresets();
    }

    // Check connection
    await checkConnection();
    setInterval(checkConnection, 5000);

    updatePowerButtonUI();

    // Initialize color displays
    document.querySelectorAll('input[type="color"]').forEach(input => {
        const display = document.getElementById(`${input.id}-display`);
        if (display) {
            display.querySelector('.color-hex').textContent = input.value;
        }
    });

    // Show success message
    showToast('LED Controller loaded successfully!', 'success');
});

// Handle window resize
window.addEventListener('resize', () => {
    if (!document.getElementById('ledCanvas')) {
        return;
    }
    const preview = new LEDPreview('ledCanvas', state.ledCount);
});
