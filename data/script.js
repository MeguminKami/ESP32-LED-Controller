// Global state
let currentMode = 'solid';
let isOn = false;
let autoApplyTimeout = null;

// 24 color palette with maximum saturation
const colorPalette = [
    '#ff0000', '#ff4500', '#ff8c00', '#ffd700', '#ffff00', '#adff2f',
    '#00ff00', '#00ff7f', '#00ffff', '#00bfff', '#0080ff', '#0000ff',
    '#4169e1', '#8a2be2', '#9400d3', '#ba55d3', '#ff00ff', '#ff1493',
    '#ff69b4', '#ff0080', '#ff0040', '#ffffff', '#c0c0c0', '#808080'
];

// Initialize on page load
window.addEventListener('load', () => {
    loadSavedSettings();
    initializeRangeSliders();
    initializeColorPickers();
    generateColorPalettes();
    addAutoApplyListeners();

    fetch('/state')
        .then(res => res.json())
        .then(data => {
            updateStatusBadge(true);
            if (data.isOn !== undefined) {
                isOn = data.isOn;
                updatePowerButton();
            }
        })
        .catch(error => {
            console.error('Connection error:', error);
            updateStatusBadge(false);
        });
});

// Save all settings to localStorage
function saveAllSettings() {
    const settings = {
        mode: currentMode,
        solid: {
            color: document.getElementById('solid-color').value,
            brightness: document.getElementById('solid-brightness').value
        },
        wave: {
            color1: document.getElementById('wave-color1').value,
            color2: document.getElementById('wave-color2').value,
            speed: document.getElementById('wave-speed').value,
            length: document.getElementById('wave-length').value
        },
        rainbow: {
            speed: document.getElementById('rainbow-speed').value,
            brightness: document.getElementById('rainbow-brightness').value,
            saturation: document.getElementById('rainbow-saturation').value
        },
        fade: {
            color1: document.getElementById('fade-color1').value,
            color2: document.getElementById('fade-color2').value,
            speed: document.getElementById('fade-speed').value,
            smoothness: document.getElementById('fade-smooth').value
        },
        strobe: {
            color: document.getElementById('strobe-color').value,
            speed: document.getElementById('strobe-speed').value,
            intensity: document.getElementById('strobe-intensity').value
        },
        chase: {
            color: document.getElementById('chase-color').value,
            speed: document.getElementById('chase-speed').value,
            spacing: document.getElementById('chase-spacing').value,
            reverse: document.getElementById('chase-direction').checked
        }
    };

    localStorage.setItem('ledStripSettings', JSON.stringify(settings));
}

// Load saved settings from localStorage
function loadSavedSettings() {
    const savedData = localStorage.getItem('ledStripSettings');
    if (!savedData) return;

    try {
        const settings = JSON.parse(savedData);

        if (settings.mode) selectMode(settings.mode);
        if (settings.solid) {
            setInputValue('solid-color', settings.solid.color);
            setInputValue('solid-brightness', settings.solid.brightness);
        }
        if (settings.wave) {
            setInputValue('wave-color1', settings.wave.color1);
            setInputValue('wave-color2', settings.wave.color2);
            setInputValue('wave-speed', settings.wave.speed);
            setInputValue('wave-length', settings.wave.length);
        }
        if (settings.rainbow) {
            setInputValue('rainbow-speed', settings.rainbow.speed);
            setInputValue('rainbow-brightness', settings.rainbow.brightness);
            setInputValue('rainbow-saturation', settings.rainbow.saturation);
        }
        if (settings.fade) {
            setInputValue('fade-color1', settings.fade.color1);
            setInputValue('fade-color2', settings.fade.color2);
            setInputValue('fade-speed', settings.fade.speed);
            setInputValue('fade-smooth', settings.fade.smoothness);
        }
        if (settings.strobe) {
            setInputValue('strobe-color', settings.strobe.color);
            setInputValue('strobe-speed', settings.strobe.speed);
            setInputValue('strobe-intensity', settings.strobe.intensity);
        }
        if (settings.chase) {
            setInputValue('chase-color', settings.chase.color);
            setInputValue('chase-speed', settings.chase.speed);
            setInputValue('chase-spacing', settings.chase.spacing);
            const chaseDir = document.getElementById('chase-direction');
            if (chaseDir) chaseDir.checked = settings.chase.reverse || false;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function setInputValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element || value === undefined) return;

    element.value = value;

    if (element.type === 'color') {
        const colorValue = element.nextElementSibling;
        if (colorValue && colorValue.classList.contains('color-value')) {
            colorValue.textContent = value.toUpperCase();
        }
    }

    if (element.type === 'range') {
        const valueDisplay = element.nextElementSibling;
        if (valueDisplay && valueDisplay.classList.contains('value-display')) {
            updateSliderDisplay(element, valueDisplay);
        }
    }
}

function updateStatusBadge(connected) {
    const badge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');

    if (connected) {
        badge.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        badge.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

function selectMode(mode) {
    currentMode = mode;

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.controls-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`${mode}-controls`);
    if (activePanel) {
        activePanel.classList.add('active');
    }

    saveAllSettings();
    scheduleAutoApply();
}

function generateColorPalettes() {
    const palettes = document.querySelectorAll('.color-palette');

    palettes.forEach(palette => {
        const targetId = palette.dataset.target;

        colorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.title = color;
            swatch.addEventListener('click', () => {
                const targetInput = document.getElementById(targetId);
                if (targetInput) {
                    targetInput.value = color;
                    const colorValue = targetInput.nextElementSibling;
                    if (colorValue && colorValue.classList.contains('color-value')) {
                        colorValue.textContent = color.toUpperCase();
                    }
                    saveAllSettings();
                    scheduleAutoApply();
                }
            });
            palette.appendChild(swatch);
        });
    });
}

function initializeRangeSliders() {
    const sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
        const valueDisplay = slider.nextElementSibling;
        if (valueDisplay && valueDisplay.classList.contains('value-display')) {
            slider.addEventListener('input', (e) => updateSliderDisplay(e.target, valueDisplay));
            updateSliderDisplay(slider, valueDisplay);
        }
    });
}

function updateSliderDisplay(slider, display) {
    const value = slider.value;
    const id = slider.id;

    if (id.includes('brightness') || id.includes('duty') || id.includes('saturation') || id.includes('intensity')) {
        display.textContent = `${value}%`;
    } else if (id.includes('frequency') || id.includes('speed') && id.includes('strobe')) {
        display.textContent = `${value} Hz`;
    } else if (id.includes('spacing') || id.includes('length')) {
        display.textContent = `${value} LEDs`;
    } else {
        display.textContent = value;
    }
}

function initializeColorPickers() {
    const colorPickers = document.querySelectorAll('input[type="color"]');
    colorPickers.forEach(picker => {
        const colorValue = picker.nextElementSibling;
        if (colorValue && colorValue.classList.contains('color-value')) {
            picker.addEventListener('input', (e) => {
                colorValue.textContent = e.target.value.toUpperCase();
            });
            colorValue.textContent = picker.value.toUpperCase();
        }
    });
}

function addAutoApplyListeners() {
    document.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', () => {
            saveAllSettings();
            scheduleAutoApply();
        });
    });

    document.querySelectorAll('input[type="color"]').forEach(input => {
        input.addEventListener('input', () => {
            saveAllSettings();
            scheduleAutoApply();
        });
    });

    document.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
            saveAllSettings();
            scheduleAutoApply();
        });
    });
}

function scheduleAutoApply() {
    if (autoApplyTimeout) clearTimeout(autoApplyTimeout);
    autoApplyTimeout = setTimeout(() => applySettings(), 500);
}

function getCurrentSettings() {
    const settings = { mode: currentMode };

    switch (currentMode) {
        case 'solid':
            settings.color = document.getElementById('solid-color').value;
            settings.brightness = document.getElementById('solid-brightness').value;
            break;
        case 'wave':
            settings.color1 = document.getElementById('wave-color1').value;
            settings.color2 = document.getElementById('wave-color2').value;
            settings.speed = document.getElementById('wave-speed').value;
            settings.length = document.getElementById('wave-length').value;
            break;
        case 'rainbow':
            settings.speed = document.getElementById('rainbow-speed').value;
            settings.brightness = document.getElementById('rainbow-brightness').value;
            settings.saturation = document.getElementById('rainbow-saturation').value;
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

function applySettings() {
    const settings = getCurrentSettings();
    const params = new URLSearchParams(settings);

    fetch(`/apply?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
            console.log('Settings applied:', data);
            updateStatusBadge(true);
            isOn = true;
            updatePowerButton();
        })
        .catch(error => {
            console.error('Error applying settings:', error);
            updateStatusBadge(false);
        });
}

function forceApplySettings() {
    const button = document.getElementById('forceApplyBtn');
    button.style.transform = 'scale(0.95)';
    setTimeout(() => button.style.transform = '', 150);
    if (autoApplyTimeout) clearTimeout(autoApplyTimeout);
    applySettings();
}

function togglePower() {
    if (isOn) {
        fetch('/off')
            .then(res => res.json())
            .then(data => {
                isOn = false;
                updatePowerButton();
                updateStatusBadge(true);
            })
            .catch(error => {
                console.error('Error turning off:', error);
                updateStatusBadge(false);
            });
    } else {
        applySettings();
    }
}

function updatePowerButton() {
    const button = document.getElementById('powerBtn');
    if (isOn) {
        button.querySelector('span').textContent = 'Turn Off';
        button.classList.remove('off');
    } else {
        button.querySelector('span').textContent = 'Turn On';
        button.classList.add('off');
    }
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        togglePower();
    }
    if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        forceApplySettings();
    }
    if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''));
        const modes = ['solid', 'wave', 'rainbow', 'fade', 'strobe', 'chase'];
        if (num >= 1 && num <= modes.length) {
            selectMode(modes[num - 1]);
        }
    }
});

setInterval(() => {
    fetch('/status')
        .then(res => res.json())
        .then(data => {
            updateStatusBadge(true);
            if (data.isOn !== undefined) {
                isOn = data.isOn;
                updatePowerButton();
            }
        })
        .catch(error => {
            updateStatusBadge(false);
        });
}, 5000);