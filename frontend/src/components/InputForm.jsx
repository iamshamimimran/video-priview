import React, { useState } from 'react';
import { FaLink, FaPlay } from 'react-icons/fa';

const InputForm = ({ onSubmit }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto z-10">
      <div className="relative group transition-all duration-500 hover:scale-[1.005]">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl opacity-20 group-hover:opacity-30 transition duration-500 blur-sm"></div>
        <div className="relative flex items-center bg-gray-900/80 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 shadow-xl">
          <div className="pl-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors duration-300">
            <FaLink size={16} />
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste source link..."
            className="w-full px-4 py-3 bg-transparent outline-none text-gray-100 placeholder-gray-600 font-light tracking-wide text-sm sm:text-base"
          />
          <button
            type="submit"
            className="mr-1.5 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium transition-all duration-300 flex items-center gap-2 border border-gray-700 active:scale-95 hover:text-cyan-400 hover:border-cyan-500/30 text-xs sm:text-sm"
          >
            <FaPlay size={10} />
            <span>Stream</span>
          </button>
        </div>
      </div>
    </form>
  );
};

export default InputForm;