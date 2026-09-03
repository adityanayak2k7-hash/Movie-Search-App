const apiKey = "87ad90b4";
const geminiApiKey = "AIzaSyBoCjkWXlKUD2vXv74uK03JOJz4dJ8j6gQ";
const tmdbApiKey = "f1874a5674ce17f36a8f697cb952d716";

console.log('🚀 Movie Chat App Loaded');
console.log('API Keys Status:');
console.log('  - OMDb Key:', apiKey ? '✅ Set' : '❌ Missing');
console.log('  - Gemini Key:', geminiApiKey ? '✅ Set' : '❌ Missing');
console.log('  - TMDB Key:', tmdbApiKey ? '✅ Set' : '❌ Missing');

// Chat state - per movie card
const CHARACTER_CACHE = new Map(); // title -> characters[]
const CHAT_MEMORY = new WeakMap(); // card -> [{role: 'user/ai', content, timestamp}]
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
console.log('Gemini URL:', GEMINI_URL);


// DOM Elements
const searchForm = document.querySelector('.search-form');
const movieContainer = document.querySelector('.movie-container');
const searchInput = document.getElementById('searchInput') || document.querySelector('.inputBox');
const placeholderSection = document.querySelector('.placeholder-section');
const micBtn = document.querySelector('#micBtn');
const genresSection = document.getElementById('genresSection');
const genreBtns = document.querySelectorAll('.genre-btn');
const loadingSpinner = document.getElementById('loadingSpinner');
const themeBtns = document.querySelectorAll('.theme-btn');

// State
let currentTheme = 'netflix';
let recognition;

// Loading
const showLoading = () => loadingSpinner.classList.add('active');
const hideLoading = () => loadingSpinner.classList.remove('active');

// Fetch characters for chat (TMDB primary, OMDb fallback)
async function getCharacters(movieData) {
    const { Title, imdbID, Actors } = movieData;
    console.log('Getting characters for:', Title, {imdbID, hasActors: !!Actors});
    
    if (!imdbID && !Actors) {
        console.warn('No IMDb ID or Actors for', Title);
        return [];
    }

    // Cache check
    if (CHARACTER_CACHE.has(Title)) {
        console.log('Using cached characters for', Title);
        return CHARACTER_CACHE.get(Title);
    }

    try {
        // Try TMDB first (need IMDb to TMDB ID)
        let tmdbId = null;
        if (imdbID) {
            console.log('Fetching TMDB ID for IMDb:', imdbID);
            
            const searchRes = await fetch(`https://api.themoviedb.org/3/find/${imdbID}?api_key=${tmdbApiKey}&language=en-US&external_source=imdb_id`);
            const searchData = await searchRes.json();
            
            if (searchData.movie_results && searchData.movie_results.length > 0) {
                tmdbId = searchData.movie_results[0].id;
                console.log('Found TMDB ID:', tmdbId);
            }
        }

        let chars = [];
        if (tmdbId) {
            console.log('Fetching cast from TMDB for ID:', tmdbId);
            
            // Get credits
            const creditsRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/credits?api_key=${tmdbApiKey}&language=en-US`);
            const creditsData = await creditsRes.json();
            
            if (creditsData.cast) {
                chars = creditsData.cast.slice(0, 5).map(c => `${c.name} (${c.character})`);
                console.log('Got cast from TMDB:', chars);
            }
        }

        // Fallback to OMDb actors
        if (chars.length === 0 && Actors) {
            chars = Actors.split(', ').slice(0, 5).map(name => name.trim());
            console.log('Using fallback actors from OMDb:', chars);
        }

        CHARACTER_CACHE.set(Title, chars);
        return chars;
    } catch (error) {
        console.error('Character fetch error:', error);
        // Fallback
        const fallback = Actors ? Actors.split(', ').slice(0, 5).map(name => name.trim()) : [];
        console.log('Using fallback after error:', fallback);
        CHARACTER_CACHE.set(Title, fallback);
        return fallback;
    }
}

// Gemini AI chat - respond as character
async function chatWithCharacterGemini(userMessage, character, movieTitle, history = []) {
    try {
        console.log('🎭 Chat Request:', { userMessage, character, movieTitle });

        // 🧠 Build conversation memory (last 6 messages)
        const memoryContext = history.slice(-6).map(h => {
            return `${h.role === 'user' ? 'User' : character}: ${h.content}`;
        }).join('\n');

        // 🎯 SMART PROMPT (ANTI-REPETITION + CHARACTER DEPTH)
        const prompt = `
You are ${character} from the movie "${movieTitle}".

ROLEPLAY RULES:
- Stay 100% in character
- Never say you are AI
- Never repeat the same reply
- Talk like a real human
- Add personality, emotion, opinions
- If asked simple thing → short reply
- If deep question → thoughtful answer
- NEVER default to generic movie explanation

CONVERSATION HISTORY:
${memoryContext}

USER:
${userMessage}

REPLY AS ${character}:
`;

        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiApiKey
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }]
                }
              ],
              generationConfig: {
                temperature: 0.9,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 800  // if we increse this then we can take more deatil explanation or they say in mmore detail
              }
            })
          });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini HTTP Error:', response.status, errorText);
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Raw Gemini response structure:', Object.keys(data));

        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!reply) throw new Error('Empty AI reply - check raw response');

        console.log('✅ AI Reply:', reply);
        return reply;

    } catch (error) {
        console.error('❌ Gemini failed:', error.message);

        // 🧠 INTELLIGENT FALLBACK (NO REPETITION)
        const user = userMessage.toLowerCase();

        const fallbackReplies = [
            "That's... complicated. Ask me something deeper.",
            "You're asking the wrong question. Try again.",
            "I don’t have a simple answer for that.",
            "Interesting… but what do *you* think?",
            "We’re getting into dangerous territory here."
        ];

        let reply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];

        // 🎭 Character flavor boost
        if (character.includes("Oppenheimer")) {
            if (user.includes("bomb")) {
                reply = "The bomb changed everything… including me.";
            } else if (user.includes("worth")) {
                reply = "Worth is a question that still haunts me.";
            }
        }

        return reply;
    }
}
        

// Chat UI functions

// Static Chat Init for chat-test.html demo (uses EXISTING chat container)
function initStaticChat(card, movieData) {
    console.log('🧪 Initializing STATIC Chat UI for:', movieData.Title);
    
    const chatContainer = card.querySelector('.movie-chat-container');
    if (!chatContainer) {
        console.error('❌ No .movie-chat-container found');
        return;
    }
    
    const Title = movieData.Title;
    
    // Load/populate characters
    getCharacters(movieData).then(chars => {
        const select = chatContainer.querySelector('.chat-character-select');
        select.innerHTML = chars.length ? 
            '<option value="">Select...</option>' + chars.map(c => `<option value="${c}">${c}</option>`).join('') :
            '<option>No characters</option>';
        console.log('✅ Static chars loaded:', chars);
    });
    
    // State
    CHAT_MEMORY.set(card, []);
    
    // Elements
    const messagesDiv = chatContainer.querySelector('.chat-messages');
    const input = chatContainer.querySelector('.chat-main-input');
    const sendBtn = chatContainer.querySelector('.chat-send-btn');
    const charSelect = chatContainer.querySelector('.chat-character-select');
    
    // Enable send logic
    const updateSendBtn = () => {
        const enabled = charSelect.value && input.value.trim();
        sendBtn.disabled = !enabled;
        sendBtn.style.opacity = enabled ? 1 : 0.5;
    };
    
    charSelect.onchange = input.oninput = updateSendBtn;
    updateSendBtn();
    
    // Send
    const sendMessage = async () => {
        const msg = input.value.trim();
        const character = charSelect.value;
        if (!msg || !character) return;
        
        addMessage(messagesDiv, msg, 'user');
        input.value = '';
        updateSendBtn();
        
        const typing = addTypingIndicator(messagesDiv, character);
        
        try {
            const reply = await chatWithCharacterGemini(msg, character, Title, CHAT_MEMORY.get(card));
            typing.remove();
            addMessage(messagesDiv, reply, 'ai', character);
            speakText(reply);
            
            // History
            const history = CHAT_MEMORY.get(card);
            history.push({role: 'user', content: msg});
            history.push({role: 'ai', content: reply});
        } catch (e) {
            typing.remove();
            addMessage(messagesDiv, `Sorry, try again! (Check console)`, 'ai');
        }
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };
    
    sendBtn.onclick = sendMessage;
    input.onkeypress = e => {
        if (e.key === 'Enter' && !e.shiftKey && !sendBtn.disabled) {
            e.preventDefault();
            sendMessage();
        }
    };
    
    // Reuse utils from initChatUI scope or define local
    window.addMessage = addMessage;
    window.addTypingIndicator = addTypingIndicator;
    
    console.log('✅ Static chat ready!');
}

// Dynamic (original)
function initChatUI(card, movieData) {
    console.log('🎬 Initializing Chat UI for:', movieData.Title);
    
    const { Title } = movieData;
    const chatContainer = document.createElement('div');
    chatContainer.className = 'movie-chat-container movie-chat-left';

    chatContainer.innerHTML = `
        <div class="chat-header">
            <label>Chat with character from "${Title}":</label>
            <select class="chat-character-select">
                <option value="">Loading characters...</option>
            </select>
        </div>
        <div class="chat-messages" id="chat-messages-${Title.replace(/[^a-zA-Z0-9]/g, '')}"></div>
        <div class="chat-input-container">
            <textarea class="chat-main-input" placeholder="Ask ${Title} characters anything..."></textarea>
            <button class="chat-mic-btn" title="Voice message">🎤</button>
            <button class="chat-send-btn" disabled>➤</button>
        </div>
    `;

    // Append to card info section
    // Fix: Append chat to card root (flex container)
    card.appendChild(chatContainer);
    console.log('✅ Chat container appended to card');

    // Get characters async
    getCharacters(movieData).then(chars => {
        console.log('📢 Characters loaded for', Title, ':', chars);
        const select = chatContainer.querySelector('.chat-character-select');
        if (chars.length > 0) {
            select.innerHTML = '<option value="">Select character...</option>' + 
                chars.map(char => `<option value="${char}">${char}</option>`).join('');
            console.log('✅ Character options populated:', chars.length);
        } else {
            select.innerHTML = '<option value="">No characters available</option>';
            console.warn('⚠️ No characters found for', Title);
        }
        updateSendState();
    }).catch(error => {
        console.error('❌ Error loading characters:', error);
        const select = chatContainer.querySelector('.chat-character-select');
        select.innerHTML = '<option value="">Error loading characters</option>';
    });

    // Init state
    CHAT_MEMORY.set(card, []);
    console.log('✅ Chat memory initialized');

    // Events
    const messagesDiv = chatContainer.querySelector('.chat-messages');
    const input = chatContainer.querySelector('.chat-main-input');
    const sendBtn = chatContainer.querySelector('.chat-send-btn');
    const micBtnChat = chatContainer.querySelector('.chat-mic-btn');
    const charSelect = chatContainer.querySelector('.chat-character-select');

    console.log('✅ All DOM elements acquired:', {
        messagesDiv: !!messagesDiv,
        input: !!input,
        sendBtn: !!sendBtn,
        charSelect: !!charSelect
    });

    function updateSendState() {
        const hasCharacter = charSelect.value && charSelect.value.trim() !== '';
        const hasMessage = input.value && input.value.trim() !== '';
        const shouldEnable = hasCharacter && hasMessage;
        
        console.log('✏️ updateSendState:', {
            selectedValue: charSelect.value,
            hasCharacter,
            messageLength: input.value.length,
            hasMessage,
            shouldEnable
        });
        
        sendBtn.disabled = !shouldEnable;
        
        // Visual feedback
        if (shouldEnable) {
            sendBtn.style.opacity = '1';
            sendBtn.style.cursor = 'pointer';
        } else {
            sendBtn.style.opacity = '0.5';
            sendBtn.style.cursor = 'not-allowed';
        }
    }

    charSelect.addEventListener('change', (e) => {
        console.log('📍 Character changed to:', e.target.value);
        updateSendState();
    });
    
    input.addEventListener('input', (e) => {
        console.log('✍️ Input changed. Length:', e.target.value.length);
        updateSendState();
    });
    
    // Call updateSendState initially
    updateSendState();
    console.log('✅ Initial send state updated');

    // Send message
    const sendMessage = async () => {
        console.log('🎯 sendMessage called');
        
        const msg = input.value.trim();
        const character = charSelect.value;
        
        console.log('📋 Message details:', {msg, character, msgLength: msg.length});
        
        if (!msg) {
            console.error('❌ Message is empty');
            alert('Please type a message!');
            return;
        }
        
        if (!character) {
            console.error('❌ No character selected');
            alert('Please select a character first!');
            return;
        }

        console.log('✅ Validation passed, proceeding with send');
        console.log('=== SENDING MESSAGE ===');
        console.log('Message:', msg);
        console.log('Character:', character);
        console.log('Title:', Title);
        
        const history = CHAT_MEMORY.get(card) || [];

        // User message
        console.log('📝 Adding user message to UI');
        addMessage(messagesDiv, msg, 'user');
        input.value = '';
        updateSendState();

        // Typing indicator with character name
        const typingDiv = addTypingIndicator(messagesDiv, character);
        console.log('⏳ Typing indicator shown');

        try {
            // AI response
            console.log('🔄 Calling Gemini API...');
            const aiReply = await chatWithCharacterGemini(msg, character, Title, history);
            console.log('✅ API Response received:', aiReply);
            
            if (typingDiv && typingDiv.parentNode) {
                typingDiv.remove();
                console.log('✅ Typing indicator removed');
            }

            console.log('💬 Adding AI response to UI');
            addMessage(messagesDiv, aiReply, 'ai', character);
            
            // TTS
            try {
                console.log('🔊 Playing TTS');
                speakText(aiReply);
            } catch (e) {
                console.warn('⚠️ TTS error:', e);
            }

            // Update memory (limit 20 msgs)
            history.push({ role: 'user', content: msg, timestamp: Date.now() });
            history.push({ role: 'ai', content: aiReply, timestamp: Date.now() });
            if (history.length > 20) history.splice(0, history.length - 20);
            
            console.log('✅ Message saved to history. Total messages:', history.length);
        } catch (error) {
            console.error('❌ Error in sendMessage:', error.message);
            console.error('Stack:', error.stack);
            if (typingDiv && typingDiv.parentNode) {
                typingDiv.remove();
            }
            const errorMsg = '❌ Error: ' + (error.message || 'Could not get response');
            console.log('📛 Showing error to user:', errorMsg);
            addMessage(messagesDiv, errorMsg, 'ai');
        }

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        console.log('🔚 sendMessage complete');
    };

    // Button click - MOST IMPORTANT
    sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔴 SEND BUTTON CLICKED - disabled state:', sendBtn.disabled);
        
        if (sendBtn.disabled) {
            console.warn('⚠️ Send button is disabled!');
            return;
        }
        
        sendMessage();
    });
    
    // Enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            console.log('⌨️ Enter key pressed');
            
            if (sendBtn.disabled) {
                console.warn('⚠️ Send button is disabled!');
                return;
            }
            
            sendMessage();
        }
    });

    // Per-chat voice (new recognition instance)
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const chatRecog = new SpeechRecognition();
        chatRecog.continuous = false;
        chatRecog.lang = 'en-US';

        micBtnChat.addEventListener('click', () => {
            if (micBtnChat.classList.contains('listening')) {
                chatRecog.stop();
            } else {
                chatRecog.start();
            }
        });

        chatRecog.onstart = () => micBtnChat.classList.add('listening');
        chatRecog.onend = () => micBtnChat.classList.remove('listening');
        chatRecog.onresult = (e) => {
            input.value = e.results[0][0].transcript.trim();
            updateSendState();
        };
    }

    // Utility functions
    function addMessage(container, text, type, name = '') {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${type === 'user' ? 'message-user' : ''}`;
        msgDiv.innerHTML = `
            <div class="chat-bubble ${type === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}">${text}</div>
            <span class="chat-message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        `;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }

    function addTypingIndicator(container, character = 'AI') {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
            <span>${character} is typing...</span>
        `;
        container.appendChild(typingDiv);
        container.scrollTop = container.scrollHeight;
        return typingDiv;
    }
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    }
}

// Show movie card WITH CHAT INTEGRATION
async function ShowMovieData(data) {
    const { Title, imdbRating, Released, Runtime, Actors, Plot, Poster, imdbID } = data;
    const card = document.createElement('div');
    card.classList.add('movie-card');
    card.dataset.movieTitle = Title;
    card.dataset.imdbId = imdbID || '';

    const posterDiv = document.createElement('div');
    posterDiv.classList.add('movie-poster');
    
    const img = document.createElement('img');
    img.src = Poster;
    img.alt = Title;
    img.classList.add('poster-img');
    
    const trailerBtn = document.createElement('button');
    trailerBtn.textContent = '▶️ Trailer';
    trailerBtn.classList.add('trailer-btn');
    trailerBtn.onclick = () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(Title)}+trailer`);
    
    posterDiv.appendChild(img);
    posterDiv.appendChild(trailerBtn);
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'movie-info';
    infoDiv.innerHTML = `
        <h2>${Title}</h2>
        <p>⭐ ${imdbRating}</p>
        <p><strong>Released:</strong> ${Released}</p>
        <p><strong>Duration:</strong> ${Runtime}</p>
        <p><strong>Cast:</strong> ${Actors}</p>
        <p><strong>Plot:</strong> ${Plot}</p>
    `;

    card.appendChild(posterDiv);
    
    // ADD DYNAMIC CHAT SYSTEM (appends movie-chat-left)
    try {
        await initChatUI(card, data);
    } catch (error) {
        console.error('Chat init error:', error);
        // Fallback - insert after poster
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'chat-status chat-error movie-chat-left';
        fallbackDiv.textContent = 'Chat loading failed - refresh page to retry';
        card.appendChild(fallbackDiv);
    }
    
    card.appendChild(infoDiv);
    movieContainer.appendChild(card);
}

// Get full details
const getMovieDetails = async (id) => {
    const res = await fetch(`http://www.omdbapi.com/?apikey=${apiKey}&i=${id}`);
    return await res.json();
};

// Smart search - LIST FIRST for multiple results + robust error handling
const getMovieInfo = async (query) => {
    if (!query.trim()) return;
    
    console.log(`🔍 Searching for: "${query}"`);
    showLoading();
    movieContainer.innerHTML = `<h3 style="text-align:center;margin:2rem 0">🔍 Searching "${query}"...</h3>`;
    
    try {
        // 1. PRIORITIZE LIST SEARCH FIRST (user expectation: multiple results)
        console.log('📋 Trying list search (&s=)...');
        let res = await fetch(`http://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}&type=movie`);
        let data = await res.json();
        
        if (data.Response === 'True' && data.Search && data.Search.length > 0) {
            console.log(`✅ Found ${data.Search.length} matches, showing top 5...`);
            movieContainer.innerHTML = `<h3 style="text-align:center;margin:2rem 0">🎬 Results for "${query}" (${Math.min(5, data.Search.length)} shown)</h3>`;
            
            let successCount = 0;
            for (let i = 0; i < Math.min(5, data.Search.length); i++) {
                const m = data.Search[i];
                try {
                    console.log(`Fetching details for: ${m.Title} (${m.imdbID})`);
                    const fullData = await getMovieDetails(m.imdbID);
                    if (fullData.Response === 'True') {
                        ShowMovieData(fullData);
                        successCount++;
                    }
                } catch (detailErr) {
                    console.error(`❌ Details failed for ${m.Title}:`, detailErr);
                }
            }
            
            if (successCount === 0) {
                throw new Error('No detailed results available');
            }
        } else {
            // 2. FALLBACK: Exact title search
            console.log('🔄 No list results, trying exact title (&t=)...');
            res = await fetch(`http://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(query)}&type=movie`);
            data = await res.json();
            
            if (data.Response === 'True') {
                console.log(`✅ Exact match found: ${data.Title}`);
                movieContainer.innerHTML = `<h3 style="text-align:center;margin:2rem 0">🎬 ${data.Title}</h3>`;
                ShowMovieData(data);
            } else {
                // 3. Show detailed error
                console.warn('No results:', data.Error);
                movieContainer.innerHTML = `<div style="text-align:center;padding:4rem">
                    <h3>❌ No movies found for "${query}"</h3>
                    <p>${data.Error || 'Try different spelling, genre, or popular title!'}</p>
                    <p><small>Tip: Try "action", "Oppenheimer", or "Marvel"</small></p>
                </div>`;
            }
        }
    } catch (err) {
        console.error('❌ Search error:', err);
    const errorDisplay = document.getElementById('errorDisplay');
    if (errorDisplay) {
        errorDisplay.style.display = 'block';
        document.getElementById('errorTitle').textContent = '🔌 Search failed';
        document.getElementById('errorMessage').textContent = 'Network error or API issue. Check console (F12) or try again.';
    } else {
        movieContainer.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--accent-primary)">
            <h3>🔌 Search failed</h3>
            <p>Network error or API issue. Check console (F12) or try again.</p>
            <details>
                <summary>Debug info</summary>
                <pre>${err.message}</pre>
            </details>
        </div>`;
    }
    } finally {
        hideLoading();
    }
    
    console.log('🏁 Search complete');
};

// Theme switch
const switchTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    currentTheme = theme;
    themeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
    console.log(`Theme: ${theme}`);
};

// Speech Recognition - FIXED
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    micBtn.addEventListener('click', () => {
        if (micBtn.classList.contains('listening')) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = () => micBtn.classList.add('listening');
    recognition.onend = () => micBtn.classList.remove('listening');
    recognition.onerror = (e) => {
        console.error('Speech error:', e.error);
        micBtn.classList.remove('listening');
    };
    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript.trim();
        const lower = transcript.toLowerCase();
        
        // Theme commands
        if (lower.includes('theme') || lower.includes('change')) {
            const themes = ['netflix', 'light', 'party', 'glass'];
            const idx = themes.indexOf(currentTheme);
            switchTheme(themes[(idx + 1) % themes.length]);
            return;
        }
        
        // Search
        searchInput.value = transcript;
        getMovieInfo(transcript);
    };
} else {
    micBtn.style.display = 'none';
}

// Event listeners
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    getMovieInfo(searchInput.value);
});

let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (q.length >= 2) {
        searchTimeout = setTimeout(() => getMovieInfo(q), 300); // Faster debounce
        console.log(`⏳ Live search for "${q}"...`);
    }
});

// Instant search on Enter (no debounce)
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        getMovieInfo(searchInput.value.trim());
    }
});

genreBtns.forEach(btn => {
    btn.addEventListener('click', () => getMovieInfo(btn.dataset.genre));
});

themeBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTheme(btn.dataset.theme));
});

// Particles
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 1
        });
    }
    
    const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fill();
        });
        requestAnimationFrame(animate);
    };
    animate();
}

// Load recommendations on home - FIXED with error handling & concurrency
async function loadRecommendations() {
    console.log('🎬 Preloading recommendations BEHIND trailer...');
    const mainContent = document.getElementById('mainContent');
    const recMovies = ['Oppenheimer', 'Barbie', 'Dune', 'Deadpool', 'Inside Out 2', 'Godzilla x Kong', 'Kung Fu Panda 4', 'Twisters'];
    
    // Set loading state (silent preload behind trailer)
    mainContent.classList.add('loading');
    
    // DON'T clear container - preserve structure
    // Show subtle preloader INSIDE container
    const preloader = document.createElement('div');
    preloader.className = 'preloader-overlay';
    preloader.innerHTML = '<h3 style="text-align:center;margin:4rem 0;color:var(--accent-primary);">🎬 Loading recommendations... <span class="loading-dots"><span></span><span></span><span></span></span></h3>';
    mainContent.appendChild(preloader);
    
    const batchSize = 3;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < recMovies.length; i += batchSize) {
        const batch = recMovies.slice(i, i + batchSize);
        const batchPromises = batch.map(async (title) => {
            try {
                console.log(`Fetching recommendation: ${title}`);
                const res = await fetch(`http://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(title)}&type=movie`);
                const data = await res.json();
                
                if (data.Response === 'True') {
                    console.log(`✅ Success: ${title}`);
                    ShowMovieData(data);
                    successCount++;
                    return 'success';
                } else {
                    console.warn(`⚠️ API Error for ${title}:`, data.Error);
                    errorCount++;
                    return 'error';
                }
            } catch (err) {
                console.error(`❌ Fetch failed for ${title}:`, err.message);
                errorCount++;
                return 'error';
            }
        });
        
        await Promise.allSettled(batchPromises);
    }
    
    // Hide preloader, mark ready (but still opacity:0 until trailer hides)
    if (preloader.parentNode) preloader.remove();
    if (successCount > 0) {
        mainContent.classList.add('ready');
        mainContent.classList.remove('loading');
        console.log(`✅ Preload complete: ${successCount}/${recMovies.length} recommendations ready`);
    } else {
        mainContent.classList.remove('loading');
        const errorMsg = document.createElement('div');
        errorMsg.innerHTML = `<h3 style="text-align:center;margin:4rem 0;">❌ Failed to preload. Try search!</h3>`;
        mainContent.appendChild(errorMsg);
    }
}
// Intro trailer control (CLEAN VERSION)
const introTrailer = document.getElementById('intro-trailer');
const aceVideo = document.getElementById('aceVideo');

if (aceVideo && introTrailer) {

    // ✅ Start unmuted
    aceVideo.muted = false;

    // (Optional) try autoplay
    aceVideo.play().catch(() => {
        // Browser may block autoplay with sound
        console.log("Autoplay blocked, user interaction needed");
    });

    let hasInteracted = false;
    let isMuted = false;
    let volumeLevel = 1.0;

    // ✅ Enhanced click: unmute on first interaction, then skip
    introTrailer.addEventListener('click', (e) => {
        if (!hasInteracted) {
            // First click: unmute & play sound
            aceVideo.muted = false;
            aceVideo.volume = volumeLevel;
            aceVideo.play();
            hasInteracted = true;
            console.log('✅ Video unmuted after user interaction');
            return;
        }
        
        // Second click: skip
        aceVideo.pause();
        aceVideo.currentTime = 0;
        introTrailer.classList.add('hidden');
        setTimeout(() => {
            introTrailer.remove();
            revealMainContent();
        }, 500);
    });


    // ✅ Skip button
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip';
    skipBtn.classList.add('skip-btn');

    skipBtn.onclick = (e) => {
        e.stopPropagation();

        aceVideo.pause();
        aceVideo.currentTime = 0;

        introTrailer.classList.add('hidden');
        setTimeout(() => {
            introTrailer.remove();
            revealMainContent();
        }, 500);
    };

    introTrailer.appendChild(skipBtn);

    // 🔊 NEW: Volume Controls
    const volumeContainer = document.createElement('div');
    volumeContainer.classList.add('volume-controls');
    volumeContainer.innerHTML = `
        <button id="muteToggle" class="volume-btn ${isMuted ? 'muted' : ''}">🔇</button>
        <input type="range" id="volumeSlider" class="volume-slider" min="0" max="1" step="0.1" value="${volumeLevel}">
        <span id="volumeValue" class="volume-value">${Math.round(volumeLevel * 100)}%</span>
    `;

    introTrailer.appendChild(volumeContainer);

    // Volume logic
    const muteToggle = document.getElementById('muteToggle');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');

    muteToggle.addEventListener('click', () => {
        isMuted = !isMuted;
        aceVideo.muted = isMuted;
        muteToggle.textContent = isMuted ? '🔇' : '🔊';
        muteToggle.classList.toggle('muted');
    });

    volumeSlider.addEventListener('input', () => {
        volumeLevel = parseFloat(volumeSlider.value);
        aceVideo.volume = volumeLevel;
        aceVideo.muted = false;
        isMuted = false;
        volumeValue.textContent = Math.round(volumeLevel * 100) + '%';
        muteToggle.textContent = '🔊';
        muteToggle.classList.remove('muted');
    });


    // ✅ When video ends → auto remove
    aceVideo.addEventListener('ended', () => {
        introTrailer.classList.add('hidden');
        setTimeout(() => {
            introTrailer.remove();
            revealMainContent();
        }, 500);
    });

    // (Optional) Start from 2s
    aceVideo.addEventListener('loadeddata', () => {
        aceVideo.currentTime = 2;
    });
}

// Trailer reveal handler
function revealMainContent() {
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.classList.add('ready');
        console.log('✨ Main content revealed smoothly!');
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 DOM Loaded - Starting initialization');
    
    const mainContent = document.getElementById('mainContent');
    const introTrailer = document.getElementById('intro-trailer');
    const aceVideo = document.getElementById('aceVideo');
    
    initParticles();
    switchTheme('netflix');
    genresSection.style.display = 'block';
    
    // Start SILENT preload
    loadRecommendations();
    
    // Override trailer hide events to reveal content
    if (introTrailer && aceVideo) {
        const originalSkip = introTrailer.onclick || function(){};
        
        introTrailer.addEventListener('click', (e) => {
            originalSkip.call(introTrailer, e);
            if (introTrailer.classList.contains('hidden')) {
                setTimeout(revealMainContent, 300); // Sync with CSS transition
            }
        });
        
        aceVideo.addEventListener('ended', () => {
            introTrailer.classList.add('hidden');
            setTimeout(() => {
                introTrailer.remove();
                revealMainContent();
            }, 500);
        });
    }
    
    // Test Gemini API key
    console.log('🧪 Testing Gemini API key...');
    fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: 'Say hello' }]
            }]
        })
    })
    .then(res => {
        console.log('✅ API Test Response:', res.status);
        if (!res.ok) {
            console.error('❌ API Key may be invalid. Status:', res.status);
        }
    })
    .catch(err => {
        console.error('❌ API Connection Error:', err.message);
    });
});

