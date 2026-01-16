const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ytdl = require('ytdl-core');
const youtubedl = require('youtube-dl-exec');
const { PassThrough } = require('stream');
const app = express();
const port = 3000;

app.use(cors());

// Function to identify video source
function getVideoSource(url) {
    try {
        if (ytdl.validateURL(url)) {
            return 'youtube';
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube';
        } else if (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov') || url.includes('.m3u8')) {
            return 'direct';
        } else {
            return 'unknown';
        }
    } catch (error) {
        return 'unknown';
    }
}


app.get('/stream/youtube/better', async (req, res) => {
    const videoUrl = req.query.url;
    
    try {
        const info = await youtubedl(videoUrl, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true,
            format: 'best[ext=mp4]/best[ext=webm]/best'
        });

        // Get the best MP4 format
        const format = info.formats.find(f => f.ext === 'mp4') || info.formats[0];
        
        if (format && format.url) {
            // Set headers and redirect
            res.setHeader('Content-Type', 'video/mp4');
            res.redirect(format.url);
        } else {
            res.status(500).send('No stream found');
        }
    } catch (error) {
        console.error('YouTube-dl error:', error);
        res.status(500).send('YouTube streaming failed');
    }
});
// YouTube streaming endpoint - FIXED VERSION
app.get('/stream/youtube', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).send('URL is required');
    }

    try {
        // Validate YouTube URL
        if (!ytdl.validateURL(videoUrl)) {
            return res.status(400).send('Invalid YouTube URL');
        }

        // Get video info
        const info = await ytdl.getInfo(videoUrl);
        
        // Find the best format that browser can play
        // Prefer formats that have both audio and video in one stream
        let format;
        
        // Try to find itag 18 (360p MP4) - most compatible
        format = info.formats.find(f => f.itag === 18);
        
        // If not found, try to find MP4 with both audio and video
        if (!format) {
            format = ytdl.chooseFormat(info.formats, {
                quality: 'lowest',
                filter: 'audioandvideo',
                format: 'mp4'
            });
        }
        
        // If still not found, try any MP4 format
        if (!format) {
            format = info.formats.find(f => 
                f.container === 'mp4' && 
                f.hasVideo && 
                f.codecs && 
                f.codecs.includes('avc1') // H.264 codec
            );
        }
        
        // Fallback to any format
        if (!format) {
            format = ytdl.chooseFormat(info.formats, { quality: 'lowest' });
        }

        if (!format) {
            return res.status(500).send('No compatible format found');
        }

        console.log('Selected format:', {
            itag: format.itag,
            container: format.container,
            quality: format.qualityLabel,
            codecs: format.codecs,
            hasAudio: format.hasAudio,
            hasVideo: format.hasVideo
        });

        // Set proper headers
        res.setHeader('Content-Type', format.mimeType || 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Handle range requests for seeking
        const range = req.headers.range;
        if (range) {
            // For YouTube, we can't easily handle byte ranges with ytdl-core
            // So we'll disable range requests for YouTube
            console.log('Range request ignored for YouTube');
        }

        // Create the stream
        const stream = ytdl(videoUrl, { 
            format: format,
            quality: 'lowest',
            filter: 'audioandvideo'
        }).on('error', (error) => {
            console.error('YouTube stream error:', error.message);
            if (!res.headersSent) {
                res.status(500).send('Stream error');
            }
        });

        // Pipe the stream to response
        stream.pipe(res);

    } catch (error) {
        console.error('YouTube streaming error:', error.message);
        if (error.message.includes('Video unavailable')) {
            res.status(404).send('YouTube video is unavailable (private, deleted, or age-restricted)');
        } else if (error.message.includes('private video')) {
            res.status(403).send('This is a private video');
        } else if (error.message.includes('age restricted')) {
            res.status(403).send('Age-restricted video. Sign in to confirm your age');
        } else {
            res.status(500).send('Error streaming YouTube video: ' + error.message);
        }
    }
});

// Enhanced direct streaming with better headers
app.get('/stream/direct', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).send('URL is required');
    }

    try {
        // Parse the URL to extract domain for referer
        let referer = 'https://www.google.com';
        try {
            const urlObj = new URL(videoUrl);
            referer = urlObj.origin;
        } catch (e) {
            // Use default referer
        }

        // Get headers from original request
        const headResponse = await axios.head(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': referer,
                'Accept': '*/*',
                'Accept-Encoding': 'identity',
            },
            timeout: 5000
        });

        const videoSize = parseInt(headResponse.headers['content-length'], 10) || 0;
        const contentType = headResponse.headers['content-type'] || 'video/mp4';

        const range = req.headers.range;
        
        if (range && videoSize > 0) {
            // Parse range header
            const CHUNK_SIZE = 10 ** 6; // 1MB
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] 
                ? parseInt(parts[1], 10) 
                : Math.min(start + CHUNK_SIZE, videoSize - 1);

            const contentLength = end - start + 1;
            
            // Set response headers
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${videoSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': contentLength,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000',
            });

            // Stream the video chunk
            const response = await axios({
                method: 'get',
                url: videoUrl,
                responseType: 'stream',
                headers: {
                    'Range': `bytes=${start}-${end}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': referer,
                }
            });

            response.data.pipe(res);
        } else {
            // If no range header or unknown size, send the whole video
            res.writeHead(200, {
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
            });

            const response = await axios({
                method: 'get',
                url: videoUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': referer,
                }
            });

            response.data.pipe(res);
        }
    } catch (error) {
        console.error('Direct streaming error:', error.message);
        
        // Try a simpler approach without headers
        try {
            const response = await axios({
                method: 'get',
                url: videoUrl,
                responseType: 'stream',
            });

            res.setHeader('Content-Type', 'video/mp4');
            response.data.pipe(res);
        } catch (fallbackError) {
            res.status(500).send('Error streaming video: ' + fallbackError.message);
        }
    }
});

// Main streaming endpoint
app.get('/stream', async (req, res) => {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
        return res.status(400).send('URL is required');
    }

    const source = getVideoSource(videoUrl);
    
    console.log(`Streaming ${source} video: ${videoUrl}`);

    switch (source) {
        case 'youtube':
            return res.redirect(`/stream/youtube?url=${encodeURIComponent(videoUrl)}`);
        default:
            return res.redirect(`/stream/direct?url=${encodeURIComponent(videoUrl)}`);
    }
});

// Alternative YouTube streaming using a different approach
app.get('/stream/youtube2', async (req, res) => {
    const videoUrl = req.query.url;
    
    try {
        // Use youtube-dl-exec as an alternative (if installed)
        // This requires: npm install youtube-dl-exec
        const youtubedl = require('youtube-dl-exec');
        
        const info = await youtubedl(videoUrl, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: [
                'referer:youtube.com',
                'user-agent:googlebot'
            ]
        });

        // Find the best URL
        const format = info.formats.find(f => 
            f.ext === 'mp4' && 
            f.acodec !== 'none' && 
            f.vcodec !== 'none'
        ) || info.formats[0];

        if (!format || !format.url) {
            return res.status(500).send('No stream URL found');
        }

        // Redirect to the direct URL (some may work)
        res.redirect(format.url);
        
    } catch (error) {
        console.error('Alternative YouTube error:', error);
        res.status(500).send('Failed to get YouTube stream');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'StreamFlow proxy server is running',
        endpoints: [
            '/stream?url=YOUR_URL',
            '/stream/youtube?url=YOUTUBE_URL',
            '/stream/direct?url=DIRECT_VIDEO_URL'
        ]
    });
});

app.listen(port, () => {
    console.log(`StreamFlow Proxy Server running at http://localhost:${port}`);
    console.log(`Try these test URLs:`);
    console.log(`1. Direct video: https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`);
    console.log(`2. YouTube: https://www.youtube.com/watch?v=LXb3EKWsInQ (test video - less likely to be blocked)`);
});