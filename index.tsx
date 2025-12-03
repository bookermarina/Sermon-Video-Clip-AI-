
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Types ---
type AspectRatio = '9:16' | '16:9';
type Resolution = '720p' | '1080p';
type Voice = 'male' | 'female';
type TextStyle = 'modern' | 'classic' | 'handwritten';
type TextPosition = 'center' | 'bottom';
type TextMode = 'static' | 'captions';

type ThemeOption = {
  id: string;
  name: string;
  icon: string;
  description: string;
  visualDetails: string; // Specific instructions for prompt generation
};

const THEMES: ThemeOption[] = [
  { 
    id: 'ethereal_light', 
    name: 'Ethereal Light', 
    icon: 'fa-cloud-sun', 
    description: 'Divine, airy, and peaceful.',
    visualDetails: 'Palette: Soft Pastels, White, Gold, Light Blue. Animation: Slow-moving clouds, light leaks, floating dust particles, soft focus blur, dreamy transitions. Mood: Hopeful, Serene.'
  },
  { 
    id: 'midnight_neon', 
    name: 'Midnight Neon', 
    icon: 'fa-bolt', 
    description: 'Bold, modern, and high energy.',
    visualDetails: 'Palette: Deep Black, Neon Blue, Magenta, Cyberpunk Purple. Animation: Glitch effects, fast cuts, glowing geometric shapes, high contrast lighting, futuristic cityscapes. Mood: Intense, Modern.'
  },
  { 
    id: 'vintage_testimony', 
    name: 'Vintage Testimony', 
    icon: 'fa-film', 
    description: 'Nostalgic, warm, and authentic.',
    visualDetails: 'Palette: Sepia, Warm Browns, Faded Film colors. Animation: 16mm film grain, projector flicker, handheld camera shake, retro textures, nostalgic atmosphere. Mood: Nostalgic, Personal.'
  },
  { 
    id: 'nature_psalm', 
    name: 'Nature Psalm', 
    icon: 'fa-leaf', 
    description: 'Grounded, epic, and organic.',
    visualDetails: 'Palette: Earth tones, Forest Green, Sky Blue, Golden Hour sunlight. Animation: Time-lapse nature, flowing water, wind in trees, majestic drone shots, cinematic realism. Mood: Majestic, Grounded.'
  },
  { 
    id: 'gritty_urban', 
    name: 'Urban Truth', 
    icon: 'fa-city', 
    description: 'Raw, real, and impactful.',
    visualDetails: 'Palette: High contrast Black & White, Concrete Grey, Asphalt. Animation: Shadow play, moody street lights, steady cam movement, noir aesthetic, dramatic lighting. Mood: Serious, Raw.'
  },
  { 
    id: 'abstract_spirit', 
    name: 'Abstract Spirit', 
    icon: 'fa-wind', 
    description: 'Mystery, flow, and soul.',
    visualDetails: 'Palette: Iridescent colors, Liquid silvers, Deep Indigo. Animation: Fluid dynamics, morphing shapes, smoke simulations, organic abstract forms, mesmerizing loops. Mood: Spiritual, Mysterious.'
  },
  { 
    id: 'paper_parable', 
    name: 'Paper Parable', 
    icon: 'fa-scroll', 
    description: 'Handcrafted, textured, and simple.',
    visualDetails: 'Palette: Kraft paper, Ink Black, Muted Primary colors. Animation: Stop-motion style, paper cutout layers, textured surfaces, handcrafted feel. Mood: Simple, Educational.'
  },
  { 
    id: 'cosmic_creation', 
    name: 'Cosmic Creation', 
    icon: 'fa-star', 
    description: 'Infinite, majestic, and deep.',
    visualDetails: 'Palette: Deep Space Blue, Nebula Purple, Starlight White. Animation: Slow galaxy rotation, shooting stars, vast scale, celestial bodies, slow cinematic zoom. Mood: Infinite, Awe-inspiring.'
  },
  { 
    id: 'animated_infographic', 
    name: 'Animated Infographic', 
    icon: 'fa-chart-bar', 
    description: 'Clean, data-driven, and crisp.',
    visualDetails: 'Palette: Minimalist White, Slate Grey, Vibrant Accent Colors. Animation: Smooth easing charts, kinetic typography elements (without readable text), geometric data flow, clean lines, modern motion graphics. Mood: Intellectual, Clear.'
  },
  { 
    id: 'abstract_geometry', 
    name: 'Abstract Geometry', 
    icon: 'fa-cubes', 
    description: 'Structured, mathematical, and precise.',
    visualDetails: 'Palette: High contrast, monochromatic with single accent. Animation: Rotating platonic solids, fractals, tessellating patterns, architectural shifts, precise mathematical movement. Mood: Orderly, Complex.'
  },
  { 
    id: 'surreal_dreamscape', 
    name: 'Surreal Dreamscape', 
    icon: 'fa-cloud-moon', 
    description: 'Bizarre, dreamlike, and symbolic.',
    visualDetails: 'Palette: Vivid, unnatural colors, deep shadows. Animation: Floating objects, melting clocks style, impossible physics, juxtapositions of nature and indoor elements, Dali-esque visuals. Mood: Dreamy, Unsettling.'
  }
];

const MOODS = ['Inspiring', 'Convicting', 'Peaceful', 'Intense', 'Joyful', 'Melancholic'];

// Chat/Canvas Types
type MessageType = 
  | 'text' 
  | 'welcome' 
  | 'source-input' 
  | 'quote-select' 
  | 'voice-select' 
  | 'theme-select' 
  | 'mood-select' 
  | 'format-select'
  | 'text-select' 
  | 'confirmation'
  | 'suggestion';

type QuoteData = {
  text: string;
};

type Message = {
  id: string;
  role: 'assistant' | 'user';
  type: MessageType;
  content?: string;
  data?: any; // To hold extracted quotes, selected options, etc.
};

type SubtitleSegment = {
  text: string;
  start: number;
  end: number;
};

// --- Audio Helpers ---
function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function createWavHeader(dataLength: number, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataLength, true);

  return header;
}

// Estimates subtitle timing based on character density since we don't have exact alignment timestamps
const createSmartSubtitles = (fullText: string, totalDuration: number): SubtitleSegment[] => {
  const cleanText = fullText.replace(/\s+/g, ' ').trim();
  const words = cleanText.split(' ');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  
  // Create readable chunks (3-6 words or split by punctuation)
  words.forEach(word => {
    currentChunk.push(word);
    const chunkString = currentChunk.join(' ');
    const endsWithPunctuation = /[.!?]$/.test(word);
    
    // Break chunk if it's long enough or ends a sentence
    if ((chunkString.length > 25 || endsWithPunctuation) && currentChunk.length >= 2) {
      chunks.push(chunkString);
      currentChunk = [];
    } else if (currentChunk.length >= 6) {
      // Force break if too many words
      chunks.push(chunkString);
      currentChunk = [];
    }
  });
  if (currentChunk.length > 0) chunks.push(currentChunk.join(' '));

  // Distribute time based on character count relative to total length
  const totalChars = cleanText.length;
  let currentTime = 0;
  
  return chunks.map(chunk => {
    // Add a small buffer for reading pauses if it's a sentence end
    const chunkLen = chunk.length;
    const duration = (chunkLen / totalChars) * totalDuration;
    
    const segment = {
      text: chunk,
      start: currentTime,
      end: currentTime + duration
    };
    currentTime += duration;
    return segment;
  });
};

// --- Sub-components ---

const SourceInput = ({ onSubmit, isLoading }: { onSubmit: (text: string) => void, isLoading: boolean }) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setText(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a full sermon transcript OR simply type the exact quote you want to use..."
        className="w-full h-32 bg-gray-900 border border-gray-700 rounded p-3 text-white focus:outline-none focus:border-blue-500 text-sm resize-none placeholder-gray-500"
      />
      
      <div className="flex gap-2">
         <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <i className="fas fa-file-upload"></i> Upload .txt
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".txt" 
            onChange={handleFileUpload}
          />
          
          <button
            onClick={() => onSubmit(text)}
            disabled={isLoading || !text.trim()}
            className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-md"
          >
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
            Process Input
          </button>
      </div>
      <div className="text-xs text-gray-500 text-center">AI will auto-detect if it's a quote or transcript</div>
    </div>
  );
};

const QuoteSelect = ({ quotes, onSelect }: { quotes: QuoteData[], onSelect: (q: QuoteData) => void }) => (
  <div className="grid gap-3">
    {quotes.map((quote, idx) => (
      <div 
        key={idx}
        onClick={() => onSelect(quote)}
        className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-lg cursor-pointer transition-all text-sm leading-relaxed group"
      >
        <div className="text-gray-200 mb-2">"{quote.text}"</div>
      </div>
    ))}
  </div>
);

const VoiceSelect = ({ onSelect, selected }: { onSelect: (v: Voice) => void, selected?: Voice }) => (
  <div className="flex gap-4">
    {['male', 'female'].map((v) => (
      <button
        key={v}
        onClick={() => onSelect(v as Voice)}
        className={`flex-1 p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${
          selected === v 
            ? 'bg-blue-600 border-blue-400 text-white' 
            : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'
        }`}
      >
        <i className={`fas fa-${v === 'male' ? 'mars' : 'venus'} text-2xl`}></i>
        <span className="capitalize">{v} Voice</span>
      </button>
    ))}
  </div>
);

const ThemeSelect = ({ onSelect, selectedId }: { onSelect: (id: string) => void, selectedId?: string }) => (
  <div className="grid grid-cols-2 gap-3">
    {THEMES.map((theme) => (
      <button
        key={theme.id}
        onClick={() => onSelect(theme.id)}
        className={`p-3 rounded-lg border text-left transition-all ${
          selectedId === theme.id
            ? 'bg-purple-900/50 border-purple-400'
            : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <i className={`fas ${theme.icon} ${selectedId === theme.id ? 'text-purple-300' : 'text-gray-400'}`}></i>
          <span className="font-semibold text-sm">{theme.name}</span>
        </div>
        <p className="text-xs text-gray-400 line-clamp-2">{theme.description}</p>
      </button>
    ))}
  </div>
);

const MoodSelect = ({ onSelect, selected }: { onSelect: (m: string) => void, selected?: string }) => (
  <div className="flex flex-wrap gap-2">
    {MOODS.map((mood) => (
      <button
        key={mood}
        onClick={() => onSelect(mood)}
        className={`px-4 py-2 rounded-full text-sm border transition-all ${
          selected === mood
            ? 'bg-pink-600 border-pink-400 text-white'
            : 'bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300'
        }`}
      >
        {mood}
      </button>
    ))}
  </div>
);

const FormatSelect = ({ 
  aspectRatio, 
  resolution, 
  onChange 
}: { 
  aspectRatio: AspectRatio, 
  resolution: Resolution, 
  onChange: (ar: AspectRatio, res: Resolution) => void 
}) => (
  <div className="flex flex-col gap-4">
    <div>
      <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wider">Aspect Ratio</label>
      <div className="flex gap-3">
        {(['9:16', '16:9'] as AspectRatio[]).map((ar) => (
          <button
            key={ar}
            onClick={() => onChange(ar, resolution)}
            className={`flex-1 p-3 rounded border text-center transition-all ${
              aspectRatio === ar ? 'bg-gray-700 border-white' : 'bg-gray-800 border-gray-700'
            }`}
          >
            <i className={`fas fa-${ar === '9:16' ? 'mobile-alt' : 'tv'} mb-2 text-xl block`}></i>
            {ar}
          </button>
        ))}
      </div>
    </div>
    <div>
      <label className="text-xs text-gray-400 mb-2 block uppercase tracking-wider">Resolution</label>
      <div className="flex gap-3">
        {(['720p', '1080p'] as Resolution[]).map((res) => (
          <button
            key={res}
            onClick={() => onChange(aspectRatio, res)}
            className={`flex-1 p-2 rounded border text-sm transition-all ${
              resolution === res ? 'bg-gray-700 border-white' : 'bg-gray-800 border-gray-700'
            }`}
          >
            {res}
          </button>
        ))}
      </div>
    </div>
  </div>
);

const TextSelect = ({
  config,
  onChange,
  onConfirm
}: {
  config: { enabled: boolean; style: TextStyle; position: TextPosition; mode: TextMode };
  onChange: (updates: Partial<{ enabled: boolean; style: TextStyle; position: TextPosition; mode: TextMode }>) => void;
  onConfirm: () => void;
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between bg-gray-800 p-3 rounded-lg border border-gray-700">
      <span className="text-sm font-medium">Show Text Overlay</span>
      <button
        onClick={() => onChange({ enabled: !config.enabled })}
        className={`w-12 h-6 rounded-full p-1 transition-colors ${config.enabled ? 'bg-blue-600' : 'bg-gray-600'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>

    {config.enabled && (
      <div className="space-y-3 p-3 bg-gray-800 rounded-lg border border-gray-700 animate-fadeIn">
        <div>
           <label className="text-xs text-gray-400 block mb-2">Overlay Mode</label>
           <div className="flex gap-2">
             <button 
               onClick={() => onChange({ mode: 'static' })}
               className={`flex-1 py-2 text-xs border rounded transition-all flex items-center justify-center gap-2 ${
                 config.mode === 'static' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-transparent border-gray-600 text-gray-400'
               }`}
             >
               <i className="fas fa-quote-left"></i> Static Quote
             </button>
             <button 
               onClick={() => onChange({ mode: 'captions' })}
               className={`flex-1 py-2 text-xs border rounded transition-all flex items-center justify-center gap-2 ${
                 config.mode === 'captions' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-transparent border-gray-600 text-gray-400'
               }`}
             >
               <i className="fas fa-closed-captioning"></i> Synced Captions
             </button>
           </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">Typography Style</label>
          <div className="flex gap-2">
            {[
              { id: 'modern', label: 'Modern', font: 'font-sans' },
              { id: 'classic', label: 'Classic', font: 'font-serif' },
              { id: 'handwritten', label: 'Script', font: 'font-cursive' }
            ].map(s => (
              <button
                key={s.id}
                onClick={() => onChange({ style: s.id as TextStyle })}
                className={`flex-1 py-2 text-xs border rounded transition-all ${
                  config.style === s.id ? 'bg-gray-700 border-white text-white' : 'bg-transparent border-gray-600 text-gray-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">Position</label>
          <div className="flex gap-2">
            {[
              { id: 'center', icon: 'align-center' },
              { id: 'bottom', icon: 'arrow-down' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => onChange({ position: p.id as TextPosition })}
                className={`flex-1 py-2 border rounded transition-all ${
                  config.position === p.id ? 'bg-gray-700 border-white text-white' : 'bg-transparent border-gray-600 text-gray-400'
                }`}
              >
                <i className={`fas fa-${p.icon}`}></i>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    <button
      onClick={onConfirm}
      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-sm transition-colors"
    >
      Continue
    </button>
  </div>
);

const Confirmation = ({ config, onGenerate }: { config: any, onGenerate: () => void }) => {
  const theme = THEMES.find(t => t.id === config.themeId);
  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-4">
      <h3 className="font-semibold text-lg text-white">Ready to create?</h3>
      <div className="space-y-2 text-sm text-gray-300">
        <div className="flex justify-between border-b border-gray-700 pb-1">
          <span>Voice</span> <span className="text-white capitalize">{config.voice}</span>
        </div>
        <div className="flex justify-between border-b border-gray-700 pb-1">
          <span>Theme</span> <span className="text-white">{theme?.name}</span>
        </div>
        <div className="flex justify-between border-b border-gray-700 pb-1">
          <span>Mood</span> <span className="text-white">{config.mood}</span>
        </div>
        <div className="flex justify-between border-b border-gray-700 pb-1">
          <span>Format</span> <span className="text-white">{config.aspectRatio} @ {config.resolution}</span>
        </div>
         <div className="flex justify-between border-b border-gray-700 pb-1">
          <span>Overlay</span> <span className="text-white">
            {config.textOverlay?.enabled 
              ? `${config.textOverlay.mode === 'captions' ? 'Synced Captions' : 'Static'} (${config.textOverlay.style})` 
              : 'None'}
          </span>
        </div>
      </div>
      <button 
        onClick={onGenerate}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 rounded-lg shadow-lg transform transition hover:scale-[1.02]"
      >
        Generate Clip
      </button>
    </div>
  );
};

const Suggestion = ({ data, onApply }: { data: any, onApply: (c: any) => void }) => (
  <div className="bg-indigo-900/40 border border-indigo-500/50 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center">
        <i className="fas fa-lightbulb text-white text-xs"></i>
      </div>
      <div>
        <h4 className="font-bold text-indigo-200 text-sm mb-1">AI Suggestion</h4>
        <p className="text-gray-300 text-xs mb-3">{data.reason}</p>
        <button 
          onClick={() => onApply(data.updates)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded transition-colors"
        >
          Apply: {data.summary}
        </button>
      </div>
    </div>
  </div>
);

// --- Main App ---

const App = () => {
  // State
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', type: 'welcome', content: "Welcome to SermonClip AI. To begin, please paste your sermon transcript, a specific quote, or upload a .txt file." },
    { id: '2', role: 'assistant', type: 'source-input' }
  ]);
  const [step, setStep] = useState<'source' | 'quote' | 'voice' | 'theme' | 'mood' | 'format' | 'text' | 'confirm' | 'generating' | 'done'>('source');
  
  // Configuration State
  const [config, setConfig] = useState({
    quote: '',
    voice: 'male' as Voice,
    themeId: 'ethereal_light',
    mood: 'Inspiring',
    aspectRatio: '9:16' as AspectRatio,
    resolution: '720p' as Resolution,
    textOverlay: {
      enabled: true,
      style: 'modern' as TextStyle,
      position: 'center' as TextPosition,
      mode: 'static' as TextMode
    }
  });

  // Generation State
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  // Refactored Video Data to support Dynamic Asset Sequencing
  const [videoData, setVideoData] = useState<{ sequence: string[], audioUrl: string, subtitles: SubtitleSegment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Playback State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync Audio/Video
  const togglePlay = () => {
    if (!videoRef.current || !audioRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      audioRef.current.pause();
    } else {
      videoRef.current.play();
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVideoEnded = () => {
    // Dynamic Asset Sequencing Logic
    if (videoData && currentClipIndex < videoData.sequence.length - 1) {
      // Advance to next clip in sequence
      setCurrentClipIndex(prev => prev + 1);
      // Note: The useEffect on currentClipIndex will trigger play()
    } else {
      // Loop back to start if it's the last clip
      setCurrentClipIndex(0);
    }
  }

  // Auto-play when clip index changes if we were already playing
  useEffect(() => {
    if (isPlaying && videoRef.current) {
      videoRef.current.play().catch(e => console.log("Auto-play interrupted", e));
    }
  }, [currentClipIndex]);
  
  const handleAudioEnded = () => {
     if(audioRef.current) {
        audioRef.current.currentTime = 0;
     }
     // Reset video sequence
     setCurrentClipIndex(0);
     if(videoRef.current) {
         videoRef.current.currentTime = 0;
         videoRef.current.pause();
     }
     setIsPlaying(false);
     setCurrentTime(0);
  }

  const getCurrentSubtitle = () => {
    if (!videoData?.subtitles || !currentTime) return "";
    const currentSeg = videoData.subtitles.find(
      seg => currentTime >= seg.start && currentTime <= seg.end
    );
    return currentSeg ? currentSeg.text : "";
  }

  // --- Logic Handlers ---

  const addMessage = (msg: Message) => setMessages(prev => [...prev, msg]);

  const handleProcessSource = async (input: string) => {
    setLoading(true);
    setLoadingText('Processing your source text...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `
        Analyze the following input text: "${input.substring(0, 20000)}... (truncated if too long)".
        
        Task:
        1. If the input is a long transcript/sermon: Extract 5-6 powerful, viral-worthy, emotionally resonant quotes suitable for a short social media video.
        2. If the input is a short text (likely a direct quote): Simply clean it up if needed and return it as the single option.
        
        CRITICAL RULES:
        1. QUOTES MUST BE VERBATIM from the text provided.
        2. Focus on "Biblical Truths" or "Inspiring Messages".
        
        Return ONLY a JSON array of objects with key: "text" (string).
        Example: [{"text": "Faith is not about everything turning out okay..."}]
        Do not include markdown code blocks.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let cleanText = response.text?.trim() || "[]";
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```/g, '');
      }

      const quotes = JSON.parse(cleanText);
      
      setStep('quote');
      
      addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: input.length > 50 ? "Transcript uploaded" : `Input: "${input}"` });
      addMessage({ 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        type: 'quote-select', 
        data: quotes 
      });

    } catch (e: any) {
      console.error(e);
      // Fallback/Error flow
      let errorMessage: string = "An error occurred";
      if (e instanceof Error) errorMessage = e.message;

      // In case of total failure, we can assume the user input was a quote if short
      if (input.length < 300) {
        const fallbackQuotes = [{ text: input }];
        setStep('quote');
        addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: input });
        addMessage({ 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          type: 'quote-select', 
          data: fallbackQuotes 
        });
      } else {
        setError("Failed to process text. Please try a shorter segment or check the format.");
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopilotCommand = async (text: string) => {
    // If we are at the start, treat text as source input
    if (step === 'source') {
      handleProcessSource(text);
      return;
    }

    // Otherwise, use AI to interpret command
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
      User says: "${text}".
      Current Step: ${step}.
      Current Config: ${JSON.stringify(config)}.
      Available Themes: ${THEMES.map(t => t.id).join(', ')}.
      Available Moods: ${MOODS.join(', ')}.
      
      Interpret the user's intent. 
      If they want to change a setting (voice, theme, mood, etc.), return a JSON object with "updates" (Partial<Config>) and "response" (string).
      If they want to proceed, return "action": "next".
      If they want to restart, return "action": "restart".
      
      JSON Only. No markdown.
    `;
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      let cleanText = response.text?.trim() || "[]";
      if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '');
      const result = JSON.parse(cleanText);

      addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: text });

      if (result.updates) {
        setConfig(prev => ({ ...prev, ...result.updates }));
        addMessage({ id: (Date.now()+1).toString(), role: 'assistant', type: 'text', content: (result.response as string) || "Updated." });
      } else if (result.action === 'restart') {
        window.location.reload();
      } else {
        addMessage({ id: (Date.now()+1).toString(), role: 'assistant', type: 'text', content: "I didn't quite catch that. Could you clarify?" });
      }
    } catch(e) {
      console.error(e);
    }
  };

  const generateClip = async () => {
    setLoading(true);
    setLoadingText('Recording voiceover...');
    setStep('generating');
    setError(null);
    setVideoData(null);
    setCurrentClipIndex(0);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const theme = THEMES.find(t => t.id === config.themeId);

      // --- STEP 1: GENERATE AUDIO FIRST TO GET DURATION ---
      const audioPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: `Read this quote with a ${config.mood.toLowerCase()}, ${config.voice} voice: "${config.quote}"`,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { 
                voiceName: config.voice === 'male' ? 'Fenrir' : 'Aoede' 
              }
            }
          }
        }
      });
      
      const audioResp = await audioPromise;

      let audioBlobUrl = '';
      let audioDurationSeconds = 0;
      let subtitles: SubtitleSegment[] = [];

      if (audioResp.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        const pcmData = base64ToUint8Array(audioResp.candidates[0].content.parts[0].inlineData.data);
        
        // Calculate duration: numSamples / sampleRate
        // Default sample rate for Gemini TTS is usually 24000
        const sampleRate = 24000;
        const numChannels = 1;
        const bytesPerSample = 2; // 16-bit
        audioDurationSeconds = pcmData.length / (sampleRate * numChannels * bytesPerSample); // 2 bytes per sample (16-bit) but we are using Uint8Array so it is bytes directly? 
        // No, pcmData is Uint8Array of bytes. 
        // Total bytes / (24000 samples/sec * 2 bytes/sample) = seconds.
        audioDurationSeconds = pcmData.length / 48000;

        const wavHeader = createWavHeader(pcmData.length);
        const wavBytes = new Uint8Array(wavHeader.byteLength + pcmData.byteLength);
        wavBytes.set(new Uint8Array(wavHeader), 0);
        wavBytes.set(pcmData, wavHeader.byteLength);
        
        const audioBlob = new Blob([wavBytes], { type: 'audio/wav' });
        audioBlobUrl = URL.createObjectURL(audioBlob);
        
        // Generate Subtitle Timings
        subtitles = createSmartSubtitles(config.quote, audioDurationSeconds);

      } else {
        throw new Error("Failed to generate audio.");
      }

      // --- STEP 2: STORYBOARD & CALCULATE CLIPS NEEDED ---
      setLoadingText(`Storyboarding visuals for ${Math.ceil(audioDurationSeconds)}s of audio...`);

      // Veo clips are typically short (assume ~5-6 seconds useful length for smooth transition)
      const CLIP_LENGTH = 5; 
      const clipsNeeded = Math.ceil(audioDurationSeconds / CLIP_LENGTH);
      
      // Generate prompts for ALL clips at once using Gemini Flash to ensure consistency
      const storyboardResp = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `
          Role: Cinematic Storyteller.
          Task: Create ${clipsNeeded} distinct but visually cohesive video prompts for Veo.
          Theme: ${theme?.name} (${theme?.visualDetails})
          Mood: ${config.mood}
          Format: ${config.aspectRatio}
          
          Guidelines:
          - The prompts should form a sequence (e.g., establishing shot -> detail -> action).
          - Use visual metaphors matching: "${config.quote.substring(0, 100)}..."
          - Ensure they look like they belong in the same video.
          - No text in video.
          
          Return ONLY a JSON array of strings. 
          Example: ["Wide shot of...", "Close up of..."]
        `
      });

      let cleanPromptText = storyboardResp.text?.trim() || "[]";
      if (cleanPromptText.startsWith('```json')) cleanPromptText = cleanPromptText.replace(/```json/g, '').replace(/```/g, '');
      const prompts = JSON.parse(cleanPromptText);
      
      // Fallback if AI returns fewer prompts than needed
      while (prompts.length < clipsNeeded) {
        prompts.push(prompts[0]);
      }

      // --- STEP 3: PARALLEL VIDEO GENERATION ---
      setLoadingText(`Filming ${clipsNeeded} scenes simultaneously...`);

      const videoPromises = prompts.map(async (prompt: string) => {
          let videoOp = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
              numberOfVideos: 1,
              resolution: config.resolution,
              aspectRatio: config.aspectRatio
            }
          });

          // Poll Video
          let operation = videoOp;
          while (operation.done !== true) {
             await new Promise(r => setTimeout(r, 4000)); 
             operation = await ai.operations.getVideosOperation({ operation: operation });
          }
          
          if (operation.error) throw new Error(String(operation.error.message));
          
          const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (!videoUri) throw new Error("Missing video URI");

          const vidRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
          const vidBlob = await vidRes.blob();
          return URL.createObjectURL(vidBlob);
      });

      const videoUrls = await Promise.all(videoPromises);

      setVideoData({ sequence: videoUrls, audioUrl: audioBlobUrl, subtitles });
      setStep('done');

      // 4. Generate Suggestion
      const suggestionResp = await ai.models.generateContent({
         model: 'gemini-2.5-flash',
         contents: `
           Based on the quote "${config.quote}" and the current theme "${theme?.name}", 
           suggest ONE creative variation (different theme, voice, or mood) that might also work well.
           Return JSON: { "summary": "Try x...", "reason": "Because...", "updates": {...config updates} }
           No markdown.
         `
      });
      let suggText = suggestionResp.text?.trim() || "{}";
      if (suggText.startsWith('```json')) suggText = suggText.replace(/```json/g, '').replace(/```/g, '');
      else if (suggText.startsWith('```')) suggText = suggText.replace(/```/g, '');
      
      let suggestion;
      try {
        suggestion = JSON.parse(suggText);
      } catch (e) {
        suggestion = { summary: "Try a different theme", reason: "For variety", updates: {} };
      }
      
      addMessage({ id: Date.now().toString(), role: 'assistant', type: 'suggestion', data: suggestion });

    } catch (err: unknown) {
      console.error(err);
      let errorMessage: string = "An error occurred";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else {
        errorMessage = String(err);
      }
      setError("Failed to generate clip: " + errorMessage);
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0f0f10] text-gray-200 overflow-hidden font-sans">
      
      {/* LEFT COLUMN: Conversational Interface */}
      <div className="w-full md:w-1/2 lg:w-5/12 flex flex-col border-r border-gray-800 bg-[#131316]">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <i className="fas fa-cross text-white"></i>
          </div>
          <h1 className="font-bold text-lg tracking-tight">SermonClip AI</h1>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
              
              {msg.role === 'assistant' && (
                 <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center mr-3 flex-shrink-0 border border-blue-500/20">
                   <i className="fas fa-robot text-blue-400 text-xs"></i>
                 </div>
              )}

              <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm' : 'space-y-3'}`}>
                
                {msg.content && <p className="leading-relaxed text-sm">{msg.content}</p>}

                {/* Dynamic Widgets based on message type */}
                {msg.type === 'source-input' && (
                  <SourceInput onSubmit={handleProcessSource} isLoading={loading} />
                )}

                {msg.type === 'quote-select' && msg.data && (
                  <QuoteSelect 
                    quotes={msg.data} 
                    onSelect={(q) => {
                      setConfig(prev => ({ ...prev, quote: q.text }));
                      setStep('voice');
                      addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: `Selected: "${q.text.substring(0,30)}..."` });
                      addMessage({ id: (Date.now()+1).toString(), role: 'assistant', type: 'voice-select' });
                    }}
                  />
                )}

                {msg.type === 'voice-select' && (
                  <VoiceSelect 
                    selected={config.voice}
                    onSelect={(v) => {
                      setConfig(prev => ({ ...prev, voice: v }));
                      setStep('theme');
                      addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: `${v} voice` });
                      addMessage({ id: (Date.now()+1).toString(), role: 'assistant', type: 'theme-select' });
                    }} 
                  />
                )}

                {msg.type === 'theme-select' && (
                  <ThemeSelect
                    selectedId={config.themeId}
                    onSelect={(id) => {
                      setConfig(prev => ({ ...prev, themeId: id }));
                      setStep('mood');
                      const name = THEMES.find(t => t.id === id)?.name || "Selected Theme";
                      addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: name });
                      addMessage({ id: (Date.now()+1).toString(), role: 'assistant', type: 'mood-select' });
                    }}
                  />
                )}

                {msg.type === 'mood-select' && (
                   <MoodSelect 
                     selected={config.mood}
                     onSelect={(m) => {
                       setConfig(prev => ({ ...prev, mood: m }));
                       setStep('format');
                       addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: m });
                       addMessage({ id: (Date.now()+1).toString(), role: 'assistant', type: 'format-select' });
                     }}
                   />
                )}

                {msg.type === 'format-select' && (
                   <div>
                     <FormatSelect 
                       aspectRatio={config.aspectRatio}
                       resolution={config.resolution}
                       onChange={(ar, res) => {
                         setConfig(prev => ({ ...prev, aspectRatio: ar, resolution: res }));
                       }}
                     />
                     <button 
                       onClick={() => {
                          setStep('text');
                          addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: `${config.aspectRatio}, ${config.resolution}` });
                          addMessage({ id: (Date.now()+1).toString(), role: 'assistant', type: 'text-select' });
                       }}
                       className="mt-3 w-full py-2 bg-blue-600 rounded text-sm hover:bg-blue-500"
                     >
                       Confirm Format
                     </button>
                   </div>
                )}

                {msg.type === 'text-select' && (
                  <TextSelect 
                    config={config.textOverlay}
                    onChange={(updates) => setConfig(prev => ({ ...prev, textOverlay: { ...prev.textOverlay, ...updates } }))}
                    onConfirm={() => {
                       setStep('confirm');
                       addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: config.textOverlay.enabled ? (config.textOverlay.mode === 'captions' ? 'Synced Captions' : 'Static Text') : 'No Text' });
                       addMessage({ id: (Date.now()+1).toString(), role: 'assistant', type: 'confirmation' });
                    }}
                  />
                )}

                {msg.type === 'confirmation' && (
                  <Confirmation config={config} onGenerate={generateClip} />
                )}

                {msg.type === 'suggestion' && (
                  <Suggestion data={msg.data} onApply={(updates) => {
                     setConfig(prev => ({ ...prev, ...updates }));
                     addMessage({ id: Date.now().toString(), role: 'user', type: 'text', content: "Applied suggestion." });
                     generateClip();
                  }} />
                )}

              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input / Copilot */}
        <div className="p-4 border-t border-gray-800 bg-[#131316]">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Type to chat, change settings, or paste text..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:border-blue-500 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                   handleCopilotCommand(e.currentTarget.value);
                   e.currentTarget.value = '';
                }
              }}
            />
            <button className="absolute right-3 top-3 text-gray-400 hover:text-white">
              <i className="fas fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Preview & Player */}
      <div className="hidden md:flex flex-1 bg-black items-center justify-center relative p-8">
        
        {loading && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
              Creating Masterpiece
            </h2>
            <p className="text-gray-400 animate-pulse">{loadingText}</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-8">
            <div className="max-w-md text-center">
              <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
              <h3 className="text-xl font-bold mb-2">Generation Failed</h3>
              <p className="text-gray-400 mb-6">{error}</p>
              <button onClick={() => setStep('confirm')} className="px-6 py-2 bg-gray-700 rounded hover:bg-gray-600">
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Player Container */}
        <div 
          className="relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col items-center justify-center"
          style={{
            aspectRatio: config.aspectRatio === '9:16' ? '9/16' : '16/9',
            height: config.aspectRatio === '9:16' ? '80vh' : 'auto',
            width: config.aspectRatio === '16:9' ? '80%' : 'auto'
          }}
        >
          {videoData ? (
            <>
              {/* HTML Overlay for Text - No Hallucinations */}
              {config.textOverlay.enabled && (
                <div className={`absolute inset-0 z-20 flex p-8 pointer-events-none
                   ${config.textOverlay.position === 'center' ? 'items-center justify-center' : 'items-end justify-center pb-16'}
                `}>
                  {config.textOverlay.mode === 'captions' ? (
                     // Dynamic Captions
                     <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg pointer-events-auto transition-all duration-200">
                       <h2 className={`
                          text-white text-center font-bold tracking-tight
                          ${config.aspectRatio === '9:16' ? 'text-xl' : 'text-2xl'}
                       `}>
                          {getCurrentSubtitle()}
                       </h2>
                     </div>
                  ) : (
                    // Static Quote
                    <h2 className={`
                      text-white drop-shadow-xl text-center max-w-[90%] pointer-events-auto
                      ${config.textOverlay.style === 'modern' ? 'font-sans font-bold uppercase tracking-tight' : ''}
                      ${config.textOverlay.style === 'classic' ? 'font-serif font-medium tracking-wide italic' : ''}
                      ${config.textOverlay.style === 'handwritten' ? 'font-cursive font-normal' : ''} 
                      ${config.aspectRatio === '9:16' ? 'text-2xl leading-snug' : 'text-3xl leading-snug'}
                    `}
                    style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
                    >
                      "{config.quote}"
                    </h2>
                  )}
                </div>
              )}

              <video 
                ref={videoRef}
                src={videoData.sequence[currentClipIndex]} 
                className="w-full h-full object-cover" 
                playsInline
                muted // Muted to allow separate audio track
                onEnded={handleVideoEnded}
              />
              <audio 
                ref={audioRef}
                src={videoData.audioUrl}
                onEnded={handleAudioEnded}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              />
              
              {/* Clip Indicator */}
              {videoData.sequence.length > 1 && (
                <div className="absolute top-4 left-4 z-20 flex gap-1">
                  {videoData.sequence.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1 rounded-full transition-all ${idx === currentClipIndex ? 'w-6 bg-white' : 'w-2 bg-white/30'}`}
                    />
                  ))}
                </div>
              )}

              {/* Player Controls */}
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 flex gap-4">
                 <button 
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 flex items-center justify-center transition-all"
                 >
                   <i className={`fas fa-${isPlaying ? 'pause' : 'play'} text-white`}></i>
                 </button>
              </div>

              {/* Download Actions */}
              <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
                 <a 
                   href={videoData.sequence[0]} 
                   download="clip_01.mp4"
                   className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 flex items-center justify-center text-white transition-all tooltip-trigger"
                   title="Download First Clip"
                 >
                   <i className="fas fa-video"></i>
                 </a>
                 <a 
                   href={videoData.audioUrl} 
                   download="sermon-clip-audio.wav"
                   className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 flex items-center justify-center text-white transition-all tooltip-trigger"
                   title="Download Audio"
                 >
                   <i className="fas fa-music"></i>
                 </a>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500">
               <div className="w-16 h-16 rounded-full bg-gray-800 mx-auto mb-4 flex items-center justify-center">
                 <i className="fas fa-film text-2xl"></i>
               </div>
               <p>Preview will appear here</p>
               <p className="text-xs mt-2 opacity-50">Configure your settings to start</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
