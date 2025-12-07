/**
 * @file Main application logic for Hexagon Animations & Loaders.
 * Supports: 
 * 1. Continuous (Always playing loop)
 * 2. Loop (Interactive: Hover to loop specific frames)
 * 3. Freeze (Interactive: Hover to play to freeze point, finish on exit)
 * 4. PlayOnce (Interactive: Hover to play full)
 */

(function () {
    'use strict';

    const ANIMATION_SECTIONS = [
        {
            id: 'hexagon-grid',
            title: 'Hexagon Animations',
            description: 'Hover to preview. "Freeze" animations pause at specific frame. "Loop" animations cycle specific segments.',
            animations: [
                { fileName: "From Center Purple Shapes Explosion Freeze-29.json" },
                { fileName: "From Center Purple Shapes Suck In Loop-25-62.json" },
                { fileName: "From Center Simple Freeze-25 .json" },
                { fileName: "From Outward Shapes Suck In Loop-20-57 .json" },
                { fileName: "From Outward Simple Freeze-20 .json" }
            ]
        },
        {
            id: 'loaders-grid',
            title: 'Loaders',
            description: 'Continuous looping animations (Always active).',
            animations: [
                { fileName: "Inward Loader .json", animationType: "continuous" },
                { fileName: "Outward Loader .json", animationType: "continuous" },
                { fileName: "Outward Loader Shapes Explosion .json", animationType: "continuous" }
            ]
        }
    ];

    class LottieCard {
        constructor(wrapper, animationData) {
            this.wrapper = wrapper;
            this.animationData = animationData;
            this.lottieContainer = wrapper.querySelector('.lottie-animation');

            this.lottieAnimation = null;
            this.totalFrames = 0;
            this.isHovering = false;
            
            // Specific flags for logic
            this.isFrozen = false; 
            this.isOutroLocked = false;

            this.boundOnEnterFrame = this.onEnterFrame.bind(this);

            this.parseAnimationProps();
            this.cacheDomElements();
            this.attachEventListeners();
            this.loadAnimation();
        }

        parseAnimationProps() {
            // 1. Check for explicit overrides first (like "continuous")
            if (this.animationData.animationType) {
                this.animationType = this.animationData.animationType;
            } else {
                // 2. Detect Type and Frames based on Filename string analysis
                const name = this.animationData.fileName;

                if (name.toLowerCase().includes('loop')) {
                    this.animationType = 'loop';
                    // Extract numbers like "25-62"
                    const match = name.match(/Loop-(\d+)-(\d+)/i);
                    if (match) {
                        this.loopStartFrame = parseInt(match[1], 10);
                        this.loopEndFrame = parseInt(match[2], 10);
                    } else {
                        this.loopStartFrame = 0;
                        this.loopEndFrame = 0;
                    }
                } else if (name.toLowerCase().includes('freeze')) {
                    this.animationType = 'freeze';
                    // Extract number like "Freeze-29"
                    const match = name.match(/Freeze-(\d+)/i);
                    this.freezeFrame = match ? parseInt(match[1], 10) : 0;
                } else {
                    this.animationType = 'playOnce';
                }
            }
        }

        cacheDomElements() {
            this.ui = {
                frameCounter: this.wrapper.querySelector('.frame-counter'),
                // For continuous/simple/freeze, we use the simple marker
                playheadMarker: this.wrapper.querySelector('.timeline-simple .playhead-marker'), 
                progressFull: this.wrapper.querySelector('.progress-full'),
                
                // Loop specific UI
                loopMarker: this.wrapper.querySelector('.timeline-looping .playhead-marker'),
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

            if (this.animationType === 'loop') {
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
                // For Continuous, Freeze, and PlayOnce
                const { frameNums } = this.ui;
                if (frameNums.start) frameNums.start.textContent = 0;
                if (frameNums.end) frameNums.end.textContent = this.totalFrames;
            }
        }

        attachEventListeners() {
            // Only attach hover listeners if NOT continuous
            if (this.animationType !== 'continuous') {
                this.lottieContainer.addEventListener('mouseenter', this.onHoverStart.bind(this));
                this.lottieContainer.addEventListener('mouseleave', this.onHoverEnd.bind(this));
            }
        }

        loadAnimation() {
            const path = `Lotties/${this.animationData.fileName}`;
            
            // Continuous types loop and autoplay. Others do not.
            const isContinuous = (this.animationType === 'continuous');

            this.lottieAnimation = lottie.loadAnimation({
                container: this.lottieContainer,
                renderer: 'svg',
                loop: isContinuous,
                autoplay: isContinuous,
                path: path
            });

            this.lottieAnimation.addEventListener('DOMLoaded', this.onDOMLoaded.bind(this));
            
            // Only listen for 'complete' if we expect it to end (not continuous)
            if (!isContinuous) {
                this.lottieAnimation.addEventListener('complete', this.onComplete.bind(this));
            }
        }

        onDOMLoaded() {
            this.totalFrames = Math.floor(this.lottieAnimation.totalFrames);
            
            if (this.animationType !== 'continuous') {
                this.lottieAnimation.goToAndStop(0, true);
            } else {
                // For continuous, we need to hook up the timeline updater immediately
                this.lottieAnimation.addEventListener('enterFrame', this.boundOnEnterFrame);
                this.wrapper.classList.add('playing'); // Make it look active
            }

            this.buildTimeline();
            if (this.animationType !== 'continuous') {
                this.resetTimeline();
            }
        }

        onEnterFrame() {
            if (this.totalFrames === 0) return;

            const currentFrame = Math.floor(this.lottieAnimation.currentFrame);
            this.updateTimelineUI(currentFrame, true);

            // If continuous, we just update UI and exit. No logic needed.
            if (this.animationType === 'continuous') return;

            // --- LOGIC FOR LOOPS ---
            if (this.animationType === 'loop') {
                if (this.isOutroLocked) return;

                if (this.isHovering) {
                    if (currentFrame >= this.loopEndFrame) {
                        this.lottieAnimation.goToAndPlay(this.loopStartFrame, true);
                    }
                } else {
                    if (currentFrame >= this.loopStartFrame) {
                        this.isOutroLocked = true;
                    }
                }
            } 
            
            // --- LOGIC FOR FREEZE ---
            else if (this.animationType === 'freeze') {
                if (this.isHovering && !this.isFrozen) {
                    if (currentFrame >= this.freezeFrame) {
                        this.lottieAnimation.pause();
                        this.isFrozen = true;
                        this.wrapper.classList.add('frozen-state');
                    }
                }
            }
        }

        onComplete() {
            if (this.animationType === 'continuous') return;

            this.lottieAnimation.removeEventListener('enterFrame', this.boundOnEnterFrame);
            this.isOutroLocked = false;
            this.isFrozen = false;
            this.wrapper.classList.remove('frozen-state');

            this.resetTimeline();

            if (this.isHovering) {
                this.lottieAnimation.addEventListener('enterFrame', this.boundOnEnterFrame);
                this.lottieAnimation.goToAndPlay(0, true);
                this.updateTimelineUI(0, true);
            } else {
                this.lottieAnimation.goToAndStop(0, true);
                this.wrapper.classList.remove('playing');
            }
        }

        onHoverStart() {
            if (this.animationType === 'continuous') return;

            this.isHovering = true;
            this.wrapper.classList.add('playing');
            
            this.lottieAnimation.addEventListener('enterFrame', this.boundOnEnterFrame);

            const currentFrame = Math.floor(this.lottieAnimation.currentFrame);

            if (this.lottieAnimation.isPaused) {
                if (this.animationType === 'freeze' && this.isFrozen) {
                    // Do nothing, stay frozen until mouse leave
                } else {
                    this.isOutroLocked = false;
                    this.lottieAnimation.goToAndPlay(0, true);
                    this.updateTimelineUI(0, true);
                }
            } else if (this.animationType === 'loop' && this.isOutroLocked && currentFrame <= this.loopEndFrame) {
                this.isOutroLocked = false;
            }

            this.lottieAnimation.play();
        }

        onHoverEnd() {
            if (this.animationType === 'continuous') return;

            this.isHovering = false;

            if (this.animationType === 'freeze') {
                if (this.isFrozen) {
                    this.isFrozen = false;
                    this.wrapper.classList.remove('frozen-state');
                    this.lottieAnimation.play();
                }
            }
            else if (this.animationType !== 'loop') {
                this.lottieAnimation.play();
            }
            
            this.wrapper.classList.remove('playing');
        }

        resetTimeline() {
            if (this.animationType === 'loop') {
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

            // Select correct marker based on type
            const marker = this.animationType === 'loop' ? this.ui.loopMarker : this.ui.playheadMarker;

            if (marker) {
                marker.style.left = `${totalProgressPercent}%`;
                marker.style.opacity = isPlaying ? '1' : '0';
            }

            if (this.animationType === 'loop') {
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
                // For Continuous, Freeze, PlayOnce
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
            const lottieContainerId = `lottie-${index}`;
            lottieContainer.id = lottieContainerId;

            const titleEl = wrapper.querySelector('.lottie-title');
            let title = animationData.fileName.replace('.json', '').replace(/\s\.json/, '').trim();
            titleEl.textContent = title;
            
            // Determine timeline type for CSS display
            let timelineType = 'simple';
            if (animationData.fileName.toLowerCase().includes('loop')) timelineType = 'loop';
            
            // Explicit continuous override uses simple timeline
            if (animationData.animationType === 'continuous') timelineType = 'simple';
            
            wrapper.dataset.timelineType = timelineType;

            gridContainer.appendChild(cardFragment);
            new LottieCard(wrapper, animationData);
        });
    }

    document.addEventListener('DOMContentLoaded', setupAnimationGrids);

})();