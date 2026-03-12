// ============================================
// Configuration
// ============================================
const CONFIG = {
    animation: {
        cycleSeconds: 16,       // Total animation cycle duration
        particleCount: 600,     // Number of 3D points
        distanceThreshold: 0.35 // Max distance for mesh triangle connections
    },
    loading: {
        minDisplayMs: 400       // Minimum loader display time
    }
};

// ============================================
// Theme Toggle (shared logic)
// ============================================
function initThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    if (!toggle) return;

    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        html.setAttribute('data-theme', 'light');
    }

    toggle.addEventListener('click', () => {
        const isLight = html.getAttribute('data-theme') === 'light';
        if (isLight) {
            html.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            html.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    });
}

initThemeToggle();

// ============================================
// Loading Screen (event-based)
// ============================================
(function initLoader() {
    const loader = document.getElementById('loader');
    const hero = document.querySelector('#hero');
    if (!loader) return;

    let fontsReady = false;
    let windowLoaded = false;
    let minTimeElapsed = false;
    const startTime = performance.now();

    function tryHideLoader() {
        if (fontsReady && windowLoaded && minTimeElapsed) {
            loader.classList.add('hidden');
            if (hero) hero.classList.add('visible');
        }
    }

    // Wait for fonts
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            fontsReady = true;
            tryHideLoader();
        });
    } else {
        fontsReady = true;
    }

    // Wait for window load
    window.addEventListener('load', () => {
        windowLoaded = true;
        // Ensure minimum display time so the loader is visible briefly
        const elapsed = performance.now() - startTime;
        const remaining = Math.max(0, CONFIG.loading.minDisplayMs - elapsed);
        setTimeout(() => {
            minTimeElapsed = true;
            tryHideLoader();
        }, remaining);

        loadProjects();
    });
})();

// ============================================
// Project Loading (XSS-safe DOM construction)
// ============================================
async function loadProjects() {
    try {
        const response = await fetch('projects.json');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const projects = await response.json();
        const grid = document.getElementById('projectsGrid');

        const projectCountEl = document.getElementById('projectCount');
        if (projectCountEl) {
            const projectOnly = projects.filter(p => p.tag === 'PROJECT').length;
            animateNumber(projectCountEl, projectOnly);
        }

        if (grid) {
            grid.textContent = '';
            const displayProjects = projects.slice(0, 6);
            displayProjects.forEach(project => {
                const card = createProjectCard(project);
                grid.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

function createProjectCard(project) {
    const tagClass = project.tag === 'PROJECT' ? 'project' :
                     project.tag === 'ARCHIVE' ? 'archive' :
                     project.tag === 'RESEARCH' ? 'research' :
                     project.tag === 'TECHNICAL' ? 'technical' : '';

    const a = document.createElement('a');
    a.href = project.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const tag = document.createElement('span');
    tag.className = 'tag ' + tagClass;
    tag.textContent = project.tag;
    header.appendChild(tag);

    if (project.live) {
        const badge = document.createElement('span');
        badge.className = 'live-badge';
        badge.textContent = 'LIVE';
        header.appendChild(badge);
    }

    const h3 = document.createElement('h3');
    h3.textContent = project.title;

    const p = document.createElement('p');
    p.textContent = project.description;

    a.appendChild(header);
    a.appendChild(h3);
    a.appendChild(p);

    return a;
}

function animateNumber(element, target) {
    let current = 0;
    const increment = target / 25;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 40);
}

// ============================================
// 3D Reconstruction Pipeline Visualization
// ============================================

// Check for reduced motion preference - skip canvas animation entirely
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('dct-canvas');

if (canvas) {
    // Add aria-label for screen readers
    canvas.setAttribute('aria-label', '3D point cloud reconstruction animation visualizing the research pipeline');
    canvas.setAttribute('role', 'img');
}

if (canvas && !prefersReducedMotion) {
    const ctx = canvas.getContext('2d');

    let width, height;
    let mouseX = 0, mouseY = 0;
    let targetMouseX = 0, targetMouseY = 0;
    let scrollProgress = 0;
    let time = 0;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Easing functions
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // 3D transforms
    function rotateY(p, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: p.x * cos - p.z * sin,
            y: p.y,
            z: p.x * sin + p.z * cos
        };
    }

    function rotateX(p, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: p.x,
            y: p.y * cos - p.z * sin,
            z: p.y * sin + p.z * cos
        };
    }

    function project(p) {
        const perspective = 3.5;
        const scale = perspective / (perspective + p.z);
        return {
            x: p.x * scale * 280 + width / 2,
            y: p.y * scale * 280 + height / 2,
            scale: scale,
            z: p.z
        };
    }

    // 3D Point class
    class Point3D {
        constructor(x, y, z, index, total) {
            this.targetX = x;
            this.targetY = y;
            this.targetZ = z;
            this.index = index;
            this.total = total;

            const scatter = 3;
            const angle = index * 2.399963;
            const radius = 1.5 + Math.random() * scatter;
            this.scatterX = Math.cos(angle) * radius * (Math.random() - 0.5) * 2;
            this.scatterY = (Math.random() - 0.5) * scatter * 2;
            this.scatterZ = Math.sin(angle) * radius * (Math.random() - 0.5) * 2;

            this.x = this.scatterX;
            this.y = this.scatterY;
            this.z = this.scatterZ;

            this.delay = (index / total) * 0.3;
            this.speed = 0.8 + Math.random() * 0.4;
        }

        update(gatherProgress, disperseProgress) {
            const gather = easeOutQuart(Math.max(0, Math.min(1, (gatherProgress - this.delay) * 1.5)));
            const disperse = easeInOutCubic(disperseProgress);

            const formX = this.scatterX + (this.targetX - this.scatterX) * gather;
            const formY = this.scatterY + (this.targetY - this.scatterY) * gather;
            const formZ = this.scatterZ + (this.targetZ - this.scatterZ) * gather;

            this.x = formX + (this.scatterX - formX) * disperse;
            this.y = formY + (this.scatterY - formY) * disperse;
            this.z = formZ + (this.scatterZ - formZ) * disperse;
        }
    }

    // Generate points
    const numPoints = CONFIG.animation.particleCount;
    const points = [];

    for (let i = 0; i < numPoints; i++) {
        const theta = i * 2.399963; // Golden angle
        const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints);
        const r = 0.85 + Math.sin(theta * 5 + phi * 3) * 0.12;

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi);
        const z = r * Math.sin(phi) * Math.sin(theta);

        points.push(new Point3D(x, y, z, i, numPoints));
    }

    // Generate mesh triangles
    const triangles = [];

    for (let i = 0; i < numPoints; i++) {
        const p1 = points[i];

        const distances = points.map((p2, j) => ({
            index: j,
            dist: Math.sqrt(
                (p2.targetX - p1.targetX) ** 2 +
                (p2.targetY - p1.targetY) ** 2 +
                (p2.targetZ - p1.targetZ) ** 2
            )
        })).filter(d => d.index !== i).sort((a, b) => a.dist - b.dist);

        if (distances.length >= 2 && distances[0].dist < CONFIG.animation.distanceThreshold) {
            triangles.push({
                indices: [i, distances[0].index, distances[1].index],
                delay: i / numPoints
            });
        }
    }

    // Mouse tracking
    let mouseInfluence = 0;
    let targetMouseInfluence = 0;

    document.addEventListener('mousemove', (e) => {
        targetMouseX = e.clientX;
        targetMouseY = e.clientY;
        targetMouseInfluence = 1;
    });

    document.addEventListener('mouseleave', () => {
        targetMouseInfluence = 0;
    });

    // Scroll tracking
    window.addEventListener('scroll', () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        scrollProgress = window.scrollY / maxScroll;

        const sections = document.querySelectorAll('section');
        const navDots = document.querySelectorAll('.nav-dot');

        sections.forEach((sec, i) => {
            const rect = sec.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.6 && rect.bottom > 0) {
                sec.classList.add('visible');
                navDots.forEach(dot => dot.classList.remove('active'));
                navDots[i]?.classList.add('active');
            }
        });
    });

    // Navigation click
    document.querySelectorAll('.nav-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const target = document.getElementById(dot.dataset.section);
            target?.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Color function
    function getHolographicColor(depth, phase, alpha, isLight) {
        const hue = (depth * 60 + phase * 30 + time * 20) % 360;

        if (isLight) {
            const saturation = 70;
            const lightness = 35 + depth * 15;
            return `hsla(${200 + hue * 0.3}, ${saturation}%, ${lightness}%, ${alpha})`;
        } else {
            const saturation = 80;
            const lightness = 50 + depth * 20;
            return `hsla(${180 + hue * 0.5}, ${saturation}%, ${lightness}%, ${alpha})`;
        }
    }

    // Render loop
    function render() {
        time += 0.008;

        mouseX += (targetMouseX - mouseX) * 0.05;
        mouseY += (targetMouseY - mouseY) * 0.05;
        mouseInfluence += (targetMouseInfluence - mouseInfluence) * 0.03;

        const isLight = document.documentElement.getAttribute('data-theme') === 'light';

        ctx.fillStyle = isLight ? '#fafafa' : '#050508';
        ctx.fillRect(0, 0, width, height);

        const cycleDuration = CONFIG.animation.cycleSeconds;
        const cycleTime = time % cycleDuration;
        const quarter = cycleDuration / 4;

        let gatherProgress, meshProgress, disperseProgress;
        let stageText = '';
        let stageProgress = 0;

        if (cycleTime < quarter) {
            gatherProgress = cycleTime / quarter;
            meshProgress = 0;
            disperseProgress = 0;
            stageText = 'POINT CLOUD ACQUISITION';
            stageProgress = gatherProgress;
        } else if (cycleTime < quarter * 2) {
            gatherProgress = 1;
            meshProgress = (cycleTime - quarter) / quarter;
            disperseProgress = 0;
            stageText = 'SURFACE RECONSTRUCTION';
            stageProgress = meshProgress;
        } else if (cycleTime < quarter * 3) {
            gatherProgress = 1;
            meshProgress = 1;
            disperseProgress = 0;
            stageText = '3D MODEL COMPLETE';
            stageProgress = 1;
        } else {
            gatherProgress = 1;
            meshProgress = 1 - (cycleTime - quarter * 3) / quarter;
            disperseProgress = (cycleTime - quarter * 3) / quarter;
            stageText = 'PREPARING NEXT SCAN';
            stageProgress = 1 - disperseProgress;
        }

        points.forEach(p => p.update(gatherProgress, disperseProgress));

        const rotY = time * 0.3 + (mouseX / width - 0.5) * mouseInfluence * 0.8;
        const rotX = 0.25 + (mouseY / height - 0.5) * mouseInfluence * 0.4;

        const fadeAlpha = Math.max(0, 1 - scrollProgress * 2);

        if (fadeAlpha <= 0) {
            requestAnimationFrame(render);
            return;
        }

        const transformed = points.map((p, i) => {
            let pos = { x: p.x, y: p.y, z: p.z };
            pos = rotateY(pos, rotY);
            pos = rotateX(pos, rotX);
            const proj = project(pos);
            return { ...proj, index: i, point: p };
        });

        const sorted = [...transformed].sort((a, b) => b.z - a.z);

        const easedMesh = easeOutQuart(meshProgress);

        if (easedMesh > 0) {
            const sortedTris = triangles.map(tri => {
                const p1 = transformed[tri.indices[0]];
                const p2 = transformed[tri.indices[1]];
                const p3 = transformed[tri.indices[2]];
                const avgZ = (p1.z + p2.z + p3.z) / 3;
                return { ...tri, p1, p2, p3, avgZ };
            }).sort((a, b) => b.avgZ - a.avgZ);

            sortedTris.forEach(tri => {
                const triProgress = Math.max(0, Math.min(1, (easedMesh - tri.delay * 0.5) * 2));
                if (triProgress <= 0) return;

                const { p1, p2, p3, avgZ } = tri;
                const depth = (avgZ + 1.5) / 3;

                const fillAlpha = triProgress * fadeAlpha * 0.12 * depth;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.closePath();
                ctx.fillStyle = getHolographicColor(depth, tri.delay, fillAlpha, isLight);
                ctx.fill();

                const edgeAlpha = triProgress * fadeAlpha * 0.25 * depth;
                ctx.strokeStyle = getHolographicColor(depth, tri.delay + 0.5, edgeAlpha, isLight);
                ctx.lineWidth = 0.8;
                ctx.stroke();
            });
        }

        sorted.forEach(tp => {
            const depth = (tp.z + 1.5) / 3;
            const size = (1 + depth * 1.5) * tp.scale;

            let pointFade = 1;
            if (meshProgress > 0.3) {
                const fadeProgress = (meshProgress - 0.3) / 0.7;
                pointFade = 1 - easeInOutCubic(fadeProgress) * 0.85;
            }
            const alpha = fadeAlpha * (0.3 + depth * 0.7) * pointFade;

            if (alpha <= 0.01) return;

            const glowSize = size * 4;
            const gradient = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, glowSize);
            const glowColor = getHolographicColor(depth, tp.index / numPoints, alpha * 0.4, isLight);
            const coreColor = getHolographicColor(depth, tp.index / numPoints, alpha, isLight);

            gradient.addColorStop(0, coreColor);
            gradient.addColorStop(0.3, glowColor);
            gradient.addColorStop(1, 'transparent');

            ctx.beginPath();
            ctx.arc(tp.x, tp.y, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(tp.x, tp.y, size * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = isLight
                ? `hsla(210, 80%, 40%, ${alpha * 1.2})`
                : `hsla(190, 100%, 80%, ${alpha * 1.2})`;
            ctx.fill();
        });

        if (fadeAlpha > 0.3) {
            const uiAlpha = fadeAlpha * 0.8;

            ctx.font = '11px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = isLight
                ? `rgba(0, 0, 0, ${uiAlpha * 0.7})`
                : `rgba(255, 255, 255, ${uiAlpha * 0.7})`;
            ctx.fillText(stageText, width / 2, height - 55);

            const barWidth = 180;
            const barHeight = 2;
            const barX = width / 2 - barWidth / 2;
            const barY = height - 38;

            ctx.fillStyle = isLight
                ? `rgba(0, 0, 0, ${uiAlpha * 0.1})`
                : `rgba(255, 255, 255, ${uiAlpha * 0.1})`;
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const progGradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
            if (isLight) {
                progGradient.addColorStop(0, `rgba(0, 150, 200, ${uiAlpha})`);
                progGradient.addColorStop(1, `rgba(100, 50, 180, ${uiAlpha})`);
            } else {
                progGradient.addColorStop(0, `rgba(100, 220, 255, ${uiAlpha})`);
                progGradient.addColorStop(1, `rgba(200, 150, 255, ${uiAlpha})`);
            }
            ctx.fillStyle = progGradient;
            ctx.fillRect(barX, barY, barWidth * stageProgress, barHeight);
        }

        requestAnimationFrame(render);
    }

    render();

} else if (canvas) {
    // Reduced motion: just show a static background matching the theme
    const ctx = canvas.getContext('2d');
    function drawStaticBg() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        ctx.fillStyle = isLight ? '#fafafa' : '#050508';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawStaticBg();
    window.addEventListener('resize', drawStaticBg);

    // Still need scroll/nav handling for the page
    window.addEventListener('scroll', () => {
        const sections = document.querySelectorAll('section');
        const navDots = document.querySelectorAll('.nav-dot');
        sections.forEach((sec, i) => {
            const rect = sec.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.6 && rect.bottom > 0) {
                sec.classList.add('visible');
                navDots.forEach(dot => dot.classList.remove('active'));
                navDots[i]?.classList.add('active');
            }
        });
    });

    document.querySelectorAll('.nav-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const target = document.getElementById(dot.dataset.section);
            target?.scrollIntoView({ behavior: 'smooth' });
        });
    });
}
