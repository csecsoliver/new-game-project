const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const w = canvas.width, h = canvas.height

// Game settings
let playerCount = 2
let round = 1
const START_MAX_HP = 100
const WINNER_PARTIAL_HEAL = 30

// Input - multi player key mapping
const keyState = {}
window.addEventListener('keydown', e => keyState[e.code] = true)
window.addEventListener('keyup', e => keyState[e.code] = false)

// Player control mapping: up/down/left/right/attack
const controlSets = [
    { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyF' },
    { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', attack: 'KeyL' },
    { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', attack: 'KeyU' },
    { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', attack: 'Numpad0' }
]

// Limb definitions & costs
const LEG_TIERS = [
    { name: 'None', speed: 0, cost: 0 },
    { name: 'Twitch Legs', speed: 0.8, cost: 15 },
    { name: 'Swift Legs', speed: 1.8, cost: 30 }
]
const ARMS = {
    'fist': { name: 'Fist', type: 'melee', dmg: 8, range: 26, cost: 5, cooldown: 400 },
    'chainsaw': { name: 'Chainsaw', type: 'melee', dmg: 18, range: 30, cost: 20, cooldown: 300 },
    'pistol': { name: 'Pistol', type: 'projectile', dmg: 12, range: 400, cost: 18, cooldown: 700, ammo: 6 }
}
const UTIL = {
    'armor': { name: 'Armor Plate', cost: 22, damageReduction: 0.15 },
    'hpboost': { name: 'HP Boost', cost: 25, addMaxHP: 20 }
}

// Game state
let players = []
let bullets = []
let roundPhase = 'buy'
let activeBuyerIndex = 0
let buyOverlay = document.getElementById('shopOverlay')
let playersUI = document.getElementById('playersUI')
let roundStats = document.getElementById('roundStats')
let roundText = document.getElementById('roundText')

function rand(min, max) { return Math.random() * (max - min) + min}

// Player constructor
function createPlayer(i) {
    const spawn = { x: rand(80, w - 80), y: rand(80, h - 80) }
    const p = {
        id: i,
        name: `P${i + 1}`,
        color: ['#f77', '#6ef', '#fd6', '#c8f'][i % 4],
        pos: spawn,
        vel: { x: 0, y: 0 },
        angle: 0,
        alive: true,
        maxHP: START_MAX_HP,
        hp: START_MAX_HP,
        limbs: { legs: 0, arms: [], utility: [] }, // legs tier index, arms array values in ARMS keys
        armor: 0,
        pistolAmmo: 0,
        lastAttack: 0,
        score: 0,
    }
    return p
}

function resetGame(keepRound = false) {
    if (!keepRound) round = 1
    bullets = []
    players = []
    for (let i = 0; i < playerCount; i++) players.push(createPlayer(i))
    roundPhase = 'buy'
    activeBuyerIndex = 0
    buyOverlay.style.display = 'flex'
    updateActiveBuyerUI()
    renderPlayersUI()
    roundText.innerText = `Round ${round} — Buying limbs`
}

// Shop logic
function updateActiveBuyerUI() {
    const p = players[activeBuyerIndex]
    document.getElementById('activePlayerName').innerText = p.name + ` (HP: ${p.hp}/${p.maxHP})`
}

document.querySelectorAll('#shop .btn').forEach(btn => {
    btn.addEventListener('click', (ev) => {
        const type = btn.dataset.type
        if (!type) return
        const p = players[activeBuyerIndex]
        if (!p) return
        if (type === 'legs') {
            const tier = parseInt(btn.dataset.tier, 10)
            const tierObj = LEG_TIERS[tier]
            if (p.hp >= tierObj.cost) {
                p.hp -= tierObj.cost
                p.limbs.legs = tier
                renderPlayersUI()
                updateActiveBuyerUI()
            } else {
                flashMessage(`${p.name} does not have enough HP`)
            }
        } else if (type === 'arm') {
            const tier = btn.dataset.tier
            const armDef = ARMS[tier]
            if (p.hp >= armDef.cost) {
                p.hp -= armDef.cost
                p.limbs.arms.push(tier)
                if (tier === 'pistol') p.pistolAmmo += (armDef.ammo || 6)
                renderPlayersUI()
updateActiveBuyerUI()
            } else flashMessage(`${p.name} cannot afford ${armDef.name}`)
        } else if (type === 'utility') {
            const tier = btn.dataset.tier
            const def = UTIL[tier]
            if (p.hp >= def.cost) {
                if (tier === 'armor') {
                    p.armor = def.damageReduction
                    p.hp -= def.cost
                    p.limbs.utility.push(tier)
                }
                if (tier === 'hpboost') {
                    if (!p.maxHPBoostApplied) {
                        p.hp -= def.cost
                        p.limbs.utility.push(tier)
                        p.maxHP += def.addMaxHP
                        p.hp += def.addMaxHP
                        p.maxHPBoostApplied = true
                    } else flashMessage('HP Boost already applied')
                }
                renderPlayersUI()
updateActiveBuyerUI()
            } else flashMessage(`${p.name} cannot afford ${def.name}`)
        }
    })
})

document.getElementById('doneBuy').addEventListener('click', () => {
    activeBuyerIndex++
    if (activeBuyerIndex >= players.length) {
        // end buy phase
        buyOverlay.style.display = 'none'
        startFightRound()
    } else {
        updateActiveBuyerUI()
    }
})

function flashMessage(msg) {
    roundText.innerText = msg
    setTimeout(() => {
        if (roundPhase === 'buy') roundText.innerText = `Round ${round} — Buying limbs`
        else roundText.innerText = ''
    }, 1200)
}

// Start fight
function startFightRound() {
    roundPhase = 'fight'
    bullets = []
    // revive anyone with hp>0 (they remain alive). Reset positions
    players.forEach((p, i) => {
        p.pos = { x: 80 + i * 120 + rand(-40, 40), y: rand(80, h - 80) }
        p.vel = { x: 0, y: 0 }
        p.alive = true
        // ensure hp is at least 1 (you may have spent all)
        if (p.hp <= 0) p.hp = 1
    })
    roundText.innerText = `Round ${round} — Fight!`
    renderPlayersUI()
}

// Fight loop & mechanics
function update(dt) {
    if (roundPhase === 'fight') {
        handlePlayerInputs(dt)
        updateBullets(dt)
        resolveCollisions()
        checkRoundEnd()
    }
}

function handlePlayerInputs(dt) {
    players.forEach((p, idx) => {
        if (!p.alive) return
        // movement from legs
        const controls = controlSets[idx % controlSets.length]
        let moveX = 0, moveY = 0
        if (keyState[controls.left]) moveX -= 1
        if (keyState[controls.right]) moveX += 1
        if (keyState[controls.up]) moveY -= 1
        if (keyState[controls.down]) moveY += 1
        const leg = LEG_TIERS[p.limbs.legs]
        let spd = leg ? leg.speed : 0
        // if no legs, spd=0 -> cannot move
        if (moveX !== 0 || moveY !== 0) {
            const len = Math.hypot(moveX, moveY) || 1
            p.vel.x += (moveX / len) * spd * 0.7
            p.vel.y += (moveY / len) * spd * 0.7
        } else {
            // friction
            p.vel.x *= 0.85
            p.vel.y *= 0.85
        }
        // clamp speed
        const maxVel = (leg ? leg.speed * 1.8 : 0) * 60 / 60
        const vmag = Math.hypot(p.vel.x, p.vel.y)
        if (vmag > maxVel) {
            p.vel.x = p.vel.x / vmag * maxVel
            p.vel.y = p.vel.y / vmag * maxVel
        }
        p.pos.x += p.vel.x
        p.pos.y += p.vel.y
        p.angle = Math.atan2(p.vel.y, p.vel.x)

        // bound
        p.pos.x = Math.max(20, Math.min(w - 20, p.pos.x))
        p.pos.y = Math.max(20, Math.min(h - 20, p.pos.y))

        // attack
        const atKey = controls.attack
        if (keyState[atKey]) {
            attemptAttack(p)
            // small attack cooldown by preventing repeated immediate attacks via lastAttack timestamp
        }
        // regen small HP while alive? not in spec. skip.
    })
}

function attemptAttack(p) {
    const now = Date.now()
    // pick first arm if any, otherwise bare mandible? If no arms, very weak underspecified. We'll allow a weak bite
    if (p.limbs.arms.length === 0) {
        if (now - p.lastAttack < 700) return
        // bite
        p.lastAttack = now
        // check for enemy in range
        players.forEach(other => {
            if (!other.alive || other === p) return
            const d = Math.hypot(other.pos.x - p.pos.x, other.pos.y - p.pos.y)
            if (d < 28) {
                applyDamage(other, 6, p)
            }
        })
        return
    }
    // use first arm (simpler: cycle through arms? use first)
    const armKey = p.limbs.arms[0]
    const arm = ARMS[armKey]
    if (!arm) return
    if (now - p.lastAttack < (arm.cooldown || 400)) return
    p.lastAttack = now

    if (arm.type === 'melee') {
        // melee: damage any in range in arc
        players.forEach(other => {
            if (!other.alive || other === p) return
            const d = Math.hypot(other.pos.x - p.pos.x, other.pos.y - p.pos.y)
            if (d < arm.range + 6) {
                applyDamage(other, arm.dmg * (1 - (other.armor || 0)), p)
            }
        })
    } else if (arm.type === 'projectile') {
        // fire bullet if ammo
        if (p.pistolAmmo <= 0) {
            flashMessage(`${p.name}: No pistol ammo`)
            return
        }
        p.pistolAmmo--
        // spawn bullet
        const angle = p.angle || 0
        const bx = p.pos.x + Math.cos(angle) * 18
        const by = p.pos.y + Math.sin(angle) * 18
        bullets.push({
            x: bx, y: by, vx: Math.cos(angle) * 8, vy: Math.sin(angle) * 8,
            dmg: arm.dmg * (1 - ((arm.ownerArmorReduction || 0))), owner: p,
            life: 60
        })
    }
}

function applyDamage(target, dmg, attacker) {
    if (!target.alive) return
    // apply armor reduction already considered
    target.hp -= Math.max(1, Math.round(dmg))
    if (target.hp <= 0) {
        target.alive = false
        target.hp = 0
        // mark attacker score
        if (attacker) attacker.score++
        flashMessage(`${target.name} was downed!`)
    }
    renderPlayersUI()
}

function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]
        b.x += b.vx
        b.y += b.vy
        b.life--
        // offscreen or life end
        if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > w || b.y > h) {
            bullets.splice(i, 1)
continue
        }
        // hit players
        for (let j = 0; j < players.length; j++) {
            const p = players[j]
            if (!p.alive) continue
            if (p === b.owner) continue
            const d = Math.hypot(p.pos.x - b.x, p.pos.y - b.y)
            if (d < 18) {
                applyDamage(p, b.dmg * (1 - (p.armor || 0)), b.owner)
                bullets.splice(i, 1)
                break
            }
        }
    }
}

function resolveCollisions() {
    // simple player-player collision: push apart slightly
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            const a = players[i], b = players[j]
            if (!a.alive || !b.alive) continue
            const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y
            const d = Math.hypot(dx, dy)
            const minD = 30
            if (d > 0 && d < minD) {
                const overlap = (minD - d) / 2
                const ox = dx / d * overlap, oy = dy / d * overlap
                a.pos.x -= ox
a.pos.y -= oy
                b.pos.x += ox
b.pos.y += oy
            }
        }
    }
}

function aliveCount() {
    return players.filter(p => p.alive).length
}

function checkRoundEnd() {
    const alive = aliveCount()
    if (alive <= 1) {
        endRound()
    }
}

function endRound() {
    roundPhase = 'round_end'
    const survivors = players.filter(p => p.alive)
    let winner = null
    if (survivors.length === 1) winner = survivors[0]
    players.forEach(p => {
        if (p === winner) {
            p.hp = Math.min(p.maxHP, p.hp + WINNER_PARTIAL_HEAL)
            flashMessage(`${p.name} wins round ${round}! Partial heal +${WINNER_PARTIAL_HEAL}`)
        } else {
            // losers: fully healed but lose most limbs
            p.hp = p.maxHP
            // drop most limbs (keep 1 random limb if they had any)
            p.limbs.arms = p.limbs.arms.length > 0 ? [p.limbs.arms[0]] : []
            p.limbs.legs = 0
            p.armor = 0
            p.pistolAmmo = 0
            // remove hpboost flag so they can re-buy next round
            p.maxHPBoostApplied = false
        }
    })
    // update score etc
    if (winner) winner.score++
    renderPlayersUI()

    // go to next round after very short pause — show buy overlay again for next round
    setTimeout(() => {
        round++
        roundPhase = 'buy'
        activeBuyerIndex = 0
        buyOverlay.style.display = 'flex'
        updateActiveBuyerUI()
        // Reset alive states so everyone can buy again
        players.forEach(p => p.alive = true)
        // players keep their limbs (except losers we modified)
        renderPlayersUI()
        roundText.innerText = `Round ${round} — Buying limbs`
    }, 1100)
}

// UI rendering for player panels
function renderPlayersUI() {
    playersUI.innerHTML = ''
    players.forEach((p, i) => {
        const div = document.createElement('div')
        div.style.marginBottom = '8px'
        div.innerHTML = `<h3 style="color:${p.color}">${p.name} ${p.alive ? '' : '(down)'}</h3>
      <div class="small">HP: ${p.hp}/${p.maxHP} · Score: ${p.score}</div>
      <div style="margin-top:6px;">
        <div class="pbar" style="width:100%;"><span style="width:${p.hp / p.maxHP * 100}%"></span></div>
      </div>
      <div class="small" style="margin-top:6px">Legs: ${LEG_TIERS[p.limbs.legs].name} · Arms: ${p.limbs.arms.map(a => ARMS[a].name).join(', ') || 'None'}</div>
      <div class="small">Util: ${p.limbs.utility.map(u => UTIL[u].name).join(', ') || 'None'} · Ammo: ${p.pistolAmmo}</div>
    `
        playersUI.appendChild(div)
    })
    roundStats.innerText = `Round: ${round} · Phase: ${roundPhase}`
}

// Drawing
function draw() {
    ctx.clearRect(0, 0, w, h)

    // background grid
    ctx.save()
    ctx.globalAlpha = 0.06
    ctx.strokeStyle = '#ffffff'
    for (let gx = 0; gx < w; gx += 40) {
        ctx.beginPath()
ctx.moveTo(gx, 0)
ctx.lineTo(gx, h)
ctx.stroke()
    }
    for (let gy = 0; gy < h; gy += 40) {
        ctx.beginPath()
ctx.moveTo(0, gy)
ctx.lineTo(w, gy)
ctx.stroke()
    }
    ctx.restore()

    // draw bullets
    bullets.forEach(b => {
        ctx.beginPath()
        ctx.fillStyle = '#ffd'
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2)
        ctx.fill()
    })

    // draw players
    players.forEach(p => {
        // spider body
        ctx.save()
        ctx.translate(p.pos.x, p.pos.y)

        // shadow
        ctx.beginPath()
ctx.fillStyle = 'rgba(0,0,0,0.25)'
ctx.ellipse(0, 12, 20, 10, 0, 0, Math.PI * 2)
ctx.fill()

        // body
        ctx.rotate(p.angle || 0)
        ctx.beginPath()
        ctx.fillStyle = p.color
        ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2)
        ctx.fill()

        // legs (rendered based on legs tier)
        const legTier = p.limbs.legs
        const legCount = legTier === 0 ? 0 : (legTier === 1 ? 6 : 8)
        ctx.save()
        for (let li = 0; li < legCount; li++) {
            const a = (li / legCount) * Math.PI * 2
            const lx = Math.cos(a) * 26, ly = Math.sin(a) * 14
            ctx.beginPath()
            ctx.strokeStyle = '#111'
            ctx.lineWidth = 3
            ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 8)
            ctx.lineTo(lx, ly)
            ctx.stroke()
        }
        ctx.restore()

        // eyes
        ctx.fillStyle = '#fff'
        ctx.beginPath()
ctx.arc(-6, -4, 3, 0, Math.PI * 2)
ctx.fill()
        ctx.beginPath()
ctx.arc(6, -4, 3, 0, Math.PI * 2)
ctx.fill()
        ctx.fillStyle = '#000'
        ctx.beginPath()
ctx.arc(-6, -4, 1.6, 0, Math.PI * 2)
ctx.fill()
        ctx.beginPath()
ctx.arc(6, -4, 1.6, 0, Math.PI * 2)
ctx.fill()

        // draw arm if any visually as front appendage
        if (p.limbs.arms.length > 0) {
            const armKey = p.limbs.arms[0]
            ctx.fillStyle = '#222'
            if (armKey === 'pistol') {
                ctx.fillRect(14, -6, 12, 6)
            } else if (armKey === 'chainsaw') {
                ctx.fillRect(14, -8, 12, 8)
                // saw teeth
                ctx.fillStyle = '#cfc'
                for (let t = 0; t < 4; t++) ctx.fillRect(14 + t * 3, -8, 1.8, 6)
            } else {
                ctx.beginPath()
                ctx.ellipse(16, 0, 6, 6, 0, 0, Math.PI * 2)
                ctx.fill()
            }
        }

        ctx.restore()

        // hp bar
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(p.pos.x - 28, p.pos.y - 30, 56, 6)
        ctx.fillStyle = 'rgba(255,110,110,0.95)'
        ctx.fillRect(p.pos.x - 28, p.pos.y - 30, 56 * Math.max(0, p.hp / p.maxHP), 6)
        // name
        ctx.fillStyle = '#dff'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(p.name, p.pos.x, p.pos.y - 40)
    })

    // HUD
    ctx.fillStyle = '#9ff'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`Round ${round} · Phase: ${roundPhase} · Players: ${players.length}`, 12, 18)

    // instructions
    ctx.fillStyle = '#cfe'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('SPACE to speed start/advance phases', w - 12, 18)
}

let lastTs = performance.now()
function loop(ts) {
    const dt = (ts - lastTs) / 1000
    lastTs = ts
    update(dt)
    draw()
    requestAnimationFrame(loop)
}

// initial setup
round = 1
bullets = []
players = []
for (let i = 0; i < playerCount; i++) players.push(createPlayer(i))
roundPhase = 'buy'
activeBuyerIndex = 0
buyOverlay.style.display = 'flex'
updateActiveBuyerUI()
renderPlayersUI()
roundText.innerText = `Round ${round} — Buying limbs`
requestAnimationFrame(loop)