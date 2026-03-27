// ===========================
// Special Modes State
// ===========================
const specialState = {
    currentCategory: 'christmas',
    submodeOrder: {
        christmas: [1, 2, 3, 4, 5],
        fire: [1, 2, 3],
        sextrip: [1, 2, 3]
    },
    submodeEnabled: {
        christmas: { 1: true, 2: true, 3: true, 4: true, 5: true },
        fire: { 1: true, 2: true, 3: true },
        sextrip: { 1: true, 2: true, 3: true }
    }
};

// ===========================
// Category Selection
// ===========================
function selectCategory(category) {
    specialState.currentCategory = category;

    // Update category buttons
    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.category === category) {
            card.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.modes-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${category}-section`)?.classList.add('active');
}

// ===========================
// Submode Order Management
// ===========================
function moveUp(category, submodeId) {
    const order = specialState.submodeOrder[category];
    const currentIndex = order.indexOf(submodeId);

    if (currentIndex > 0) {
        // Swap with previous
        [order[currentIndex], order[currentIndex - 1]] =
        [order[currentIndex - 1], order[currentIndex]];

        updateOrderDisplay(category);
        saveSettings();
        showToast('Order updated', 'success', 2000);
    }
}

function moveDown(category, submodeId) {
    const order = specialState.submodeOrder[category];
    const currentIndex = order.indexOf(submodeId);

    if (currentIndex < order.length - 1) {
        // Swap with next
        [order[currentIndex], order[currentIndex + 1]] =
        [order[currentIndex + 1], order[currentIndex]];

        updateOrderDisplay(category);
        saveSettings();
        showToast('Order updated', 'success', 2000);
    }
}

function resetCategory(category) {
    if (!confirm('Reset this category to default order?')) return;

    // Reset order
    const defaultOrders = {
        christmas: [1, 2, 3, 4, 5],
        fire: [1, 2, 3],
        sextrip: [1, 2, 3]
    };

    specialState.submodeOrder[category] = [...defaultOrders[category]];

    // Reset enabled state
    specialState.submodeOrder[category].forEach(id => {
        specialState.submodeEnabled[category][id] = true;
    });

    updateOrderDisplay(category);
    updateCheckboxes(category);
    updateSelectedCount(category);
    saveSettings();
    showToast('Category reset to defaults', 'success');
}

function updateOrderDisplay(category) {
    const order = specialState.submodeOrder[category];
    const section = document.getElementById(`${category}-section`);
    const grid = section.querySelector('.submodes-grid');

    // Get all cards
    const cards = Array.from(grid.querySelectorAll('.submode-card'));

    // Update order numbers
    order.forEach((submodeId, index) => {
        const card = cards.find(c =>
            parseInt(c.dataset.submode) === submodeId
        );
        if (card) {
            card.querySelector('.submode-order').textContent = index + 1;
        }
    });

    // Reorder DOM elements
    cards.sort((a, b) => {
        const aId = parseInt(a.dataset.submode);
        const bId = parseInt(b.dataset.submode);
        return order.indexOf(aId) - order.indexOf(bId);
    });

    // Clear and re-append
    grid.innerHTML = '';
    cards.forEach(card => grid.appendChild(card));
}

// ===========================
// Checkbox Management
// ===========================
function setupCheckboxListeners() {
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        const category = checkbox.dataset.category;
        const submodeId = parseInt(checkbox.dataset.submode);

        checkbox.addEventListener('change', (e) => {
            specialState.submodeEnabled[category][submodeId] = e.target.checked;

            // Update card appearance
            const card = e.target.closest('.submode-card');
            if (card) {
                if (e.target.checked) {
                    card.classList.remove('disabled');
                } else {
                    card.classList.add('disabled');
                }
            }

            updateSelectedCount(category);
            saveSettings();
        });
    });
}

function updateCheckboxes(category) {
    const checkboxes = document.querySelectorAll(`input[data-category="${category}"]`);
    checkboxes.forEach(checkbox => {
        const submodeId = parseInt(checkbox.dataset.submode);
        checkbox.checked = specialState.submodeEnabled[category][submodeId];

        // Update card appearance
        const card = checkbox.closest('.submode-card');
        if (card) {
            if (checkbox.checked) {
                card.classList.remove('disabled');
            } else {
                card.classList.add('disabled');
            }
        }
    });
}

function updateSelectedCount(category) {
    const enabled = specialState.submodeEnabled[category];
    const count = Object.values(enabled).filter(v => v).length;
    const total = Object.keys(enabled).length;

    const countElement = document.getElementById(`${category}-selected`);
    if (countElement) {
        countElement.textContent = `${count}/${total} selected`;
    }

    // Update category count
    const categoryCount = document.getElementById(`${category}-count`);
    if (categoryCount) {
        categoryCount.textContent = `${total} modes`;
    }
}

// ===========================
// Start Special Mode
// ===========================
async function startSpecialMode(category) {
    const btn = document.querySelector(`#${category}-section .btn-start`);

    // Get enabled submodes in order
    const order = specialState.submodeOrder[category];
    const enabled = specialState.submodeEnabled[category];
    const enabledSubmodes = order.filter(id => enabled[id]);

    if (enabledSubmodes.length === 0) {
        showToast('Please enable at least one sub-mode!', 'error');
        return;
    }

    // Visual feedback
    btn.classList.add('running');
    const originalText = btn.querySelector('span').textContent;
    btn.querySelector('span').textContent = 'Starting...';

    try {
        const apiMode = category === 'fire' ? 'fireplace' : category;
        const params = new URLSearchParams({
            mode: apiMode,
            submodes: enabledSubmodes.join(',')
        });

        const response = await fetch(`/apply?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        showToast(`${capitalize(category)} mode started successfully!`, 'success');
        btn.querySelector('span').textContent = 'Running...';

        setTimeout(() => {
            btn.querySelector('span').textContent = originalText;
        }, 3000);
    } catch (error) {
        console.error(`Error starting ${category} mode:`, error);
        showToast(`Failed to start ${category} mode`, 'error');
        btn.classList.remove('running');
        btn.querySelector('span').textContent = originalText;
    }

    setTimeout(() => {
        btn.classList.remove('running');
    }, 3000);
}

// ===========================
// Settings Persistence
// ===========================
function saveSettings() {
    const data = {
        order: specialState.submodeOrder,
        enabled: specialState.submodeEnabled
    };
    localStorage.setItem('specialModesSettings', JSON.stringify(data));
}

function loadSettings() {
    const saved = localStorage.getItem('specialModesSettings');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.order) specialState.submodeOrder = data.order;
            if (data.enabled) specialState.submodeEnabled = data.enabled;

            // Apply loaded settings
            ['christmas', 'fire', 'sextrip'].forEach(category => {
                updateOrderDisplay(category);
                updateCheckboxes(category);
                updateSelectedCount(category);
            });
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

// ===========================
// Utility Functions
// ===========================
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===========================
// Initialization
// ===========================
window.addEventListener('load', async () => {
    // Load saved settings
    loadSettings();

    // Setup checkbox listeners
    setupCheckboxListeners();

    // Initialize selected counts
    ['christmas', 'fire', 'sextrip'].forEach(category => {
        updateSelectedCount(category);
    });

    // Check connection
    await checkConnection();
    setInterval(checkConnection, 5000);

    showToast('Special modes loaded!', 'success', 2000);
});

// ===========================
// Export for debugging
// ===========================
window.specialDebug = {
    getState: () => specialState,
    saveSettings,
    loadSettings
};
