import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Monitor, Share, Check, Copy, ExternalLink, X } from 'lucide-react';
import previewImg from '../assets/images/carnival_maze_preview_1794668974857.jpg';

interface PWAInstallButtonProps {
  variant?: 'header' | 'action';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, platform, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'desktop'>(
    platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'desktop'
  );
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setActiveTab(platform);
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in some embedded contexts
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          variant === 'header'
            ? 'min-h-[44px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-pink-500/20 hover:from-cyan-500/30 hover:to-pink-500/30 border border-cyan-400/40 text-xs font-extrabold text-cyan-200 hover:text-white transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0'
            : 'min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14142d] hover:bg-[#1d1d42] border border-cyan-500/40 text-xs font-bold text-cyan-300 transition-all cursor-pointer shadow-sm whitespace-nowrap shrink-0'
        }
        aria-label="Download or install NO ESCAPE app on your device"
      >
        <Download className="w-4 h-4 text-cyan-400 shrink-0" />
        <span>{isInstallable ? 'Install App' : 'Get App'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-modal-title"
        >
          <div className="bg-[#121126] border border-white/20 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3
                id="install-modal-title"
                className="text-base sm:text-lg font-black text-cyan-300 flex items-center gap-2"
              >
                <Smartphone className="w-5 h-5 text-pink-400" />
                Install on Any Device
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Close install instructions"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Game Preview Photo */}
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0b0a1d] aspect-video">
              {!imgError ? (
                <img
                  src={previewImg}
                  alt="NO ESCAPE 2D Carnival Maze gameplay preview"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-xs text-white/60 bg-gradient-to-br from-[#19163a] to-[#0b0a1d]">
                  <span className="text-2xl">🎪</span>
                  <span className="font-bold text-white">NO ESCAPE · 2D Carnival Maze</span>
                </div>
              )}
            </div>

            <p className="text-xs text-white/75 leading-relaxed">
              Play solo maze modes offline anytime or race online from your home screen on iPhone, iPad, Android, Chromebook, Mac, or Windows.
            </p>

            {/* Device Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#1b1938] rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'ios'
                    ? 'bg-pink-600 text-white'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                iPhone / iPad
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'android'
                    ? 'bg-pink-600 text-white'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Android
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('desktop')}
                className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'desktop'
                    ? 'bg-pink-600 text-white'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Desktop
              </button>
            </div>

            {/* Instructions per Device */}
            <div className="p-3.5 rounded-2xl bg-[#191734] border border-white/10 text-xs text-white/85 space-y-2">
              {activeTab === 'ios' && (
                <>
                  <div className="font-bold text-pink-300 flex items-center gap-1.5">
                    <Share className="w-4 h-4" /> Safari on iOS / iPadOS
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-white/75">
                    <li>Open this game in <strong>Safari</strong> (tap Open Standalone below if embedded).</li>
                    <li>Tap the <strong>Share</strong> icon in the Safari toolbar.</li>
                    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                  </ol>
                </>
              )}
              {activeTab === 'android' && (
                <>
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" /> Chrome / Edge on Android
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-white/75">
                    <li>Open in <strong>Chrome</strong> or <strong>Edge</strong> (tap Open Standalone if in an embedded frame).</li>
                    <li>Tap the <strong>⋮ Menu</strong> in the top corner.</li>
                    <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                  </ol>
                </>
              )}
              {activeTab === 'desktop' && (
                <>
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Monitor className="w-4 h-4" /> Chrome / Edge / Chromebook
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-white/75">
                    <li>Open the standalone window using the button below.</li>
                    <li>Click the <strong>Install</strong> icon in the browser address bar.</li>
                    <li>Launch NO ESCAPE directly from your Dock, Start Menu, or Launcher.</li>
                  </ol>
                </>
              )}
            </div>

            {/* Utility Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="min-h-[44px] px-3 py-2.5 rounded-xl bg-[#1e1c40] hover:bg-[#292654] border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-cyan-400" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-3 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-xs font-extrabold text-white flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Standalone</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
