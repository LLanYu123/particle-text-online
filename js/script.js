// --- 获取 HTML 元素 ---
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
const textInput = document.getElementById('textInput');
const updateButton = document.getElementById('updateButton');

// --- 配置 (VortexConfiguration Equivalent) ---
const config = {
    // --- Canvas/Window ---
    width: window.innerWidth,   // Use window size initially
    height: window.innerHeight,
    backgroundColor: 'rgba(0, 0, 0, 1)', // Equivalent to black background
    trailAlpha: 0.1,          // Trail effect (0 = no trail, 1 = no fade) - like Java's alpha/255

    // --- Particles ---
    numParticles: 5000,
    particleMaxSpeed: 4.5,     // Max speed limit
    particleMinSpeed: 0.0,     // Min speed near target (0 to disable)
    particleMinSize: 1,
    particleMaxSize: 2.5,

    // --- Forces ---
    attractionForce: 0.08,     // How strongly particles are pulled to target
    swirlForce: 0.005,        // Rotational force around center (0 to disable)
    damping: 0.99,           // Friction/slowdown factor (closer to 1 = less friction)

    // --- Color/Appearance ---
    hueShiftSpeed: 0.001,     // Hue shift per frame (0-1 corresponds to 0-360 degrees)
    saturation: 1.0,        // HSL Saturation (0-1) -> 100%
    minBrightness: 0.4,     // HSL Lightness minimum (0-1) -> 40%
    maxBrightness: 1.0,     // HSL Lightness maximum (0-1) -> 100%
    brightnessDistanceFactor: 150, // How quickly brightness fades with distance

    // --- Text Sampling ---
    targetText: "初音未来欢迎你",     // Default text if input is empty
    fontSize: 160,            // Base font size (can be adjusted dynamically)
    fontName: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimHei", sans-serif', // Font stack
    fontStyle: 'normal',      // 'normal', 'italic', 'bold' etc.
    textSampleColor: '#ffffff', // Color to draw text on temp canvas (must be distinct from bg)
    textSamplingDensity: 2,   // Pixel step for sampling (lower = more points)
    textAlphaThreshold: 128,   // Alpha value threshold (0-255) to consider a pixel part of the text

    // --- Interaction ---
    resetOnClick: true,       // Reset particle positions on click (like Java version)
    timerDelayMs: 16,         // Approximate delay (not directly used with requestAnimationFrame)
};

// --- Global State ---
let particles = [];
let targetPoints = [];
let currentHue = Math.random(); // Start with a random hue (0-1 range)
let centerX = config.width / 2;
let centerY = config.height / 2;

// --- Particle Class ---
class Particle {
    constructor(targets) {
        // Assign a random target point from the list
        if (!targets || targets.length === 0) {
            this.target = { x: centerX, y: centerY }; // Fallback if no points
        } else {
            this.target = targets[Math.floor(Math.random() * targets.length)];
        }

        // Random initial position and velocity
        this.pos = { x: Math.random() * config.width, y: Math.random() * config.height };
        this.vel = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };

        // Random size
        this.size = config.particleMinSize + Math.random() * (config.particleMaxSize - config.particleMinSize);
        this.color = `hsl(0, 0%, 0%)`; // Initial color (will be updated)
    }

    update(hue, center) {
        // --- Attraction Force ---
        const dx = this.target.x - this.pos.x;
        const dy = this.target.y - this.pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 1) { // Avoid division by zero and jitter near target
            const dist = Math.sqrt(distSq);
            // Optional: Limit effect range like in Java (effectiveDist) - Can be less crucial in JS
            // const effectiveDist = Math.min(dist, 200.0);
            const forceMagnitude = config.attractionForce * dist * 0.1; // Simplified force proportional to dist
            this.vel.x += (dx / dist) * forceMagnitude;
            this.vel.y += (dy / dist) * forceMagnitude;
        }

        // --- Swirl Force ---
        if (config.swirlForce !== 0) {
            const dxCenter = this.pos.x - center.x;
            const dyCenter = this.pos.y - center.y;
            const distCenterSq = dxCenter * dxCenter + dyCenter * dyCenter;
            if (distCenterSq > 1) {
                const distCenter = Math.sqrt(distCenterSq);
                this.vel.x += -dyCenter / distCenter * config.swirlForce;
                this.vel.y += dxCenter / distCenter * config.swirlForce;
            }
        }

        // --- Damping ---
        this.vel.x *= config.damping;
        this.vel.y *= config.damping;

        // --- Speed Limits ---
        const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
        if (speed > config.particleMaxSpeed) {
            const factor = config.particleMaxSpeed / speed;
            this.vel.x *= factor;
            this.vel.y *= factor;
        } else if (config.particleMinSpeed > 0 && speed < config.particleMinSpeed && distSq < 10000) { // Near target
             if (speed > 0.01) {
                 const factor = config.particleMinSpeed / speed;
                 this.vel.x *= factor;
                 this.vel.y *= factor;
            } else if (distSq > 1){ // If stopped but not at target, give a nudge
                this.vel.x = (Math.random() - 0.5) * config.particleMinSpeed;
                this.vel.y = (Math.random() - 0.5) * config.particleMinSpeed;
            }
        }


        // --- Update Position ---
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;

        // --- Update Color (HSL) ---
        const distFromTarget = Math.sqrt(distSq);
        // Convert Java's brightness (0-1) to HSL Lightness (0-100%)
        let lightness = Math.max(config.minBrightness, config.maxBrightness - (distFromTarget / config.brightnessDistanceFactor));
        lightness = Math.min(config.maxBrightness, lightness);

        // Convert global hue (0-1) to degrees (0-360)
        const hueDegrees = (hue * 360) % 360;
        // Convert saturation (0-1) to percentage (0-100)
        const saturationPercent = config.saturation * 100;
        const lightnessPercent = lightness * 100;

        this.color = `hsl(${hueDegrees}, ${saturationPercent}%, ${lightnessPercent}%)`;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Draw circle (equivalent to fillOval)
        ctx.arc(this.pos.x, this.pos.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Text Sampling Function ---
function getTextPoints(text, fontSize) {
    const points = [];
    const density = config.textSamplingDensity;

    // Create a temporary canvas
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    // Set font properties
    const font = `${config.fontStyle} ${fontSize}px ${config.fontName}`;
    tempCtx.font = font;

    // Measure text
    const textMetrics = tempCtx.measureText(text);
    const textWidth = Math.ceil(textMetrics.width);
    // Estimate height (more complex than Java FontMetrics)
    const actualHeight = (textMetrics.actualBoundingBoxAscent || fontSize) + (textMetrics.actualBoundingBoxDescent || fontSize * 0.3);
    const textHeight = Math.ceil(actualHeight * 1.2); // Add some buffer

    if (textWidth <= 0 || textHeight <= 0) {
        console.error("ERROR: Font metrics returned invalid size for '" + text + "'. Cannot sample text points.");
        return null; // Return null like Java version
    }

    // Size the temporary canvas
    const padding = 10; // Similar padding
    tempCanvas.width = textWidth + padding * 2;
    tempCanvas.height = textHeight + padding * 2;

    // Redraw text on correctly sized canvas for sampling
    tempCtx.font = font; // Reset font on resized canvas
    tempCtx.fillStyle = config.textSampleColor;
    tempCtx.textBaseline = 'middle'; // Use middle for better vertical centering
    const drawX = padding;
    const drawY = tempCanvas.height / 2; // Center vertically
    tempCtx.fillText(text, drawX, drawY);

    // Calculate offset to center points on main canvas
    const offsetX = centerX - tempCanvas.width / 2;
    const offsetY = centerY - tempCanvas.height / 2;

    // Sample pixels
    try {
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        for (let y = 0; y < tempCanvas.height; y += density) {
            for (let x = 0; x < tempCanvas.width; x += density) {
                // Get alpha channel value (index 3)
                const alphaIndex = (y * tempCanvas.width + x) * 4 + 3;
                if (imageData[alphaIndex] > config.textAlphaThreshold) {
                    points.push({ x: x + offsetX, y: y + offsetY });
                }
            }
        }
    } catch (error) {
        console.error("Error getting image data (potential CORS issue if using external images/fonts?):", error);
        return null; // Return null on error
    }


    console.log(`Sampled ${points.length} target points for "${text}".`);
    return points;
}


// --- Reset Particles Function ---
function resetParticles() {
    particles = []; // Clear existing particles
    if (!targetPoints || targetPoints.length === 0) {
        console.warn("No target points available for resetParticles.");
        // Optionally create particles aiming at center as fallback
        // targetPoints = [{ x: centerX, y: centerY }];
        return; // Or just do nothing if no targets
    }
    console.log(`Resetting ${config.numParticles} particles for ${targetPoints.length} targets.`);
    for (let i = 0; i < config.numParticles; i++) {
        particles.push(new Particle(targetPoints)); // Pass the list of targets
    }
}

// --- Update Text Target and Reset ---
function updateTextTarget() {
    let text = textInput.value || config.targetText; // Get input or default

    if (!text || text.trim() === "") {
        text = config.targetText; // Use default if input is empty/whitespace only
        textInput.value = text; // Update input field to show default
        console.log("Input empty, using default text:", text);
    }

    // --- Optional: Dynamic Font Size Adjustment ---
    let dynamicFontSize = config.fontSize;
    if (text.length > 10) {
        dynamicFontSize = Math.max(60, config.fontSize - (text.length - 10) * 8); // Decrease size for long text
    } else if (text.length < 4) {
        dynamicFontSize = Math.min(200, config.fontSize + (4 - text.length) * 15); // Increase size for short text
    }
    console.log(`Using text: "${text}", Font size: ${dynamicFontSize}`);
    // --- End Dynamic Font Size ---

    // Get new points
    const newPoints = getTextPoints(text, dynamicFontSize);
    if (newPoints) { // Only update if sampling was successful
        targetPoints = newPoints;
        resetParticles();
    } else {
        console.error("Failed to get text points. Keeping previous particles.");
        // Optionally clear particles or show an error message
        // particles = [];
        // targetPoints = [];
    }
}


// --- Resize Canvas Function ---
function resizeCanvas() {
    config.width = canvas.width = window.innerWidth;
    config.height = canvas.height = window.innerHeight;
    centerX = config.width / 2;
    centerY = config.height / 2;
    console.log(`Canvas resized to: ${config.width}x${config.height}`);
    // Resample text and reset particles on resize to fit new center
    updateTextTarget();
}

// --- Animation Loop ---
function animate() {
    // 1. Clear/Trail Effect (Equivalent to background rectangle with alpha)
    ctx.fillStyle = `rgba(0, 0, 0, ${config.trailAlpha})`; // Use config background color with trail alpha
    ctx.fillRect(0, 0, config.width, config.height);

    // 2. Update Hue
    currentHue = (currentHue + config.hueShiftSpeed) % 1.0; // Keep hue in 0-1 range

    // 3. Update and Draw Particles
    // Use a standard for loop for potentially better performance with large arrays
    for (let i = 0; i < particles.length; i++) {
        if (particles[i]) { // Basic check if particle exists
             try {
                particles[i].update(currentHue, { x: centerX, y: centerY });
                particles[i].draw(ctx);
             } catch (updateDrawError) {
                 console.error("Error updating/drawing particle:", updateDrawError, particles[i]);
                 // Optionally remove the problematic particle: particles.splice(i, 1); i--;
             }
        }
    }

    // 4. Request Next Frame
    requestAnimationFrame(animate);
}

// --- Initialization and Event Listeners ---

// Initial setup
resizeCanvas(); // Set initial size and sample default text

// Start animation
animate();

// Event Listeners
window.addEventListener('resize', resizeCanvas);

updateButton.addEventListener('click', () => {
    console.log("Update button clicked.");
    updateTextTarget();
});

textInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        console.log("Enter key pressed in input.");
        event.preventDefault(); // Prevent potential form submission if inside one
        updateTextTarget();
    }
});

if (config.resetOnClick) {
    canvas.addEventListener('click', () => {
        console.log("Canvas clicked - resetting particle positions.");
        // Just reset positions, don't resample text
        particles.forEach(p => {
            p.pos = { x: Math.random() * config.width, y: Math.random() * config.height };
            p.vel = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };
        });
    });
}

console.log("Text Particle Vortex Initialized.");
