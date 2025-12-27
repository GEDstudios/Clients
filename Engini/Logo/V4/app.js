/**
 * @file Main application logic for the Lottie animation grid.
 * Updated to handle dynamic filenames with {theme} placeholders.
 */

import { DotLottie } from "https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web/+esm";

(function () {
    'use strict';

    /**
     * Configuration for the Hero Animation
     */
    const HERO_CONFIG = {
        fileName: "Big Logo {theme}.lottie",
        autoplay: true,
        loop: true
    };

    /**
     * Configuration object for all animation sections and files.
     */
    const ANIMATION_SECTIONS = [
        {
            id: 'idle-grid',
            title: 'Idle',
            description: 'Standard idle state and the requested purplish variant.',
            animations: [
                {
                    fileName: "Idle {theme}.lottie",
                    animationType: "playOnce"
                },
                {
                    fileName: "Idle {theme} Purplish.lottie",
                    animationType: "playOnce",
                    feedback: "New purplish tint"
                }
            ]
        },
        {
            id: 'shapes-grid',
            title: 'Shapes',
            description: "Loop functionality: Hover to start loop, unhover to play outro.",
            animations: [
                {
                    fileName: "Loop-24-71 Shapes Suck In {theme}.lottie",
                    displayName: "Shapes Suck In",
                    animationType: "loop",
                    loopFrames: [24, 71],
                    feedback: "New geometry"

                },
                {
                    fileName: "Loop-10-57 Loading - Dots {theme}.lottie",
                    displayName: "Loading - Dots",
                    animationType: "loop",
                    loopFrames: [10, 57],
                    feedback: "New geometry & black color"
                },
                {
                    fileName: "Shapes Explosion {theme}.lottie",
                    animationType: "playOnce",
                    feedback: "New geometry"
                }
            ]
        },
        {
            id: 'ripples-grid',
            title: 'Ripples',
            description: 'Ripples with requested gradient adjustments.',
            animations: [
                { fileName: "Ripples Lines {theme}.lottie", animationType: "playOnce", feedback: "Blended inner gradient" },
                { fileName: "Ripples Filled Shapes {theme}.lottie", animationType: "playOnce", feedback: "Blended inner gradient, new geomtery" },
                { fileName: "Ripples Filled {theme}.lottie", animationType: "playOnce", feedback: "Blended inner gradient" }
            ].reverse()
        },
        {
            id: 'build-loop-variable-grid',
            title: 'Build Loop (Variable Easing)',
            description: 'Original versions with distinct easing per part.',
            animations: [
                { fileName: "Loading Build {theme} Short.lottie", animationType: "playOnce", feedback: "Variable easing" },
                { fileName: "Loading Build {theme} Medium.lottie", animationType: "playOnce", feedback: "Variable easing" },
                { fileName: "Loading Build {theme} Long.lottie", animationType: "playOnce", feedback: "Variable easing" },
                { fileName: "Build In {theme}.lottie", animationType: "playAndHold", feedback: "Fixed grey glitch" },
                { fileName: "Build Out {theme}.lottie", animationType: "playAndHold", feedback: "Variable easing" }
            ]
        }
    ];

    /**
     * Manages a single Lottie animation card.
     */
    class LottieCard {
        constructor(wrapper, animationData) {
            this.wrapper = wrapper;
            this.animationData = animationData;
            this.lottieContainer = wrapper.querySelector('.lottie-animation');

            this.lottieAnimation = null;
            this.totalFrames = 0;
            this.isHovering = false;
            this.isOutroLocked = false;
            this.isLightMode = false;

            this.boundOnEnterFrame = this.onEnterFrame.bind(this);

            this.parseAnimationProps();
            this.cacheDomElements();
            this.attachEventListeners();
            this.loadAnimationForTheme(this.isLightMode);
        }

        parseAnimationProps() {
            this.animationType = this.animationData.animationType || 'playOnce';
            this.isLooping = this.animationType === 'loop';

            if (this.isLooping && this.animationData.loopFrames) {
                this.loopStartFrame = this.animationData.loopFrames[0];
                this.loopEndFrame = this.animationData.loopFrames[1];
            } else {
                this.loopStartFrame = 0;
                this.loopEndFrame = 0;
            }
        }

        cacheDomElements() {
            this.ui = {
                frameCounter: this.wrapper.querySelector('.frame-counter'),
                playheadMarker: this.isLooping
                    ? this.wrapper.querySelector('.timeline-looping .playhead-marker')
                    : this.wrapper.querySelector('.timeline-simple .playhead-marker'),
                themeToggle: this.wrapper.querySelector('.theme-toggle'),
                progressFull: this.wrapper.querySelector('.progress-full'),
                segmentFull: this.wrapper.querySelector('.segment-full'),
                labels: {
                    intro: this.wrapper.querySelector('.label-intro'),
                    loop: this.wrapper.querySelector('.label-loop'),
                    outro: this.wrapper.querySelector('.label-outro')
                },
                segments: {
                    intro: this.wrapper.querySelector('.segment-intro'),
                    loop: this.wrapper.querySelector('.segment-loop'),
                    outro: this.wrapper.querySelector('.segment-outro')
                },
                progress: {
                    intro: this.wrapper.querySelector('.progress-intro'),
                    loop: this.wrapper.querySelector('.progress-loop'),
                    outro: this.wrapper.querySelector('.progress-outro')
                },
                frameNums: {
                    start: this.wrapper.querySelector('.frame-num-start'),
                    loopStart: this.wrapper.querySelector('.frame-num-loop-start'),
                    loopEnd: this.wrapper.querySelector('.frame-num-loop-end'),
                    end: this.wrapper.querySelector('.frame-num-end')
                },
                markers: {
                    start: this.wrapper.querySelector('.marker-start'),
                    end: this.wrapper.querySelector('.marker-end')
                }
            };
        }

        buildTimeline() {
            if (!this.lottieAnimation || this.totalFrames === 0) return;

            if (this.isLooping) {
                const { frameNums, segments, markers } = this.ui;
                if (frameNums.start) frameNums.start.textContent = 0;
                if (frameNums.loopStart) frameNums.loopStart.textContent = this.loopStartFrame;
                if (frameNums.loopEnd) frameNums.loopEnd.textContent = this.loopEndFrame;
                if (frameNums.end) frameNums.end.textContent = this.totalFrames;

                const introPercent = (this.loopStartFrame / this.totalFrames) * 100;
                const loopPercent = ((this.loopEndFrame - this.loopStartFrame) / this.totalFrames) * 100;
                const outroPercent = 100 - introPercent - loopPercent;

                if (segments.intro) segments.intro.style.width = `${introPercent}%`;
                if (segments.loop) segments.loop.style.width = `${loopPercent}%`;
                if (segments.outro) segments.outro.style.width = `${outroPercent}%`;

                if (markers.start) markers.start.style.left = `${introPercent}%`;
                if (markers.end) markers.end.style.left = `${introPercent + loopPercent}%`;

                if (frameNums.loopStart) frameNums.loopStart.style.left = `${introPercent}%`;
                if (frameNums.loopEnd) frameNums.loopEnd.style.left = `${introPercent + loopPercent}%`;
            } else {
                const { frameNums } = this.ui;
                if (frameNums.start) frameNums.start.textContent = 0;
                if (frameNums.end) frameNums.end.textContent = this.totalFrames;
            }
        }

        attachEventListeners() {
            this.lottieContainer.addEventListener('mouseenter', this.onHoverStart.bind(this));
            this.lottieContainer.addEventListener('mouseleave', this.onHoverEnd.bind(this));
            this.ui.themeToggle.addEventListener('change', this.onThemeChange.bind(this));
        }

        loadAnimationForTheme(isLight) {
            // Cleanup existing
            if (this.lottieAnimation) {
                this.lottieAnimation.destroy();
                this.lottieAnimation = null;
            }

            // DotLottie needs a fresh canvas
            this.lottieContainer.innerHTML = '';
            const canvas = document.createElement('canvas');
            this.lottieContainer.appendChild(canvas);

            // Determine theme string
            const themeName = isLight ? 'Black' : 'White';

            // Replace {theme} placeholder in the filename
            const actualFileName = this.animationData.fileName.replace('{theme}', themeName);

            // Construct full path
            const path = `Lotties/${themeName}/${actualFileName}`;

            this.lottieAnimation = new DotLottie({
                canvas: canvas,
                src: path,
                loop: false,
                autoplay: false
            });

            this.lottieAnimation.addEventListener('load', this.onDOMLoaded.bind(this));
            this.lottieAnimation.addEventListener('complete', this.onComplete.bind(this));

            this.lottieAnimation.load();
        }

        onDOMLoaded() {
            this.totalFrames = Math.floor(this.lottieAnimation.totalFrames);
            this.lottieAnimation.setFrame(0);
            this.buildTimeline();
            this.resetTimeline();
        }

        onEnterFrame() {
            if (this.totalFrames === 0) return;

            const currentFrame = Math.floor(this.lottieAnimation.currentFrame);
            this.updateTimelineUI(currentFrame, true);

            if (this.isLooping) {
                if (this.isOutroLocked) return;

                if (this.isHovering) {
                    if (currentFrame >= this.loopEndFrame) {
                        this.lottieAnimation.setFrame(this.loopStartFrame);
                        this.lottieAnimation.play();
                    }
                } else {
                    if (currentFrame >= this.loopStartFrame) {
                        this.isOutroLocked = true;
                    }
                }
            }
        }

        onComplete() {
            this.lottieAnimation.removeEventListener('frame', this.boundOnEnterFrame);

            if (this.animationType === 'playAndHold') {
                this.lottieAnimation.pause();
                this.updateTimelineUI(this.totalFrames, false);
                this.wrapper.classList.remove('playing');
            } else {
                this.isOutroLocked = false;
                this.resetTimeline();

                if (this.isHovering) {
                    this.lottieAnimation.addEventListener('frame', this.boundOnEnterFrame);
                    this.lottieAnimation.setFrame(0);
                    this.lottieAnimation.play();
                    this.updateTimelineUI(0, true);
                } else {
                    this.lottieAnimation.setFrame(0);
                    this.lottieAnimation.pause();
                    this.wrapper.classList.remove('playing');
                }
            }
        }

        onHoverStart() {
            this.isHovering = true;
            this.wrapper.classList.add('playing');

            this.lottieAnimation.addEventListener('frame', this.boundOnEnterFrame);

            const currentFrame = Math.floor(this.lottieAnimation.currentFrame);

            if (!this.lottieAnimation.isPlaying) {
                this.isOutroLocked = false;
                this.lottieAnimation.setFrame(0);
                this.lottieAnimation.play();
                this.updateTimelineUI(0, true);
            } else if (this.isLooping && this.isOutroLocked && currentFrame <= this.loopEndFrame) {
                this.isOutroLocked = false;
            } else {
                this.lottieAnimation.play();
            }
        }

        onHoverEnd() {
            this.isHovering = false;

            if (this.animationType === 'playAndHold') {
                this.isOutroLocked = false;
                this.lottieAnimation.removeEventListener('frame', this.boundOnEnterFrame);
                this.lottieAnimation.setFrame(0);
                this.lottieAnimation.pause();
                this.resetTimeline();
            } else {
                this.lottieAnimation.play();
            }

            this.wrapper.classList.remove('playing');
        }

        onThemeChange() {
            this.isLightMode = this.ui.themeToggle.checked;
            this.wrapper.classList.toggle('light-mode', this.isLightMode);

            this.wrapper.dispatchEvent(new CustomEvent('themeChange', {
                detail: { isLight: this.isLightMode },
                bubbles: true,
                composed: true
            }));

            this.loadAnimationForTheme(this.isLightMode);
        }

        resetTimeline() {
            if (this.isLooping) {
                if (this.ui.progress.intro) this.ui.progress.intro.style.width = '0%';
                if (this.ui.progress.loop) this.ui.progress.loop.style.width = '0%';
                if (this.ui.progress.outro) this.ui.progress.outro.style.width = '0%';
            } else {
                if (this.ui.progressFull) this.ui.progressFull.style.width = '0%';
            }
            this.updateTimelineUI(0, false);
        }

        updateTimelineUI(currentFrame, isPlaying) {
            if (this.ui.frameCounter) {
                this.ui.frameCounter.textContent = `Frame: ${currentFrame}`;
            }

            if (this.totalFrames === 0) return;

            const totalProgressPercent = (currentFrame / this.totalFrames) * 100;

            if (this.ui.playheadMarker) {
                this.ui.playheadMarker.style.left = `${totalProgressPercent}%`;
                this.ui.playheadMarker.style.opacity = isPlaying ? '1' : '0';
            }

            if (this.isLooping) {
                const { progress, labels, segments, frameNums } = this.ui;

                const introProgress = (currentFrame / this.loopStartFrame) * 100;
                const loopProgress = ((currentFrame - this.loopStartFrame) / (this.loopEndFrame - this.loopStartFrame)) * 100;
                const outroProgress = ((currentFrame - this.loopEndFrame) / (this.totalFrames - this.loopEndFrame)) * 100;

                if (progress.intro) progress.intro.style.width = `${Math.min(100, Math.max(0, introProgress))}%`;
                if (progress.loop) progress.loop.style.width = `${Math.min(100, Math.max(0, loopProgress))}%`;
                if (progress.outro) progress.outro.style.width = `${Math.min(100, Math.max(0, outroProgress))}%`;

                const allLabels = [labels.intro, labels.loop, labels.outro];
                const allSegments = [segments.intro, segments.loop, segments.outro];
                const allFrameNums = [frameNums.start, frameNums.loopStart, frameNums.loopEnd, frameNums.end];

                allLabels.forEach(el => el?.classList.remove('active'));
                allSegments.forEach(el => el?.classList.remove('active'));
                allFrameNums.forEach(el => el?.classList.remove('active'));

                if (!isPlaying) return;

                if (currentFrame < this.loopStartFrame) {
                    labels.intro?.classList.add('active');
                    segments.intro?.classList.add('active');
                    frameNums.start?.classList.add('active');
                } else if (currentFrame >= this.loopStartFrame && currentFrame <= this.loopEndFrame) {
                    labels.loop?.classList.add('active');
                    segments.loop?.classList.add('active');
                    frameNums.loopStart?.classList.add('active');
                    frameNums.loopEnd?.classList.add('active');
                } else {
                    labels.outro?.classList.add('active');
                    segments.outro?.classList.add('active');
                    frameNums.end?.classList.add('active');
                }

            } else {
                if (this.ui.progressFull) {
                    this.ui.progressFull.style.width = `${totalProgressPercent}%`;
                }
            }
        }
    }

    /* --- HERO SECTION LOGIC --- */
    function setupHeroSection() {
        const heroContainer = document.getElementById('hero-section');
        if (!heroContainer) return;

        // Build simple DOM structure for hero
        heroContainer.innerHTML = `
            <div class="lottie-animation"></div>
            <div class="hero-controls">
                <div class="toggle-container">
                    <span class="toggle-label">Light</span>
                    <label class="switch">
                        <input type="checkbox" class="theme-toggle">
                        <span class="slider round"></span>
                    </label>
                    <span class="toggle-label">Dark</span>
                </div>
            </div>
        `;

        const lottieContainer = heroContainer.querySelector('.lottie-animation');
        const themeToggle = heroContainer.querySelector('.theme-toggle');
        let lottieAnimation = null;
        let isLightMode = false;

        function loadHeroAnimation(isLight) {
            if (lottieAnimation) {
                lottieAnimation.destroy();
                lottieAnimation = null;
            }

            lottieContainer.innerHTML = '';
            const canvas = document.createElement('canvas');
            lottieContainer.appendChild(canvas);

            // Same theme mapping as LottieCard
            const themeName = isLight ? 'Black' : 'White';
            const actualFileName = HERO_CONFIG.fileName.replace('{theme}', themeName);
            const path = `Lotties/${themeName}/${actualFileName}`;

            lottieAnimation = new DotLottie({
                canvas: canvas,
                src: path,
                loop: HERO_CONFIG.loop,
                autoplay: HERO_CONFIG.autoplay,
                backgroundColor: '#000000' // Enforce canvas bg black
            });

            lottieAnimation.load();
        }

        themeToggle.addEventListener('change', (e) => {
            isLightMode = e.target.checked;
            loadHeroAnimation(isLightMode);
        });

        // Initial Load
        loadHeroAnimation(isLightMode);
    }

    function setupAnimationGrids() {
        const mainContainer = document.getElementById('animation-sections-container');
        const cardTemplate = document.getElementById('lottie-card-template');

        if (!mainContainer || !cardTemplate) return;

        ANIMATION_SECTIONS.forEach(section => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'section-container';

            const titleEl = document.createElement('h3');
            titleEl.textContent = section.title;
            sectionEl.appendChild(titleEl);

            const descriptionEl = document.createElement('p');
            descriptionEl.className = 'section-description';
            descriptionEl.textContent = section.description;
            sectionEl.appendChild(descriptionEl);

            const gridEl = document.createElement('div');
            gridEl.id = section.id;
            gridEl.className = 'animation-grid';
            sectionEl.appendChild(gridEl);

            mainContainer.appendChild(sectionEl);

            populateGrid(gridEl, descriptionEl, cardTemplate, section.animations);
        });
    }

    function populateGrid(gridContainer, descriptionEl, cardTemplate, animations) {
        animations.forEach((animationData, index) => {
            const cardFragment = cardTemplate.content.cloneNode(true);
            const wrapper = cardFragment.querySelector('.animation-wrapper');
            if (!wrapper) return;

            const lottieContainer = wrapper.querySelector('.lottie-animation');
            const lottieContainerId = `lottie-${animationData.fileName.replace(/[^a-zA-Z0-9]/g, '-')}-${index}`;
            lottieContainer.id = lottieContainerId;

            const titleEl = wrapper.querySelector('.lottie-title');
            // Remove the placeholder and the extension for the title display
            const title = (animationData.displayName || animationData.fileName)
                .replace('.lottie', '')
                .replace('{theme}', '')
                .trim();

            titleEl.textContent = title;

            if (animationData.feedback) {
                const feedbackEl = document.createElement('div');
                feedbackEl.className = 'feedback-note';
                feedbackEl.textContent = animationData.feedback;
                titleEl.after(feedbackEl);
            }

            const timelineType = animationData.animationType === 'loop' ? 'loop' : 'simple';
            wrapper.dataset.timelineType = timelineType;

            wrapper.addEventListener('themeChange', (e) => {
                descriptionEl.classList.toggle('light-mode', e.detail.isLight);
            });

            gridContainer.appendChild(cardFragment);
            new LottieCard(wrapper, animationData);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupHeroSection();
        setupAnimationGrids();
    });

})();