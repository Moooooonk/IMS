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
// 3D CV Pipeline Visualization
// Registration → Mesh Reconstruction
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

// 3D 변환 함수
function rotateY(x, y, z, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x * cos - z * sin,
        y: y,
        z: x * sin + z * cos
    };
}

function rotateX(x, y, z, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x,
        y: y * cos - z * sin,
        z: y * sin + z * cos
    };
}

function project(x, y, z) {
    const perspective = 4;
    const scale = perspective / (perspective + z);
    return {
        x: x * scale * 300 + width / 2,
        y: y * scale * 300 + height / 2,
        scale: scale,
        z: z
    };
}

// Stanford Bunny 스타일 3D 형태 생성
function generateShape(numPoints, seed = 0) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const theta = (i + seed) * 2.399963 + seed; // Golden angle
        const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints);
        const r = 0.8 + Math.sin(theta * 3 + phi * 2) * 0.15;

        points.push({
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta) * 0.9,
            z: r * Math.cos(phi),
            origX: r * Math.sin(phi) * Math.cos(theta),
            origY: r * Math.sin(phi) * Math.sin(theta) * 0.9,
            origZ: r * Math.cos(phi)
        });
    }
    return points;
}

// 두 포인트 클라우드 생성 (Source: 시안, Target: 마젠타)
const numPoints = 500;
const sourceCloud = generateShape(numPoints, 0);
const targetCloud = generateShape(numPoints, 0);

// Source cloud 초기 변환 (misaligned 상태)
const initialRotation = { x: 0.5, y: 0.8, z: 0.3 };
const initialTranslation = { x: 0.6, y: -0.3, z: 0.2 };

sourceCloud.forEach(p => {
    // 초기 회전
    let rotated = rotateY(p.origX, p.origY, p.origZ, initialRotation.y);
    rotated = rotateX(rotated.x, rotated.y, rotated.z, initialRotation.x);

    p.startX = rotated.x + initialTranslation.x;
    p.startY = rotated.y + initialTranslation.y;
    p.startZ = rotated.z + initialTranslation.z;

    p.x = p.startX;
    p.y = p.startY;
    p.z = p.startZ;
});

// 메쉬 삼각형 생성 (Delaunay-like)
function generateMeshTriangles(points) {
    const triangles = [];
    const sorted = [...points].sort((a, b) => a.origY - b.origY);

    for (let i = 0; i < sorted.length - 2; i++) {
        const p1 = sorted[i];

        // 가까운 점들 찾기
        const nearby = sorted.slice(i + 1, i + 15).sort((a, b) => {
            const distA = Math.sqrt((a.origX - p1.origX) ** 2 + (a.origZ - p1.origZ) ** 2);
            const distB = Math.sqrt((b.origX - p1.origX) ** 2 + (b.origZ - p1.origZ) ** 2);
            return distA - distB;
        });

        if (nearby.length >= 2) {
            triangles.push([points.indexOf(p1), points.indexOf(nearby[0]), points.indexOf(nearby[1])]);
        }
    }

    return triangles.slice(0, 300); // 적당한 수의 삼각형만
}

const meshTriangles = generateMeshTriangles(targetCloud);

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
    time += 0.012;

    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;
    mouseInfluence += (targetMouseInfluence - mouseInfluence) * 0.03;

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // 배경
    ctx.fillStyle = isLight ? '#fafafa' : '#050508';
    ctx.fillRect(0, 0, width, height);

    // 애니메이션 단계 (시간 기반 + 루프)
    const cycleTime = time % 12; // 12초 주기

    // 0-4초: Registration 진행
    // 4-8초: Mesh 형성
    // 8-12초: 완성된 상태 유지 후 리셋

    const registrationProgress = Math.min(1, cycleTime / 4);
    const meshProgress = Math.max(0, Math.min(1, (cycleTime - 4) / 4));
    const holdPhase = cycleTime > 8;

    // Easing
    const easeRegistration = 1 - Math.pow(1 - registrationProgress, 3);
    const easeMesh = 1 - Math.pow(1 - meshProgress, 2);

    // 전체 회전
    const globalRotY = time * 0.2 + (mouseX / width - 0.5) * 0.5 * mouseInfluence;
    const globalRotX = 0.2 + (mouseY / height - 0.5) * 0.3 * mouseInfluence;

    // 페이드
    const fadeAlpha = Math.max(0, 1 - scrollProgress * 2);

    // Source cloud 위치 업데이트 (registration 애니메이션)
    sourceCloud.forEach((p, i) => {
        const target = targetCloud[i];
        p.x = p.startX + (target.origX - p.startX) * easeRegistration;
        p.y = p.startY + (target.origY - p.startY) * easeRegistration;
        p.z = p.startZ + (target.origZ - p.startZ) * easeRegistration;
    });

    // 모든 포인트 변환 및 투영
    const transformedSource = sourceCloud.map(p => {
        let rot = rotateY(p.x, p.y, p.z, globalRotY);
        rot = rotateX(rot.x, rot.y, rot.z, globalRotX);
        return { ...project(rot.x, rot.y, rot.z), orig: p };
    });

    const transformedTarget = targetCloud.map(p => {
        let rot = rotateY(p.origX, p.origY, p.origZ, globalRotY);
        rot = rotateX(rot.x, rot.y, rot.z, globalRotX);
        return { ...project(rot.x, rot.y, rot.z), orig: p };
    });

    // 메쉬 그리기 (mesh 단계에서)
    if (easeMesh > 0 && fadeAlpha > 0) {
        meshTriangles.forEach((tri, idx) => {
            const delay = idx / meshTriangles.length;
            const triProgress = Math.max(0, Math.min(1, (easeMesh - delay * 0.5) * 2));

            if (triProgress <= 0) return;

            const p1 = transformedTarget[tri[0]];
            const p2 = transformedTarget[tri[1]];
            const p3 = transformedTarget[tri[2]];

            if (!p1 || !p2 || !p3) return;

            const avgZ = (p1.z + p2.z + p3.z) / 3;
            const depth = (avgZ + 2) / 4;

            // 면 채우기
            const fillAlpha = triProgress * fadeAlpha * 0.08 * depth;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.closePath();

            if (isLight) {
                ctx.fillStyle = `rgba(100, 50, 150, ${fillAlpha})`;
            } else {
                ctx.fillStyle = `rgba(100, 200, 255, ${fillAlpha})`;
            }
            ctx.fill();

            // 와이어프레임
            const wireAlpha = triProgress * fadeAlpha * 0.3 * depth;
            ctx.strokeStyle = isLight
                ? `rgba(100, 50, 150, ${wireAlpha})`
                : `rgba(150, 220, 255, ${wireAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        });
    }

    // Correspondence lines (registration 진행 중)
    if (easeRegistration < 1 && easeRegistration > 0 && fadeAlpha > 0) {
        const lineAlpha = (1 - easeRegistration) * fadeAlpha * 0.3;

        for (let i = 0; i < sourceCloud.length; i += 8) {
            const src = transformedSource[i];
            const tgt = transformedTarget[i];

            if (!src || !tgt) continue;

            const gradient = ctx.createLinearGradient(src.x, src.y, tgt.x, tgt.y);
            if (isLight) {
                gradient.addColorStop(0, `rgba(0, 150, 200, ${lineAlpha})`);
                gradient.addColorStop(1, `rgba(180, 50, 150, ${lineAlpha})`);
            } else {
                gradient.addColorStop(0, `rgba(0, 255, 255, ${lineAlpha})`);
                gradient.addColorStop(1, `rgba(255, 100, 200, ${lineAlpha})`);
            }

            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(tgt.x, tgt.y);
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    // Z 정렬을 위해 합치기
    const allPoints = [
        ...transformedSource.map(p => ({ ...p, type: 'source' })),
        ...transformedTarget.map(p => ({ ...p, type: 'target' }))
    ].sort((a, b) => b.z - a.z);

    // 포인트 그리기
    allPoints.forEach(p => {
        if (fadeAlpha <= 0) return;

        const depth = (p.z + 2) / 4;
        const size = (1.5 + depth) * p.scale;

        let alpha, color, glowColor;

        if (p.type === 'source') {
            // Registration 완료 후 페이드 아웃
            const sourceAlpha = 1 - easeMesh * 0.8;
            alpha = fadeAlpha * (0.4 + depth * 0.6) * sourceAlpha;

            if (isLight) {
                color = `rgba(0, 130, 180, ${alpha})`;
                glowColor = `rgba(0, 130, 180, ${alpha * 0.3})`;
            } else {
                color = `rgba(50, 220, 255, ${alpha})`;
                glowColor = `rgba(0, 200, 255, ${alpha * 0.3})`;
            }
        } else {
            alpha = fadeAlpha * (0.4 + depth * 0.6);

            if (isLight) {
                color = `rgba(150, 50, 130, ${alpha})`;
                glowColor = `rgba(150, 50, 130, ${alpha * 0.3})`;
            } else {
                color = `rgba(255, 120, 200, ${alpha})`;
                glowColor = `rgba(255, 100, 180, ${alpha * 0.3})`;
            }
        }

        // 글로우
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
        ctx.fillStyle = glowColor;
        ctx.fill();

        // 코어
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    });

    // 단계 표시 텍스트
    if (fadeAlpha > 0.3) {
        ctx.font = '12px "Inter", sans-serif';
        ctx.textAlign = 'center';

        let stageText = '';
        let progress = 0;

        if (cycleTime < 4) {
            stageText = 'POINT CLOUD REGISTRATION';
            progress = registrationProgress;
        } else if (cycleTime < 8) {
            stageText = 'MESH RECONSTRUCTION';
            progress = meshProgress;
        } else {
            stageText = '3D RECONSTRUCTION COMPLETE';
            progress = 1;
        }

        const textAlpha = fadeAlpha * 0.7;
        ctx.fillStyle = isLight
            ? `rgba(0, 0, 0, ${textAlpha})`
            : `rgba(255, 255, 255, ${textAlpha})`;
        ctx.fillText(stageText, width / 2, height - 60);

        // 프로그레스 바
        const barWidth = 200;
        const barHeight = 2;
        const barX = width / 2 - barWidth / 2;
        const barY = height - 40;

        ctx.fillStyle = isLight
            ? `rgba(0, 0, 0, ${textAlpha * 0.2})`
            : `rgba(255, 255, 255, ${textAlpha * 0.2})`;
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const gradientBar = ctx.createLinearGradient(barX, barY, barX + barWidth * progress, barY);
        if (isLight) {
            gradientBar.addColorStop(0, `rgba(0, 130, 180, ${textAlpha})`);
            gradientBar.addColorStop(1, `rgba(150, 50, 130, ${textAlpha})`);
        } else {
            gradientBar.addColorStop(0, `rgba(50, 220, 255, ${textAlpha})`);
            gradientBar.addColorStop(1, `rgba(255, 120, 200, ${textAlpha})`);
        }
        ctx.fillStyle = gradientBar;
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
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
