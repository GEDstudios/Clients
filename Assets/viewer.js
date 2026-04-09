import { DotLottie } from "https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web/+esm";

// 1. UTILS: Navbar Injection
function injectNavigation(config) {
    if (document.querySelector('.global-nav')) return;

    const rootDepth = config.navDepth || "../../";
    const isLanding = config.type === 'landing';
    const logoPath = `${rootDepth}Assets/logo.svg`;
    const backLink = config.homePath || "../../";

    const nav = document.createElement('nav');
    nav.className = 'global-nav';
    nav.innerHTML = `
        <div class="nav-left">
            ${!isLanding ? `
            <a href="${backLink}" class="nav-link">
                <span style="font-size:16px;">&larr;</span> Back
            </a>` : ''}
        </div>
        <div class="nav-right">
            <a href="https://x10guy.studio" target="_blank" class="nav-brand">
                <div class="credit-wrapper">
                    <span class="credit-small">Animated & Developed by</span>
                    <span class="credit-main">Guy Ekstein <span class="credit-highlight">@ x10guy</span></span>
                </div>
                <img src="${logoPath}" alt="Logo" class="nav-logo">
            </a>
        </div>
    `;
    document.body.prepend(nav);
}

// 2. THEME ENGINE
function applyTheme(theme) {
    if (!theme) return;
    const root = document.documentElement.style;
    if (theme.brand) {
        root.setProperty('--brand-primary', theme.brand);
        root.setProperty('--brand-glow', `${theme.brand}66`);
    }
    if (theme.pageBg) root.setProperty('--bg-deep', theme.pageBg);
    if (theme.cardBg) root.setProperty('--bg-card', theme.cardBg);
    if (theme.lottieBg) {
        if (theme.lottieBg.dark) root.setProperty('--lottie-bg-dark', theme.lottieBg.dark);
        if (theme.lottieBg.light) root.setProperty('--lottie-bg-light', theme.lottieBg.light);
    }
}

// 3. LOGIC: Lottie Card Class
class LottieCard {
    constructor(wrapper, data) {
        this.wrapper = wrapper;
        this.data = data;
        
        this.container = wrapper.querySelector('.lottie-container');
        this.timelineWrapper = wrapper.querySelector('.timeline-wrapper');
        this.track = wrapper.querySelector('.timeline-track');
        this.playhead = wrapper.querySelector('.playhead');
        this.frameDisplay = wrapper.querySelector('.frame-counter-text');
        this.playPauseBtn = wrapper.querySelector('.play-pause-btn');
        
        this.lottie = null;
        this.totalFrames = 0;
        this.isHovering = false;
        this.isFrozen = false;
        this.isLoopLocked = false;
        this.ignoreLoopBarrier = false;
        this.rafId = null;

        // Interaction States
        this.isManuallyPaused = false;
        this.isScrubbing = false;
        this.wasPlayingBeforeScrub = false;

        // Bind scrub methods for window listeners
        this.handleScrubMove = (e) => this.doScrub(e);
        this.handleScrubEnd = () => this.endScrub();

        this.parseSettings();
        this.initTheme();
        this.loadAnimation();
        
        this.container.addEventListener('mouseenter', () => this.onHover(true));
        this.container.addEventListener('mouseleave', () => this.onHover(false));
        
        // Setup Play/Pause & Scrubbing
        this.container.addEventListener('click', () => this.togglePause());
        this.playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePause();
        });
        
        this.timelineWrapper.addEventListener('mousedown', (e) => this.startScrub(e));
    }

    parseSettings() {
        const name = this.data.fileName;
        this.hasTheme = this.data.theme === true || name.includes('{theme}');
        this.currentTheme = 'Black'; 

        if (this.data.loop === true) { this.type = 'full_loop'; return; }
        if (this.data.loop === 'hover') { this.type = 'hover_loop'; return; }
        if (this.data.loop === false) { this.type = 'play_once'; return; }

        const loopMatch = name.match(/Loop-(\d+)-(\d+)/i);
        const freezeMatch = name.match(/Freeze-(\d+)/i);

        if (loopMatch) {
            this.type = 'segment_loop';
            this.loopStart = parseInt(loopMatch[1]);
            this.loopEnd = parseInt(loopMatch[2]);
        } else if (freezeMatch) {
            this.type = 'freeze';
            this.freezeFrame = parseInt(freezeMatch[1]);
        } else if (name.toLowerCase().includes('loop') && !loopMatch) {
            this.type = 'full_loop';
        } else {
            this.type = 'hover_loop';
        }
    }

    initTheme() {
        if(!this.hasTheme) return;
        const toggleInput = this.wrapper.querySelector('input[type="checkbox"]');
        if(toggleInput) {
            toggleInput.addEventListener('change', (e) => {
                this.currentTheme = e.target.checked ? 'White' : 'Black';
                this.loadAnimation();
            });
        }
    }

    getFilePath() {
        let name = this.data.fileName;
        if (this.hasTheme) {
            if (name.includes('{theme}')) name = name.replace('{theme}', this.currentTheme);
            return `Lotties/${this.currentTheme}/${name}`;
        }
        return `Lotties/${name}`;
    }

    loadAnimation() {
        if (this.lottie) {
            this.lottie.destroy();
            this.stopRenderLoop();
        }
        
        this.container.innerHTML = '<canvas></canvas>';
        const canvas = this.container.querySelector('canvas');
        const shouldUseNativeLoop = (this.type === 'full_loop');

        this.lottie = new DotLottie({
            canvas: canvas,
            src: this.getFilePath(),
            loop: shouldUseNativeLoop, 
            autoplay: this.type === 'full_loop',
            renderConfig: {
                devicePixelRatio: window.devicePixelRatio // retina scaling fix
            }
        });

        this.lottie.addEventListener('load', () => {
            this.totalFrames = this.lottie.totalFrames;
            this.buildTimelineSegments();
            
            if(this.type !== 'full_loop') {
                this.lottie.setFrame(0);
                this.updateUI();
            }
            this.startRenderLoop();
        });

        this.lottie.addEventListener('complete', () => {
            if (this.type === 'hover_loop' && this.isHovering && !this.isManuallyPaused) {
                this.lottie.setFrame(0);
                this.lottie.play();
            } else if (this.type === 'segment_loop' && this.isHovering && !this.isManuallyPaused) {
                this.ignoreLoopBarrier = false;
                this.lottie.setFrame(0);
                this.lottie.play();
            } else {
                this.wrapper.classList.remove('playing');
            }
        });

        this.lottie.load();
    }

    buildTimelineSegments() {
        this.track.innerHTML = ''; 
        if (this.type === 'segment_loop' && this.totalFrames > 0) {
            const introPct = (this.loopStart / this.totalFrames) * 100;
            const loopLen = this.loopEnd - this.loopStart;
            const loopPct = (loopLen / this.totalFrames) * 100;
            const outroPct = 100 - (introPct + loopPct);

            if(introPct > 0) {
                const el = document.createElement('div');
                el.className = 't-seg intro'; el.style.width = `${introPct}%`; this.track.appendChild(el);
            }
            const elLoop = document.createElement('div');
            elLoop.className = 't-seg loop'; elLoop.style.left = `${introPct}%`; elLoop.style.width = `${loopPct}%`; this.track.appendChild(elLoop);
            if(outroPct > 0) {
                const elOut = document.createElement('div');
                elOut.className = 't-seg outro'; elOut.style.width = `${outroPct}%`; this.track.appendChild(elOut);
            }
        } else {
            const full = document.createElement('div');
            full.className = 't-seg full'; this.track.appendChild(full);
        }
    }

    startRenderLoop() {
        const loop = () => {
            if (this.lottie && this.lottie.isPlaying && !this.isScrubbing) {
                this.handleFrameLogic(this.lottie.currentFrame);
                this.updateUI();
            }
            this.rafId = requestAnimationFrame(loop);
        };
        loop();
    }

    stopRenderLoop() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
    }

    handleFrameLogic(frame) {
        if (this.type === 'full_loop' || this.type === 'hover_loop') return;

        if (this.type === 'segment_loop') {
            if (this.isHovering) {
                if (frame >= this.loopEnd && !this.ignoreLoopBarrier) {
                    this.lottie.setFrame(this.loopStart);
                }
            } else {
                if (frame >= this.loopStart && !this.isLoopLocked && frame < this.loopEnd) {
                    this.isLoopLocked = true;
                }
                if (this.isLoopLocked && frame >= this.loopEnd) {
                    this.isLoopLocked = false;
                }
            }
        } else if (this.type === 'freeze') {
            if (this.isHovering && !this.isFrozen && frame >= this.freezeFrame) {
                this.lottie.pause();
                this.isFrozen = true;
                this.wrapper.classList.add('frozen');
                this.updateUI(); 
            }
        }
    }

    /* --- INTERACTION METHODS --- */
    
    togglePause() {
        if (!this.lottie) return;
        this.isManuallyPaused = !this.isManuallyPaused;
        
        if (this.isManuallyPaused) {
            this.lottie.pause();
            this.wrapper.classList.remove('playing');
            this.wrapper.classList.add('paused');
        } else {
            this.wrapper.classList.remove('paused');
            if (this.type === 'full_loop' || this.isHovering) {
                this.wrapper.classList.add('playing');
                this.lottie.play();
            }
        }
    }

    startScrub(e) {
        if (!this.lottie || !this.totalFrames) return;
        this.isScrubbing = true;
        this.wasPlayingBeforeScrub = this.lottie.isPlaying;
        this.lottie.pause();
        
        window.addEventListener('mousemove', this.handleScrubMove);
        window.addEventListener('mouseup', this.handleScrubEnd);
        
        this.updateScrubPosition(e);
        this.wrapper.classList.add('playing');
    }

    doScrub(e) {
        if (!this.isScrubbing || !this.lottie) return;
        this.updateScrubPosition(e);
    }

    endScrub() {
        if (!this.isScrubbing) return;
        this.isScrubbing = false;
        
        window.removeEventListener('mousemove', this.handleScrubMove);
        window.removeEventListener('mouseup', this.handleScrubEnd);
        
        if (this.wasPlayingBeforeScrub && !this.isManuallyPaused) {
            this.lottie.play();
        } else if (!this.isHovering && this.type !== 'full_loop') {
             this.wrapper.classList.remove('playing');
        }
    }

    updateScrubPosition(e) {
        const rect = this.timelineWrapper.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));
        const pct = x / rect.width;
        const targetFrame = pct * this.totalFrames;
        
        this.lottie.setFrame(targetFrame);
        this.updateUI(); 
    }

    onHover(state) {
        if (this.type === 'full_loop') return;
        this.isHovering = state;
        if (this.isScrubbing) return;

        if (state) {
            if (!this.isManuallyPaused) this.wrapper.classList.add('playing');
            if (this.type === 'segment_loop' && this.lottie.currentFrame > this.loopEnd) {
                this.ignoreLoopBarrier = true;
            } else {
                this.ignoreLoopBarrier = false;
            }

            if (this.isFrozen || (!this.lottie.isPlaying && !this.isManuallyPaused)) {
                this.isFrozen = false;
                this.wrapper.classList.remove('frozen');
                if(this.lottie.currentFrame >= this.totalFrames - 1) {
                    this.lottie.setFrame(0);
                }
                if (!this.isManuallyPaused) this.lottie.play();
            }
        } else {
            if (this.type === 'freeze') {
                this.isFrozen = false;
                this.wrapper.classList.remove('frozen');
                if (!this.isManuallyPaused) this.lottie.play();
            } else if (!this.isManuallyPaused) {
                this.wrapper.classList.remove('playing');
            }
        }
    }

    updateUI() {
        if (!this.lottie) return;
        const frame = this.lottie.currentFrame;
        const total = this.totalFrames || this.lottie.totalFrames;
        if (!total) return;
        const pct = (frame / total) * 100;
        if (this.playhead) this.playhead.style.left = `${pct}%`;
        if (this.frameDisplay) this.frameDisplay.textContent = Math.round(frame);
    }
}

// 4. INIT (Merged)
export function init(projectConfig, globalConfig) {
    const mergedTheme = { ...globalConfig?.theme, ...projectConfig?.theme, lottieBg: { ...globalConfig?.theme?.lottieBg, ...projectConfig?.theme?.lottieBg } };
    applyTheme(mergedTheme);
    injectNavigation(projectConfig); 
    
    const app = document.getElementById('app');

    if (projectConfig.type === 'landing') {
        const landingDesc = projectConfig.description || "Motion Design Deliverables";
        
        app.innerHTML = `<div class="container"><div class="header-area"><h1 class="page-title">${projectConfig.clientName}</h1><p class="page-desc">${landingDesc}</p></div><div class="versions-grid" id="grid"></div></div>`;
        const grid = document.getElementById('grid');
        
        projectConfig.projects.forEach(group => {
            const card = document.createElement('div'); card.className = 'group-card';
            let archiveHTML = '';
            if(group.archives && group.archives.length > 0) {
                archiveHTML = group.archives.map(arch => `
                    <a href="${arch.path}" class="archive-item">
                        <span class="arch-title">${arch.title}</span><span class="arch-label">${arch.label}</span>
                    </a>`).join('');
            }
            card.innerHTML = `
                <div class="card-category">${group.category}</div>
                <a href="${group.main.path}" class="main-version-link">
                    <div class="main-content">
                        <div class="main-tag-row">
                            <span class="v-tag-big">${group.main.tag}</span>
                            ${group.main.badge ? `<span class="v-badge">${group.main.badge}</span>` : ''}
                        </div>
                        <div class="v-desc-main">${group.main.desc}</div>
                        <div class="open-link">OPEN PROJECT &rarr;</div>
                    </div>
                </a>
                <div class="archive-container">${archiveHTML}</div>
            `;
            grid.appendChild(card);
        });

    } else if (projectConfig.type === 'project') {
        app.innerHTML = `<div class="container"><div class="header-area"><h1 class="page-title">${projectConfig.title}</h1><p class="page-desc">${projectConfig.description}</p></div><div id="sections"></div></div>`;
        const sectionsContainer = document.getElementById('sections');
        projectConfig.sections.forEach(sec => {
            const secDiv = document.createElement('div'); secDiv.innerHTML = `<h3 class="section-title">${sec.title}</h3><div class="lottie-grid"></div>`;
            const grid = secDiv.querySelector('.lottie-grid');
            sec.files.forEach(fileData => {
                const wrapper = document.createElement('div'); 
                wrapper.className = `animation-wrapper ${fileData.fullWidth ? 'full-width' : ''}`;
                
                const cleanName = fileData.fileName.replace(/\.(lottie|json)$/i, '').replace('{theme}', '').replace(/-/g, ' ');
                const hasTheme = fileData.theme === true || fileData.fileName.includes('{theme}');
                
                wrapper.innerHTML = `
                    <div class="card-header">
                        <div class="file-info">
                            <div class="file-name">${cleanName}</div>
                            ${fileData.note ? `<div class="feedback-badge">${fileData.note}</div>` : ''}
                        </div>
                        ${hasTheme ? `<label class="theme-switch"><input type="checkbox"><div class="switch-track"><div class="switch-knob"></div></div></label>` : ''}
                    </div>
                    <div class="lottie-container"></div>
                    <div class="bottom-bar">
                        <button class="play-pause-btn" aria-label="Play/Pause">
                            <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        </button>
                        <div class="timeline-wrapper">
                            <div class="timeline-track"></div>
                            <div class="playhead"></div>
                        </div>
                        <div class="frame-display">Frame: <span class="frame-counter-text">0</span></div>
                    </div>
                `;
                grid.appendChild(wrapper);
                new LottieCard(wrapper, fileData);
            });
            sectionsContainer.appendChild(secDiv);
        });
    }
}
