// 中国語学習ゲームエンジン - 6レベル・セット制対応

// ===== 復習機能ユーティリティ =====
class ReviewStore {
    constructor() {
        this.storageKey = 'review:v1';
        this.items = this.load();
    }

    // 簡易ハッシュ生成
    generateId(question, answer) {
        const str = `${question.chinese}${question.pinyin}${answer}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit整数に変換
        }
        return Math.abs(hash).toString(36);
    }

    // 問題を復習リストに追加
    add(question, choices, answer, meta = {}) {
        const id = this.generateId(question, answer);
        
        // 重複チェック
        if (this.items.find(item => item.id === id)) {
            return false;
        }

        const reviewItem = {
            id,
            question,
            choices,
            answer,
            meta
        };

        this.items.push(reviewItem);
        this.save();
        return true;
    }

    // 問題を復習リストから削除
    remove(id) {
        this.items = this.items.filter(item => item.id !== id);
        this.save();
    }

    // 全問題を取得
    getAll() {
        return this.items;
    }

    // 指定されたIDの問題を取得
    getByIds(ids) {
        return this.items.filter(item => ids.includes(item.id));
    }

    // ローカルストレージから読み込み
    load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('復習データの読み込みに失敗:', e);
            return [];
        }
    }

    // ローカルストレージに保存
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        } catch (e) {
            console.error('復習データの保存に失敗:', e);
        }
    }

    // 全データをクリア
    clear() {
        this.items = [];
        this.save();
    }
}

class ChineseVocabGame {
    constructor() {
        this.gameState = {
            selectedLevel: null,
            currentQuestion: 0,
            correctAnswers: 0,
            totalQuestions: 0,
            questions: [],
            isGameActive: false,
            questionSet: null,
            isReviewMode: false  // 復習モードフラグを追加
        };
        
        // ===== セッション状態 =====
        this.quizSession = {
            level: null,           // 開始時に上書き
            questions: [],         // 5問を保存
            attempt: 0,            // 0=初回, 1=2回目...
            imageIndex: null       // 1..5 固定画像番号（初回結果で決定）
        };
        
        // 復習ストアを初期化
        this.reviewStore = new ReviewStore();
        
        this.elements = {
            // 画面要素
            startScreen: document.getElementById('start-screen'),
            gameScreen: document.getElementById('game-screen'),
            resultScreen: document.getElementById('result-screen'),
            reviewScreen: document.getElementById('review-screen'),
            
            // スタート画面
            level1Btn: document.getElementById('level1-btn'),
            level2Btn: document.getElementById('level2-btn'),
            level3Btn: document.getElementById('level3-btn'),
            level4Btn: document.getElementById('level4-btn'),
            level5Btn: document.getElementById('level5-btn'),
            level6Btn: document.getElementById('level6-btn'),
            reviewBtn: document.getElementById('review-btn'),

            
            // ゲーム画面
            backToHomeBtn: document.getElementById('back-to-home-btn'),
            currentLevel: document.getElementById('current-level'),
            progressIndicator: document.getElementById('progress-indicator'),
            correctCount: document.getElementById('correct-count'),
            
            // 問題表示
            textQuestion: document.getElementById('text-question'),
            audioQuestion: document.getElementById('audio-question'),
            chineseText: document.getElementById('chinese-text'),
            pinyinText: document.getElementById('pinyin-text'),
            playAudioBtn: document.getElementById('play-audio-btn'),
            
            // 選択肢
            choiceBtns: document.querySelectorAll('.choice-btn'),
            feedbackMessage: document.getElementById('feedback-message'),
            audioAnswerDisplay: document.getElementById('audio-answer-display'),
            audioAnswerChinese: document.getElementById('audio-answer-chinese'),
            audioAnswerPinyin: document.getElementById('audio-answer-pinyin'),
            
            // 結果画面
            resultTitle: document.getElementById('result-title'),
            scorePercent: document.getElementById('score-percent'),
            praiseSection: document.getElementById('praise-section'),
            praiseChinese: document.getElementById('praise-chinese'),
            praiseJapanese: document.getElementById('praise-japanese'),
            rewardImage: document.getElementById('reward-image'),
            
            // 結果画面のボタン
            retryBtn: document.getElementById('retry-btn'),
            nextSetBtn: document.getElementById('next-set-btn'),
            pairLevelBtn: document.getElementById('pair-level-btn'),
            otherLevelBtn: document.getElementById('other-level-btn'),
            homeBtn: document.getElementById('home-btn'),
            backToReviewBtn: document.getElementById('back-to-review-btn'),
            
            // 復習画面
            reviewList: document.getElementById('review-list'),
            reviewSelectAllBtn: document.getElementById('review-select-all-btn'),
            reviewDeselectAllBtn: document.getElementById('review-deselect-all-btn'),
            reviewStartBtn: document.getElementById('review-start-btn'),
            reviewBackBtn: document.getElementById('review-back-btn'),
            reviewEmptyMessage: document.getElementById('review-empty-message')
        };
        
        this.speechSynthesis = window.speechSynthesis;
        this.currentQuestion = null;
        this.autoPlayTimeout = null;
        this.lastDisplayedImages = {};
        
        // 音効果のための音声要素を作成
        this.initializeSounds();
        
        this.initializeGame();
    }

    // ===== 正答率→フォルダ対応 =====
    scoreToFolder(score, totalQuestions) {
        const percentage = Math.round((score / totalQuestions) * 100);
        
        if (percentage >= 81) return 'images0';    // 81%〜100%
        if (percentage >= 61) return 'images20';   // 61%〜80%
        if (percentage >= 41) return 'images50';   // 41%〜60%
        if (percentage >= 21) return 'images70';   // 21%〜40%
        return 'images100';                        // 0%〜20%
    }

    // ===== 画像パス生成 =====
    pad2(n) { 
        return String(n).padStart(2, '0'); 
    }
    
    imagePathBy(folder, index) {
        const id = this.pad2(index); // "01".."05"
        if (folder === 'images0') return `./${folder}/${id}.png`;
        const percent = folder.replace('images', ''); // "20"|"50"|"70"|"100"
        return `./${folder}/${id}_mosaic_${percent}.png`;
    }

    initializeSounds() {
        // Web Audio APIを使用してシンプルな音効果を生成
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio context not supported');
            this.audioContext = null;
        }
    }

    playCorrectSound() {
        if (!this.audioContext) return;
        
        // 正解音：明るいピンポン音
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }

    playIncorrectSound() {
        if (!this.audioContext) return;
        
        // 不正解音：低いブー音
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }

    initializeGame() {
        this.bindEvents();
        this.lastDisplayedImages = {};
        this.showScreen('start');
    }
    
    setupEventListeners() {
        // レベル選択ボタン
        this.elements.level1Btn.addEventListener('click', () => this.startLevel(1));
        this.elements.level2Btn.addEventListener('click', () => this.startLevel(2));
        this.elements.level3Btn.addEventListener('click', () => this.startLevel(3));
        this.elements.level4Btn.addEventListener('click', () => this.startLevel(4));
        this.elements.level5Btn.addEventListener('click', () => this.startLevel(5));
        this.elements.level6Btn.addEventListener('click', () => this.startLevel(6));

        
        // ゲーム内ボタン
        this.elements.backToHomeBtn.addEventListener('click', () => this.goHome());
        
        // 結果画面ボタン
        this.elements.retryBtn.addEventListener('click', () => this.retryLevel());
        this.elements.pairLevelBtn.addEventListener('click', () => this.gotoPairLevel());
        this.elements.otherLevelBtn.addEventListener('click', () => this.showLevelSelection());
        this.elements.homeBtn.addEventListener('click', () => this.goHome());
        
        // 選択肢ボタン
        this.elements.choiceBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => this.selectAnswer(index));
        });
    }
    
    startLevel(level) {
        this.startNewSet(level);
    }
    
    // ===== 5問でプレイを開始（新しいセットを作るときだけ呼ぶ）=====
    startNewSet(level) {
        console.log(`=== 新しいセット開始 ===`);
        console.log(`選択されたレベル: ${level}`);
        
        this.gameState.selectedLevel = level;
        this.gameState.currentQuestion = 0;
        this.gameState.correctAnswers = 0;
        this.gameState.totalQuestions = gameRules.settings.questionsPerLevel;
        this.gameState.isGameActive = true;
        
        // レベル設定を取得（先に取得）
        const levelConfig = gameRules.settings.levels[level];
        this.gameState.hskLevel = levelConfig.hskLevel;
        
        console.log(`レベル設定:`, levelConfig);
        console.log(`HSK等級: ${this.gameState.hskLevel}`);
        
        // セッション状態を更新
        this.quizSession.level = level;
        this.quizSession.questions = this.generateQuestionsFromHSKLevel();
        this.quizSession.attempt = 0;
        this.quizSession.imageIndex = null; // 初回結果で決める
        
        // UI更新
        this.elements.currentLevel.textContent = levelConfig.name;
        this.updateDisplay();
        
        this.showScreen('game');
        this.loadQuestion();
    }
    
    generateQuestionsFromHSKLevel() {
        // 指定されたHSK等級から問題を生成
        console.log(`=== 問題生成デバッグ ===`);
        console.log(`HSK等級: ${this.gameState.hskLevel}`);
        console.log(`問題数: ${this.gameState.totalQuestions}`);
        
        const questions = gameRules.getRandomWordsFromHSKLevel(
            this.gameState.hskLevel, 
            this.gameState.totalQuestions
        );
        
        console.log(`生成された問題:`, questions);
        console.log(`問題数確認: ${questions.length}`);
        
        this.gameState.questions = questions;
        return questions;
    }
    
    loadQuestion() {
        if (this.gameState.currentQuestion >= this.gameState.totalQuestions) {
            this.endLevel();
            return;
        }
        
        const question = this.gameState.questions[this.gameState.currentQuestion];
        
        // デバッグ: 問題が正しく読み込まれているか確認
        console.log(`=== 問題読み込みデバッグ ===`);
        console.log(`復習モード: ${this.gameState.isReviewMode}`);
        console.log(`現在の問題番号: ${this.gameState.currentQuestion}`);
        console.log(`問題オブジェクト:`, question);
        console.log(`問題数: ${this.gameState.questions.length}`);
        
        if (!question) {
            console.error('問題が見つかりません！');
            return;
        }
        
        const level = this.gameState.selectedLevel;
        const levelConfig = gameRules.settings.levels[level];
        
        // プログレス更新
        this.elements.progressIndicator.textContent = 
            `${this.gameState.currentQuestion + 1}/${this.gameState.totalQuestions}`;
        this.elements.correctCount.textContent = this.gameState.correctAnswers;
        
        // 問題表示
        this.showQuestion(question);
        
        // フィードバックリセット
        this.resetFeedback();
    }
    
    showQuestion(question) {
        const level = this.gameState.selectedLevel;
        const levelConfig = gameRules.settings.levels[level];
        
        // 復習モードの場合は元の問題タイプを使用
        let questionType;
        if (this.gameState.isReviewMode && question.questionType) {
            questionType = question.questionType;
        } else {
            questionType = levelConfig.type;
        }
        
        // 問題タイプに応じて表示切り替え
        if (questionType === 'text') {
            this.showTextQuestion(question);
        } else if (questionType === 'audio') {
            this.showAudioQuestion(question);
        }
        
        // 選択肢生成（復習モードの場合は保存された選択肢を使用）
        if (this.gameState.isReviewMode && question.reviewItem && question.reviewItem.choices) {
            this.generateReviewChoices(question.reviewItem.choices, question.japanese);
        } else {
            this.generateChoices(question);
        }
        
        // 現在の質問を保存
        this.currentQuestion = question;
    }
    
    showTextQuestion(question) {
        this.elements.textQuestion.style.display = 'block';
        this.elements.audioQuestion.style.display = 'none';
        this.elements.chineseText.textContent = question.chinese;
        this.elements.pinyinText.textContent = question.pinyin;
    }
    
    showAudioQuestion(question) {
        this.elements.textQuestion.style.display = 'none';
        this.elements.audioQuestion.style.display = 'block';
        this.currentQuestion = question; // 音声再生用に保存
        
        // 音声問題開始時に自動音声再生
        this.autoPlayTimeout = setTimeout(() => {
            this.playAudio();
        }, 500); // 0.5秒後に自動再生
    }
    
    generateChoices(question) {
        // 現在のHSK等級から間違い選択肢を生成
        const hskLevel = gameRules.settings.levels[this.gameState.selectedLevel].hskLevel;
        const levelWords = gameRules.getVocabularyByHSKLevel(hskLevel);
        
        console.log('=== 選択肢生成デバッグ ===');
        console.log('正解:', question.japanese);
        console.log('HSK等級:', hskLevel);
        console.log('等級内語彙数:', levelWords.length);
        console.log('等級内語彙:', levelWords.map(w => w.japanese));
        
        // 正解の質問オブジェクトを渡して間違い選択肢を生成
        const wrongOptions = gameRules.generateWrongOptions(question, levelWords, 3);
        console.log('生成された間違い選択肢:', wrongOptions);
        
        // 正解と間違い選択肢を結合
        const choices = [question.japanese, ...wrongOptions];
        console.log('結合後の選択肢:', choices);
        
        // 重複チェック（念のため）
        const uniqueChoices = [...new Set(choices)];
        console.log('重複除去後:', uniqueChoices);
        
        // 4つの選択肢が揃わない場合は警告と補完
        if (uniqueChoices.length < 4) {
            console.warn('選択肢の重複が発生しました:', choices);
            console.warn('重複除去後:', uniqueChoices);
            
            // 不足分を他のHSK等級から補完
            const additionalOptions = [];
            for (let hskLevel = 1; hskLevel <= 3; hskLevel++) {
                if (hskLevel !== this.gameState.hskLevel) {
                    const otherLevelWords = gameRules.getVocabularyByHSKLevel(hskLevel);
                    const additional = gameRules.generateWrongOptions(question, otherLevelWords, 4 - uniqueChoices.length);
                    additionalOptions.push(...additional);
                }
            }
            
            // 追加の選択肢も重複チェック
            additionalOptions.forEach(option => {
                if (!uniqueChoices.includes(option)) {
                    uniqueChoices.push(option);
                }
            });
            
            console.warn('補完後の選択肢:', uniqueChoices);
        }
        
        // 最終的に4つの選択肢を確保
        const finalChoices = uniqueChoices.slice(0, 4);
        
        // 4つ揃わない場合のフォールバック
        while (finalChoices.length < 4) {
            finalChoices.push(`選択肢${finalChoices.length + 1}`);
        }
        
        const shuffledChoices = finalChoices.sort(() => 0.5 - Math.random());
        console.log('最終的な選択肢:', shuffledChoices);
        
        // 正解のインデックスを記録
        this.correctIndex = shuffledChoices.indexOf(question.japanese);
        console.log('正解インデックス:', this.correctIndex);
        
        // 正解インデックスが見つからない場合の警告
        if (this.correctIndex === -1) {
            console.error('正解が選択肢に含まれていません!');
            console.error('正解:', question.japanese);
            console.error('選択肢:', shuffledChoices);
        }
        
        // 選択肢をボタンに設定
        this.elements.choiceBtns.forEach((btn, index) => {
            btn.textContent = shuffledChoices[index] || `選択肢${index + 1}`;
            btn.className = 'choice-btn'; // クラスリセット
            btn.disabled = false;
        });
        
        console.log('=== デバッグ終了 ===\n');
    }
    
    generateReviewChoices(savedChoices, correctAnswer) {
        console.log('=== 復習選択肢生成デバッグ ===');
        console.log('保存された選択肢:', savedChoices);
        console.log('正解:', correctAnswer);
        
        // 保存された選択肢をシャッフル
        const shuffledChoices = [...savedChoices].sort(() => 0.5 - Math.random());
        console.log('シャッフル後の選択肢:', shuffledChoices);
        
        // 正解のインデックスを記録
        this.correctIndex = shuffledChoices.indexOf(correctAnswer);
        console.log('正解インデックス:', this.correctIndex);
        
        // 正解インデックスが見つからない場合の警告
        if (this.correctIndex === -1) {
            console.error('正解が選択肢に含まれていません!');
            console.error('正解:', correctAnswer);
            console.error('選択肢:', shuffledChoices);
            // フォールバック: 正解を最初に配置
            shuffledChoices[0] = correctAnswer;
            this.correctIndex = 0;
        }
        
        // 選択肢をボタンに設定
        this.elements.choiceBtns.forEach((btn, index) => {
            btn.textContent = shuffledChoices[index] || `選択肢${index + 1}`;
            btn.className = 'choice-btn'; // クラスリセット
            btn.disabled = false;
        });
        
        console.log('=== 復習選択肢デバッグ終了 ===\n');
    }
    
    selectAnswer(selectedIndex) {
        console.log(`=== 回答選択デバッグ ===`);
        console.log(`復習モード: ${this.gameState.isReviewMode}`);
        console.log(`選択されたインデックス: ${selectedIndex}`);
        console.log(`正解インデックス: ${this.correctIndex}`);
        console.log(`ゲームアクティブ: ${this.gameState.isGameActive}`);
        console.log(`現在の問題:`, this.currentQuestion);
        
        if (!this.gameState.isGameActive) {
            console.log('ゲームがアクティブではありません');
            return;
        }
        
        // 自動再生タイマーをクリア
        if (this.autoPlayTimeout) {
            clearTimeout(this.autoPlayTimeout);
        }
        
        // 選択肢を無効化
        this.elements.choiceBtns.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
        });
        
        const isCorrect = selectedIndex === this.correctIndex;
        console.log(`正解判定: ${isCorrect}`);
        
        // 視覚的フィードバック
        this.elements.choiceBtns[selectedIndex].classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect) {
            this.elements.choiceBtns[this.correctIndex].classList.add('correct');
        }
        
        // 正解数カウント
        if (isCorrect) {
            this.gameState.correctAnswers++;
            this.showFeedback('正解！', 'correct');
            this.playCorrectSound();
        } else {
            this.showFeedback('残念...', 'incorrect');
            this.playIncorrectSound();
            // 不正解時に復習登録（復習モードでは登録しない）
            if (!this.gameState.isReviewMode) {
                const levelConfig = gameRules.settings.levels[this.gameState.selectedLevel];
                // 現在の選択肢を固定順序で保存（正解を含む4つの選択肢）
                const currentChoices = Array.from(this.elements.choiceBtns).map(btn => btn.textContent);
                this.reviewStore.add(
                    this.currentQuestion, 
                    currentChoices, 
                    this.currentQuestion.japanese,
                    { 
                        level: this.gameState.selectedLevel, 
                        type: 'wrong',
                        questionType: levelConfig.type // 文字問題か音声問題かを保存
                    }
                );
            }
        }

        // 音声問題の場合は中国語とピンインを表示
        this.showAudioAnswer();
        
        // 次の問題へ
        setTimeout(() => {
            this.gameState.currentQuestion++;
            this.loadQuestion();
        }, 2000);
    }
    
    showFeedback(message, type) {
        this.elements.feedbackMessage.textContent = message;
        this.elements.feedbackMessage.className = `feedback-message ${type}`;
    }
    
    resetFeedback() {
        this.elements.feedbackMessage.textContent = '';
        this.elements.feedbackMessage.className = 'feedback-message';
        this.hideAudioAnswer();
    }

    showAudioAnswer() {
        // 音声問題の場合は中国語とピンインを表示
        const levelConfig = gameRules.settings.levels[this.gameState.selectedLevel];
        
        // 復習モードの場合は元の問題タイプを確認
        let isAudioQuestion = false;
        if (this.gameState.isReviewMode && this.currentQuestion.questionType) {
            isAudioQuestion = this.currentQuestion.questionType === 'audio';
        } else {
            isAudioQuestion = levelConfig && levelConfig.type === 'audio';
        }
        
        if (isAudioQuestion && this.currentQuestion) {
            this.elements.audioAnswerChinese.textContent = this.currentQuestion.chinese;
            this.elements.audioAnswerPinyin.textContent = this.currentQuestion.pinyin;
            this.elements.audioAnswerDisplay.style.display = 'block';
        }
    }

    hideAudioAnswer() {
        // 音声答えの表示を隠す
        this.elements.audioAnswerDisplay.style.display = 'none';
    }
    
    playAudio() {
        if (!this.currentQuestion) return;
        
        // 既存の音声を停止
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        
        // 中国語音声合成（中国語の文字を読み上げ）
        const utterance = new SpeechSynthesisUtterance(this.currentQuestion.chinese);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8;
        utterance.pitch = 1;
        
        this.speechSynthesis.speak(utterance);
    }
    
    endLevel() {
        // ゲームを非アクティブにする
        this.gameState.isGameActive = false;
        
        const score = this.gameState.correctAnswers;
        const percentage = Math.round((score / this.gameState.totalQuestions) * 100);
        
        // 最終結果画面表示
        this.showFinalResult(score, percentage);
    }
    
    showFinalResult(score, percentage) {
        this.elements.scorePercent.textContent = percentage;
        
        const level = this.gameState.selectedLevel;
        if (this.gameState.isReviewMode) {
            this.elements.resultTitle.textContent = '復習 最終結果';
        } else {
            const levelConfig = gameRules.settings.levels[level];
            this.elements.resultTitle.textContent = `${levelConfig.name} 最終結果`;
        }
        
        // ペアレベルボタンの表示制御
        this.setupPairLevelButton();
        
        // 復習モードの場合は復習一覧ボタンを表示し、もう一度ボタンのテキストを変更
        if (this.gameState.isReviewMode) {
            this.elements.backToReviewBtn.style.display = 'inline-block';
            this.elements.pairLevelBtn.style.display = 'none';
            // もう一度ボタンのテキストを復習用に変更
            if (this.elements.retryBtn) {
                this.elements.retryBtn.textContent = '復習を再開';
            }
        } else {
            this.elements.backToReviewBtn.style.display = 'none';
            // もう一度ボタンのテキストを通常用に戻す
            if (this.elements.retryBtn) {
                this.elements.retryBtn.textContent = 'もう一度';
            }
        }
        
        // 結果に応じたメッセージと画像表示
        this.showResultMessage(percentage);
        this.showRandomImage(percentage);
        
        this.showScreen('result');
    }
    
    setupPairLevelButton() {
        const level = this.gameState.selectedLevel;
        const pairLevel = this.getPairLevel(level);
        
        if (pairLevel) {
            this.elements.pairLevelBtn.textContent = `レベル${pairLevel}へ`;
            this.elements.pairLevelBtn.style.display = 'inline-block';
        } else {
            this.elements.pairLevelBtn.style.display = 'none';
        }
    }
    
    getPairLevel(level) {
        // レベルのペア関係（HSK等級別）
        const pairs = {
            1: 2, 2: 1,   // HSK1級
            3: 4, 4: 3,   // HSK2級  
            5: 6, 6: 5    // HSK3級
        };
        return pairs[level];
    }
    
    gotoPairLevel() {
        const pairLevel = this.getPairLevel(this.gameState.selectedLevel);
        if (pairLevel) {
            this.startLevel(pairLevel);
        }
    }
    
    showResultMessage(percentage) {
        const correctCount = this.gameState.correctAnswers;
        const totalQuestions = this.gameState.totalQuestions;
        
        if (percentage >= 81) {
            // 81%以上 - 最高の褒め言葉
            this.elements.praiseChinese.textContent = '太棒了！';
            this.elements.praiseJapanese.textContent = '完璧です！';
        } else if (percentage >= 61) {
            // 61%〜80% - 褒め言葉
            const randomPraise = gameRules.praises[Math.floor(Math.random() * gameRules.praises.length)];
            this.elements.praiseChinese.textContent = randomPraise.chinese;
            this.elements.praiseJapanese.textContent = randomPraise.japanese;
        } else if (percentage >= 41) {
            // 41%〜60% - 軽い励まし
            this.elements.praiseChinese.textContent = '不错！';
            this.elements.praiseJapanese.textContent = 'よくできました！';
        } else if (percentage >= 21) {
            // 21%〜40% - 励まし
            this.elements.praiseChinese.textContent = '不错！';
            this.elements.praiseJapanese.textContent = 'よくできました！';
        } else {
            // 0%〜20% - 励まし
            this.elements.praiseChinese.textContent = '加油！';
            this.elements.praiseJapanese.textContent = '頑張って！';
        }
        this.elements.praiseSection.style.display = 'block';
    }
    
    async showRandomImage(percentage) {
        try {
            // 正解数に応じて画像フォルダを選択
            const correctCount = this.gameState.correctAnswers;
            const totalQuestions = this.gameState.totalQuestions;
            
            // 初回終了時だけ、固定画像番号を決める（1..5）
            if (this.quizSession.imageIndex == null) {
                this.quizSession.imageIndex = Math.floor(Math.random() * 5) + 1;
                console.log(`固定画像番号決定: ${this.quizSession.imageIndex}`);
            }
            
            const folder = this.scoreToFolder(correctCount, totalQuestions);
            const imgSrc = this.imagePathBy(folder, this.quizSession.imageIndex);
            
            console.log(`正解数: ${correctCount}/${totalQuestions}, 選択フォルダ: ${folder}, 画像番号: ${this.quizSession.imageIndex}`);
            
            this.elements.rewardImage.src = imgSrc;
            this.elements.rewardImage.style.display = 'block';
            this.elements.rewardImage.loading = 'eager';
            this.elements.rewardImage.decoding = 'sync';
            
            // エラーハンドリング
            this.elements.rewardImage.onerror = () => {
                console.log(`画像読み込みエラー: ${imgSrc}`);
                // 念のためフォールバック（必ず存在する1枚を指定）
                this.elements.rewardImage.src = this.imagePathBy('images100', this.quizSession.imageIndex);
            };
            
            console.log(`表示画像: ${imgSrc}`);
            
        } catch (error) {
            console.log('画像表示エラー:', error);
            this.elements.rewardImage.style.display = 'none';
        }
    }
    

    
    retryLevel() {
        if (this.gameState.isReviewMode) {
            // ===== 復習モード：「もう一度」で同じ復習問題を再開始 =====
            console.log('復習問題を再開始します');
            
            // 復習問題の状態をリセット
            this.gameState.currentQuestion = 0;
            this.gameState.correctAnswers = 0;
            this.gameState.isGameActive = true;
            
            // 選択肢ボタンの状態をリセット
            this.elements.choiceBtns.forEach(btn => {
                btn.disabled = false;
                btn.className = 'choice-btn';
                btn.classList.remove('correct', 'incorrect', 'disabled');
            });
            
            // フィードバックをリセット
            this.resetFeedback();
            
            // 同じ復習問題セットを使用
            // this.gameState.questions は既に設定済み
            
            this.showScreen('game');
            this.loadQuestion();
        } else {
            // ===== 通常モード：「もう一度」で同じ5問で再挑戦 =====
            this.quizSession.attempt += 1;
            this.gameState.currentQuestion = 0;
            this.gameState.correctAnswers = 0;
            this.gameState.isGameActive = true;
            
            // ★ポイント：新しい5問は作らない！保存済みをそのまま使う
            this.gameState.questions = this.quizSession.questions;
            
            console.log(`再挑戦 ${this.quizSession.attempt}回目 - 固定画像番号: ${this.quizSession.imageIndex}`);
            
            this.showScreen('game');
            this.loadQuestion();
        }
    }
    
    showLevelSelection() {
        this.showScreen('start');
    }
    
    goHome() {
        this.showScreen('start');
    }
    
    showScreen(screenName) {
        // 全画面を非表示
        this.elements.startScreen.style.display = 'none';
        this.elements.gameScreen.style.display = 'none';
        this.elements.resultScreen.style.display = 'none';
        this.elements.reviewScreen.style.display = 'none'; // 復習画面も非表示
        
        // 指定画面を表示
        switch (screenName) {
            case 'start':
                this.elements.startScreen.style.display = 'block';
                break;
            case 'game':
                this.elements.gameScreen.style.display = 'block';
                break;
            case 'result':
                this.elements.resultScreen.style.display = 'block';
                break;
            case 'review':
                this.elements.reviewScreen.style.display = 'block';
                this.showReviewList();
                break;
        }
    }
    
    updateDisplay() {
        // 必要に応じて表示更新
    }

    bindEvents() {
        // レベル選択ボタンにイベントリスナーを追加
        document.querySelectorAll('.level-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = parseInt(e.currentTarget.dataset.level);
                this.startLevel(level);
            });
        });

        // 選択肢ボタンのイベント
        this.elements.choiceBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                if (this.gameState.isGameActive) {
                    this.selectAnswer(index);
                }
            });
        });

        // 音声再生ボタン
        if (this.elements.playAudioBtn) {
            this.elements.playAudioBtn.addEventListener('click', () => {
                this.playAudio();
            });
        }

        // 戻るボタン
        if (this.elements.backToHomeBtn) {
            this.elements.backToHomeBtn.addEventListener('click', () => {
                this.goHome();
            });
        }

                    // 結果画面のボタンイベント
            if (this.elements.retryBtn) {
                this.elements.retryBtn.addEventListener('click', () => {
                    this.retryLevel();
                });
            }

            // ===== 「次の5問へ」ボタン（新しい5問を作る）=====
            if (this.elements.nextSetBtn) {
                this.elements.nextSetBtn = document.getElementById('next-set-btn');
                this.elements.nextSetBtn.addEventListener('click', () => {
                    this.startNewSet(this.quizSession.level); // ここでだけ新規5問を生成
                });
            }

        if (this.elements.pairLevelBtn) {
            this.elements.pairLevelBtn.addEventListener('click', () => {
                this.gotoPairLevel();
            });
        }

        if (this.elements.otherLevelBtn) {
            this.elements.otherLevelBtn.addEventListener('click', () => {
                this.showScreen('start');
            });
        }

        if (this.elements.homeBtn) {
            this.elements.homeBtn.addEventListener('click', () => {
                this.showScreen('start');
            });
        }

        // 復習ボタン
        if (this.elements.reviewBtn) {
            this.elements.reviewBtn.addEventListener('click', () => {
                this.showScreen('review');
            });
        }

        // 復習画面のボタン
        if (this.elements.reviewBackBtn) {
            this.elements.reviewBackBtn.addEventListener('click', () => {
                this.showScreen('start');
            });
        }
        
        if (this.elements.backToReviewBtn) {
            this.elements.backToReviewBtn.addEventListener('click', () => {
                this.gameState.isReviewMode = false;
                this.showScreen('review');
            });
        }

        if (this.elements.reviewSelectAllBtn) {
            this.elements.reviewSelectAllBtn.addEventListener('click', () => {
                this.selectAllReviewItems();
            });
        }

        if (this.elements.reviewDeselectAllBtn) {
            this.elements.reviewDeselectAllBtn.addEventListener('click', () => {
                this.deselectAllReviewItems();
            });
        }

        if (this.elements.reviewStartBtn) {
            this.elements.reviewStartBtn.addEventListener('click', () => {
                this.startReviewSession();
            });
        }
    }

    // ===== 復習機能 =====
    showReviewList() {
        const reviewItems = this.reviewStore.getAll();
        if (reviewItems.length === 0) {
            this.elements.reviewEmptyMessage.style.display = 'block';
            this.elements.reviewList.innerHTML = '';
            this.elements.reviewStartBtn.disabled = true;
        } else {
            this.elements.reviewEmptyMessage.style.display = 'none';
            this.elements.reviewList.innerHTML = '';
            
            reviewItems.forEach(item => {
                const li = document.createElement('li');
                li.dataset.id = item.id;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.addEventListener('change', (e) => {
                    if (!e.target.checked) {
                        // チェックを外したら削除
                        this.reviewStore.remove(item.id);
                        li.remove();
                        this.updateReviewStartButton();
                    }
                });
                
                const content = document.createElement('div');
                content.className = 'review-item-content';
                
                const chinese = document.createElement('div');
                chinese.className = 'review-item-chinese';
                chinese.textContent = item.question.chinese;
                
                const pinyin = document.createElement('div');
                pinyin.className = 'review-item-pinyin';
                pinyin.textContent = item.question.pinyin;
                
                const answer = document.createElement('div');
                answer.className = 'review-item-answer';
                answer.textContent = `正解: ${item.answer}`;
                
                const type = document.createElement('div');
                type.className = 'review-item-type';
                type.textContent = item.meta.questionType === 'text' ? '📝 文字問題' : '🔊 音声問題';
                
                content.appendChild(chinese);
                content.appendChild(pinyin);
                content.appendChild(answer);
                content.appendChild(type);
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'review-item-remove';
                removeBtn.innerHTML = '×';
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.reviewStore.remove(item.id);
                    li.remove();
                    this.updateReviewStartButton();
                });
                
                li.appendChild(checkbox);
                li.appendChild(content);
                li.appendChild(removeBtn);
                
                this.elements.reviewList.appendChild(li);
            });
            
            this.updateReviewStartButton();
        }
    }

    updateReviewStartButton() {
        const checkedItems = this.elements.reviewList.querySelectorAll('input[type="checkbox"]:checked');
        this.elements.reviewStartBtn.disabled = checkedItems.length === 0;
    }

    selectAllReviewItems() {
        this.elements.reviewList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updateReviewStartButton();
    }

    deselectAllReviewItems() {
        this.elements.reviewList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateReviewStartButton();
    }

    startReviewSession() {
        const checkedItems = this.elements.reviewList.querySelectorAll('input[type="checkbox"]:checked');
        if (checkedItems.length === 0) {
            alert('復習する問題を選択してください。');
            return;
        }

        const selectedIds = Array.from(checkedItems).map(checkbox => 
            checkbox.closest('li').dataset.id
        );
        
        const reviewItems = this.reviewStore.getByIds(selectedIds);
        
        if (reviewItems.length === 0) {
            alert('選択された問題が見つかりません。');
            return;
        }

        // 復習用の問題セットを作成
        const reviewQuestions = reviewItems.map(item => {
            console.log('復習アイテム:', item);
            return {
                ...item.question,
                japanese: item.answer,
                reviewItem: item, // 元の復習アイテムを保持
                questionType: item.meta.questionType // 元の問題タイプを保持
            };
        });
        
        console.log('復習問題セット:', reviewQuestions);

        this.gameState.isReviewMode = true;
        this.gameState.isGameActive = true;  // ゲームをアクティブにする
        this.gameState.currentQuestion = 0;
        this.gameState.correctAnswers = 0;
        this.gameState.totalQuestions = reviewQuestions.length;
        this.gameState.questions = reviewQuestions;

        this.elements.currentLevel.textContent = '復習';
        this.updateDisplay();
        this.showScreen('game');
        this.loadQuestion();
    }
}

// ゲーム開始
document.addEventListener('DOMContentLoaded', () => {
    new ChineseVocabGame();
});