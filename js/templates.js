// Pre-built templates for common requests to ensure high-quality initial builds
window.Templates = {
  pacman: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #111; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; }
    canvas { border: 2px solid #222; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
    .score { font-size: 24px; margin-bottom: 10px; font-family: monospace; color: #ffeb3b; }
    .controls { margin-top: 15px; color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="score">SCORE: <span id="scoreVal">0</span></div>
  <canvas id="gameCanvas" width="400" height="400"></canvas>
  <div class="controls">Use Arrow Keys to Move</div>

  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('scoreVal');
    const CELL_SIZE = 20;
    const GRID_WIDTH = canvas.width / CELL_SIZE;
    const GRID_HEIGHT = canvas.height / CELL_SIZE;

    // 0: Wall, 1: Dot, 2: Empty, 3: Power Pellet
    const map = [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,0],
      [0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,1,0],
      [0,3,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,3,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,0,0,1,0,1,0,0,0,0,0,0,1,0,1,0,0,1,0],
      [0,1,1,1,1,0,1,1,1,0,0,1,1,1,0,1,1,1,1,0],
      [0,0,0,0,1,0,0,0,2,0,0,2,0,0,0,1,0,0,0,0],
      [2,2,2,0,1,0,2,2,2,2,2,2,2,2,0,1,0,2,2,2],
      [0,0,0,0,1,0,2,0,0,2,2,0,0,2,0,1,0,0,0,0],
      [2,2,2,2,1,2,2,0,2,2,2,2,0,2,2,1,2,2,2,2],
      [0,0,0,0,1,0,2,0,0,0,0,0,0,2,0,1,0,0,0,0],
      [0,1,1,1,1,0,2,2,2,2,2,2,2,2,0,1,1,1,1,0],
      [0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0,1,0],
      [0,3,1,0,1,1,1,1,1,0,0,1,1,1,1,1,0,1,3,0],
      [0,0,1,0,1,0,0,0,1,0,0,1,0,0,0,1,0,1,0,0],
      [0,1,1,1,1,0,0,0,1,0,0,1,0,0,0,1,1,1,1,0],
      [0,1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];

    let pacman = { x: 10, y: 15, dx: 0, dy: 0, nextDx: 0, nextDy: 0, angle: 0, mouth: 0, mouthOpen: true };
    let score = 0;
    let ghosts = [
      { x: 9, y: 9, color: 'red', dx: 1, dy: 0 },
      { x: 10, y: 9, color: 'pink', dx: -1, dy: 0 },
      { x: 9, y: 10, color: 'cyan', dx: 0, dy: 1 },
      { x: 10, y: 10, color: 'orange', dx: 0, dy: -1 }
    ];

    function drawMap() {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      for(let y=0; y<GRID_HEIGHT; y++) {
        for(let x=0; x<GRID_WIDTH; x++) {
          if(map[y][x] === 0) {
            ctx.fillStyle = '#191970';
            ctx.fillRect(x*CELL_SIZE, y*CELL_SIZE, CELL_SIZE, CELL_SIZE);
            ctx.strokeStyle = '#232390';
            ctx.strokeRect(x*CELL_SIZE, y*CELL_SIZE, CELL_SIZE, CELL_SIZE);
          } else if(map[y][x] === 1) {
            ctx.fillStyle = '#ffb7ae';
            ctx.beginPath();
            ctx.arc(x*CELL_SIZE + CELL_SIZE/2, y*CELL_SIZE + CELL_SIZE/2, 2, 0, Math.PI*2);
            ctx.fill();
          } else if(map[y][x] === 3) {
            ctx.fillStyle = '#ffb7ae';
            ctx.beginPath();
            ctx.arc(x*CELL_SIZE + CELL_SIZE/2, y*CELL_SIZE + CELL_SIZE/2, 6, 0, Math.PI*2);
            ctx.fill();
          }
        }
      }
    }

    function drawPacman() {
      ctx.save();
      ctx.translate(pacman.x * CELL_SIZE + CELL_SIZE/2, pacman.y * CELL_SIZE + CELL_SIZE/2);
      ctx.rotate(pacman.angle);
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      const mouthAngle = pacman.mouthOpen ? 0.25 : 0.05;
      ctx.arc(0, 0, CELL_SIZE/2 - 2, mouthAngle * Math.PI, (2 - mouthAngle) * Math.PI);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();
    }

    function drawGhosts() {
      ghosts.forEach(g => {
        ctx.fillStyle = g.color;
        const x = g.x * CELL_SIZE + CELL_SIZE/2;
        const y = g.y * CELL_SIZE + CELL_SIZE/2;
        const r = CELL_SIZE/2 - 2;
        ctx.beginPath();
        ctx.arc(x, y-2, r, Math.PI, 0);
        ctx.lineTo(x+r, y+r);
        ctx.lineTo(x-r, y+r);
        ctx.fill();
        // Eyes
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(x-4, y-4, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+4, y-4, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'blue';
        ctx.beginPath(); ctx.arc(x-4 + g.dx*2, y-4 + g.dy*2, 1.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x+4 + g.dx*2, y-4 + g.dy*2, 1.5, 0, Math.PI*2); ctx.fill();
      });
    }

    function movePacman() {
      // Try to turn
      if (pacman.nextDx || pacman.nextDy) {
        let nextX = pacman.x + pacman.nextDx;
        let nextY = pacman.y + pacman.nextDy;
        if (map[nextY] && map[nextY][nextX] !== 0) {
          pacman.dx = pacman.nextDx;
          pacman.dy = pacman.nextDy;
          pacman.nextDx = 0;
          pacman.nextDy = 0;
          
          if(pacman.dx === 1) pacman.angle = 0;
          if(pacman.dx === -1) pacman.angle = Math.PI;
          if(pacman.dy === 1) pacman.angle = Math.PI/2;
          if(pacman.dy === -1) pacman.angle = -Math.PI/2;
        }
      }

      let nextX = pacman.x + pacman.dx;
      let nextY = pacman.y + pacman.dy;

      if (map[nextY] && map[nextY][nextX] !== 0) {
        pacman.x = nextX;
        pacman.y = nextY;
      }

      // Eat dots
      if (map[pacman.y][pacman.x] === 1) {
        map[pacman.y][pacman.x] = 2;
        score += 10;
        scoreEl.innerText = score;
      } else if (map[pacman.y][pacman.x] === 3) {
        map[pacman.y][pacman.x] = 2;
        score += 50;
        scoreEl.innerText = score;
        // Power pellet logic could go here
      }
      
      pacman.mouthOpen = !pacman.mouthOpen;
    }

    function moveGhosts() {
      ghosts.forEach(g => {
        // Simple random movement with preference for current direction
        const dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        const validDirs = dirs.filter(d => {
          // Don't reverse immediately if possible
          if (d.x === -g.dx && d.y === -g.dy) return false;
          return map[g.y + d.y] && map[g.y + d.y][g.x + d.x] !== 0;
        });

        // If dead end, allow reverse
        if (validDirs.length === 0) {
           const reverse = dirs.find(d => map[g.y + d.y] && map[g.y + d.y][g.x + d.x] !== 0);
           if(reverse) { g.dx = reverse.x; g.dy = reverse.y; }
        } else {
           const choice = validDirs[Math.floor(Math.random() * validDirs.length)];
           g.dx = choice.x;
           g.dy = choice.y;
        }

        g.x += g.dx;
        g.y += g.dy;
      });
    }

    function gameLoop() {
      movePacman();
      if(frameCount % 2 === 0) moveGhosts(); // Ghosts move slower
      
      drawMap();
      drawPacman();
      drawGhosts();
      
      // Collision
      ghosts.forEach(g => {
        if(g.x === pacman.x && g.y === pacman.y) {
          // Reset game
          pacman.x = 10; pacman.y = 15; pacman.dx = 0; pacman.dy = 0;
          alert('Game Over! Score: ' + score);
          score = 0;
          scoreEl.innerText = score;
          // Reset dots
          // (In a full game, we'd reload the level)
        }
      });

      frameCount++;
    }

    let frameCount = 0;
    setInterval(gameLoop, 150);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { pacman.nextDx = 0; pacman.nextDy = -1; }
      if (e.key === 'ArrowDown') { pacman.nextDx = 0; pacman.nextDy = 1; }
      if (e.key === 'ArrowLeft') { pacman.nextDx = -1; pacman.nextDy = 0; }
      if (e.key === 'ArrowRight') { pacman.nextDx = 1; pacman.nextDy = 0; }
    });
  </script>
</body>
</html>`
};