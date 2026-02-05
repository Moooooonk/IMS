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

        // 프로젝트 그리드가 있으면 렌더링 (메인 페이지에서는 최신 6개만)
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

// 숫자 애니메이션
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

// 3D 포인트 클라우드 시각화
const canvas = document.getElementById('dct-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let mouseX = 0.5, mouseY = 0.5;
let targetMouseX = 0.5, targetMouseY = 0.5;
let scrollProgress = 0;
let time = 0;

// 캔버스 크기
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// 3D 포인트 클라우드 생성 - 다양한 3D 형태
const points = [];
const numPoints = 2000;

// Stanford Bunny 스타일의 3D 형태 생성 (구면 + 노이즈)
for (let i = 0; i < numPoints; i++) {
    // 구면 좌표계로 분포
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1 + (Math.random() - 0.5) * 0.3;

    // 약간의 변형을 추가해 유기적인 형태로
    const deform = Math.sin(theta * 3) * Math.cos(phi * 2) * 0.2;

    points.push({
        x: (r + deform) * Math.sin(phi) * Math.cos(theta),
        y: (r + deform) * Math.sin(phi) * Math.sin(theta),
        z: (r + deform) * Math.cos(phi),
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.5
    });
}

// 카메라 frustum 포인트 (3D CV 느낌)
const frustumPoints = [];
const frustumDepth = 2;
const frustumWidth = 1.2;

// 카메라 위치에서 뻗어나가는 frustum
for (let i = 0; i < 200; i++) {
    const t = Math.random();
    const angle = Math.random() * Math.PI * 2;
    const spread = t * frustumWidth;

    frustumPoints.push({
        x: Math.cos(angle) * spread - 2.5,
        y: Math.sin(angle) * spread,
        z: -t * frustumDepth + 1,
        size: 1.5,
        alpha: 1 - t * 0.7
    });
}

// 좌표축 (X, Y, Z)
const axisPoints = [];
const axisLength = 1.8;
for (let i = 0; i < 50; i++) {
    const t = i / 50;
    // X축 (빨강)
    axisPoints.push({ x: t * axisLength, y: 0, z: 0, color: [255, 100, 100], size: 2 });
    // Y축 (초록)
    axisPoints.push({ x: 0, y: t * axisLength, z: 0, color: [100, 255, 100], size: 2 });
    // Z축 (파랑)
    axisPoints.push({ x: 0, y: 0, z: t * axisLength, color: [100, 150, 255], size: 2 });
}

// 3D → 2D 투영
function project(x, y, z, rotX, rotY) {
    // Y축 회전
    let x1 = x * Math.cos(rotY) - z * Math.sin(rotY);
    let z1 = x * Math.sin(rotY) + z * Math.cos(rotY);

    // X축 회전
    let y1 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
    let z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);

    // 원근 투영
    const fov = 4;
    const scale = fov / (fov + z2);

    return {
        x: x1 * scale,
        y: y1 * scale,
        z: z2,
        scale: scale
    };
}

// 마우스 트래킹
document.addEventListener('mousemove', (e) => {
    targetMouseX = e.clientX / width;
    targetMouseY = e.clientY / height;
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
    time += 0.008;

    // 마우스 스무딩
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // 배경
    ctx.fillStyle = isLight ? '#fafafa' : '#050508';
    ctx.fillRect(0, 0, width, height);

    // 회전 각도 (마우스 + 자동 회전)
    const rotY = time * 0.3 + (mouseX - 0.5) * 1.5;
    const rotX = (mouseY - 0.5) * 0.8 + 0.3;

    const centerX = width / 2;
    const centerY = height / 2;
    const baseScale = Math.min(width, height) * 0.25;

    // 스크롤에 따른 페이드
    const fadeAlpha = Math.max(0, 1 - scrollProgress * 2);

    // 모든 포인트를 투영하고 정렬
    const projectedPoints = [];

    // 메인 포인트 클라우드
    points.forEach(p => {
        const proj = project(p.x, p.y, p.z, rotX, rotY);
        projectedPoints.push({
            screenX: centerX + proj.x * baseScale,
            screenY: centerY + proj.y * baseScale,
            z: proj.z,
            size: p.size * proj.scale * (1 - scrollProgress * 0.5),
            alpha: p.alpha * fadeAlpha * (0.3 + proj.scale * 0.5),
            type: 'main'
        });
    });

    // Frustum 포인트
    frustumPoints.forEach(p => {
        const proj = project(p.x, p.y, p.z, rotX, rotY);
        projectedPoints.push({
            screenX: centerX + proj.x * baseScale,
            screenY: centerY + proj.y * baseScale,
            z: proj.z,
            size: p.size * proj.scale,
            alpha: p.alpha * fadeAlpha * 0.6,
            type: 'frustum'
        });
    });

    // 좌표축
    axisPoints.forEach(p => {
        const proj = project(p.x, p.y, p.z, rotX, rotY);
        projectedPoints.push({
            screenX: centerX + proj.x * baseScale,
            screenY: centerY + proj.y * baseScale,
            z: proj.z,
            size: p.size * proj.scale,
            alpha: fadeAlpha * 0.8,
            color: p.color,
            type: 'axis'
        });
    });

    // Z 정렬 (뒤에서 앞으로)
    projectedPoints.sort((a, b) => b.z - a.z);

    // 그리기
    projectedPoints.forEach(p => {
        if (p.alpha <= 0 || p.size <= 0) return;

        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, p.size, 0, Math.PI * 2);

        if (p.type === 'axis' && p.color) {
            ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.alpha})`;
        } else if (p.type === 'frustum') {
            ctx.fillStyle = isLight
                ? `rgba(0, 102, 204, ${p.alpha})`
                : `rgba(0, 242, 255, ${p.alpha})`;
        } else {
            ctx.fillStyle = isLight
                ? `rgba(60, 60, 80, ${p.alpha})`
                : `rgba(200, 220, 255, ${p.alpha})`;
        }

        ctx.fill();
    });

    // 카메라 아이콘 (원점 표시)
    if (fadeAlpha > 0.3) {
        const camProj = project(-2.5, 0, 1, rotX, rotY);
        const camX = centerX + camProj.x * baseScale;
        const camY = centerY + camProj.y * baseScale;
        const camSize = 12 * camProj.scale;

        ctx.strokeStyle = isLight
            ? `rgba(0, 102, 204, ${fadeAlpha * 0.8})`
            : `rgba(0, 242, 255, ${fadeAlpha * 0.8})`;
        ctx.lineWidth = 2;

        // 카메라 박스
        ctx.strokeRect(camX - camSize, camY - camSize * 0.7, camSize * 2, camSize * 1.4);

        // 렌즈
        ctx.beginPath();
        ctx.arc(camX + camSize * 1.3, camY, camSize * 0.4, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 하단 텍스트
    if (scrollProgress < 0.15) {
        const textAlpha = (1 - scrollProgress * 6.5) * 0.6;
        ctx.fillStyle = isLight
            ? `rgba(0, 102, 204, ${textAlpha})`
            : `rgba(0, 242, 255, ${textAlpha})`;
        ctx.font = '12px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('POINT CLOUD VISUALIZATION — 3D COMPUTER VISION', width / 2, height - 40);
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
