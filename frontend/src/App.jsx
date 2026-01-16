import React, { useState } from 'react';
import VideoPlayer from './components/VideoPlayer';
import InputForm from './components/InputForm';

function App() {
  const [videoUrl, setVideoUrl] = useState('');

  return (

    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-950 text-gray-100 p-4 flex flex-col items-center">
      
      <header className="w-full max-w-4xl mt-4 mb-8 flex flex-col items-center text-center space-y-3 animate-fade-in">
        <div className="relative">
          <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 opacity-20 blur"></div>
          <h1 className="relative text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 tracking-tight">
            StreamFlow
          </h1>
        </div>
        <p className="text-gray-400 text-sm max-w-md font-light tracking-wide">
          Premium Real-time Streaming Experience
        </p>
      </header>

      <main className="w-full flex-1 flex flex-col items-center gap-6">
        <InputForm onSubmit={setVideoUrl} />
        
        {videoUrl && (
          <div className="w-full animate-fade-in flex flex-col items-center gap-4">
            <VideoPlayer videoUrl={videoUrl} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-4xl text-xs">
               <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1 hover:bg-gray-900/70 transition-all duration-300 hover:border-cyan-500/30 hover:scale-[1.02]">
                  <span className="text-cyan-400 font-bold tracking-wider uppercase text-[10px]">Technology</span>
                  <span className="text-gray-400">Proxy Streaming</span>
               </div>
               <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1 hover:bg-gray-900/70 transition-all duration-300 hover:border-blue-500/30 hover:scale-[1.02]">
                  <span className="text-blue-400 font-bold tracking-wider uppercase text-[10px]">Visuals</span>
                  <span className="text-gray-400">Buffered Chunks</span>
               </div>
               <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 p-3 rounded-xl flex flex-col items-center justify-center text-center gap-1 hover:bg-gray-900/70 transition-all duration-300 hover:border-cyan-500/30 hover:scale-[1.02]">
                  <span className="text-cyan-400 font-bold tracking-wider uppercase text-[10px]">Quality</span>
                  <span className="text-gray-400">Original Source</span>
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-8 mb-4 text-gray-600 text-xs font-light">
        &copy; {new Date().getFullYear()} StreamFlow
      </footer>
    </div>
  );
}

export default App;