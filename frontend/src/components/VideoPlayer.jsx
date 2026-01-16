import React, { useRef, useState, useEffect } from 'react';
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand } from 'react-icons/fa';

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

  // Function to get appropriate proxy URL based on video source
// Add this function inside your VideoPlayer component:
// In your getProxyUrl function, add:
const getProxyUrl = (url) => {
  if (!url) return '';
  
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  
  if (isYouTube) {
    // Use a public YouTube proxy (be aware of ToS)
    return `https://corsproxy.io/?${encodeURIComponent(`https://www.youtube.com/embed/${getYouTubeId(url)}`)}`;
    
    // OR use another service
    // return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  }
  
  return `http://localhost:3000/stream?url=${encodeURIComponent(url)}`;
};

// Helper function to extract YouTube ID
const getYouTubeId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : false;
};

  // Get the proxy URL
  const proxyUrl = getProxyUrl(videoUrl);

  // Function to detect video source type for UI hints
  const getVideoSourceType = (url) => {
    if (!url) return '';
    
    const decodedUrl = decodeURIComponent(url).toLowerCase();
    
    if (decodedUrl.includes('youtube.com') || decodedUrl.includes('youtu.be')) {
      return 'YouTube';
    } else if (decodedUrl.includes('vimeo.com')) {
      return 'Vimeo';
    } else if (decodedUrl.includes('dailymotion.com') || decodedUrl.includes('dai.ly')) {
      return 'Dailymotion';
    } else if (decodedUrl.includes('twitch.tv')) {
      return 'Twitch';
    } else if (decodedUrl.includes('tiktok.com')) {
      return 'TikTok';
    } else if (decodedUrl.includes('facebook.com') || decodedUrl.includes('fb.watch')) {
      return 'Facebook';
    } else if (decodedUrl.match(/\.(mp4|webm|mov|mkv|avi|flv|wmv|m4v)$/i)) {
      return 'Video File';
    } else if (decodedUrl.match(/\.(m3u8|mpd|ts)$/i)) {
      return 'Stream';
    } else {
      return 'Unknown Source';
    }
  };

  const videoSourceType = getVideoSourceType(videoUrl);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setBuffered([]);
    
    const video = videoRef.current;
    if (!video || !proxyUrl) return;

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
      console.error('Video error:', e);
      
      // Provide specific error messages based on error code
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
            setError(`This ${videoSourceType} video format is not supported. Try a different URL.`);
            break;
          default:
            setError("Failed to load video. Please check the URL or try another source.");
        }
      } else {
        setError("Failed to load video. Please check the URL or try another source.");
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
  }, [videoUrl, proxyUrl, videoSourceType]);

  const togglePlay = () => {
    if (error || isLoading) return;
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
    if (error || !videoRef.current.duration) return;
    const seekTime = (e.nativeEvent.offsetX / e.target.offsetWidth) * videoRef.current.duration;
    videoRef.current.currentTime = seekTime;
  };

  const toggleMute = () => {
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = () => {
    const videoContainer = videoRef.current.parentElement;
    if (!videoContainer) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoContainer.requestFullscreen?.() || 
      videoContainer.webkitRequestFullscreen?.() || 
      videoContainer.mozRequestFullScreen?.() || 
      videoContainer.msRequestFullscreen?.();
    }
  };

  const retryVideo = () => {
    if (!videoRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    // Reload the video
    videoRef.current.load();
    
    // Try to play after a short delay
    setTimeout(() => {
      videoRef.current.play().catch(e => {
        console.error('Retry failed:', e);
        setError("Still unable to play video. Try a different URL.");
      });
    }, 500);
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-xl overflow-hidden shadow-2xl border border-gray-800 bg-black relative group">
      {!videoUrl ? (
        <div className="aspect-video flex items-center justify-center text-gray-600 bg-gray-900/50">
          <p className="font-light tracking-widest uppercase text-xs">Ready to Stream</p>
        </div>
      ) : (
        <>
          <div className="relative w-full aspect-video bg-black">
            {/* Video Source Indicator */}
            {videoSourceType && (
              <div className="absolute top-3 left-3 z-10">
                <span className="px-2 py-1 bg-black/70 backdrop-blur-sm text-xs text-cyan-400 rounded-md border border-gray-700">
                  {videoSourceType}
                </span>
              </div>
            )}
            
            <video
              ref={videoRef}
              src={proxyUrl}
              className="w-full h-full cursor-pointer"
              onClick={togglePlay}
              crossOrigin="anonymous"
              preload="auto"
              playsInline
            />
            
            {/* Loader */}
            {isLoading && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="loader border-4 border-gray-800 border-t-cyan-500 rounded-full w-12 h-12 animate-spin"></div>
                  <p className="text-gray-300 text-sm">Loading {videoSourceType} video...</p>
                </div>
              </div>
            )}
            
            {/* Error Overlay */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 backdrop-blur-sm">
                <div className="text-center px-4 max-w-md">
                  <div className="text-red-400 mb-3">
                    <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-200 mb-2">{error}</p>
                  {videoSourceType && (
                    <p className="text-xs text-gray-400 mb-4">
                      Source: {videoSourceType} • URL: {videoUrl.length > 50 ? `${videoUrl.substring(0, 50)}...` : videoUrl}
                    </p>
                  )}
                  <button
                    onClick={retryVideo}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
            
            {/* Controls Overlay */}
            <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-300 ${!isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ease-out`}>
              
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
                  <button onClick={togglePlay} className="hover:text-cyan-400 transition-colors p-1.5 hover:bg-gray-800/50 rounded-full">
                    {isPlaying ? <FaPause size={16} /> : <FaPlay size={16} className="ml-0.5" />}
                  </button>
                  
                  <div className="flex items-center gap-2 group/vol">
                    <button onClick={toggleMute} className="hover:text-cyan-400 transition-colors p-1.5 hover:bg-gray-800/50 rounded-full">
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
                          videoRef.current.volume = val;
                          setIsMuted(val === 0);
                          }}
                          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] sm:text-xs font-mono tracking-wider text-gray-400">
                    {new Date(videoRef.current?.currentTime * 1000 || 0).toISOString().substr(11, 8)} 
                    <span className="mx-1">/</span> 
                    {new Date(duration * 1000 || 0).toISOString().substr(11, 8)}
                  </span>
                </div>

                <button onClick={toggleFullscreen} className="hover:text-cyan-400 transition-colors p-1.5 hover:bg-gray-800/50 rounded-full">
                  <FaExpand size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoPlayer;