/* ============================================================
   DX Treasure Hunt — App Logic
   Supabase-powered photo mission game
   ============================================================ */

// ============================================================
// Configuration — Supabase 프로젝트 생성 후 여기에 값 입력
// ============================================================

const SUPABASE_URL = 'https://sxaxtmlrfncxtqmritps.supabase.co';       // 예: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4YXh0bWxyZm5jeHRxbXJpdHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNDA4NzMsImV4cCI6MjA5NDkxNjg3M30.lmyYahIi_-g2yb0CqRdgjzTgCDSDPEA5p4_9tmLhATk'; // 예: eyJhbGciOiJI...

// ============================================================
// Player Data (DX지원팀 9명)
// ============================================================

const PLAYERS = [
    { id: 'park_a',  name: '박⬜⬜', emoji: '🦊' },
    { id: 'ham',     name: '함⬜⬜', emoji: '🐻' },
    { id: 'jung',    name: '정⬜⬜', emoji: '🐯' },
    { id: 'kim_j',   name: '김정⬜', emoji: '🐰' },
    { id: 'park_b',  name: '박⬜⬜', emoji: '🦁' },
    { id: 'son',     name: '손⬜⬜', emoji: '🐼' },
    { id: 'seo',     name: '서⬜⬜', emoji: '🐨' },
    { id: 'kim_d',   name: '김동⬜', emoji: '🦄' },
    { id: 'kang',    name: '강⬜⬜', emoji: '🐲' },
];

// ============================================================
// Mission Data (dx.md 기반, QR → 포토 미션으로 대체)
// ============================================================

const STAGES = [
    { id: 1, title: '합정역 8번 출구',    location: '집결 및 출발',   color: 'var(--stage1-color)' },
    { id: 2, title: '양화진 이동 구간',    location: '산책 & 탐험',   color: 'var(--stage2-color)' },
    { id: 3, title: '정몽주 동상',        location: '반환점 메인 미션', color: 'var(--stage3-color)' },
    { id: 4, title: '빕스 합정역점',      location: '도착 & 회식',    color: 'var(--stage4-color)' },
];

const MISSIONS = [
    {
        id: 'stage1_checkin',
        stage: 1,
        title: '체크인 미션',
        description: '8번 출구 표지판이 보이게 참가자 2명 이상이 모여 역동적인 포즈를 취한 사진을 찍어 올리세요!',
        points: 10,
        icon: '📍',
        timeAttack: false,
    },
    {
        id: 'stage1_hidden',
        stage: 1,
        title: '히든 미션',
        description: "이름에 'ㅇ'이 들어가는 멤버 중 한 명이 리더가 되어, 나머지 멤버들을 이끄는 재미있는 콩트 컨셉 사진을 찍어주세요!",
        points: 20,
        icon: '🎭',
        timeAttack: false,
    },
    {
        id: 'stage2_observe',
        stage: 2,
        title: '관찰 미션',
        description: "걷다가 발견한 가장 독특한 모양의 간판이나 붉은색 벽돌 건물을 배경으로 '따봉' 포즈 인증샷을 찍어주세요!",
        points: 20,
        icon: '👀',
        timeAttack: false,
    },
    {
        id: 'stage2_discover',
        stage: 2,
        title: '발견 미션',
        description: '이동 중 가장 의외의 장소에서 발견한 재미있는 것(벽화, 조형물, 동물, 꽃 등)을 찍어 올리세요! 창의성이 점수!',
        points: 30,
        icon: '🔍',
        timeAttack: false,
    },
    {
        id: 'stage3_main',
        stage: 3,
        title: '메인 미션',
        description: "양화대교 북단 녹지대의 정몽주 선생 동상 앞에서 '단심가'의 충절이 느껴지는 비장하고 엄숙한 표정으로 3명 이상 단체 셀카!",
        points: 50,
        icon: '🏛️',
        timeAttack: true,   // 선착순 3명 보너스 +15점
    },
    {
        id: 'stage4_finish',
        stage: 4,
        title: '피니시 라인',
        description: '딜라이트 스퀘어 지하 2층 빕스 매장 입구 도착 인증샷을 찍어주세요!',
        points: 30,
        icon: '🏁',
        timeAttack: false,
    },
    {
        id: 'stage4_final',
        stage: 4,
        title: '최종 미션',
        description: '자리에 앉아 샐러드바 접시를 들고 DX지원팀 9명 전원이 한 앵글에 꽉 차게 들어오는 단체 사진 완성!',
        points: 50,
        icon: '🎆',
        timeAttack: false,
    },
];

const TIME_ATTACK_BONUS = 15;
const MAX_IMAGE_WIDTH = 1200;
const JPEG_QUALITY = 0.75;

// ============================================================
// App State
// ============================================================

let state = {
    currentPlayer: null,         // { id, name, emoji }
    currentView: 'login',        // login | missions | leaderboard
    leaderboard: [],             // [{ id, name, emoji, total_score, completed_missions }]
    mySubmissions: {},            // { mission_id: { status, photo_url, submitted_at } }
    supabase: null,
    realtimeChannel: null,
    selectedMission: null,       // mission object for photo modal
    selectedPhotoBlob: null,     // resized photo blob
    isUploading: false,
};

// ============================================================
// Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Check saved session
    const saved = localStorage.getItem('dx_treasure_player');
    if (saved) {
        try {
            const player = JSON.parse(saved);
            if (player && player.id) {
                state.currentPlayer = player;
            }
        } catch (e) { /* ignore */ }
    }

    initSupabase();
    handleRouting();
});

function initSupabase() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn('⚠️ Supabase 설정이 필요합니다. app.js 상단의 SUPABASE_URL과 SUPABASE_ANON_KEY를 입력해주세요.');
        return;
    }
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function isSupabaseReady() {
    return state.supabase !== null;
}

// ============================================================
// Router (hash-based)
// ============================================================

function handleRouting() {
    const hash = window.location.hash.replace('#', '') || 'login';

    if (state.currentPlayer && hash === 'login') {
        navigate('missions');
        return;
    }
    if (!state.currentPlayer && hash !== 'login') {
        navigate('login');
        return;
    }

    state.currentView = hash;
    render();
}

function navigate(view) {
    state.currentView = view;
    window.location.hash = view;
    render();
}

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'login';
    if (hash !== state.currentView) {
        state.currentView = hash;
        render();
    }
});

// ============================================================
// Main Render
// ============================================================

function render() {
    const app = document.getElementById('app');
    const nav = document.getElementById('bottom-nav');

    switch (state.currentView) {
        case 'login':
            app.innerHTML = renderLogin();
            nav.classList.add('hidden');
            break;
        case 'missions':
            app.innerHTML = renderGameHeader() + renderMissions();
            nav.classList.remove('hidden');
            updateNavActive('missions');
            break;
        case 'leaderboard':
            app.innerHTML = renderGameHeader() + renderLeaderboard();
            nav.classList.remove('hidden');
            updateNavActive('leaderboard');
            break;
        default:
            navigate('login');
    }
}

function updateNavActive(view) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
}

// ============================================================
// Login View
// ============================================================

function renderLogin() {
    const playerCards = PLAYERS.map(p => `
        <button class="player-card" onclick="loginAsPlayer('${p.id}')">
            <span class="emoji">${p.emoji}</span>
            <span class="name">${p.name}</span>
        </button>
    `).join('');

    return `
        <div class="login-view">
            <div class="login-logo">🧭</div>
            <h1 class="login-title">DX 트레저 헌트</h1>
            <p class="login-subtitle">
                합정역 → 정몽주 동상 → 빕스<br>
                사진 미션을 수행하고 1등을 차지하세요!
            </p>
            <p class="login-label">참가자 선택</p>
            <div class="player-grid">
                ${playerCards}
            </div>
        </div>
    `;
}

async function loginAsPlayer(playerId) {
    const player = PLAYERS.find(p => p.id === playerId);
    if (!player) return;

    state.currentPlayer = player;
    localStorage.setItem('dx_treasure_player', JSON.stringify(player));

    if (isSupabaseReady()) {
        await ensurePlayerInDB(player);
        await loadMySubmissions();
        await loadLeaderboard();
        subscribeRealtime();
    }

    navigate('missions');
}

function logout() {
    state.currentPlayer = null;
    state.mySubmissions = {};
    localStorage.removeItem('dx_treasure_player');
    if (state.realtimeChannel) {
        state.supabase.removeChannel(state.realtimeChannel);
        state.realtimeChannel = null;
    }
    navigate('login');
}

// ============================================================
// Game Header
// ============================================================

function renderGameHeader() {
    const p = state.currentPlayer;
    const myScore = getMyScore();
    return `
        <div class="game-header">
            <div class="header-left">
                <span class="header-avatar">${p.emoji}</span>
                <div class="header-info">
                    <div class="header-name">${p.name}</div>
                    <div class="header-score">${myScore}점</div>
                </div>
            </div>
            <div class="header-right">
                <button class="btn-logout" onclick="logout()">로그아웃</button>
            </div>
        </div>
    `;
}

function getMyScore() {
    const entry = state.leaderboard.find(e => e.id === state.currentPlayer?.id);
    return entry ? entry.total_score : 0;
}

// ============================================================
// Missions View
// ============================================================

function renderMissions() {
    const completedCount = Object.keys(state.mySubmissions).length;
    const totalPoints = getMyScore();

    let html = `<div class="missions-view">`;

    // Score banner
    html += `
        <div class="score-banner">
            <div>
                <div class="score-banner-label">나의 점수</div>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">
                    ${completedCount}/${MISSIONS.length} 미션 완료
                </div>
            </div>
            <div class="score-banner-value">${totalPoints}</div>
        </div>
    `;

    // Stages
    STAGES.forEach(stage => {
        const missions = MISSIONS.filter(m => m.stage === stage.id);
        const missionCards = missions.map(m => renderMissionCard(m)).join('');

        html += `
            <div class="stage-section">
                <div class="stage-header">
                    <div class="stage-badge s${stage.id}">${stage.id}</div>
                    <div>
                        <div class="stage-title">${stage.title}</div>
                        <div class="stage-location">${stage.location}</div>
                    </div>
                </div>
                <div class="stage-missions">
                    ${missionCards}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    return html;
}

function renderMissionCard(mission) {
    const sub = state.mySubmissions[mission.id];
    let statusClass = '';
    let statusLabel = '';
    let cardClass = '';

    if (sub) {
        statusClass = 'done';
        statusLabel = '✅ 완료';
        cardClass = 'completed';
    } else {
        statusClass = 'available';
        statusLabel = '도전하기';
    }

    const timeAttackBadge = mission.timeAttack
        ? `<span class="time-attack-badge">⚡ 타임어택 +${TIME_ATTACK_BONUS}</span>`
        : '';

    const onclick = sub ? '' : `onclick="openPhotoModal('${mission.id}')"`;

    return `
        <div class="mission-card ${cardClass}" ${onclick}>
            <div class="mission-icon">${mission.icon}</div>
            <div class="mission-info">
                <div class="mission-name">${mission.title} ${timeAttackBadge}</div>
                <div class="mission-desc">${mission.description}</div>
            </div>
            <div class="mission-points">
                <div class="mission-pts">${mission.points}</div>
                <div class="mission-status ${statusClass}">${statusLabel}</div>
            </div>
        </div>
    `;
}

// ============================================================
// Leaderboard View
// ============================================================

function renderLeaderboard() {
    const sorted = [...state.leaderboard].sort((a, b) => b.total_score - a.total_score);
    const maxScore = Math.max(...sorted.map(s => s.total_score), 1);

    let html = `<div class="leaderboard-view">`;
    html += `<h2 class="leaderboard-title">🏆 실시간 순위</h2>`;

    // Podium (top 3)
    if (sorted.length >= 3) {
        const [first, second, third] = sorted;
        html += `
            <div class="podium">
                <div class="podium-slot second">
                    <div class="podium-avatar">${second.emoji}</div>
                    <div class="podium-name">${second.name}</div>
                    <div class="podium-score">${second.total_score}</div>
                    <div class="podium-bar">🥈</div>
                </div>
                <div class="podium-slot first">
                    <div class="podium-avatar">👑<br>${first.emoji}</div>
                    <div class="podium-name">${first.name}</div>
                    <div class="podium-score">${first.total_score}</div>
                    <div class="podium-bar">🥇</div>
                </div>
                <div class="podium-slot third">
                    <div class="podium-avatar">${third.emoji}</div>
                    <div class="podium-name">${third.name}</div>
                    <div class="podium-score">${third.total_score}</div>
                    <div class="podium-bar">🥉</div>
                </div>
            </div>
        `;

        // 4th and below
        if (sorted.length > 3) {
            html += `<div class="rank-list">`;
            for (let i = 3; i < sorted.length; i++) {
                const p = sorted[i];
                const barWidth = maxScore > 0 ? (p.total_score / maxScore) * 100 : 0;
                html += `
                    <div class="rank-item">
                        <div class="rank-num">${i + 1}</div>
                        <div class="rank-avatar">${p.emoji}</div>
                        <div class="rank-info">
                            <div class="rank-name">${p.name}</div>
                            <div class="rank-bar-wrap">
                                <div class="rank-bar-fill" style="width:${barWidth}%"></div>
                            </div>
                        </div>
                        <div class="rank-score">${p.total_score}</div>
                    </div>
                `;
            }
            html += `</div>`;
        }
    } else if (sorted.length > 0) {
        // Less than 3 players
        html += `<div class="rank-list">`;
        sorted.forEach((p, i) => {
            const medals = ['🥇', '🥈', '🥉'];
            html += `
                <div class="rank-item">
                    <div class="rank-num">${medals[i] || i + 1}</div>
                    <div class="rank-avatar">${p.emoji}</div>
                    <div class="rank-info">
                        <div class="rank-name">${p.name}</div>
                    </div>
                    <div class="rank-score">${p.total_score}</div>
                </div>
            `;
        });
        html += `</div>`;
    } else {
        html += `
            <div class="empty-state">
                <div class="empty-icon">🏜️</div>
                <div class="empty-text">아직 참가자가 없습니다.<br>게임이 시작되면 순위가 표시됩니다.</div>
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

// ============================================================
// Photo Modal
// ============================================================

function openPhotoModal(missionId) {
    const mission = MISSIONS.find(m => m.id === missionId);
    if (!mission) return;

    state.selectedMission = mission;
    state.selectedPhotoBlob = null;

    document.getElementById('modal-title').textContent = `${mission.icon} ${mission.title}`;
    document.getElementById('modal-description').textContent = mission.description;

    // Reset photo area
    const previewArea = document.getElementById('photo-preview-area');
    const previewImg = document.getElementById('photo-preview');
    const submitBtn = document.getElementById('submit-photo-btn');
    const photoInput = document.getElementById('photo-input');

    previewArea.classList.remove('has-photo');
    previewImg.classList.add('hidden');
    previewImg.src = '';
    submitBtn.classList.add('hidden');
    photoInput.value = '';

    // Show points info
    let pointsInfo = `(${mission.points}점`;
    if (mission.timeAttack) pointsInfo += ` + 선착순 3명 보너스 ${TIME_ATTACK_BONUS}점`;
    pointsInfo += ')';
    document.getElementById('modal-description').textContent = mission.description + ' ' + pointsInfo;

    document.getElementById('photo-modal').classList.remove('hidden');
}

function closePhotoModal() {
    document.getElementById('photo-modal').classList.add('hidden');
    state.selectedMission = null;
    state.selectedPhotoBlob = null;
}

async function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Resize image
        const resizedBlob = await resizeImage(file, MAX_IMAGE_WIDTH, JPEG_QUALITY);
        state.selectedPhotoBlob = resizedBlob;

        // Show preview
        const previewImg = document.getElementById('photo-preview');
        const previewArea = document.getElementById('photo-preview-area');
        previewImg.src = URL.createObjectURL(resizedBlob);
        previewImg.classList.remove('hidden');
        previewArea.classList.add('has-photo');

        // Show submit button
        document.getElementById('submit-photo-btn').classList.remove('hidden');
    } catch (err) {
        console.error('Photo resize error:', err);
        showToast('사진 처리 중 오류가 발생했습니다.', 'error');
    }
}

async function submitPhoto() {
    if (!state.selectedMission || !state.selectedPhotoBlob || state.isUploading) return;

    if (!isSupabaseReady()) {
        showToast('Supabase 연결이 필요합니다. 설정을 확인해주세요.', 'error');
        return;
    }

    state.isUploading = true;
    const btnText = document.querySelector('#submit-photo-btn .btn-text');
    const btnLoading = document.querySelector('#submit-photo-btn .btn-loading');
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');

    try {
        const mission = state.selectedMission;
        const playerId = state.currentPlayer.id;
        const timestamp = Date.now();
        const filePath = `${playerId}/${mission.id}_${timestamp}.jpg`;

        // 1. Upload photo to Supabase Storage
        const { data: uploadData, error: uploadError } = await state.supabase.storage
            .from('photos')
            .upload(filePath, state.selectedPhotoBlob, {
                contentType: 'image/jpeg',
                upsert: false,
            });

        if (uploadError) throw uploadError;

        // 2. Get public URL
        const { data: urlData } = state.supabase.storage
            .from('photos')
            .getPublicUrl(filePath);
        const photoUrl = urlData.publicUrl;

        // 3. Insert submission
        const { error: subError } = await state.supabase
            .from('submissions')
            .insert({
                player_id: playerId,
                mission_id: mission.id,
                photo_url: photoUrl,
                status: 'approved',
            });

        if (subError) {
            // Duplicate check
            if (subError.code === '23505') {
                showToast('이미 완료한 미션입니다!', 'info');
                closePhotoModal();
                return;
            }
            throw subError;
        }

        // 4. Calculate score (including time attack bonus)
        let earnedPoints = mission.points;

        if (mission.timeAttack) {
            const { data: taData } = await state.supabase
                .from('submissions')
                .select('player_id')
                .eq('mission_id', mission.id)
                .eq('status', 'approved')
                .order('submitted_at', { ascending: true })
                .limit(3);

            if (taData && taData.some(s => s.player_id === playerId)) {
                const rank = taData.findIndex(s => s.player_id === playerId);
                if (rank < 3) {
                    earnedPoints += TIME_ATTACK_BONUS;
                    showToast(`⚡ 타임어택 ${rank + 1}등! +${TIME_ATTACK_BONUS}점 보너스!`, 'success');
                }
            }
        }

        // 5. Update player score
        const { error: scoreError } = await state.supabase.rpc('increment_score', {
            p_id: playerId,
            points: earnedPoints,
        });

        // Fallback: direct update if RPC doesn't exist
        if (scoreError) {
            const currentScore = getMyScore();
            await state.supabase
                .from('players')
                .update({
                    total_score: currentScore + earnedPoints,
                    completed_missions: Object.keys(state.mySubmissions).length + 1,
                })
                .eq('id', playerId);
        }

        // 6. Update local state
        state.mySubmissions[mission.id] = {
            status: 'approved',
            photo_url: photoUrl,
            submitted_at: new Date().toISOString(),
        };

        // 7. Celebrate!
        closePhotoModal();
        showToast(`🎉 ${mission.title} 완료! +${earnedPoints}점`, 'success');

        // Confetti
        if (typeof confetti === 'function') {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        }

        // Refresh data
        await loadLeaderboard();
        render();

    } catch (err) {
        console.error('Submit error:', err);
        showToast('업로드 실패: ' + (err.message || '알 수 없는 오류'), 'error');
    } finally {
        state.isUploading = false;
        const btnText = document.querySelector('#submit-photo-btn .btn-text');
        const btnLoading = document.querySelector('#submit-photo-btn .btn-loading');
        if (btnText) btnText.classList.remove('hidden');
        if (btnLoading) btnLoading.classList.add('hidden');
    }
}

// ============================================================
// Image Resize Utility
// ============================================================

function resizeImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
                    'image/jpeg',
                    quality
                );
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ============================================================
// Supabase Data Operations
// ============================================================

async function ensurePlayerInDB(player) {
    if (!isSupabaseReady()) return;

    const { data, error } = await state.supabase
        .from('players')
        .upsert({
            id: player.id,
            name: player.name,
            emoji: player.emoji,
            total_score: 0,
            completed_missions: 0,
        }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) console.error('Ensure player error:', error);
}

async function loadMySubmissions() {
    if (!isSupabaseReady() || !state.currentPlayer) return;

    const { data, error } = await state.supabase
        .from('submissions')
        .select('*')
        .eq('player_id', state.currentPlayer.id)
        .eq('status', 'approved');

    if (error) {
        console.error('Load submissions error:', error);
        return;
    }

    state.mySubmissions = {};
    (data || []).forEach(sub => {
        state.mySubmissions[sub.mission_id] = {
            status: sub.status,
            photo_url: sub.photo_url,
            submitted_at: sub.submitted_at,
        };
    });
}

async function loadLeaderboard() {
    if (!isSupabaseReady()) return;

    const { data, error } = await state.supabase
        .from('players')
        .select('*')
        .order('total_score', { ascending: false });

    if (error) {
        console.error('Load leaderboard error:', error);
        return;
    }

    state.leaderboard = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji || PLAYERS.find(pl => pl.id === p.id)?.emoji || '👤',
        total_score: p.total_score || 0,
        completed_missions: p.completed_missions || 0,
    }));
}

// ============================================================
// Realtime Subscription
// ============================================================

function subscribeRealtime() {
    if (!isSupabaseReady() || state.realtimeChannel) return;

    state.realtimeChannel = state.supabase
        .channel('game-updates')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'players' },
            (payload) => {
                handlePlayerUpdate(payload);
            }
        )
        .subscribe((status) => {
            console.log('Realtime status:', status);
        });
}

function handlePlayerUpdate(payload) {
    const updated = payload.new;
    if (!updated) return;

    const idx = state.leaderboard.findIndex(p => p.id === updated.id);
    const playerData = {
        id: updated.id,
        name: updated.name,
        emoji: updated.emoji || PLAYERS.find(p => p.id === updated.id)?.emoji || '👤',
        total_score: updated.total_score || 0,
        completed_missions: updated.completed_missions || 0,
    };

    if (idx >= 0) {
        state.leaderboard[idx] = playerData;
    } else {
        state.leaderboard.push(playerData);
    }

    // Re-render if on leaderboard view
    if (state.currentView === 'leaderboard') {
        const app = document.getElementById('app');
        app.innerHTML = renderGameHeader() + renderLeaderboard();
    }

    // Update header score if it's the current player
    if (updated.id === state.currentPlayer?.id) {
        const headerScore = document.querySelector('.header-score');
        if (headerScore) {
            headerScore.textContent = `${updated.total_score || 0}점`;
            headerScore.classList.add('score-pop');
            setTimeout(() => headerScore.classList.remove('score-pop'), 600);
        }
    }
}

// ============================================================
// Toast Notification
// ============================================================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================================
// Auto-reconnect on visibility change
// ============================================================

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && state.currentPlayer && isSupabaseReady()) {
        await loadMySubmissions();
        await loadLeaderboard();
        render();
    }
});
