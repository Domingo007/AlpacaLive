import type { ChatMessage } from '@/types';
import { useI18n } from '@/lib/i18n';

interface MessageBubbleProps {
  message: ChatMessage;
  providerInfo?: { provider: string; model: string } | null;
}

export function MessageBubble({ message, providerInfo }: MessageBubbleProps) {
  const { t, lang } = useI18n();
  const isUser = message.role === 'user';
  const text = typeof message.content === 'string'
    ? message.content
    : message.content.filter(c => c.type === 'text').map(c => (c as { type: 'text'; text: string }).text).join('\n');

  const hasImages = Array.isArray(message.content) &&
    message.content.some(c => c.type === 'image');

  const locale = lang === 'pl' ? 'pl-PL' : lang === 'de' ? 'de-DE' : 'en-US';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} style={{ animation: 'bubble-enter 0.2s ease-out' }}>
      {!isUser && (
        <img src="/logo.png" alt="" className="w-7 h-7 rounded-lg bg-lavender-100 object-cover shrink-0 mr-2 mt-1"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <div
        className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-lavender-600 text-white rounded-[18px_18px_4px_18px] shadow-[0_1px_2px_rgba(45,31,84,0.15)]'
            : 'bg-bg-card text-text-primary rounded-[18px_18px_18px_4px] shadow-[0_4px_12px_rgba(45,31,84,0.08)] border border-lavender-100'
        }`}
      >
        {hasImages && (
          <div className="mb-2 text-xs opacity-70 flex items-center gap-1"><span className="material-symbols-rounded" style={{fontSize:14}}>photo_camera</span> {t.chat.photoAttached}</div>
        )}
        <div className="whitespace-pre-wrap">{text}</div>
        <div className={`text-[10px] mt-1.5 ${isUser ? 'text-white/50' : 'text-text-tertiary'}`}>
          {new Date(message.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
        </div>
        {!isUser && providerInfo && (
          <div className="text-[9px] text-text-tertiary mt-0.5">
            {providerInfo.provider} | PII Sanitizer
          </div>
        )}
      </div>
    </div>
  );
}
