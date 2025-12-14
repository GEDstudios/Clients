/**
 * @file Application logic for UI Animations Page.
 * Uses DotLottie Player for .lottie support.
 */

(function () {
    'use strict';

    const UI_SECTIONS = [
        {
            id: 'ui-list',
            animations: [
                { fileName: "Electricity.lottie" },
                // Added isMobile flag here
                { fileName: "Electricity_Mobile.lottie", isMobile: true },
                { fileName: "UI_1.lottie" },
                { fileName: "UI_2.lottie" },
                { fileName: "UI_3.lottie", isTBD: true },
                { fileName: "UI_4.lottie" },
                { fileName: "UI_5.lottie" }
            ]
        }
    ];

    class LottieCard {
        constructor(wrapper, animationData) {
            this.wrapper = wrapper;
            this.animationData = animationData;
            this.container = wrapper.querySelector('.lottie-container');

            this.player = null; 
            this.totalFrames = 0;
            
            this.ui = {
                frameCounter: wrapper.querySelector('.frame-counter'),
                playheadMarker: wrapper.querySelector('.playhead-marker'),
                progressFull: wrapper.querySelector('.progress-full'),
                frameStart: wrapper.querySelector('.frame-num-start'),
                frameEnd: wrapper.querySelector('.frame-num-end')
            };

            this.initPlayer();
        }

        initPlayer() {
            this.player = document.createElement('dotlottie-player');
            this.player.src = `Lotties/${this.animationData.fileName}`;
            this.player.setAttribute('loop', '');
            this.player.setAttribute('autoplay', '');
            this.player.setAttribute('background', 'transparent');
            
            this.container.appendChild(this.player);

            this.player.addEventListener('ready', this.onReady.bind(this));
            this.player.addEventListener('frame', this.onFrame.bind(this));
        }

        onReady() {
            const lottieInstance = this.player.getLottie();
            if (lottieInstance) {
                this.totalFrames = lottieInstance.totalFrames;
                
                if (this.ui.frameStart) this.ui.frameStart.textContent = '0';
                if (this.ui.frameEnd) this.ui.frameEnd.textContent = Math.floor(this.totalFrames);
                
                this.wrapper.classList.add('playing');
            }
        }

        onFrame(e) {
            const currentFrame = Math.floor(e.detail.frame);
            if (this.totalFrames === 0) return;

            if (this.ui.frameCounter) {
                this.ui.frameCounter.textContent = `Frame: ${currentFrame}`;
            }

            const progressPercent = (currentFrame / this.totalFrames) * 100;
            
            if (this.ui.playheadMarker) {
                this.ui.playheadMarker.style.left = `${progressPercent}%`;
            }
            
            if (this.ui.progressFull) {
                this.ui.progressFull.style.width = `${progressPercent}%`;
            }
        }
    }

    function setupUiGrid() {
        const mainContainer = document.getElementById('animation-sections-container');
        const cardTemplate = document.getElementById('lottie-card-template');
        const tbdTemplate = document.getElementById('tbd-card-template');

        if (!mainContainer || !cardTemplate) return;

        UI_SECTIONS.forEach(section => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'section-container';

            const gridEl = document.createElement('div');
            gridEl.id = section.id;
            gridEl.className = 'animation-grid';
            sectionEl.appendChild(gridEl);

            mainContainer.appendChild(sectionEl);

            populateGrid(gridEl, cardTemplate, tbdTemplate, section.animations);
        });
    }

    function populateGrid(gridContainer, cardTemplate, tbdTemplate, animations) {
        animations.forEach((animationData) => {
            if (animationData.isTBD) {
                const tbdFragment = tbdTemplate.content.cloneNode(true);
                gridContainer.appendChild(tbdFragment);
                return; 
            }

            const cardFragment = cardTemplate.content.cloneNode(true);
            const wrapper = cardFragment.querySelector('.animation-wrapper');
            
            if (!wrapper) return;

            // Apply special class if it's a mobile layout
            if (animationData.isMobile) {
                wrapper.classList.add('mobile-variant');
            }

            const titleEl = wrapper.querySelector('.lottie-title');
            let title = animationData.fileName
                .replace('.json', '')
                .replace('.lottie', '')
                .trim();
            titleEl.textContent = title;
            
            gridContainer.appendChild(cardFragment);
            new LottieCard(wrapper, animationData);
        });
    }

    document.addEventListener('DOMContentLoaded', setupUiGrid);

})();