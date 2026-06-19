import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Link, 
  Send, 
  Video, 
  Music, 
  Globe, 
  History, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Play,
  Volume2
} from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hey! 🎬 I'm your UGC video copywriter and editor. Give me a pitch and a website link, and I will write Gen-Z style copy, grab stock footage & reaction GIFs, mix trending audio, and compile a viral 9:16 short for you in seconds! 🚀",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [pitchInput, setPitchInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePollId, setActivePollId] = useState(null);
  const [currentProgress, setCurrentProgress] = useState(null);

  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Fetch video generation history
  const fetchVideos = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/videos`);
      const data = await res.json();
      setVideos(data);
      // Select the first completed video as default if none selected
      if (data.length > 0 && !selectedVideo) {
        const firstCompleted = data.find(v => v.status === 'completed');
        if (firstCompleted) setSelectedVideo(firstCompleted);
      }
    } catch (err) {
      console.error('Failed to load video list:', err);
    }
  };

  useEffect(() => {
    fetchVideos();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Auto scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentProgress]);

  // Status-to-Step mapping helper
  const getStepStatus = (status, targetStep) => {
    const steps = ['scraping', 'planning', 'downloading', 'rendering', 'completed'];
    const currentIdx = steps.indexOf(status);
    const targetIdx = steps.indexOf(targetStep);

    if (status === 'failed') return 'failed';
    if (currentIdx > targetIdx) return 'completed';
    if (currentIdx === targetIdx) return 'active';
    return 'pending';
  };

  // Start polling backend status for a specific video ID
  const startPolling = (id) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setActivePollId(id);
    setIsGenerating(true);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/videos/${id}`);
        if (!res.ok) throw new Error('Video record not found');
        
        const video = await res.json();
        setCurrentProgress(video);

        // Update the active polling widget state in messages
        setMessages(prev => {
          return prev.map(msg => {
            if (msg.videoRecordId === id) {
              return {
                ...msg,
                status: video.status,
                videoRecord: video
              };
            }
            return msg;
          });
        });

        // Check if finished
        if (video.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          setIsGenerating(false);
          setActivePollId(null);
          setCurrentProgress(null);
          setSelectedVideo(video);
          
          setMessages(prev => [
            ...prev,
            {
              id: `done-${id}-${Date.now()}`,
              sender: 'bot',
              text: `✨ Done! Your UGC short is ready. "${video.productName || 'Your product'}" is going to be viral. 📈 Check the interactive phone preview on the right!`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          
          fetchVideos();
        } else if (video.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setIsGenerating(false);
          setActivePollId(null);
          setCurrentProgress(null);
          
          setMessages(prev => [
            ...prev,
            {
              id: `fail-${id}-${Date.now()}`,
              sender: 'bot',
              text: `❌ Oh no, rendering failed: ${video.error || 'Unknown rendering engine error'}`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          
          fetchVideos();
        }
      } catch (err) {
        console.error('Error during polling:', err);
        clearInterval(pollIntervalRef.current);
        setIsGenerating(false);
        setActivePollId(null);
      }
    }, 2000);
  };

  // Submit new generation request
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!pitchInput.trim() || isGenerating) return;

    const userMessageText = `Pitch: "${pitchInput}"${urlInput ? `\nWebsite: ${urlInput}` : ''}`;
    const newMsgId = `gen-${Date.now()}`;
    
    // Append User Message
    setMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: userMessageText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    const description = pitchInput;
    const url = urlInput;
    
    setPitchInput('');
    setUrlInput('');

    try {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, url })
      });

      if (!response.ok) {
        throw new Error('Failed to schedule video rendering');
      }

      const initialRecord = await response.json();
      
      // Append Bot Loading Message with widget metadata
      setMessages(prev => [
        ...prev,
        {
          id: newMsgId,
          sender: 'bot',
          text: `Starting assets collection and layout assembly for your product...`,
          isWidget: true,
          videoRecordId: initialRecord._id,
          status: 'scraping',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      startPolling(initialRecord._id);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'bot',
          text: `Oops, could not connect to server: ${err.message}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  return (
    <div className="app-container">
      
      {/* Sidebar - History */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <History className="text-purple-400" size={20} />
          <h1 className="sidebar-title">UGC Creator Studio</h1>
        </div>
        
        <div className="history-list">
          {videos.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs text-gray-500">
              No videos generated yet. Submit a pitch to start!
            </div>
          ) : (
            videos.map(vid => {
              const dateStr = new Date(vid.createdAt).toLocaleDateString([], { 
                month: 'short', 
                day: 'numeric' 
              });
              const isSelected = selectedVideo && selectedVideo._id === vid._id;
              
              return (
                <div 
                  key={vid._id}
                  className={`history-card ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedVideo(vid)}
                >
                  <div className="history-card-title">
                    {vid.productName || 'Analyzing Idea...'}
                  </div>
                  <div className="history-card-desc">
                    {vid.selectedHook || vid.productDescription}
                  </div>
                  <div className="history-card-meta">
                    <span>{dateStr}</span>
                    <span className={`badge badge-${vid.status}`}>
                      {vid.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-workspace">
        
        {/* Chat Thread */}
        <section className="chat-panel">
          <div className="sidebar-header" style={{ borderRight: 'none' }}>
            <Sparkles className="text-purple-500 spinner" size={20} />
            <h2 className="font-semibold text-sm tracking-wider uppercase text-purple-400">
              AI Creative Pipeline
            </h2>
          </div>

          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
                <div className="message-sender">
                  {msg.sender === 'user' ? 'Me' : 'UGC Director'}
                </div>
                <div className="message-bubble">
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  
                  {/* Status Steps Widget */}
                  {msg.isWidget && (
                    <div className="status-widget">
                      
                      <div className={`status-step ${getStepStatus(msg.status, 'scraping')}`}>
                        <div className="status-indicator" />
                        <span>1. Extracting URL website meta-data</span>
                      </div>

                      <div className={`status-step ${getStepStatus(msg.status, 'planning')}`}>
                        <div className="status-indicator" />
                        <span>
                          2. Planning Gen-Z hooks & asset tags 
                          {msg.videoRecord?.productName && ` (${msg.videoRecord.productName})`}
                        </span>
                      </div>

                      <div className={`status-step ${getStepStatus(msg.status, 'downloading')}`}>
                        <div className="status-indicator" />
                        <span>3. Searching vertical stock video & GIF</span>
                      </div>

                      <div className={`status-step ${getStepStatus(msg.status, 'rendering')}`}>
                        <div className="status-indicator" />
                        <span>4. Screenshotting transparent caption bubble</span>
                      </div>

                      <div className={`status-step ${getStepStatus(msg.status, 'completed')}`}>
                        <div className="status-indicator" />
                        <span>5. Compositing audio/video tracks in FFmpeg</span>
                      </div>

                      {msg.status === 'failed' && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-rose-500 font-medium">
                          <AlertCircle size={14} />
                          <span>Pipeline crashed. Check details.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Form input */}
          <div className="chat-input-bar">
            <form onSubmit={handleGenerate} className="chat-input-form">
              <textarea
                value={pitchInput}
                onChange={e => setPitchInput(e.target.value)}
                placeholder="Pitch your product... (e.g. A lo-fi alarm clock that simulates sunrise and plays soft bird sounds)"
                className="chat-textarea"
                required
                disabled={isGenerating}
              />
              <div className="chat-url-row">
                <Globe className="chat-url-icon" size={16} />
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="Website URL (optional)"
                  className="chat-url-input"
                  disabled={isGenerating}
                />
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={isGenerating || !pitchInput.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Editing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Produce Video</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Video Mockup Preview */}
        <section className="preview-panel">
          <div className="phone-mockup">
            {selectedVideo && selectedVideo.status === 'completed' && selectedVideo.videoPath ? (
              <video 
                key={selectedVideo._id}
                src={`${API_BASE}${selectedVideo.videoPath}`}
                controls
                autoPlay
                loop
                playsInline
                className="ugc-video"
              />
            ) : (
              <div className="video-placeholder-container">
                <div className="video-placeholder-circle">
                  {isGenerating ? (
                    <Loader2 size={36} className="text-purple-500 spinner" />
                  ) : (
                    <Video size={36} className="text-gray-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-2 text-gray-300">
                    {isGenerating ? 'Rendering UGC Video...' : 'No Video Loaded'}
                  </h3>
                  <p className="text-xs text-gray-500 max-w-[200px] leading-relaxed">
                    {isGenerating 
                      ? 'Compiling background stock loops, transparent text cards, viral reaction GIFs, and audio filters in the cloud...' 
                      : 'Choose an item from the history or submit a product pitch to preview your custom social media short!'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {selectedVideo && (
            <div className="video-details-card glass-panel">
              <div>
                <div className="detail-label">Concept Name</div>
                <div className="detail-value font-semibold text-purple-400">
                  {selectedVideo.productName || 'Planning...'}
                </div>
              </div>
              
              <div>
                <div className="detail-label">Selected Hook Copy</div>
                <div className="detail-value italic">
                  {selectedVideo.selectedHook ? `"${selectedVideo.selectedHook}"` : 'Analyzing pitch...'}
                </div>
              </div>

              <div className="flex gap-4 justify-between">
                <div>
                  <div className="detail-label flex items-center gap-1">
                    <Music size={12} /> Sound Vibe
                  </div>
                  <div className="detail-value capitalize text-xs">
                    {(selectedVideo.audioTrack || 'lofi_chill').replace('_', ' ')}
                  </div>
                </div>
                
                <div>
                  <div className="detail-label flex items-center gap-1">
                    <Video size={12} /> Video Status
                  </div>
                  <div className="detail-value capitalize text-xs">
                    {selectedVideo.status}
                  </div>
                </div>
              </div>

              {selectedVideo.keywords?.video && selectedVideo.keywords.video.length > 0 && (
                <div>
                  <div className="detail-label">Asset Tags</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {[...selectedVideo.keywords.video, ...(selectedVideo.keywords.gif || [])].map((kw, i) => (
                      <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        #{kw.toLowerCase().replace(/\s+/g, '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

      </main>

    </div>
  );
}
