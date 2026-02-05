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

        // 프로젝트 카운트 애니메이션 (PROJECT 태그만)
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
                               project.tag === 'RESEARCH' ? 'research' : '';
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
// 인터랙티브 포인트 클라우드 시각화
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

// 포인트 클래스
class Point {
    constructor() {
        this.reset();
    }

    reset() {
        // 구면 분포로 초기 위치 설정
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 0.8 + Math.random() * 0.4;

        this.baseX = r * Math.sin(phi) * Math.cos(theta);
        this.baseY = r * Math.sin(phi) * Math.sin(theta);
        this.baseZ = r * Math.cos(phi);

        this.x = this.baseX;
        this.y = this.baseY;
        this.z = this.baseZ;

        this.size = Math.random() * 2 + 0.5;
        this.speed = 0.0005 + Math.random() * 0.001;
        this.offset = Math.random() * Math.PI * 2;
        this.pulseSpeed = 0.5 + Math.random() * 1;
        this.orbitSpeed = 0.1 + Math.random() * 0.2;
    }

    update(time, mouseInfluence, rotY, rotX) {
        // 기본 회전 궤도 운동
        const orbitAngle = time * this.orbitSpeed + this.offset;

        // 호흡하는 듯한 확장/수축
        const breathe = 1 + Math.sin(time * this.pulseSpeed + this.offset) * 0.15;

        // 파동 효과
        const wave = Math.sin(time * 2 + this.baseX * 3 + this.baseY * 3) * 0.1;

        let px = this.baseX * breathe + wave * this.baseX;
        let py = this.baseY * breathe + wave * this.baseY;
        let pz = this.baseZ * breathe + wave * this.baseZ;

        // Y축 회전
        let x1 = px * Math.cos(rotY) - pz * Math.sin(rotY);
        let z1 = px * Math.sin(rotY) + pz * Math.cos(rotY);

        // X축 회전
        let y1 = py * Math.cos(rotX) - z1 * Math.sin(rotX);
        let z2 = py * Math.sin(rotX) + z1 * Math.cos(rotX);

        this.x = x1;
        this.y = y1;
        this.z = z2;

        // 마우스 상호작용 - 밀어내기/끌어당기기
        const screenX = (this.x / (this.z + 3)) * 400 + width / 2;
        const screenY = (this.y / (this.z + 3)) * 400 + height / 2;

        const dx = screenX - mouseX;
        const dy = screenY - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 200) {
            const force = (200 - dist) / 200;
            const angle = Math.atan2(dy, dx);
            const push = force * 0.3 * mouseInfluence;

            this.x += Math.cos(angle) * push * 0.1;
            this.y += Math.sin(angle) * push * 0.1;
        }
    }

    draw(ctx, isLight, fadeAlpha) {
        const perspective = 3;
        const scale = perspective / (perspective + this.z);

        const screenX = this.x * scale * 400 + width / 2;
        const screenY = this.y * scale * 400 + height / 2;

        if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) return;

        const depth = (this.z + 1.5) / 3; // 0 to 1
        const size = this.size * scale * (1 + depth * 0.5);
        const alpha = fadeAlpha * (0.3 + depth * 0.7) * scale;

        if (alpha <= 0 || size <= 0) return;

        // 글로우 효과
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size * 3);

        if (isLight) {
            gradient.addColorStop(0, `rgba(0, 102, 204, ${alpha})`);
            gradient.addColorStop(0.3, `rgba(0, 102, 204, ${alpha * 0.5})`);
            gradient.addColorStop(1, `rgba(0, 102, 204, 0)`);
        } else {
            gradient.addColorStop(0, `rgba(100, 220, 255, ${alpha})`);
            gradient.addColorStop(0.3, `rgba(0, 180, 255, ${alpha * 0.5})`);
            gradient.addColorStop(1, `rgba(0, 150, 255, 0)`);
        }

        ctx.beginPath();
        ctx.arc(screenX, screenY, size * 3, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 코어
        ctx.beginPath();
        ctx.arc(screenX, screenY, size * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = isLight
            ? `rgba(0, 80, 180, ${alpha * 1.2})`
            : `rgba(200, 240, 255, ${alpha * 1.2})`;
        ctx.fill();

        return { x: screenX, y: screenY, z: this.z, alpha, size };
    }
}

// 연결선을 위한 포인트 저장
let drawnPoints = [];

// 포인트 생성
const points = [];
const numPoints = 800;

for (let i = 0; i < numPoints; i++) {
    points.push(new Point());
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

// 렌더링
function render() {
    time += 0.016;

    // 마우스 스무딩
    mouseX += (targetMouseX - mouseX) * 0.08;
    mouseY += (targetMouseY - mouseY) * 0.08;
    mouseInfluence += (targetMouseInfluence - mouseInfluence) * 0.05;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // 배경
    ctx.fillStyle = isLight ? '#fafafa' : '#050508';
    ctx.fillRect(0, 0, width, height);

    // 회전 (마우스 + 자동)
    const autoRotY = time * 0.15;
    const mouseRotY = ((mouseX / width) - 0.5) * 0.5 * mouseInfluence;
    const mouseRotX = ((mouseY / height) - 0.5) * 0.3 * mouseInfluence;

    const rotY = autoRotY + mouseRotY;
    const rotX = 0.3 + mouseRotX;

    // 스크롤에 따른 페이드
    const fadeAlpha = Math.max(0, 1 - scrollProgress * 2);

    // 포인트 업데이트 및 수집
    drawnPoints = [];

    points.forEach(point => {
        point.update(time, mouseInfluence, rotY, rotX);
    });

    // Z 정렬 (뒤에서 앞으로)
    const sortedPoints = [...points].sort((a, b) => b.z - a.z);

    // 연결선 그리기 (가까운 점들 연결)
    ctx.lineWidth = 0.5;

    sortedPoints.forEach((point, i) => {
        const perspective = 3;
        const scale = perspective / (perspective + point.z);
        const screenX = point.x * scale * 400 + width / 2;
        const screenY = point.y * scale * 400 + height / 2;

        // 가까운 점들과 연결
        for (let j = i + 1; j < Math.min(i + 20, sortedPoints.length); j++) {
            const other = sortedPoints[j];
            const otherScale = perspective / (perspective + other.z);
            const otherX = other.x * otherScale * 400 + width / 2;
            const otherY = other.y * otherScale * 400 + height / 2;

            const dx = screenX - otherX;
            const dy = screenY - otherY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 80) {
                const lineAlpha = (1 - dist / 80) * fadeAlpha * 0.15;
                ctx.strokeStyle = isLight
                    ? `rgba(0, 102, 204, ${lineAlpha})`
                    : `rgba(100, 200, 255, ${lineAlpha})`;
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(otherX, otherY);
                ctx.stroke();
            }
        }
    });

    // 포인트 그리기
    sortedPoints.forEach(point => {
        point.draw(ctx, isLight, fadeAlpha);
    });

    // 마우스 주변 강조 효과
    if (mouseInfluence > 0.1 && fadeAlpha > 0.1) {
        const glowSize = 150 + Math.sin(time * 3) * 20;
        const gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, glowSize);

        if (isLight) {
            gradient.addColorStop(0, `rgba(0, 102, 204, ${0.05 * mouseInfluence * fadeAlpha})`);
            gradient.addColorStop(1, 'rgba(0, 102, 204, 0)');
        } else {
            gradient.addColorStop(0, `rgba(0, 200, 255, ${0.08 * mouseInfluence * fadeAlpha})`);
            gradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
        }

        ctx.beginPath();
        ctx.arc(mouseX, mouseY, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
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
