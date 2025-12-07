/**
 * @file Main application logic for the Lottie animation grid.
 * This file sets up the animation sections and initializes a LottieCard
 * controller for each animation.
 */

(function () {
    'use strict';

    /**
     * Configuration object for all animation sections and files.
     *
     * This is the **main configuration** for the page. To add or change
     * animations, you only need to edit this object.
     *
     * Each animation object has the following properties:
     *
     * @param {string} fileName - The exact .json file name in the Lotties folder.
     * @param {string} [displayName] - (Optional) A friendly name for the UI.
     * @param {string} animationType - Defines the playback behavior.
     * - "playOnce": Plays once on hover, resets on hover out.
     * - "playAndHold": Plays once on hover, holds the last frame. Resets on hover out.
     * - "loop": Has an intro, loop, and outro. Requires 'loopFrames'.
     * @param {number[]} [loopFrames] - (Required for "loop" type)
     * An array [startFrame, endFrame] defining the loop segment.
     */
    const ANIMATION_SECTIONS = [
        {
            id: 'idle-grid',
            title: 'Idle',
            description: 'While in this preview it loops instantly, ideally in the website it only plays once every few seconds.',
            animations: [
                { fileName: "idle.json", animationType: "playOnce" }
            ]
        },
        {
            id: 'shapes-grid',
            title: 'Shapes',
            description: "Notice the loop functionality: The animation starts on hover and repeats the 'loop' section. When hover ends, it plays the 'outro' to finish. If you hover off and back on, it intelligently handles the transition.",
            animations: [
                { fileName: "Loop-24-71 Shapes Suck In.json", displayName: "Shapes Suck In", animationType: "loop", loopFrames: [24, 71] },
                { fileName: "Loop-10-57 Loading - Dots.json", displayName: "Loading - Dots", animationType: "loop", loopFrames: [10, 57] },
                { fileName: "Shapes Explosion.json", animationType: "playOnce" }
            ]
        },
        {
            id: 'ripples-grid',
            title: 'Ripples',
            description: 'A set of ripple animations.',
            animations: [
                { fileName: "Ripples Lines.json", animationType: "playOnce" },
                { fileName: "Ripples Filled Shapes.json", animationType: "playOnce" },
                { fileName: "Ripples Filled.json", animationType: "playOnce" }
            ].reverse()
        },
        {
            id: 'build-loop-grid',
            title: 'Build Loop',
            description: 'Continuous loop animations (playOnce is used here for hover-based looping).',
            animations: [
                { fileName: "Loading - Build LOOP Fast.json", animationType: "playOnce" },
                { fileName: "Loading - Build LOOP Medium.json", animationType: "playOnce" },
                { fileName: "Loading - Build LOOP Slow.json", animationType: "playOnce" }
            ]
        },
        {
            id: 'build-grid',
            title: 'Build In/Out',
            description: "These animations play once and hold their final frame. Hover off to reset.",
            animations: [
                { fileName: "Build In.json", animationType: "playAndHold" },
                { fileName: "Build Out.json", animationType: "playAndHold" }
            ]
        }
    ];

    /**
     * Manages a single Lottie animation card, including its state,
     * timeline, and interactions.
     */
    class LottieCard {
        /**
         * @param {HTMLElement} wrapper - The card's main wrapper element (from the template).
         * @param {object} animationData - The configuration object for this animation.
         */
        constructor(wrapper, animationData) {
            this.wrapper = wrapper;
            this.animationData = animationData;
            this.lottieContainer = wrapper.querySelector('.lottie-animation');

            // State
            this.lottieAnimation = null;
            this.totalFrames = 0;
            this.isHovering = false;
            this.isOutroLocked = false; // True if un-hovered and playing outro
            this.isLightMode = false;

            // Animation properties (now read directly from config)
            this.parseAnimationProps();

            // Cache all DOM elements for performance
            this.cacheDomElements();

            // Attach event listeners
            this.attachEventListeners();

            // Load initial animation
            this.loadAnimationForTheme(this.isLightMode);
        }

        /**
         * Sets animation properties based on the declarative config.
         * This replaces the old "parse filename" logic.
         */
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

        /**
         * Finds and stores references to all UI elements within the card.
         * (No changes from original)
         */
        cacheDomElements() {
            this.ui = {
                frameCounter: this.wrapper.querySelector('.frame-counter'),
                playheadMarker: this.isLooping
                ? this.wrapper.querySelector('.timeline-looping .playhead-marker')
                : this.wrapper.querySelector('.timeline-simple .playhead-marker'),                
                themeToggle: this.wrapper.querySelector('.theme-toggle'),
                // Simple (non-loop) timeline
                progressFull: this.wrapper.querySelector('.progress-full'),
                segmentFull: this.wrapper.querySelector('.segment-full'),
                // Segmented (loop) timeline
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

        /**
         * Sets up the initial state of the timeline (widths, frame numbers).
         */
        buildTimeline() {
            if (!this.lottieAnimation || this.totalFrames === 0) {
                return;
            }

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
                // Simple timeline setup
                const { frameNums } = this.ui;
                if (frameNums.start) frameNums.start.textContent = 0;
                if (frameNums.end) frameNums.end.textContent = this.totalFrames;
            }
        }

        /**
         * Attaches all necessary event listeners for interaction.
         * (No changes from original)
         */
        attachEventListeners() {
            this.lottieContainer.addEventListener('mouseenter', this.onHoverStart.bind(this));
            this.lottieContainer.addEventListener('mouseleave', this.onHoverEnd.bind(this));
            this.ui.themeToggle.addEventListener('change', this.onThemeChange.bind(this));
        }

        /**
         * Loads or re-loads the Lottie animation based on the theme.
         * (No changes from original)
         */
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

        // --- Event Handlers (All logic preserved) ---

        onDOMLoaded() {
            this.totalFrames = Math.floor(this.lottieAnimation.totalFrames);
            this.lottieAnimation.goToAndStop(0, true);
            this.buildTimeline(); // Now we can build the timeline
            this.resetTimeline();
        }

        onEnterFrame() {
            if (this.totalFrames === 0) return;

            const currentFrame = Math.floor(this.lottieAnimation.currentFrame);
            this.updateTimelineUI(currentFrame, true);

            if (this.isLooping) {
                // If locked in outro, do nothing
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
            this.lottieAnimation.removeEventListener('enterFrame', this.onEnterFrame.bind(this));

            if (this.animationType === 'playAndHold') {
                // Freeze on the last frame
                this.lottieAnimation.pause();
                this.updateTimelineUI(this.totalFrames, false);
                this.wrapper.classList.remove('playing');
            } else {
                // Standard reset
                this.isOutroLocked = false;
                this.resetTimeline();

                if (this.isHovering) {
                    // If still hovering, play again from the start
                    this.lottieAnimation.addEventListener('enterFrame', this.onEnterFrame.bind(this));
                    this.lottieAnimation.goToAndPlay(0, true);
                    this.updateTimelineUI(0, true);
                } else {
                    // If not hovering, stop at frame 0
                    this.lottieAnimation.goToAndStop(0, true);
                    this.wrapper.classList.remove('playing');
                }
            }
        }

        onHoverStart() {
            this.isHovering = true;
            this.wrapper.classList.add('playing');
            this.lottieAnimation.addEventListener('enterFrame', this.onEnterFrame.bind(this));

            const currentFrame = Math.floor(this.lottieAnimation.currentFrame);

            if (this.lottieAnimation.isPaused) {
                // If paused (e.g., at end or start), play from beginning
                this.isOutroLocked = false;
                this.lottieAnimation.goToAndPlay(0, true);
                this.updateTimelineUI(0, true);
            } else if (this.isLooping && this.isOutroLocked && currentFrame <= this.loopEndFrame) {
                // If re-hovered during outro (but before loop end), unlock and continue
                this.isOutroLocked = false;
            }

            this.lottieAnimation.play();
        }

        onHoverEnd() {
            this.isHovering = false;

            if (this.animationType === 'playAndHold') {
                // Reset playAndHold animations immediately on unhover
                this.isOutroLocked = false;
                this.lottieAnimation.removeEventListener('enterFrame', this.onEnterFrame.bind(this));
                this.lottieAnimation.goToAndStop(0, true);
                this.resetTimeline();
            } else {
                // For other types, just ensure it's playing so it can enter outro/complete
                this.lottieAnimation.play();
            }
            
            this.wrapper.classList.remove('playing');
        }

        onThemeChange() {
            this.isLightMode = this.ui.themeToggle.checked;
            this.wrapper.classList.toggle('light-mode', this.isLightMode);

            // Dispatch event to update section description
            this.wrapper.dispatchEvent(new CustomEvent('themeChange', {
                detail: { isLight: this.isLightMode },
                bubbles: true,
                composed: true
            }));

            // Reload the animation for the new theme
            this.loadAnimationForTheme(this.isLightMode);
        }

        // --- UI Update Methods (All logic preserved) ---

        resetTimeline() {
            if (this.isLooping) {
                if (this.ui.progress.intro) this.ui.progress.intro.style.width = '0%';
                if (this.ui.progress.loop) this.ui.progress.loop.style.width = '0%';
                if (this.ui.progress.outro) this.ui.progress.outro.style.width = '0%';
            } else {
                if (this.ui.progressFull) this.ui.progressFull.style.width = '0%';
            }
            this.updateTimelineUI(0, false); // Set labels to inactive
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

            // Update progress bars
            if (this.isLooping) {
                const { progress, labels, segments, frameNums } = this.ui;

                const introProgress = (currentFrame / this.loopStartFrame) * 100;
                const loopProgress = ((currentFrame - this.loopStartFrame) / (this.loopEndFrame - this.loopStartFrame)) * 100;
                const outroProgress = ((currentFrame - this.loopEndFrame) / (this.totalFrames - this.loopEndFrame)) * 100;

                if (progress.intro) progress.intro.style.width = `${Math.min(100, Math.max(0, introProgress))}%`;
                if (progress.loop) progress.loop.style.width = `${Math.min(100, Math.max(0, loopProgress))}%`;
                if (progress.outro) progress.outro.style.width = `${Math.min(100, Math.max(0, outroProgress))}%`;

                // Update active labels and segments
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
                // Simple progress bar
                if (this.ui.progressFull) {
                    this.ui.progressFull.style.width = `${totalProgressPercent}%`;
                }
            }
        }
    }

    /**
     * Creates all section containers and populates them with animation grids.
     */
    function setupAnimationGrids() {
        const mainContainer = document.getElementById('animation-sections-container');
        const cardTemplate = document.getElementById('lottie-card-template');

        if (!mainContainer || !cardTemplate) {
            console.error('Missing main container or card template. Aborting.');
            return;
        }

        ANIMATION_SECTIONS.forEach(section => {
            // 1. Create Section Container
            const sectionEl = document.createElement('div');
            sectionEl.className = 'section-container';

            // 2. Create Title
            const titleEl = document.createElement('h3');
            titleEl.textContent = section.title;
            sectionEl.appendChild(titleEl);

            // 3. Create Description
            const descriptionEl = document.createElement('p');
            descriptionEl.className = 'section-description';
            descriptionEl.textContent = section.description;
            sectionEl.appendChild(descriptionEl);

            // 4. Create Grid Container
            const gridEl = document.createElement('div');
            gridEl.id = section.id;
            gridEl.className = 'animation-grid';
            sectionEl.appendChild(gridEl);

            // 5. Add section to the page
            mainContainer.appendChild(sectionEl);

            // 6. Populate the grid
            populateGrid(gridEl, descriptionEl, cardTemplate, section.animations);
        });
    }

    /**
     * Populates a grid container with animation cards from the template.
     * This function replaces the old `createCardHTML`.
     *
     * @param {HTMLElement} gridContainer - The grid element to fill.
     * @param {HTMLElement} descriptionEl - The description element for this section.
     * @param {HTMLTemplateElement} cardTemplate - The template element to clone.
     * @param {Array<object>} animations - An array of animationData objects.
     */
    function populateGrid(gridContainer, descriptionEl, cardTemplate, animations) {
        animations.forEach((animationData, index) => {
            // 1. Clone the template
            const cardFragment = cardTemplate.content.cloneNode(true);
            
            // 2. Get the wrapper element from the fragment
            const wrapper = cardFragment.querySelector('.animation-wrapper');
            if (!wrapper) return;

            // 3. Configure the card from the data
            const lottieContainer = wrapper.querySelector('.lottie-animation');
            const lottieContainerId = `lottie-${animationData.fileName.replace(/[^a-zA-Z0-9]/g, '-')}-${index}`;
            lottieContainer.id = lottieContainerId;

            const title = (animationData.displayName || animationData.fileName).replace('.json', '');
            wrapper.querySelector('.lottie-title').textContent = title;
            
            // 4. Set the timeline type
            // This will trigger the CSS to show the correct timeline
            const timelineType = animationData.animationType === 'loop' ? 'loop' : 'simple';
            wrapper.dataset.timelineType = timelineType;

            // 5. Add listener to update section description theme
            wrapper.addEventListener('themeChange', (e) => {
                descriptionEl.classList.toggle('light-mode', e.detail.isLight);
            });
            
            // 6. Append the new card to the grid
            gridContainer.appendChild(cardFragment);

            // 7. Initialize the LottieCard controller on the new wrapper
            new LottieCard(wrapper, animationData);
        });
    }

    // --- App Initialization ---
    document.addEventListener('DOMContentLoaded', setupAnimationGrids);

})();