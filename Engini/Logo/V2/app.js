/**
 * @file Main application logic for the Lottie animation grid.
 * Fixed: Event listener binding issue that caused broken loops and memory leaks.
 */

(function () {
    'use strict';

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
                    fileName: "Idle.json", 
                    animationType: "playOnce" 
                },
                { 
                    fileName: "Idle Purplish.json", 
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
                    fileName: "Loop-24-71 Shapes Suck In.json", 
                    displayName: "Shapes Suck In", 
                    animationType: "loop", 
                    loopFrames: [24, 71],
                    feedback: "New geometry"

                },
                { 
                    fileName: "Loop-10-57 Loading - Dots.json", 
                    displayName: "Loading - Dots", 
                    animationType: "loop", 
                    loopFrames: [10, 57],
                    feedback: "New geometry & black color"
                },
                { 
                    fileName: "Shapes Explosion.json", 
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
                { fileName: "Ripples Lines.json", animationType: "playOnce", feedback: "Blended inner gradient" },
                { fileName: "Ripples Filled Shapes.json", animationType: "playOnce", feedback: "Blended inner gradient, new geomtery" },
                { fileName: "Ripples Filled.json", animationType: "playOnce", feedback: "Blended inner gradient" }
            ].reverse()
        },
        {
            id: 'build-loop-smooth-grid',
            title: 'Build Loop (Smooth)',
            description: 'New versions with a unified easing curve for a smoother flow.',
            animations: [
                { fileName: "Loading - Build Loop Fast Smooth.json", animationType: "playOnce", feedback: "Unified easing" },
                { fileName: "Loading - Build Loop Medium Smooth.json", animationType: "playOnce", feedback: "Unified easing" },
                { fileName: "Loading - Build Loop Slow Smooth.json", animationType: "playOnce", feedback: "Unified easing" },
                { fileName: "Build In Smooth.json", animationType: "playAndHold", feedback: "Unified easing" },
                { fileName: "Build Out Smooth.json", animationType: "playAndHold", feedback: "Unified easing" }
            ]
        },
        {
            id: 'build-loop-variable-grid',
            title: 'Build Loop (Variable Easing)',
            description: 'Original versions with distinct easing per part.',
            animations: [
                { fileName: "Loading - Build LOOP Fast.json", animationType: "playOnce", feedback: "Variable easing" },
                { fileName: "Loading - Build LOOP Medium.json", animationType: "playOnce", feedback: "Variable easing" },
                { fileName: "Loading - Build LOOP Slow.json", animationType: "playOnce", feedback: "Variable easing" },
                { fileName: "Build In.json", animationType: "playAndHold", feedback: "Fixed grey glitch" },
                { fileName: "Build Out.json", animationType: "playAndHold", feedback: "Variable easing" }
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

            // Fix: Bind the enterFrame event handler ONCE here.
            // This ensures add/removeEventListener uses the exact same function reference.
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
            if (this.lottieAnimation) {
                this.lottieAnimation.destroy();
            }

            const themeFolder = isLight ? 'Black' : 'White';
            const path = `Lotties/${themeFolder}/${this.animationData.fileName}`;

            this.lottieAnimation = lottie.loadAnimation({
                container: this.lottieContainer,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                path: path
            });

            this.lottieAnimation.addEventListener('DOMLoaded', this.onDOMLoaded.bind(this));
            this.lottieAnimation.addEventListener('complete', this.onComplete.bind(this));
        }

        onDOMLoaded() {
            this.totalFrames = Math.floor(this.lottieAnimation.totalFrames);
            this.lottieAnimation.goToAndStop(0, true);
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
                    // If hovering and past loop end, jump back to loop start
                    if (currentFrame >= this.loopEndFrame) {
                        this.lottieAnimation.goToAndPlay(this.loopStartFrame, true);
                    }
                } else {
                    // If not hovering and past loop start, lock into outro
                    if (currentFrame >= this.loopStartFrame) {
                        this.isOutroLocked = true;
                    }
                }
            }
        }

        onComplete() {
            // FIX: removeEventListener using the bound reference
            this.lottieAnimation.removeEventListener('enterFrame', this.boundOnEnterFrame);

            if (this.animationType === 'playAndHold') {
                this.lottieAnimation.pause();
                this.updateTimelineUI(this.totalFrames, false);
                this.wrapper.classList.remove('playing');
            } else {
                this.isOutroLocked = false;
                this.resetTimeline();

                if (this.isHovering) {
                    // FIX: addEventListener using the bound reference
                    this.lottieAnimation.addEventListener('enterFrame', this.boundOnEnterFrame);
                    this.lottieAnimation.goToAndPlay(0, true);
                    this.updateTimelineUI(0, true);
                } else {
                    this.lottieAnimation.goToAndStop(0, true);
                    this.wrapper.classList.remove('playing');
                }
            }
        }

        onHoverStart() {
            this.isHovering = true;
            this.wrapper.classList.add('playing');
            
            // FIX: addEventListener using the bound reference
            // (Standard JS addEventListener prevents duplicates automatically if ref is same)
            this.lottieAnimation.addEventListener('enterFrame', this.boundOnEnterFrame);

            const currentFrame = Math.floor(this.lottieAnimation.currentFrame);

            if (this.lottieAnimation.isPaused) {
                this.isOutroLocked = false;
                this.lottieAnimation.goToAndPlay(0, true);
                this.updateTimelineUI(0, true);
            } else if (this.isLooping && this.isOutroLocked && currentFrame <= this.loopEndFrame) {
                this.isOutroLocked = false;
            }

            this.lottieAnimation.play();
        }

        onHoverEnd() {
            this.isHovering = false;

            if (this.animationType === 'playAndHold') {
                this.isOutroLocked = false;
                // FIX: removeEventListener using the bound reference
                this.lottieAnimation.removeEventListener('enterFrame', this.boundOnEnterFrame);
                this.lottieAnimation.goToAndStop(0, true);
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
            const title = (animationData.displayName || animationData.fileName).replace('.json', '');
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

    document.addEventListener('DOMContentLoaded', setupAnimationGrids);

})();
