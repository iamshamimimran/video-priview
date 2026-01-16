const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { PassThrough } = require('stream');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Cache for storing video info
const videoCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to clean up old cache
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of videoCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            videoCache.delete(key);
        }
    }
}, 60000); // Clean every minute

// Enhanced User-Agent rotation
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const getRandomUserAgent = () => {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// Function to extract video info from various platforms
async function getVideoInfo(url) {
    const cacheKey = `info_${url}`;
    if (videoCache.has(cacheKey)) {
        return videoCache.get(cacheKey).data;
    }

    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        let videoInfo = {
            source: 'direct',
            title: '',
            thumbnail: '',
            duration: 0,
            streams: []
        };

        // YouTube detection and info extraction
        if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
            videoInfo.source = 'youtube';
            const videoId = extractYouTubeId(url);
            if (videoId) {
                videoInfo.title = `YouTube Video (${videoId})`;
                videoInfo.thumbnail = `https://img.youtube.com/vi/${videoId}/0.jpg`;
                
                // Try to get direct YouTube video URL (this is a simplified approach)
                // Note: This might not work for all videos due to YouTube's protections
                const directUrls = [
                    `https://www.youtube.com/watch?v=${videoId}`,
                    `https://youtu.be/${videoId}`,
                    `https://www.youtube-nocookie.com/embed/${videoId}`
                ];
                
                videoInfo.streams = directUrls.map(u => ({
                    url: u,
                    quality: 'auto',
                    type: 'embed'
                }));
            }
        }
        // TikTok detection
        else if (domain.includes('tiktok.com')) {
            videoInfo.source = 'tiktok';
            videoInfo.title = 'TikTok Video';
        }
        // Instagram detection
        else if (domain.includes('instagram.com')) {
            videoInfo.source = 'instagram';
            videoInfo.title = 'Instagram Video';
        }
        // Facebook detection
        else if (domain.includes('facebook.com') || domain.includes('fb.watch')) {
            videoInfo.source = 'facebook';
            videoInfo.title = 'Facebook Video';
        }

        videoCache.set(cacheKey, {
            data: videoInfo,
            timestamp: Date.now()
        });

        return videoInfo;
    } catch (error) {
        console.error('Error getting video info:', error);
        return {
            source: 'unknown',
            title: 'Unknown Video',
            thumbnail: '',
            duration: 0,
            streams: []
        };
    }
}

function extractYouTubeId(url) {
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
}

// Direct video streaming (for .mp4, .webm, etc.)
app.get('/stream/direct', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Get video info first
        const videoInfo = await getVideoInfo(videoUrl);
        
        // Set up headers with appropriate user agent
        const headers = {
            'User-Agent': getRandomUserAgent(),
            'Accept': '*/*',
            'Accept-Encoding': 'identity', // Important: don't compress
            'Connection': 'keep-alive',
            'Range': req.headers.range || 'bytes=0-',
        };

        // Add referer if it's a known domain
        try {
            const urlObj = new URL(videoUrl);
            headers['Referer'] = `${urlObj.protocol}//${urlObj.hostname}`;
        } catch (e) {
            // Continue without referer
        }

        const response = await axios({
            method: 'GET',
            url: videoUrl,
            headers: headers,
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 5
        });

        // Check if the response is a video
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('video/') && !contentType.includes('application/octet-stream')) {
            console.warn('Non-video content type:', contentType);
        }

        // Handle range requests
        const range = req.headers.range;
        const contentLength = response.headers['content-length'];
        
        if (range && contentLength) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
            const chunksize = (end - start) + 1;
            
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${contentLength}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType || 'video/mp4',
                'Cache-Control': 'public, max-age=31536000',
            });
        } else {
            res.writeHead(200, {
                'Content-Type': contentType || 'video/mp4',
                'Content-Length': contentLength || '',
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000',
            });
        }

        // Pipe the video stream
        response.data.pipe(res);

        // Handle stream errors
        response.data.on('error', (error) => {
            console.error('Stream error:', error.message);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });

    } catch (error) {
        console.error('Direct streaming error:', error.message);
        
        // Provide helpful error messages
        if (error.response) {
            if (error.response.status === 403) {
                res.status(403).json({ 
                    error: 'Access forbidden. This video may require authentication or is blocked.',
                    details: 'Try using a different video source or check if the URL is correct.'
                });
            } else if (error.response.status === 404) {
                res.status(404).json({ 
                    error: 'Video not found. The URL might be incorrect or the video was removed.',
                    details: 'Verify the URL and try again.'
                });
            } else {
                res.status(error.response.status).json({ 
                    error: `Server responded with ${error.response.status}`,
                    details: error.message
                });
            }
        } else if (error.code === 'ENOTFOUND') {
            res.status(404).json({ 
                error: 'Cannot resolve host. Check your internet connection or the URL.',
                details: error.message
            });
        } else if (error.code === 'ECONNREFUSED') {
            res.status(503).json({ 
                error: 'Connection refused. The server might be down.',
                details: error.message
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to stream video',
                details: error.message,
                suggestion: 'Try using a direct video link (.mp4, .webm) instead of YouTube'
            });
        }
    }
});

// Info endpoint to get video information
app.get('/video/info', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const info = await getVideoInfo(videoUrl);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get video info', details: error.message });
    }
});

// Embed endpoint for platforms that support iframe embedding
app.get('/embed', (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const urlObj = new URL(videoUrl);
        const domain = urlObj.hostname;
        
        let embedUrl = videoUrl;
        
        // Convert YouTube watch URLs to embed URLs
        if (domain.includes('youtube.com') && videoUrl.includes('/watch?v=')) {
            const videoId = extractYouTubeId(videoUrl);
            if (videoId) {
                embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1`;
            }
        }
        // Convert youtu.be to embed URLs
        else if (domain.includes('youtu.be')) {
            const videoId = videoUrl.split('/').pop();
            embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1`;
        }
        
        res.json({ embedUrl });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate embed URL', details: error.message });
    }
});

// Main streaming endpoint with fallback
app.get('/stream', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const info = await getVideoInfo(videoUrl);
        
        // For YouTube, try to get embed URL
        if (info.source === 'youtube') {
            const videoId = extractYouTubeId(videoUrl);
            if (videoId) {
                // Return HTML with iframe for YouTube
                const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&controls=1`;
                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { margin: 0; padding: 0; background: #000; }
                            .container { width: 100vw; height: 100vh; }
                            iframe { width: 100%; height: 100%; border: none; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <iframe 
                                src="${embedUrl}" 
                                frameborder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen>
                            </iframe>
                        </div>
                    </body>
                    </html>
                `);
                return;
            }
        }
        
        // For other videos, try direct streaming
        return res.redirect(`/stream/direct?url=${encodeURIComponent(videoUrl)}`);
        
    } catch (error) {
        console.error('Stream endpoint error:', error);
        res.status(500).json({ 
            error: 'Failed to process video URL',
            details: error.message,
            suggestion: 'Try using direct video links (.mp4, .webm) for better compatibility'
        });
    }
});

// Test endpoint with sample videos
app.get('/test-videos', (req, res) => {
    const testVideos = [
        {
            name: "Big Buck Bunny (MP4)",
            url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            type: "video/mp4"
        },
        {
            name: "Elephants Dream (MP4)",
            url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            type: "video/mp4"
        },
        {
            name: "For Bigger Blazes (MP4)",
            url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            type: "video/mp4"
        },
        {
            name: "For Bigger Escape (MP4)",
            url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
            type: "video/mp4"
        },
        {
            name: "Test HLS Stream",
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            type: "application/x-mpegURL"
        }
    ];
    
    res.json(testVideos);
});

// Health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        endpoints: {
            direct: '/stream/direct?url=VIDEO_URL',
            info: '/video/info?url=VIDEO_URL',
            embed: '/embed?url=VIDEO_URL',
            test: '/test-videos'
        },
        note: 'For YouTube videos, use /embed endpoint or YouTube embed URLs directly'
    });
});

// Static files for frontend
app.use(express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

app.listen(port, () => {
    console.log(`✅ StreamFlow Server running at http://localhost:${port}`);
    console.log(`📺 Health check: http://localhost:${port}/health`);
    console.log(`🎬 Test videos: http://localhost:${port}/test-videos`);
    console.log(`\n🚀 Ready to stream!`);
    console.log(`\n📋 Usage:`);
    console.log(`1. Direct videos: http://localhost:${port}/stream/direct?url=VIDEO_URL`);
    console.log(`2. YouTube: Use embed URLs directly`);
    console.log(`\n💡 Tip: Start with test videos to verify setup`);
});