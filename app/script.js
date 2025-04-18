const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const maxPolyphony = 10;
let currentDecade = 3;
let activeOscillators = {};
let activeNotes = new Set();
let isSustainPadPressed = false;
let delyedKeyStops = new Set();

// Частоты для клавиш базовой декады (z-x-c-...)
const baseFrequencies = {};
const startFreq = 440; // A4 
const startNote = 40;  // 4 декада * 10 ступеней

// Инициализируем частоты для всех клавиш
function initFrequencies() {
	const keyboard = [
		['z','x','c','v','b','n','m',',','.'],
    	['a','s','d','f','g','h','j','k','l',';'],
        ['q','w','e','r','t','y','u','i','o','p','[',']'],
        ['1','2','3','4','5','6','7','8','9','0','-','=']
	];
	keyboard.forEach((keys, row) => {
		keys.forEach((key, index) => {
        	const noteInRow = index;// % 10;
        	const absoluteNote = currentDecade * 10 + noteInRow + row * 10;
        	const freq = startFreq * Math.pow(2, (absoluteNote - startNote) / 10);
        	baseFrequencies[key] = freq;
        
        	const freqElement = document.getElementById('freq-' + key);
        	if (freqElement) freqElement.textContent = freq.toFixed(1) + ' Hz';
    	});
	});
	
	// Костыль: клавиша '~' является "клоном" клавиши 'p' (иначе пришлось бы задавать ей отрицательный индекс)
	const tildaFreqKey = document.getElementById('freq-`');
	if (tildaFreqKey) tildaFreqKey.textContent = document.getElementById('freq-p').textContent;
	baseFrequencies['`'] = baseFrequencies['p']; 
}

// Воспроизведение ноты
function playNote(key) {
    if (activeNotes.size >= maxPolyphony || activeOscillators[key]) return;
    
    const freq = baseFrequencies[key] * Math.pow(2, currentDecade - 4);
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
                
    
    oscillator.type = 'sine';
    // Начинаем с заниженной частоты
    oscillator.frequency.value = freq * 50;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
   
    // Плавное нарастание
    const attackMs = 75;
    const currentGainValue = gainNode.gain.value;
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(currentGainValue, audioCtx.currentTime + attackMs / 1000);
    
    // Поднимаемся к целевой частоте
    oscillator.frequency.exponentialRampToValueAtTime(freq, audioCtx.currentTime + (attackMs / 4) / 1000);
    
    oscillator.start();
    
    activeOscillators[key] = { oscillator, gainNode };
    activeNotes.add(key);
     
    updateStatus();
}

// Остановка ноты
function stopNote(key) {
    if (!activeOscillators[key]) return;
    
    const { oscillator, gainNode } = activeOscillators[key];
    
    // Плавное затухание
    const releaseMs = 1500;
    gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + releaseMs / 1000);
    
    setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
    }, releaseMs);
    
    delete activeOscillators[key];
    activeNotes.delete(key);
    
    // Снимаем подсветку
    document.querySelectorAll('[data-key="' + key + '"]').forEach(el => el.classList.remove('active'));
    
    updateStatus();
}

// Обновление статуса
function updateStatus() {
    const status = `Active notes: ${activeNotes.size}/${maxPolyphony}. Decade: ${currentDecade}. Sustain: ${isSustainPadPressed}`;
    document.getElementById('status').textContent = status;
}

// Изменение декады
function changeDecade(delta) {
    currentDecade = Math.max(0, Math.min(8, currentDecade + delta));
    document.getElementById('decade-display').textContent = currentDecade;
    initFrequencies();
    updateStatus();
}

// Обработчики событий
document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    e.preventDefault();
    const key = e.key.toLowerCase();
    if (key in baseFrequencies) {
        e.preventDefault();
        playNote(key);
    }
    
    // Управление декадой
    if (e.shiftKey && e.key === 'Shift') changeDecade(-1);
    if (e.ctrlKey && e.key === 'Control') changeDecade(1);
    
    // "Педаль" на пробел
    if (key == ' ') {
    	e.preventDefault();
    	isSustainPadPressed = true;
    	
    }
    
    // Подсветка клавиши
    document.querySelectorAll('[data-key="' + key + '"]').forEach(el => el.classList.add('active'));

    updateStatus();
});

document.addEventListener('keyup', (e) => {
	e.preventDefault();
    const key = e.key.toLowerCase();
    if (key in baseFrequencies) {
        e.preventDefault();
        if (isSustainPadPressed) {
        	delyedKeyStops.add(key);
        } else {
        	delyedKeyStops.delete(key);
        	stopNote(key);
        }
    }
    
    // "Педаль" на пробел
    if (key == ' ') {
    	e.preventDefault();
    	isSustainPadPressed = false;
  		delyedKeyStops.forEach((delayedKey) => {
  			stopNote(delayedKey);
  		});
  		delyedKeyStops.clear();
  		// Снимаем подсветку
    	document.querySelectorAll('[data-key=" "]').forEach(el => el.classList.remove('active'));
    }
    
    updateStatus();
});

// Кнопки управления декадой
document.getElementById('decade-up').addEventListener('click', () => changeDecade(1));
document.getElementById('decade-down').addEventListener('click', () => changeDecade(-1));

// Инициализация
initFrequencies();
updateStatus();