import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { QuickActions } from './QuickActions';
import { PatternCards } from './PatternCards';
import { DisclaimerBanner } from '@/components/shared/DisclaimerBanner';
import { Icon } from '@/components/shared/Icon';
import { UnknownDrugBubble } from '@/components/shared/UnknownDrugBubble';
import { useI18n } from '@/lib/i18n';
import { guardMessage, guardFile, checkRateLimit, MAX_MESSAGE_LENGTH } from '@/lib/input-guard';
import { buildUnknownDrugIssueUrl } from '@/lib/medical-data/unknown-drug-feedback';

export function ChatView() {
  const { messages, isLoading, error, send, lastPrediction, lastProviderInfo, unknownDrugs, dismissUnknownDrugs } = useChat();
  const [input, setInput] = useState('');
  const [guardError, setGuardError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, lang } = useI18n();

  function handleReportUnknown(drugs: string[]) {
    const provider = (() => {
      try { return localStorage.getItem('alpacalive-ai-provider') || 'unknown'; } catch { return 'unknown'; }
    })();
    const url = buildUnknownDrugIssueUrl(drugs, { language: lang, context: 'chat', aiProvider: provider });
    window.open(url, '_blank', 'noopener');
    dismissUnknownDrugs();
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  async function handleSend() {
    const text = input.trim();
    if (!text && !isLoading) return;

    // Rate limit
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      setGuardError(rateCheck.reason || null);
      setTimeout(() => setGuardError(null), 3000);
      return;
    }

    // Input guard
    const guard = guardMessage(text);
    if (!guard.allowed) {
      setGuardError(guard.reason || null);
      setTimeout(() => setGuardError(null), 5000);
      return;
    }

    setGuardError(null);
    setInput('');
    await send(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // File guard
    const fileCheck = guardFile(file);
    if (!fileCheck.allowed) {
      setGuardError(fileCheck.reason || null);
      setTimeout(() => setGuardError(null), 5000);
      e.target.value = '';
      return;
    }

    // Rate limit
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      setGuardError(rateCheck.reason || null);
      setTimeout(() => setGuardError(null), 3000);
      e.target.value = '';
      return;
    }

    setGuardError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const mediaType = file.type;
      await send(input || t.chat.analyzePhoto, [{ base64, mediaType }]);
      setInput('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleQuickAction(prompt: string) {
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) return;
    send(prompt);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            providerInfo={msg.role === 'assistant' && i === messages.length - 1 ? lastProviderInfo : undefined}
          />
        ))}
        {isLoading && (
          <div className="bg-bg-card border border-lavender-100 rounded-2xl px-4 py-3 mx-1 shadow-[0_4px_12px_rgba(45,31,84,0.08)]">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-lavender-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-lavender-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-lavender-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-text-secondary">{t.chat.analyzing}</span>
            </div>
            <div className="text-[9px] text-text-secondary mt-1">
              <Icon name="lock" size={12} className="inline-block mr-0.5" /> {t.chat.piiRemoved}
            </div>
          </div>
        )}
        {lastPrediction && (
          <div className="px-1">
            <PatternCards result={lastPrediction} />
          </div>
        )}
        {(error || guardError) && (
          <div className={`text-sm rounded-lg p-3 flex items-start gap-2 ${
            guardError ? 'bg-alert-warning/10 text-alert-warning' : 'bg-alert-critical/10 text-alert-critical'
          }`}>
            <Icon name={guardError ? 'shield' : 'error'} size={18} className="shrink-0 mt-0.5" />
            <span>{guardError || error}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <QuickActions onAction={handleQuickAction} />
      <DisclaimerBanner variant="chat" />

      <div className="border-t border-lavender-100 bg-bg-card px-3 py-2 safe-bottom">
        {unknownDrugs.length > 0 && (
          <UnknownDrugBubble
            context="chat"
            unknownDrugs={unknownDrugs}
            onReport={handleReportUnknown}
            onDismiss={dismissUnknownDrugs}
          />
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-xl bg-lavender-50 border-[1.5px] border-lavender-200 text-lavender-500 flex items-center justify-center shrink-0"
            title={t.chat.addPhoto}
          >
            <Icon name="photo_camera" size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder={t.chat.placeholder}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={1}
              className="w-full resize-none rounded-2xl border-[1.5px] border-lavender-200 px-4 py-3 text-[15px] bg-lavender-50 text-text-primary focus:outline-none focus:border-lavender-500 focus:shadow-[0_0_0_3px_rgba(155,122,232,0.15)] min-h-[44px] max-h-[120px]"
              style={{ height: 'auto', overflow: 'hidden' }}
              onInput={e => {
                const ta = e.currentTarget;
                ta.style.height = 'auto';
                ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
              }}
            />
            {input.length > MAX_MESSAGE_LENGTH * 0.8 && (
              <div className={`absolute right-2 bottom-1 text-[9px] ${input.length >= MAX_MESSAGE_LENGTH ? 'text-alert-critical' : 'text-text-tertiary'}`}>
                {input.length}/{MAX_MESSAGE_LENGTH}
              </div>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-11 h-11 rounded-xl bg-lavender-500 text-white disabled:bg-lavender-200 shrink-0 flex items-center justify-center shadow-[0_4px_12px_rgba(45,31,84,0.15)]"
          >
            <Icon name="arrow_upward" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
