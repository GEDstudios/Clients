/**
 * @file Trinity Project Lottie Grid (DotLottie Refactor)
 */
import { DotLottie } from 'https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web/+esm';

(function () {
    'use strict';

    const ANIMATION_SECTIONS = [
        {
            id: 'logotype-section',
            title: 'Logotype',
            description: '',
            animations: [
                { 
                    fileName: "Logotype Intro.lottie", 
                    animationType: "playAndHold", 
                    feedback: "Freezes on end"
                },
                { 
                    fileName: "Logotype Idle.lottie", 
                    animationType: "loop",
                    feedback: "Continuous idle loop"
                }
            ]
        },
        {
            id: 'symbol-section',
            title: 'Symbol',
            description: '',
            animations: [
                { 
                    fileName: "Symbol Idle.lottie", 
                    animationType: "loop", 
                    feedback: "Floating/Idle state"
                },
                { 
                    fileName: "Symbol In-Out Long.lottie", 
                    displayName: "Symbol In-Out (Long)", 
                    animationType: "loop", 
                    feedback: "Long duration hold"
                },
                { 
                    fileName: "Symbol In-Out Short.lottie", 
                    displayName: "Symbol In-Out (Short)", 
                    animationType: "loop", 
                    feedback: "Quick interaction"
                }
            ]
        },
        {
            id: 'slides-section',
            title: 'Slides',
            description: '',
            animations: [
                { 
                    fileName: "Slide_Gradients.lottie",
                    folder: "Unique",
                    feedback: "Continuous Loop"
                },
                { 
                    fileName: "Slide_Squares.lottie",
                    folder: "Unique",
                    feedback: "Continuous Loop"
                },
                { 
                    fileName: "Slide_Stroke.lottie",
                    folder: "Unique",
                    feedback: "Continuous Loop"
                },
                {/*
                    fileName: "TextCode.lottie",
                    folder: "Unique",
                    feedback: "Continuous Loop",
                    bgColor: "#EFEAFE",
                    isWide: true */
                }
            ]
        }
    ];

    class LottieCard {
        constructor(wrapper, animationData) {
            this.wrapper = wrapper;
            this.animationData = animationData;
            this.containerDiv = wrapper.querySelector('.lottie-animation');
            
            this.canvas = document.createElement('canvas');
            this.containerDiv.appendChild(this.canvas);

            this.dotLottie = null;
            this.totalFrames = 0;
            this.isHovering = false;
            this.isLightMode = false;
            
            this.isLogotypeIntro = this.animationData.fileName.includes("Logotype Intro");
            this.isUnique = this.animationData.folder === 'Unique';

            this.boundOnFrame = this.onFrame.bind(this);
            this.boundOnLoad = this.onLoad.bind(this);
            this.boundOnComplete = this.onComplete.bind(this);

            this.cacheDomElements();
            this.initLayout();
            this.attachEventListeners();
            this.loadAnimationForTheme(this.isLightMode);
        }

        cacheDomElements() {
            this.ui = {
                frameCounter: this.wrapper.querySelector('.frame-counter'),
                playheadMarker: this.wrapper.querySelector('.playhead-marker'),                
                themeToggle: this.wrapper.querySelector('.theme-toggle'),
                toggleContainer: this.wrapper.querySelector('.toggle-container'),
                progressFull: this.wrapper.querySelector('.timeline-progress-fill'),
                canvasContainer: this.wrapper.querySelector('.canvas-container'),
                frameNums: {
                    start: this.wrapper.querySelector('.frame-num-start'),
                    end: this.wrapper.querySelector('.frame-num-end')
                }
            };
        }

        initLayout() {
            if (this.isUnique) {
                this.wrapper.classList.add('is-unique');
                
                if (this.ui.toggleContainer) {
                    this.ui.toggleContainer.style.display = 'none';
                }

                if (this.animationData.bgColor && this.ui.canvasContainer) {
                    this.ui.canvasContainer.style.background = this.animationData.bgColor;
                    this.ui.canvasContainer.style.backgroundImage = 'none';
                }
            }
        }

        attachEventListeners() {
            this.containerDiv.addEventListener('mouseenter', this.onHoverStart.bind(this));
            this.containerDiv.addEventListener('mouseleave', this.onHoverEnd.bind(this));
            
            if (!this.isUnique && this.ui.themeToggle) {
                this.ui.themeToggle.addEventListener('change', this.onThemeChange.bind(this));
            }
        }

        loadAnimationForTheme(isLight) {
            let path;

            if (this.isUnique) {
                path = `Lotties/Unique/${this.animationData.fileName}`;
            } else {
                const themeFolder = isLight ? 'White' : 'Black';
                path = `Lotties/${themeFolder}/${this.animationData.fileName}`;
            }

            const shouldLoop = !this.isLogotypeIntro;
            const shouldAutoplay = !this.isLogotypeIntro;

            if (!this.dotLottie) {
                this.dotLottie = new DotLottie({
                    canvas: this.canvas,
                    src: path,
                    loop: shouldLoop,
                    autoplay: shouldAutoplay,
                });
                
                this.dotLottie.addEventListener('load', this.boundOnLoad);
                this.dotLottie.addEventListener('frame', this.boundOnFrame);
                this.dotLottie.addEventListener('complete', this.boundOnComplete);
            } else {
                this.dotLottie.load({ 
                    src: path,
                    loop: shouldLoop,
                    autoplay: shouldAutoplay
                });
            }
        }

        onLoad() {
            setTimeout(() => {
                this.totalFrames = Math.floor(this.dotLottie.totalFrames);
                if (this.ui.frameNums.end) this.ui.frameNums.end.textContent = this.totalFrames;
                
                if (this.isLogotypeIntro) {
                    this.dotLottie.setFrame(0);
                    this.updateTimelineUI(0, false);
                }
            }, 50);
        }

        onFrame(event) {
            const currentFrame = Math.floor(event.currentFrame);
            this.updateTimelineUI(currentFrame, true);
        }

        onComplete() {
            if (this.isLogotypeIntro) {
                this.wrapper.classList.add('playing'); 
            }
        }

        onHoverStart() {
            this.wrapper.classList.add('playing');
            this.isHovering = true;

            if (!this.dotLottie || !this.dotLottie.isLoaded) return;
            
            if (this.isLogotypeIntro) {
                this.dotLottie.setFrame(0);
                this.dotLottie.play();
            }
        }

        onHoverEnd() {
            this.isHovering = false;
            this.wrapper.classList.remove('playing');

            if (this.isLogotypeIntro) {
                this.dotLottie.pause();
                this.dotLottie.setFrame(0);
                this.updateTimelineUI(0, false);
            }
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

        updateTimelineUI(currentFrame, isPlaying) {
            if (this.ui.frameCounter) {
                this.ui.frameCounter.textContent = `FR: ${currentFrame}`;
            }

            if (this.totalFrames === 0) return;

            const progressPercent = (currentFrame / this.totalFrames) * 100;

            if (this.ui.progressFull) {
                this.ui.progressFull.style.width = `${progressPercent}%`;
            }

            let showMarker = isPlaying;
            if (this.isLogotypeIntro && this.isHovering && !isPlaying) {
                showMarker = true; 
            }

            if (this.ui.playheadMarker) {
                this.ui.playheadMarker.style.left = `${progressPercent}%`;
                this.ui.playheadMarker.style.opacity = showMarker ? '1' : '0';
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

            const titleEl = wrapper.querySelector('.lottie-title');
            const title = (animationData.displayName || animationData.fileName).replace('.lottie', '');
            titleEl.textContent = title;
            
            if (animationData.feedback) {
                const feedbackEl = document.createElement('div');
                feedbackEl.className = 'feedback-note';
                feedbackEl.textContent = animationData.feedback;
                titleEl.parentNode.appendChild(feedbackEl);
            }

            /* ADDED: Check for wide card property */
            if (animationData.isWide) {
                wrapper.classList.add('is-wide');
            }

            wrapper.addEventListener('themeChange', (e) => {
                descriptionEl.classList.toggle('light-mode', e.detail.isLight);
            });
            
            gridContainer.appendChild(cardFragment);
            new LottieCard(wrapper, animationData);
        });
    }

    document.addEventListener('DOMContentLoaded', setupAnimationGrids);

})();
