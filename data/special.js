// Special mode state
let currentCategory = 'christmas';

let submodeOrder = {
    christmas: [1, 2, 3, 4, 5],
    sextrip: [1, 2, 3],
    fireplace: [1, 2, 3]
};

let submodeEnabled = {
    christmas: {1: true, 2: true, 3: true, 4: true, 5: true},
    sextrip: {1: true, 2: true, 3: true},
    fireplace: {1: true, 2: true, 3: true}
};

// Initialize on page load
window.addEventListener('load', () => {
    loadAllSettings();
    updateAllOrderNumbers();
    updateAllInfo();

    // Add checkbox listeners for all categories
    ['christmas', 'sextrip', 'fireplace'].forEach(category => {
        const maxSubmodes = submodeOrder[category].length;
        for (let i = 1; i <= maxSubmodes; i++) {
            const checkbox = document.getElementById(`${category}-submode-${i}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    submodeEnabled[category][i] = e.target.checked;
                    saveAllSettings();
                    updateInfo(category);
                });
            }
        }
    });

    // Check connection status
    fetch('/status')
        .then(res => res.json())
        .then(data => updateStatusBadge(true))
        .catch(error => {
            console.error('Connection error:', error);
            updateStatusBadge(false);
        });
});

// Select category
function selectCategory(category) {
    currentCategory = category;

    // Update buttons
    document.querySelectorAll('.special-category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });

    // Update cards
    document.querySelectorAll('.special-mode-card').forEach(card => {
        card.classList.remove('active');
    });
    document.getElementById(`${category}-card`).classList.add('active');
}

// Load all settings from localStorage
function loadAllSettings() {
    const saved = localStorage.getItem('specialModesSettings');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.order) submodeOrder = data.order;
            if (data.enabled) submodeEnabled = data.enabled;

            // Apply loaded state to checkboxes
            ['christmas', 'sextrip', 'fireplace'].forEach(category => {
                const maxSubmodes = submodeOrder[category].length;
                for (let i = 1; i <= maxSubmodes; i++) {
                    const checkbox = document.getElementById(`${category}-submode-${i}`);
                    if (checkbox && submodeEnabled[category][i] !== undefined) {
                        checkbox.checked = submodeEnabled[category][i];
                    }
                }
            });
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

// Save all settings to localStorage
function saveAllSettings() {
    const data = {
        order: submodeOrder,
        enabled: submodeEnabled
    };
    localStorage.setItem('specialModesSettings', JSON.stringify(data));
}

// Move submode up in order
function moveUp(category, submodeId) {
    const order = submodeOrder[category];
    const currentIndex = order.indexOf(submodeId);
    if (currentIndex > 0) {
        [order[currentIndex], order[currentIndex - 1]] = 
        [order[currentIndex - 1], order[currentIndex]];

        updateOrderNumbers(category);
        saveAllSettings();
    }
}

// Move submode down in order
function moveDown(category, submodeId) {
    const order = submodeOrder[category];
    const currentIndex = order.indexOf(submodeId);
    if (currentIndex < order.length - 1) {
        [order[currentIndex], order[currentIndex + 1]] = 
        [order[currentIndex + 1], order[currentIndex]];

        updateOrderNumbers(category);
        saveAllSettings();
    }
}

// Reset order to default
function resetOrder(category) {
    if (category === 'christmas') {
        submodeOrder[category] = [1, 2, 3, 4, 5];
    } else {
        submodeOrder[category] = [1, 2, 3];
    }
    updateOrderNumbers(category);
    saveAllSettings();
}

// Update order numbers for a specific category
function updateOrderNumbers(category) {
    const container = document.getElementById(`${category}-card`).querySelector('.christmas-submodes');
    const order = submodeOrder[category];

    order.forEach((submodeId, index) => {
        const orderElement = container.querySelector(`[data-submode="${submodeId}"] .order-number`);
        if (orderElement) {
            orderElement.textContent = index + 1;
        }
    });

    // Reorder DOM elements
    const items = Array.from(container.querySelectorAll('.submode-item'));
    const h3 = container.querySelector('h3');

    // Sort items by current order
    items.sort((a, b) => {
        const aId = parseInt(a.dataset.submode);
        const bId = parseInt(b.dataset.submode);
        return order.indexOf(aId) - order.indexOf(bId);
    });

    // Clear and re-append in order
    container.innerHTML = '';
    container.appendChild(h3);
    items.forEach(item => container.appendChild(item));
}

// Update all order numbers
function updateAllOrderNumbers() {
    ['christmas', 'sextrip', 'fireplace'].forEach(category => {
        updateOrderNumbers(category);
    });
}

// Update info display for a category
function updateInfo(category) {
    const enabled = submodeEnabled[category];
    const selectedCount = Object.values(enabled).filter(v => v).length;

    const countElement = document.getElementById(`${category}-selectedCount`);
    if (countElement) {
        countElement.textContent = selectedCount;
    }
}

// Update all info displays
function updateAllInfo() {
    ['christmas', 'sextrip', 'fireplace'].forEach(category => {
        updateInfo(category);
    });
}

// Update status badge
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

// Start special mode
function startSpecialMode(category) {
    const button = document.querySelector(`#${category}-card .btn-power`);

    // Visual feedback
    button.style.transform = 'scale(0.95)';
    setTimeout(() => button.style.transform = '', 150);

    // Get enabled submodes in order
    const order = submodeOrder[category];
    const enabled = submodeEnabled[category];
    const enabledSubmodes = order.filter(id => enabled[id]);

    if (enabledSubmodes.length === 0) {
        alert('Please select at least one sub-mode!');
        return;
    }

    // Build query string with ordered enabled submodes
    const params = new URLSearchParams({
        mode: category,
        submodes: enabledSubmodes.join(',')
    });

    // Send to ESP32
    fetch(`/apply?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
            console.log(`${category} mode started:`, data);
            updateStatusBadge(true);

            // Show success message
            const originalText = button.querySelector('span').textContent;
            button.querySelector('span').textContent = 'Running...';
            setTimeout(() => {
                button.querySelector('span').textContent = originalText;
            }, 2000);
        })
        .catch(error => {
            console.error(`Error starting ${category} mode:`, error);
            updateStatusBadge(false);
            alert(`Failed to start ${category} mode. Please check your connection.`);
        });
}

// Periodic status check
setInterval(() => {
    fetch('/status')
        .then(res => res.json())
        .then(data => updateStatusBadge(true))
        .catch(error => updateStatusBadge(false));
}, 5000);