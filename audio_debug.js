// 音声問題デバッグユーティリティ
class AudioDebugger {
    constructor() {
        this.isEnabled = false;
        this.debugPanel = null;
        this.init();
    }
    
    init() {
        // デバッグモードの切り替え（開発者用）
        if (window.location.search.includes('debug=audio')) {
            this.isEnabled = true;
            this.createDebugPanel();
        }
    }
    
    createDebugPanel() {
        this.debugPanel = document.createElement('div');
        this.debugPanel.id = 'audio-debug-panel';
        this.debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            max-width: 300px;
            z-index: 10000;
            display: none;
        `;
        
        document.body.appendChild(this.debugPanel);
    }
    
    showDebugInfo(info) {
        if (!this.isEnabled || !this.debugPanel) return;
        
        this.debugPanel.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold;">🔊 音声デバッグ情報</div>
            <div>文字: ${info.text || 'N/A'}</div>
            <div>ピンイン: ${info.pinyin || 'N/A'}</div>
            <div>音声言語: ${info.lang || 'N/A'}</div>
            <div>音声名: ${info.voiceName || 'N/A'}</div>
            <div>状態: ${info.status || 'N/A'}</div>
            <div>エラー: ${info.error || 'なし'}</div>
        `;
        
        this.debugPanel.style.display = 'block';
        
        // 5秒後に自動非表示
        setTimeout(() => {
            this.debugPanel.style.display = 'none';
        }, 5000);
    }
    
    log(message, data = null) {
        if (!this.isEnabled) return;
        
        console.log(`[音声デバッグ] ${message}`, data);
        
        if (this.debugPanel) {
            this.showDebugInfo({
                status: message,
                ...data
            });
        }
    }
    
    // 音声合成の状態をチェック
    checkSpeechSynthesis() {
        if (!window.speechSynthesis) {
            this.log('音声合成がサポートされていません');
            return false;
        }
        
        const voices = window.speechSynthesis.getVoices();
        this.log('利用可能な音声数', voices.length);
        
        const chineseVoices = voices.filter(v => 
            v.lang.startsWith('zh') || v.lang.startsWith('cmn')
        );
        
        this.log('中国語音声数', chineseVoices.length);
        
        if (chineseVoices.length > 0) {
            this.log('中国語音声詳細', chineseVoices.map(v => ({
                name: v.name,
                lang: v.lang,
                default: v.default
            })));
        }
        
        return true;
    }
    
    // 音声再生のテスト
    testAudio(text = '你好') {
        if (!window.speechSynthesis) {
            this.log('音声合成がサポートされていません');
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.7;
        
        utterance.onstart = () => {
            this.log('テスト音声再生開始', { text, lang: utterance.lang });
        };
        
        utterance.onend = () => {
            this.log('テスト音声再生完了', { text });
        };
        
        utterance.onerror = (event) => {
            this.log('テスト音声再生エラー', { error: event.error, text });
        };
        
        window.speechSynthesis.speak(utterance);
    }
}

// グローバルインスタンスを作成
window.audioDebugger = new AudioDebugger();

// 開発者コンソールからアクセス可能にする
window.testAudio = (text) => window.audioDebugger.testAudio(text);
window.checkAudio = () => window.audioDebugger.checkSpeechSynthesis(); 