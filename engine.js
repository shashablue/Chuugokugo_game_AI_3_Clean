// 中国語学習ゲームエンジン - 6レベル・セット制対応
class ChineseVocabGame {
    constructor() {
        this.gameState = {
            selectedLevel: null,
            currentQuestion: 0,
            correctAnswers: 0,
            totalQuestions: 0,
            questions: [],
            isGameActive: false,
            questionSet: null
        };
        
        // ===== セッション状態 =====
        this.quizSession = {
            level: null,           // 開始時に上書き
            questions: [],         // 5問を保存
            attempt: 0,            // 0=初回, 1=2回目...
            imageIndex: null       // 1..5 固定画像番号（初回結果で決定）
        };
        
        this.elements = {
            // 画面要素
            startScreen: document.getElementById('start-screen'),
            gameScreen: document.getElementById('game-screen'),
            resultScreen: document.getElementById('result-screen'),
            
            // スタート画面
            level1Btn: document.getElementById('level1-btn'),
            level2Btn: document.getElementById('level2-btn'),
            level3Btn: document.getElementById('level3-btn'),
            level4Btn: document.getElementById('level4-btn'),
            level5Btn: document.getElementById('level5-btn'),
            level6Btn: document.getElementById('level6-btn'),

            
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
            homeBtn: document.getElementById('home-btn')
        };
        
        this.speechSynthesis = window.speechSynthesis;
        this.currentQuestion = null;
        this.autoPlayTimeout = null;
        this.lastDisplayedImages = {};
        
        // 音効果のための音声要素を作成
        this.initializeSounds();
        
        this.initializeGame();
    }

    // ===== スコア→フォルダ対応 =====
    scoreToFolder(score) {
        if (score === 5) return 'images0';
        if (score === 4) return 'images20';
        if (score === 3) return 'images50';
        if (score === 2) return 'images70';
        return 'images100';
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
        
        // 問題タイプに応じて表示切り替え
        if (levelConfig.type === 'text') {
            this.showTextQuestion(question);
        } else if (levelConfig.type === 'audio') {
            this.showAudioQuestion(question);
        }
        
        // 選択肢生成
        this.generateChoices(question);
        
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
    
    selectAnswer(selectedIndex) {
        console.log(`=== 回答選択デバッグ ===`);
        console.log(`選択されたインデックス: ${selectedIndex}`);
        console.log(`正解インデックス: ${this.correctIndex}`);
        console.log(`ゲームアクティブ: ${this.gameState.isGameActive}`);
        
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
        
        if (levelConfig && levelConfig.type === 'audio' && this.currentQuestion) {
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
        const score = this.gameState.correctAnswers;
        const percentage = Math.round((score / this.gameState.totalQuestions) * 100);
        
        // 最終結果画面表示
        this.showFinalResult(score, percentage);
    }
    
    showFinalResult(score, percentage) {
        this.elements.scorePercent.textContent = percentage;
        
        const level = this.gameState.selectedLevel;
        const levelConfig = gameRules.settings.levels[level];
        this.elements.resultTitle.textContent = `${levelConfig.name} 最終結果`;
        
        // ペアレベルボタンの表示制御
        this.setupPairLevelButton();
        
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
        
        if (correctCount === totalQuestions) {
            // 全問正解 - 最高の褒め言葉
            this.elements.praiseChinese.textContent = '太棒了！';
            this.elements.praiseJapanese.textContent = '完璧です！';
        } else if (correctCount >= 4) {
            // 4問以上正解 - 褒め言葉
            const randomPraise = gameRules.praises[Math.floor(Math.random() * gameRules.praises.length)];
            this.elements.praiseChinese.textContent = randomPraise.chinese;
            this.elements.praiseJapanese.textContent = randomPraise.japanese;
        } else if (correctCount >= 2) {
            // 2-3問正解 - 軽い励まし
            this.elements.praiseChinese.textContent = '不错！';
            this.elements.praiseJapanese.textContent = 'よくできました！';
        } else {
            // 1問以下 - 励まし
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
            
            const folder = this.scoreToFolder(correctCount);
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
        // ===== 「もう一度」：同じ5問で再挑戦 =====
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
    }
}

// ゲーム開始
document.addEventListener('DOMContentLoaded', () => {
    new ChineseVocabGame();
});