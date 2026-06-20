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
  Volume2,
  Plus,
  Trash2,
  LogOut
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export default function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hey! 🎬 I am UGC Chat. Describe your product pitch or share a website link, and chat with me to write Gen-Z copy, grab stock footage/reaction GIFs, mix trending audio, and generate viral 9:16 shorts with me! 🚀",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [pitchInput, setPitchInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePollId, setActivePollId] = useState(null);
  const [currentProgress, setCurrentProgress] = useState(null);

  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(!!token);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Validate token on mount or token change
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        setCheckingAuth(true);
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
          } else {
            handleLogout();
          }
        } catch (err) {
          console.error('Auth verification failed:', err);
          setUser(null);
        } finally {
          setCheckingAuth(false);
        }
      } else {
        setUser(null);
        setCheckingAuth(false);
      }
    };
    initAuth();
  }, [token]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim()) {
      setAuthError('Please enter both username and password');
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      setUsernameInput('');
      setPasswordInput('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setVideos([]);
    setSelectedVideo(null);
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: "Hey! 🎬 I am UGC Chat. Describe your product pitch or share a website link, and chat with me to write Gen-Z copy, grab stock footage/reaction GIFs, mix trending audio, and generate viral 9:16 shorts with me! 🚀",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Generate default chat bubbles for older database records lacking chatHistory
  const generateDefaultChatHistory = (video) => {
    const timeStr = new Date(video.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const list = [
      {
        id: 'welcome',
        sender: 'bot',
        text: "Hey! 🎬 I am UGC Chat. Describe your product pitch or share a website link, and chat with me to write Gen-Z copy, grab stock footage/reaction GIFs, mix trending audio, and generate viral 9:16 shorts with me! 🚀",
        time: timeStr
      },
      {
        id: `user-legacy-${video._id}`,
        sender: 'user',
        text: `Pitch: "${video.productDescription}"${video.websiteUrl ? `\nWebsite: ${video.websiteUrl}` : ''}`,
        time: timeStr
      }
    ];
    
    if (video.status === 'completed') {
      list.push({
        id: `done-legacy-${video._id}`,
        sender: 'bot',
        text: `✨ Done! Your UGC short is ready. "${video.productName || 'Your product'}" is going to be viral. 📈 Check the interactive phone preview on the right!`,
        time: timeStr
      });
    } else if (video.status === 'failed') {
      list.push({
        id: `fail-legacy-${video._id}`,
        sender: 'bot',
        text: `❌ Oh no, rendering failed: ${video.error || 'Unknown rendering engine error'}`,
        time: timeStr
      });
    } else {
      list.push({
        id: `widget-legacy-${video._id}`,
        sender: 'bot',
        text: `Starting assets collection and layout assembly for your product...`,
        isWidget: true,
        videoRecordId: video._id,
        status: video.status,
        time: timeStr
      });
    }
    
    return list;
  };

  // Fetch video generation history
  const fetchVideos = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/videos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      setVideos(data);
      
      // Auto-select first completed video if nothing is active
      if (data.length > 0 && !selectedVideo) {
        const firstCompleted = data.find(v => v.status === 'completed');
        if (firstCompleted) loadVideoInUI(firstCompleted);
      }
    } catch (err) {
      console.error('Failed to load video list:', err);
    }
  };

  // Load a video concept, sync chat panel, and resume polling if active
  const loadVideoInUI = (video) => {
    if (!video) {
      setSelectedVideo(null);
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: "Hey! 🎬 I am UGC Chat. Describe your product pitch or share a website link, and chat with me to write Gen-Z copy, grab stock footage/reaction GIFs, mix trending audio, and generate viral 9:16 shorts with me! 🚀",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      return;
    }
    
    setSelectedVideo(video);
    
    // Read saved chat history or use legacy fallback
    if (video.chatHistory && video.chatHistory.length > 0) {
      setMessages(video.chatHistory);
    } else {
      setMessages(generateDefaultChatHistory(video));
    }

    // Check if background task is still rendering and we need to poll
    const isFinished = video.status === 'completed' || video.status === 'failed';
    if (!isFinished) {
      startPolling(video._id);
    } else {
      // Clear current interval if loading a finished card
      if (pollIntervalRef.current && activePollId !== video._id) {
        clearInterval(pollIntervalRef.current);
        setIsGenerating(false);
        setActivePollId(null);
        setCurrentProgress(null);
      }
    }
  };

  // Delete a video record and clear UI states if selected
  const handleDeleteVideo = async (e, id) => {
    e.stopPropagation(); // Prevent card selection when clicking delete
    if (!confirm('Are you sure you want to delete this UGC video?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/videos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      if (res.ok) {
        if (selectedVideo && selectedVideo._id === id) {
          loadVideoInUI(null);
        }
        fetchVideos();
      } else {
        alert('Failed to delete video record');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Reset states to start a new video concept
  const handleNewVideo = () => {
    loadVideoInUI(null);
    setPitchInput('');
    setUrlInput('');
  };

  useEffect(() => {
    if (token && user) {
      fetchVideos();
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [token, user]);

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
        const res = await fetch(`${API_BASE}/api/videos/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401 || res.status === 403) {
          clearInterval(pollIntervalRef.current);
          handleLogout();
          return;
        }
        if (!res.ok) throw new Error('Video record not found');
        
        const video = await res.json();
        setCurrentProgress(video);
        setSelectedVideo(video);

        // Keep local chat panel synced directly with the database's chatHistory
        if (video.chatHistory && video.chatHistory.length > 0) {
          setMessages(video.chatHistory);
        }

        // Check if finished
        if (video.status === 'completed' || video.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setIsGenerating(false);
          setActivePollId(null);
          setCurrentProgress(null);
          setSelectedVideo(video);
          fetchVideos(); // Refresh list to update sidebar badges
        }
      } catch (err) {
        console.error('Error during polling:', err);
        clearInterval(pollIntervalRef.current);
        setIsGenerating(false);
        setActivePollId(null);
        setCurrentProgress(null);
      }
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (pitchInput.trim() && !isGenerating) {
        handleSendMessage(e);
      }
    }
  };

  // Submit message to conversational chatbot
  const handleSendMessage = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!pitchInput.trim() || isGenerating) return;

    const text = pitchInput.trim();
    const url = urlInput;
    setPitchInput('');

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Append user message locally
    setMessages(prev => [...prev, userMsg]);

    // Show temporary typing indicator
    const typingId = `typing-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      {
        id: typingId,
        sender: 'bot',
        text: 'Typing...',
        isTyping: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: text,
          videoId: selectedVideo ? selectedVideo._id : null,
          chatHistory: messages.concat(userMsg)
        })
      });

      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to get chat response');
      }

      const data = await res.json();

      if (data.action === 'generate') {
        // Remove typing indicator and load the generated video concept in UI
        setMessages(prev => prev.filter(m => m.id !== typingId));
        loadVideoInUI(data.record);
      } else {
        // Normal conversational response
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== typingId);
          return [
            ...filtered,
            {
              id: `bot-${Date.now()}`,
              sender: 'bot',
              text: data.responseText,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ];
        });

        if (data.updatedVideo) {
          setSelectedVideo(data.updatedVideo);
          fetchVideos();
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== typingId);
        return [
          ...filtered,
          {
            id: `err-${Date.now()}`,
            sender: 'bot',
            text: `Oops, chat assistant is offline: ${err.message}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
      });
    }
  };

  // Submit new generation request
  const handleGenerate = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!pitchInput.trim() || isGenerating) return;

    const description = pitchInput;
    const url = urlInput;
    
    setPitchInput('');
    setUrlInput('');
    setIsGenerating(true);

    try {
      const response = await fetch(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ description, url })
      });

      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to schedule video rendering');
      }

      const initialRecord = await response.json();
      
      // Load initial chat and widget layout directly from the db
      loadVideoInUI(initialRecord);
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
      setIsGenerating(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="auth-loading-screen">
        <Loader2 className="text-purple-500 spinner" size={48} />
        <p className="auth-loading-text">Reconnecting to UGC Studio...</p>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <div className="auth-container">
        <div className="auth-background-glow"></div>
        <div className="auth-box glass-panel">
          <div className="auth-header">
            <Sparkles className="auth-logo text-purple-400" size={32} />
            <h1 className="auth-title">UGC Creator Studio</h1>
            <p className="auth-subtitle">
              {authMode === 'login' 
                ? 'Sign in to access your video workspaces' 
                : 'Create an account to start generating shorts'}
            </p>
          </div>
          
          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authError && (
              <div className="auth-error-bubble">
                <AlertCircle size={16} className="text-rose-400" />
                <span>{authError}</span>
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                placeholder="e.g. chandan"
                autoComplete="username"
                required
                disabled={authLoading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={authLoading}
              />
            </div>
            
            <button type="submit" className="auth-submit-btn" disabled={authLoading}>
              {authLoading ? (
                <>
                  <Loader2 size={18} className="spinner" />
                  <span>{authMode === 'login' ? 'Signing in...' : 'Registering...'}</span>
                </>
              ) : (
                <span>{authMode === 'login' ? 'Sign In' : 'Register Account'}</span>
              )}
            </button>
          </form>
          
          <div className="auth-toggle">
            {authMode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button 
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  disabled={authLoading}
                >
                  Register Here
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button 
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  disabled={authLoading}
                >
                  Sign In Here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      
      {/* Sidebar - History */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <History className="text-purple-400" size={20} />
          <h1 className="sidebar-title" style={{ flex: 1 }}>UGC Creator Studio</h1>
          <button 
            onClick={handleNewVideo} 
            className="new-video-btn"
            title="Start New Video"
          >
            <Plus size={18} />
          </button>
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
                  onClick={() => loadVideoInUI(vid)}
                >
                  <div className="history-card-header">
                    <div className="history-card-title">
                      {vid.productName || 'Analyzing Idea...'}
                    </div>
                    <button 
                      onClick={(e) => handleDeleteVideo(e, vid._id)}
                      className="history-card-delete-btn"
                      title="Delete video"
                    >
                      <Trash2 size={13} />
                    </button>
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

        {/* User Profile and Logout */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="username">{user.username}</span>
              <span className="user-role">Creator</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn" title="Logout">
            <LogOut size={16} />
          </button>
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
                  {msg.isTyping ? (
                    <div className="typing-indicator-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                  )}
                  
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
            <form onSubmit={handleSendMessage} className="chat-input-form">
              <textarea
                value={pitchInput}
                onChange={e => setPitchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Chat with UGC Director or describe your product pitch..."
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
                <div className="chat-actions-group">
                  <button 
                    type="submit" 
                    className="chat-send-btn"
                    disabled={isGenerating || !pitchInput.trim()}
                  >
                    <Send size={15} />
                    <span>Send</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={handleGenerate}
                    className="submit-btn"
                    disabled={isGenerating || !pitchInput.trim()}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={15} className="spinner" />
                        <span>Producing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        <span>Produce Video</span>
                      </>
                    )}
                  </button>
                </div>
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
                src={selectedVideo.videoPath.startsWith('http') ? selectedVideo.videoPath : `${API_BASE}${selectedVideo.videoPath}`}
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
              <div className="detail-row">
                <div className="detail-label">Concept Name</div>
                <div className="detail-value concept-name">
                  {selectedVideo.productName || 'Planning...'}
                </div>
              </div>
              
              <div className="detail-row">
                <div className="detail-label">Selected Hook Copy</div>
                <div className="detail-value hook-copy">
                  {selectedVideo.selectedHook ? `"${selectedVideo.selectedHook}"` : 'Analyzing pitch...'}
                </div>
              </div>

              <div className="detail-row-split">
                <div className="detail-col">
                  <div className="detail-label">
                    <Music size={12} className="detail-icon" /> Sound Vibe
                  </div>
                  <div className="detail-value capitalize font-medium">
                    {(selectedVideo.audioTrack || 'lofi_chill').replace('_', ' ')}
                  </div>
                </div>
                
                <div className="detail-col">
                  <div className="detail-label">
                    <Video size={12} className="detail-icon" /> Video Status
                  </div>
                  <div className="detail-value capitalize">
                    <span className={`badge badge-${selectedVideo.status}`}>
                      {selectedVideo.status}
                    </span>
                  </div>
                </div>
              </div>

              {selectedVideo.keywords?.video && selectedVideo.keywords.video.length > 0 && (
                <div className="detail-row">
                  <div className="detail-label">Asset Tags</div>
                  <div className="tag-pills-container">
                    {[...selectedVideo.keywords.video, ...(selectedVideo.keywords.gif || [])].map((kw, i) => (
                      <span key={i} className="tag-pill">
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
