// --- 获取 HTML 元素 ---
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d'); // 获取 2D 绘图上下文
const textInput = document.getElementById('textInput');
const updateButton = document.getElementById('updateButton');

// --- 基本配置 (可以后续从 VortexConfiguration 移植或直接定义) ---
const config = {
    numParticles: 5000,
    particleMaxSpeed: 4.5,
    particleMinSpeed: 0.0,
    attractionForce: 0.08,
    swirlForce: 0.005,
    damping: 0.99,
    hueShiftSpeed: 46, // 色调变化速度 (0-360度/帧)
    particleMinSize: 1,
    particleMaxSize: 2.5,
    fontSize: 160, // 初始字体大小，会被文本长度调整
    fontFamily: '"sans-serif', // 字体栈
    trailAlpha: 0.1, // 拖尾效果透明度 (0-1)
    defaultText: "请输入",
    textSamplingDensity: 2, // 文本采样密度 (值越小点越多)
    brightnessDistanceFactor: 150,
    minBrightness: 40, // HSL 亮度 %
    maxBrightness: 100, // HSL 亮度 %
    saturation: 100, // HSL 饱和度 %
};

let particles = [];        // 存储所有粒子的数组
let targetPoints = [];     // 存储从文本获取的目标点坐标
let currentHue = 0;        // 当前全局色调 (0-360)
let centerX, centerY;      // 画布中心点

// --- 设置画布尺寸 ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
    // 窗口大小改变时，最好重新生成目标点和粒子
    updateTextTarget(); // 调用更新函数
}

// --- 初始化 ---
// 监听窗口大小变化事件
window.addEventListener('resize', resizeCanvas);

// 初始化时设置一次画布大小
// resizeCanvas(); // 注释掉，让 updateTextTarget 首次调用时设置

console.log("粒子脚本已加载");

// 后续步骤将在这里添加 Particle 类、动画循环、文本采样、按钮事件等...
   // --- Particle 类定义 ---
   class Particle {
       constructor(targets, assignedTargetIndex) {
           // 从目标点列表中获取分配给这个粒子的目标点
           // 如果 targets 为空或索引无效，则使用画布中心作为后备
           this.target = (targets && targets.length > assignedTargetIndex)
                       ? targets[assignedTargetIndex]
                       : { x: centerX, y: centerY }; // Fallback

           // 随机化初始位置，让它们从屏幕各处飞入
           this.x = Math.random() * canvas.width;
           this.y = Math.random() * canvas.height;

           // 初始速度（可以设为0，或小的随机值）
           this.vx = (Math.random() - 0.5) * 2;
           this.vy = (Math.random() - 0.5) * 2;

           // 随机化粒子大小
           this.size = config.particleMinSize + Math.random() * (config.particleMaxSize - config.particleMinSize);
           this.color = `hsl(${currentHue}, 100%, 50%)`; // 初始颜色
       }

       // 更新粒子状态（核心物理逻辑）
       update() {
           // --- 计算到目标点的向量和距离 ---
           const dx = this.target.x - this.x;
           const dy = this.target.y - this.y;
           const distSq = dx * dx + dy * dy; // 用平方距离避免开方，提高性能
           const dist = (distSq > 1) ? Math.sqrt(distSq) : 1; // 避免除以零

           // --- 计算吸引力 ---
           // 力的大小可以与距离成正比（或者其他函数），这里简单处理
           const forceMagnitude = dist * config.attractionForce * 0.1; // 调整系数控制强度
           // 分解力到 x 和 y 方向
           const forceX = (dx / dist) * forceMagnitude;
           const forceY = (dy / dist) * forceMagnitude;
           // 更新速度
           this.vx += forceX;
           this.vy += forceY;

           // --- 计算漩涡力 (如果启用) ---
           if (config.swirlForce > 0) {
               const dxCenter = this.x - centerX;
               const dyCenter = this.y - centerY;
               const distCenterSq = dxCenter * dxCenter + dyCenter * dyCenter;
               if (distCenterSq > 1) { // 避免在中心点计算
                   const distCenter = Math.sqrt(distCenterSq);
                   // 施加一个垂直于中心向量的力来实现旋转
                   const swirlAccX = -dyCenter / distCenter * config.swirlForce;
                   const swirlAccY = dxCenter / distCenter * config.swirlForce;
                   this.vx += swirlAccX;
                   this.vy += swirlAccY;
               }
           }

           // --- 应用阻尼 (空气摩擦力) ---
           this.vx *= config.damping;
           this.vy *= config.damping;

           // --- 速度限制 ---
           const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
           if (speed > config.particleMaxSpeed) {
               this.vx = (this.vx / speed) * config.particleMaxSpeed;
               this.vy = (this.vy / speed) * config.particleMaxSpeed;
           } else if (config.particleMinSpeed > 0 && speed < config.particleMinSpeed && distSq < 10000) { // 距离目标近时应用最小速度
               if (speed > 0.01) {
                   this.vx = (this.vx / speed) * config.particleMinSpeed;
                   this.vy = (this.vy / speed) * config.particleMinSpeed;
               } else if (distSq > 1) { // 如果静止但没到目标点，给个随机推力
                   this.vx = (Math.random() - 0.5) * config.particleMinSpeed;
                   this.vy = (Math.random() - 0.5) * config.particleMinSpeed;
               }
           }

           // --- 更新位置 ---
           this.x += this.vx;
           this.y += this.vy;

           // --- 更新颜色 (基于全局色调和距离) ---
           const brightnessFactor = Math.max(config.minBrightness, config.maxBrightness - (dist / config.brightnessDistanceFactor));
           const brightness = Math.min(config.maxBrightness, brightnessFactor); // 限制亮度范围
           this.color = `hsl(${currentHue % 360}, ${config.saturation}%, ${brightness}%)`;
       }

       // 绘制粒子到画布
       draw() {
           ctx.fillStyle = this.color;
           ctx.beginPath(); // 开始绘制路径
           // 画一个圆点代表粒子
           ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
           ctx.fill(); // 填充颜色
       }
   }
   console.log("Particle class defined.");
   
   // --- 文本采样函数 (再次优化，增加冗余空间和调试) ---
   function getTextPoints(text, currentFontSize) {
       // --- 简化字体用于测试 (如果需要，取消注释下面这行) ---
       // config.fontFamily = 'monospace'; // 使用等宽字体测试
       // config.fontFamily = 'sans-serif'; // 使用通用无衬线字体测试
       // console.log(`[Debug] USING TEST FONT: ${config.fontFamily}`);
       // ----------------------------------------------------

       console.log(`[getTextPoints] Sampling text: "${text}" | Size: ${currentFontSize} | Font: ${config.fontFamily} | Style: ${config.fontStyle}`);
       const points = [];
       const density = config.textSamplingDensity;

       const tempCanvas = document.createElement('canvas');
       const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true }); // Hint for performance

       // --- 步骤 1: 设置字体并测量文本 ---
       const fontStyleString = config.fontStyle === 1 ? 'bold ' : (config.fontStyle === 2 ? 'italic ' : '');
       const fullFont = `${fontStyleString}${currentFontSize}px ${config.fontFamily}`;
       tempCtx.font = fullFont;
       const textMetrics = tempCtx.measureText(text);
       console.log("[getTextPoints] Text Metrics:", textMetrics);
       const textWidth = Math.ceil(textMetrics.width);

       // --- 步骤 2: 计算非常保守的画布尺寸 ---
       // 使用一个非常大的基于字号的估算值，确保足够空间
       const generousHeightEstimate = Math.ceil(currentFontSize * 1.5); // 估算高度为字号的1.5倍
       const largePadding = Math.ceil(currentFontSize * 0.6); // 非常大的内边距

       const canvasWidth = textWidth + 2 * largePadding;
       const canvasHeight = generousHeightEstimate + 2 * largePadding;

       tempCanvas.width = canvasWidth;
       tempCanvas.height = canvasHeight;
       console.log(`[getTextPoints] Temp canvas size: ${canvasWidth}x${canvasHeight} (Generous Padding)`);

       // --- 步骤 3: 在临时画布上绘制文本 ---
       tempCtx.font = fullFont; // 重设字体
       tempCtx.fillStyle = '#ffffff';
       tempCtx.textBaseline = 'top'; // 顶部对齐

       // 计算绘制位置: 确保在 Padding 内，并且稍微向下偏移一点
       const drawX = largePadding;
       const drawY = largePadding + currentFontSize * 0.1; // 在顶部 padding 基础上再稍微下移 10% 字高
       console.log(`[getTextPoints] Drawing text at (${drawX.toFixed(1)}, ${drawY.toFixed(1)}) on temp canvas.`);
       tempCtx.fillText(text, drawX, drawY);

        // --- [调试步骤 可选] ---
        // 如果你还遇到问题，取消下面几行注释，可以在页面左上角看到临时画布的内容
        /*
        tempCanvas.style.position = 'absolute';
        tempCanvas.style.top = '0';
        tempCanvas.style.left = '0';
        tempCanvas.style.border = '1px solid red';
        tempCanvas.style.backgroundColor = 'rgba(100, 100, 100, 0.5)';
        tempCanvas.style.zIndex = '100'; // 确保在最前面
        document.body.appendChild(tempCanvas);
        console.log("[Debug] Temporary canvas added to page for inspection.");
        */
        // --- [调试步骤 结束] ---
       // --- 步骤 4: 获取像素数据 ---
       if (canvasWidth <= 0 || canvasHeight <= 0) {
           console.warn("[getTextPoints] Calculated canvas width or height is zero, cannot sample.");
           return [];
       }
       try {
           const imageData = tempCtx.getImageData(0, 0, canvasWidth, canvasHeight).data;

           // --- 步骤 5: 计算居中偏移量 ---
           const offsetX = centerX - canvasWidth / 2;
           const offsetY = centerY - canvasHeight / 2;

           // --- 步骤 6: 遍历像素并采样 ---
           // *** 尝试更低的 Alpha 阈值 ***
           const alphaThreshold = 64; // 进一步降低阈值，尝试捕捉更模糊的边缘
           console.log(`[getTextPoints] Using Alpha Threshold: ${alphaThreshold}`);
           let pointsFound = 0;
           for (let y = 0; y < canvasHeight; y += density) {
               for (let x = 0; x < canvasWidth; x += density) {
                   const index = (y * canvasWidth + x) * 4 + 3; // Alpha 通道索引
                   if (imageData[index] > alphaThreshold) {
                       points.push({ x: x + offsetX, y: y + offsetY });
                       pointsFound++;
                   }
               }
           }
           console.log(`[getTextPoints] Sampled ${pointsFound} target points.`);

           if (pointsFound === 0 && text.length > 0) {
               console.warn("[getTextPoints] Sampling resulted in 0 points! Check font/rendering/threshold.");
               // 如果开启了上面的调试画布，现在可以检查它了
           }

            // --- [调试步骤 可选] 清理调试画布 ---
            // if (document.body.contains(tempCanvas)) {
            //     setTimeout(() => { document.body.removeChild(tempCanvas); }, 5000); // 5秒后移除
            // }
            // --- [调试步骤 结束] ---

           return points;

       } catch (error) {
           console.error("[getTextPoints] Error getting image data:", error);
           // 尝试清理调试画布（如果存在）
           // if (document.body.contains(tempCanvas)) {
           //    document.body.removeChild(tempCanvas);
           // }
           return []; // 出错时返回空数组
       }
   }
	     // --- 重置/创建粒子 ---
	     function resetParticles() {
	         particles = []; // 清空现有粒子
	         const numTargetPoints = targetPoints.length;
	         if (numTargetPoints === 0) {
	             console.warn("No target points available for resetParticles.");
	             return; // 如果没有目标点，无法创建粒子
	         }
	         console.log(`Resetting ${config.numParticles} particles for ${numTargetPoints} targets.`);
	         // 创建新的粒子，并将它们均匀（或随机）分配到目标点
	         for (let i = 0; i < config.numParticles; i++) {
	             // 使用取模运算 (%) 将粒子分配到不同的目标点上
	             const targetIndex = i % numTargetPoints;
	             particles.push(new Particle(targetPoints, targetIndex));
	         }
	     }
	     console.log("resetParticles function defined.");
	  
	     // --- 更新文本目标并重置粒子 ---
	     function updateTextTarget() {
	         const text = textInput.value || config.defaultText; // 获取输入框文本或默认文本
	          if (!text) {
	              console.warn("Input text is empty, skipping update.");
	              targetPoints = []; // 清空目标点
	              particles = []; // 清空粒子
	              return;
	          }
	  
	          // --- 动态调整字体大小 (可选，基于文本长度) ---
	          let dynamicFontSize = config.fontSize;
	          // 简单示例：如果文字太多，稍微缩小字体
	          if (text.length > 6) {
	              dynamicFontSize = Math.max(80, config.fontSize - (text.length - 6) * 10); // 最小80
	          } else if (text.length < 3) {
	               dynamicFontSize = Math.min(220, config.fontSize + (3 - text.length) * 15); // 最大220
	          }
	  
	  
	         // 获取新的目标点
	         targetPoints = getTextPoints(text, dynamicFontSize);
	         // 重置粒子以适应新的目标点
	         resetParticles();
	     }
	     console.log("updateTextTarget function defined.");
		 
		    // --- 动画循环 ---
		    function animate() {
		        // 1. 清除画布 (或绘制拖尾效果)
		        ctx.fillStyle = `rgba(0, 0, 0, ${config.trailAlpha})`; // 使用配置的透明度
		        ctx.fillRect(0, 0, canvas.width, canvas.height);
		        // ctx.clearRect(0, 0, canvas.width, canvas.height); // 如果不需要拖尾效果，用这个
		 
		        // 2. 更新全局色调
		        currentHue += config.hueShiftSpeed;
		 
		        // 3. 更新并绘制所有粒子
		        particles.forEach(particle => {
		            particle.update(); // 更新状态
		            particle.draw();   // 绘制到画布
		        });
		 
		        // 4. 请求下一帧动画
		        requestAnimationFrame(animate);
		    }
		    console.log("animate function defined.");
			
			   // --- 事件监听器 ---
			   // 监听“生成”按钮点击事件
			   updateButton.addEventListener('click', () => {
			       console.log("Update button clicked.");
			       updateTextTarget(); // 点击按钮时更新目标
			   });
			
			   // 监听输入框回车事件 (可选)
			   textInput.addEventListener('keypress', (event) => {
			       if (event.key === 'Enter') {
			           console.log("Enter key pressed in input.");
			           updateTextTarget(); // 回车时也更新目标
			       }
			   });
			
			   // --- 初始启动 ---
			   console.log("Setting up initial state...");
			   resizeCanvas(); // 首次设置画布尺寸并生成初始文本的粒子
			   animate();      // 启动动画循环
			
			   console.log("Initialization complete. Animation should start.");
 
    // --- 执行异步初始化函数 ---
    initializeAndRun();
