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

let ladderState = {
    step: 1, // 1: Select, 2: Prizes, 3: Game
    selectedPlayers: [], // player ids
    prizes: [], // prize strings
    paths: [] // calculated ladder paths
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
    if (!state.currentPlayer && hash !== 'login' && hash !== 'ladder') {
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
        case 'ladder':
            app.innerHTML = renderLadder();
            nav.classList.add('hidden');
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
            <h1 class="login-title">DX지원팀 합정 아웃팅</h1>
            <p class="login-subtitle">
                합정역 → 정몽주 동상 → 빕스<br>
                사진 미션을 수행하고 1등을 차지하세요!
            </p>
            <div class="prize-banner pulse-anim">
                ☕ 1등부터 3등까지는 특별히 커피를 쏩니다!! ☕
            </div>
            <p class="login-label" style="margin-top: 16px;">참가자 선택</p>
            <div class="player-grid">
                ${playerCards}
            </div>
            
            <div style="margin-top: 40px; width: 100%; max-width: 340px;">
                <button class="btn btn-outline btn-full" style="border-color: var(--accent-purple); color: var(--accent-purple);" onclick="navigate('ladder')">
                    🎲 DX 사다리 게임하기
                </button>
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

    return `
        <div class="mission-card ${cardClass}" onclick="openPhotoModal('${mission.id}')">
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

    const previewArea = document.getElementById('photo-preview-area');
    const previewImg = document.getElementById('photo-preview');
    const submitBtn = document.getElementById('submit-photo-btn');
    const photoInput = document.getElementById('photo-input');
    const actionBtns = document.getElementById('existing-action-btns');
    const photoLabel = document.getElementById('photo-label');

    // Check if already submitted
    const existingSub = state.mySubmissions[mission.id];

    if (existingSub) {
        previewImg.src = existingSub.photo_url;
        previewImg.classList.remove('hidden');
        previewArea.classList.add('has-photo');
        submitBtn.classList.add('hidden');
        actionBtns.classList.remove('hidden');
        photoLabel.style.display = 'none';
    } else {
        previewArea.classList.remove('has-photo');
        previewImg.classList.add('hidden');
        previewImg.src = '';
        submitBtn.classList.add('hidden');
        actionBtns.classList.add('hidden');
        photoInput.value = '';
        photoLabel.style.display = 'flex';
        document.getElementById('photo-label-text').textContent = '사진 촬영하기';
    }

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
        const photoLabel = document.getElementById('photo-label');
        previewImg.src = URL.createObjectURL(resizedBlob);
        previewImg.classList.remove('hidden');
        previewArea.classList.add('has-photo');
        photoLabel.style.display = 'none';

        // Show submit button, hide existing action buttons
        document.getElementById('submit-photo-btn').classList.remove('hidden');
        document.getElementById('existing-action-btns').classList.add('hidden');
        document.querySelector('#submit-photo-btn .btn-text').textContent = '새로운 사진으로 미션 완료! 🎉';
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

        // 3. Upsert submission
        const { error: subError } = await state.supabase
            .from('submissions')
            .upsert({
                player_id: playerId,
                mission_id: mission.id,
                photo_url: photoUrl,
                status: 'approved',
                submitted_at: new Date().toISOString()
            }, { onConflict: 'player_id, mission_id' });

        if (subError) throw subError;

        // 4. Update local state
        state.mySubmissions[mission.id] = {
            status: 'approved',
            photo_url: photoUrl,
            submitted_at: new Date().toISOString(),
        };

        // 5. Recalculate score entirely for this player
        await recalculateScore(playerId);

        // 7. Celebrate!
        closePhotoModal();
        showToast(`🎉 ${mission.title} 완료!`, 'success');

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

async function cancelMission() {
    if (!state.selectedMission || state.isUploading) return;
    
    if (!confirm('정말 이 미션을 취소하시겠습니까? 기록과 점수가 초기화됩니다.')) return;

    state.isUploading = true;
    const btnText = document.querySelector('#cancel-mission-btn .btn-text');
    const btnLoading = document.querySelector('#cancel-mission-btn .btn-loading');
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');

    try {
        const missionId = state.selectedMission.id;
        const playerId = state.currentPlayer.id;

        // Delete from DB
        const { error } = await state.supabase
            .from('submissions')
            .delete()
            .eq('player_id', playerId)
            .eq('mission_id', missionId);

        if (error) throw error;

        // Remove from local state
        delete state.mySubmissions[missionId];

        // Recalculate Score
        await recalculateScore(playerId);

        closePhotoModal();
        showToast('미션이 취소되었습니다.', 'info');
        await loadLeaderboard();
        render();

    } catch (err) {
        console.error('Cancel error:', err);
        showToast('취소 중 오류가 발생했습니다.', 'error');
    } finally {
        state.isUploading = false;
        if (btnText) btnText.classList.remove('hidden');
        if (btnLoading) btnLoading.classList.add('hidden');
    }
}

async function recalculateScore(playerId) {
    if (!isSupabaseReady()) return;

    // Get all submissions for player
    const { data: subs, error } = await state.supabase
        .from('submissions')
        .select('*')
        .eq('player_id', playerId)
        .eq('status', 'approved');
        
    if (error) {
        console.error('Failed to load subs for score calc:', error);
        return;
    }

    let newScore = 0;
    const completedCount = subs ? subs.length : 0;

    if (subs) {
        for (const sub of subs) {
            const m = MISSIONS.find(miss => miss.id === sub.mission_id);
            if (m) {
                newScore += m.points;
                if (m.timeAttack) {
                    const { data: taData } = await state.supabase
                        .from('submissions')
                        .select('player_id')
                        .eq('mission_id', m.id)
                        .eq('status', 'approved')
                        .order('submitted_at', { ascending: true })
                        .limit(3);
                    if (taData && taData.findIndex(s => s.player_id === playerId) !== -1) {
                        newScore += TIME_ATTACK_BONUS;
                    }
                }
            }
        }
    }

    // Update player score in DB directly
    await state.supabase
        .from('players')
        .update({
            total_score: newScore,
            completed_missions: completedCount
        })
        .eq('id', playerId);
}

// ============================================================
// Ladder Game
// ============================================================

function renderLadder() {
    let html = `<div class="ladder-view">`;
    html += `
        <div class="ladder-header">
            <button class="ladder-back" onclick="navigate('login')">← 뒤로</button>
            <h2>🎲 DX 사다리 게임</h2>
            <div style="width: 48px;"></div>
        </div>
    `;

    if (ladderState.step === 1) html += renderLadderStep1();
    else if (ladderState.step === 2) html += renderLadderStep2();
    else if (ladderState.step === 3) html += renderLadderStep3();

    html += `</div>`;
    return html;
}

function renderLadderStep1() {
    const isAllSelected = ladderState.selectedPlayers.length === PLAYERS.length;
    
    let html = `
        <div class="ladder-step-content">
            <div class="ladder-title">참가자 선택</div>
            <div class="ladder-desc">사다리 게임에 참여할 인원을 선택해주세요. (${ladderState.selectedPlayers.length}명 선택됨)</div>
            
            <div class="ladder-actions">
                <button class="btn btn-outline" style="padding: 8px 12px; font-size: 0.8rem;" onclick="toggleLadderAllPlayers()">
                    ${isAllSelected ? '전체 해제' : '전체 선택'}
                </button>
            </div>
            
            <div class="ladder-player-list">
    `;

    PLAYERS.forEach(p => {
        const isSelected = ladderState.selectedPlayers.includes(p.id);
        html += `
            <div class="ladder-player-item ${isSelected ? 'selected' : ''}" onclick="toggleLadderPlayer('${p.id}')">
                <div class="ladder-player-emoji">${p.emoji}</div>
                <div class="ladder-player-name">${p.name}</div>
                <div class="ladder-checkbox">
                    ${isSelected ? '✅' : '⬛'}
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <button class="btn btn-primary btn-full" style="margin-top: 24px;" onclick="goToLadderStep2()" ${ladderState.selectedPlayers.length < 2 ? 'disabled' : ''}>
                다음 단계 (결과 설정) →
            </button>
        </div>
    `;
    return html;
}

function toggleLadderPlayer(id) {
    const idx = ladderState.selectedPlayers.indexOf(id);
    if (idx > -1) {
        ladderState.selectedPlayers.splice(idx, 1);
    } else {
        ladderState.selectedPlayers.push(id);
    }
    render();
}

function toggleLadderAllPlayers() {
    if (ladderState.selectedPlayers.length === PLAYERS.length) {
        ladderState.selectedPlayers = [];
    } else {
        ladderState.selectedPlayers = PLAYERS.map(p => p.id);
    }
    render();
}

function goToLadderStep2() {
    if (ladderState.selectedPlayers.length < 2) {
        showToast('최소 2명 이상 선택해주세요.', 'error');
        return;
    }
    ladderState.step = 2;
    // Initialize prizes array if length mismatch
    if (ladderState.prizes.length !== ladderState.selectedPlayers.length) {
        ladderState.prizes = Array(ladderState.selectedPlayers.length).fill('');
    }
    render();
}

function renderLadderStep2() {
    let html = `
        <div class="ladder-step-content">
            <div class="ladder-title">결과 항목 설정</div>
            <div class="ladder-desc">총 ${ladderState.selectedPlayers.length}개의 결과를 입력해주세요. (예: 꽝, 커피 쏘기)</div>
            
            <div class="ladder-prize-list">
    `;

    for (let i = 0; i < ladderState.selectedPlayers.length; i++) {
        html += `
            <div class="ladder-prize-item">
                <span class="prize-num">${i + 1}</span>
                <input type="text" class="prize-input" placeholder="결과 입력" value="${ladderState.prizes[i] || ''}" oninput="updateLadderPrize(${i}, this.value)">
            </div>
        `;
    }

    html += `
            </div>
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button class="btn btn-outline" style="flex: 1;" onclick="ladderState.step = 1; render();">← 이전</button>
                <button class="btn btn-primary" style="flex: 2;" onclick="startLadderGame()">사다리 시작! 🚀</button>
            </div>
        </div>
    `;
    return html;
}

function updateLadderPrize(index, value) {
    ladderState.prizes[index] = value;
}

function startLadderGame() {
    // Check if all prizes are filled
    const isEmpty = ladderState.prizes.some(p => p.trim() === '');
    if (isEmpty) {
        showToast('모든 결과 항목을 입력해주세요.', 'error');
        return;
    }
    ladderState.step = 3;
    render();
    
    // Defer canvas drawing slightly to allow DOM to render
    setTimeout(() => {
        initLadderCanvas();
    }, 100);
}

function renderLadderStep3() {
    const players = ladderState.selectedPlayers.map(id => PLAYERS.find(p => p.id === id));
    
    let html = `
        <div class="ladder-step-content" style="display: flex; flex-direction: column; align-items: center; max-width: 100%; overflow-x: auto;">
            <div class="ladder-game-wrapper">
                <div class="ladder-players-row">
                    ${players.map((p, i) => `
                        <div class="ladder-col-header" onclick="playLadderAnim(${i})">
                            <div class="ladder-col-emoji">${p.emoji}</div>
                            <div class="ladder-col-name">${p.name}</div>
                        </div>
                    `).join('')}
                </div>
                
                <canvas id="ladder-canvas" width="${players.length * 70}" height="300"></canvas>
                
                <div class="ladder-prizes-row">
                    ${ladderState.prizes.map(prize => `
                        <div class="ladder-col-prize">${prize}</div>
                    `).join('')}
                </div>
            </div>
            <button class="btn btn-outline" style="margin-top: 30px;" onclick="resetLadder()">다시 설정하기</button>
        </div>
    `;
    return html;
}

function resetLadder() {
    ladderState.step = 1;
    render();
}

// Canvas logic
let ladderCtx = null;
let ladderLines = []; // horizontal lines: { row, col }
let animState = null; // for animation

function initLadderCanvas() {
    const canvas = document.getElementById('ladder-canvas');
    if (!canvas) return;
    ladderCtx = canvas.getContext('2d');
    
    const numCols = ladderState.selectedPlayers.length;
    const numRows = 10;
    const colWidth = 70;
    const rowHeight = canvas.height / (numRows + 1);
    
    // Generate random horizontal lines
    ladderLines = [];
    for (let r = 1; r <= numRows; r++) {
        // Randomly place lines, avoiding consecutive lines in same row touching
        let occupied = false;
        for (let c = 0; c < numCols - 1; c++) {
            if (!occupied && Math.random() > 0.5) {
                ladderLines.push({ row: r, col: c });
                occupied = true; // prevent next col from having line on same row
            } else {
                occupied = false;
            }
        }
    }
    
    drawLadderBase();
}

function drawLadderBase() {
    if (!ladderCtx) return;
    const canvas = ladderCtx.canvas;
    ladderCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    const numCols = ladderState.selectedPlayers.length;
    const numRows = 10;
    const colWidth = 70;
    const rowHeight = canvas.height / (numRows + 1);
    const startX = colWidth / 2;
    
    ladderCtx.strokeStyle = 'var(--glass-border-hover)';
    ladderCtx.lineWidth = 4;
    ladderCtx.lineCap = 'round';
    ladderCtx.lineJoin = 'round';
    
    // Draw vertical lines
    for (let c = 0; c < numCols; c++) {
        const x = startX + c * colWidth;
        ladderCtx.beginPath();
        ladderCtx.moveTo(x, 0);
        ladderCtx.lineTo(x, canvas.height);
        ladderCtx.stroke();
    }
    
    // Draw horizontal lines
    for (const line of ladderLines) {
        const y = line.row * rowHeight;
        const x1 = startX + line.col * colWidth;
        const x2 = startX + (line.col + 1) * colWidth;
        ladderCtx.beginPath();
        ladderCtx.moveTo(x1, y);
        ladderCtx.lineTo(x2, y);
        ladderCtx.stroke();
    }
}

function playLadderAnim(startIndex) {
    if (animState && animState.playing) return;
    
    // Reset canvas to base
    drawLadderBase();
    
    const canvas = ladderCtx.canvas;
    const numRows = 10;
    const colWidth = 70;
    const rowHeight = canvas.height / (numRows + 1);
    const startX = colWidth / 2;
    
    // Calculate path
    let path = [{ x: startX + startIndex * colWidth, y: 0 }];
    let currentCol = startIndex;
    
    for (let r = 1; r <= numRows; r++) {
        const y = r * rowHeight;
        path.push({ x: startX + currentCol * colWidth, y: y }); // move down to row
        
        // Check if there is a line left or right
        const lineLeft = ladderLines.find(l => l.row === r && l.col === currentCol - 1);
        const lineRight = ladderLines.find(l => l.row === r && l.col === currentCol);
        
        if (lineLeft) {
            currentCol--;
            path.push({ x: startX + currentCol * colWidth, y: y });
        } else if (lineRight) {
            currentCol++;
            path.push({ x: startX + currentCol * colWidth, y: y });
        }
    }
    // move down to end
    path.push({ x: startX + currentCol * colWidth, y: canvas.height });
    
    // Setup animation
    animState = {
        playing: true,
        path: path,
        progress: 0,
        totalLength: 0,
        segments: [],
        endCol: currentCol
    };
    
    // Calculate lengths
    for (let i = 0; i < path.length - 1; i++) {
        const dx = path[i+1].x - path[i].x;
        const dy = path[i+1].y - path[i].y;
        const len = Math.sqrt(dx*dx + dy*dy);
        animState.segments.push({
            p1: path[i],
            p2: path[i+1],
            length: len,
            accLength: animState.totalLength
        });
        animState.totalLength += len;
    }
    
    requestAnimationFrame(animateLadder);
}

function animateLadder(timestamp) {
    if (!animState.startTime) animState.startTime = timestamp;
    const elapsed = timestamp - animState.startTime;
    const duration = 2000; // 2 seconds
    
    animState.progress = Math.min(elapsed / duration, 1);
    
    drawLadderBase(); // redraw base
    
    // Draw animated line
    const currentLen = animState.progress * animState.totalLength;
    
    ladderCtx.strokeStyle = 'var(--accent-gold)';
    ladderCtx.lineWidth = 6;
    ladderCtx.beginPath();
    ladderCtx.moveTo(animState.path[0].x, animState.path[0].y);
    
    for (const seg of animState.segments) {
        if (currentLen >= seg.accLength + seg.length) {
            // Segment fully drawn
            ladderCtx.lineTo(seg.p2.x, seg.p2.y);
        } else if (currentLen > seg.accLength) {
            // Segment partially drawn
            const ratio = (currentLen - seg.accLength) / seg.length;
            const x = seg.p1.x + (seg.p2.x - seg.p1.x) * ratio;
            const y = seg.p1.y + (seg.p2.y - seg.p1.y) * ratio;
            ladderCtx.lineTo(x, y);
            break;
        }
    }
    ladderCtx.stroke();
    
    if (animState.progress < 1) {
        requestAnimationFrame(animateLadder);
    } else {
        animState.playing = false;
        
        // Highlight prize
        const prizeEls = document.querySelectorAll('.ladder-col-prize');
        prizeEls.forEach(el => el.classList.remove('highlight'));
        if (prizeEls[animState.endCol]) {
            prizeEls[animState.endCol].classList.add('highlight');
        }
        
        // Pop confetti if not '꽝'
        const prize = ladderState.prizes[animState.endCol];
        if (prize && prize.indexOf('꽝') === -1) {
            if (typeof confetti === 'function') {
                confetti({ particleCount: 50, spread: 40, origin: { y: 0.8 } });
            }
        }
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
