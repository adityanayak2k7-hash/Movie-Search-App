## mic fix plu all ok 
const apiKey = "87ad90b4";


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

// Show movie card
const ShowMovieData = (data) => {
    const { Title, imdbRating, Released, Runtime, Actors, Plot, Poster } = data;
    const card = document.createElement('div');
    card.classList.add('movie-card');

    card.innerHTML = `
        <h2>${Title}</h2>
        <p>⭐ ${imdbRating}</p>
        <p><strong>Released:</strong> ${Released}</p>
        <p><strong>Duration:</strong> ${Runtime}</p>
        <p><strong>Cast:</strong> ${Actors}</p>
        <p><strong>Plot:</strong> ${Plot}</p>
    `;

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
    card.appendChild(posterDiv);
    
    movieContainer.appendChild(card);
};

// Get full details
const getMovieDetails = async (id) => {
    const res = await fetch(`http://www.omdbapi.com/?apikey=${apiKey}&i=${id}`);
    return await res.json();
};

// Smart search - exact first
const getMovieInfo = async (query) => {
    if (!query.trim()) return;
    
    showLoading();
    movieContainer.innerHTML = '';
    
    try {
        // Exact title first
        let res = await fetch(`http://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(query)}&type=movie`);
        let data = await res.json();
        
        if (data.Response === 'True') {
            ShowMovieData(data);
        } else {
            // Search fallback
            res = await fetch(`http://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}&type=movie`);
            data = await res.json();
            
            if (data.Search && data.Search.length) {
                for (let m of data.Search.slice(0, 5)) {
                    const fullData = await getMovieDetails(m.imdbID);
                    if (fullData.Response === 'True') ShowMovieData(fullData);
                }
            } else {
                movieContainer.innerHTML = `<div style="text-align:center;padding:4rem"><h3>No movies found for "${query}"</h3><p>Try exact title or genre!</p></div>`;
            }
        }
    } catch (err) {
        console.error('Search error:', err);
        movieContainer.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--accent-primary)"><h3>Search failed</h3><p>Try again soon</p></div>`;
    }
    
    hideLoading();
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
        searchTimeout = setTimeout(() => getMovieInfo(q), 500);
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

// Init
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    switchTheme('netflix');
    genresSection.style.display = 'block';
});

