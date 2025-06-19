    const canvas        = document.getElementById('gameCanvas');
    const ctx           = canvas.getContext('2d');
    const gridSize      = 30;
    const cols          = Math.floor(canvas.width  / gridSize);
    const rows          = Math.floor(canvas.height / gridSize);

    // game state
    let gameRunning     = true;
    let playerScore     = 0;
    let aiScore         = 0;
    const WIN_SCORE     = 15;
    const DEFAULT_SPEED = 200; // ms per move
    let playerSpeed     = DEFAULT_SPEED;
    let aiSpeed         = DEFAULT_SPEED;
    let playerInterval, aiInterval;

    // snakes & directions
    let playerSnake     = [{ x: 5, y: 5 }];
    let playerDirection = { x: 1, y: 0 };
    let aiSnake         = [{ x: cols - 6, y: rows - 6 }];
    let aiDirection     = { x: 0, y: 0 };

    // items
    let fruits          = [];
    let powerUps        = [];
    let greenItems      = [];
    const BOOST_DURATION = 5000; // ms
    const GREEN_COUNT    = 2;

    // ─── Initialization ─────────────────────────────────────────
    function init() {
      generateFruits();
      generatePowerUps();
      generateGreenItems();
      updateScore();
      startIntervals();
      renderLoop();
    }

    function startIntervals() {
      clearIntervals();
      playerInterval = setInterval(movePlayer, playerSpeed);
      aiInterval     = setInterval(() => {
        updateAI();
        moveAI();
      }, aiSpeed);
    }

    function clearIntervals() {
      clearInterval(playerInterval);
      clearInterval(aiInterval);
    }

    // ─── Continuous rendering ───────────────────────────────────
    function renderLoop() {
      if (!gameRunning) return;
      draw();
      requestAnimationFrame(renderLoop);
    }

    // ─── Helpers ────────────────────────────────────────────────
    function randomPosition() {
      return {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows)
      };
    }

    function isPositionOccupied(pos) {
      return [...playerSnake, ...aiSnake, ...fruits, ...powerUps, ...greenItems]
        .some(seg => seg.x === pos.x && seg.y === pos.y);
    }

    function applySpeedBoost(toSnake) {
      if (toSnake === 'player') {
        clearInterval(playerInterval);
        playerSpeed = DEFAULT_SPEED / 2;
        playerInterval = setInterval(movePlayer, playerSpeed);
        setTimeout(() => {
          clearInterval(playerInterval);
          playerSpeed = DEFAULT_SPEED;
          playerInterval = setInterval(movePlayer, playerSpeed);
        }, BOOST_DURATION);
      } else {
        clearInterval(aiInterval);
        aiSpeed = DEFAULT_SPEED / 2;
        aiInterval = setInterval(() => {
          updateAI();
          moveAI();
        }, aiSpeed);
        setTimeout(() => {
          clearInterval(aiInterval);
          aiSpeed = DEFAULT_SPEED;
          aiInterval = setInterval(() => {
            updateAI();
            moveAI();
          }, aiSpeed);
        }, BOOST_DURATION);
      }
    }

    // ─── Generate items ─────────────────────────────────────────
    function generateFruits() {
      fruits = [];
      for (let i = 0; i < 4; i++) {
        let pos, attempts = 0;
        do {
          pos = randomPosition(); attempts++;
        } while (isPositionOccupied(pos) && attempts < 100);
        if (attempts < 100) fruits.push(pos);
      }
    }

    function generatePowerUps() {
      powerUps = [];
      for (let i = 0; i < 2; i++) {
        let pos, attempts = 0;
        do {
          pos = randomPosition(); attempts++;
        } while (isPositionOccupied(pos) && attempts < 100);
        if (attempts < 100) powerUps.push(pos);
      }
    }

    function generateGreenItems() {
      greenItems = [];
      for (let i = 0; i < GREEN_COUNT; i++) {
        let pos, attempts = 0;
        do {
          pos = randomPosition(); attempts++;
        } while (isPositionOccupied(pos) && attempts < 100);
        if (attempts < 100) greenItems.push(pos);
      }
    }

    // ─── A* Pathfinding for AI ──────────────────────────────────
    function heuristic(a, b) {
      return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    function findPath(start, goal, obstacles) {
      let openSet = [{ ...start, g: 0, h: heuristic(start, goal), f: heuristic(start, goal), parent: null }];
      let closedSet = [];
      while (openSet.length) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        if (current.x === goal.x && current.y === goal.y) {
          const path = [];
          for (let node = current; node; node = node.parent) {
            path.unshift({ x: node.x, y: node.y });
          }
          return path.slice(1);
        }
        closedSet.push(current);
        for (const dir of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]) {
          const n = { x: current.x + dir.x, y: current.y + dir.y };
          if (n.x < 0 || n.x >= cols || n.y < 0 || n.y >= rows) continue;
          if (obstacles.some(o => o.x === n.x && o.y === n.y)) continue;
          if (closedSet.some(o => o.x === n.x && o.y === n.y)) continue;
          const g = current.g + 1, h = heuristic(n, goal), f = g + h;
          const existing = openSet.find(o => o.x === n.x && o.y === n.y);
          const node = { x: n.x, y: n.y, g, h, f, parent: current };
          if (!existing) openSet.push(node);
          else if (g < existing.g) {
            openSet.splice(openSet.indexOf(existing), 1, node);
          }
        }
      }
      return [];
    }

    function updateAI() {
      if (!gameRunning) return;
      const head = aiSnake[0];

      // prefer fruits first, then green, then power-ups
      let targetList = fruits.length ? fruits : (greenItems.length ? greenItems : powerUps);
      if (targetList.length === 0) return;

      let nearest = targetList[0], minD = heuristic(head, nearest);
      targetList.forEach(f => {
        const d = heuristic(head, f);
        if (d < minD) { minD = d; nearest = f; }
      });
      const obstacles = [...playerSnake, ...aiSnake.slice(1)];
      const path = findPath(head, nearest, obstacles);
      if (path.length) {
        aiDirection = {
          x: path[0].x - head.x,
          y: path[0].y - head.y
        };
      }
    }

    // ─── Movement ──────────────────────────────────────────────
    function movePlayer() {
      if (!gameRunning) return;
      const head = { x: playerSnake[0].x + playerDirection.x, y: playerSnake[0].y + playerDirection.y };
      // collisions
      if (
        head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows ||
        playerSnake.some(s => s.x === head.x && s.y === head.y) ||
        aiSnake    .some(s => s.x === head.x && s.y === head.y)
      ) {
        endGame('🤖 AI Wins!', 'Player crashed!');
        return;
      }
      playerSnake.unshift(head);

      // fruit
      let ate = false;
      fruits = fruits.filter(f => {
        if (f.x === head.x && f.y === head.y) {
          playerScore++; updateScore();
          if (playerScore >= WIN_SCORE) endGame('🎉 Player Wins!', 'You beat the AI!');
          ate = true;
          return false;
        }
        return true;
      });
      if (!ate) playerSnake.pop();

      // power-up
      powerUps = powerUps.filter(p => {
        if (p.x === head.x && p.y === head.y) {
          applySpeedBoost('player');
          return false;
        }
        return true;
      });

      // green: shrink opponent
      greenItems = greenItems.filter(g => {
        if (g.x === head.x && g.y === head.y) {
          if (aiScore > 0) aiScore--;
          if (aiSnake.length > 1) aiSnake.pop();
          updateScore();
          return false;
        }
        return true;
      });

      replenish();
    }

    function moveAI() {
      if (!gameRunning) return;
      const head = { x: aiSnake[0].x + aiDirection.x, y: aiSnake[0].y + aiDirection.y };
      if ((aiDirection.x || aiDirection.y) &&
          (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows ||
           aiSnake    .some(s => s.x === head.x && s.y === head.y) ||
           playerSnake.some(s => s.x === head.x && s.y === head.y))
      ) {
        endGame('🎉 Player Wins!', 'AI crashed!');
        return;
      }
      aiSnake.unshift(head);

      // fruit
      let ate = false;
      fruits = fruits.filter(f => {
        if (f.x === head.x && f.y === head.y) {
          aiScore++; updateScore();
          if (aiScore >= WIN_SCORE) endGame('🤖 AI Wins!', '');
          ate = true;
          return false;
        }
        return true;
      });
      if (!ate) aiSnake.pop();

      // power-up
      powerUps = powerUps.filter(p => {
        if (p.x === head.x && p.y === head.y) {
          applySpeedBoost('ai');
          return false;
        }
        return true;
      });

      // green: shrink opponent
      greenItems = greenItems.filter(g => {
        if (g.x === head.x && g.y === head.y) {
          if (playerScore > 0) playerScore--;
          if (playerSnake.length > 1) playerSnake.pop();
          updateScore();
          return false;
        }
        return true;
      });

      replenish();
    }

    function replenish() {
      while (fruits.length < 4) {
        let pos, at = 0;
        do { pos = randomPosition(); at++; }
        while (isPositionOccupied(pos) && at < 100);
        if (at < 100) fruits.push(pos);
      }
      while (powerUps.length < 2) {
        let pos, at = 0;
        do { pos = randomPosition(); at++; }
        while (isPositionOccupied(pos) && at < 100);
        if (at < 100) powerUps.push(pos);
      }
      while (greenItems.length < GREEN_COUNT) {
        let pos, at = 0;
        do { pos = randomPosition(); at++; }
        while (isPositionOccupied(pos) && at < 100);
        if (at < 100) greenItems.push(pos);
      }
    }

    // ─── Drawing ───────────────────────────────────────────────
    function draw() {
      // background/grid
      const grad = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
      grad.addColorStop(0,'rgba(15,23,42,0.95)');
      grad.addColorStop(0.5,'rgba(30,41,59,0.95)');
      grad.addColorStop(1,'rgba(51,65,85,0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      for (let i=0; i<=cols; i++) {
        ctx.beginPath(); ctx.moveTo(i*gridSize,0); ctx.lineTo(i*gridSize,canvas.height); ctx.stroke();
      }
      for (let i=0; i<=rows; i++) {
        ctx.beginPath(); ctx.moveTo(0,i*gridSize); ctx.lineTo(canvas.width,i*gridSize); ctx.stroke();
      }

      // draw snakes
      // Enhanced snake drawing function - replace your existing snake drawing code in the draw() function

// Draw snakes with enhanced UI
[
  { snake: playerSnake, color: '#4ade80', darkColor: '#22c55e', lightColor: '#86efac', isPlayer: true },
  { snake: aiSnake, color: '#ef4444', darkColor: '#dc2626', lightColor: '#fca5a5', isPlayer: false }
].forEach(({ snake, color, darkColor, lightColor, isPlayer }) => {
  snake.forEach((seg, i) => {
    const x = seg.x * gridSize;
    const y = seg.y * gridSize;
    const centerX = x + gridSize / 2;
    const centerY = y + gridSize / 2;
    
    if (i === 0) {
      // Enhanced head with gradient and glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      
      // Head gradient background
      const headGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, gridSize / 2);
      headGradient.addColorStop(0, lightColor);
      headGradient.addColorStop(0.7, color);
      headGradient.addColorStop(1, darkColor);
      
      ctx.fillStyle = headGradient;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, gridSize - 2, gridSize - 2, 8);
      ctx.fill();
      
      // Head border/outline
      ctx.shadowBlur = 0;
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, gridSize - 2, gridSize - 2, 8);
      ctx.stroke();
      
      // Enhanced eyes with pupils
      const eyeSize = 4;
      const pupilSize = 2;
      const eyeOffsetX = 6;
      const eyeOffsetY = 8;
      
      // Left eye
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x + eyeOffsetX, y + eyeOffsetY, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(x + eyeOffsetX, y + eyeOffsetY, pupilSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Right eye
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x + gridSize - eyeOffsetX, y + eyeOffsetY, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(x + gridSize - eyeOffsetX, y + eyeOffsetY, pupilSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Eye shine/reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(x + eyeOffsetX - 1, y + eyeOffsetY - 1, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + gridSize - eyeOffsetX - 1, y + eyeOffsetY - 1, 1, 0, Math.PI * 2);
      ctx.fill();
      
      // Nostril details
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.ellipse(x + gridSize/2 - 2, y + gridSize/2 + 2, 1, 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + gridSize/2 + 2, y + gridSize/2 + 2, 1, 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      
    } else {
      // Enhanced body segments with alternating pattern and scale texture
      const intensity = Math.max(0.3, 1 - (i / snake.length) * 0.7); // Fade towards tail
      const segmentSize = gridSize - 4 - (i * 0.5); // Gradually smaller segments
      const offset = (gridSize - segmentSize) / 2;
      
      // Body glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 * intensity;
      
      // Body gradient
      const bodyGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, segmentSize / 2);
      bodyGradient.addColorStop(0, `rgba(${isPlayer ? '134, 239, 172' : '252, 165, 165'}, ${intensity})`);
      bodyGradient.addColorStop(0.6, `rgba(${isPlayer ? '74, 222, 128' : '239, 68, 68'}, ${intensity})`);
      bodyGradient.addColorStop(1, `rgba(${isPlayer ? '34, 197, 94' : '220, 38, 38'}, ${intensity})`);
      
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.roundRect(x + offset, y + offset, segmentSize, segmentSize, 6);
      ctx.fill();
      
      // Scale pattern overlay
      ctx.shadowBlur = 0;
      if (i % 2 === 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * intensity})`;
        ctx.beginPath();
        ctx.roundRect(x + offset + 2, y + offset + 2, segmentSize - 4, segmentSize - 4, 4);
        ctx.fill();
      }
      
      // Segment separator lines
      if (i < snake.length - 1) {
        ctx.strokeStyle = `rgba(0, 0, 0, ${0.2 * intensity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // Determine direction to next segment
        const nextSeg = snake[i + 1];
        if (nextSeg.x === seg.x) {
          // Vertical connection
          const lineY = nextSeg.y > seg.y ? y + segmentSize + offset : y + offset;
          ctx.moveTo(x + offset + 3, lineY);
          ctx.lineTo(x + offset + segmentSize - 3, lineY);
        } else {
          // Horizontal connection  
          const lineX = nextSeg.x > seg.x ? x + segmentSize + offset : x + offset;
          ctx.moveTo(lineX, y + offset + 3);
          ctx.lineTo(lineX, y + offset + segmentSize - 3);
        }
        ctx.stroke();
      }
    }
  });
  
  // Reset shadow for other elements
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
});

// Note: Add this CSS to support roundRect if not available in older browsers
// You can add this check at the beginning of your script:
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y - radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}

      // draw fruits (yellow)
      const t = Date.now()*0.005;
fruits.forEach((f,i) => {
  const pulse = Math.sin(t+i)*0.2+0.8;
  ctx.shadowColor='#fbbf24'; ctx.shadowBlur=15*pulse;
  
  // Apple body
  ctx.fillStyle='#fbbf24';
  ctx.fillRect(f.x*gridSize+4, f.y*gridSize+6, gridSize-8, gridSize-10);
  
  // Apple highlight
  ctx.shadowBlur=0; ctx.fillStyle='#fef3c7';
  ctx.fillRect(f.x*gridSize+6, f.y*gridSize+8, 4, 4);
  
  // Apple stem
  ctx.fillStyle='#065f46';
  ctx.fillRect(f.x*gridSize+gridSize/2-1, f.y*gridSize+3, 2, 4);
  
  // Apple leaf
  ctx.fillStyle='#10b981';
  ctx.fillRect(f.x*gridSize+gridSize/2+1, f.y*gridSize+4, 3, 2);
});

      // draw power-ups (red)
      const boltScale = 2;

powerUps.forEach((p,i) => {
  const pulse = Math.sin(t + i + 5) * 0.3 + 0.7;
  const flash = Math.sin(t * 3 + i) * 0.5 + 0.5;
  
  // glow behind the bolt
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur  = 20 * pulse * boltScale;

  // bolt fill
  ctx.fillStyle = `rgba(251, 191, 36, ${0.8 + flash * 0.2})`;
  ctx.beginPath();

  const x = p.x * gridSize + gridSize/2;
  const y = p.y * gridSize + 4;

  // original offsets, each multiplied by boltScale
  ctx.moveTo(x + (-2) * boltScale, y + ( 0) * boltScale);
  ctx.lineTo(x + ( 1) * boltScale, y + ( 4) * boltScale);
  ctx.lineTo(x + (-1) * boltScale, y + ( 4) * boltScale);
  ctx.lineTo(x + ( 2) * boltScale, y + ( 8) * boltScale);
  ctx.lineTo(x + ( 1) * boltScale, y + ( 8) * boltScale);
  ctx.lineTo(x + ( 4) * boltScale, y + (12) * boltScale);
  ctx.lineTo(x + (-1) * boltScale, y + (10) * boltScale);
  ctx.lineTo(x + ( 1) * boltScale, y + (10) * boltScale);
  ctx.lineTo(x + (-2) * boltScale, y + ( 6) * boltScale);
  ctx.lineTo(x + (-1) * boltScale, y + ( 6) * boltScale);
  ctx.lineTo(x + (-4) * boltScale, y + ( 2) * boltScale);
  
  ctx.closePath();
  ctx.fill();

  // electric white highlight
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur  = 5 * boltScale;
  ctx.fillStyle   = `rgba(255, 255, 255, ${flash * 0.6})`;
  ctx.fill();

  // reset shadow
  ctx.shadowBlur = 0;
});
      // draw green items (shrink opponent)
      greenItems.forEach((g,i) => {
  const pulse = Math.sin(t+i+10)*0.2+0.8;
  const bubble = Math.sin(t*2+i*3)*0.1+0.9;
  ctx.shadowColor='#10b981'; ctx.shadowBlur=15*pulse;
  
  // Bottle body
  ctx.fillStyle='#065f46';
  ctx.fillRect(g.x*gridSize+6, g.y*gridSize+8, gridSize-12, gridSize-12);
  
  // Bottle neck
  ctx.fillStyle='#064e3b';
  ctx.fillRect(g.x*gridSize+8, g.y*gridSize+5, gridSize-16, 4);
  
  // Poison liquid
  ctx.fillStyle=`rgba(16, 185, 129, ${bubble})`;
  ctx.fillRect(g.x*gridSize+7, g.y*gridSize+10, gridSize-14, gridSize-16);
  
  // Skull symbol
  ctx.shadowBlur=0; ctx.fillStyle='#ffffff';
  // Skull outline
  ctx.fillRect(g.x*gridSize+9, g.y*gridSize+11, 6, 4);
  ctx.fillRect(g.x*gridSize+10, g.y*gridSize+15, 4, 2);
  // Eye holes
  ctx.fillStyle='#000000';
  ctx.fillRect(g.x*gridSize+10, g.y*gridSize+12, 1, 1);
  ctx.fillRect(g.x*gridSize+13, g.y*gridSize+12, 1, 1);
});
    }
    
    // ─── Score & end game ──────────────────────────────────────
    function updateScore() {
      document.getElementById('playerScore').textContent = playerScore;
      document.getElementById('aiScore').textContent     = aiScore;
      document.getElementById('playerProgress').style.width = (playerScore / WIN_SCORE * 100) + '%';
      document.getElementById('aiProgress').style.width     = (aiScore     / WIN_SCORE * 100) + '%';
    }

    function endGame(title, msg) {
      gameRunning = false;
      clearIntervals();
      document.getElementById('gameResult').innerHTML =
        `<div style="font-size:2.5rem;margin-bottom:15px;">${title}</div>
         <div style="font-size:1.2rem;color:rgba(255,255,255,0.8);">${msg}</div>
         <div style="margin-top:20px;font-size:1rem;">
           Final Score: Player ${playerScore} – AI ${aiScore}
         </div>`;
      document.getElementById('gameOver').style.display = 'flex';
    }

    function restartGame() {
      gameRunning     = true;
      playerScore     = aiScore = 0;
      playerSnake     = [{ x: 5, y: 5 }];
      aiSnake         = [{ x: cols - 6, y: rows - 6 }];
      playerDirection = { x: 1, y: 0 };
      aiDirection     = { x: 0, y: 0 };
      playerSpeed     = aiSpeed = DEFAULT_SPEED;
      generateFruits();
      generatePowerUps();
      generateGreenItems();
      updateScore();
      document.getElementById('gameOver').style.display = 'none';
      startIntervals();
      renderLoop();
    }

    // ─── Input ─────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
      if (!gameRunning) return;
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup':
          if (playerDirection.y === 0) playerDirection = { x: 0, y: -1 };
          break;
        case 's': case 'arrowdown':
          if (playerDirection.y === 0) playerDirection = { x: 0, y: 1 };
          break;
        case 'a': case 'arrowleft':
          if (playerDirection.x === 0) playerDirection = { x: -1, y: 0 };
          break;
        case 'd': case 'arrowright':
          if (playerDirection.x === 0) playerDirection = { x: 1, y: 0 };
          break;
      }
    });
    

    // ─── Start ─────────────────────────────────────────────────
    init();