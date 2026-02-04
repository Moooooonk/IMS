// 로딩 스크린
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
        document.querySelector('#hero').classList.add('visible');
    }, 800);

    // 프로젝트 로드
    loadProjects();
});

// 프로젝트 JSON 로드 및 렌더링
async function loadProjects() {
    try {
        const response = await fetch('projects.json');
        const projects = await response.json();
        const grid = document.getElementById('projectsGrid');

        grid.innerHTML = projects.map(project => {
            const tagClass = project.tag === 'PROJECT' ? 'project' :
                           project.tag === 'ARCHIVE' ? 'archive' : '';
            return `
                <a href="${project.url}" target="_blank" class="card">
                    <span class="tag ${tagClass}">${project.tag}</span>
                    <h3>${project.title}</h3>
                    <p>${project.description}</p>
                </a>
            `;
        }).join('');
    } catch (error) {
        console.error('프로젝트 로드 실패:', error);
    }
}

// Three.js 설정
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// 포인트 클라우드
const count = 30000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(count * 3);
const randoms = new Float32Array(count);

for (let i = 0; i < count; i++) {
    positions[i * 3] = (i % 175) * 0.23 - 20;
    positions[i * 3 + 1] = Math.floor(i / 175) * 0.23 - 20;
    positions[i * 3 + 2] = 0;
    randoms[i] = Math.random();
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uColor: { value: new THREE.Vector3(0.0, 0.95, 1.0) }
    },
    vertexShader: `
        uniform float uTime;
        uniform float uProgress;
        uniform vec2 uMouse;
        attribute float aRandom;
        varying float vAlpha;

        void main() {
            vec3 scatter = position + vec3(
                sin(aRandom * 50.0) * 12.0,
                cos(aRandom * 30.0) * 12.0,
                sin(aRandom * 20.0) * 6.0
            );

            vec3 finalPos = mix(scatter, position, uProgress);

            // 마우스 인터랙션
            float dist = distance(finalPos.xy, uMouse * 20.0);
            float influence = smoothstep(8.0, 0.0, dist);
            finalPos.z += influence * 2.0;

            finalPos.z += sin(finalPos.x * 0.15 + uTime) * 0.4 * (1.0 - uProgress * 0.5);

            vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
            gl_PointSize = (3.5 * aRandom + 0.8) * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;

            vAlpha = 0.6 + influence * 0.4;
        }
    `,
    fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
            gl_FragColor = vec4(uColor, alpha);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const points = new THREE.Points(geometry, material);
scene.add(points);
camera.position.z = 15;

// 마우스 트래킹
let mouse = { x: 0, y: 0 };
let targetMouse = { x: 0, y: 0 };

document.addEventListener('mousemove', (e) => {
    targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// 스크롤 & 섹션 관리
let scrollY = 0;
const sections = document.querySelectorAll('section');
const navDots = document.querySelectorAll('.nav-dot');

window.addEventListener('scroll', () => {
    scrollY = window.scrollY;

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
navDots.forEach(dot => {
    dot.addEventListener('click', () => {
        const target = document.getElementById(dot.dataset.section);
        target?.scrollIntoView({ behavior: 'smooth' });
    });
});

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now() * 0.001;

    // 마우스 스무딩
    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;
    material.uniforms.uMouse.value.set(mouse.x, mouse.y);

    material.uniforms.uTime.value = time;

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = Math.min(scrollY / maxScroll, 1);
    material.uniforms.uProgress.value += (progress - material.uniforms.uProgress.value) * 0.03;

    points.rotation.y = time * 0.03 + mouse.x * 0.1;
    points.rotation.x = Math.sin(time * 0.2) * 0.08 + mouse.y * 0.05;

    renderer.render(scene, camera);
}
animate();

// 리사이즈
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 테마 토글
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
    html.setAttribute('data-theme', 'light');
    material.uniforms.uColor.value = new THREE.Vector3(0.15, 0.35, 0.65);
    material.blending = THREE.NormalBlending;
}

themeToggle.addEventListener('click', () => {
    const isLight = html.getAttribute('data-theme') === 'light';

    if (isLight) {
        html.removeAttribute('data-theme');
        material.uniforms.uColor.value = new THREE.Vector3(0.0, 0.95, 1.0);
        material.blending = THREE.AdditiveBlending;
        localStorage.setItem('theme', 'dark');
    } else {
        html.setAttribute('data-theme', 'light');
        material.uniforms.uColor.value = new THREE.Vector3(0.15, 0.35, 0.65);
        material.blending = THREE.NormalBlending;
        localStorage.setItem('theme', 'light');
    }
});
