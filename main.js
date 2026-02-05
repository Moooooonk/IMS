// 로딩 스크린
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
        document.querySelector('#hero').classList.add('visible');
    }, 800);

    loadProjects();
});

// 프로젝트 JSON 로드
async function loadProjects() {
    try {
        const response = await fetch('projects.json');
        const projects = await response.json();
        const grid = document.getElementById('projectsGrid');

        const projectCountEl = document.getElementById('projectCount');
        if (projectCountEl) {
            const projectOnly = projects.filter(p => p.tag === 'PROJECT').length;
            animateNumber(projectCountEl, projectOnly);
        }

        if (grid) {
            const displayProjects = projects.slice(0, 6);
            grid.innerHTML = displayProjects.map(project => {
                const tagClass = project.tag === 'PROJECT' ? 'project' :
                               project.tag === 'ARCHIVE' ? 'archive' :
                               project.tag === 'RESEARCH' ? 'research' :
                               project.tag === 'TECHNICAL' ? 'technical' : '';
                return `
                    <a href="${project.url}" target="_blank" class="card">
                        <span class="tag ${tagClass}">${project.tag}</span>
                        <h3>${project.title}</h3>
                        <p>${project.description}</p>
                    </a>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('프로젝트 로드 실패:', error);
    }
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

const canvas = document.getElementById('dct-canvas');
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

// Easing 함수들
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
}

function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// 3D 변환
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

// 3D 형태 생성 (유기적인 형태)
class Point3D {
    constructor(x, y, z, index, total) {
        this.targetX = x;
        this.targetY = y;
        this.targetZ = z;
        this.index = index;
        this.total = total;

        // 시작 위치 (흩어진 상태)
        const scatter = 3;
        const angle = index * 2.399963;
        const radius = 1.5 + Math.random() * scatter;
        this.scatterX = Math.cos(angle) * radius * (Math.random() - 0.5) * 2;
        this.scatterY = (Math.random() - 0.5) * scatter * 2;
        this.scatterZ = Math.sin(angle) * radius * (Math.random() - 0.5) * 2;

        this.x = this.scatterX;
        this.y = this.scatterY;
        this.z = this.scatterZ;

        // 개별 애니메이션 딜레이
        this.delay = (index / total) * 0.3;
        this.speed = 0.8 + Math.random() * 0.4;
    }

    update(gatherProgress, disperseProgress) {
        // Gather: 흩어진 상태 → 형태
        // Disperse: 형태 → 흩어진 상태

        const gather = easeOutQuart(Math.max(0, Math.min(1, (gatherProgress - this.delay) * 1.5)));
        const disperse = easeInOutCubic(disperseProgress);

        // 현재 위치 계산
        const formX = this.scatterX + (this.targetX - this.scatterX) * gather;
        const formY = this.scatterY + (this.targetY - this.scatterY) * gather;
        const formZ = this.scatterZ + (this.targetZ - this.scatterZ) * gather;

        // Disperse할 때 새로운 scatter 위치로
        this.x = formX + (this.scatterX - formX) * disperse;
        this.y = formY + (this.scatterY - formY) * disperse;
        this.z = formZ + (this.scatterZ - formZ) * disperse;
    }
}

// 포인트 생성 (Stanford Bunny 스타일)
const numPoints = 600;
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

// 메쉬 삼각형 생성
const triangles = [];

for (let i = 0; i < numPoints; i++) {
    const p1 = points[i];

    // K-nearest neighbors 방식으로 삼각형 생성
    const distances = points.map((p2, j) => ({
        index: j,
        dist: Math.sqrt(
            (p2.targetX - p1.targetX) ** 2 +
            (p2.targetY - p1.targetY) ** 2 +
            (p2.targetZ - p1.targetZ) ** 2
        )
    })).filter(d => d.index !== i).sort((a, b) => a.dist - b.dist);

    // 가장 가까운 2개 점과 삼각형 형성
    if (distances.length >= 2 && distances[0].dist < 0.35) {
        triangles.push({
            indices: [i, distances[0].index, distances[1].index],
            delay: i / numPoints
        });
    }
}

// 마우스 트래킹
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

// 스크롤 트래킹
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

// 네비게이션 클릭
document.querySelectorAll('.nav-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        const target = document.getElementById(dot.dataset.section);
        target?.scrollIntoView({ behavior: 'smooth' });
    });
});

// 색상 함수
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

// 렌더링
function render() {
    time += 0.008;

    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;
    mouseInfluence += (targetMouseInfluence - mouseInfluence) * 0.03;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // 배경
    ctx.fillStyle = isLight ? '#fafafa' : '#050508';
    ctx.fillRect(0, 0, width, height);

    // 애니메이션 사이클 (16초)
    const cycleTime = time % 16;

    // 단계별 진행률 (부드러운 전환)
    // 0-4: 포인트 수집 (Sparse → Dense)
    // 4-8: 메쉬 형성 (Surface Reconstruction)
    // 8-12: 완성된 모델 감상
    // 12-16: 부드럽게 흩어짐 → 다음 사이클

    let gatherProgress, meshProgress, disperseProgress;
    let stageText = '';
    let stageProgress = 0;

    if (cycleTime < 4) {
        // Gathering
        gatherProgress = cycleTime / 4;
        meshProgress = 0;
        disperseProgress = 0;
        stageText = 'POINT CLOUD ACQUISITION';
        stageProgress = gatherProgress;
    } else if (cycleTime < 8) {
        // Mesh formation
        gatherProgress = 1;
        meshProgress = (cycleTime - 4) / 4;
        disperseProgress = 0;
        stageText = 'SURFACE RECONSTRUCTION';
        stageProgress = meshProgress;
    } else if (cycleTime < 12) {
        // Hold & admire
        gatherProgress = 1;
        meshProgress = 1;
        disperseProgress = 0;
        stageText = '3D MODEL COMPLETE';
        stageProgress = 1;
    } else {
        // Disperse smoothly
        gatherProgress = 1;
        meshProgress = 1 - (cycleTime - 12) / 4;
        disperseProgress = (cycleTime - 12) / 4;
        stageText = 'PREPARING NEXT SCAN';
        stageProgress = 1 - disperseProgress;
    }

    // 포인트 업데이트
    points.forEach(p => p.update(gatherProgress, disperseProgress));

    // 전역 회전
    const rotY = time * 0.3 + (mouseX / width - 0.5) * mouseInfluence * 0.8;
    const rotX = 0.25 + (mouseY / height - 0.5) * mouseInfluence * 0.4;

    // 페이드
    const fadeAlpha = Math.max(0, 1 - scrollProgress * 2);

    if (fadeAlpha <= 0) {
        requestAnimationFrame(render);
        return;
    }

    // 포인트 변환
    const transformed = points.map((p, i) => {
        let pos = { x: p.x, y: p.y, z: p.z };
        pos = rotateY(pos, rotY);
        pos = rotateX(pos, rotX);
        const proj = project(pos);
        return { ...proj, index: i, point: p };
    });

    // Z 정렬
    const sorted = [...transformed].sort((a, b) => b.z - a.z);

    // 메쉬 그리기
    const easedMesh = easeOutQuart(meshProgress);

    if (easedMesh > 0) {
        // 삼각형들 Z 정렬
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

            // 면 채우기 (홀로그래픽)
            const fillAlpha = triProgress * fadeAlpha * 0.12 * depth;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();
            ctx.fillStyle = getHolographicColor(depth, tri.delay, fillAlpha, isLight);
            ctx.fill();

            // 엣지 (와이어프레임)
            const edgeAlpha = triProgress * fadeAlpha * 0.25 * depth;
            ctx.strokeStyle = getHolographicColor(depth, tri.delay + 0.5, edgeAlpha, isLight);
            ctx.lineWidth = 0.8;
            ctx.stroke();
        });
    }

    // 포인트 그리기
    sorted.forEach(tp => {
        const depth = (tp.z + 1.5) / 3;
        const size = (1 + depth * 1.5) * tp.scale;

        // 메쉬가 형성되면서 포인트가 서서히 페이드 (0.3부터 시작)
        let pointFade = 1;
        if (meshProgress > 0.3) {
            const fadeProgress = (meshProgress - 0.3) / 0.7; // 0.3~1.0 구간을 0~1로
            pointFade = 1 - easeInOutCubic(fadeProgress) * 0.85; // 최소 0.15까지만 페이드
        }
        const alpha = fadeAlpha * (0.3 + depth * 0.7) * pointFade;

        if (alpha <= 0.01) return;

        // 글로우
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

        // 코어
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = isLight
            ? `hsla(210, 80%, 40%, ${alpha * 1.2})`
            : `hsla(190, 100%, 80%, ${alpha * 1.2})`;
        ctx.fill();
    });

    // UI 텍스트
    if (fadeAlpha > 0.3) {
        const uiAlpha = fadeAlpha * 0.8;

        // 스테이지 텍스트
        ctx.font = '11px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = isLight
            ? `rgba(0, 0, 0, ${uiAlpha * 0.7})`
            : `rgba(255, 255, 255, ${uiAlpha * 0.7})`;
        ctx.fillText(stageText, width / 2, height - 55);

        // 프로그레스 바
        const barWidth = 180;
        const barHeight = 2;
        const barX = width / 2 - barWidth / 2;
        const barY = height - 38;

        // 배경
        ctx.fillStyle = isLight
            ? `rgba(0, 0, 0, ${uiAlpha * 0.1})`
            : `rgba(255, 255, 255, ${uiAlpha * 0.1})`;
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // 프로그레스
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

// 테마 토글
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
    html.setAttribute('data-theme', 'light');
}

themeToggle.addEventListener('click', () => {
    const isLight = html.getAttribute('data-theme') === 'light';
    if (isLight) {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
    } else {
        html.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
});
