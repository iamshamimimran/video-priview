import React, { useRef, useState, useEffect } from 'react';
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand, FaYoutube, FaInfoCircle } from 'react-icons/fa';

const VideoPlayer = ({ videoUrl }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState([]);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [useEmbed, setUseEmbed] = useState(false);

  // Function to detect video type and get appropriate URL
  const getVideoSource = async (url) => {
    if (!url) return { type: 'none', url: '' };

    const urlLower = url.toLowerCase();
    
    // Check for YouTube
    const isYouTube = urlLower.includes('youtube.com') || urlLower.includes('youtu.be');
    
    // Check for direct video files
    const isDirectVideo = urlLower.match(/\.(mp4|webm|mov|mkv|avi|flv|wmv|m4v|ogg|m3u8)(\?.*)?$/i);
    
    if (isYouTube) {
      try {
        // Try to get video info from backend
        const response = await fetch(`http://localhost:3000/video/info?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const info = await response.json();
          setVideoInfo(info);
          
          // For YouTube, use embed method
          const embedResponse = await fetch(`http://localhost:3000/embed?url=${encodeURIComponent(url)}`);
          if (embedResponse.ok) {
            const embedData = await embedResponse.json();
            return { type: 'youtube', url: embedData.embedUrl };
          }
        }
      } catch (error) {
        console.log('Failed to get YouTube info, using fallback');
      }
      
      // Fallback: try to extract YouTube ID and create embed URL
      const videoId = extractYouTubeId(url);
      if (videoId) {
        return { 
          type: 'youtube', 
          url: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&controls=1`
        };
      }
    }
    
    // For direct videos, use proxy
    if (isDirectVideo) {
      return { 
        type: 'direct', 
        url: `http://localhost:3000/stream/direct?url=${encodeURIComponent(url)}` 
      };
    }
    
    // Default fallback
    return { 
      type: 'direct', 
      url: `http://localhost:3000/stream?url=${encodeURIComponent(url)}` 
    };
  };

  const extractYouTubeId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/.*\/embed\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const [videoSource, setVideoSource] = useState({ type: 'none', url: '' });

  useEffect(() => {
    const setupVideo = async () => {
      if (!videoUrl) {
        setVideoSource({ type: 'none', url: '' });
        return;
      }

      setIsLoading(true);
      setError(null);
      setVideoInfo(null);

      try {
        const source = await getVideoSource(videoUrl);
        setVideoSource(source);
        
        if (source.type === 'youtube') {
          setUseEmbed(true);
        }
      } catch (error) {
        console.error('Error setting up video:', error);
        setError('Failed to process video URL. Please try a different video.');
      } finally {
        setIsLoading(false);
      }
    };

    setupVideo();
  }, [videoUrl]);

  // Video event handlers for direct videos
  useEffect(() => {
    if (videoSource.type !== 'direct' || !videoRef.current) return;

    const video = videoRef.current;
    
    const updateState = () => {
      if (video.duration && video.duration > 0) {
        setProgress((video.currentTime / video.duration) * 100);
        setDuration(video.duration);
        
        const bufferedRanges = [];
        for (let i = 0; i < video.buffered.length; i++) {
          bufferedRanges.push({
            start: (video.buffered.start(i) / video.duration) * 100,
            end: (video.buffered.end(i) / video.duration) * 100,
          });
        }
        setBuffered(bufferedRanges);
      }
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e) => {
      setIsLoading(false);
      console.error('Video error:', video.error);
      
      if (video.error) {
        switch (video.error.code) {
          case 1: // MEDIA_ERR_ABORTED
            setError("Video playback was aborted.");
            break;
          case 2: // MEDIA_ERR_NETWORK
            setError("Network error. Please check your connection.");
            break;
          case 3: // MEDIA_ERR_DECODE
            setError("Error decoding video. The format may not be supported.");
            break;
          case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
            setError("This video format is not supported. Try a different URL.");
            break;
          default:
            setError("Failed to load video.");
        }
      } else {
        setError("Failed to load video.");
      }
    };
    const handleLoadStart = () => setIsLoading(true);
    const handleLoadedMetadata = () => setIsLoading(false);
    const handlePlaying = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', updateState);
    video.addEventListener('progress', updateState);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('timeupdate', updateState);
      video.removeEventListener('progress', updateState);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoSource]);

  const togglePlay = () => {
    if (error || isLoading || videoSource.type !== 'direct') return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(e => {
        setError("Cannot play video: " + e.message);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    if (error || !videoRef.current?.duration) return;
    const seekTime = (e.nativeEvent.offsetX / e.target.offsetWidth) * videoRef.current.duration;
    videoRef.current.currentTime = seekTime;
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    const element = videoRef.current?.parentElement || document.querySelector('.video-container');
    if (!element) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      element.requestFullscreen?.() || 
      element.webkitRequestFullscreen?.() || 
      element.mozRequestFullScreen?.() || 
      element.msRequestFullscreen?.();
    }
  };

  const retryVideo = () => {
    setError(null);
    setIsLoading(true);
    
    if (videoRef.current && videoSource.type === 'direct') {
      videoRef.current.load();
      setTimeout(() => {
        videoRef.current.play().catch(e => {
          console.error('Retry failed:', e);
          setError("Still unable to play video. Try a different URL.");
        });
      }, 500);
    }
  };

  const switchToEmbed = () => {
    setUseEmbed(true);
  };

  const switchToDirect = () => {
    setUseEmbed(false);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!videoUrl) {
    return (
      <div className="w-full max-w-5xl mx-auto rounded-xl overflow-hidden border border-gray-800 bg-gray-900/50 aspect-video flex items-center justify-center">
        <div className="text-center">
          <p className="font-light tracking-widest uppercase text-sm text-gray-500 mb-2">Ready to Stream</p>
          <p className="text-xs text-gray-600 max-w-md mx-auto">
            Paste a video URL above to start streaming
          </p>
        </div>
      </div>
    );
  }

  if (videoSource.type === 'youtube' && useEmbed) {
    return (
      <div className="w-full max-w-5xl mx-auto rounded-xl overflow-hidden border border-gray-800 bg-black aspect-video relative">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-full flex items-center gap-1">
            <FaYoutube size={10} />
            YouTube
          </div>
          <button
            onClick={switchToDirect}
            className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-full hover:bg-gray-700 transition-colors"
          >
            Try Direct Stream
          </button>
        </div>
        
        <iframe
          src={videoSource.url}
          className="w-full h-full"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video player"
        />
        
        <div className="absolute bottom-4 left-4 text-gray-400 text-sm">
          <p className="flex items-center gap-2">
            <FaInfoCircle size={12} />
            Using YouTube embed player
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto rounded-xl overflow-hidden border border-gray-800 bg-black relative group video-container">
      <div className="relative w-full aspect-video bg-black">
        {/* Video Source Badge */}
        {videoSource.type !== 'none' && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <div className={`px-3 py-1 text-xs font-semibold rounded-full ${
              videoSource.type === 'youtube' 
                ? 'bg-red-600 text-white' 
                : 'bg-cyan-600 text-white'
            }`}>
              {videoSource.type === 'youtube' ? (
                <span className="flex items-center gap-1">
                  <FaYoutube size={10} />
                  YouTube
                </span>
              ) : (
                'Direct Video'
              )}
            </div>
            
            {videoSource.type === 'youtube' && !useEmbed && (
              <button
                onClick={switchToEmbed}
                className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-full hover:bg-gray-700 transition-colors"
              >
                Use YouTube Player
              </button>
            )}
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          src={videoSource.url}
          className="w-full h-full cursor-pointer"
          onClick={togglePlay}
          crossOrigin="anonymous"
          preload="auto"
          playsInline
        />
        
        {/* Loader */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-gray-800 border-t-cyan-500 rounded-full animate-spin"></div>
              <p className="text-gray-300 text-sm">
                {videoSource.type === 'youtube' ? 'Loading YouTube video...' : 'Loading video...'}
              </p>
            </div>
          </div>
        )}
        
        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30 backdrop-blur-sm">
            <div className="text-center px-4 max-w-md">
              <div className="text-red-400 mb-3">
                <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-200 mb-2">{error}</p>
              
              {videoSource.type === 'youtube' && (
                <p className="text-xs text-gray-400 mb-4">
                  YouTube videos may require embedding. Try using the YouTube player button.
                </p>
              )}
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={retryVideo}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm transition-colors"
                >
                  Retry
                </button>
                {videoSource.type === 'youtube' && (
                  <button
                    onClick={switchToEmbed}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                  >
                    Use YouTube Player
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Controls Overlay for Direct Videos */}
        {videoSource.type === 'direct' && !error && (
          <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-300 ${
            !isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } ease-out`}>
            
            {/* Progress Bar */}
            <div 
              className="w-full h-1 bg-gray-800 rounded-full mb-3 cursor-pointer relative overflow-hidden group/progress hover:h-2 transition-all duration-300"
              onClick={handleSeek}
            >
              {/* Buffer ranges */}
              {buffered.map((range, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 h-full bg-gray-600 rounded-full transition-all duration-300"
                  style={{ left: `${range.start}%`, width: `${range.end - range.start}%` }}
                />
              ))}
              
              {/* Play progress */}
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-100 relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow opacity-0 group-hover/progress:opacity-100 transition-opacity"></div>
              </div>
            </div>

            <div className="flex items-center justify-between text-gray-200">
              <div className="flex items-center gap-4">
                <button 
                  onClick={togglePlay} 
                  className="hover:text-cyan-400 transition-colors p-1.5 hover:bg-gray-800/50 rounded-full"
                >
                  {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} className="ml-0.5" />}
                </button>
                
                <div className="flex items-center gap-2 group/vol">
                  <button 
                    onClick={toggleMute} 
                    className="hover:text-cyan-400 transition-colors p-1.5 hover:bg-gray-800/50 rounded-full"
                  >
                    {isMuted ? <FaVolumeMute size={16} /> : <FaVolumeUp size={16} />}
                  </button>
                  <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVolume(val);
                        if (videoRef.current) {
                          videoRef.current.volume = val;
                          setIsMuted(val === 0);
                        }
                      }}
                      className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                    />
                  </div>
                </div>

                <span className="text-[10px] sm:text-xs font-mono tracking-wider text-gray-400">
                  {formatTime(videoRef.current?.currentTime || 0)} 
                  <span className="mx-1">/</span> 
                  {formatTime(duration)}
                </span>
              </div>

              <button 
                onClick={toggleFullscreen} 
                className="hover:text-cyan-400 transition-colors p-1.5 hover:bg-gray-800/50 rounded-full"
              >
                <FaExpand size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;