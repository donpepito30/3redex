import sys

with open("index.html", "r") as f:
    content = f.read()

with open("/tmp/target.txt", "r") as f:
    target = f.read()

replacement = """        function renderFeatured(model) {
            if (!model) return;
            ELEMENTS.featuredSection.dataset.username = model.username;
            ELEMENTS.featuredSection.dataset.country = model.modelsCountry || 'GLOBAL';
            ELEMENTS.featuredName.innerText = (model.displayName || model.username).toUpperCase();
            
            const avatarUrl = model.previewUrl || model.previewUrlThumbBig || model.avatarUrl || `https://ui-avatars.com/api/?name=${model.username}&background=0a0a0a&color=ff0000`;
            if (ELEMENTS.featuredAvatar) {
                ELEMENTS.featuredAvatar.src = avatarUrl;
            }

            if (ELEMENTS.featuredViewers) {
                ELEMENTS.featuredViewers.innerText = (model.viewersCount || 0).toLocaleString();
            }
            if (ELEMENTS.featuredCountry) {
                ELEMENTS.featuredCountry.innerText = (model.modelsCountry || 'GLOBAL').toUpperCase();
            }

            // Clean up old PRIME instance safely
            const oldHls = state.hlsInstances.get('PRIME');
            if (oldHls) {
                oldHls.destroy();
                state.hlsInstances.delete('PRIME');
            }

            // Clear any existing hero timer
            if (state.heroTimer) {
                clearTimeout(state.heroTimer);
                state.heroTimer = null;
            }

            // Reset blur and play button state on loading new model
            const video = ELEMENTS.featuredVideo;
            if (video) {
                video.classList.remove('blur-md', 'hero-blur-deep');
            }
            const playBtn = document.getElementById('heroPlayBtn');
            if (playBtn) {
                playBtn.classList.add('hidden');
            }
            state.isHeroBlurred = false;

            // Reset any previously locked and blurred cards in the grid
            document.querySelectorAll('.glass-card').forEach(c => {
                c.classList.remove('card-locked-active');
                const overlay = c.querySelector('.card-locked-overlay');
                if (overlay) overlay.remove();
                
                const visual = c.querySelector('.relative.aspect-\\[4\\/5\\]');
                if (visual) {
                    visual.style.filter = '';
                    visual.style.pointerEvents = '';
                }
            });

            // Set up high-fidelity Countdown progress bar
            const container = document.getElementById('heroCountdownContainer');
            const bar = document.getElementById('heroCountdownBar');
            if (bar && container) {
                container.classList.remove('hidden');
                bar.style.transition = 'none';
                bar.style.width = '100%';
                bar.getBoundingClientRect();
                bar.style.transition = 'width 6000ms linear';
                bar.style.width = '0%';
            }

            const hlsUrl = model.stream && model.stream.urls ? (model.stream.urls['240p'] || model.stream.urls['original']) : '';
            if (hlsUrl && video) {
                if (Hls.isSupported()) {
                    const hls = new Hls({ capLevelToPlayerSize: true, autoStartLoad: true });
                    hls.loadSource(hlsUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        video.muted = !state.audioEnabled;
                        video.play().catch(() => {});
                    });
                    state.hlsInstances.set('PRIME', hls);
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = hlsUrl;
                    video.muted = !state.audioEnabled;
                    video.addEventListener('loadedmetadata', () => {
                        video.play().catch(() => {});
                    });
                }
            }

            // Set timer for 6 seconds
            state.heroTimer = setTimeout(() => {
                if (video) {
                    video.classList.add('hero-blur-deep');
                }
                state.isHeroBlurred = true;

                if (container) {
                    container.classList.add('hidden');
                }

                if (playBtn) {
                    playBtn.classList.remove('hidden');
                }

                const selectedCard = document.querySelector(`.glass-card[data-username="${model.username}"]`);
                if (selectedCard) {
                    selectedCard.classList.add('card-locked-active');
                    
                    const visual = selectedCard.querySelector('.relative.aspect-\\[4\\/5\\]');
                    if (visual) {
                        visual.style.filter = 'blur(24px)';
                        visual.style.pointerEvents = 'none';
                    }

                    if (!selectedCard.querySelector('.card-locked-overlay')) {
                        const overlay = document.createElement('div');
                        overlay.className = 'card-locked-overlay absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300';
                        overlay.innerHTML = `
                            <span class="material-symbols-outlined text-[32px] text-primary animate-pulse mb-1" style="font-variation-settings: 'FILL' 1;">lock</span>
                            <span class="text-[9px] font-black tracking-widest text-primary uppercase">STREAM LOCKED</span>
                            <span class="text-[6px] text-white/70 uppercase tracking-wider mt-0.5">PLAY TO UNLOCK</span>
                        `;
                        selectedCard.appendChild(overlay);
                    }
                }
                
                showToast('Stream Paused. Tap PLAY to Unlock Live Nexus Feed.', 'info');
            }, 6000);
        }

        function loadCardToHero(model) {
            // If the hero/card is blurred or locked, trigger the premium redirect/ad immediately
            const cardEl = document.querySelector(`.glass-card[data-username="${model.username}"]`);
            const isCardLocked = cardEl && cardEl.classList.contains('card-locked-active');
            
            if (state.isHeroBlurred || isCardLocked) {
                const country = model.modelsCountry || 'GLOBAL';
                redirectToOffer(model.username, country);
                return;
            }

            // Stop automatic rotation so it doesn't interrupt this manually loaded card
            if (state.featuredRotationInterval) {
                clearInterval(state.featuredRotationInterval);
                state.featuredRotationInterval = null;
            }

            // Render it in the Hero
            renderFeatured(model);
        }"""

if target in content:
    new_content = content.replace(target, replacement)
    with open("index.html", "w") as f:
        f.write(new_content)
    print("Success")
else:
    print("Target not found")
